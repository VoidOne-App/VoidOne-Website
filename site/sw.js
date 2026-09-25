/* VoidOne service worker — offline shell, cached assets, honest network fallback. */
const VERSION = 'voidone-deck-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const DATA_CACHE = `${VERSION}-data`;
const MANIFEST_CACHE_TTL = 5 * 60 * 1000;

const SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './css/variables.css',
  './css/core/base.css',
  './css/core/layout.css',
  './css/components/nav.css',
  './css/components/hud.css',
  './css/pages/home.css',
  './css/main.css',
  './css/responsive.css',
  './css/rtl.css',
  './js/core/env.js',
  './js/core/site.js',
  './js/core/hud.js',
  './js/api/github.js',
  './js/components/downloads.js',
  './js/components/effects.js',
  './js/components/evolution.js',
  './js/components/palette.js',
  './js/components/telemetry.js',
  './js/pwa.js',
  './data/search.json',
  './data/evolution.json',
  './assets/icons/voidone-mark.svg',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

function isAsset(request) {
  return ['style', 'script', 'image', 'font', 'manifest'].includes(request.destination);
}

async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(SHELL.map(async (path) => {
    try {
      const response = await cache.match(path);
      if (!response) await cache.add(new Request(path, { cache: 'reload' }));
    } catch (_) {
      /* A missing optional asset must not break installation. */
    }
  }));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const shell = await caches.open(SHELL_CACHE);
  const cached = (await cache.match(request)) || (await shell.match(request));
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }

  const response = await network;
  if (response) return response;
  return new Response('Offline and not cached', { status: 503, statusText: 'Offline', headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match('./offline.html');
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

async function handleManifest(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    throw new Error(`manifest ${response && response.status}`);
  } catch (_) {
    if (cached) return cached;
    return new Response(JSON.stringify({ schema: 1, error: 'offline_manifest_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
}

async function handleGitHub(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const cachedAt = Number(cached.headers.get('sw-cached-at') || 0);
    if (Date.now() - cachedAt < MANIFEST_CACHE_TTL) return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      const headers = new Headers(copy.headers);
      headers.set('sw-cached-at', String(Date.now()));
      cache.put(request, new Response(await copy.blob(), { status: copy.status, headers }));
      return response;
    }
  } catch (_) {
    /* fall through to cache */
  }
  if (cached) return cached;
  return new Response('{}', { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)));
    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
      } catch (_) {
        /* navigation preload is optional */
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/download/manifest.json')) {
      event.respondWith(handleManifest(request));
      return;
    }
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigation(request));
      return;
    }
    if (isAsset(request) || url.pathname.startsWith('/data/')) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }
    event.respondWith(networkFirst(request, RUNTIME_CACHE).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      const offline = await cache.match('./offline.html');
      return offline || new Response('Offline', { status: 503 });
    }));
    return;
  }

  if (url.hostname === 'api.github.com') {
    event.respondWith(handleGitHub(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'voidone:skip-waiting') self.skipWaiting();
  if (event.data === 'voidone:clear-cache') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))));
  }
});
