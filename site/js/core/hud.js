/* Command deck: scroll progress, screen FX, preference dock, toasts and shortcuts. */
(() => {
  const env = window.VoidOneEnv;
  if (!env) return;

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7"/><circle cx="18" cy="16" r="3"/></svg>',
    motion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2.5-6 3 12 2.5-6h4"/></svg>',
    install: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  const STRINGS = {
    en: {
      search: 'Search',
      searchHint: 'Search pages, sections and actions',
      theme: 'Deck',
      accent: 'Accent',
      motion: 'Motion',
      motionOff: 'Motion off',
      motionOn: 'Motion on',
      install: 'Install',
      shortcuts: 'Shortcuts',
      online: 'Online',
      offline: 'Offline',
      openPalette: 'Open command palette',
      cycleAccent: 'Cycle accent colour',
      toggleMotion: 'Toggle motion',
      installApp: 'Install VoidOne as an app',
      accentSet: 'Accent',
      clipboard: 'Clipboard',
      copied: 'Copied',
      copyFailed: 'Copy failed'
    },
    fa: {
      search: 'جستجو',
      searchHint: 'جستجو در صفحه‌ها، بخش‌ها و دستورها',
      theme: 'تم',
      accent: 'رنگ',
      motion: 'انیمیشن',
      motionOff: 'انیمیشن خاموش',
      motionOn: 'انیمیشن روشن',
      install: 'نصب',
      shortcuts: 'کلیدها',
      online: 'آنلاین',
      offline: 'آفلاین',
      openPalette: 'باز کردن جستجوی فرمان',
      cycleAccent: 'تغییر رنگ',
      toggleMotion: 'تغییر انیمیشن',
      installApp: 'نصب VoidOne به‌صورت اپلیکیشن',
      accentSet: 'رنگ',
      clipboard: 'کلیپ‌بورد',
      copied: 'کپی شد',
      copyFailed: 'کپی ناموفق'
    }
  };

  const t = STRINGS[env.rtl ? 'fa' : 'en'] || STRINGS.en;
  const reduced = env.reducedMotion;

  /* ---------- ambient layers ---------- */
  if (!reduced) {
    const scanlines = document.createElement('div');
    scanlines.className = 'fx-scanlines';
    scanlines.setAttribute('aria-hidden', 'true');
    const vignette = document.createElement('div');
    vignette.className = 'fx-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    document.body.append(scanlines, vignette);
  }

  const progress = document.createElement('div');
  progress.className = 'fx-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<i></i>';
  document.body.append(progress);

  const bar = progress.firstElementChild;
  let progressQueued = false;

  const paintProgress = () => {
    progressQueued = false;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
    bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
  };

  window.addEventListener('scroll', () => {
    if (progressQueued) return;
    progressQueued = true;
    window.requestAnimationFrame(paintProgress);
  }, { passive: true });
  window.addEventListener('resize', paintProgress, { passive: true });
  paintProgress();

  /* ---------- toasts ---------- */
  const toastStack = document.createElement('div');
  toastStack.className = 'toast-stack';
  toastStack.setAttribute('role', 'status');
  toastStack.setAttribute('aria-live', 'polite');
  document.body.append(toastStack);

  function toast(message, label = 'VOIDONE') {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<b>${label}</b> ${message}`;
    toastStack.append(node);
    window.requestAnimationFrame(() => node.classList.add('is-in'));
    window.setTimeout(() => {
      node.classList.remove('is-in');
      window.setTimeout(() => node.remove(), 320);
    }, 2600);
    return node;
  }

  /* ---------- dock ---------- */
  const dock = document.createElement('div');
  dock.className = 'hud-dock';
  dock.setAttribute('role', 'toolbar');
  dock.setAttribute('aria-label', env.rtl ? 'دک فرمان ویدوان' : 'VoidOne command deck');
  dock.setAttribute('aria-orientation', 'vertical');

  const statusRow = document.createElement('div');
  statusRow.className = 'hud-row';
  const status = document.createElement('div');
  status.className = 'hud-status';
  status.dataset.state = navigator.onLine === false ? 'offline' : 'online';
  status.innerHTML = `<i aria-hidden="true"></i><span class="hud-status-label">${navigator.onLine === false ? t.offline : t.online}</span><time>00:00:00</time>`;
  statusRow.append(status);

  const themeWrap = document.createElement('div');
  themeWrap.className = 'hud-row';
  themeWrap.style.position = 'relative';

  const themeButton = document.createElement('button');
  themeButton.type = 'button';
  themeButton.className = 'hud-btn';
  themeButton.setAttribute('aria-expanded', 'false');
  themeButton.setAttribute('aria-label', t.cycleAccent);
  themeButton.innerHTML = `${ICONS.palette}<span class="hud-label">${t.theme}</span>`;

  const popover = document.createElement('div');
  popover.className = 'hud-popover';
  popover.hidden = true;
  popover.innerHTML = `
    <p>${t.accent}</p>
    <div class="hud-swatches" role="group" aria-label="${t.accent}">
      ${env.accents.map((accent) => `<button type="button" class="hud-swatch" data-accent-option="${accent}" aria-pressed="false" title="${accent}"><span>${accent}</span></button>`).join('')}
    </div>
    <p>${t.shortcuts}</p>
    <div class="hud-hint">
      <div><span>${t.search}</span><span><kbd>Ctrl</kbd><kbd>K</kbd></span></div>
      <div><span>${t.accent}</span><span><kbd>A</kbd></span></div>
      <div><span>${t.motion}</span><span><kbd>M</kbd></span></div>
    </div>`;
  themeWrap.append(themeButton, popover);

  const actionRow = document.createElement('div');
  actionRow.className = 'hud-row';

  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.className = 'hud-btn';
  searchButton.setAttribute('aria-label', t.openPalette);
  searchButton.innerHTML = `${ICONS.search}<span class="hud-label">${t.search}</span>`;

  const motionButton = document.createElement('button');
  motionButton.type = 'button';
  motionButton.className = 'hud-btn is-square';
  motionButton.setAttribute('aria-pressed', String(!reduced));
  motionButton.setAttribute('aria-label', reduced ? t.motionOff : t.motionOn);
  motionButton.title = t.toggleMotion;
  motionButton.innerHTML = ICONS.motion;

  const installButton = document.createElement('button');
  installButton.type = 'button';
  installButton.className = 'hud-btn is-square';
  installButton.hidden = true;
  installButton.setAttribute('aria-label', t.installApp);
  installButton.title = t.installApp;
  installButton.innerHTML = ICONS.install;

  actionRow.append(searchButton, motionButton, installButton);
  dock.append(themeWrap, actionRow, statusRow);
  document.body.append(dock);

  /* ---------- accent swatches ---------- */
  const swatchColors = { cyan: '#00eaff', ember: '#ff9d2f', violet: '#b28cff', acid: '#7dff5c' };
  popover.querySelectorAll('[data-accent-option]').forEach((button) => {
    const accent = button.dataset.accentOption;
    button.style.background = swatchColors[accent];
    button.style.color = swatchColors[accent];
    button.setAttribute('aria-label', accent);
    button.addEventListener('click', () => {
      env.accent = accent;
      syncAccent();
    });
  });

  function syncAccent() {
    const current = env.accent;
    popover.querySelectorAll('[data-accent-option]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.accentOption === current));
    });
  }
  syncAccent();

  const setPopover = (open) => {
    popover.hidden = !open;
    themeButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = popover.querySelector(`[data-accent-option="${env.accent}"]`) || popover.querySelector('[data-accent-option]');
      if (first) first.focus();
    }
  };

  themeButton.addEventListener('click', () => setPopover(popover.hidden));
  document.addEventListener('click', (event) => {
    if (!popover.hidden && !themeWrap.contains(event.target)) setPopover(false);
  });

  /* ---------- motion ---------- */
  function syncMotion() {
    const isReduced = env.reducedMotion;
    motionButton.setAttribute('aria-pressed', String(!isReduced));
    motionButton.setAttribute('aria-label', isReduced ? t.motionOff : t.motionOn);
  }

  motionButton.addEventListener('click', () => {
    const isReduced = env.toggleMotion();
    toast(isReduced ? t.motionOff : t.motionOn, t.motion);
    syncMotion();
  });

  env.on('voidone:motion', syncMotion);
  env.on('voidone:accent', syncAccent);

  /* ---------- clock and connectivity ---------- */
  const clock = status.querySelector('time');
  const statusLabel = status.querySelector('.hud-status-label');

  const paintClock = () => {
    const now = new Date();
    clock.textContent = [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
      .map((value) => String(value).padStart(2, '0')).join(':');
    clock.dateTime = now.toISOString();
  };
  paintClock();
  window.setInterval(paintClock, 1000);

  const paintConnectivity = () => {
    const online = navigator.onLine !== false;
    status.dataset.state = online ? 'online' : 'offline';
    statusLabel.textContent = online ? t.online : t.offline;
    document.documentElement.dataset.network = online ? 'online' : 'offline';
  };
  paintConnectivity();
  window.addEventListener('online', () => {
    paintConnectivity();
    toast(t.online, 'SYSTEM');
  });
  window.addEventListener('offline', () => {
    paintConnectivity();
    toast(t.offline, 'SYSTEM');
  });

  /* ---------- install prompt ---------- */
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installEvent) return;
    installButton.disabled = true;
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    installEvent = null;
    installButton.disabled = false;
    if (choice && choice.outcome === 'accepted') installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    installEvent = null;
  });

  /* ---------- copy fields ---------- */
  async function copyValue(value) {
    if (!value) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', 'readonly');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    const original = button.textContent;
    button.addEventListener('click', async () => {
      const value = button.dataset.copy || (button.previousElementSibling && button.previousElementSibling.textContent.trim()) || '';
      const ok = await copyValue(value);
      toast(ok ? t.copied : t.copyFailed, t.clipboard);
      if (!ok) return;
      button.textContent = t.copied;
      button.setAttribute('aria-live', 'polite');
      window.setTimeout(() => {
        button.textContent = original;
      }, 1800);
    });
  });

  /* ---------- shortcuts ---------- */
  const openPalette = () => document.dispatchEvent(new CustomEvent('voidone:palette:open'));
  searchButton.addEventListener('click', openPalette);

  const isTyping = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  };

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'k') {
      event.preventDefault();
      openPalette();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (key === 'a') {
      const accent = env.cycleAccent();
      toast(accent.toUpperCase(), t.accentSet);
    } else if (key === 'm') {
      const isReduced = env.toggleMotion();
      toast(isReduced ? t.motionOff : t.motionOn, t.motion);
    } else if (key === '?') {
      setPopover(popover.hidden);
    } else if (event.key === 'Escape' && !popover.hidden) {
      setPopover(false);
      themeButton.focus();
    }
  });

  window.VoidOneHUD = { toast, openPalette, copy: copyValue, strings: t, icons: ICONS };
})();
