const fs = require('fs');

const pages = [
  'site/index.html','site/downloads.html','site/developers.html','site/about.html','site/faq.html','site/404.html',
  'site/fa/index.html','site/fa/404.html','site/fa/downloads.html','site/fa/developers.html','site/fa/about.html','site/fa/faq.html'
];

const sources = pages.map((file) => [file, fs.readFileSync(file, 'utf8')]);
const source = Object.fromEntries(sources);

const required = [
  ['site/index.html', source['site/index.html'], 'docs/build.md'],
  ['site/developers.html', source['site/developers.html'], '.github/workflows/c.cpp.yml'],
  ['site/downloads.html', source['site/downloads.html'], 'Portable ZIP'],
  ['site/downloads.html', source['site/downloads.html'], 'downloads.js'],
  ['site/downloads.html', source['site/downloads.html'], 'Cloudflare R2'],
  ['site/fa/index.html', source['site/fa/index.html'], 'lang="fa" dir="rtl"'],
  ['site/fa/about.html', source['site/fa/about.html'], 'درباره'],
  ['site/fa/downloads.html', source['site/fa/downloads.html'], 'دانلود EXE'],
  ['site/fa/downloads.html', source['site/fa/downloads.html'], 'downloads.js'],
  ['site/fa/developers.html', source['site/fa/developers.html'], 'راهنمای ساخت'],
  ['site/fa/faq.html', source['site/fa/faq.html'], 'پرسش‌های متداول']
];

for (const [file, content, needle] of required) {
  if (!content.includes(needle)) throw new Error(`${file}: missing current VoidOne sync contract ${needle}`);
}

for (const [file, content] of sources) {
  if (!content.includes('voidone-mark.svg')) throw new Error(`${file}: missing shared VoidOne brand mark`);
}

if (source['site/downloads.html'].includes('MSI Package') || source['site/downloads.html'].includes('data-download="msi"')) {
  throw new Error('site/downloads.html: stale MSI release claim remains; current CI publishes EXE + Portable ZIP.');
}

if (source['site/index.html'].includes('blob/main/BUILD.md') || source['site/developers.html'].includes('blob/main/BUILD.md')) {
  throw new Error('Website contains stale BUILD.md links; current build guide is docs/build.md.');
}

if (source['site/downloads.html'].includes('github-api.js') || source['site/fa/downloads.html'].includes('github-api.js')) {
  throw new Error('Download pages must not depend on the GitHub Releases client.');
}

console.log('VoidOne site sync contract: OK');
