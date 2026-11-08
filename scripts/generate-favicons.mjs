/**
 * generate-favicons.mjs — one-off: builds the favicon set in public/.
 *
 *   node scripts/generate-favicons.mjs
 *
 * Source: the brand "icon" variant (IconMark) in
 * src/components/layout/Logo.jsx — the A/V centre glyph from the NAVEN
 * Brand Guidelines. Its two paths are read straight from that file, so
 * the favicon can't drift from the logo. Nothing is redrawn.
 *
 * Design: Deep Navy tile (#120F4C), ~20% corner radius, the A in white
 * and the V facet in Naven Green (#2DEA87), ~12% padding each side.
 * Apple touch icon: square navy (iOS rounds it), no transparency.
 *
 * Writes (commit them; nothing is generated at runtime):
 *   favicon.svg, favicon.ico (16+32+48), favicon-16x16.png,
 *   favicon-32x32.png, apple-touch-icon.png (180),
 *   android-chrome-192x192.png, android-chrome-512x512.png,
 *   site.webmanifest
 *
 * Needs the devDependencies sharp and png-to-ico.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

const NAVY = "#120F4C";
const GREEN = "#2DEA87";
const WHITE = "#FFFFFF";

/* ---- 1. Read the icon paths from Logo.jsx ---------------------------- */

const logoSrc = fs.readFileSync(path.join(ROOT, "src/components/layout/Logo.jsx"), "utf8");
const iconFn = logoSrc.slice(logoSrc.indexOf("function IconMark"));
if (!iconFn.startsWith("function IconMark")) throw new Error("IconMark not found in Logo.jsx");
const paths = [...iconFn.matchAll(/<path className="(n-ink|n-grn)" d="([^"]+)"/g)]
  .map(([, cls, d]) => ({ cls, d }));
if (paths.length !== 2 || !paths.some((p) => p.cls === "n-ink") || !paths.some((p) => p.cls === "n-grn")) {
  throw new Error(`Expected one n-ink and one n-grn path in IconMark, found ${paths.length}`);
}

// Bounding box of both paths (absolute M/H/V/L commands only).
function bbox(ds) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of ds) {
    const tokens = d.match(/[MLHVZ]|-?\d*\.?\d+/gi);
    let cmd = null, x = 0, y = 0, i = 0;
    const take = () => Number(tokens[i++]);
    while (i < tokens.length) {
      if (/^[MLHVZ]$/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
      if (cmd === "Z") continue;
      if (cmd === "M" || cmd === "L") { x = take(); y = take(); }
      else if (cmd === "H") x = take();
      else if (cmd === "V") y = take();
      else throw new Error(`Unsupported path command ${cmd}`);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}
const box = bbox(paths.map((p) => p.d));

/* ---- 2. Build the SVG ------------------------------------------------- */

/**
 * size     — viewBox units (512 for the master)
 * radius   — corner radius as a fraction of the size (0 = square)
 * padding  — space around the glyph as a fraction of the size
 * px       — optional width/height, so the rasteriser draws at that size
 */
function tileSvg({ size = 512, radius = 0.2, padding = 0.12, px = null } = {}) {
  const inner = size * (1 - 2 * padding);
  const scale = inner / Math.max(box.w, box.h);
  const tx = (size - box.w * scale) / 2 - box.minX * scale;
  const ty = (size - box.h * scale) / 2 - box.minY * scale;
  const fill = (cls) => (cls === "n-grn" ? GREEN : WHITE);
  const glyph = paths.map(({ cls, d }) => `<path fill="${fill(cls)}" d="${d}"/>`).join("");
  const dims = px ? ` width="${px}" height="${px}"` : "";
  const r = (size * radius).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"${dims}>`
    + `<title>NAVEN</title>`
    + `<rect width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>`
    + `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${glyph}</g>`
    + `</svg>`;
}

// One design at every size: checked at 16px, the navy frame, the A/V
// diagonal gap and both notches stay visible, so the 16px icon needs no
// simplification (a thicker / larger glyph closed the gap and read worse).
const MASTER = { radius: 0.2, padding: 0.12 };
// Apple: square navy (iOS applies its own mask), no transparency.
const APPLE = { radius: 0, padding: 0.14 };

const png = (opts, px) =>
  sharp(Buffer.from(tileSvg({ ...opts, px })), { density: 72 })
    .resize(px, px)
    .png({ compressionLevel: 9 })
    .toBuffer();

/* ---- 3. Write the files ---------------------------------------------- */

const write = (name, data) => {
  fs.writeFileSync(path.join(PUBLIC, name), data);
  console.log("  wrote public/" + name);
};

write("favicon.svg", tileSvg(MASTER) + "\n");

const p16 = await png(MASTER, 16);
const p32 = await png(MASTER, 32);
const p48 = await png(MASTER, 48);
write("favicon-16x16.png", p16);
write("favicon-32x32.png", p32);
write("favicon.ico", await pngToIco([p16, p32, p48]));

const apple = await sharp(await png(APPLE, 180)).flatten({ background: NAVY }).png({ compressionLevel: 9 }).toBuffer();
write("apple-touch-icon.png", apple);
write("android-chrome-192x192.png", await png(MASTER, 192));
write("android-chrome-512x512.png", await png(MASTER, 512));

write("site.webmanifest", JSON.stringify({
  name: "NAVEN — The Premium Electronics",
  short_name: "NAVEN",
  icons: [
    { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
  ],
  theme_color: NAVY,
  background_color: NAVY,
  display: "standalone",
  start_url: "/",
}, null, 2) + "\n");

console.log(`Source: IconMark in src/components/layout/Logo.jsx (glyph box ${box.w.toFixed(1)} × ${box.h.toFixed(1)})`);
