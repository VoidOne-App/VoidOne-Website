// Site-wide consistency checks for the current multi-page site.
const fs = require('node:fs');
const path = require('node:path');

const siteRoot = path.resolve('site');
const requiredPages = [
  'index.html', '404.html',
  'downloads/index.html', 'downloads/releases/index.html',
  'downloads/releases/stable/index.html', 'downloads/releases/beta/index.html',
  'downloads/releases/nightly/index.html', 'downloads/verify/index.html',
  'player/index.html', 'player/library/index.html', 'player/diagnostics/index.html',
  'explore/index.html', 'system/index.html', 'system/architecture/index.html',
  'system/hardware/index.html', 'intelligence/index.html',
  'intelligence/translation/index.html',
  'lab/index.html', 'lab/ci/index.html', 'lab/testing/index.html',
  'developers/index.html', 'developers/build/index.html',
  'developers/contributing/index.html', 'project/index.html',
  'project/origin/index.html', 'project/evolution/index.html',
  'fa/index.html', 'fa/404.html'
];
const missing = requiredPages.filter((file) => !fs.existsSync(path.join(siteRoot, file)));
if (missing.length) throw new Error('Missing site pages: ' + missing.join(', '));

const read = (file) => fs.readFileSync(path.join(siteRoot, file), 'utf8');
const home = read('index.html');
const persianHome = read('fa/index.html');
const downloads = read('downloads/index.html');
const releaseList = read('downloads/releases/index.html');
const verification = read('downloads/verify/index.html');
const verifierScript = fs.readFileSync(path.resolve(siteRoot, 'js/verify.js'), 'utf8');
const english404 = read('404.html');
const persian404 = read('fa/404.html');
const navigationPages = [
  'downloads/index.html',
  'downloads/releases/index.html',
  'downloads/releases/stable/index.html',
  'downloads/releases/beta/index.html',
  'downloads/releases/nightly/index.html',
  'downloads/verify/index.html',
  'explore/index.html',
  'system/index.html',
  'intelligence/index.html',
  'lab/index.html',
  'developers/index.html',
  'project/index.html',
  'fa/index.html'
];
for (const file of navigationPages) {
  const content = read(file);
  if (!content.includes('class="skip" href="#main"')) throw new Error(file + ': missing keyboard skip link');
  if (!/<main\b[^>]*id="main"/i.test(content)) throw new Error(file + ': skip link target is missing');
  if (!/<link\s+rel="canonical"\s+href="https:\/\/voidone\.dpdns\.org\//i.test(content)) throw new Error(file + ': missing canonical URL');
}

const metadataPages = [
  ['player/library/index.html', 'https://voidone.dpdns.org/player/library/'],
  ['player/diagnostics/index.html', 'https://voidone.dpdns.org/player/diagnostics/'],
  ['system/architecture/index.html', 'https://voidone.dpdns.org/system/architecture/'],
  ['system/hardware/index.html', 'https://voidone.dpdns.org/system/hardware/'],
  ['intelligence/translation/index.html', 'https://voidone.dpdns.org/intelligence/translation/'],
  ['lab/ci/index.html', 'https://voidone.dpdns.org/lab/ci/'],
  ['lab/testing/index.html', 'https://voidone.dpdns.org/lab/testing/'],
  ['developers/build/index.html', 'https://voidone.dpdns.org/developers/build/'],
  ['developers/contributing/index.html', 'https://voidone.dpdns.org/developers/contributing/'],
  ['project/origin/index.html', 'https://voidone.dpdns.org/project/origin/'],
  ['project/evolution/index.html', 'https://voidone.dpdns.org/project/evolution/']
];
for (const [file, url] of metadataPages) {
  const content = read(file);
  if (content.includes('VoidOne section surface.')) throw new Error(file + ': generic placeholder description remains');
  if (!content.includes('<link rel="canonical" href="' + url + '">')) throw new Error(file + ': canonical URL mismatch');
}

const legacyRedirects = [
  ['v3/index.html', '/', 'https://voidone.dpdns.org/'],
  ['v3/developers.html', '/developers/', 'https://voidone.dpdns.org/developers/'],
  ['v3/downloads.html', '/downloads/', 'https://voidone.dpdns.org/downloads/'],
  ['v3/platform.html', '/player/', 'https://voidone.dpdns.org/player/'],
  ['v3/project.html', '/project/', 'https://voidone.dpdns.org/project/'],
  ['v3/fa/index.html', '/fa/', 'https://voidone.dpdns.org/fa/']
];
for (const [file, target, canonical] of legacyRedirects) {
  const content = read(file);
  if (!content.includes('content="0;url=' + target + '"')) throw new Error(file + ': redirect target mismatch');
  if (!content.includes('href="' + target + '"')) throw new Error(file + ': fallback link target mismatch');
  if (!content.includes('<link rel="canonical" href="' + canonical + '">')) throw new Error(file + ': canonical target mismatch');
}

const legacyPersianRedirects = [
  ['fa/about.html', '/fa/', 'https://voidone.dpdns.org/fa/'],
  ['fa/developers.html', '/developers/', 'https://voidone.dpdns.org/developers/'],
  ['fa/downloads.html', '/downloads/', 'https://voidone.dpdns.org/downloads/'],
  ['fa/faq.html', '/project/', 'https://voidone.dpdns.org/project/']
];
for (const [file, target, canonical] of legacyPersianRedirects) {
  const content = read(file);
  if (!content.includes('content="0;url=' + target + '"')) throw new Error(file + ': Persian legacy redirect target mismatch');
  if (!content.includes('href="' + target + '"')) throw new Error(file + ': Persian legacy fallback link mismatch');
  if (!content.includes('<link rel="canonical" href="' + canonical + '">')) throw new Error(file + ': Persian legacy canonical mismatch');
}

const project = JSON.parse(read('data/project.json'));
const features = JSON.parse(read('data/features.json'));
const evolution = JSON.parse(read('data/evolution.json'));

const checks = [
  [home.includes('js/release.js'), 'Homepage must load release.js'],
  [home.includes('js/site-api.js'), 'Homepage must load site-api.js'],
  [home.includes('data-release-panel') && home.includes('data-release-version'), 'Homepage release panel is missing'],
  [downloads.includes('data-installer') && downloads.includes('data-portable'), 'Download asset targets are missing'],
  [downloads.includes('/api/releases/latest'), 'Download page advertises the latest-release endpoint'],
  [releaseList.includes('../../js/releases.js'), 'Release list must load its API renderer'],
  [verification.includes('js/verify.js'), 'Download verification page must load verify.js'],
  [verification.includes('for="file"') && verification.includes('aria-live="polite"'), 'Download verification controls must be labelled and announced'],
  [!verifierScript.includes('innerHTML'), 'Download verifier must not render release data through innerHTML'],
  [english404.includes('href="/"') && english404.includes('href="/downloads/"'), 'English 404 links must remain valid at nested missing URLs'],
  [persian404.includes('href="/fa/"') && persian404.includes('href="/404.html"'), 'Persian 404 links must remain valid at nested missing URLs'],
  [persianHome.includes('<html lang="fa" dir="rtl">'), 'Persian homepage must declare language and RTL direction'],
  [project.license === 'VoidOne Community License v1.0', 'Project data license is stale'],
  [String(project.description || '').includes('source-available'), 'Project description must say source-available'],
  [Array.isArray(evolution), 'Evolution data must be an array'],
  [Array.isArray(features), 'Feature data must be an array']
];
const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(failures.join('\n'));

// Check local references in every HTML and CSS file, not just the home page.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const refPatterns = {
  '.html': /(?:href|src)\s*=\s*["']([^"'#?]+)["']/gi,
  '.css': /url\(\s*["']?([^"')?#]+)["']?\s*\)/gi
};
const broken = [];
for (const file of walk(siteRoot)) {
  const pattern = refPatterns[path.extname(file).toLowerCase()];
  if (!pattern) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(pattern)) {
    const ref = match[1].trim();
    if (!ref || ref.startsWith('/') || ref.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(ref)) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(ref));
    if (!resolved.startsWith(siteRoot + path.sep) && resolved !== siteRoot) continue;
    if (fs.existsSync(resolved)) continue;
    if (fs.existsSync(resolved + '.html') || fs.existsSync(path.join(resolved, 'index.html'))) continue;
    broken.push(path.relative(siteRoot, file) + ' -> ' + ref);
  }
}
if (broken.length) throw new Error('Broken local references:\n' + [...new Set(broken)].sort().join('\n'));

