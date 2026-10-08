const statusEndpoint='/api/status';
async function loadSystem(){
  try{
    const response=await fetch(statusEndpoint,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error(response.status);
    const data=await response.json();
    const repo=data.repository;
    const release=data.release;
    const ci=data.ci;
    document.querySelector('[data-stars]').textContent=Number(repo?.stars||0).toLocaleString();
    document.querySelector('[data-open-issues]').textContent=Number(repo?.open_issues||0).toLocaleString();
    document.querySelector('[data-forks]').textContent=Number(repo?.forks||0).toLocaleString();
    document.querySelector('[data-release]').textContent=release?.version||'NONE';
    document.querySelector('[data-ci]').textContent=(ci?.conclusion||ci?.status||'UNKNOWN').toUpperCase();
    document.querySelector('[data-ci-detail]').textContent=ci?ci.name+' · '+new Date(ci.updated_at).toLocaleString():'No workflow data';
    document.querySelector('[data-live-stamp]').textContent='LIVE · '+new Date(data.generated_at).toLocaleTimeString();
  }catch(_){
    document.querySelector('[data-ci]').textContent='UNAVAILABLE';
    document.querySelector('[data-ci-detail]').textContent='Status API unavailable';
    document.querySelector('[data-live-stamp]').textContent='SIGNAL DEGRADED';
  }
}
document.addEventListener('DOMContentLoaded',loadSystem);
setInterval(loadSystem,60000);