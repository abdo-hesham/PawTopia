import { readdir } from "node:fs/promises";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// The illustrations ship at print resolution — a 1254px character rendered at 170px is a
// texture the GPU carries through every scroll frame for nothing. Each asset is capped at
// roughly twice the largest size it is ever displayed at, so it still holds up on a 2x
// screen, then written as webp.
const MAX_EDGE = {
  "ground-details": 2000,
  "left-environment": 1200,
  "right-environment": 1200,
  "left-blob-footer": 1200,
  "footer-dog-cat": 1400,
  "blob-1": 1200,
  "blob-2": 1100,
  "person+cat": 1100,
  "person-dog": 700,
  "return-transparent": 700,
  "vet-4k-transparent": 1400,
};
const DEFAULT_MAX_EDGE = 640;

const assetsDir = new URL("../assets/", import.meta.url);
const files = (await readdir(assetsDir)).filter((file) => file.endsWith(".png"));

await Promise.all(
  files.map(async (file) => {
    const name = parse(file).name;
    const source = fileURLToPath(new URL(file, assetsDir));
    const output = fileURLToPath(new URL(`${name}.webp`, assetsDir));
    const limit = MAX_EDGE[name] ?? DEFAULT_MAX_EDGE;
    await sharp(source)
      .resize({ width: limit, height: limit, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 6, smartSubsample: true })
      .toFile(output);
    process.stdout.write(`${join("assets", file)} -> ${join("assets", name)}.webp (max ${limit}px)\n`);
  }),
);
