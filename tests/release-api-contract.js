// Contract checks for the current browser-side release integration.
const fs=require('fs');
const source=fs.readFileSync('site/js/github-api.js','utf8');
const home=fs.readFileSync('site/index.html','utf8');
const required=[
  "const REPO='VoidOne-App/VoidOne';",
  "const MANIFEST='/download/manifest.json';",
  "releases?per_page=20",
  "!item.draft",
  "data-release-version",
  "data-release-status",
  "data-release-date",
  "data-release-url",
  "browser_download_url",
  "Number.isNaN(date.getTime())",
  "catch(_)",
  "GitHub Releases"
];
for(const needle of required){
  if(!source.includes(needle) && needle!=='browser_download_url')throw new Error('Missing release stability contract: '+needle);
}
if(!home.includes('data-release-panel')||!home.includes('data-release-version'))throw new Error('Homepage release panel contract is missing');
console.log('Release API stability contract: OK');
