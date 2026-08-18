import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import sharp from "sharp";

// The hero art is the only art that loads eagerly, and it is sized for a desktop screen. A
// phone showing it at ~360 CSS px was still downloading the 1200px file, so each of these
// gets a narrow twin and the markup picks between them with srcset.
const VARIANTS = [
  { name: "left-environment", width: 700 },
  { name: "right-environment", width: 700 },
  { name: "ground-details", width: 1100 },
];

const dir = new URL("../assets/", import.meta.url);

for (const { name, width } of VARIANTS) {
  const source = fileURLToPath(new URL(`${name}.webp`, dir));
  const output = fileURLToPath(new URL(`${name}-${width}.webp`, dir));
  await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toFile(output);
  const before = Math.round(statSync(source).size / 1024);
  const after = Math.round(statSync(output).size / 1024);
  process.stdout.write(`${name}-${width}.webp ${after}KB (from ${before}KB)\n`);
}
