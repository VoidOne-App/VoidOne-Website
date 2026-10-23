const DOWNLOAD_PREFIX = '/download/';
const MANIFEST_PATH = '/download/manifest.json';
const STATUS_PATH = '/api/status';
const HEALTH_PATH = '/api/health';
const STATUS_CACHE_TTL = 60;
const GITHUB_REPO = 'VoidOne-App/VoidOne';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`;
const MANIFEST_CACHE_TTL = 300;
const RELEASES_CACHE_TTL = 120;
const RELEASES_PATH = '/api/releases';
const RELEASES_LATEST_PATH = `${RELEASES_PATH}/latest`;
const DOWNLOADS_PATH = '/api/downloads';
const SITE_PATH = '/api/site';


function sanitizeDownloadPath(pathname) {
  if (!pathname.startsWith(DOWNLOAD_PREFIX)) return null;
  const relative = pathname.slice(DOWNLOAD_PREFIX.length);
  const parts = relative.split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) return null;

  try {
    const tag = decodeURIComponent(parts[0]);
    const filename = decodeURIComponent(parts[1]);
    const hasUnsafePathChar = (value) =>
      value.includes('/') ||
      value.includes(String.fromCharCode(92)) ||
      /[\x00-\x1f\x7f]/.test(value);
    if (
      !tag || !filename ||
      tag === '.' || tag === '..' ||
      hasUnsafePathChar(tag) || hasUnsafePathChar(filename) ||
      tag.includes('..') || filename === '.' || filename === '..' || filename.includes('..')
    ) return null;
    return { tag, filename };
  } catch (_) {
    return null;
  }
}

function jsonResponse(payload, cacheControl = 'public, max-age=300', status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'cache-control': cacheControl,
      ...extraHeaders
    }
  });
}

function buildSiteData() {
  return {
    schema: 1,
    generated_at: new Date().toISOString(),
    project: {
      name: 'VoidOne',
      tagline: 'Your Games. Your Hardware. Your Rules.',
      description: 'A free, source-available native PC gaming platform built from the player side.',
      philosophy: ['player-first','local-first','no ads','evidence-first'],
      license: 'VoidOne Community License v1.0',
      status: 'active experimental development'
    },
    repository: {
      full_name: GITHUB_REPO,
      url: 'https://github.com/VoidOne-App/VoidOne',
      docs_url: 'https://github.com/VoidOne-App/VoidOne/tree/main/docs',
      actions_url: 'https://github.com/VoidOne-App/VoidOne/actions',
      security_url: 'https://github.com/VoidOne-App/VoidOne/security'
    },
    architecture: {
      core: 'C++23',
      ui: 'Qt / QML',
      data: 'SQLite',
      build: 'CMake / Ninja',
      testing: 'CTest + CI',
      platform: 'Windows primary / Linux CI / macOS secondary'
    },
    community: {
      discord: 'https://discord.gg/KPWfGvf9VW'
    },
    endpoints: {
      status: STATUS_PATH,
      releases: RELEASES_PATH,
      manifest: MANIFEST_PATH,
      health: HEALTH_PATH
    }
  };
}

function handleSite(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const response = jsonResponse(buildSiteData(), 'public, max-age=300, s-maxage=300');
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}

async function fetchLatestRelease() {
  const response = await fetch(GITHUB_RELEASES_URL, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'VoidOne-Website-Download-Service'
    }
  });

  if (!response.ok) throw new Error(`GitHub releases: ${response.status}`);

  const releases = await response.json();
  return releases.find((release) => !release.draft) || null;
}

function assetType(asset) {
  const name = asset.name.toLowerCase();
  if (name.endsWith('.msi') || name.endsWith('.exe')) return 'installer';
  if (name.endsWith('.zip')) return 'portable';
  return 'other';
}

function assetDigest(asset) {
  const digest = typeof asset.digest === 'string' ? asset.digest : '';
  return digest.startsWith('sha256:') ? digest.slice(7) : null;
}

function toAsset(asset, url) {
  return {
    filename: asset.name,
    type: assetType(asset),
    size: asset.size,
    size_label: `${(asset.size / 1024 / 1024).toFixed(1)} MB`,
    sha256: assetDigest(asset),
    url,
    github_url: asset.browser_download_url
  };
}

function releaseChannel(release) {
  const tag = String(release.tag_name || '').toLowerCase();
  if (tag.includes('nightly') || tag.includes('snapshot')) return 'nightly';
  if (release.prerelease || tag.includes('beta') || tag.includes('alpha') || tag.includes('rc')) return 'beta';
  return 'stable';
}

function normalizeRelease(release) {
  const channel = releaseChannel(release);
  return {
    version: release.tag_name,
    name: release.name || release.tag_name,
    channel,
    prerelease: Boolean(release.prerelease),
    published_at: release.published_at,
    created_at: release.created_at,
    notes_url: release.html_url,
    body: release.body || '',
    assets: release.assets
      .filter((asset) => asset.state === 'uploaded')
      .map((asset) => toAsset(asset, `${DOWNLOAD_PREFIX}${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset.name)}`))
  };
}

async function fetchReleases() {
  const response = await fetch(GITHUB_RELEASES_URL, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'VoidOne-Website-Release-Service'
    }
  });
  if (!response.ok) throw new Error(`GitHub releases: ${response.status}`);
  const releases = await response.json();
  return releases
    .filter((release) => !release.draft && release.published_at)
    .map(normalizeRelease)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
}

async function buildReleaseIndex() {
  const releases = await fetchReleases();
  return {
    schema: 2,
    generated_at: new Date().toISOString(),
    provider: 'github-releases',
    channels: {
      stable: releases.filter((release) => release.channel === 'stable'),
      beta: releases.filter((release) => release.channel === 'beta'),
      nightly: releases.filter((release) => release.channel === 'nightly')
    }
  };
}

async function getCachedReleaseIndex(request, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(RELEASES_PATH, request.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const response = jsonResponse(await buildReleaseIndex(), `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleReleases(request, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  try {
    const response = await getCachedReleaseIndex(request, ctx);
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  } catch (error) {
    return jsonResponse({ schema: 2, error: 'releases_unavailable' }, 'no-store', 503);
  }
}

