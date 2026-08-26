"use strict";

const legal = require("./legal-content");
const SITE_NAME = legal.SITE_NAME;

/**
 * Shared page renderer. Every game gets an identical layout/behavior —
 * the only inputs that vary are the `game` object (from games.json) and
 * `catalog` (the full games.json array, for the "more games" grid, which
 * is intentionally the same list on every game's site).
 *
 * `mode` controls how URLs are built:
 *   - "dev":    path-based routing on one server  -> /2048, /run3, /play/2048/...
 *   - "build":  each game exported as its own standalone static site meant
 *               to sit at the root of its own domain -> ./play/..., and
 *               cross-links to other games use their `domain` field (or
 *               "#" if unset — an honest dead link, not a silently wrong
 *               self-link).
 *   - "portal": several games share ONE domain (e.g. one Render/Netlify
 *               site with dist/2048/, dist/run3/, dist/alien-shooter/ all
 *               deployed together, optionally with one of them ALSO
 *               mirrored at the domain root as the "home" game). Cross-
 *               links use relative sibling paths instead of `domain`.
 *               Needs `opts.depth`: 0 for a page sitting at the shared
 *               domain's root, 1 for a page sitting in its own /<slug>/
 *               subfolder (the default). For a root-mirrored "home" game
 *               specifically, also pass `opts.selfPrefix` (its own slug)
 *               so the root page's asset/embed links point at the
 *               EXISTING /<slug>/ subfolder's files instead of a second,
 *               wastefully duplicated copy at the root — Run3Source alone
 *               is 270+ images + a 7MB compiled JS, so duplicating it a
 *               second time for the root mirror pushed a Render static
 *               deploy over some upload limit and its assets 404'd.
 */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function renderFaviconLinks(assetsBase) {
  var base = assetsBase + "/favicon";
  return (
    '<link rel="icon" href="' + base + '.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="' + base + '-32x32.png">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="' + base + '-16x16.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="' + base + '-apple-touch.png">\n'
  );
}

// `rootSlug` is the game mirrored at the shared domain's root (portal mode
// only) — links to that game should point at "/" rather than its own
// "/<slug>/" subfolder, so the main game never shows a redundant path.
function gameUrl(game, mode, depth, rootSlug) {
  if (mode === "dev") return "/" + game.slug;
  if (mode === "portal") {
    if (rootSlug && game.slug === rootSlug) return "/";
    return (depth === 0 ? "" : "../") + game.slug + "/";
  }
  // no domain bought yet for this game -> honest dead link rather than a
  // silently-wrong self-referencing one; fill in `domain` in games.json
  // once purchased and rebuild.
  return game.domain ? game.domain.replace(/\/$/, "") + "/" : "#";
}

// Games are embedded one of two ways:
//   - self-hosted: the game's files live in `gameDir` and get copied into
//     the export's play/ folder, so the iframe points at a relative path.
//   - external: `embedUrl` points at somebody else's host (e.g. a
//     GameDistribution HTML5 build). Nothing is copied; the iframe points
//     straight at their URL. Some hosts additionally want the embedding
//     page's own URL passed as a query param (GameDistribution's
//     `gd_sdk_referrer_url`, without which their ad requests are attributed
//     wrongly) — that can only be known at runtime, so `embedReferrerParam`
//     is handed to main.js to append client-side.
function embedSrc(game, mode, selfPrefix) {
  if (game.embedUrl) return game.embedUrl;
  if (mode === "dev") return "/play/" + game.slug + "/" + game.indexFile;
  var base = selfPrefix ? selfPrefix.replace(/\/$/, "") + "/" : "";
  return base + "play/" + game.indexFile;
}

// A catalogue entry with neither an embedUrl nor real files behind it has
// nothing to put in the iframe. Without this check such a page still drew
// a Play button, which loaded a 404 into the frame — i.e. a white screen.
function isPlayable(game) {
  return Boolean(game.embedUrl || (game.gameDir && game.gameDir.trim()));
}

