#!/usr/bin/env node
"use strict";

/**
 * Re-processes character art with a distinct accent color per character
 * (instead of the uniform violet/cyan duotone from the first reskin pass),
 * so the cast is visually distinguishable again. Reads pristine originals
 * straight from git (HEAD, before any reskin commit) to avoid compounding
 * color error from double-processing an already-recolored file, and writes
 * the result back over the current (uniformly-recolored) working files.
 *
 * Shadow color is kept constant across every character (dark indigo) so
 * outlines/AO still read as one cohesive art style; only the mid/highlight
 * accent differs per character.
 *
 * Usage: node tools/character-hues.js --apply
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const GAME_DIR = path.join(ROOT, "Run3Source");

const SHADOW = [8, 6, 26];

// name -> [mid, high]
const PALETTE = {
  Runner:        [[108, 60, 220], [64, 245, 220]],   // violet/cyan - the "default" hero, unchanged
  Ninja:         [[40, 10, 70],   [130, 60, 220]],    // near-black stealth violet
  Pirate:        [[190, 20, 60],  [255, 90, 60]],     // crimson/red-orange
  Bunny:         [[200, 30, 150], [255, 120, 220]],   // hot pink/magenta
  Angel:         [[90, 150, 220], [220, 240, 255]],   // icy white-blue
  Ghost:         [[140, 170, 200],[230, 245, 255]],   // pale ghostly cyan-white
  IceSkater:     [[30, 140, 220], [140, 230, 255]],   // ice blue
  Skier:         [[20, 110, 200], [120, 210, 255]],   // deep ice blue
  Skater:        [[220, 30, 140], [255, 110, 200]],   // magenta/pink
  Child:         [[230, 170, 20], [255, 225, 110]],   // warm amber/yellow
  JackOLantern:  [[230, 130, 10], [255, 195, 60]],    // pumpkin yellow-orange
  Climber:       [[220, 80, 20],  [255, 150, 70]],    // burnt orange
  Lizard:        [[20, 180, 90],  [140, 255, 170]],   // green
  Duplicator:    [[20, 190, 160], [110, 255, 230]],   // teal/green-cyan
  Pastafarian:   [[220, 180, 20], [255, 230, 120]],   // golden
  Gentleman:     [[30, 50, 160],  [110, 140, 230]],   // deep royal blue
  Student:       [[20, 150, 200], [110, 220, 255]],   // teal-blue
  Random:        [[230, 190, 60], [255, 235, 150]]    // wildcard gold
};

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function makeTritone(mid, high) {
  return function (t) {
    t = 0.5 + (t - 0.5) * 1.2;
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? lerpColor(SHADOW, mid, t / 0.5) : lerpColor(mid, high, (t - 0.5) / 0.5);
  };
}

function originalBuffer(relPath) {
  return execFileSync("git", ["show", `HEAD:${relPath.split(path.sep).join("/")}`], {
    cwd: GAME_DIR,
    maxBuffer: 1024 * 1024 * 50
  });
}

async function reskin(relPath, tritone) {
  const srcBuffer = originalBuffer(relPath);
  const img = sharp(srcBuffer).ensureAlpha();
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

  const destPath = path.join(GAME_DIR, relPath);
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(destPath);
}

async function main() {
  if (process.argv[2] !== "--apply") {
    console.log("usage: node tools/character-hues.js --apply");
    return;
  }

  let count = 0;
  for (const [name, [mid, high]] of Object.entries(PALETTE)) {
    const tritone = makeTritone(mid, high);
    const targets = [`img/character/${name}.png`, `img/menu/characterselection/${name}.png`];
    if (name !== "Runner") targets.push(`img/menu/characterselection/${name}Front.png`);
    if (name === "Lizard") targets.push("img/menu/characterselection/LizardFrontSleepy.png");
    if (name === "Student") {
      const closeupDir = path.join(GAME_DIR, "img/character/closeup/student");
      for (const f of fs.readdirSync(closeupDir)) {
        targets.push(`img/character/closeup/student/${f}`);
      }
    }

    for (const rel of targets) {
      const abs = path.join(GAME_DIR, rel);
      if (!fs.existsSync(abs)) continue;
      await reskin(rel, tritone);
      count++;
      process.stdout.write(".");
    }
  }
  console.log(`\ndone. ${count} files re-hued.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