async function handleChannel(request, ctx, channel) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  try {
    const response = await getCachedReleaseIndex(request, ctx);
    const index = await response.clone().json();
    const releases = index.channels[channel] || [];
    const result = jsonResponse({
      schema: 2,
      generated_at: index.generated_at,
      provider: index.provider,
      channel,
      latest: releases[0] || null,
      releases
    }, `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
    return request.method === 'HEAD'
      ? new Response(null, { status: result.status, headers: result.headers })
      : result;
  } catch (_) {
    return jsonResponse({ schema: 2, error: 'releases_unavailable' }, 'no-store', 503);
  }
}

async function buildManifest() {
  // fetchReleases() already normalizes GitHub's release objects. Do not normalize
  // them a second time: doing so drops the tag and all uploaded assets.
  const releases = await fetchReleases();
  const release = releases.find((item) => item.channel === 'stable') || releases[0] || null;
  if (!release) throw new Error('No public release found');

  const installer = release.assets.find((asset) => asset.type === 'installer') || null;
  const portable = release.assets.find((asset) => asset.type === 'portable') || null;
  return {
    schema: 2,
    generated_at: new Date().toISOString(),
    provider: 'github-releases',
    release: {
      version: release.version,
      name: release.name,
      channel: release.channel,
      prerelease: release.prerelease,
      published_at: release.published_at,
      notes_url: release.notes_url
    },
    platforms: {
      windows: {
        installer,
        portable
      }
    }
  };
}

async function getCachedManifest(request, ctx) {
  const cache = caches.default;
  const cacheUrl = new URL(MANIFEST_PATH, request.url);
  // Bypass previously cached manifests generated by the faulty double-normalization code.
  cacheUrl.searchParams.set('_cache', 'manifest-v3');
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const manifest = await buildManifest();
  const response = jsonResponse(manifest, `public, max-age=${MANIFEST_CACHE_TTL}, s-maxage=${MANIFEST_CACHE_TTL}`);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleManifest(request, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  try {
    const response = await getCachedManifest(request, ctx);
    if (request.method === 'HEAD') return new Response(null, { status: response.status, headers: response.headers });
    return response;
  } catch (_) {
    return jsonResponse({
      schema: 2,
      error: 'download_manifest_unavailable'
    }, 'no-store', 503);
  }
}

async function redirectToGitHubAsset(request, ctx, pathInfo) {
  try {
    if (!pathInfo?.tag || !pathInfo?.filename) return null;
    // Reuse the short-lived release index cache instead of calling GitHub for
    // every individual download request.
    const response = await getCachedReleaseIndex(request, ctx);
    const index = await response.json();
    const releases = Object.values(index.channels || {}).flat();
    const release = releases.find((item) => item.version === pathInfo.tag);
    if (!release) return null;
    const asset = release.assets.find((item) => item.filename === pathInfo.filename);
    return asset?.github_url || null;
  } catch (_) {
    return null;
  }
}

function handleHealth(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const response = jsonResponse({
    schema: 1,
    status: 'ok',
    service: 'voidone-website',
    checked_at: new Date().toISOString()
  }, 'no-store');
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}

async function fetchGitHubJson(url, headers) {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (_) {
    return { ok: false, status: 0, data: null };
  }
}

async function buildStatus() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'VoidOne-Website-Status-Service'
  };
  // Keep each public signal independent: a GitHub Actions API failure must not
  // erase repository metrics and release information that are still available.
  const [repoResult, releasesResult, runsResult] = await Promise.all([
    fetchGitHubJson(`https://api.github.com/repos/${GITHUB_REPO}`, headers),
    fetchGitHubJson(GITHUB_RELEASES_URL, headers),
    fetchGitHubJson(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=30&branch=main`, headers)
  ]);
  const repo = repoResult.data;
  const releases = releasesResult.data;
  const runs = runsResult.data;
  const release = Array.isArray(releases) ? releases.find((item) => !item.draft) || null : null;
  const run = Array.isArray(runs?.workflow_runs) ? runs.workflow_runs.find((item) =>
    item.head_branch === (repo?.default_branch || 'main') &&
    !String(item.name || '').toLowerCase().includes('ai code repair') &&
    !['skipped', 'cancelled'].includes(String(item.conclusion || '').toLowerCase())
  ) || null : null;
  const repositoryAvailable = repoResult.ok && Boolean(repo?.full_name);
  const releasesAvailable = releasesResult.ok && Array.isArray(releases);
  const ciAvailable = runsResult.ok && Array.isArray(runs?.workflow_runs);

  return {
    schema: 1,
    generated_at: new Date().toISOString(),
    status: repositoryAvailable && releasesAvailable && ciAvailable ? 'ok' : 'degraded',
    signals: {
      repository: repositoryAvailable ? 'ok' : 'unavailable',
      releases: releasesAvailable ? 'ok' : 'unavailable',
      ci: ciAvailable ? 'ok' : 'unavailable'
    },
    repository: repositoryAvailable ? {
      name: repo.full_name, branch: repo.default_branch,
      stars: repo.stargazers_count, forks: repo.forks_count,
      open_issues: repo.open_issues_count, watchers: repo.subscribers_count,
      pushed_at: repo.pushed_at, url: repo.html_url
    } : null,
    release: releasesAvailable ? (release ? {
      version: release.tag_name, name: release.name || release.tag_name,
      prerelease: Boolean(release.prerelease),
      published_at: release.published_at, url: release.html_url
    } : null) : null,
    ci: ciAvailable ? (run ? {
      name: run.name, status: run.status, conclusion: run.conclusion,
      branch: run.head_branch, sha: run.head_sha,
      updated_at: run.updated_at, url: run.html_url
    } : null) : null
  };
}

async function handleStatus(request, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  try {
    const cache = caches.default;
    const cacheKey = new Request(new URL(STATUS_PATH, request.url).toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers }) : cached;
    const response = jsonResponse(await buildStatus(), `public, max-age=${STATUS_CACHE_TTL}, s-maxage=${STATUS_CACHE_TTL}`);
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers }) : response;
  } catch (_) {
    return jsonResponse({
      schema: 1,
      status: 'unavailable',
      error: 'status_unavailable',
      signals: { repository: 'unavailable', releases: 'unavailable', ci: 'unavailable' },
      repository: null,
      release: null,
      ci: null
    }, 'no-store', 503);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === HEALTH_PATH) return handleHealth(request);

    if (url.pathname === SITE_PATH) return handleSite(request);

    if (url.pathname === STATUS_PATH) return handleStatus(request, ctx);

    if (url.pathname === MANIFEST_PATH) {
      return handleManifest(request, ctx);
    }

    if (url.pathname === RELEASES_PATH) return handleReleases(request, ctx);

    if (url.pathname === DOWNLOADS_PATH) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      try {
        const response = await getCachedReleaseIndex(request, ctx);
        const index = await response.clone().json();
        const releases = Object.values(index.channels).flat();
        const assets = releases.flatMap((release) => release.assets.map((asset) => ({
          ...asset,
          version: release.version,
          channel: release.channel,
          release_url: release.notes_url
        })));
        const result = jsonResponse({
          schema: 2,
          generated_at: index.generated_at,
          provider: index.provider,
          assets
        }, `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
        return request.method === 'HEAD'
          ? new Response(null, { status: result.status, headers: result.headers })
          : result;
      } catch (_) {
        return jsonResponse({ schema: 2, error: 'downloads_unavailable' }, 'no-store', 503);
      }
    }

    for (const channel of ['stable', 'beta', 'nightly']) {
      if (url.pathname === `${RELEASES_PATH}/${channel}`) return handleChannel(request, ctx, channel);
    }
    if (url.pathname === RELEASES_LATEST_PATH) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      try {
        const response = await getCachedReleaseIndex(request, ctx);
        const index = await response.clone().json();
        const releases = Object.values(index.channels).flat().sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        const result = jsonResponse({ schema: 2, generated_at: index.generated_at, provider: index.provider, latest: releases[0] || null }, `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
        return request.method === 'HEAD'
          ? new Response(null, { status: result.status, headers: result.headers })
          : result;
      } catch (_) {
        return jsonResponse({ schema: 2, error: 'releases_unavailable' }, 'no-store', 503);
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'not_found' }, 'no-store', 404);
    }

    if (url.pathname.startsWith(DOWNLOAD_PREFIX)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' }
        });
      }

      const pathInfo = sanitizeDownloadPath(url.pathname);
      if (!pathInfo) return new Response('Not Found', { status: 404 });

      const upstream = await redirectToGitHubAsset(request, ctx, pathInfo);
      if (upstream) return Response.redirect(upstream, 302);

      return new Response('Download Not Found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
