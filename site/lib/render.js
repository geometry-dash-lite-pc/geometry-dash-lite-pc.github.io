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

// Absolute URL for a page/asset path relative to the site root. Everything
// SEO-facing (canonical, og:url, og:image, sitemap) has to be absolute;
// `siteUrl` is null when the build doesn't know its own origin (dev server,
// standalone export without a `domain`), in which case callers omit the tag.
function absUrl(siteUrl, relPath) {
  if (!siteUrl) return "";
  return siteUrl.replace(/\/*$/, "/") + String(relPath || "").replace(/^\/+/, "");
}

// <head> tags every page type shares: canonical + the four Open Graph
// properties consumers actually require (type/title/image/url — omitting
// og:image or og:url makes validators report the whole markup as missing)
// plus the Twitter equivalents.
function renderSocialMeta(opts) {
  var canonical = opts.canonical;
  var image = opts.image;
  return (
    (canonical ? '<link rel="canonical" href="' + escapeHtml(canonical) + '">\n' : "") +
    '<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">\n' +
    '<meta property="og:type" content="' + (opts.ogType || "website") + '">\n' +
    '<meta property="og:site_name" content="' + escapeHtml(SITE_NAME) + '">\n' +
    '<meta property="og:title" content="' + escapeHtml(opts.title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(opts.description) + '">\n' +
    (canonical ? '<meta property="og:url" content="' + escapeHtml(canonical) + '">\n' : "") +
    (image ? '<meta property="og:image" content="' + escapeHtml(image) + '">\n' : "") +
    (image ? '<meta property="og:image:alt" content="' + escapeHtml(opts.title) + '">\n' : "") +
    '<meta name="twitter:card" content="' + (image ? "summary_large_image" : "summary") + '">\n' +
    '<meta name="twitter:title" content="' + escapeHtml(opts.title) + '">\n' +
    '<meta name="twitter:description" content="' + escapeHtml(opts.description) + '">\n' +
    (image ? '<meta name="twitter:image" content="' + escapeHtml(image) + '">\n' : "")
  );
}

// Search results truncate past ~65 characters, so the brand suffix is only
// worth its length when it fits and isn't already implied. The main game's
// own title IS the site name ("Geometry Dash Lite | Geometry Dash Lite"),
// which is the case that pushed the homepage to 72 characters.
var TITLE_MAX = 65;

function pageTitle(game) {
  if (game.seo && game.seo.metaTitle) return game.seo.metaTitle;
  var base = game.title + " — Play Free Online " + game.genre + " Game";
  var redundant =
    SITE_NAME.toLowerCase().indexOf(game.title.toLowerCase()) !== -1 ||
    game.title.toLowerCase().indexOf(SITE_NAME.toLowerCase()) !== -1;
  if (!redundant && base.length + SITE_NAME.length + 3 <= TITLE_MAX) {
    return base + " | " + SITE_NAME;
  }
  if (base.length <= TITLE_MAX) return base;
  var shorter = game.title + " — Play Free Online Game";
  return shorter.length <= TITLE_MAX ? shorter : game.title + " — Play Online";
}

// schema.org VideoGame for the page's own game. No aggregateRating: the
// counts in games.json aren't backed by a real review mechanism, and
// publishing fabricated rating numbers in structured data risks a Google
// manual action — worse than any SEO benefit the stars added.
function gameSchema(game, canonical, image) {
  var schema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.seo.metaDescription,
    genre: game.genre,
    applicationCategory: "Game",
    operatingSystem: "Any (Web Browser)",
    playMode: "SinglePlayer",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
  if (canonical) schema.url = canonical;
  if (image) schema.image = image;
  return schema;
}

// schema.org ItemList for the "All Games" listing, so the catalogue is
// machine-readable as a list of games rather than an anonymous grid of links.
function allGamesSchema(catalog, mode, depth, rootSlug, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "All Games on " + SITE_NAME,
    numberOfItems: catalog.length,
    itemListElement: catalog.map(function (g, i) {
      var entry = {
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
      };
      if (siteUrl) {
        entry.url = absUrl(siteUrl, rootSlug && g.slug === rootSlug ? "" : g.slug + "/");
      }
      return entry;
    }),
  };
}

// robots.txt — without one, crawlers get a 404 for it and auditing tools
// flag the site as unconfigured. Points at the sitemap so it's discoverable
// without submitting it anywhere by hand.
function renderRobotsTxt(siteUrl) {
  return (
    "User-agent: *\n" +
    "Allow: /\n" +
    (siteUrl ? "\nSitemap: " + absUrl(siteUrl, "sitemap.xml") + "\n" : "")
  );
}

// sitemap.xml over every indexable URL: the root game, each other game's
// folder, the All Games listing and the legal pages. Game pages carry the
// higher priority; the boilerplate legal pages the lowest.
function renderSitemap(catalog, rootSlug, siteUrl) {
  var today = new Date().toISOString().slice(0, 10);
  var urls = [{ loc: "", priority: "1.0", changefreq: "weekly" }];

  catalog.forEach(function (g) {
    if (g.slug === rootSlug) return;
    urls.push({ loc: g.slug + "/", priority: "0.8", changefreq: "weekly" });
  });

  urls.push({ loc: "all-games.html", priority: "0.7", changefreq: "weekly" });
  legal.pages.forEach(function (p) {
    urls.push({ loc: p.slug + ".html", priority: "0.3", changefreq: "yearly" });
  });

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(function (u) {
        return (
          "  <url>\n" +
          "    <loc>" + escapeHtml(absUrl(siteUrl, u.loc)) + "</loc>\n" +
          "    <lastmod>" + today + "</lastmod>\n" +
          "    <changefreq>" + u.changefreq + "</changefreq>\n" +
          "    <priority>" + u.priority + "</priority>\n" +
          "  </url>\n"
        );
      })
      .join("") +
    "</urlset>\n"
  );
}

function renderFaviconLinks(assetsBase) {
  var base = assetsBase + "/favicon";
  return (
    '<link rel="icon" href="' + base + '.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="' + base + '-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="' + base + '-32x32.png">\n' +
    '<link rel="icon" type="image/png" sizes="48x48" href="' + base + '-48x48.png">\n' +
    '<link rel="icon" type="image/png" sizes="192x192" href="' + base + '-192x192.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="' + base + '-apple-touch.png">\n'
  );
}

// `rootSlug` is the game mirrored at the shared domain's root (portal mode
// only) — links to that game should point at "/" rather than its own
// "/<slug>/" subfolder, so the main game never shows a redundant path.
function gameUrl(game, mode, depth, rootSlug) {
  if (mode === "dev") {
    return rootSlug && game.slug === rootSlug ? "/" : "/" + game.slug;
  }
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
    renderSocialMeta({
      canonical: opts.siteUrl ? absUrl(opts.siteUrl, pageDef.slug + ".html") : "",
      title: pageDef.title + " | " + SITE_NAME,
      description: pageDef.metaDescription,
      image: opts.siteUrl ? absUrl(opts.siteUrl, "logo.png") : "",
    }) +
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
  var allGamesDescription =
    "Browse every free browser game on " + SITE_NAME +
    " — click any title to play instantly, no downloads required.";

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    "<title>All Games | " + SITE_NAME + "</title>\n" +
    '<meta name="description" content="' + allGamesDescription + '">\n' +
    renderSocialMeta({
      canonical: opts.siteUrl ? absUrl(opts.siteUrl, "all-games.html") : "",
      title: "All Games | " + SITE_NAME,
      description: allGamesDescription,
      image: opts.siteUrl ? absUrl(opts.siteUrl, "logo.png") : "",
    }) +
    '<script type="application/ld+json">\n' +
    JSON.stringify(allGamesSchema(catalog, mode, depth, rootSlug, opts.siteUrl)) +
    "\n</script>\n" +
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
  // In portal mode the page's own URL is the site origin plus its folder
  // ("" for the root game, "<slug>/" for the rest). Standalone exports fall
  // back to the game's own `domain`, which is all they know about themselves.
  var siteUrl = opts.siteUrl || null;
  var pagePath = opts.pagePath === undefined ? null : opts.pagePath;
  var canonical = siteUrl && pagePath !== null
    ? absUrl(siteUrl, pagePath)
    : game.domain
      ? game.domain.replace(/\/$/, "") + "/"
      : "";
  var ogImage = canonical
    ? canonical.replace(/\/$/, "/") + "games/" + (game.image || game.slug + ".png")
    : "";
  var title = pageTitle(game);
  var playable = isPlayable(game);

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    "<title>" + escapeHtml(title) + "</title>\n" +
    '<meta name="description" content="' +
    escapeHtml(game.seo.metaDescription) +
    '">\n' +
    renderSocialMeta({
      canonical: canonical,
      title: title,
      description: game.seo.metaDescription,
      image: ogImage,
    }) +
    '<script type="application/ld+json">\n' +
    JSON.stringify(gameSchema(game, canonical, ogImage)) +
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
    '<div class="stage-actions">\n' +
    (playable
      ? '<button class="btn btn-icon" id="fullscreenBtn" title="Play fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n'
      : "") +
    '<button class="btn btn-icon" id="likeBtn" title="Add to favorites" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2.1 4 6 4c2.1 0 3.6 1.1 4.4 2.4C11.2 5.1 12.7 4 14.8 4c3.9 0 5.6 4 4 7.7C19.5 16.4 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>\n' +
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
    (game.richContent
      ? '<div class="rich-content">' + game.richContent + "</div>\n"
      : "<h2>About " +
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
        "\n") +
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
    '<div class="share-row">' +
    '<button class="btn btn-outline" data-share="copy">Copy link</button>' +
    '<button class="btn btn-outline" data-share="x">X</button>' +
    '<button class="btn btn-outline" data-share="facebook">Facebook</button>' +
    '<button class="btn btn-outline" data-share="whatsapp">WhatsApp</button>' +
    '<button class="btn btn-outline" data-share="telegram">Telegram</button>' +
    '<button class="btn btn-outline" data-share="reddit">Reddit</button>' +
    "</div>\n" +
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

// GitHub Pages serves this file for any URL that doesn't exist on the
// domain — used to send old/removed paths (like a since-deleted
// "/<slug>/" subfolder for the root game) back to the working site.
// Self-contained and domain-root-relative on purpose: a 404 can be hit
// from any depth, so it never assumes it's sitting next to real assets.
function renderNotFoundPage() {
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>Page Not Found | " + SITE_NAME + "</title>\n" +
    '<meta name="robots" content="noindex,follow">\n' +
    '<meta http-equiv="refresh" content="0; url=/">\n' +
    '<script>location.replace("/");</script>\n' +
    '<style>\n' +
    "  html{ color-scheme: dark light; }\n" +
    "  body{\n" +
    "    margin: 0; min-height: 100vh; display: flex; flex-direction: column;\n" +
    "    align-items: center; justify-content: center; text-align: center; gap: 14px; padding: 24px;\n" +
    "    background: #0b0d14; color: #fff;\n" +
    "    font-family: \"Inter\", system-ui, -apple-system, sans-serif;\n" +
    "  }\n" +
    "  h1{ font-family: \"Space Grotesk\", \"Inter\", system-ui, sans-serif; font-size: 1.6rem; margin: 0; }\n" +
    "  p{ margin: 0; color: #9aa1b8; }\n" +
    "  a{ color: #6c5ce7; }\n" +
    "</style>\n" +
    "</head>\n" +
    "<body>\n" +
    "<h1>Redirecting…</h1>\n" +
    '<p>This page has moved. Taking you to <a href="/">' + SITE_NAME + "</a>.</p>\n" +
    "</body>\n" +
    "</html>\n"
  );
}

module.exports = {
  renderPage: renderPage,
  renderLegalPage: renderLegalPage,
  renderAllGamesPage: renderAllGamesPage,
  renderNotFoundPage: renderNotFoundPage,
  renderRobotsTxt: renderRobotsTxt,
  renderSitemap: renderSitemap,
  legalPages: legal.pages,
  gameUrl: gameUrl,
  embedSrc: embedSrc,
};
