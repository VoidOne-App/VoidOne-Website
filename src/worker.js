const DOWNLOAD_PREFIX = '/download/';

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
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

async function checkAiRateLimit(request) {
  const ip = getAiClientIp(request);
  const key = new Request(`https://voidone-ai-rate-limit.invalid/${encodeURIComponent(ip)}`);
  const cache = caches.default;
  const existing = await cache.match(key);
  let count = 0;

  if (existing) {
    conss: 405,
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
