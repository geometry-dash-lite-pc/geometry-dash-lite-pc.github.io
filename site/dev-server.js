#!/usr/bin/env node
"use strict";

/**
 * Local dev server: renders every game at its own path route so the
 * routing matches what production (one domain per game) will feel like.
 *
 *   /                 -> index of all games (dev convenience only,
 *                         not part of any per-game export)
 *   /<slug>           -> that game's launcher page, rendered live from
 *                         games.json + site/lib/render.js
 *   /assets/style.css
 *   /assets/main.js   -> shared assets
 *   /play/<slug>/...  -> static passthrough to the real game folder
 *                         (games.json[].gameDir), so the iframe embed
 *                         works identically to the built dist/ output
 *
 * Usage: node site/dev-server.js [port]   (default 3000)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { renderPage, renderLegalPage, renderAllGamesPage, legalPages } = require("./lib/render");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.argv[2]) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8"
};

function loadGames() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "games.json"), "utf8"));
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-cache" }, headers || {}));
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

function renderIndex(games) {
  const cards = games
    .map((g) => {
      const gradient = `linear-gradient(135deg,${g.cardGradient[0]},${g.cardGradient[1]})`;
      return `<a class="game-card" href="/${g.slug}">
        <div class="game-card-thumb" style="background:${gradient}"><span>${g.initial}</span></div>
        <div class="game-card-body">
          <div class="game-card-title">${g.title}</div>
          <div class="game-card-genre">${g.genre}</div>
        </div>
      </a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PlayPortal (dev) — all games</title>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<main style="max-width:1240px;margin:0 auto;padding:60px 24px;">
  <h1>PlayPortal — local dev index</h1>
  <p class="muted">Each game below is its own route today (${games.map((g) => "/" + g.slug).join(", ")}) and its own standalone domain-ready export once you run <code>node site/build.js</code>.</p>
  <div class="game-grid">${cards}</div>
</main>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const games = loadGames();

  if (parts.length === 0) {
    return send(res, 200, renderIndex(games), { "Content-Type": "text/html; charset=utf-8" });
  }

  if (parts[0] === "assets") {
    if (parts[1] === "games" && parts.length >= 3) {
      // serve game images: /assets/games/{slug}.png
      const imagePath = path.join(__dirname, "images", "games", parts.slice(2).join("/"));
      if (!imagePath.startsWith(path.join(__dirname, "images", "games"))) return send(res, 403, "Forbidden");
      return serveFile(res, imagePath);
    }
    if (parts.length === 2 && parts[1].endsWith(".html")) {
      const slug = parts[1].slice(0, -".html".length);
      if (slug === "all-games") {
        const html = renderAllGamesPage(games, "dev");
        return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
      }
      const pageDef = legalPages.find((p) => p.slug === slug);
      if (pageDef) {
        const html = renderLegalPage(pageDef, games, "dev");
        return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
      }
    }
    const ASSET_FILES = {
      "style.css": "css/style.css",
      "main.js": "js/main.js",
      "logo.png": "images/logo.png",
      "favicon.ico": "images/favicon/favicon.ico",
      "favicon-16x16.png": "images/favicon/favicon-16x16.png",
      "favicon-32x32.png": "images/favicon/favicon-32x32.png",
      "favicon-apple-touch.png": "images/favicon/favicon-apple-touch.png"
    };
    const relPath = ASSET_FILES[parts[1]];
    if (!relPath) return send(res, 404, "Unknown asset: " + parts[1]);
    return serveFile(res, path.join(__dirname, relPath));
  }

  if (parts[0] === "play" && parts.length >= 2) {
    const slug = parts[1];
    const game = games.find((g) => g.slug === slug);
    if (!game) return send(res, 404, "Unknown game: " + slug);
    const rest = parts.slice(2).join("/") || game.indexFile;
    const filePath = path.join(ROOT, game.gameDir, rest);
    if (!filePath.startsWith(path.join(ROOT, game.gameDir))) return send(res, 403, "Forbidden");
    return serveFile(res, filePath);
  }

  const slug = parts[0];
  const game = games.find((g) => g.slug === slug);
  if (game) {
    const html = renderPage(game, games, "dev");
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  send(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`PlayPortal dev server running at http://localhost:${PORT}`);
  loadGames().forEach((g) => console.log(`  http://localhost:${PORT}/${g.slug}  (${g.title})`));
});
