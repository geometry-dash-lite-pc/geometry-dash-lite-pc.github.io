"use strict";

/**
 * Works out which game belongs at "/" without being told, so the exact same
 * source can be pushed to many GitHub Pages repos unchanged. In order:
 *
 *   1. MAIN_GAME env var          — explicit override, wins over everything
 *   2. main-game.txt at repo root — explicit override, committed per repo
 *   3. the repository name        — "2048.github.io" -> "2048",
 *                                   "run3.github.io" -> "run3"
 *   4. the local folder name      — same matching as (3), for `node
 *                                   site/dev-server.js` where there's no
 *                                   GITHUB_REPOSITORY to read
 *
 * (3) is the reason no per-repo edit is normally needed: on GitHub Actions,
 * GITHUB_REPOSITORY is "<owner>/<repo>", and a user/organisation Pages repo
 * is always named "<owner>.github.io", so the owner name doubles as the slug.
 *
 * Shared by build.js and dev-server.js so the dev server puts the same game
 * at "/" that a deploy would — otherwise the root game is reachable at BOTH
 * "/" and "/<slug>/" locally, which is exactly the duplicate-URL problem the
 * portal build exists to avoid.
 */

const fs = require("fs");
const path = require("path");

// Repo/folder names usually carry a marketing suffix the slug doesn't have
// ("geometry-dash-lite-pc" -> geometry-dash-lite, "run3-online" -> run3).
// Check longest slug first so "geometry-dash-lite-2" isn't beaten to the
// match by the shorter "geometry-dash-lite" that also prefixes it.
function matchName(games, name) {
  const cleaned = name.replace(/\.github\.io$/i, "").toLowerCase();
  if (!cleaned) return null;
  if (games.some((g) => g.slug === cleaned)) return cleaned;
  return (
    games
      .map((g) => g.slug)
      .sort((a, b) => b.length - a.length)
      .find((slug) => cleaned.startsWith(slug + "-")) || null
  );
}

function resolveMainGame(games, root, opts) {
  const quiet = opts && opts.quiet;
  const has = (s) => games.some((g) => g.slug === s);
  const fail = (msg) => {
    if (!quiet) console.error(msg);
  };

  const fromEnv = (process.env.MAIN_GAME || "").trim();
  if (fromEnv) {
    if (has(fromEnv)) return { slug: fromEnv, via: "MAIN_GAME env var" };
    fail(`error: MAIN_GAME="${fromEnv}" is not a slug in games.json.`);
    return null;
  }

  const filePath = path.join(root, "main-game.txt");
  if (fs.existsSync(filePath)) {
    const fromFile = fs.readFileSync(filePath, "utf8").trim();
    if (fromFile) {
      if (has(fromFile)) return { slug: fromFile, via: "main-game.txt" };
      fail(`error: main-game.txt says "${fromFile}", which is not a slug in games.json.`);
      return null;
    }
  }

  const repo = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";
  if (repo) {
    const matched = matchName(games, repo);
    if (matched) return { slug: matched, via: `repository name "${repo}"` };
  }

  const folder = path.basename(root);
  if (folder) {
    const matched = matchName(games, folder);
    if (matched) return { slug: matched, via: `folder name "${folder}"` };
  }

  fail("error: could not work out which game should be the root game.");
  fail("Fix it in any one of these ways:");
  fail('  - name the repo "<slug>.github.io" (e.g. 2048.github.io)');
  fail('  - commit a main-game.txt at the repo root containing just the slug');
  fail("  - set the MAIN_GAME env var / workflow input");
  if (repo) fail(`\n(repo name "${repo}" did not match any slug in games.json)`);
  fail("\nRun: node site/build.js --list   to see valid slugs.");
  return null;
}

module.exports = { resolveMainGame: resolveMainGame };
