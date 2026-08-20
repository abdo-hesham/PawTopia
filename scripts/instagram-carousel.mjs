import { fileURLToPath } from "node:url";
import { mkdir, writeFile, access } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import sharp from "sharp";
import { launch } from "./lib/chrome.mjs";

// A seven-slide Instagram carousel showing the project off: 1080x1350, the 4:5 the feed
// gives the most height to. Slides are assembled the way the OG card is — real screenshots
// of the live site dropped into flat line-art frames drawn in the site's own palette,
// so the post looks like the thing it is advertising.
//
//   node scripts/instagram-carousel.mjs              reuse cached screenshots
//   node scripts/instagram-carousel.mjs --recapture  drive Chrome and shoot the site again
//   SITE=http://localhost:5173 node scripts/... --recapture   shoot a local dev server

const W = 1080;
const H = 1350;
const SLIDES = 7;

const CREAM = "#fbf6ec";
const CREAM_DEEP = "#f5ecde";
const NAVY = "#123a56";
const CORAL = "#f27152";
const CORAL_DEEP = "#c94420";
const SAGE = "#98ad86";
const SAGE_LIGHT = "#dce5d2";
const PEACH = "#f8dcc8";

// The site's own fallback stacks. Source Serif 4 and Barlow Condensed ship as woff2 inside
// node_modules, which librsvg cannot load, so the export renders in the faces style.css
// already names behind them rather than in something off-brand.
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Arial Narrow', Arial, sans-serif";

const SITE = process.env.SITE || "https://pawtopia-six.vercel.app";
const shotsDir = new URL("../.shots/", import.meta.url);
const outDir = new URL("../social/", import.meta.url);
const shot = (name) => fileURLToPath(new URL(`${name}.png`, shotsDir));

const CAPTURES = [
  { name: "desktop-hero", path: "/", width: 1600, height: 1000, dpr: 2 },
  { name: "desktop-choice", path: "/", width: 1600, height: 1000, dpr: 2, scrollTo: "#scene-choice" },
  { name: "desktop-discovery", path: "/", width: 1600, height: 1000, dpr: 2, scrollTo: "#scene-discovery" },
  { name: "desktop-vet", path: "/", width: 1600, height: 1000, dpr: 2, scrollTo: "#scene-vet" },
  { name: "desktop-family", path: "/", width: 1600, height: 1000, dpr: 2, scrollTo: "#scene-family" },
  { name: "desktop-shop", path: "/shop", width: 1600, height: 1000, dpr: 2 },
  { name: "mobile-hero", path: "/", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "mobile-shop", path: "/shop", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "mobile-vet", path: "/", width: 390, height: 844, dpr: 3, mobile: true, scrollTo: "#scene-vet" },
];

/* ---------------------------------------------------------------- capture */

async function capture() {
  await mkdir(shotsDir, { recursive: true });
  const browser = await launch({
    port: 9333,
    profileDir: fileURLToPath(new URL("chrome-profile", shotsDir)),
  });

  for (const spec of CAPTURES) {
    // The story is scroll-driven and pinned. Under reduce it drops Lenis and the pins and
    // renders each chapter settled, which is the state a still wants anyway.
    const page = await browser.page({
      width: spec.width,
      height: spec.height,
      dpr: spec.dpr,
      mobile: Boolean(spec.mobile),
      reducedMotion: true,
    });
    await page.goto(SITE + spec.path);

    if (spec.scrollTo) {
      await page.send("Runtime.evaluate", {
        expression: `document.querySelector(${JSON.stringify(spec.scrollTo)})?.scrollIntoView({ block: "start" })`,
      });
      await sleep(2500);
    }

    await writeFile(shot(spec.name), await page.shot("png"));
    process.stdout.write(`  shot ${spec.name}
`);
    await page.close();
  }

  browser.close();
}

