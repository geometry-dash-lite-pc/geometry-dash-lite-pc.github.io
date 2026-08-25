#!/usr/bin/env node
"use strict";

/**
 * PILOT: repacks Runner's sprite atlas to add real headroom above the
 * character in every frame and draws a simple cap/hood shape into that
 * new space, instead of the earlier "recolor only" approach.
 *
 * Why this is safe: the atlas format stores, per frame, a fixed logical
 * box size (spriteSourceSize.w/h, constant 90x92 for every frame — this
 * is what the engine anchors/positions the character against) plus an
 * offset (spriteSourceSize.x/y) of where the trimmed, visible pixels sit
 * within that box. The untrimmed area is transparent, unused space that
 * was already implicitly part of the box — we're not enlarging anything
 * the engine doesn't already expect, just filling in previously-empty
 * pixels within it. So: reduce top-side trim by up to HAT_HEIGHT px
 * (however much headroom that frame actually has), taller frame.h in the
 * atlas, spriteSourceSize.y shifts up to match, spriteSourceSize.w/h
 * (the box the engine anchors against) is left completely untouched.
 *
 * Frames with little/no headroom just get a smaller or no hat — self
 * -limiting rather than risking a broken frame.
 *
 * Usage: node tools/add-hat-pilot.js --apply
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const GAME_DIR = path.join(__dirname, "..", "Run3Source");
const PNG_PATH = path.join(GAME_DIR, "img", "character", "Runner.png");
const JSON_PATH = path.join(GAME_DIR, "img", "character", "Runner.json");

const HAT_HEIGHT = 12;   // logical px, capped per-frame by available headroom
const MIN_FRAME_SIZE = 10; // skip degenerate near-empty frames (e.g. the 2x2 blank frame)
const HAT_FILL = { r: 64, g: 245, b: 220, alpha: 1 };   // neon cyan, matches theme
const HAT_OUTLINE = { r: 8, g: 6, b: 26, alpha: 1 };    // dark indigo, matches outline style
const MAX_ATLAS_WIDTH = 1024;

function lerp(a, b, t) { return a + (b - a) * t; }

function buildHatRow(rowWidth, ry) {
  // trapezoid cap: narrow at the top, wider brim near the body
  const widthFrac = lerp(0.38, 0.82, ry);
  const halfW = (widthFrac * rowWidth) / 2;
  const cx = rowWidth / 2;
  return { xStart: Math.round(cx - halfW), xEnd: Math.round(cx + halfW) };
}

async function main() {
  if (process.argv[2] !== "--apply") {
    console.log("usage: node tools/add-hat-pilot.js --apply");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  const atlas = sharp(PNG_PATH).ensureAlpha();
  const { data: atlasData, info } = await atlas.raw().toBuffer({ resolveWithObject: true });
  const atlasW = info.width;

  function getPixel(x, y) {
    const idx = (y * atlasW + x) * 4;
    return [atlasData[idx], atlasData[idx + 1], atlasData[idx + 2], atlasData[idx + 3]];
  }

  // build each new (possibly taller) frame buffer first, so we know sizes
  // before packing
  const built = [];
  for (const f of manifest.frames) {
    const { frame, spriteSourceSize } = f;
    const skip = frame.w < MIN_FRAME_SIZE || frame.h < MIN_FRAME_SIZE;
    const hatH = skip ? 0 : Math.min(HAT_HEIGHT, spriteSourceSize.y);
    const newW = frame.w;
    const newH = frame.h + hatH;

    const buf = Buffer.alloc(newW * newH * 4);

    // copy existing trimmed pixels down by hatH rows
    for (let y = 0; y < frame.h; y++) {
      for (let x = 0; x < frame.w; x++) {
        const [r, g, b, a] = getPixel(frame.x + x, frame.y + y);
        const di = ((y + hatH) * newW + x) * 4;
        buf[di] = r; buf[di + 1] = g; buf[di + 2] = b; buf[di + 3] = a;
      }
    }

    // draw the hat into the newly-freed rows
    for (let r = 0; r < hatH; r++) {
      const ry = hatH <= 1 ? 1 : r / (hatH - 1);
      const { xStart, xEnd } = buildHatRow(newW, ry);
      for (let x = Math.max(0, xStart); x < Math.min(newW, xEnd); x++) {
        const outline = x === xStart || x === xEnd - 1 || r === 0;
        const c = outline ? HAT_OUTLINE : HAT_FILL;
        const di = (r * newW + x) * 4;
        buf[di] = c.r; buf[di + 1] = c.g; buf[di + 2] = c.b; buf[di + 3] = 255;
      }
    }

    built.push({
      buf, w: newW, h: newH, hatH,
      spriteSourceSize: { x: spriteSourceSize.x, y: spriteSourceSize.y - hatH, w: spriteSourceSize.w, h: spriteSourceSize.h }
    });
  }

  // shelf-pack the new frames into a fresh atlas
  let x = 0, y = 0, rowH = 0, atlasWidth = 0;
  const placed = [];
  for (const b of built) {
    if (x + b.w > MAX_ATLAS_WIDTH) { x = 0; y += rowH; rowH = 0; }
    placed.push({ x, y });
    atlasWidth = Math.max(atlasWidth, x + b.w);
    x += b.w;
    rowH = Math.max(rowH, b.h);
  }
  const atlasHeight = y + rowH;

  const composite = built.map((b, i) => ({ input: b.buf, raw: { width: b.w, height: b.h, channels: 4 }, left: placed[i].x, top: placed[i].y }));

  await sharp({ create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composite)
    .png()
    .toFile(PNG_PATH);

  const newFrames = manifest.frames.map((f, i) => ({
    spriteSourceSize: built[i].spriteSourceSize,
    frame: { x: placed[i].x, y: placed[i].y, w: built[i].w, h: built[i].h }
  }));
  fs.writeFileSync(JSON_PATH, JSON.stringify({ frames: newFrames }));

  console.log(`done. Runner.png repacked to ${atlasWidth}x${atlasHeight}, ${newFrames.length} frames, hats added where headroom allowed.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
