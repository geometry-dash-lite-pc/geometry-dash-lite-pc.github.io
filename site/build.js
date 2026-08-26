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
const {
  renderPage,
  renderLegalPage,
  renderAllGamesPage,
  renderNotFoundPage,
  renderRobotsTxt,
  renderSitemap,
  legalPages,
} = require("./lib/render");
const { resolveMainGame } = require("./lib/main-game");
const { resolveSiteUrl } = require("./lib/site-url");

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
function writeLegalPages(outDir, mode, depth, selfPrefix, siteUrl) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const pageDef of legalPages) {
    const html = renderLegalPage(pageDef, games, mode, { depth, selfPrefix, siteUrl });
    fs.writeFileSync(path.join(outDir, pageDef.slug + ".html"), html);
  }
}

// The "All Games" nav button's target — same shared-page placement rules
// as legal pages (see writeLegalPages above).
function writeAllGamesPage(outDir, mode, depth, selfPrefix, rootSlug, siteUrl) {
  fs.mkdirSync(outDir, { recursive: true });
  const html = renderAllGamesPage(games, mode, { depth, selfPrefix, rootSlug, siteUrl });
  fs.writeFileSync(path.join(outDir, "all-games.html"), html);
}

function writeGameSite(game, outDir, mode, depth, rootSlug, siteUrl) {
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
    writeAllGamesPage(outDir, mode, depth, null, rootSlug, null);
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

  // The page's own path on the shared domain, which canonical/og:url need:
  // "" for the game sitting at the root, "<slug>/" for every other one.
  const pagePath = mode === "portal" ? (game.slug === rootSlug ? "" : game.slug + "/") : null;
  const html = renderPage(game, games, mode, { depth, rootSlug, siteUrl, pagePath });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
}

// Builds one full "domain" worth of output: every OTHER game gets its own
// <outDir>/<slug>/ subfolder (so <outDir>/2048/, <outDir>/run3/, ... all
// work), all cross-linking via relative sibling paths. rootSlug's game is
// written directly at <outDir> itself — not mirrored from a "/<rootSlug>/"
// subfolder, there IS no such subfolder — so the domain root is the only
// URL that game ever has. Anything still pointing at the old subfolder path
// (a bookmark, a search result) hits 404.html, which bounces back to "/".
function buildPortal(rootSlug, outDir, siteUrl) {
  const rootGame = games.find((g) => g.slug === rootSlug);
  if (!rootGame) {
    console.error(`error: "${rootSlug}" is not a slug in games.json. Run with --list to see options.`);
    return false;
  }

  fs.rmSync(outDir, { recursive: true, force: true });

  for (const game of games) {
    if (game.slug === rootSlug) continue;
    writeGameSite(game, path.join(outDir, game.slug), "portal", 1, rootSlug, siteUrl);
  }

  // The root game is written straight into outDir — its own css/js/logo/
  // favicon/play files live right here, not reused from a subfolder.
  writeGameSite(rootGame, outDir, "portal", 0, rootSlug, siteUrl);

  // Legal pages + the "All Games" listing live once at the shared domain
  // root too, alongside the root game's now-local assets.
  writeLegalPages(outDir, "portal", 0, null, siteUrl);
  writeAllGamesPage(outDir, "portal", 0, null, rootSlug, siteUrl);

  // Site-ownership verification files (Google Search Console, Bing Webmaster,
  // etc.) have to sit at the domain root untouched — copied straight through
  // rather than templated, so dropping a new one in site/verify/ is enough;
  // no build.js change needed. dist/ is rebuilt from scratch every deploy, so
  // without this step a verification file placed only in dist/ would vanish
  // on the next push.
  const verifyDir = path.join(__dirname, "verify");
  if (fs.existsSync(verifyDir)) {
    for (const file of fs.readdirSync(verifyDir)) {
      fs.copyFileSync(path.join(verifyDir, file), path.join(outDir, file));
    }
  }

  // robots.txt + sitemap.xml describe the whole domain, so they belong at
  // the root next to them. Both need the absolute origin; when it can't be
  // resolved a sitemap would be full of unusable relative URLs, so only
  // robots.txt is written.
  fs.writeFileSync(path.join(outDir, "robots.txt"), renderRobotsTxt(siteUrl));
  if (siteUrl) {
    fs.writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(games, rootSlug, siteUrl));
  }

  // GitHub Pages serves this for any unmatched path on the domain —
  // bounces old/removed URLs (like the former "/<rootSlug>/" subfolder)
  // back to "/".
  fs.writeFileSync(path.join(outDir, "404.html"), renderNotFoundPage());

  // GitHub Pages pipes everything through Jekyll unless this file exists,
  // and Jekyll silently omits paths it treats as special (anything starting
  // with "_" or "."), which can quietly break a game's asset folder.
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

  console.log(
    `built ${path.relative(ROOT, outDir)}/  (main game: ${rootGame.title} at "/", ${games.length} games total)` +
      (siteUrl ? `\n  canonical origin: ${siteUrl}` : "\n  no site URL resolved — canonical/sitemap omitted (set SITE_URL)")
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
    // Each entry here IS its own domain, so its canonical origin is known
    // outright rather than inferred from the repo.
    if (buildPortal(mainGame, path.join(DIST, domain), "https://" + domain.replace(/^https?:\/\//, "").replace(/\/*$/, "/"))) ok++;
  }

  console.log(`\nDone. ${ok}/${entries.length} domain folder(s) written under dist/ — upload each dist/<domain>/ to that domain's server.`);
  if (ok < entries.length) process.exitCode = 1;
}

const arg = process.argv[2] || null;

if (arg === "--list" || arg === "-l") {
  listSlugs();
} else if (arg === "--auto") {
  const resolved = resolveMainGame(games, ROOT);
  if (!resolved) process.exit(1);
  console.log(`main game resolved from ${resolved.via}: ${resolved.slug}`);
  if (!buildPortal(resolved.slug, DIST, resolveSiteUrl(ROOT))) process.exit(1);
} else if (arg === "--all") {
  buildAllFromDomainsJson();
} else if (arg) {
  if (!buildPortal(arg, DIST, resolveSiteUrl(ROOT))) process.exit(1);
  console.log("Deploy the whole dist/ folder to this server.");
} else {
  buildStandaloneAll(DIST);
}
