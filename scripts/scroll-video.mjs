import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import { launch } from "./lib/chrome.mjs";

// A scroll-through of the live site, rendered as video for Reels and for the LinkedIn and
// Facebook feeds.
//
// Frames are stepped rather than recorded. A screen recording of headless Chrome tops out
// around 7fps and Lenis damps synthetic wheel events to a crawl, so instead each frame sets
// an exact scroll position, waits two paints for ScrollTrigger to catch up, and grabs a
// still. Every scrubbed animation on the page is a function of scroll position, so the
// result is the real motion at a locked 30fps with nothing dropped.
//
//   node scripts/scroll-video.mjs                       both sizes, live site
//   node scripts/scroll-video.mjs reel-9x16             one size
//   PACE=1.4 node scripts/scroll-video.mjs                 slower scroll, longer video
//   node scripts/scroll-video.mjs feed-1x1 --plate       write the backdrop and stop
//   SITE=http://localhost:5173 node scripts/scroll-video.mjs

const SITE = process.env.SITE || "https://pawtopia-six.vercel.app";
const FPS = 60;

// The scroll never stops between the opening and the finale. Speed eases down over a
// chapter so it can be read and back up over the paw trail that joins it to the next one,
// but it never reaches zero — a glide-and-hold rhythm jumped straight over the trails,
// which are the part of the page that shows where the paws are walking.
const PACE = Number(process.env.PACE || 1);
// Relative, not absolute: the profile decides how the time is spread across the page, and
// JOURNEY then stretches the whole thing to a fixed length. The desktop layout scrolls
// 19,500px to the phone's 12,150 — pinning eats more scroll on a taller viewport — so a
// speed in pixels per second would have made the two videos wildly different lengths.
const SCENE_PACE = 1;      // relative dwell while a chapter fills the viewport
const TRAIL_PACE = 1.7;    // relative dwell while crossing the paw trail between them
const JOURNEY = 48 * PACE; // seconds of moving scroll, whatever the page height
const OPENING_HOLD = 1.6 * PACE;  // seconds held on the hero before anything moves
const FINALE_HOLD = 1.8 * PACE;   // seconds held on the footer
const END_CARD = 2.2;

const CREAM = "#fbf6ec";
const NAVY = "#123a56";
const CORAL = "#f27152";
const CORAL_DEEP = "#c94420";
const SAGE = "#98ad86";
const PEACH = "#f8dcc8";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Arial Narrow', Arial, sans-serif";

const TARGETS = [
  {
    // Reels, Stories, TikTok. The mobile viewport is shot at exactly 9:16 so it fills the
    // frame edge to edge with no letterboxing.
    name: "reel-9x16",
    width: 1080,
    height: 1920,
    viewport: { width: 432, height: 768, dpr: 2.5, mobile: true },
  },
  {
    // LinkedIn and Facebook feeds, where a desktop layout in a browser window reads as a
    // piece of work rather than as a phone recording.
    name: "feed-1x1",
    width: 1080,
    height: 1080,
    viewport: { width: 1512, height: 945, dpr: 1, mobile: false },
    frame: { width: 1000, bar: 40, radius: 18 },
  },
];

const artDir = new URL("../assets/", import.meta.url);
const outDir = new URL("../social/", import.meta.url);
const workDir = new URL("../.shots/", import.meta.url);
const run = promisify(execFile);

const svg = (body, width, height) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);

const paw = (x, y, scale, fill) => `<g transform="translate(${x},${y}) scale(${scale})" fill="${fill}">
  <circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" />
  <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
</g>`;

const dots = `<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
  <circle cx="2" cy="2" r="1.5" fill="${NAVY}" opacity="0.1" />
</pattern>`;

// The site's own scenery, reused around the browser window so the square version sits in
// the world the page is set in rather than on a blank card. Everything is held well back in
// opacity — the frame is the subject.
const SCENERY = [
  { file: "cloud_vector.svg", width: 224, left: 322, top: 38, opacity: 0.5 },
  { file: "cloud_vector.svg", width: 138, left: 646, top: 106, opacity: 0.34 },
  { file: "birds_vector.svg", width: 172, left: 862, top: 18, opacity: 0.42 },
  { file: "left-branch-vector.svg", width: 152, left: 14, top: 864, opacity: 0.62 },
  { file: "right-branch.svg", width: 152, left: 916, top: 862, opacity: 0.62 },
  { file: "botanical_branch.svg", width: 128, left: 248, top: 902, opacity: 0.7 },
  { file: "botanical_branch.svg", width: 96, left: 792, top: 938, opacity: 0.55 },
];

