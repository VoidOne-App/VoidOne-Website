const fs = require('fs');

const pages = [
  'site/index.html',
  'site/downloads.html',
  'site/developers.html',
  'site/about.html',
  'site/faq.html'
];

for (const file of pages) {
  const source = fs.readFileSync(file, 'utf8');
  for (const needle of ['<html lang="en">', '<meta name="viewport"', '<meta name="description"', '<title>']) {
    if (!source.includes(needle)) throw new Error(`${file}: missing SEO contract ${needle}`);
  }
}

const index = fs.readFileSync('site/index.html', 'utf8');
for (const needle of ['og:title', 'og:description', 'og:type', 'theme-color']) {
  if (!index.includes(needle)) throw new Error(`index.html: missing metadata ${needle}`);
}

for (const file of ['site/robots.txt', 'site/sitemap.xml']) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

console.log('SEO contract: OK');
