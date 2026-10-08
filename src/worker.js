const DOWNLOAD_PREFIX = '/download/';
const MANIFEST_PATH = '/download/manifest.json';
const AI_PREFIX = '/api/ai';
const STATUS_PATH = '/api/status';
const HEALTH_PATH = '/api/health';
const STATUS_CACHE_TTL = 60;
const GITHUB_REPO = 'VoidOne-App/VoidOne';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`;
const MANIFEST_CACHE_TTL = 300;
const RELEASES_CACHE_TTL = 120;
const RELEASES_PATH = '/api/releases';
const DOWNLOADS_PATH = '/api/downloads';

const AI_MODEL = '@cf/zai-org/glm-4.7-flash';
const AI_MAX_INPUT_CHARS = 2000;
const AI_MAX_OUTPUT_TOKENS = 256;
const AI_RATE_LIMIT = 10;
const AI_RATE_WINDOW_MS = 5 * 60 * 1000;

const aiRateBuckets = new Map();

function sanitizeDownloadPath(pathname) {
  const relative = pathname.slice(DOWNLOAD_PREFIX.length);
  if (!relative || relative.includes('..') || relative.startsWith('/')) return null;
  return relative;
}

function jsonResponse(payload, cacheControl = 'public, max-age=300', status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...extraHeaders
    }
  });
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
  return {
    version: release.tag_name,
    name: release.name || release.tag_name,
    channel: releaseChannel(release),
    prerelease: Boolean(release.prerelease),
    published_at: release.published_at,
    created_at: release.created_at,
    notes_url: release.html_url,
    body: release.body || '',
    assets: release.assets
      .filter((asset) => asset.state === 'uploaded')
      .map((asset) => toAsset(asset, `${DOWNLOAD_PREFIX}${encodeURIComponent(asset.name)}`))
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
  return releases.filter((release) => !release.draft).map(normalizeRelease);
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
  const response = await getCachedReleaseIndex(request, ctx);
  const index = await response.clone().json();
  const releases = index.channels[channel] || [];
  return jsonResponse({
    schema: 2,
    generated_at: index.generated_at,
    provider: index.provider,
    channel,
    latest: releases[0] || null,
    releases
  }, `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
}

async function buildManifest() {
  const release = await fetchLatestRelease();
  if (!release) throw new Error('No public release found');
  const normalized = normalizeRelease(release);
  const installer = normalized.assets.find((asset) => asset.type === 'installer') || null;
  const portable = normalized.assets.find((asset) => asset.type === 'portable') || null;
  return {
    schema: 2,
    generated_at: new Date().toISOString(),
    provider: 'github-releases',
    release: {
      version: normalized.version,
      name: normalized.name,
      channel: normalized.channel,
      prerelease: normalized.prerelease,
      published_at: normalized.published_at,
      notes_url: normalized.notes_url
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
  const cacheKey = new Request(new URL(MANIFEST_PATH, request.url).toString(), { method: 'GET' });
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
  } catch (error) {
    return jsonResponse({
      schema: 1,
      error: 'download_manifest_unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 'no-store');
  }
}

async function redirectToGitHubAsset(relativePath) {
  try {
    const release = await fetchLatestRelease();
    if (!release) return null;

    const filename = decodeURIComponent(relativePath);
    const asset = release.assets.find((item) => item.name === filename);
    return asset?.browser_download_url || null;
  } catch (_) {
    return null;
  }
}

function handleHealth(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return jsonResponse({
    schema: 1,
    status: 'ok',
    service: 'voidone-website',
    checked_at: new Date().toISOString()
  }, 'no-store');
}

async function buildStatus() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'VoidOne-Website-Status-Service'
  };
  const [repoResponse, releasesResponse, runsResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`, { headers }),
    fetch(GITHUB_RELEASES_URL, { headers }),
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=5`, { headers })
  ]);
  if (!repoResponse.ok || !releasesResponse.ok || !runsResponse.ok) {
    throw new Error(`GitHub status upstream unavailable: ${repoResponse.status}/${releasesResponse.status}/${runsResponse.status}`);
  }
  const [repo, releases, runs] = await Promise.all([
    repoResponse.json(), releasesResponse.json(), runsResponse.json()
  ]);
  const release = releases.find((item) => !item.draft) || null;
  const run = runs.workflow_runs?.[0] || null;
  return {
    schema: 1,
    generated_at: new Date().toISOString(),
    repository: {
      name: repo.full_name, branch: repo.default_branch,
      stars: repo.stargazers_count, forks: repo.forks_count,
      open_issues: repo.open_issues_count, watchers: repo.subscribers_count,
      pushed_at: repo.pushed_at, url: repo.html_url
    },
    release: release ? {
      version: release.tag_name, name: release.name || release.tag_name,
      prerelease: Boolean(release.prerelease),
      published_at: release.published_at, url: release.html_url
    } : null,
    ci: run ? {
      name: run.name, status: run.status, conclusion: run.conclusion,
      branch: run.head_branch, sha: run.head_sha,
      updated_at: run.updated_at, url: run.html_url
    } : null
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
  } catch (error) {
    return jsonResponse({
      schema: 1, error: 'status_unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 'no-store', 503);
  }
}

function getAiClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
}

