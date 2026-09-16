document.addEventListener('DOMContentLoaded', async () => {
  if (!window.VoidOneAPI) return;
  const fallback = window.VoidOneAPI.releases;
  const text = (selector, value) => document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  const link = (selector, url) => document.querySelectorAll(selector).forEach((node) => { node.href = url; });

  try {
    const release = await window.VoidOneAPI.getLatestRelease();
    if (!release) throw new Error('No release');
    const exe = window.VoidOneAPI.getReleaseAsset(release, ['.exe']);
    const zip = window.VoidOneAPI.getReleaseAsset(release, ['.zip']);
    const exeURL = window.VoidOneAPI.getReleaseAssetURL(exe);
    const zipURL = window.VoidOneAPI.getReleaseAssetURL(zip);
    text('[data-release-version]', release.tag_name || 'Unknown version');
    text('[data-release-name]', release.name || release.tag_name || 'VoidOne release');
    text('[data-release-date]', release.published_at ? new Date(release.published_at).toLocaleDateString() : 'Date unavailable');
    text('[data-release-status]', release.prerelease ? 'PRE-RELEASE' : 'LATEST STABLE');
    link('[data-release-url]', release.html_url || fallback);
    link('[data-download="exe"], [data-installer]', exeURL || release.html_url || fallback);
    link('[data-download="zip"], [data-portable]', zipURL || release.html_url || fallback);
    document.querySelectorAll('[data-asset="exe"]').forEach((node) => { node.textContent = exe?.name || 'Open release page'; });
    document.querySelectorAll('[data-asset="zip"]').forEach((node) => { node.textContent = zip?.name || 'Open release page'; });
  } catch (_) {
    text('[data-release-version]', 'Release unavailable');
    text('[data-release-name]', 'Open GitHub Releases');
    text('[data-release-status]', 'VIEW RELEASES');
    link('[data-release-url], [data-installer], [data-portable], [data-download="exe"], [data-download="zip"]', fallback);
  }
});
