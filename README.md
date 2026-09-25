# VoidOne Website

Official public website for **VoidOne — an open-source native PC gaming platform built around games, not a store.**

## Structure

```text
VoidOne-Website/
├── site/                     # deployable static site (Cloudflare Pages / Workers assets)
│   ├── index.html            # English home
│   ├── fa/                   # Persian (RTL) site
│   ├── platform/ downloads/ developers/ project/
│   ├── css/
│   │   ├── variables.css     # colour tokens + accent decks
│   │   ├── core/             # base and layout
│   │   ├── components/       # nav + command deck (hud.css)
│   │   └── pages/            # page-specific styles
│   ├── js/
│   │   ├── core/             # env (paths + preferences), site (nav/reveal), hud (deck)
│   │   ├── api/              # GitHub client
│   │   ├── components/       # downloads, effects, evolution, palette, telemetry
│   │   └── pwa.js            # service worker registration
│   ├── data/                 # evolution.json, features.json, project.json, search.json
│   ├── assets/icons/         # SVG + PNG app icons
│   ├── sw.js                 # service worker (offline shell)
│   ├── offline.html          # offline fallback page
│   └── manifest.webmanifest  # PWA manifest
├── src/worker.js             # download router (/download/*) for Cloudflare Workers
├── scripts/sync-downloads.mjs
├── tests/                    # static contract checks (no framework)
└── wrangler.jsonc
```

## Principles

- Reflect the current VoidOne implementation instead of inventing capabilities.
- Keep implemented, experimental and planned work distinct.
- Stay static-first and dependency-light — no build step, no framework.
- Keep the site independent from the main application repository.
- Use the main VoidOne repository as the canonical source for code, releases and history.

## Command deck

The website ships a small, keyboard-first interface layer on every page. Everything degrades
gracefully: with scripting disabled — or offline — the content still renders from static HTML.

| Feature | How to reach it | Notes |
| --- | --- | --- |
| Command palette | `Ctrl`/`⌘` + `K`, or the dock button | Fuzzy search over pages, sections and actions from `data/search.json` |
| Accent decks | Dock → **Deck**, or press `A` | cyan (default), ember, violet, acid — persisted in `localStorage` |
| Motion switch | Dock toggle, or press `M` | Respects `prefers-reduced-motion` by default; canvas and scanlines stop when reduced |
| Shortcut help | Press `?` | Also listed in the dock popover |
| Scroll progress | Always on | Top HUD line |
| Copy fields | `COPY` buttons | Clone command and release manifest path |
| Live telemetry | Home and Project pages | Public GitHub signals, cached 15 minutes, never faked on failure |
| Evolution filters | Home timeline | Rendered from `data/evolution.json` with shipped / active / next filters |
| Offline support | Automatic | Service worker precaches the shell and serves `offline.html` as a fallback |

Keyboard shortcuts never fire while typing in a field, and every control is reachable without a
pointer (the dock is real buttons with labels, and the palette is an ARIA combobox / listbox).

## Data honesty

- Release data comes from the website's own `/download/manifest.json` route, backed by GitHub Releases.
- Repository signals come straight from the public GitHub API in the visitor's browser. When the API
  is unreachable or rate-limited, the deck reports `github unreachable` and reuses the last cached
  snapshot instead of showing invented numbers.
- Timeline milestones are read from `data/evolution.json` and labelled `shipped`, `active` or `next`.

## Local preview

Serve the repository with any static HTTP server. No framework or application backend is required.

```bash
cd site && python3 -m http.server 8000
```

`http://localhost:8000` counts as a secure context, so the service worker registers locally too.
`/download/manifest.json` is produced by `src/worker.js`; without it the download components fall
back to GitHub Releases.

## Deployment

The site is designed for Cloudflare Pages / Workers. It contains only static HTML, CSS, JavaScript
and data files, so it can be deployed without a build step. `wrangler.jsonc` runs `src/worker.js`
first for `/download/*` and serves everything else from `site/`.

## Checks

```bash
node tests/deck-contract.js         # command deck, PWA and dataset contracts
node tests/seo-contract.js          # HTML / SEO basics for every page
node tests/site-sync-contract.js    # VoidOne content alignment
node tests/release-api-contract.js  # release integration stability
```

The same checks run in CI (`.github/workflows/site.yml` and `deploy-cloudflare.yml`).

## Canonical project

- Source: https://github.com/VoidOne-App/VoidOne
- Releases: https://github.com/VoidOne-App/VoidOne/releases
- History: https://github.com/VoidOne-App/VoidOne/commits/main
