import { fileURLToPath } from "node:url";
import sharp from "sharp";

// The Open Graph card: 1200x630, assembled from art the site already ships rather than drawn
// fresh. Shared links previewed blank before this existed.
const root = new URL("../assets/", import.meta.url);
// public/, not assets/: the tag has to name a stable absolute path a crawler can fetch
// without running the app, and Vite does not fingerprint or rewrite meta content values
const out = fileURLToPath(new URL("../public/pawtopia-share.jpg", import.meta.url));

const WIDTH = 1200;
const HEIGHT = 630;
const CREAM = "#fbf6ec";
const NAVY = "#123a56";
const CORAL = "#c94420";

const paw = `<g fill="${CORAL}" transform="translate(0,0) scale(2.4)">
  <circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" />
  <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
</g>`;

const backdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${CREAM}" />
  <g transform="translate(74,86)">${paw}</g>
  <text x="74" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="68" fill="${NAVY}">Better care for the pets</text>
  <text x="74" y="336" font-family="Georgia, 'Times New Roman', serif" font-size="68" fill="${NAVY}">you <tspan font-style="italic" fill="${CORAL}">love.</tspan></text>
  <text x="76" y="404" font-family="Arial, Helvetica, sans-serif" font-size="25" letter-spacing="1.2" fill="${NAVY}" opacity="0.72">Thoughtful essentials and gentle veterinary care.</text>
  <text x="76" y="556" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="4" fill="${NAVY}">P A W T O P I A</text>
  <rect x="74" y="596" width="150" height="3" fill="${CORAL}" />
</svg>`;

const walker = await sharp(fileURLToPath(new URL("person-dog.webp", root)))
  .resize({ height: 400, fit: "inside" })
  .toBuffer();

const ground = await sharp(fileURLToPath(new URL("ground-details.webp", root)))
  .resize({ width: 680, fit: "inside" })
  .toBuffer();

await sharp(Buffer.from(backdrop))
  .composite([
    { input: ground, left: 600, top: 452, blend: "over" },
    { input: walker, left: 775, top: 172, blend: "over" },
  ])
  .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
  .toFile(out);

const meta = await sharp(out).metadata();
process.stdout.write(`pawtopia-share.jpg ${meta.width}x${meta.height} ${Math.round(meta.size / 1024)}KB\n`);
