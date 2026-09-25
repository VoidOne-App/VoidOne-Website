/* Shared runtime environment: paths, preferences, motion policy and events. */
(() => {
  const script = document.currentScript;
  const scriptURL = new URL(script && script.src ? script.src : 'js/core/env.js', document.baseURI);
  const root = new URL('../../', scriptURL);
  const rootElement = document.documentElement;

  const ACCENTS = ['cyan', 'ember', 'violet', 'acid'];
  const STORE = { accent: 'voidone:accent', motion: 'voidone:motion' };
  const fallbackStore = new Map();

  const store = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (_) {
        return fallbackStore.get(key) || null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (_) {
        fallbackStore.set(key, value);
      }
    }
  };

  const media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const listeners = new Map();

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
    (listeners.get(name) || []).forEach((handler) => handler(detail));
  }

  function on(name, handler) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(handler);
  }

  function setAccent(accent) {
    const next = ACCENTS.includes(accent) ? accent : 'cyan';
    rootElement.dataset.accent = next;
    store.set(STORE.accent, next);
    emit('voidone:accent', next);
    return next;
  }

  function motionPreference() {
    const stored = store.get(STORE.motion);
    if (stored === 'reduced') return true;
    if (stored === 'full') return false;
    return Boolean(media.matches);
  }

  let reduced = motionPreference();

  function setMotion(next) {
    reduced = Boolean(next);
    store.set(STORE.motion, reduced ? 'reduced' : 'full');
    rootElement.classList.toggle('motion-ready', !reduced);
    emit('voidone:motion', reduced);
    return reduced;
  }

  setAccent(store.get(STORE.accent) || 'cyan');
  rootElement.classList.toggle('motion-ready', !reduced);

  const applySystemMotion = () => {
    if (store.get(STORE.motion)) return;
    reduced = Boolean(media.matches);
    rootElement.classList.toggle('motion-ready', !reduced);
    emit('voidone:motion', reduced);
  };

  if (media.addEventListener) media.addEventListener('change', applySystemMotion);

  window.VoidOneEnv = {
    root: root.href,
    accents: ACCENTS.slice(),
    url(relative) {
      return new URL(String(relative).replace(/^\/+/, ''), root).href;
    },
    ready(callback) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
      else callback();
    },
    get accent() {
      return rootElement.dataset.accent || 'cyan';
    },
    set accent(value) {
      setAccent(value);
    },
    cycleAccent() {
      const index = ACCENTS.indexOf(rootElement.dataset.accent || 'cyan');
      return setAccent(ACCENTS[(index + 1) % ACCENTS.length]);
    },
    get reducedMotion() {
      return reduced;
    },
    set reducedMotion(value) {
      setMotion(value);
    },
    toggleMotion() {
      return setMotion(!reduced);
    },
    get rtl() {
      return rootElement.dir === 'rtl' || rootElement.lang === 'fa';
    },
    on,
    emit,
    store
  };
})();
