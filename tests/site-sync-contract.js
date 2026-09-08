const fs = require('fs');

const index = fs.readFileSync('site/index.html', 'utf8');
const developers = fs.readFileSync('site/developers.html', 'utf8');
const downloads = fs.readFileSync('site/downloads.html', 'utf8');

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

if (downloads.includes('MSI Package') || downloads.includes('data-download="msi"')) {
  throw new Error('site/downloads.html: stale MSI release claim remains; current CI publishes EXE + Portable ZIP.');
}

if (index.includes('blob/main/BUILD.md') || developers.includes('blob/main/BUILD.md')) {
  throw new Error('Website contains stale BUILD.md links; current build guide is docs/build.md.');
}

console.log('VoidOne site sync contract: OK');
