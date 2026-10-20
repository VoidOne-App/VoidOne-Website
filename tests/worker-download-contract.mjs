import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const release = {
  tag_name: 'v1.0.0',
  name: 'VoidOne v1.0.0',
  prerelease: false,
  created_at: '2026-10-01T00:00:00Z',
  published_at: '2026-10-01T00:00:00Z',
  body: 'Contract-test release.',
  html_url: 'https://github.com/VoidOne-App/VoidOne/releases/tag/v1.0.0',
  assets: [
    {
      name: 'VoidOne-Setup.exe',
      state: 'uploaded',
      size: 1234,
      digest: 'sha256:' + 'a'.repeat(64),
      browser_download_url: 'https://github.com/VoidOne-App/VoidOne/releases/download/v1.0.0/VoidOne-Setup.exe'
    },
    {
      name: 'VoidOne-Portable.zip',
      state: 'uploaded',
      size: 5678,
      digest: 'sha256:' + 'b'.repeat(64),
      browser_download_url: 'https://github.com/VoidOne-App/VoidOne/releases/download/v1.0.0/VoidOne-Portable.zip'
    }
  ]
};

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
globalThis.caches = {
  default: {
    async match() { return undefined; },
    async put() {}
  }
};
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

  const healthHead = await worker.fetch(new Request('https://voidone.dpdns.org/api/health', { method: 'HEAD' }), env, ctx);
  assert.equal(healthHead.status, 200);
  assert.equal(await healthHead.text(), '', 'HEAD health responses must not contain a body');

  const aiEnv = { AI: { run: async () => ({ response: 'contract-test answer' }) }, ASSETS: env.ASSETS };
  const aiUrl = 'https://voidone.dpdns.org/api/ai';
  const spoofIp = 'contract-test-spoof-' + Date.now();
  for (let i = 0; i < 10; i++) {
    const response = await worker.fetch(new Request(aiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': spoofIp + '-' + i
      },
      body: JSON.stringify({ message: 'hello' })
    }), aiEnv, ctx);
    assert.equal(response.status, 200, 'AI request within the configured limit should succeed');
  }
  const rateLimited = await worker.fetch(new Request(aiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': spoofIp + '-eleventh'
    },
    body: JSON.stringify({ message: 'hello' })
  }), aiEnv, ctx);
  assert.equal(rateLimited.status, 429, 'changing client-supplied X-Forwarded-For must not bypass the per-isolate limiter');

  const manifestResponse = await worker.fetch(new Request('https://voidone.dpdns.org/download/manifest.json'), env, ctx);
  assert.equal(manifestResponse.status, 200, 'manifest should be available for published releases');
  const manifest = await manifestResponse.json();
  assert.equal(manifest.schema, 2);
  assert.equal(manifest.release.version, release.tag_name, 'manifest preserves the release tag');
  assert.equal(manifest.release.channel, 'stable');
  assert.equal(manifest.platforms.windows.installer.filename, 'VoidOne-Setup.exe');
  assert.equal(manifest.platforms.windows.portable.filename, 'VoidOne-Portable.zip');
  assert.equal(manifest.platforms.windows.installer.sha256, 'a'.repeat(64));
  assert.equal(manifest.platforms.windows.portable.sha256, 'b'.repeat(64));

  const latestResponse = await worker.fetch(new Request('https://voidone.dpdns.org/api/releases/latest'), env, ctx);
  assert.equal(latestResponse.status, 200, 'latest-release fallback endpoint should work');
  const latest = await latestResponse.json();
  assert.equal(latest.latest.version, release.tag_name);
  assert.ok(Array.isArray(latest.latest.assets), 'fallback endpoint exposes normalized assets as an array');
  assert.equal(latest.latest.assets.find((asset) => asset.type === 'installer')?.filename, 'VoidOne-Setup.exe');

  const indexResponse = await worker.fetch(new Request('https://voidone.dpdns.org/api/releases'), env, ctx);
  assert.equal(indexResponse.status, 200);
  const index = await indexResponse.json();
  assert.equal(index.channels.stable[0].version, release.tag_name);

  const head = await worker.fetch(new Request('https://voidone.dpdns.org/download/manifest.json', { method: 'HEAD' }), env, ctx);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '', 'HEAD manifest responses must not contain a body');

  const unknownVersion = await worker.fetch(new Request('https://voidone.dpdns.org/download/v9.9.9/VoidOne-Setup.exe'), env, ctx);
  assert.equal(unknownVersion.status, 404, 'unknown release must not redirect');

  const encodedSlash = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0%2Fother/VoidOne-Setup.exe'), env, ctx);
  assert.equal(encodedSlash.status, 404, 'encoded path separators must be rejected');

  const malformedEncoding = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0/%ZZ'), env, ctx);
  assert.equal(malformedEncoding.status, 404, 'malformed percent encoding must not throw');

  const wrongMethod = await worker.fetch(new Request('https://voidone.dpdns.org/download/v1.0.0/VoidOne-Setup.exe', { method: 'POST' }), env, ctx);
  assert.equal(wrongMethod.status, 405, 'download endpoint must reject methods other than GET and HEAD');

  globalThis.fetch = async () => new Response('upstream internal details must not be exposed', { status: 503 });
  const failedManifestResponse = await worker.fetch(new Request('https://voidone.dpdns.org/download/manifest.json'), env, ctx);
  assert.equal(failedManifestResponse.status, 503);
  const failedManifest = await failedManifestResponse.json();
  assert.equal(failedManifest.error, 'download_manifest_unavailable');
  assert.equal('message' in failedManifest, false, 'manifest must not leak upstream errors');

  const failedStatusResponse = await worker.fetch(new Request('https://voidone.dpdns.org/api/status'), env, ctx);
  assert.equal(failedStatusResponse.status, 503);
  const failedStatus = await failedStatusResponse.json();
  assert.equal(failedStatus.error, 'status_unavailable');
  assert.equal('message' in failedStatus, false, 'status API must not leak upstream errors');

  console.log('Worker API/download contract: OK (manifest shape, fallback, hashes, HEAD semantics, path sanitization, method guard, generic errors, AI size/rate controls)');
} finally {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
}
