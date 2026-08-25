#!/usr/bin/env node
"use strict";

/**
 * Adds a subtle diagonal nebula color-wash (violet -> magenta, screen
 * blended) on top of the already-recolored skybox/starfield textures, so
 * the background reads as a richer modern nebula instead of a flat duotone
 * starfield. Low opacity + smooth gradient (no isolated blob) to keep
 * cube-face edges from mismatching noticeably.
 *
 * Usage: node tools/skybox-nebula.js --apply
 */

const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const TEX_DIR = path.join(ROOT, "Run3Source", "img", "singledpi", "texture");

const FILES = [
  "Skybox0.png",
  "Skybox1.png",
  "Skybox2.png",
  "Skybox3.png",
  "Skybox4.png",
  "Skybox5.png",
  "RGSkybox0.png",
  "RGSkybox1.png",
  "RGSkybox2.png",
  "RGSkybox3.png",
  "RGSkybox4.png",
  "RGSkybox5.png",
];

const NEBULA_A = [90, 40, 180]; // deep violet, top-left
const NEBULA_B = [210, 40, 160]; // magenta-pink, bottom-right
const OPACITY = 0.28;

function screen(base, overlay) {
  return 255 - ((255 - base) * (255 - overlay)) / 255;
}

async function apply(file) {
  const filePath = path.join(TEX_DIR, file);
  const img = sharp(filePath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const out = Buffer.alloc(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const t = (x / width + y / height) / 2;
      const gr = NEBULA_A[0] + (NEBULA_B[0] - NEBULA_A[0]) * t;
      const gg = NEBULA_A[1] + (NEBULA_B[1] - NEBULA_A[1]) * t;
      const gb = NEBULA_A[2] + (NEBULA_B[2] - NEBULA_A[2]) * t;

      const r = data[idx],
        g = data[idx + 1],
        b = data[idx + 2],
        a = data[idx + 3];
      const sr = screen(r, gr),
        sg = screen(g, gg),
        sb = screen(b, gb);

      out[idx] = r + (sr - r) * OPACITY;
      out[idx + 1] = g + (sg - g) * OPACITY;
      out[idx + 2] = b + (sb - b) * OPACITY;
      out[idx + 3] = a;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);
}

async function main() {
  if (process.argv[2] !== "--apply") {
    console.log("usage: node tools/skybox-nebula.js --apply");
    return;
  }
  for (const file of FILES) {
    await apply(file);
    process.stdout.write(".");
  }
  console.log(`\ndone. ${FILES.length} skybox textures updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
