const fs=require('fs');
const pages=[
 'site/index.html','site/downloads.html','site/developers.html','site/about.html','site/faq.html','site/404.html',
 'site/fa/index.html','site/fa/404.html','site/fa/downloads.html','site/fa/developers.html','site/fa/about.html','site/fa/faq.html'
];
const source=Object.fromEntries(pages.map(file=>[file,fs.readFileSync(file,'utf8')]));
for(const [file,content] of Object.entries(source)){
 if(!content.includes('voidone-mark.svg'))throw new Error(file+': missing shared VoidOne brand mark');
}
const index=source['site/index.html'];
for(const needle of ['docs/build.md','js/github-api.js','js/evolution.js','data-release-version','voidone-player-world.svg']){
 if(!index.includes(needle))throw new Error('site/index.html: missing current contract '+needle);
}
const redirects=[['site/downloads.html','downloads/'],['site/developers.html','developers/'],['site/fa/downloads.html','../#download'],['site/fa/developers.html','../#developers']];
for(const [file,target] of redirects){if(!source[file].includes(target))throw new Error(file+': redirect target missing');}
if(index.includes('blob/main/BUILD.md'))throw new Error('site/index.html: stale BUILD.md link remains');
if(index.includes('downloads.js')||index.includes('js/core/site.js')||index.includes('js/api/github.js'))throw new Error('site/index.html: stale runtime references remain');
console.log('VoidOne site sync contract: OK');
