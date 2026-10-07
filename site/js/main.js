(()=>{
const $=(s,c=document)=>c.querySelector(s);const nav=$('[data-nav]');const menu=$('.menu-toggle');const mobile=$('#mobile-menu');
const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
if(!reduce)document.documentElement.classList.add('motion-ready');
window.addEventListener('scroll',()=>nav?.classList.toggle('scrolled',scrollY>10),{passive:true});
if(menu&&mobile){const close=()=>{mobile.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation')};menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');mobile.hidden=!open});mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));window.addEventListener('keydown',e=>{if(e.key==='Escape')close()})}
const reveal=[...document.querySelectorAll('.reveal')];if(reduce||!('IntersectionObserver' in window)){reveal.forEach(el=>el.classList.add('is-visible'))}else{const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08});reveal.forEach(el=>io.observe(el))}
})();
