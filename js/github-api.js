const VOIDONE_REPO = 'VoidOne-App/VoidOne';
const GITHUB_API = `https://api.github.com/repos/${VOIDONE_REPO}`;

async function githubJSON(path) {
  const response = await fetch(`${GITHUB_API}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
  return response.json();
}

async function fetchLatestRelease() {
  return githubJSON('releases/latest');
}

async function renderRelease() {
  const nodes = document.querySelectorAll('[data-latest-release]');
  if (!nodes.length) return;
  try {
    const release = await fetchLatestRelease();
    nodes.forEach((node) => {
      node.textContent = release.tag_name || 'Latest release';
      node.href = release.html_url || `https://github.com/${VOIDONE_REPO}/releases`;
    });
  } catch (_) {
    nodes.forEach((node) => {
      node.textContent = 'View releases';
      node.href = `https://github.com/${VOIDONE_REPO}/releases`;
    });
  }
}

window.VoidOneGitHub = { fetchLatestRelease, repository: VOIDONE_REPO };
document.addEventListener('DOMContentLoaded', renderRelease);
