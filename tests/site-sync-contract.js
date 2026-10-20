const fs = require('node:fs');
const pages = [
  'site/index.html','site/downloads.html','site/developers.html','site/about.html','site/faq.html','site/404.html',
  'site/fa/index.html','site/fa/404.html','site/fa/downloads.html','site/fa/developers.html','site/fa/about.html','site/fa/faq.html'
];
const source = Object.fromEntries(pages.map(file => [file, fs.readFileSync(file, 'utf8')]));
for (const [file, content] of Object.entries(source)) {
  if (!content.includes('voidone-mark.svg')) throw new Error(file + ': missing shared VoidOne brand mark');
}
const index = source['site/index.html'];
for (const needle of ['js/release.js','js/site-api.js','data-release-version','voidone-player-world.svg']) {
  if (!index.includes(needle)) throw new Error('site/index.html: missing current contract ' + needle);
}
const redirects = [
  ['site/downloads.html','downloads/'],
  ['site/developers.html','developers/'],
  ['site/fa/downloads.html','../#download'],
  ['site/fa/developers.html','../#developers']
];
for (const [file, target] of redirects) {
  if (!source[file].includes(target)) throw new Error(file + ': redirect target missing');
}
if (index.includes('blob/main/BUILD.md')) throw new Error('site/index.html: stale BUILD.md link remains');
for (const stale of ['downloads.js','js/core/site.js','js/api/github.js','js/github-api.js']) {
  if (index.includes(stale)) throw new Error('site/index.html: stale runtime reference remains: ' + stale);
}
const project = JSON.parse(fs.readFileSync('site/data/project.json', 'utf8'));
if (project.license !== 'VoidOne Community License v1.0') throw new Error('Project data license is stale');
if (!project.description.includes('source-available')) throw new Error('Project data description must say source-available');
console.log('VoidOne site sync contract: OK');
