const VOIDONE_REPO = 'VoidOne-App/VoidOne';
const GITHUB_API = `https://api.github.com/repos/${VOIDONE_REPO}`;

async function fetchLatestRelease() {
  const response = await fetch(`${GITHUB_API}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
  return response.json();
}

window.VoidOneGitHub = { fetchLatestRelease, repository: VOIDONE_REPO };