// Thumbnails default to <slug>.png, but games imported from elsewhere may
// arrive as .jpg — `image` overrides the filename when that's the case.
// `assetsBase` is where this page's shared files actually live, which is not
// always alongside the page: the root-mirrored "home" page of a portal build
// sits at dist/ but points into dist/<slug>/ so its assets aren't duplicated.
// Thumbnails have to follow the same base or the root page 404s every one.
function imageSrc(game, assetsBase) {
  return assetsBase + "/games/" + (game.image || game.slug + ".png");
}

function renderStars(rating) {
  var pct = Math.round((rating.value / 5) * 100);
  return (
    '<div class="rating" aria-label="Rating ' +
    rating.value +
    ' out of 5">' +
    '<div class="stars" style="--fill: ' +
    pct +
    '%"><span></span><span></span><span></span><span></span><span></span></div>' +
    "<strong>" +
    rating.value +
    "</strong>" +
    '<span class="muted">(' +
    rating.count.toLocaleString("en-US") +
    " ratings)</span>" +
    "</div>"
  );
}

function renderTags(tags) {
  return tags
    .map(function (t) {
      return '<span class="tag">' + escapeHtml(t) + "</span>";
    })
    .join("");
}

function renderHowto(steps) {
  return steps
    .map(function (s) {
      return "<li>" + escapeHtml(s) + "</li>";
    })
    .join("");
}

function renderFaq(faq) {
  return faq
    .map(function (item) {
      return (
        "<details>" +
        "<summary>" +
        escapeHtml(item.q) +
        "</summary>" +
        "<p>" +
        escapeHtml(item.a) +
        "</p>" +
        "</details>"
      );
    })
    .join("");
}

// Legal pages are shared, domain-wide content, not per-game — in portal
// mode they live once at the shared domain's root (not duplicated into
// every game's /<slug>/ subfolder), so linking to them is depth-relative
// like a game link, not tied to assetsBase (which is about where THIS
// page's css/js/logo/favicon happen to live, a separate concern).
function legalUrl(pageSlug, mode, depth) {
  if (mode === "dev") return "/assets/" + pageSlug + ".html";
  if (mode === "portal") return (depth === 0 ? "" : "../") + pageSlug + ".html";
  return pageSlug + ".html";
}

// The "All Games" nav button always points at the dedicated listing page
// (site/lib/render.js's renderAllGamesPage), not at the home game — same
// shared-page path rules as legalUrl.
function allGamesUrl(mode, depth) {
  if (mode === "dev") return "/assets/all-games.html";
  if (mode === "portal") return (depth === 0 ? "" : "../") + "all-games.html";
  return "all-games.html";
}

function renderFooter(assetsBase, mode, depth) {
  var contactPage = legal.pages.find(function (p) { return p.slug === "contact"; });
  var otherPages = legal.pages.filter(function (p) {
    return p.slug !== "contact";
  });

  return (
    '<footer class="site-footer">\n' +
    '<div class="footer-inner">\n' +
    '<div class="footer-col footer-col-brand">\n' +
    '<img class="footer-logo" src="' + assetsBase + '/logo.png" alt="' + SITE_NAME + ' logo" loading="lazy">\n' +
    "</div>\n" +
    '<div class="footer-col">\n' +
    '<span class="footer-col-title footer-col-heading">About Us</span>\n' +
    legal.ABOUT_BLURB +
    "\n</div>\n" +
    '<div class="footer-col">\n' +
    '<a class="footer-col-title" href="' + legalUrl(contactPage.slug, mode, depth) + '">' + escapeHtml(contactPage.navLabel) + "</a>\n" +
    '<p class="footer-email"><a href="mailto:' + legal.EMAIL + '">' + escapeHtml(legal.EMAIL) + "</a></p>\n" +
    "</div>\n" +
    '<div class="footer-col">\n' +
    '<span class="footer-col-title footer-col-heading">Pages</span>\n' +
    '<ul class="footer-links">\n' +
    otherPages
      .map(function (p) {
        return '<li><a href="' + legalUrl(p.slug, mode, depth) + '">' + escapeHtml(p.navLabel) + "</a></li>\n";
      })
      .join("") +
    "</ul>\n" +
    "</div>\n" +
    "</div>\n" +
    '<p class="muted footer-copy">© <span id="year"></span> ' + SITE_NAME + '. All games belong to their respective creators.</p>\n' +
    "</footer>\n"
  );
}

