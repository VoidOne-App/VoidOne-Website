const VOIDONE_REPO = 'VoidOne-App/VoidOne';
const GITHUB_API = `https://api.github.com/repos/${VOIDONE_REPO}`;
const FALLBACK_RELEASES = `https://github.com/${VOIDONE_REPO}/releases`;

async function githubJSON(path) {
  const response = await fetch(`${GITHUB_API}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
  return response.json();
}

async function fetchLatestRelease() {
  const releases = await githubJSON('releases?per_page=20');
  return releases.find((release) => !release.draft) || null;
}

function findAsset(release, extensions) {
  if (!release?.assets) return null;
  const wanted = extensions.map((value) => value.toLowerCase());
  return release.assets.find((asset) => asset.state === 'uploaded' && wanted.some((ext) => asset.name.toLowerCase().endsWith(ext))) || null;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
}

function renderAsset(key, extensions, releaseUrl) {
  const asset = findAsset(releaseUrl, extensions);
  document.querySelectorAll(`[data-download="${key}"]`).forEach((node) => {
    node.href = asset?.browser_download_url || releaseUrl.html_url || FALLBACK_RELEASES;
    node.setAttribute('aria-disabled', asset ? 'false' : 'true');
  });
  document.querySelectorAll(`[data-asset="${key}"]`).forEach((node) => {
    node.textContent = asset ? asset.name : 'Not included in this release';
  });
}

async function renderRelease() {
  try {
    const release = await fetchLatestRelease();
    if (!release) throw new Error('No published release');

    setText('[data-release-version]', release.tag_name || 'Unknown version');
    setText('[data-release-name]', release.name || release.tag_name || 'VoidOne release');
    setText('[data-release-date]', formatDate(release.published_at));
    setText('[data-release-status]', release.prerelease ? 'PRE-RELEASE' : 'LATEST STABLE');

    document.querySelectorAll('[data-latest-release]').forEach((node) => {
      node.textContent = release.tag_name || 'Latest release';
      node.href = release.html_url || FALLBACK_RELEASES;
    });
    document.querySelectorAll('[data-release-url]').forEach((node) => { node.href = release.html_url || FALLBACK_RELEASES; });

    renderAsset('exe', ['.exe'], release);
    renderAsset('msi', ['.msi'], release);
    renderAsset('zip', ['.zip'], release);

    document.querySelectorAll('[data-release-panel]').forEach((node) => node.removeAttribute('data-loading'));
  } catch (_) {
    setText('[data-release-version]', 'Release unavailable');
    setText('[data-release-name]', 'Open GitHub Releases');
    setText('[data-release-date]', 'Live data unavailable');
    setText('[data-release-status]', 'VIEW RELEASES');
    document.querySelectorAll('[data-latest-release], [data-release-url]').forEach((node) => {
      node.textContent = node.textContent || 'View releases';
      node.href = FALLBACK_RELEASES;
    });
    document.querySelectorAll('[data-asset]').forEach((node) => { node.textContent = 'Open release page'; });
  }
}

window.VoidOneGitHub = { fetchLatestRelease, repository: VOIDONE_REPO };
document.addEventListener('DOMContentLoaded', renderRelease);
