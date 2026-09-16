const DOWNLOAD_PREFIX = '/download/';
const DOWNLOAD_BUCKET_PREFIX = 'releases/';

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(DOWNLOAD_PREFIX)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' }
        });
      }

      const relativePath = sanitizeDownloadPath(url.pathname);
      if (!relativePath) return new Response('Not Found', { status: 404 });

      const key = `${DOWNLOAD_BUCKET_PREFIX}${relativePath}`;
      const object = await env.VOIDONE_DOWNLOADS.get(key, {
        onlyIf: request.headers,
        range: request.headers
      });

      if (!object) return new Response('Download Not Found', { status: 404 });
      if (!('body' in object) || !object.body) return new Response(null, { status: 412 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
      headers.set('content-type', object.httpMetadata?.contentType || contentTypeFor(relativePath));
      headers.set('content-disposition', object.httpMetadata?.contentDisposition || `attachment; filename="${relativePath.split('/').pop()}"`);
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

    return env.ASSETS.fetch(request);
  }
};
