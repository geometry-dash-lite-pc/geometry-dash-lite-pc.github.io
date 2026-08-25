#!/usr/bin/env node
"use strict";

/**
 * PILOT v2: the first attempt (add-hat-pilot.js) placed the hat in the
 * empty margin above each frame's topmost pixel — but that topmost pixel
 * is usually an antenna tip, not the head, so the hat rendered as a
 * disconnected cyan bar floating above the antennae instead of sitting on
 * the character.
 *
 * This version detects where the actual round body begins per frame (the
 * first row, scanning down, whose opaque pixel run is wide relative to
 * the frame — antennae are thin, the body is not) and paints a beanie
 * shape overlapping down from there, directly over existing pixels. No
 * canvas resize, no atlas repack, no JSON changes — pure pixel overlay
 * within each frame's existing bounds, so it carries none of the
 * repack risk the first attempt did.
 *
 * Usage: node tools/add-hat-pilot-v2.js --apply
 */

const path = require("path");
const sharp = require("sharp");

const GAME_DIR = path.join(__dirname, "..", "Run3Source");
const PNG_PATH = path.join(GAME_DIR, "img", "character", "Runner.png");
const JSON_PATH = path.join(GAME_DIR, "img", "character", "Runner.json");

const WIDTH_THRESHOLD_FRAC = 0.42; // row counts as "body" once its opaque run is this wide
const HAT_HEIGHT = 16;
const MIN_FRAME_SIZE = 10;
const HAT_FILL = [64, 245, 220];
const HAT_OUTLINE = [8, 6, 26];

function lerp(a, b, t) { return a + (b - a) * t; }

async function main() {
  if (process.argv[2] !== "--apply") {
    console.log("usage: node tools/add-hat-pilot-v2.js --apply");
    return;
  }

  const manifest = require(JSON_PATH);
  const img = sharp(PNG_PATH).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const atlasW = info.width;

  function opaqueRun(frame, rowLocal) {
    const y = frame.y + rowLocal;
    let left = -1, right = -1;
    for (let x = 0; x < frame.w; x++) {
      const idx = (y * atlasW + (frame.x + x)) * 4;
      if (data[idx + 3] > 40) {
        if (left === -1) left = x;
        right = x;
      }
    }
    return left === -1 ? 0 : right - left + 1;
  }

  let hatsPainted = 0;
  for (const f of manifest.frames) {
    const { frame } = f;
    if (frame.w < MIN_FRAME_SIZE || frame.h < MIN_FRAME_SIZE) continue;

    // find first row (top-down) whose opaque run is wide enough to be "body"
    let bodyTop = -1;
    for (let r = 0; r < frame.h; r++) {
      if (opaqueRun(frame, r) >= frame.w * WIDTH_THRESHOLD_FRAC) { bodyTop = r; break; }
    }
    if (bodyTop === -1) continue; // never found a wide-enough row, skip

    const hatH = Math.min(HAT_HEIGHT, frame.h - bodyTop);
    hatsPainted++;

    for (let r = 0; r < hatH; r++) {
      const ry = hatH <= 1 ? 1 : r / (hatH - 1);
      const widthFrac = lerp(0.42, 0.86, ry); // narrow crown -> wide brim
      const halfW = (widthFrac * frame.w) / 2;
      const cx = frame.w / 2;
      const xStart = Math.max(0, Math.round(cx - halfW));
      const xEnd = Math.min(frame.w, Math.round(cx + halfW));
      const y = frame.y + bodyTop + r;
      for (let x = xStart; x < xEnd; x++) {
        const outline = x === xStart || x === xEnd - 1 || r === 0;
        const [cr, cg, cb] = outline ? HAT_OUTLINE : HAT_FILL;
        const idx = (y * atlasW + (frame.x + x)) * 4;
        data[idx] = cr; data[idx + 1] = cg; data[idx + 2] = cb; data[idx + 3] = 255;
      }
    }
  }

  await sharp(data, { raw: { width: atlasW, height: info.height, channels: 4 } }).png().toFile(PNG_PATH);
  console.log(`done. hat painted on ${hatsPainted}/${manifest.frames.length} frames (JSON untouched).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