function renderLegalPage(pageDef, catalog, mode, opts) {
  opts = opts || {};
  var depth = opts.depth === undefined ? 1 : opts.depth;
  var selfPrefix = opts.selfPrefix || null;
  var assetsBase =
    mode === "dev"
      ? "/assets"
      : selfPrefix
        ? selfPrefix.replace(/\/$/, "")
        : ".";
  var homeHref = mode === "dev" || mode === "portal" ? "/" : "https://geometrydashlite.example/";

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    "<title>" + escapeHtml(pageDef.title) + " | " + SITE_NAME + "</title>\n" +
    '<meta name="description" content="' + escapeHtml(pageDef.metaDescription) + '">\n' +
    '<meta name="robots" content="index,follow">\n' +
    renderFaviconLinks(assetsBase) +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="' + assetsBase + '/style.css">\n' +
    "</head>\n" +
    '<body>\n' +
    '<a class="skip-link" href="#main">Skip to content</a>\n' +
    '<header class="site-header" id="siteHeader">\n' +
    '<div class="header-inner">\n' +
    '<a class="brand" href="' + homeHref + '">\n' +
    '<img class="brand-logo" src="' + assetsBase + '/favicon-32x32.png" alt="" width="34" height="34">\n' +
    '<span class="brand-name">' + SITE_NAME + '</span>\n' +
    "</a>\n" +
    '<nav class="main-nav" id="mainNav" aria-label="Primary">\n' +
    '<a href="' + allGamesUrl(mode, depth) + '">All Games</a>\n' +
    "</nav>\n" +
    '<button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="mainNav" aria-label="Toggle menu">\n' +
    "<span></span><span></span><span></span>\n" +
    "</button>\n" +
    "</div>\n" +
    "</header>\n" +
    '<main id="main">\n' +
    '<section class="content-section legal-page reveal">\n' +
    '<article class="about">\n' +
    pageDef.bodyHtml +
    "\n</article>\n" +
    "</section>\n" +
    "</main>\n" +
    renderFooter(assetsBase, mode, depth) +
    '<script src="' + assetsBase + '/main.js"></script>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

// The dedicated "All Games" listing the header's nav button points to —
// every game in the catalog, with its thumbnail, no current-game exclusion.
// Lives alongside the legal pages: once at the shared domain root in portal
// mode, or per-site in standalone build mode (see build.js).
function renderAllGamesPage(catalog, mode, opts) {
  opts = opts || {};
  var depth = opts.depth === undefined ? 1 : opts.depth;
  var selfPrefix = opts.selfPrefix || null;
  var rootSlug = opts.rootSlug || null;
  var assetsBase =
    mode === "dev"
      ? "/assets"
      : selfPrefix
        ? selfPrefix.replace(/\/$/, "")
        : ".";
  var homeHref = mode === "dev" || mode === "portal" ? "/" : "https://geometrydashlite.example/";

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    "<title>All Games | " + SITE_NAME + "</title>\n" +
    '<meta name="description" content="Browse every free browser game on ' + SITE_NAME + ' — click any title to play instantly, no downloads required.">\n' +
    '<meta name="robots" content="index,follow">\n' +
    renderFaviconLinks(assetsBase) +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="' + assetsBase + '/style.css">\n' +
    "</head>\n" +
    '<body>\n' +
    '<a class="skip-link" href="#main">Skip to content</a>\n' +
    '<header class="site-header" id="siteHeader">\n' +
    '<div class="header-inner">\n' +
    '<a class="brand" href="' + homeHref + '">\n' +
    '<img class="brand-logo" src="' + assetsBase + '/favicon-32x32.png" alt="" width="34" height="34">\n' +
    '<span class="brand-name">' + SITE_NAME + '</span>\n' +
    "</a>\n" +
    '<nav class="main-nav" id="mainNav" aria-label="Primary">\n' +
    '<a href="' + allGamesUrl(mode, depth) + '" class="active">All Games</a>\n' +
    "</nav>\n" +
    '<button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="mainNav" aria-label="Toggle menu">\n' +
    "<span></span><span></span><span></span>\n" +
    "</button>\n" +
    "</div>\n" +
    "</header>\n" +
    '<main id="main">\n' +
    '<section class="more-section reveal all-games-page">\n' +
    '<div class="section-heading"><h1>All Games</h1></div>\n' +
    '<div class="game-grid" id="gameGrid">' +
    renderGrid(catalog, null, mode, null, depth, assetsBase, rootSlug) +
    "</div>\n" +
    '<div class="all-games-blurb">' + legal.ALL_GAMES_BLURB + "</div>\n" +
    "</section>\n" +
    "</main>\n" +
    renderFooter(assetsBase, mode, depth) +
    '<script src="' + assetsBase + '/main.js"></script>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

function renderGrid(catalog, currentSlug, mode, limit, depth, assetsBase, rootSlug) {
  var list = catalog.filter(function (g) {
    return g.slug !== currentSlug;
  });
  if (limit) list = list.slice(0, limit);
  return list
    .map(function (g) {
      var gradient =
        "linear-gradient(135deg," +
        g.cardGradient[0] +
        "," +
        g.cardGradient[1] +
        ")";
      var imagePath = imageSrc(g, assetsBase);
      return (
        '<a class="game-card" href="' +
        gameUrl(g, mode, depth, rootSlug) +
        '">' +
        '<div class="game-card-thumb" style="background:' +
        gradient +
        '">' +
        '<img class="game-card-image" src="' + imagePath + '" alt="' + escapeHtml(g.title) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
        "<span>" +
        escapeHtml(g.initial) +
        "</span>" +
        "</div>" +
        '<div class="game-card-body">' +
        '<div class="game-card-title">' +
        escapeHtml(g.title) +
        "</div>" +
        '<div class="game-card-genre">' +
        escapeHtml(g.genre) +
        "</div>" +
        "</div>" +
        "</a>"
      );
    })
    .join("");
}

function renderPage(game, catalog, mode, opts) {
  opts = opts || {};
  var depth = opts.depth === undefined ? 1 : opts.depth;
  var selfPrefix = opts.selfPrefix || null;
  var rootSlug = opts.rootSlug || null;
  var assetsBase =
    mode === "dev"
      ? "/assets"
      : selfPrefix
        ? selfPrefix.replace(/\/$/, "")
        : ".";
  var canonical = game.domain ? game.domain.replace(/\/$/, "") + "/" : "";
  var playable = isPlayable(game);

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    "<title>" +
    escapeHtml(game.title) +
    " — Play Free Online " +
    escapeHtml(game.genre) +
    " Game | " + SITE_NAME + "</title>\n" +
    '<meta name="description" content="' +
    escapeHtml(game.seo.metaDescription) +
    '">\n' +
    (canonical ? '<link rel="canonical" href="' + canonical + '">\n' : "") +
    '<meta name="robots" content="index,follow">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:site_name" content="' + SITE_NAME + '">\n' +
    '<meta property="og:title" content="' +
    escapeHtml(game.title) +
    " — Play Free Online " +
    escapeHtml(game.genre) +
    ' Game">\n' +
    '<meta property="og:description" content="' +
    escapeHtml(game.seo.metaDescription) +
    '">\n' +
    (canonical
      ? '<meta property="og:url" content="' + canonical + '">\n'
      : "") +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' +
    escapeHtml(game.title) +
    '">\n' +
    '<meta name="twitter:description" content="' +
    escapeHtml(game.seo.metaDescription) +
    '">\n' +
    '<script type="application/ld+json">\n' +
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: game.title,
      description: game.seo.metaDescription,
      genre: game.genre,
      applicationCategory: "Game",
      operatingSystem: "Any (Web Browser)",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(game.rating.value),
        ratingCount: String(game.rating.count),
      },
    }) +
    "\n</script>\n" +
    renderFaviconLinks(assetsBase) +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="' +
    assetsBase +
    '/style.css">\n' +
    "<style>:root{--accent:" +
    game.colors.accent +
    ";--accent-2:" +
    game.colors.accent2 +
    ";}</style>\n" +
    "</head>\n" +
    '<body data-game-slug="' + escapeHtml(game.slug) + '">\n' +
    '<a class="skip-link" href="#main">Skip to content</a>\n' +
    '<header class="site-header" id="siteHeader">\n' +
    '<div class="header-inner">\n' +
    '<a class="brand" href="' +
    (mode === "dev" || mode === "portal"
      ? "/"
      : "https://geometrydashlite.example/") +
    '">\n' +
    '<img class="brand-logo" src="' + assetsBase + '/favicon-32x32.png" alt="" width="34" height="34">\n' +
    '<span class="brand-name">' + SITE_NAME + '</span>\n' +
    "</a>\n" +
    '<nav class="main-nav" id="mainNav" aria-label="Primary">\n' +
    '<a href="' + allGamesUrl(mode, depth) + '">All Games</a>\n' +
    "</nav>\n" +
    '<button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="mainNav" aria-label="Toggle menu">\n' +
    "<span></span><span></span><span></span>\n" +
    "</button>\n" +
    "</div>\n" +
    "</header>\n" +
    '<main id="main">\n' +
    '<section class="stage-section">\n' +
    '<div class="stage-blobs" aria-hidden="true"><span class="blob blob-a"></span><span class="blob blob-b"></span></div>\n' +
    '<div class="stage-wrap reveal">\n' +
    '<div class="stage-meta">\n' +
    '<div class="stage-heading">\n' +
    "<h1>" +
    escapeHtml(game.title) +
    "</h1>\n" +
    '<div class="stage-tags">' +
    renderTags(game.tags) +
    "</div>\n" +
    "</div>\n" +
    renderStars(game.rating) +
    "\n" +
    '<div class="stage-actions">\n' +
    (playable
      ? '<button class="btn btn-icon" id="fullscreenBtn" title="Play fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n'
      : "") +
    '<button class="btn btn-icon" id="likeBtn" title="Like this game"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2.1 4 6 4c2.1 0 3.6 1.1 4.4 2.4C11.2 5.1 12.7 4 14.8 4c3.9 0 5.6 4 4 7.7C19.5 16.4 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>\n' +
    '<button class="btn btn-icon" id="shareBtn" title="Copy link"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.1 10.8 15.9 6.6M8.1 13.2l7.8 4.2" stroke="currentColor" stroke-width="2"/></svg></button>\n' +
    "</div>\n" +
    "</div>\n" +
    '<div class="stage-columns">\n' +
    '<div class="game-frame' +
    (game.orientation === "portrait" ? " is-portrait" : "") +
    (playable ? "" : " is-unavailable") +
    '" id="gameFrame"' +
    (playable
      ? ' data-game-src="' + escapeHtml(embedSrc(game, mode, selfPrefix)) + '"'
      : "") +
    ' data-game-title="' +
    escapeHtml(game.title) +
    '"' +
    (playable && game.embedReferrerParam
      ? ' data-game-referrer-param="' + escapeHtml(game.embedReferrerParam) + '"'
      : "") +
    ">\n" +
    '<div class="game-frame-inner">\n' +
    '<div class="poster" id="poster">\n' +
    '<div class="poster-art" aria-hidden="true">\n' +
    '<span class="poster-tile t1">' +
    escapeHtml(game.initial) +
    "</span>\n" +
    "</div>\n" +
    (playable
      ? '<button class="play-btn" id="playBtn" aria-label="Play ' +
        escapeHtml(game.title) +
        '">\n' +
        '<span class="play-btn-ring"></span>\n' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>\n' +
        "</button>\n" +
        '<p class="poster-hint">Click to play · loads instantly</p>\n'
      : '<p class="poster-hint poster-hint-soon">Coming soon</p>\n') +
    "</div>\n" +
    '<div class="loader" id="loader">\n' +
    '<div class="loader-spinner" aria-hidden="true"></div>\n' +
    "<p>Starting game…</p>\n" +
    '<div class="loader-bar"><span id="loaderBarFill"></span></div>\n' +
    "</div>\n" +
    "</div>\n" +
    "</div>\n" +
    '<aside class="suggestions" aria-label="Suggested games">\n' +
    "<h2>More games</h2>\n" +
    '<div class="suggestions-list">' +
    renderGrid(catalog, game.slug, mode, 8, depth, assetsBase, rootSlug) +
    "</div>\n" +
    "</aside>\n" +
    "</div>\n" +
    '</div>\n' +
    '<div class="game-carousel-container">\n' +
      '<div class="game-carousel">\n' +
        catalog.map(function(g, i) {
          var bgGradient = "linear-gradient(135deg," + g.cardGradient[0] + "," + g.cardGradient[1] + ")";
          var imagePath = imageSrc(g, assetsBase);
          return '<a class="carousel-item" href="' + gameUrl(g, mode, depth, rootSlug) + '" title="' + escapeHtml(g.title) + '">' +
            '<div class="carousel-item-bg" style="background:' + bgGradient + '"></div>' +
            '<img class="carousel-item-image" src="' + imagePath + '" alt="' + escapeHtml(g.title) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
            '<span class="carousel-item-badge">' + escapeHtml(g.initial) + '</span>' +
            '<div class="carousel-item-label">' + escapeHtml(g.title) + '</div>' +
          '</a>';
        }).join("") +
      '</div>\n' +
    '</div>\n' +
    "</section>\n" +
    '<section class="content-section reveal">\n' +
    '<div class="content-grid">\n' +
    '<article class="about">\n' +
    "<h2>About " +
    escapeHtml(game.title) +
    "</h2>\n" +
    "<p>" +
    escapeHtml(game.about) +
    "</p>\n" +
    "<h3>How to play</h3>\n" +
    '<ol class="howto">' +
    renderHowto(game.howto) +
    "</ol>\n" +
    "<h3>Frequently asked questions</h3>\n" +
    renderFaq(game.faq) +
    "\n" +
    "</article>\n" +
    '<aside class="side-panel">\n' +
    '<div class="panel-card">\n' +
    "<h3>Game info</h3>\n" +
    '<dl class="meta-list">\n' +
    // imported games don't always come with a known release year — show
    // no row at all rather than a "Released" label with nothing after it
    (game.released
      ? "<div><dt>Released</dt><dd>" + escapeHtml(game.released) + "</dd></div>\n"
      : "") +
    "<div><dt>Category</dt><dd>" +
    escapeHtml(game.genre) +
    "</dd></div>\n" +
    "<div><dt>Platform</dt><dd>Browser</dd></div>\n" +
    "<div><dt>Controls</dt><dd>" +
    escapeHtml(game.controls) +
    "</dd></div>\n" +
    "</dl>\n" +
    "</div>\n" +
    '<div class="panel-card">\n' +
    "<h3>Share</h3>\n" +
    '<div class="share-row"><button class="btn btn-outline" data-share="copy">Copy link</button><button class="btn btn-outline" data-share="x">X</button></div>\n' +
    "</div>\n" +
    "</aside>\n" +
    "</div>\n" +
    "</section>\n" +
    '<section class="more-section reveal">\n' +
    '<div class="section-heading"><h2>Browse all games</h2></div>\n' +
    '<div class="game-grid" id="gameGrid">' +
    renderGrid(catalog, game.slug, mode, null, depth, assetsBase, rootSlug) +
    "</div>\n" +
    "</section>\n" +
    "</main>\n" +
    renderFooter(assetsBase, mode, depth) +
    '<script src="' +
    assetsBase +
    '/main.js"></script>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

module.exports = {
  renderPage: renderPage,
  renderLegalPage: renderLegalPage,
  renderAllGamesPage: renderAllGamesPage,
  legalPages: legal.pages,
  gameUrl: gameUrl,
  embedSrc: embedSrc,
};
