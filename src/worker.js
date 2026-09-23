const DOWNLOAD_PREFIX = '/download/';
const AI_PREFIX = '/api/ai';
const GITHUB_REPO = 'VoidOne-App/VoidOne';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`;
const MANIFEST_CACHE_TTL = 300;

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

function toAsset(asset, url) {
  return {
    filename: asset.name,
    size: asset.size,
    size_label: `${(asset.size / 1024 / 1024).toFixed(1)} MB`,
    url
  };
}

async function buildManifest() {
  const release = await fetchLatestRelease();
  if (!release) throw new Error('No public release found');

  const installer = release.assets.find((asset) => {
    const name = asset.name.toLowerCase();
    return name.endsWith('.msi') || name.endsWith('.exe');
  });
  const portable = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.zip'));

  return {
    schema: 1,
    generated_at: new Date().toISOString(),
    provider: 'github-releases',
    release: {
      version: release.tag_name,
      name: release.name || release.tag_name,
      prerelease: Boolean(release.prerelease),
      published_at: release.published_at,
      notes_url: release.html_url
    },
    assets: {
      installer: installer ? toAsset(installer, `${DOWNLOAD_PREFIX}${encodeURIComponent(installer.name)}`) : null,
      portable: portable ? toAsset(portable, `${DOWNLOAD_PREFIX}${encodeURIComponent(portable.name)}`) : null
    }
  };
}

async function getCachedManifest(request, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(`${DOWNLOAD_PREFIX}manifest.json`, request.url).toString(), { method: 'GET' });
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

    if (url.pathname === `${DOWNLOAD_PREFIX}manifest.json`) {
      return handleManifest(request, ctx);
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
