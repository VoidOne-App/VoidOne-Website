/* Progressive web app wiring: service worker registration and update notices. */
(() => {
  const env = window.VoidOneEnv;
  if (!env) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  const COPY = {
    en: { ready: 'Offline ready', updated: 'Update installed — reload to apply', reload: 'Reload' },
    fa: { ready: 'آماده آفلاین', updated: 'به‌روزرسانی نصب شد — برای اعمال بارگذاری دوباره', reload: 'بارگذاری دوباره' }
  };
  const t = COPY[env.rtl ? 'fa' : 'en'] || COPY.en;

  const notify = (message) => {
    if (!window.VoidOneHUD) return null;
    const node = window.VoidOneHUD.toast(message, 'PWA');
    return node;
  };

  navigator.serviceWorker.register(env.url('sw.js'), { scope: env.root })
    .then((registration) => {
      if (!registration) return;

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state !== 'installed' || !navigator.serviceWorker.controller) return;
          const node = notify(t.updated);
          if (node) {
            node.style.cursor = 'pointer';
            node.addEventListener('click', () => window.location.reload());
          }
        });
      });

      if (navigator.serviceWorker.controller) notify(t.ready);
    })
    .catch(() => {
      /* Registration is an enhancement; the site must keep working without it. */
    });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (env.store.get('voidone:sw-notified')) return;
    env.store.set('voidone:sw-notified', '1');
  });
})();
