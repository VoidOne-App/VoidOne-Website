# VoidOne Website

Official public website for **VoidOne — an open-source native PC gaming platform built around games, not a store.**

## Structure

```text
VoidOne-Website/
├── index.html
├── 404.html
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── css/
│   ├── variables.css
│   ├── main.css
│   └── responsive.css
├── js/
│   ├── main.js
│   ├── github-api.js
│   └── evolution.js
├── data/
│   └── evolution.json
├── _headers
└── README.md
```

## Principles

- Reflect the current VoidOne implementation instead of inventing capabilities.
- Keep implemented, experimental and planned work distinct.
- Stay static-first and dependency-light.
- Keep the site independent from the main application repository.
- Use the main VoidOne repository as the canonical source for code, releases and history.

## Local preview

Serve the repository with any static HTTP server. No framework or application backend is required.

## Deployment

The site is designed for Cloudflare Pages. The repository contains only static HTML, CSS, JavaScript and data files, so it can be deployed without a build step.

## Canonical project

- Source: https://github.com/VoidOne-App/VoidOne
- Releases: https://github.com/VoidOne-App/VoidOne/releases
- History: https://github.com/VoidOne-App/VoidOne/commits/main