async function shotsPresent() {
  for (const spec of CAPTURES) {
    try {
      await access(shot(spec.name));
    } catch {
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------- composition */

const svg = (body, width = W, height = H) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);

const paw = (x, y, scale, fill) => `<g transform="translate(${x},${y}) scale(${scale})" fill="${fill}">
  <circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" />
  <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
</g>`;

const dots = (opacity = 0.1) => `<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
  <circle cx="2" cy="2" r="1.5" fill="${NAVY}" opacity="${opacity}" />
</pattern>`;

// Slide furniture: the wordmark top left, the position in the deck top right.
const chrome = (index, ink = NAVY) => `
  ${paw(84, 74, 1.5, index === SLIDES ? CREAM : CORAL_DEEP)}
  <text x="128" y="98" font-family="${SANS}" font-size="27" letter-spacing="4.6" fill="${ink}">PAWTOPIA</text>
  <text x="${W - 84}" y="98" text-anchor="end" font-family="${SANS}" font-size="24" letter-spacing="3" fill="${ink}" opacity="0.55">${String(index).padStart(2, "0")} / ${String(SLIDES).padStart(2, "0")}</text>`;

async function roundedShot(file, width, height, radius, position = "top") {
  const resized = await sharp(file).resize({ width, height, fit: "cover", position }).toBuffer();
  const mask = svg(`<rect width="${width}" height="${height}" rx="${radius}" fill="#fff" />`, width, height);
  return sharp(resized).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

// A browser window in the same flat navy line the site's illustrations are drawn in.
async function browserFrame(file, width, { bar = 46, radius = 20, height } = {}) {
  const screenH = height ? height - bar - 2 : Math.round(((width - 4) * 1000) / 1600);
  const total = screenH + bar + 2;
  const screen = await sharp(file).resize({ width: width - 4, height: screenH, fit: "cover", position: "top" }).toBuffer();
  const overlay = svg(`
    <rect x="1" y="1" width="${width - 2}" height="${total - 2}" rx="${radius}" fill="none" stroke="${NAVY}" stroke-width="2" />
    <path d="M1 ${bar} H ${width - 1}" stroke="${NAVY}" stroke-width="2" />
    <circle cx="34" cy="${bar / 2}" r="6.5" fill="${CORAL}" />
    <circle cx="60" cy="${bar / 2}" r="6.5" fill="${SAGE}" />
    <circle cx="86" cy="${bar / 2}" r="6.5" fill="${NAVY}" opacity="0.25" />
    <rect x="${width / 2 - 150}" y="${bar / 2 - 13}" width="300" height="26" rx="13" fill="${NAVY}" opacity="0.07" />
    <text x="${width / 2}" y="${bar / 2 + 6}" text-anchor="middle" font-family="${SANS}" font-size="17" letter-spacing="0.8" fill="${NAVY}" opacity="0.6">pawtopia-six.vercel.app</text>
  `, width, total);
  const composed = await sharp({ create: { width, height: total, channels: 4, background: CREAM } })
    .composite([{ input: screen, left: 2, top: bar }, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  const mask = svg(`<rect width="${width}" height="${total}" rx="${radius}" fill="#fff" />`, width, total);
  return sharp(composed).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function phoneFrame(file, width) {
  const height = Math.round((width * 844) / 390);
  const bezel = 9;
  const radius = Math.round(width * 0.115);
  const screen = await roundedShot(file, width - bezel * 2, height - bezel * 2, radius - bezel + 2);
  const overlay = svg(`
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${radius}" fill="none" stroke="${NAVY}" stroke-width="2" />
    <rect x="${width / 2 - width * 0.13}" y="${bezel + 9}" width="${width * 0.26}" height="${Math.round(width * 0.062)}" rx="${Math.round(width * 0.031)}" fill="${NAVY}" />
  `, width, height);
  const composed = await sharp({ create: { width, height, channels: 4, background: NAVY } })
    .composite([{ input: screen, left: bezel, top: bezel }, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  const mask = svg(`<rect width="${width}" height="${height}" rx="${radius}" fill="#fff" />`, width, height);
  return sharp(composed).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

// librsvg's filter support is patchy, so depth is a blurred navy plate composited under the
// device rather than an feDropShadow.
async function shadowPlate(width, height, radius, { blur = 30, opacity = 0.2 } = {}) {
  const pad = blur * 2;
  const plate = svg(
    `<rect x="${pad}" y="${pad}" width="${width}" height="${height}" rx="${radius}" fill="${NAVY}" opacity="${opacity}" />`,
    width + pad * 2,
    height + pad * 2,
  );
  return { buffer: await sharp(plate).blur(blur).png().toBuffer(), pad };
}

const rotate = (buffer, degrees) =>
  sharp(buffer).rotate(degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

// sharp refuses a composite that runs past the canvas, so anything bleeding off an edge is
// cropped to what actually lands on the slide.
async function place(buffer, left, top) {
  const { width, height } = await sharp(buffer).metadata();
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let l = Math.round(left);
  let t = Math.round(top);
  if (l < 0) { x = -l; w += l; l = 0; }
  if (t < 0) { y = -t; h += t; t = 0; }
  if (l + w > W) w = W - l;
  if (t + h > H) h = H - t;
  if (w <= 0 || h <= 0) return null;
  const input = x || y || w !== width || h !== height
    ? await sharp(buffer).extract({ left: x, top: y, width: w, height: h }).png().toBuffer()
    : buffer;
  return { input, left: l, top: t };
}

async function slide(index, background, layers) {
  const resolved = (await Promise.all(layers.map((layer) => (layer ? place(layer.buffer, layer.left, layer.top) : null)))).filter(Boolean);
  const file = fileURLToPath(new URL(`pawtopia-ig-${String(index).padStart(2, "0")}.jpg`, outDir));
  await sharp(background).composite(resolved).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(file);
  process.stdout.write(`  slide ${String(index).padStart(2, "0")}\n`);
}

const under = async (buffer, left, top, radius, options) => {
  const { width, height } = await sharp(buffer).metadata();
  const { buffer: plate, pad } = await shadowPlate(width, height, radius, options);
  return { buffer: plate, left: left - pad, top: top - pad + 14 };
};

/* ------------------------------------------------------------------ slides */

async function slideCover() {
  const frame = await browserFrame(shot("desktop-hero"), 1010);
  const left = (W - 1010) / 2;
  const top = 700;
  const background = svg(`
    <defs>${dots(0.12)}</defs>
    <rect width="${W}" height="${H}" fill="${CREAM}" />
    <rect width="${W}" height="${H}" fill="url(#dots)" />
    ${chrome(1)}
    <text x="84" y="286" font-family="${SANS}" font-size="30" letter-spacing="6" fill="${CORAL_DEEP}">RECENT PROJECT</text>
    <text x="80" y="430" font-family="${SERIF}" font-size="136" fill="${NAVY}">Pawtopia</text>
    <text x="84" y="512" font-family="${SERIF}" font-size="44" font-style="italic" fill="${CORAL_DEEP}">Better care for the pets you love.</text>
    <text x="84" y="600" font-family="${SANS}" font-size="30" letter-spacing="1.4" fill="${NAVY}" opacity="0.72">A pet shop and vet clinic told as a seven-chapter scroll.</text>
    <text x="${W - 84}" y="600" text-anchor="end" font-family="${SANS}" font-size="28" letter-spacing="4" fill="${NAVY}">SWIPE →</text>
    <path d="M84 640 H ${W - 84}" stroke="${NAVY}" stroke-width="2" opacity="0.2" />
  `);
  await slide(1, background, [await under(frame, left, top, 20), { buffer: frame, left, top }]);
}

async function slideHero() {
  const frame = await browserFrame(shot("desktop-hero"), 912);
  const left = (W - 912) / 2;
  const top = 470;
  const background = svg(`
    <defs>${dots(0.1)}</defs>
    <rect width="${W}" height="${H}" fill="${CREAM_DEEP}" />
    <rect width="${W}" height="${H}" fill="url(#dots)" />
    ${chrome(2)}
    <text x="84" y="286" font-family="${SANS}" font-size="28" letter-spacing="6" fill="${CORAL_DEEP}">CHAPTER 01 · LOVE</text>
    <text x="80" y="392" font-family="${SERIF}" font-size="82" fill="${NAVY}">It opens on a walk.</text>
    <text x="84" y="1180" font-family="${SANS}" font-size="30" letter-spacing="1.4" fill="${NAVY}" opacity="0.75">Hand-drawn scenery, one line of type, one button.</text>
    <text x="84" y="1226" font-family="${SANS}" font-size="30" letter-spacing="1.4" fill="${NAVY}" opacity="0.75">No carousel of stock photography in sight.</text>
    <path d="M84 1268 H 320" stroke="${CORAL_DEEP}" stroke-width="3" />
  `);
  await slide(2, background, [await under(frame, left, top, 20), { buffer: frame, left, top }]);
}

async function slideJourney() {
  const cards = [
    // Stepped by more than a headline's height so each chapter still says its own name.
    { file: "desktop-choice", angle: -4, left: 74, top: 462 },
    { file: "desktop-discovery", angle: 3.5, left: 286, top: 762 },
    { file: "desktop-family", angle: -2, left: 118, top: 1032 },
  ];
  const layers = [];
  for (const card of cards) {
    const frame = await browserFrame(shot(card.file), 660, { bar: 38, radius: 16, height: 300 });
    const { width, height } = await sharp(frame).metadata();
    const { buffer: plate, pad } = await shadowPlate(width, height, 16, { blur: 26, opacity: 0.34 });
    const spun = await rotate(frame, card.angle);
    const spunPlate = await rotate(plate, card.angle);
    layers.push({ buffer: spunPlate, left: card.left - pad, top: card.top - pad + 16 });
    layers.push({ buffer: spun, left: card.left - (await sharp(spun).metadata()).width / 2 + width / 2, top: card.top - (await sharp(spun).metadata()).height / 2 + height / 2 });
  }
  const background = svg(`
    <rect width="${W}" height="${H}" fill="${NAVY}" />
    <circle cx="${W - 120}" cy="180" r="300" fill="${CORAL_DEEP}" opacity="0.16" />
    <circle cx="60" cy="1240" r="260" fill="${SAGE}" opacity="0.14" />
    ${chrome(3, CREAM)}
    <text x="84" y="222" font-family="${SANS}" font-size="28" letter-spacing="6" fill="${PEACH}">THE JOURNEY</text>
    <text x="80" y="326" font-family="${SERIF}" font-size="82" fill="${CREAM}">Seven chapters,</text>
    <text x="80" y="408" font-family="${SERIF}" font-size="82" font-style="italic" fill="${CORAL}">one scroll.</text>
  `);
  await slide(3, background, layers);
}

async function slidePhones() {
  // A -13/0/+13 fan. The outer two sit far enough apart that the front phone covers a
  // bezel rather than a screen, and the tilt swing still clears both slide edges.
  const width = 320;
  const deck = [
    { file: "mobile-vet", angle: -13, x: 86, y: 622 },
    { file: "mobile-shop", angle: 13, x: 674, y: 622 },
    { file: "mobile-hero", angle: 0, x: 380, y: 566 },
  ];
  const layers = [];
  for (const item of deck) {
    const phone = await phoneFrame(shot(item.file), width);
    const { width: pw, height: ph } = await sharp(phone).metadata();
    const { buffer: plate, pad } = await shadowPlate(pw, ph, Math.round(width * 0.115), { blur: 28, opacity: 0.24 });
    const spun = await rotate(phone, item.angle);
    const spunPlate = await rotate(plate, item.angle);
    const { width: sw, height: sh } = await sharp(spun).metadata();
    layers.push({ buffer: spunPlate, left: item.x - (sw - pw) / 2 - pad, top: item.y - (sh - ph) / 2 - pad + 18 });
    layers.push({ buffer: spun, left: item.x - (sw - pw) / 2, top: item.y - (sh - ph) / 2 });
  }
  const background = svg(`
    <defs>${dots(0.1)}</defs>
    <rect width="${W}" height="${H}" fill="${CREAM}" />
    <rect width="${W}" height="${H}" fill="url(#dots)" />
    <ellipse cx="540" cy="1010" rx="520" ry="330" fill="${SAGE_LIGHT}" opacity="0.75" />
    ${chrome(4)}
    <text x="84" y="286" font-family="${SANS}" font-size="28" letter-spacing="6" fill="${CORAL_DEEP}">RESPONSIVE</text>
    <text x="80" y="392" font-family="${SERIF}" font-size="82" fill="${NAVY}">Every chapter,</text>
    <text x="80" y="474" font-family="${SERIF}" font-size="82" font-style="italic" fill="${CORAL_DEEP}">in one hand.</text>
    <text x="84" y="544" font-family="${SANS}" font-size="30" letter-spacing="1.4" fill="${NAVY}" opacity="0.72">The story, the shop, and the vet — rebuilt for a thumb.</text>
  `);
  await slide(4, background, layers);
}

async function slideShop() {
  const frame = await browserFrame(shot("desktop-shop"), 912);
  const left = (W - 912) / 2;
  const top = 500;
  const background = svg(`
    <defs>${dots(0.1)}</defs>
    <rect width="${W}" height="${H}" fill="${CREAM_DEEP}" />
    <rect width="${W}" height="${H}" fill="url(#dots)" />
    ${chrome(5)}
    <text x="84" y="286" font-family="${SANS}" font-size="28" letter-spacing="6" fill="${CORAL_DEEP}">THE SHOP</text>
    <text x="80" y="392" font-family="${SERIF}" font-size="82" fill="${NAVY}">Filters, bag,</text>
    <text x="80" y="464" font-family="${SERIF}" font-size="82" font-style="italic" fill="${CORAL_DEEP}">checkout.</text>
    <g font-family="${SANS}" font-size="29" letter-spacing="1.4" fill="${NAVY}">
      <text x="84" y="1178" opacity="0.75">Live filtering · wishlist · quantity-aware bag</text>
      <text x="84" y="1224" opacity="0.75">Four-step checkout and a vet booking calendar</text>
    </g>
    <path d="M84 1266 H 320" stroke="${CORAL_DEEP}" stroke-width="3" />
  `);
  await slide(5, background, [await under(frame, left, top, 20), { buffer: frame, left, top }]);
}

async function slideCraft() {
  const swatches = [
    ["#fbf6ec", "Cream"],
    ["#123a56", "Navy"],
    ["#f27152", "Coral"],
    ["#98ad86", "Sage"],
    ["#f8dcc8", "Peach"],
  ];
  const pills = swatches
    .map(([hex, label], index) => {
      const x = 84 + (index % 2) * 468;
      const y = 760 + Math.floor(index / 2) * 116;
      return `<g>
        <rect x="${x}" y="${y}" width="428" height="92" rx="46" fill="${NAVY}" opacity="0.06" />
        <circle cx="${x + 46}" cy="${y + 46}" r="30" fill="${hex}" stroke="${NAVY}" stroke-width="2" stroke-opacity="0.25" />
        <text x="${x + 96}" y="${y + 42}" font-family="${SANS}" font-size="30" letter-spacing="2" fill="${NAVY}">${label.toUpperCase()}</text>
        <text x="${x + 96}" y="${y + 74}" font-family="${SANS}" font-size="26" letter-spacing="1.6" fill="${NAVY}" opacity="0.55">${hex.toUpperCase()}</text>
      </g>`;
    })
    .join("");
  const background = svg(`
    <defs>${dots(0.1)}</defs>
    <rect width="${W}" height="${H}" fill="${CREAM}" />
    <rect width="${W}" height="${H}" fill="url(#dots)" />
    ${chrome(6)}
    <text x="84" y="286" font-family="${SANS}" font-size="28" letter-spacing="6" fill="${CORAL_DEEP}">TYPOGRAPHY</text>
    <text x="80" y="404" font-family="${SERIF}" font-size="96" fill="${NAVY}">Source Serif 4</text>
    <text x="84" y="470" font-family="${SERIF}" font-size="40" font-style="italic" fill="${NAVY}" opacity="0.6">Headlines, quiet and bookish</text>
    <text x="80" y="592" font-family="${SANS}" font-size="88" letter-spacing="2" fill="${NAVY}">BARLOW CONDENSED</text>
    <text x="84" y="646" font-family="${SANS}" font-size="30" letter-spacing="2" fill="${NAVY}" opacity="0.6">LABELS, KICKERS, BUTTONS</text>
    <text x="84" y="722" font-family="${SANS}" font-size="28" letter-spacing="6" fill="${CORAL_DEEP}">PALETTE</text>
    ${pills}
    <g font-family="${SANS}" font-size="28" letter-spacing="2" fill="${NAVY}" opacity="0.6">
      <text x="84" y="1176">BUILT WITH</text>
    </g>
    <text x="84" y="1240" font-family="${SERIF}" font-size="46" fill="${NAVY}">Vite · GSAP · Lenis · hand-drawn SVG</text>
  `);
  await slide(6, background, []);
}

async function slideOutro() {
  const background = svg(`
    <defs>
      <linearGradient id="warm" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${CORAL}" />
        <stop offset="1" stop-color="${CORAL_DEEP}" />
      </linearGradient>
      ${dots(0.14)}
    </defs>
    <rect width="${W}" height="${H}" fill="url(#warm)" />
    <circle cx="920" cy="1180" r="320" fill="${PEACH}" opacity="0.22" />
    <circle cx="120" cy="240" r="240" fill="${CREAM}" opacity="0.14" />
    ${chrome(SLIDES, CREAM)}
    <text x="84" y="560" font-family="${SANS}" font-size="30" letter-spacing="6" fill="${CREAM}" opacity="0.85">READY WHEN YOU ARE</text>
    <text x="80" y="700" font-family="${SERIF}" font-size="88" fill="${CREAM}">Want a site that</text>
    <text x="80" y="796" font-family="${SERIF}" font-size="88" font-style="italic" fill="${CREAM}">tells a story?</text>
    <path d="M84 866 H ${W - 84}" stroke="${CREAM}" stroke-width="2" opacity="0.4" />
    <text x="84" y="944" font-family="${SANS}" font-size="32" letter-spacing="1.6" fill="${CREAM}" opacity="0.9">Design and development, start to finish.</text>
    <rect x="84" y="1070" width="420" height="96" rx="48" fill="${CREAM}" />
    <text x="294" y="1130" text-anchor="middle" font-family="${SANS}" font-size="32" letter-spacing="3" fill="${CORAL_DEEP}">SEE IT LIVE  ↓</text>
  `);
  await slide(SLIDES, background, []);
}

/* -------------------------------------------------------------------- run */

if (process.argv.includes("--recapture") || !(await shotsPresent())) {
  process.stdout.write(`capturing ${SITE}\n`);
  await capture();
}

await mkdir(outDir, { recursive: true });
await slideCover();
await slideHero();
await slideJourney();
await slidePhones();
await slideShop();
await slideCraft();
await slideOutro();
process.stdout.write(`\n${SLIDES} slides → social/\n`);
