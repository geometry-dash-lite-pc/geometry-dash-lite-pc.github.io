#!/usr/bin/env node
"use strict";

/**
 * One-off reskin pass for Run3Source's texture assets: converts every PNG
 * under img/ and model/ to a neon space/cyberpunk duotone (deep indigo ->
 * violet -> cyan), preserving exact pixel dimensions and alpha so the
 * engine's texture-atlas JSON frame maps stay valid. Luminance-based, so
 * all original shading/AO/detail is preserved, only recolored.
 *
 * Usage:
 *   node tools/reskin-run3.js --pilot   -> processes a handful of sample
 *                                          files into tools/preview/ without
 *                                          touching the real assets
 *   node tools/reskin-run3.js --apply   -> overwrites every PNG under
 *                                          Run3Source/img and Run3Source/model
 *                                          in place (Run3Source is its own
 *                                          git repo — revert with git if
 *                                          the result isn't right)
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const GAME_DIR = path.join(ROOT, "Run3Source");

// palette matches the launcher's --accent / --accent-2, so the embedded
// game visually belongs to the same site
const SHADOW = [8, 6, 26];
const MID = [108, 60, 220];
const HIGH = [64, 245, 220];

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function tritone(t) {
  // mild contrast boost around the midpoint before mapping, so the neon
  // look has real deep shadows and bright highlights instead of mush
  t = 0.5 + (t - 0.5) * 1.2;
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? lerpColor(SHADOW, MID, t / 0.5) : lerpColor(MID, HIGH, (t - 0.5) / 0.5);
}

async function reskinFile(srcPath, destPath) {
  const img = sharp(srcPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const [nr, ng, nb] = tritone(lum);
    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = a;
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(destPath);
}

function findPngs(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findPngs(full));
    else if (entry.isFile() && full.toLowerCase().endsWith(".png")) results.push(full);
  }
  return results;
}

async function main() {
  const mode = process.argv[2];

  if (mode === "--pilot") {
    const samples = [
      "img/singledpi/texture/Skybox0.png",
      "img/character/Runner.png",
      "img/menu/GearIcon.png",
      "img/achievement/RampingUp.png",
      "model/terrain.png"
    ];
    for (const rel of samples) {
      const src = path.join(GAME_DIR, rel);
      const dest = path.join(ROOT, "tools", "preview", rel.replace(/[\\/]/g, "__"));
      await reskinFile(src, dest);
      console.log("wrote", path.relative(ROOT, dest));
    }
    return;
  }

  if (mode === "--apply") {
    const targets = findPngs(path.join(GAME_DIR, "img")).concat(findPngs(path.join(GAME_DIR, "model")));
    console.log(`reskinning ${targets.length} PNGs in place...`);
    for (const file of targets) {
      await reskinFile(file, file);
      process.stdout.write(".");
    }
    console.log(`\ndone. ${targets.length} files updated.`);
    return;
  }

  console.log("usage: node tools/reskin-run3.js --pilot | --apply");
}

main().catch((err) => { console.error(err); process.exit(1); });
