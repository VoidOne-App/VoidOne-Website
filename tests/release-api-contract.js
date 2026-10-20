// Contract checks for the current browser-side release integration.
const fs = require('node:fs');
const source = fs.readFileSync('site/js/release.js', 'utf8');
const worker = fs.readFileSync('src/worker.js', 'utf8');
const home = fs.readFileSync('site/index.html', 'utf8');
const required = [
  "const repo='VoidOne-App/VoidOne';",
  "getJSON('/download/manifest.json')",
  "getJSON('/api/releases/latest')",
  "data-release-version",
  "data-release-status",
  "data-release-date",
  "data-release-url",
  "Number.isNaN(d.getTime())",
  "catch(_)",
  "GitHub Releases"
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error('Missing release stability contract: ' + needle);
}
for (const needle of ["releases?per_page=20", "browser_download_url", "asset?.github_url", "sanitizeDownloadPath(url.pathname)"]) {
  if (!worker.includes(needle)) throw new Error('Missing Worker release contract: ' + needle);
}
if (!home.includes('data-release-panel') || !home.includes('data-release-version')) {
  throw new Error('Homepage release panel contract is missing');
}
console.log('Release API stability contract: OK');
