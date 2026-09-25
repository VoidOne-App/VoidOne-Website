// Contract checks for the VoidOne command deck: PWA shell, runtime wiring and datasets.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const SITE = 'site';
const pages = [];
(function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(SITE, full).split(path.sep)[0] === 'v3') continue;
      walk(full);
    } else if (entry.name.endsWith('.html')) pages.push(full);
  }
})(SITE);

pages.sort();

/* ---------- runtime wiring on every page ---------- */
for (const file of pages) {
  const source = fs.readFileSync(file, 'utf8');
  const scripts = [...source.matchAll(/<script src="([^"]+\.js)"[^>]*><\/script>/g)].map((match) => match[1]);
  const unique = new Set(scripts);

  check(scripts.length === unique.size, `${file}: duplicate script references`);
  check(scripts.some((value) => value.endsWith('js/core/env.js')), `${file}: missing js/core/env.js`);
  check(scripts.some((value) => value.endsWith('js/core/site.js')), `${file}: missing js/core/site.js`);
  check(scripts.some((value) => value.endsWith('js/core/hud.js')), `${file}: missing js/core/hud.js`);
  check(scripts.some((value) => value.endsWith('js/components/palette.js')), `${file}: missing command palette`);
  check(source.includes('css/components/hud.css'), `${file}: missing HUD stylesheet`);
  check(source.includes('rel="manifest"'), `${file}: missing web app manifest link`);
  check(!source.includes('js/main.js'), `${file}: legacy js/main.js is superseded by js/core/site.js`);
  check(!/<script[^>]+src=["']http:/i.test(source), `${file}: insecure script reference`);

  const telemetryCells = [...source.matchAll(/data-telemetry-value="(\w+)"/g)].map((match) => match[1]);
  if (source.includes('data-telemetry')) {
    for (const field of ['stars', 'forks', 'issues', 'contributors']) {
      check(telemetryCells.includes(field), `${file}: telemetry deck is missing the ${field} cell`);
    }
  }
}

/* ---------- service worker ---------- */
const worker = path.join(SITE, 'sw.js');
check(fs.existsSync(worker), 'site/sw.js is missing');
if (fs.existsSync(worker)) {
  const source = fs.readFileSync(worker, 'utf8');
  check(/const VERSION\s*=/.test(source), 'site/sw.js: missing cache VERSION');
  check(source.includes('./offline.html'), 'site/sw.js: offline shell is not precached');
  check(source.includes("request.method !== 'GET'"), 'site/sw.js: non-GET requests must bypass the worker');
  check(source.includes('api.github.com'), 'site/sw.js: live GitHub traffic should be cached conservatively');
  check(source.includes('/download/manifest.json'), 'site/sw.js: download manifest needs an offline path');
  check(!/javascript\s*:/i.test(source), 'site/sw.js: dangerous URL scheme');
}

/* ---------- offline shell ---------- */
const offline = path.join(SITE, 'offline.html');
check(fs.existsSync(offline), 'site/offline.html is missing');
if (fs.existsSync(offline)) {
  const source = fs.readFileSync(offline, 'utf8');
  for (const needle of ['<html lang="en">', '<title>', 'name="description"', 'name="viewport"', '<main', '<h1']) {
    check(source.includes(needle), `site/offline.html: missing ${needle}`);
  }
}

/* ---------- web app manifest ---------- */
const manifestPath = path.join(SITE, 'manifest.webmanifest');
check(fs.existsSync(manifestPath), 'site/manifest.webmanifest is missing');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'theme_color', 'background_color']) {
    check(Boolean(manifest[key]), `manifest.webmanifest: missing ${key}`);
  }
  check(manifest.icons.length >= 2, 'manifest.webmanifest: at least two icons are required');
  check(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'manifest.webmanifest: missing a maskable icon');
  for (const icon of manifest.icons) {
    const file = path.join(SITE, icon.src.replace(/^\.\//, ''));
    check(fs.existsSync(file), `manifest.webmanifest: icon ${icon.src} does not exist`);
  }
  for (const shortcut of manifest.shortcuts || []) {
    const target = path.join(SITE, shortcut.url.replace(/^\.\//, ''), 'index.html');
    check(fs.existsSync(target), `manifest.webmanifest: shortcut target ${shortcut.url} does not exist`);
  }
}

/* ---------- datasets ---------- */
const search = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'search.json'), 'utf8'));
check(Array.isArray(search.entries) && search.entries.length > 0, 'data/search.json: entries must be a non-empty array');
check(Array.isArray(search.actions) && search.actions.length > 0, 'data/search.json: actions must be a non-empty array');
for (const entry of [...search.entries, ...search.actions]) {
  check(Boolean(entry.title), 'data/search.json: every item needs a title');
  check(entry.lang === 'en' || entry.lang === 'fa', `data/search.json: unsupported language on ${entry.title}`);
  if (entry.kind !== 'action') {
    check(Boolean(entry.url), `data/search.json: ${entry.title} needs a url`);
  } else {
    check(['copy', 'accent', 'motion', 'manifest', 'url'].includes(entry.action), `data/search.json: unknown action ${entry.action}`);
    if (entry.action === 'url') check(/^https:\/\//.test(entry.url || ''), `data/search.json: action ${entry.title} needs a secure url`);
  }
}
const languages = new Set([...search.entries, ...search.actions].map((entry) => entry.lang));
check(languages.has('en') && languages.has('fa'), 'data/search.json: both languages must be indexed');

const evolution = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'evolution.json'), 'utf8'));
for (const entry of evolution) {
  check(Boolean(entry.date && entry.title && entry.description), 'data/evolution.json: date, title and description are required');
  check(['shipped', 'active', 'next'].includes(entry.status), `data/evolution.json: unsupported status on ${entry.title}`);
}

/* ---------- accent decks ---------- */
const variables = fs.readFileSync(path.join(SITE, 'css', 'variables.css'), 'utf8');
check(variables.includes('--cyan:#00eaff'), 'css/variables.css: the cyan deck is the default accent');
for (const accent of ['ember', 'violet', 'acid']) {
  check(variables.includes(`[data-accent="${accent}"]`), `css/variables.css: missing the ${accent} accent deck`);
}
check(variables.includes('--accent-rgb'), 'css/variables.css: --accent-rgb is required for canvas and glow effects');

const hud = fs.readFileSync(path.join(SITE, 'css', 'components', 'hud.css'), 'utf8');
for (const selector of ['.hud-dock', '.palette', '.telemetry', '.fx-progress', '.toast-stack', '.timeline-filters', '.copy-field', '.fx-canvas']) {
  check(hud.includes(selector), `css/components/hud.css: missing ${selector}`);
}
check(hud.includes('prefers-reduced-motion'), 'css/components/hud.css: reduced-motion support is required');

/* ---------- syntax ---------- */
const scripts = [worker, ...pages.flatMap((file) => [...fs.readFileSync(file, 'utf8')
  .matchAll(/<script src="([^"]+\.js)"[^>]*><\/script>/g)]
  .map((match) => path.resolve(path.dirname(file), match[1])))]
  .filter((file, index, list) => list.indexOf(file) === index);

for (const file of scripts) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failures.push(`Syntax check failed: ${file}`);
  }
}

if (failures.length) {
  console.error(failures.map((message) => `::error::${message}`).join('\n'));
  process.exit(1);
}

console.log(`Command deck contract: OK (${pages.length} pages, ${scripts.length} scripts)`);
