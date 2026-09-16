(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.nav, .site-nav');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('#mobile-menu');

  if (nav) {
    const update = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  if (menuButton && mobileMenu) {
    const close = () => {
      mobileMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
    };
    menuButton.addEventListener('click', () => {
      const open = mobileMenu.hidden;
      mobileMenu.hidden = !open;
      menuButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('motion-ready');
    const items = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        });
      }, { threshold: 0.12 });
      items.forEach((item) => observer.observe(item));
    } else items.forEach((item) => item.classList.add('is-visible'));
  }
})();
