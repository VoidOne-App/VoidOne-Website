// Static regression checks for the browser-side release integration.
const fs = require('node:fs');
const source = fs.readFileSync('site/js/release.js', 'utf8');
const worker = fs.readFileSync('src/worker.js', 'utf8');
const home = fs.readFileSync('site/index.html', 'utf8');
const downloads = fs.readFileSync('site/downloads/index.html', 'utf8');

const requiredSource = [
  "const repo='VoidOne-App/VoidOne';",
  "getJSON('/download/manifest.json')",
  "getJSON('/api/releases/latest')",
  "getJSON('/api/releases')",
  "Array.isArray(x?.assets)",
  "if(!m?.release?.version)",
  "applyRelease({...m.release,platforms:m.platforms})",
  "Number.isNaN(parsed.getTime())",
  "showNoRelease()",
  "showUnavailable()",
  "data-release-version",
  "data-release-status",
  "data-release-date",
  "data-release-url",
  "GitHub Releases"
];
for (const needle of requiredSource) {
  if (!source.includes(needle)) throw new Error('Missing browser release contract: ' + needle);
}

const requiredWorker = [
  "releases?per_page=20",
  "browser_download_url",
  "sanitizeDownloadPath(url.pathname)",
  "const installer = release.assets.find((asset) => asset.type === 'installer')",
  "const portable = release.assets.find((asset) => asset.type === 'portable')",
  "manifest-v3",
  "download_manifest_unavailable",
  "status_unavailable",
  "RELEASES_LATEST_PATH"
];
for (const needle of requiredWorker) {
  if (!worker.includes(needle)) throw new Error('Missing Worker release contract: ' + needle);
}
if (worker.includes('const normalized = normalizeRelease(release)')) {
  throw new Error('Manifest must not normalize an already-normalized release again.');
}
if (!home.includes('data-release-panel') || !home.includes('data-release-version')) {
  throw new Error('Homepage release panel contract is missing');
}
if (!downloads.includes('/api/releases/latest') || !downloads.includes('data-installer') || !downloads.includes('data-portable')) {
  throw new Error('Downloads page advertises a missing API endpoint or release target');
}
console.log('Release API contract: OK (manifest, array-shaped assets, fallback, cache version, safe errors)');
