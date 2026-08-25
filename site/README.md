# PlayPortal — multi-game launcher architecture

One shared template + one config file (`games.json` at the repo root)
drives every game's page. No build framework, no `npm install` — plain
Node built-ins only.

```
web_games/
  games.json          <- single source of truth: one entry per game
                          (colors, SEO copy, about/howto/FAQ, rating...)
  site/
    lib/render.js      <- the ONE template. Every game's HTML comes from
                           renderPage(game, catalog, mode). Never fork
                           this per game — edit games.json instead.
    css/style.css       <- shared design system, themed via --accent/--accent-2
    js/main.js           <- shared client behavior (click-to-play, fullscreen,
                           reveal animations, share, mobile nav)
    dev-server.js       <- local dev: routes /2048, /run3, ... on one port
    build.js            <- production: exports dist/<slug>/ as a fully
                           standalone static site per game
  2048/                <- actual game source (untouched)
  Run3Source/          <- actual game source (untouched)
```

## Local development

```bash
node site/dev-server.js
```

Then open `http://localhost:3000/2048` or `http://localhost:3000/run3`
(`http://localhost:3000/` lists all games — dev convenience only). Each
route renders that game's page live from `games.json`, with the actual
game loaded through a click-to-play iframe at `/play/<slug>/...`.

## Adding a new game

1. Drop the game's static files in a new top-level folder, e.g. `SnakeGame/`.
2. Add one object to `games.json`: `slug`, `title`, `genre`, `tags`,
   `gameDir` (the folder from step 1), `indexFile`, `colors`, `cardGradient`,
   `initial`, `seo`, `rating`, `released`, `controls`, `about`, `howto`, `faq`.
3. That's it — the new game gets a route (`/slug` in dev), a card on every
   other game's "more games" grid, and its own themed page. No template
   changes needed.

## Shipping to a real domain

Each game is meant to live on its own purchased domain. Once you own it:

1. Set that game's `"domain"` in `games.json`, e.g.
   `"domain": "https://play2048example.com"`. This is also what makes the
   "more games" links on *other* sites point at it correctly (until a
   game has a domain set, its card links to `#` everywhere else — an
   honest dead link rather than a silently wrong one).
2. Run:
   ```bash
   node site/build.js
   ```
   This writes `dist/<slug>/` per game — a fully self-contained static
   site (HTML + CSS + JS + the game's own assets under `play/`). No
   server-side code, no dependencies at runtime.
3. Upload the contents of `dist/<slug>/` to that domain's static host
   (Netlify, Cloudflare Pages, GitHub Pages, S3, etc.) as the site root.

Repeat per game/domain. All exports share the exact same design and
behavior — only `games.json`'s per-game fields (colors, copy, domain)
differ, which is what "architecture should be the same, content and
colors different" means in practice here.

## Notes / next steps

- `colors.accent` / `colors.accent2` theme buttons, glow, blobs, and the
  poster tile for that game only — set per entry in `games.json`.
- `cardGradient` is the thumbnail background used on *other* games'
  "more games" grids for this game.
- SEO copy (`seo.metaDescription`, `about`, `howto`, `faq`) is rendered
  as real static HTML (crawlable without JS) — the iframe itself only
  loads after a user clicks Play, keeping first paint fast.
- `seo.ogImage` is currently unused in the template; wire it up (an
  `<meta property="og:image">` tag) once you have real screenshots per
  game.
