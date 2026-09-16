import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const repo = 'VoidOne-App/VoidOne';
const bucket = process.env.VOIDONE_R2_BUCKET || 'voidone-downloads';
const api = `https://api.github.com/repos/${repo}/releases?per_page=20`;
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'VoidOne-Website-download-sync'
};

async function download(url, destination) {
  await exec('curl', ['-fsSL', '-H', `Accept: application/octet-stream`, '-H', `User-Agent: ${headers['User-Agent']}`, '-o', destination, url]);
}

async function sha256(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

function sizeLabel(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const response = await fetch(api, { headers });
if (!response.ok) throw new Error(`GitHub release API failed: ${response.status}`);
const releases = await response.json();
const release = releases.find((item) => !item.draft);
if (!release) throw new Error('No published VoidOne release found.');

const installer = release.assets?.find((asset) => asset.name.endsWith('.exe') && asset.state === 'uploaded');
const portable = release.assets?.find((asset) => asset.name.endsWith('.zip') && asset.state === 'uploaded');
if (!installer || !portable) throw new Error('Release does not contain both EXE and ZIP assets.');

await mkdir('.download-sync', { recursive: true });
await download(installer.browser_download_url, '.download-sync/installer.exe');
await download(portable.browser_download_url, '.download-sync/portable.zip');

const installerBytes = (await readFile('.download-sync/installer.exe')).byteLength;
const portableBytes = (await readFile('.download-sync/portable.zip')).byteLength;

const version = release.tag_name || 'unknown';
const manifest = {
  schema: 1,
  generated_at: new Date().toISOString(),
  release: {
    version,
    name: release.name || version,
    prerelease: Boolean(release.prerelease),
    published_at: release.published_at,
    notes_url: release.html_url
  },
  assets: {
    installer: {
      filename: installer.name,
      url: `/download/windows/${version}/${encodeURIComponent(installer.name)}`,
      size: installerBytes,
      size_label: sizeLabel(installerBytes),
      sha256: await sha256('.download-sync/installer.exe')
    },
    portable: {
      filename: portable.name,
      url: `/download/windows/${version}/${encodeURIComponent(portable.name)}`,
      size: portableBytes,
      size_label: sizeLabel(portableBytes),
      sha256: await sha256('.download-sync/portable.zip')
    }
  }
};

await writeFile('.download-sync/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

async function put(key, file, contentType, disposition) {
  await exec('npx', [
    'wrangler@4.129.0',
    'r2', 'object', 'put', `${bucket}/${key}`,
    '--remote',
    '--file', file,
    '--content-type', contentType,
    '--content-disposition', disposition,
    '--cache-control', 'public, max-age=31536000, immutable'
  ], { env: process.env });
}

await put(`releases/${version}/${installer.name}`, '.download-sync/installer.exe', 'application/vnd.microsoft.portable-executable', `attachment; filename="${installer.name}"`);
await put(`releases/${version}/${portable.name}`, '.download-sync/portable.zip', 'application/zip', `attachment; filename="${portable.name}"`);
await put(`manifest.json`, '.download-sync/manifest.json', 'application/json; charset=utf-8', 'inline');

console.log(`Synced ${version}: ${installer.name}, ${portable.name}`);
console.log(`Installer SHA-256: ${manifest.assets.installer.sha256}`);
console.log(`Portable SHA-256: ${manifest.assets.portable.sha256}`);
