const VOIDONE_GITHUB = Object.freeze({
  repository: 'VoidOne-App/VoidOne',
  api: 'https://api.github.com/repos/VoidOne-App/VoidOne',
  releases: 'https://github.com/VoidOne-App/VoidOne/releases'
});

async function githubJSON(path) {
  const response = await fetch(`${VOIDONE_GITHUB.api}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
}

async function getLatestRelease() {
  const releases = await githubJSON('releases?per_page=20');
  return releases.find((release) => !release.draft) || null;
}

function getReleaseAsset(release, extensions) {
  const wanted = extensions.map((extension) => extension.toLowerCase());
  return release?.assets?.find((asset) => asset.state === 'uploaded' && wanted.some((extension) => asset.name.toLowerCase().endsWith(extension))) || null;
}

function getReleaseAssetURL(asset) {
  return asset?.browser_download_url || null;
}

window.VoidOneAPI = Object.freeze({ ...VOIDONE_GITHUB, githubJSON, getLatestRelease, getReleaseAsset, getReleaseAssetURL });
