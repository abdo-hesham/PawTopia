import { fileURLToPath } from "node:url";
import { readFileSync, statSync } from "node:fs";
import sharp from "sharp";

// The tab icon is the brand mark itself — the same paw the header wears and the trail walks
// toward — drawn once in public/favicon.svg. Browsers that take an SVG icon use that file;
// these are the raster fallbacks for the ones that do not, and for a phone home screen.
const source = fileURLToPath(new URL("../public/favicon.svg", import.meta.url));
const svg = readFileSync(source);

const SIZES = [
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-180.png", size: 180 },
];

for (const { name, size } of SIZES) {
  const output = fileURLToPath(new URL(`../public/${name}`, import.meta.url));
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(output);
  process.stdout.write(`${name} ${Math.round(statSync(output).size / 1024 * 10) / 10}KB\n`);
}
