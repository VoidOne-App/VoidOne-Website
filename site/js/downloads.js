const DOWNLOAD_MANIFEST = '/download/manifest.json';
const FALLBACK_RELEASES = 'https://github.com/VoidOne-App/VoidOne/releases';

async function fetchManifest() {
  const response = await fetch(DOWNLOAD_MANIFEST, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Download manifest: ${response.status}`);
  return response.json();
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
}

function setDownload(key, asset) {
  document.querySelectorAll(`[data-download="${key}"]`).forEach((node) => {
    node.href = asset?.url || FALLBACK_RELEASES;
    node.setAttribute('aria-disabled', asset ? 'false' : 'true');
    node.setAttribute('title', asset ? `Download ${asset.filename}` : 'Asset unavailable; open the release page');
  });
  document.querySelectorAll(`[data-asset="${key}"]`).forEach((node) => {
    node.textContent = asset ? `${asset.filename} · ${asset.size_label}` : 'Not included in this release';
  });
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

async function renderDownloads() {
  try {
    const manifest = await fetchManifest();
    const release = manifest.release;
    if (!release) throw new Error('No release metadata');

    setText('[data-release-version]', release.version || 'Unknown version');
    setText('[data-release-name]', release.name || release.version || 'VoidOne release');
    setText('[data-release-date]', formatDate(release.published_at));
    setText('[data-release-status]', release.prerelease ? 'PRE-RELEASE' : 'LATEST STABLE');

    document.querySelectorAll('[data-release-url]').forEach((node) => {
      node.href = release.notes_url || FALLBACK_RELEASES;
    });

    setDownload('exe', manifest.assets?.installer);
    setDownload('zip', manifest.assets?.portable);
  } catch (_) {
    setText('[data-release-version]', 'Download unavailable');
    setText('[data-release-name]', 'Open release information');
    setText('[data-release-date]', 'Live data unavailable');
    setText('[data-release-status]', 'VIEW RELEASES');
    document.querySelectorAll('[data-release-url]').forEach((node) => {
      node.href = FALLBACK_RELEASES;
    });
    document.querySelectorAll('[data-asset]').forEach((node) => { node.textContent = 'Open release information'; });
    document.querySelectorAll('[data-download]').forEach((node) => {
      node.href = FALLBACK_RELEASES;
      node.setAttribute('aria-disabled', 'true');
    });
  } finally {
    document.querySelectorAll('[data-release-panel]').forEach((node) => node.removeAttribute('data-loading'));
  }
}

document.addEventListener('DOMContentLoaded', renderDownloads);