// Fading is done by multiplying the alpha channel: sharp's composite has no opacity of its
// own, but dest-in against a uniformly translucent plate scales what is already there.
async function scenery(file, width, opacity) {
  const buffer = await sharp(fileURLToPath(new URL(file, artDir)), { density: 150 })
    .resize({ width })
    .ensureAlpha()
    .png()
    .toBuffer();
  const { width: w, height: h } = await sharp(buffer).metadata();
  return sharp(buffer)
    .composite([{
      input: { create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: opacity } } },
      blend: "dest-in",
    }])
    .png()
    .toBuffer();
}

// sharp refuses a composite that runs past the canvas, so scenery bleeding off an edge is
// cropped to what actually lands on the frame.
async function place(buffer, left, top, canvasW, canvasH) {
  const { width, height } = await sharp(buffer).metadata();
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let l = Math.round(left);
  let t = Math.round(top);
  if (l < 0) { x = -l; w += l; l = 0; }
  if (t < 0) { y = -t; h += t; t = 0; }
  if (l + w > canvasW) w = canvasW - l;
  if (t + h > canvasH) h = canvasH - t;
  if (w <= 0 || h <= 0) return null;
  const input = x || y || w !== width || h !== height
    ? await sharp(buffer).extract({ left: x, top: y, width: w, height: h }).png().toBuffer()
    : buffer;
  return { input, left: l, top: t };
}

const smoothstep = (t) => t * t * (3 - 2 * t);

// Slow to a fifth of pace over the first and last stretch of the page, so the video eases
// out of the opening hold and into the closing one instead of lurching.
function endRamp(y, max) {
  const RAMP = 700;
  const edge = Math.max(0, Math.min(1, Math.min(y, max - y) / RAMP));
  return 0.2 + 0.8 * smoothstep(edge);
}

// A speed profile integrated into one scroll position per frame. Sampling speed by
// position and then converting to time — rather than picking waypoints and easing between
// them — is what keeps the motion continuous across a chapter boundary.
function scrollTrack(trails, max, viewportHeight) {
  const STEP = 8;
  const BLUR = 55; // samples either side, so ~880px of glide between the two speeds

  const raw = [];
  for (let y = 0; y <= max; y += STEP) {
    const focus = y + viewportHeight / 2;
    const onTrail = trails.some((t) => focus >= t.top && focus <= t.top + t.height);
    raw.push(onTrail ? TRAIL_PACE : SCENE_PACE);
  }

  const speed = raw.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, i - BLUR); k <= Math.min(raw.length - 1, i + BLUR); k += 1) {
      sum += raw[k];
      count += 1;
    }
    return sum / count;
  });

  const times = [0];
  for (let i = 1; i < speed.length; i += 1) {
    const v = ((speed[i - 1] + speed[i]) / 2) * endRamp((i - 1) * STEP, max);
    times.push(times[i - 1] + STEP / v);
  }
  const stretch = JOURNEY / times.at(-1);
  for (let i = 0; i < times.length; i += 1) times[i] *= stretch;

  const track = [];
  const hold = (y, seconds) => {
    for (let f = 0; f < Math.round(seconds * FPS); f += 1) track.push(y);
  };

  hold(0, OPENING_HOLD);
  let cursor = 0;
  for (let f = 1; f <= Math.round(times.at(-1) * FPS); f += 1) {
    const t = f / FPS;
    while (cursor < times.length - 2 && times[cursor + 1] < t) cursor += 1;
    const span = times[cursor + 1] - times[cursor];
    const frac = span > 0 ? (t - times[cursor]) / span : 0;
    track.push(Math.min(max, Math.round((cursor + frac) * STEP)));
  }
  hold(max, FINALE_HOLD);

  return track;
}

/* ------------------------------------------------------------------ layout */

