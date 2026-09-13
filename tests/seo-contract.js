const fs = require('fs');
const path = require('path');

const pages = fs.readdirSync('site', { recursive: true }).filter((file) => file.endsWith('.html')).map((file) => path.join('site', file));

for (const file of pages) {
  const source = fs.readFileSync(file, 'utf8');
  const isPersian = file.includes(`${path.sep}fa${path.sep}`);
  const langContract = isPersian ? '<html lang="fa" dir="rtl">' : '<html lang="en">';
  for (const needle of [langContract, '<meta name="viewport"', '<meta name="description"', '<title>']) {
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

console.log(`SEO contract: OK (${pages.length} HTML pages)`);
