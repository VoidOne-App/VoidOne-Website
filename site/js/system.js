const statusEndpoint='/api/status';
const bySelector=(selector)=>document.querySelector(selector);
function setText(selector,value){const node=bySelector(selector);if(node)node.textContent=value;}
function signalUnavailable(label){return label+' unavailable';}
async function loadSystem(){
  try{
    const response=await fetch(statusEndpoint,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error('Status endpoint HTTP '+response.status);
    const data=await response.json();
    const repo=data.repository;
    const release=data.release;
    const ci=data.ci;
    const signals=data.signals||{};
    setText('[data-stars]',repo?.stars==null?'—':Number(repo.stars).toLocaleString());
    setText('[data-open-issues]',repo?.open_issues==null?'—':Number(repo.open_issues).toLocaleString());
    setText('[data-forks]',repo?.forks==null?'—':Number(repo.forks).toLocaleString());
    setText('[data-release]',signals.releases==='unavailable'?'UNAVAILABLE':(release?.version||'NONE'));
    setText('[data-ci]',signals.ci==='unavailable'?'UNAVAILABLE':(ci?.conclusion||ci?.status||'NO RUN').toUpperCase());
    setText('[data-ci-detail]',signals.ci==='unavailable'
      ?signalUnavailable('GitHub Actions')
      :(ci?ci.name+' · '+new Date(ci.updated_at).toLocaleString():'No eligible workflow run'));
    const fullyAvailable=signals.repository!=='unavailable'&&signals.releases!=='unavailable'&&signals.ci!=='unavailable';
    setText('[data-live-stamp]',(fullyAvailable?'LIVE · ':'SIGNAL DEGRADED · ')+new Date(data.generated_at).toLocaleTimeString());
    setText('[data-site-status]',data.status==='ok'?'ONLINE':'DEGRADED');
  }catch(_){
    setText('[data-stars]','—');
    setText('[data-open-issues]','—');
    setText('[data-forks]','—');
    setText('[data-release]','UNAVAILABLE');
    setText('[data-ci]','UNAVAILABLE');
    setText('[data-ci-detail]','Status API unavailable');
    setText('[data-live-stamp]','SIGNAL DEGRADED');
    setText('[data-site-status]','UNKNOWN');
  }
}
document.addEventListener('DOMContentLoaded',loadSystem);
setInterval(loadSystem,60000);