// Enforce metadata and keyboard-navigation invariants across every HTML page, including legacy aliases.
const htmlFiles = walk(siteRoot).filter((file) => path.extname(file).toLowerCase() === '.html');
const htmlFailures = [];
for (const file of htmlFiles) {
  const rel = path.relative(siteRoot, file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  const isErrorPage = rel === '404.html' || rel === 'fa/404.html';
  if (source.includes('VoidOne section surface.')) {
    htmlFailures.push(rel + ': placeholder metadata description remains');
  }
  if (!isErrorPage && (!source.includes('rel="canonical"') || !source.includes('https://voidone.dpdns.org/'))) {
    htmlFailures.push(rel + ': canonical URL is missing');
  }
  const isRedirect = source.includes('http-equiv="refresh"');
  if (!isErrorPage && !isRedirect && source.includes('<main')) {
    if (!source.includes('class="skip" href="#main"')) {
      htmlFailures.push(rel + ': keyboard skip link is missing');
    }
    const mainStart = source.indexOf('<main');
    const mainEnd = source.indexOf('>', mainStart);
    const mainTag = mainStart >= 0 && mainEnd > mainStart ? source.slice(mainStart, mainEnd + 1) : '';
    if (!mainTag.includes('id="main"')) {
      htmlFailures.push(rel + ': keyboard skip target is missing');
    }
  }
}
if (htmlFailures.length) throw new Error('Whole-site HTML contract failed: ' + htmlFailures.join('; '));

console.log('Site sync contract: OK (' + requiredPages.length + ' required pages, data and local references checked)');
