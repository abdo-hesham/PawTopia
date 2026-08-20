import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

// Headless Chrome over the DevTools protocol, shared by the screenshot and the video
// scripts. Chrome is already on any machine that builds this site, so the alternative —
// a couple of hundred megabytes of bundled browser — buys nothing.

const CHROMES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export async function findChrome() {
  for (const candidate of CHROMES) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("no Chrome or Edge found — add its path to scripts/lib/chrome.mjs");
}

// A CDP client small enough to not be worth a dependency: one socket, replies matched by
// id, page commands routed by sessionId.
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let seq = 0;
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = (seq += 1);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => socket.close(),
  };
}

export async function launch({ port = 9333, profileDir }) {
  const chrome = spawn(await findChrome(), [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  let endpoint;
  for (let attempt = 0; attempt < 80 && !endpoint; attempt += 1) {
    try {
      endpoint = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  if (!endpoint) throw new Error("Chrome never opened a debugging port");

  const client = connect(endpoint);
  await client.ready;

  return {
    async page({ width, height, dpr = 1, mobile = false, reducedMotion = false }) {
      const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
      const send = (method, params) => client.send(method, params, sessionId);

      await send("Page.enable");
      await send("Runtime.enable");
      if (reducedMotion) {
        await send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
      }
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });

      return {
        send,
        async goto(url, settle = 6000) {
          await send("Page.navigate", { url });
          await sleep(settle);
        },
        // Resolves once the page has painted twice, so ScrollTrigger has ticked on the new
        // scroll position before the frame is grabbed.
        async settle() {
          await send("Runtime.evaluate", {
            expression: "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
            awaitPromise: true,
          });
        },
        async evaluate(expression) {
          const { result } = await send("Runtime.evaluate", { expression, returnByValue: true });
          return result.value;
        },
        async shot(format = "png", quality) {
          const { data } = await send("Page.captureScreenshot", { format, ...(quality ? { quality } : {}) });
          return Buffer.from(data, "base64");
        },
        close: () => client.send("Target.closeTarget", { targetId }),
      };
    },
    close() {
      client.close();
      chrome.kill();
    },
  };
}
