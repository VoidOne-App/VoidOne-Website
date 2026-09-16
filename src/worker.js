const DOWNLOAD_PREFIX = '/download/';
const DOWNLOAD_BUCKET_PREFIX = 'releases/';
const GITHUB_REPO = 'VoidOne-App/VoidOne';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`;
const MANIFEST_CACHE_TTL = 300;

function contentTypeFor(pathname) {
  if (pathname.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (pathname.endsWith('.zip')) return 'application/zip';
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function sanitizeDownloadPath(pathname) {
  const relative = pathname.slice(DOWNLOAD_PREFIX.length);
  if (!relative || relative.includes('..') || relative.startsWith('/')) return null;
  return relative;
}

function jsonResponse(payload, cacheControl = 'public, max-age=300') {
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl
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

  const installer = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'));
  const portable = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.zip'));

  return {
    schema: 1,
    generated_at: new Date().toISOString(),
    provider: 'voidone-download-layer',
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

async function handleManifest(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  try {
    const manifest = await buildManifest();
    return jsonResponse(request.method === 'HEAD' ? null : manifest);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === `${DOWNLOAD_PREFIX}manifest.json`) {
      return handleManifest(request);
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

      if (env.VOIDONE_DOWNLOADS) {
        const key = `${DOWNLOAD_BUCKET_PREFIX}${relativePath}`;
        const object = await env.VOIDONE_DOWNLOADS.get(key, {
          onlyIf: request.headers,
          range: request.headers
        });

        if (object && ('body' in object) && object.body) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('cache-control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
          headers.set('content-type', object.httpMetadata?.contentType || contentTypeFor(relativePath));
          headers.set('content-disposition', object.httpMetadata?.contentDisposition || `attachment; filename="${decodeURIComponent(relativePath.split('/').pop())}"`);
          headers.set('accept-ranges', 'bytes');

          if (object.range) {
            const offset = object.range.offset ?? 0;
            const length = object.range.length ?? object.size - offset;
            headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
            headers.set('content-length', String(length));
            return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers });
          }

          headers.set('content-length', String(object.size));
          return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
        }
      }

      const upstream = await redirectToGitHubAsset(relativePath);
      if (upstream) {
        return Response.redirect(upstream, 302);
      }

      return new Response('Download Not Found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