// The browser window the desktop capture is dropped into, split into what sits under the
// screenshot and what sits over it.
async function feedPlates(target) {
  const { width: frameW, bar, radius } = target.frame;
  const screenW = frameW - 4;
  const screenH = Math.round((screenW * target.viewport.height) / target.viewport.width);
  const frameH = screenH + bar + 2;
  const left = Math.round((target.width - frameW) / 2);
  const top = Math.round((target.height - frameH) / 2);

  const painted = (await Promise.all(SCENERY.map(async (item) => place(
    await scenery(item.file, item.width, item.opacity),
    item.left,
    item.top,
    target.width,
    target.height,
  )))).filter(Boolean);

  const base = await sharp(svg(`
    <defs>${dots}</defs>
    <rect width="${target.width}" height="${target.height}" fill="${CREAM}" />
    <rect width="${target.width}" height="${target.height}" fill="url(#dots)" />
    ${paw(48, 44, 1.2, CORAL_DEEP)}
    <text x="84" y="64" font-family="${SANS}" font-size="22" letter-spacing="3.8" fill="${NAVY}">PAWTOPIA</text>
    <g opacity="0.22">
      ${paw(388, 992, 1.5, CORAL_DEEP)}${paw(468, 1014, 1.5, CORAL_DEEP)}
      ${paw(548, 990, 1.5, CORAL_DEEP)}${paw(628, 1012, 1.5, CORAL_DEEP)}
    </g>
  `, target.width, target.height))
    .composite([
      ...painted,
      {
        input: svg(`<rect x="${left}" y="${top}" width="${frameW}" height="${frameH}" rx="${radius}" fill="${CREAM}" />`, target.width, target.height),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  const overlay = await sharp(svg(`
    <g transform="translate(${left},${top})">
      <rect x="1" y="1" width="${frameW - 2}" height="${frameH - 2}" rx="${radius}" fill="none" stroke="${NAVY}" stroke-width="2" />
      <path d="M1 ${bar} H ${frameW - 1}" stroke="${NAVY}" stroke-width="2" />
      <circle cx="30" cy="${bar / 2}" r="6" fill="${CORAL}" />
      <circle cx="54" cy="${bar / 2}" r="6" fill="${SAGE}" />
      <circle cx="78" cy="${bar / 2}" r="6" fill="${NAVY}" opacity="0.25" />
      <rect x="${frameW / 2 - 140}" y="${bar / 2 - 12}" width="280" height="24" rx="12" fill="${NAVY}" opacity="0.07" />
      <text x="${frameW / 2}" y="${bar / 2 + 6}" text-anchor="middle" font-family="${SANS}" font-size="16" letter-spacing="0.8" fill="${NAVY}" opacity="0.6">pawtopia-six.vercel.app</text>
    </g>
  `, target.width, target.height)).png().toBuffer();

  return { base, overlay, screenW, screenH, left: left + 2, top: top + bar };
}

async function endCard(target) {
  const tall = target.height > target.width;
  const midY = target.height / 2;
  return sharp(svg(`
    <defs>
      <linearGradient id="warm" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${CORAL}" />
        <stop offset="1" stop-color="${CORAL_DEEP}" />
      </linearGradient>
    </defs>
    <rect width="${target.width}" height="${target.height}" fill="url(#warm)" />
    <circle cx="${target.width - 90}" cy="${midY + (tall ? 460 : 300)}" r="300" fill="${PEACH}" opacity="0.2" />
    <circle cx="110" cy="${midY - (tall ? 520 : 340)}" r="250" fill="${CREAM}" opacity="0.14" />
    <g transform="translate(${target.width / 2 - 12 * 3.2},${midY - 226})">${paw(0, 0, 3.2, CREAM)}</g>
    <text x="${target.width / 2}" y="${midY - 130}" text-anchor="middle" font-family="${SANS}" font-size="34" letter-spacing="9" fill="${CREAM}">PAWTOPIA</text>
    <text x="${target.width / 2}" y="${midY - 10}" text-anchor="middle" font-family="${SERIF}" font-size="${tall ? 72 : 62}" fill="${CREAM}">Better care for the pets</text>
    <text x="${target.width / 2}" y="${midY + 82}" text-anchor="middle" font-family="${SERIF}" font-size="${tall ? 72 : 62}" font-style="italic" fill="${CREAM}">you love.</text>
    <path d="M${target.width / 2 - 70} ${midY + 150} H ${target.width / 2 + 70}" stroke="${CREAM}" stroke-width="3" opacity="0.6" />
    <text x="${target.width / 2}" y="${midY + 226}" text-anchor="middle" font-family="${SANS}" font-size="28" letter-spacing="4" fill="${CREAM}" opacity="0.85">DESIGN &amp; DEVELOPMENT</text>
  `, target.width, target.height)).jpeg({ quality: 92 }).toBuffer();
}

/* ------------------------------------------------------------------ render */

async function render(browser, target) {
  const framesDir = new URL(`frames-${target.name}/`, workDir);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const page = await browser.page(target.viewport);
  await page.goto(SITE, 9000);

  const trails = JSON.parse(await page.evaluate(
    `JSON.stringify([...document.querySelectorAll(".journey-space")].map((el) => ({ top: Math.round(el.getBoundingClientRect().top + window.scrollY), height: el.offsetHeight })))`,
  ));
  const max = await page.evaluate("document.documentElement.scrollHeight - window.innerHeight");
  const viewportHeight = await page.evaluate("window.innerHeight");
  const track = scrollTrack(trails, max, viewportHeight);
  process.stdout.write(`  ${target.name}: ${trails.length} paw trails over ${max}px, ${track.length} frames (${(track.length / FPS).toFixed(1)}s)\n`);

  const plates = target.frame ? await feedPlates(target) : null;

  let index = 0;
  const write = async (buffer) => {
    await writeFile(new URL(`${String(index).padStart(5, "0")}.jpg`, framesDir), buffer);
    index += 1;
  };

  for (const y of track) {
    await page.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})` });
    await page.settle();
    const raw = await page.shot("jpeg", 92);

    if (!plates) {
      await write(raw);
    } else {
      const screen = await sharp(raw).resize(plates.screenW, plates.screenH, { fit: "fill" }).png().toBuffer();
      await write(await sharp(plates.base)
        .composite([
          { input: screen, left: plates.left, top: plates.top },
          { input: plates.overlay, left: 0, top: 0 },
        ])
        .jpeg({ quality: 92 })
        .toBuffer());
    }
    if (index % 60 === 0) process.stdout.write(`    ${index}/${track.length}\n`);
  }

  const card = await endCard(target);
  for (let f = 0; f < Math.round(END_CARD * FPS); f += 1) await write(card);

  await page.close();

  const out = fileURLToPath(new URL(`pawtopia-${target.name}.mp4`, outDir));
  await run(ffmpeg, [
    "-y",
    "-framerate", String(FPS),
    // Joined rather than resolved through a URL, which would percent-decode "%05d".
    "-i", join(fileURLToPath(framesDir), "%05d.jpg"),
    // A silent track: some feed players treat a video with no audio stream as broken.
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-shortest",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    out,
  ]);
  await rm(framesDir, { recursive: true, force: true });
  process.stdout.write(`  → social/pawtopia-${target.name}.mp4\n`);
}

const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const targets = wanted.length ? TARGETS.filter((t) => wanted.includes(t.name)) : TARGETS;
if (!targets.length) throw new Error(`unknown target — try ${TARGETS.map((t) => t.name).join(" or ")}`);

await mkdir(outDir, { recursive: true });

// Tuning the backdrop against a ten-minute render is no way to spend an afternoon.
if (process.argv.includes("--plate")) {
  await mkdir(workDir, { recursive: true });
  for (const target of targets.filter((candidate) => candidate.frame)) {
    const { base } = await feedPlates(target);
    const file = fileURLToPath(new URL(`plate-${target.name}.png`, workDir));
    await sharp(base).png().toFile(file);
    process.stdout.write(`  ${file}
`);
  }
  process.exit(0);
}

const browser = await launch({
  port: 9334,
  profileDir: fileURLToPath(new URL("video-profile", workDir)),
});
process.stdout.write(`filming ${SITE}\n`);
for (const target of targets) await render(browser, target);
browser.close();
