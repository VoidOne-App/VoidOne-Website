const fs = require('fs');

const pages = [
  'site/index.html',
  'site/downloads.html',
  'site/developers.html',
  'site/about.html',
  'site/faq.html',
  'site/404.html'
];

const sources = pages.map((file) => [file, fs.readFileSync(file, 'utf8')]);

const index = sources.find(([file]) => file === 'site/index.html')[1];
const developers = sources.find(([file]) => file === 'site/developers.html')[1];
const downloads = sources.find(([file]) => file === 'site/downloads.html')[1];

const required = [
  ['site/index.html', index, 'docs/build.md'],
  ['site/developers.html', developers, 'docs/build.md'],
  ['site/developers.html', developers, '.github/workflows/c.cpp.yml'],
  ['site/downloads.html', downloads, 'Windows Installer'],
  ['site/downloads.html', downloads, 'Portable ZIP']
];

for (const [file, source, needle] of required) {
  if (!source.includes(needle)) throw new Error(`${file}: missing current VoidOne sync contract ${needle}`);
}

for (const [file, source] of sources) {
  if (!source.includes('assets/icons/voidone-mark.svg')) {
    throw new Error(`${file}: missing shared VoidOne brand mark`);
  }
}

if (downloads.includes('MSI Package') || downloads.includes('data-download="msi"')) {
  throw new Error('site/downloads.html: stale MSI release claim remains; current CI publishes EXE + Portable ZIP.');
}

if (index.includes('blob/main/BUILD.md') || developers.includes('blob/main/BUILD.md')) {
  throw new Error('Website contains stale BUILD.md links; current build guide is docs/build.md.');
}

console.log('VoidOne site sync contract: OK');
