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
  'intelligence/ai/index.html', 'intelligence/translation/index.html',
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
  [persianHome.includes('<html lang="fa" dir="rtl">'), 'Persian homepage must declare language and RTL direction'],
  [project.license === 'VoidOne Community License v1.0', 'Project data license is stale'],
  [String(project.description || '').includes('source-available'), 'Project description must say source-available'],
  [Array.isArray(evolution), 'Evolution data must be an array'],
  [features && typeof features === 'object' && !Array.isArray(features), 'Feature data must be an object']
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

console.log('Site sync contract: OK (' + requiredPages.length + ' required pages, data and local references checked)');
