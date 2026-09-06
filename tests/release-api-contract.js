// Lightweight contract checks for the browser-side release integration.
const fs = require('fs');
const source = fs.readFileSync('site/js/github-api.js', 'utf8');

const required = [
  "const VOIDONE_REPO = 'VoidOne-App/VoidOne';",
  "releases?per_page=20",
  "!release.draft",
  "browser_download_url",
  "Number.isNaN(date.getTime())",
  "finally",
  "data-download",
  "FALLBACK_RELEASES"
];

for (const needle of required) {
  if (!source.includes(needle)) {
    throw new Error(`Missing release stability contract: ${needle}`);
  }
}

console.log('Release API stability contract: OK');
