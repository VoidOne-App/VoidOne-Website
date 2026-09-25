/* Live project telemetry: public GitHub repository signals, cached and honest about failure. */
(() => {
  const env = window.VoidOneEnv;
  if (!env) return;

  const panel = document.querySelector('[data-telemetry]');
  if (!panel) return;

  const rtl = env.rtl;
  const COPY = {
    en: {
      live: 'live from github',
      cached: 'cached snapshot',
      offline: 'github unreachable',
      loading: 'connecting…',
      updated: 'updated',
      commit: 'last commit',
      never: 'no cached data yet'
    },
    fa: {
      live: 'زنده از گیت‌هاب',
      cached: 'نگه‌داری‌شده در مرورگر',
      offline: 'گیت‌هاب در دسترس نیست',
      loading: 'در حال اتصال…',
      updated: 'به‌روزرسانی',
      commit: 'آخرین کامیت',
      never: 'داده‌ای ذخیره نشده'
    }
  };

  const t = COPY[rtl ? 'fa' : 'en'] || COPY.en;
  const API = 'https://api.github.com/repos/VoidOne-App/VoidOne';
  const TTL = 15 * 60 * 1000;
  const KEY = 'voidone:telemetry';
  const FIELDS = ['stars', 'forks', 'issues', 'contributors'];

  const numberFormat = new Intl.NumberFormat(rtl ? 'fa-IR' : 'en-US');
  const relative = typeof Intl.RelativeTimeFormat === 'function'
    ? new Intl.RelativeTimeFormat(rtl ? 'fa-IR' : 'en-US', { numeric: 'auto' })
    : null;

  const source = panel.querySelector('[data-telemetry-source]');
  const updated = panel.querySelector('[data-telemetry-updated]');
  const commitLine = panel.querySelector('[data-telemetry-commit]');
  const cells = {};

  FIELDS.forEach((field) => {
    const node = panel.querySelector(`[data-telemetry-value="${field}"]`);
    if (node) cells[field] = node;
  });

  function relativeTime(value) {
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return '—';
    const seconds = Math.round((then - Date.now()) / 1000);
    if (!relative) return new Date(then).toLocaleString();
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
    }
    return relative.format(seconds, 'second');
  }

  function countTo(node, value) {
    if (!node) return;
    if (env.reducedMotion) {
      node.textContent = numberFormat.format(value);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = numberFormat.format(Math.round(value * eased));
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  function paint(payload, state, cachedAt) {
    panel.dataset.state = state;
    FIELDS.forEach((field) => {
      if (cells[field]) cells[field].classList.remove('skeleton');
    });
    FIELDS.forEach((field) => {
      const node = cells[field];
      if (!node) return;
      if (payload && typeof payload[field] === 'number') countTo(node, payload[field]);
      else node.textContent = '—';
    });
    if (source) source.textContent = state === 'live' ? t.live : state === 'cached' ? t.cached : t.offline;
    if (updated && cachedAt) updated.textContent = `${t.updated} ${relativeTime(cachedAt)}`;
    if (commitLine) {
      commitLine.textContent = payload && payload.commit
        ? `${t.commit} ${payload.commit.sha} · ${relativeTime(payload.commit.date)}`
        : `${t.commit} —`;
    }
  }

  function readCache() {
    try {
      const raw = env.store.get(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.at !== 'number') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      env.store.set(KEY, JSON.stringify({ at: Date.now(), payload }));
    } catch (_) {
      /* storage unavailable — the network snapshot still paints for this session */
    }
  }

  async function fetchJSON(path, timeout = 8000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), timeout) : 0;
    try {
      const response = await fetch(path, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller ? controller.signal : undefined,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`GitHub ${response.status}`);
      return { body: await response.json(), headers: response.headers };
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  function contributorCount(result) {
    const link = result.headers ? result.headers.get('link') : null;
    if (link) {
      const match = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
      if (match) return Number(match[1]);
    }
    return Array.isArray(result.body) ? result.body.length : null;
  }

  async function load() {
    const [repo, contributors, commits] = await Promise.all([
      fetchJSON(API),
      fetchJSON(`${API}/contributors?per_page=1&anon=1`),
      fetchJSON(`${API}/commits?per_page=1`)
    ]);

    const commit = Array.isArray(commits.body) && commits.body.length ? commits.body[0] : null;

    return {
      stars: repo.body.stargazers_count,
      forks: repo.body.forks_count,
      issues: repo.body.open_issues_count,
      contributors: contributorCount(contributors),
      pushed_at: repo.body.pushed_at,
      commit: commit ? { sha: String(commit.sha || '').slice(0, 7), date: commit.commit?.author?.date || commit.commit?.committer?.date } : null
    };
  }

  Object.values(cells).forEach((node) => node.classList.add('skeleton'));

  let started = false;

  function start() {
    if (started) return;
    started = true;
    const cached = readCache();
    if (cached) paint(cached.payload, 'cached', cached.at);

    if (navigator.onLine === false) {
      if (!cached) paint(null, 'offline', null);
      return;
    }

    if (cached && Date.now() - cached.at < TTL) return;

    load()
      .then((payload) => {
        writeCache(payload);
        paint(payload, 'live', Date.now());
      })
      .catch(() => {
        if (cached) paint(cached.payload, 'cached', cached.at);
        else paint(null, 'offline', null);
      });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        instance.disconnect();
        start();
      });
    }, { threshold: 0.15 });
    observer.observe(panel);
  } else {
    start();
  }

  window.addEventListener('online', () => {
    const cached = readCache();
    if (!cached || Date.now() - cached.at >= TTL) {
      started = false;
      start();
    }
  });
})();
