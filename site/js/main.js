(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.querySelector('.nav');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('#mobile-menu');

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      const target = selector && document.querySelector(selector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (mobileMenu && menuButton) {
        mobileMenu.hidden = true;
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });
  });

  if (nav) {
    const updateNav = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
  }

  if (menuButton && mobileMenu) {
    const closeMenu = () => {
      mobileMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', document.documentElement.dir === 'rtl' ? 'باز کردن ناوبری' : 'Open navigation');
    };
    menuButton.addEventListener('click', () => {
      const open = mobileMenu.hidden;
      mobileMenu.hidden = !open;
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? (document.documentElement.dir === 'rtl' ? 'بستن ناوبری' : 'Close navigation') : (document.documentElement.dir === 'rtl' ? 'باز کردن ناوبری' : 'Open navigation'));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!mobileMenu.hidden && nav && !nav.contains(event.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  const isPersian = document.documentElement.dir === 'rtl' || location.pathname.includes('/fa/');
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  const languageTarget = isPersian ? `../${currentPage}` : `fa/${currentPage}`;
  const languageLink = document.createElement('a');
  languageLink.className = 'button ghost language-link';
  languageLink.href = languageTarget;
  languageLink.lang = isPersian ? 'en' : 'fa';
  languageLink.dir = isPersian ? 'ltr' : 'rtl';
  languageLink.textContent = isPersian ? 'EN' : 'پارسی';
  languageLink.setAttribute('aria-label', isPersian ? 'Switch to English' : 'تغییر زبان به پارسی');
  const navActions = document.querySelector('.nav-actions');
  if (navActions && !navActions.querySelector('.language-link') && !(isPersian && navActions.querySelector('[lang="en"]'))) navActions.prepend(languageLink);

  if (!reduceMotion) {
    document.documentElement.classList.add('motion-ready');
    const revealItems = document.querySelectorAll('.reveal, .timeline-item');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    }
  }
})();
