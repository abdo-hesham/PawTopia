import { readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// The product renders sit on a flat cream backdrop that is very close in colour to the
// packaging itself, so a plain colour key eats the paper bags along with the background.
// This walks inward from the border instead: a pixel joins the background only if it is
// reachable from an edge through small colour steps. That follows the backdrop's soft
// gradient and its shadow, and stops at the product's edge where the step is large.
const SIZE = 900;              // working resolution
const LOCAL_STEP = Number(process.env.LOCAL_STEP || 7);   // biggest colour jump treated as "same surface"
const GLOBAL_TOLERANCE = Number(process.env.GLOBAL_TOLERANCE || 44); // drift allowed from the corner colour
const FEATHER = 1;             // px of alpha softening at the cut

const dir = new URL("../assets/products/", import.meta.url);

function distance(a, b, ai, bi) {
  const dr = a[ai] - b[bi];
  const dg = a[ai + 1] - b[bi + 1];
  const db = a[ai + 2] - b[bi + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function cutout(data, width, height) {
  const alpha = new Uint8Array(width * height).fill(255);
  const queue = [];
  const seen = new Uint8Array(width * height);

  // the four corners describe the backdrop
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4];
  const reference = [0, 0, 0];
  corners.forEach((index) => {
    reference[0] += data[index] / 4;
    reference[1] += data[index + 1] / 4;
    reference[2] += data[index + 2] / 4;
  });

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (seen[pixel]) return;
    seen[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }

  while (queue.length) {
    const pixel = queue.pop();
    const index = pixel * 4;
    if (distance(data, reference, index, 0) > GLOBAL_TOLERANCE) continue;
    alpha[pixel] = 0;
    const x = pixel % width;
    const y = (pixel - x) / width;
    [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const neighbour = ny * width + nx;
      if (seen[neighbour]) return;
      if (distance(data, data, neighbour * 4, index) > LOCAL_STEP) return;
      seen[neighbour] = 1;
      queue.push(neighbour);
    });
  }

  // soften the cut so the edge does not read as a paper-cut against the page
  const soft = Uint8Array.from(alpha);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      let sum = 0;
      let count = 0;
      for (let dy = -FEATHER; dy <= FEATHER; dy += 1) {
        for (let dx = -FEATHER; dx <= FEATHER; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += alpha[ny * width + nx];
          count += 1;
        }
      }
      soft[pixel] = Math.round(sum / count);
    }
  }

  for (let pixel = 0; pixel < soft.length; pixel += 1) data[pixel * 4 + 3] = soft[pixel];
  return data;
}

const files = (await readdir(dir)).filter((file) => /^product-\d+\.png$/.test(file));

for (const file of files) {
  const source = fileURLToPath(new URL(file, dir));
  const name = file.replace(/\.png$/, "");
  const { data, info } = await sharp(source)
    .resize(SIZE, SIZE, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cut = cutout(data, info.width, info.height);
  const trimmed = await sharp(cut, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })                        // drop the empty margin the cut leaves
    .resize(700, 700, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 92, effort: 6 })
    .toBuffer();

  await sharp(trimmed).toFile(fileURLToPath(new URL(`${name}.webp`, dir)));
  const meta = await sharp(trimmed).metadata();
  process.stdout.write(`${name}.webp ${meta.width}x${meta.height} ${Math.round(trimmed.length / 1024)}KB\n`);
}

// the earlier catalogue photography is replaced, so its files do not linger in the bundle
const stale = (await readdir(dir)).filter((file) => /\.(webp|jpg|png)$/.test(file) && !/^product-\d+\./.test(file));
for (const file of stale) await unlink(fileURLToPath(new URL(file, dir)));
if (stale.length) process.stdout.write(`removed ${stale.length} replaced files\n`);
