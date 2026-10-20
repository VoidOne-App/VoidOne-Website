const repo='VoidOne-App/VoidOne';
const fallback='https://github.com/'+repo+'/releases';

async function getJSON(url){
  const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error(String(response.status));
  return response.json();
}
function put(selector,value){
  document.querySelectorAll(selector).forEach(node=>{node.textContent=value});
}
function href(selector,value){
  document.querySelectorAll(selector).forEach(node=>{node.href=value||fallback});
}
function date(value){
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(parsed);
}
function size(value){
  return typeof value==='string'
    ? value
    : (typeof value==='number' ? (value/1024/1024).toFixed(1)+' MB' : '—');
}
function applyRelease(x){
  const list=Array.isArray(x?.assets)?x.assets:[];
  const installer=x?.platforms?.windows?.installer
    || x?.assets?.installer
    || list.find(asset=>asset?.type==='installer')
    || list.find(asset=>/\.(?:msi|exe)$/i.test(asset?.filename||''))
    || null;
  const portable=x?.platforms?.windows?.portable
    || x?.assets?.portable
    || list.find(asset=>asset?.type==='portable')
    || list.find(asset=>/\.zip$/i.test(asset?.filename||''))
    || null;
  const releaseUrl=x?.notes_url||x?.html_url||fallback;

  put('[data-release-version]',x?.version||x?.tag_name||'LATEST RELEASE');
  put('[data-release-channel]',(x?.channel||'unknown').toUpperCase());
  put('[data-release-status]',x?.prerelease?'PRE-RELEASE':'PUBLISHED');
  put('[data-release-date]',date(x?.published_at));
  put('[data-installer-name]',installer?.filename||'Not published');
  put('[data-installer-size]',size(installer?.size_label||installer?.size));
  put('[data-portable-name]',portable?.filename||'Not published');
  put('[data-portable-size]',size(portable?.size_label||portable?.size));
  href('[data-release-url]',releaseUrl);
  href('[data-installer]',installer?.url||installer?.github_url||releaseUrl);
  href('[data-installer-github]',installer?.github_url||releaseUrl);
  href('[data-portable]',portable?.url||portable?.github_url||releaseUrl);
  href('[data-portable-github]',portable?.github_url||releaseUrl);
  put('[data-installer-hash]',installer?.sha256||'NOT PUBLISHED');
  put('[data-portable-hash]',portable?.sha256||'NOT PUBLISHED');
  document.querySelector('[data-release-panel]')?.removeAttribute('data-loading');
}
function showNoRelease(){
  put('[data-release-version]','NO PUBLIC RELEASE');
  put('[data-release-channel]','NOT PUBLISHED');
  put('[data-release-status]','NOT PUBLISHED');
  put('[data-release-date]','No published release');
  put('[data-installer-name]','Not published');
  put('[data-installer-size]','—');
  put('[data-portable-name]','Not published');
  put('[data-portable-size]','—');
  put('[data-installer-hash]','NOT PUBLISHED');
  put('[data-portable-hash]','NOT PUBLISHED');
  href('[data-release-url]',fallback);
  href('[data-installer]',fallback);
  href('[data-installer-github]',fallback);
  href('[data-portable]',fallback);
  href('[data-portable-github]',fallback);
  document.querySelector('[data-release-panel]')?.removeAttribute('data-loading');
}
function showUnavailable(){
  put('[data-release-version]','LATEST RELEASE');
  put('[data-release-channel]','UNKNOWN');
  put('[data-release-status]','UNAVAILABLE');
  put('[data-release-date]','GitHub Releases');
  put('[data-installer-name]','Release service unavailable');
  put('[data-installer-size]','—');
  put('[data-portable-name]','Release service unavailable');
  put('[data-portable-size]','—');
  put('[data-installer-hash]','NOT AVAILABLE');
  put('[data-portable-hash]','NOT AVAILABLE');
  href('[data-release-url]',fallback);
  href('[data-installer]',fallback);
  href('[data-installer-github]',fallback);
  href('[data-portable]',fallback);
  href('[data-portable-github]',fallback);
  document.querySelector('[data-release-panel]')?.removeAttribute('data-loading');
}
async function loadRelease(){
  try{
    const m=await getJSON('/download/manifest.json');
    if(!m?.release?.version)throw new Error('invalid_manifest');
    applyRelease({...m.release,platforms:m.platforms});
    return;
  }catch(_){}
  try{
    const m=await getJSON('/api/releases/latest');
    if(m?.latest?.version){
      applyRelease(m.latest);
      return;
    }
    if(m?.latest===null){
      showNoRelease();
      return;
    }
  }catch(_){}
  try{
    const m=await getJSON('/api/releases');
    const releases=Object.values(m.channels||{}).flat()
      .filter(release=>release&&release.version)
      .sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
    if(releases.length){
      applyRelease(releases[0]);
      return;
    }
    if(m.channels){
      showNoRelease();
      return;
    }
  }catch(_){}
  showUnavailable();
}
document.addEventListener('DOMContentLoaded',loadRelease);
