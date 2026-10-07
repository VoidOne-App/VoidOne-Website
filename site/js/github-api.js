const REPO='VoidOne-App/VoidOne';
const API='https://api.github.com/repos/'+REPO;
const MANIFEST='/download/manifest.json';

function setText(selector,value){document.querySelectorAll(selector).forEach(node=>{node.textContent=value;});}
function setHref(selector,value){document.querySelectorAll(selector).forEach(node=>{if(value)node.href=value;});}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'Release date unavailable':new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(date);}
function applyRelease(release){
  const version=release?.version||release?.tag_name||'LATEST RELEASE';
  const published=release?.published_at||release?.publishedAt;
  const prerelease=Boolean(release?.prerelease);
  setText('[data-release-version]',version);
  setText('[data-release-status]',prerelease?'PRE-RELEASE':'PUBLISHED');
  setText('[data-release-date]',published?formatDate(published):'GitHub Releases');
  setHref('[data-release-url]',release?.notes_url||release?.html_url||'https://github.com/'+REPO+'/releases');
}
async function fetchJSON(url){const response=await fetch(url,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}
async function release(){
  const panel=document.querySelector('[data-release-panel]');
  try{
    let manifest;
    try{manifest=await fetchJSON(MANIFEST);if(manifest?.release)applyRelease(manifest.release);}catch(_){
      const releases=await fetchJSON(API+'/releases?per_page=20');
      const latest=releases.find(item=>!item.draft);
      if(!latest)throw new Error('No published release');
      applyRelease(latest);
    }
    panel?.removeAttribute('data-loading');
  }catch(_){
    setText('[data-release-version]','LATEST RELEASE');
    setText('[data-release-status]','UNAVAILABLE');
    setText('[data-release-date]','GitHub Releases');
    setHref('[data-release-url]','https://github.com/'+REPO+'/releases');
    panel?.removeAttribute('data-loading');
  }
}
document.addEventListener('DOMContentLoaded',release);
