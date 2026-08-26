"use strict";

/**
 * Works out the absolute origin the built site will be served from, which
 * canonical/og:url/sitemap entries need — a relative canonical is legal but
 * every auditing tool reports it as missing, and a sitemap can't use one at
 * all. Resolved in the same spirit as main-game.js: prefer an explicit
 * setting, then the CI-provided repo identity, then the local git remote, so
 * a plain `git push` needs no per-repo configuration.
 *
 * Order:
 *   1. SITE_URL env var (set it to override everything, e.g. a custom domain)
 *   2. GITHUB_REPOSITORY, set by GitHub Actions ("owner/repo")
 *   3. the origin remote in .git/config, for local builds
 *
 * Returns an origin WITH a trailing slash ("https://x.github.io/"), or null
 * when nothing is known — callers then omit the tags rather than emitting a
 * guessed URL, which is worse than none.
 */

const fs = require("fs");
const path = require("path");

// GitHub Pages publishes "<owner>/<owner>.github.io" at the domain root, and
// every other repo under a "/<repo>/" path prefix.
function fromOwnerRepo(owner, repo) {
  if (!owner || !repo) return null;
  repo = repo.replace(/\.git$/, "");
  if (repo.toLowerCase() === owner.toLowerCase() + ".github.io") {
    return "https://" + repo.toLowerCase() + "/";
  }
  return "https://" + owner.toLowerCase() + ".github.io/" + repo + "/";
}

function fromGitConfig(root) {
  const configPath = path.join(root, ".git", "config");
  if (!fs.existsSync(configPath)) return null;
  const text = fs.readFileSync(configPath, "utf8");
  // Matches both remote forms: https://github.com/owner/repo.git and
  // git@github.com:owner/repo.git
  const m = text.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\s/);
  return m ? fromOwnerRepo(m[1], m[2]) : null;
}

function resolveSiteUrl(root) {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/*$/, "/");
  }
  if (process.env.GITHUB_REPOSITORY) {
    const parts = process.env.GITHUB_REPOSITORY.split("/");
    const url = fromOwnerRepo(parts[0], parts[1]);
    if (url) return url;
  }
  return fromGitConfig(root);
}

module.exports = { resolveSiteUrl };
