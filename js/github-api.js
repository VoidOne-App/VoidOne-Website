const VOIDONE_REPO = 'VoidOne-App/VoidOne';
const GITHUB_API = `https://api.github.com/repos/${VOIDONE_REPO}`;
const FALLBACK_RELEASES = `https://github.com/${VOIDONE_REPO}/releases`;

async function githubJSON(path) {
  const response = await fetch(`${GITHUB_API}/${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
  return response.json();
}

async function fetchLatestRelease() {
  const releases = await githubJSON('releases?per_page=10');
  return releases.find((release) => !release.draft) || null;
}

function findAsset(release, extension) {
  if (!release?.assets) return null;
  const assets = release.assets.filter((asset) => asset.state === 'uploaded');
  return assets.find((asset) => asset.name.toLowerCase().endsWith(extension)) || null;
}

async function renderRelease() {
  try {
    const release = await fetchLatestRelease();
    if (!release) throw new Error('No published release');
    document.querySelectorAll('[data-latest-release]').forEach((node) => {
      node.textContent = release.tag_name || 'Latest release';
      node.href = release.html_url || FALLBACK_RELEASES;
    });
    document.querySelectorAll('[data-release-url]').forEach((node) => { node.href = release.html_url || FALLBACK_RELEASES; });
    for (const [key, extension] of [['exe', '.exe'], ['msi', '.msi'], ['zip', '.zip']]) {
      const asset = findAsset(release, extension);
      document.querySelectorAll(`[data-download="${key}"]`).forEach((node) => { if (asset) node.href = asset.browser_download_url; });
      document.querySelectorAll(`[data-asset="${key}"]`).forEach((node) => { node.textContent = asset ? asset.name : 'Not included in this release'; });
    }
  } catch (_) {
    document.querySelectorAll('[data-latest-release], [data-release-url]').forEach((node) => { node.textContent = node.dataset.latestRelease ? 'View releases' : node.textContent; node.href = FALLBACK_RELEASES; });
    document.querySelectorAll('[data-asset]').forEach((node) => { node.textContent = 'Open release page'; });
  }
}

window.VoidOneGitHub = { fetchLatestRelease, repository: VOIDONE_REPO };
document.addEventListener('DOMContentLoaded', renderRelease);