function checkAiRateLimit(request) {
  const ip = getAiClientIp(request);
  const now = Date.now();
  const bucket = aiRateBuckets.get(ip);

  if (!bucket || now - bucket.startedAt >= AI_RATE_WINDOW_MS) {
    aiRateBuckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }

  if (bucket.count >= AI_RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function buildAiMessages(message) {
  return [
    {
      role: 'system',
      content: [
        'You are VoidOne AI, the assistant for the VoidOne native PC gaming platform.',
        'Help with VoidOne features, installation, releases, documentation, and general troubleshooting.',
        'Do not invent VoidOne features, release information, or technical facts.',
        'If you do not know something about VoidOne, say so clearly.',
        'Keep answers concise and useful.'
      ].join(' ')
    },
    { role: 'user', content: message }
  ];
}

function extractAiResponse(result) {
  if (typeof result === 'string') return result;
  return result?.choices?.[0]?.message?.content
    || result?.response
    || result?.result
    || result?.output_text
    || result?.text
    || '';
}

async function handleAi(request, env) {
  const corsHeaders = {
    'access-control-allow-origin': 'https://voidone.dpdns.org',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 'no-store', 405, corsHeaders);

  if (!checkAiRateLimit(request)) {
    return jsonResponse(
      { error: 'rate_limit_exceeded', message: 'Please wait a few minutes before trying again.' },
      'no-store',
      429,
      corsHeaders
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: 'invalid_json' }, 'no-store', 400, corsHeaders);
  }

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return jsonResponse({ error: 'message_required' }, 'no-store', 400, corsHeaders);
  if (message.length > AI_MAX_INPUT_CHARS) {
    return jsonResponse(
      { error: 'message_too_long', max_chars: AI_MAX_INPUT_CHARS },
      'no-store',
      413,
      corsHeaders
    );
  }

  try {
    const result = await env.AI.run(AI_MODEL, {
      messages: buildAiMessages(message),
      max_completion_tokens: AI_MAX_OUTPUT_TOKENS,
      temperature: 0.2
    });

    const responseText = extractAiResponse(result);
    if (!responseText) {
      return jsonResponse({ error: 'empty_ai_response' }, 'no-store', 502, corsHeaders);
    }

    return jsonResponse(
      { model: AI_MODEL, response: responseText },
      'no-store',
      200,
      corsHeaders
    );
  } catch (error) {
    return jsonResponse({
      error: 'ai_unavailable',
      message: error instanceof Error ? error.message : 'Workers AI request failed'
    }, 'no-store', 503, corsHeaders);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === AI_PREFIX) return handleAi(request, env);

    if (url.pathname === HEALTH_PATH) return handleHealth(request);

    if (url.pathname === STATUS_PATH) return handleStatus(request, ctx);

    if (url.pathname === MANIFEST_PATH) {
      return handleManifest(request, ctx);
    }

    if (url.pathname === RELEASES_PATH) return handleReleases(request, ctx);

    if (url.pathname === DOWNLOADS_PATH) {
      const response = await getCachedReleaseIndex(request, ctx);
      const index = await response.clone().json();
      const releases = Object.values(index.channels).flat();
      const assets = releases.flatMap((release) => release.assets.map((asset) => ({
        ...asset,
        version: release.version,
        channel: release.channel,
        release_url: release.notes_url
      })));
      return jsonResponse({
        schema: 2,
        generated_at: index.generated_at,
        provider: index.provider,
        assets
      }, `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
    }

    for (const channel of ['stable', 'beta', 'nightly']) {
      if (url.pathname === `${RELEASES_PATH}/${channel}`) return handleChannel(request, ctx, channel);
    }
    if (url.pathname === `${RELEASES_PATH}/latest`) {
      const response = await getCachedReleaseIndex(request, ctx);
      const index = await response.clone().json();
      const releases = Object.values(index.channels).flat().sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      return jsonResponse({ schema: 2, generated_at: index.generated_at, provider: index.provider, latest: releases[0] || null }, `public, max-age=${RELEASES_CACHE_TTL}, s-maxage=${RELEASES_CACHE_TTL}`);
    }

    if (url.pathname.startsWith(DOWNLOAD_PREFIX)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' }
        });
      }

      const relativePath = sanitizeDownloadPath(url.pathname);
      if (!relativePath) return new Response('Not Found', { status: 404 });

      const upstream = await redirectToGitHubAsset(relativePath);
      if (upstream) return Response.redirect(upstream, 302);

      return new Response('Download Not Found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
