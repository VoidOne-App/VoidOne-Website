/* Shared site runtime: sticky navigation, mobile menu, language switch, reveal on scroll. */
(() => {
  const env = window.VoidOneEnv;
  const root = document.documentElement;
  const reduceMotion = env ? env.reducedMotion : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const nav = document.querySelector('.nav, .site-nav');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('#mobile-menu');
  const rtl = root.dir === 'rtl' || root.lang === 'fa';

  const STRINGS = {
    en: { open: 'Open navigation', close: 'Close navigation', language: 'Switch to Persian' },
    fa: { open: 'باز کردن ناوبری', close: 'بستن ناوبری', language: 'تغییر زبان به انگلیسی' }
  };
  const t = STRINGS[rtl ? 'fa' : 'en'] || STRINGS.en;

  const setMenuLabel = (open) => {
    if (!menuButton) return;
    menuButton.setAttribute('aria-label', open ? t.close : t.open);
  };

  const closeMenu = () => {
    if (!mobileMenu || !menuButton) return;
    mobileMenu.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    setMenuLabel(false);
  };

  if (nav) {
    const update = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  if (menuButton && mobileMenu) {
    setMenuLabel(false);
    menuButton.addEventListener('click', () => {
      const open = mobileMenu.hidden;
      mobileMenu.hidden = !open;
      menuButton.setAttribute('aria-expanded', String(open));
      setMenuLabel(open);
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

  /* Smooth in-page navigation that also closes the mobile menu. */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      if (!selector || selector === '#') return;
      const target = document.querySelector(selector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      closeMenu();
    });
  });

  /* Language switch is injected only when the page does not already provide one. */
  const navActions = document.querySelector('.nav-actions');
  if (navActions) {
    const hasSwitch = Boolean(navActions.querySelector('.language-link'))
      || Boolean(navActions.querySelector('[lang="fa"]'))
      || Boolean(navActions.querySelector('[lang="en"]'))
      || Boolean(navActions.querySelector('a[href$="fa/"], a[href$="fa"]'));
    if (!hasSwitch) {
      const inPersian = rtl || location.pathname.includes('/fa/');
      const currentPage = location.pathname.split('/').pop() || 'index.html';
      const languageLink = document.createElement('a');
      languageLink.className = 'button ghost language-link';
      languageLink.href = inPersian ? `../${currentPage}` : `fa/${currentPage}`;
      languageLink.lang = inPersian ? 'en' : 'fa';
      languageLink.dir = inPersian ? 'ltr' : 'rtl';
      languageLink.textContent = inPersian ? 'EN' : 'پارسی';
      languageLink.setAttribute('aria-label', t.language);
      navActions.prepend(languageLink);
    }
  }

  /* Reveal on scroll — skipped entirely when motion is reduced. */
  if (!reduceMotion) {
    root.classList.add('motion-ready');
    const items = document.querySelectorAll('.reveal, .timeline-item');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      items.forEach((item) => observer.observe(item));
    } else {
      items.forEach((item) => item.classList.add('is-visible'));
    }
  }
})();
