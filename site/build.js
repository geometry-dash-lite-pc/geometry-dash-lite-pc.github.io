#!/usr/bin/env node
"use strict";

/**
 * Builds a fully self-contained static site per game in games.json, under
 * <outDir>/<slug>/. All of them share the same template/CSS/JS (site/lib/render.js,
 * site/css, site/js); only games.json differs per game.
 *
 * Three ways to run it:
 *
 * 1. One domain per game, no shared "home" game (rare — you'd need a
 *    separate domain for literally every game):
 *      node site/build.js
 *    Each dist/<slug>/ is standalone and meant to sit at the root of that
 *    game's OWN domain. Cross-links between games use each game's `domain`
 *    field in games.json (or "#" if that game doesn't have one yet).
 *
 * 2. ONE domain/server, with one game picked as its "main game" at the
 *    domain root, and every other game still reachable at /<slug>/ on that
 *    same domain (e.g. yoursite.com/ is Run 3, yoursite.com/2048/ is 2048):
 *      node site/build.js run3
 *    Run `node site/build.js --list` to see every slug you can pass here.
 *    Writes to dist/ — upload the whole dist/ folder to that one server.
 *
 * 3. MULTIPLE domains/servers at once, each with its own main game, each
 *    kept in its own folder so building one doesn't overwrite another:
 *      node site/build.js --all
 *    Reads domains.json (repo root) — an array of
 *      { "domain": "yourdomain.com", "mainGame": "<slug>" }
 *    and writes each one to dist/<domain>/. Upload dist/<domain>/ to that
 *    domain's server. This is the "switch the main game per server"
 *    workflow: edit domains.json, re-run --all, re-upload whichever
 *    folder(s) changed.
 */

const fs = require("fs");
const path = require("path");
const { renderPage, renderLegalPage, renderAllGamesPage, renderNotFoundPage, legalPages } = require("./lib/render");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const games = JSON.parse(fs.readFileSync(path.join(ROOT, "games.json"), "utf8"));

function listSlugs() {
  console.log("Available slugs (games.json):\n");
  games.forEach((g) => console.log("  " + g.slug.padEnd(26) + g.title));
  console.log("\nUse one of these with: node site/build.js <slug>");
}

// Legal pages (about, contact, dmca, ...) are shared, domain-wide content,
// not per-game — written once at the shared domain root (portal mode) or
// once per standalone site (build mode), never duplicated into a game's
// own "/<slug>/" subfolder. `selfPrefix`, when given, points them at an
// existing subfolder's css/js/logo/favicon instead of the local copy —
// unused by the current callers now that the portal root owns its assets
// directly, but kept for anything that still wants to reuse a subfolder's
// files instead of duplicating them.
function writeLegalPages(outDir, mode, depth, selfPrefix) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const pageDef of legalPages) {
    const html = renderLegalPage(pageDef, games, mode, { depth, selfPrefix });
    fs.writeFileSync(path.join(outDir, pageDef.slug + ".html"), html);
  }
}

// The "All Games" nav button's target — same shared-page placement rules
// as legal pages (see writeLegalPages above).
function writeAllGamesPage(outDir, mode, depth, selfPrefix, rootSlug) {
  fs.mkdirSync(outDir, { recursive: true });
  const html = renderAllGamesPage(games, mode, { depth, selfPrefix, rootSlug });
  fs.writeFileSync(path.join(outDir, "all-games.html"), html);
}

