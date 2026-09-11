/**
 * Rasterizes public/icons/*.svg into the PNGs iOS, Android and the manifest need.
 *
 * Run by hand after changing the artwork, not during the build:
 *
 *   node scripts/generate-icons.mjs
 *
 * The PNGs are committed, so a deploy needs neither this script nor `sharp`.
 * That matters because `sharp` is only present transitively (Next pulls it in
 * for image optimization) — depending on it at build time would be depending on
 * someone else's dependency tree.
 *
 * Swapping in real artwork means replacing the two SVGs and re-running this.
 * No code references the icons by anything but these filenames.
 */

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/**
 * 180 is the size iOS actually uses for a home-screen icon; 192 and 512 are
 * what the manifest advertises for everything else.
 */
const TARGETS = [
  { source: "icon.svg", size: 180, out: "icon-180.png" },
  { source: "icon.svg", size: 192, out: "icon-192.png" },
  { source: "icon.svg", size: 512, out: "icon-512.png" },
  { source: "icon-maskable.svg", size: 512, out: "icon-maskable-512.png" },
];

for (const { source, size, out } of TARGETS) {
  const svg = await readFile(join(ICONS_DIR, source));

  // `density` is what makes the vector render sharp at the target size rather
  // than being rasterized at the SVG's nominal 512px and then scaled.
  const png = await sharp(svg, { density: (72 * size) / 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(join(ICONS_DIR, out), png);
  console.log(`${out.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
