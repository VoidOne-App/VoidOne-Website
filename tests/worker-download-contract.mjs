import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const release = {
  tag_name: 'v1.0.0',
  name: 'VoidOne v1.0.0',
  prerelease: false,
  published_at: '2026-10-01T00:00:00Z',
  html_url: 'https://github.com/VoidOne-App/VoidOne/releases/tag/v1.0.0',
  assets: [{
    name: 'VoidOne-Setup.exe',
    state: 'uploaded',
    size: 1234,
    digest: 'sha256:' + 'a'.repeat(64),
    browser_download_url: 'https://github.com/VoidOne-App/VoidOne/releases/download/v1.0.0/VoidOne-Setup.exe'
  }]
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  assert.match(url, /^https:\/\/api\.github\.com\/repos\/VoidOne-App\/VoidOne\/releases\?per_page=20$/);
  return new Response(JSON.stringify([release]), {
    status: 200,
    headers: { 'content-type': 'application/vnd.github+json' }
  });
};

try {
  const ctx = { waitUntil() {} };
  const env = { ASSETS: { fetch: async () => new Response('asset fallback', { status: 200 }) } };

  const valid = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0/VoidOne-Setup.exe'), env, ctx);
  assert.equal(valid.status, 302, 'valid versioned asset path must redirect');
  assert.equal(valid.headers.get('location'), release.assets[0].browser_download_url);

  const unknownVersion = await worker.fetch(new Request('https://voidone.dpdns.org/download/v9.9.9/VoidOne-Setup.exe'), env, ctx);
  assert.equal(unknownVersion.status, 404, 'unknown release must not redirect');

  const encodedSlash = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0%2Fother/VoidOne-Setup.exe'), env, ctx);
  assert.equal(encodedSlash.status, 404, 'encoded path separators must be rejected');

  const malformedEncoding = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0/%ZZ'), env, ctx);
  assert.equal(malformedEncoding.status, 404, 'malformed percent encoding must not throw');

  const wrongMethod = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0/VoidOne-Setup.exe', { method: 'POST' }), env, ctx);
  assert.equal(wrongMethod.status, 405, 'download endpoint must reject methods other than GET and HEAD');

  console.log('Worker download contract: OK (valid redirect, unknown version, encoded separator, malformed encoding, method guard)');
} finally {
  globalThis.fetch = originalFetch;
}
