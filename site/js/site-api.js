const SITE_ENDPOINT='/api/site';
async function loadSiteData(){
  try{
    const r=await fetch(SITE_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!r.ok)throw new Error(r.status);
    const d=await r.json();
    document.querySelectorAll('[data-site-project]').forEach(n=>n.textContent=d.project?.name||'VoidOne');
    document.querySelectorAll('[data-site-status]').forEach(n=>n.textContent=(d.project?.status||'unknown').toUpperCase());
    document.querySelectorAll('[data-site-license]').forEach(n=>n.textContent=d.project?.license||'—');
    for(const key of ['core','ui','data','build','testing','platform']){
      document.querySelectorAll('[data-site-'+key+']').forEach(n=>n.textContent=d.architecture?.[key]||'—');
    }
    document.querySelectorAll('[data-site-discord]').forEach(n=>n.href=d.community?.discord||n.href);
    document.querySelectorAll('[data-site-repo]').forEach(n=>n.href=d.repository?.url||n.href);
    document.querySelectorAll('[data-site-docs]').forEach(n=>n.href=d.repository?.docs_url||n.href);
    document.querySelectorAll('[data-site-actions]').forEach(n=>n.href=d.repository?.actions_url||n.href);
  }catch(_){}
}
document.addEventListener('DOMContentLoaded',loadSiteData);