function writeGameSite(game, outDir, mode, depth, rootSlug) {
  fs.mkdirSync(outDir, { recursive: true });

  fs.copyFileSync(path.join(__dirname, "css", "style.css"), path.join(outDir, "style.css"));
  fs.copyFileSync(path.join(__dirname, "js", "main.js"), path.join(outDir, "main.js"));
  fs.copyFileSync(path.join(__dirname, "images", "logo.png"), path.join(outDir, "logo.png"));

  const faviconDir = path.join(__dirname, "images", "favicon");
  fs.readdirSync(faviconDir).forEach(function (file) {
    fs.copyFileSync(path.join(faviconDir, file), path.join(outDir, file));
  });

  // In portal mode, legal pages live once at the shared domain's root
  // (written separately by buildPortal after this loop) — every game links
  // there with a relative "../<page>.html" instead of getting its own copy.
  // In standalone build mode each game IS its own domain root, so it needs
  // its own copy right here.
  if (mode !== "portal") {
    for (const pageDef of legalPages) {
      const html = renderLegalPage(pageDef, games, mode, { depth });
      fs.writeFileSync(path.join(outDir, pageDef.slug + ".html"), html);
    }
    writeAllGamesPage(outDir, mode, depth, null, rootSlug);
  }

  // copy game images if they exist
  var imagesDir = path.join(__dirname, "images", "games");
  var outImagesDir = path.join(outDir, "games");
  if (fs.existsSync(imagesDir)) {
    fs.mkdirSync(outImagesDir, { recursive: true });
    fs.readdirSync(imagesDir).forEach(function (file) {
      fs.copyFileSync(path.join(imagesDir, file), path.join(outImagesDir, file));
    });
  }

  // only copy game directory if one is specified (skip for external-embed
  // games and template/coming-soon games — nothing to copy for either)
  if (game.gameDir && game.gameDir.trim()) {
    const srcGameDir = path.join(ROOT, game.gameDir);
    const playDir = path.join(outDir, "play");
    fs.cpSync(srcGameDir, playDir, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}.git${path.sep}`) && !src.endsWith(`${path.sep}.git`),
    });
  }

  const html = renderPage(game, games, mode, { depth, rootSlug });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
}

// Builds one full "domain" worth of output: every OTHER game gets its own
// <outDir>/<slug>/ subfolder (so <outDir>/2048/, <outDir>/run3/, ... all
// work), all cross-linking via relative sibling paths. rootSlug's game is
// written directly at <outDir> itself — not mirrored from a "/<rootSlug>/"
// subfolder, there IS no such subfolder — so the domain root is the only
// URL that game ever has. Anything still pointing at the old subfolder path
// (a bookmark, a search result) hits 404.html, which bounces back to "/".
function buildPortal(rootSlug, outDir) {
  const rootGame = games.find((g) => g.slug === rootSlug);
  if (!rootGame) {
    console.error(`error: "${rootSlug}" is not a slug in games.json. Run with --list to see options.`);
    return false;
  }

  fs.rmSync(outDir, { recursive: true, force: true });

  for (const game of games) {
    if (game.slug === rootSlug) continue;
    writeGameSite(game, path.join(outDir, game.slug), "portal", 1, rootSlug);
  }

  // The root game is written straight into outDir — its own css/js/logo/
  // favicon/play files live right here, not reused from a subfolder.
  writeGameSite(rootGame, outDir, "portal", 0, rootSlug);

  // Legal pages + the "All Games" listing live once at the shared domain
  // root too, alongside the root game's now-local assets.
  writeLegalPages(outDir, "portal", 0, null);
  writeAllGamesPage(outDir, "portal", 0, null, rootSlug);

  // GitHub Pages serves this for any unmatched path on the domain —
  // bounces old/removed URLs (like the former "/<rootSlug>/" subfolder)
  // back to "/".
  fs.writeFileSync(path.join(outDir, "404.html"), renderNotFoundPage());

  // GitHub Pages pipes everything through Jekyll unless this file exists,
  // and Jekyll silently omits paths it treats as special (anything starting
  // with "_" or "."), which can quietly break a game's asset folder.
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

  console.log(
    `built ${path.relative(ROOT, outDir)}/  (main game: ${rootGame.title} at "/", ${games.length} games total)`
  );
  return true;
}

// One standalone site per game, each meant for its OWN separate domain —
// no shared "main game", no cross-linking within one folder.
function buildStandaloneAll(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const game of games) {
    const gameOutDir = path.join(outDir, game.slug);
    writeGameSite(game, gameOutDir, "build", 1);
    fs.writeFileSync(path.join(gameOutDir, "404.html"), renderNotFoundPage());
    console.log(
      `built ${path.relative(ROOT, gameOutDir)}/ (${game.title}) — deploy this folder to ${game.domain || "its own domain"}`
    );
  }
  console.log(`\nDone. ${games.length} standalone site(s) written to ${path.relative(ROOT, outDir)}/.`);
}

function buildAllFromDomainsJson() {
  const domainsPath = path.join(ROOT, "domains.json");
  if (!fs.existsSync(domainsPath)) {
    console.error("error: domains.json not found at repo root. Create it as an array of:");
    console.error('  [{ "domain": "yourdomain.com", "mainGame": "<slug>" }, ...]');
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(domainsPath, "utf8"));
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("error: domains.json must be a non-empty array.");
    process.exit(1);
  }

  let ok = 0;
  for (const { domain, mainGame } of entries) {
    if (!domain || !mainGame) {
      console.error(`error: skipping malformed entry — needs both "domain" and "mainGame": ${JSON.stringify({ domain, mainGame })}`);
      continue;
    }
    if (buildPortal(mainGame, path.join(DIST, domain))) ok++;
  }

  console.log(`\nDone. ${ok}/${entries.length} domain folder(s) written under dist/ — upload each dist/<domain>/ to that domain's server.`);
  if (ok < entries.length) process.exitCode = 1;
}

/**
 * Works out which game belongs at "/" without being told, so the exact same
 * source can be pushed to many GitHub Pages repos unchanged. In order:
 *
 *   1. MAIN_GAME env var          — explicit override, wins over everything
 *   2. main-game.txt at repo root — explicit override, committed per repo
 *   3. the repository name        — "2048.github.io" -> "2048",
 *                                   "run3.github.io" -> "run3"
 *
 * (3) is the reason no per-repo edit is normally needed: on GitHub Actions,
 * GITHUB_REPOSITORY is "<owner>/<repo>", and a user/organisation Pages repo
 * is always named "<owner>.github.io", so the owner name doubles as the slug.
 */
function resolveMainGame() {
  const has = (s) => games.some((g) => g.slug === s);

  const fromEnv = (process.env.MAIN_GAME || "").trim();
  if (fromEnv) {
    if (has(fromEnv)) return { slug: fromEnv, via: "MAIN_GAME env var" };
    console.error(`error: MAIN_GAME="${fromEnv}" is not a slug in games.json.`);
    return null;
  }

  const filePath = path.join(ROOT, "main-game.txt");
  if (fs.existsSync(filePath)) {
    const fromFile = fs.readFileSync(filePath, "utf8").trim();
    if (fromFile) {
      if (has(fromFile)) return { slug: fromFile, via: "main-game.txt" };
      console.error(`error: main-game.txt says "${fromFile}", which is not a slug in games.json.`);
      return null;
    }
  }

  const repo = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";
  const fromRepo = repo.replace(/\.github\.io$/i, "").toLowerCase();
  if (fromRepo) {
    if (has(fromRepo)) return { slug: fromRepo, via: `repository name "${repo}"` };

    // Repo names usually carry a marketing suffix the slug doesn't have
    // ("geometry-dash-lite-pc" -> geometry-dash-lite, "run3-online" -> run3).
    // Check longest slug first so "geometry-dash-lite-2" isn't beaten to the
    // match by the shorter "geometry-dash-lite" that also prefixes it.
    const prefixMatch = games
      .map((g) => g.slug)
      .sort((a, b) => b.length - a.length)
      .find((slug) => fromRepo.startsWith(slug + "-"));
    if (prefixMatch) {
      return { slug: prefixMatch, via: `repository name "${repo}"` };
    }
  }

  console.error("error: could not work out which game should be the root game.");
  console.error("Fix it in any one of these ways:");
  console.error('  - name the repo "<slug>.github.io" (e.g. 2048.github.io)');
  console.error('  - commit a main-game.txt at the repo root containing just the slug');
  console.error("  - set the MAIN_GAME env var / workflow input");
  if (fromRepo) console.error(`\n(repo name suggested "${fromRepo}", which is not in games.json)`);
  console.error("\nRun: node site/build.js --list   to see valid slugs.");
  return null;
}

const arg = process.argv[2] || null;

if (arg === "--list" || arg === "-l") {
  listSlugs();
} else if (arg === "--auto") {
  const resolved = resolveMainGame();
  if (!resolved) process.exit(1);
  console.log(`main game resolved from ${resolved.via}: ${resolved.slug}`);
  if (!buildPortal(resolved.slug, DIST)) process.exit(1);
} else if (arg === "--all") {
  buildAllFromDomainsJson();
} else if (arg) {
  if (!buildPortal(arg, DIST)) process.exit(1);
  console.log("Deploy the whole dist/ folder to this server.");
} else {
  buildStandaloneAll(DIST);
}
