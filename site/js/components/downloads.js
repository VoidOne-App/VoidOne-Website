document.addEventListener('DOMContentLoaded', async () => {
  if (!window.VoidOneAPI) return;
  const fallback = window.VoidOneAPI.releases;
  const text = (selector, value) => document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  const link = (selector, url) => document.querySelectorAll(selector).forEach((node) => { node.href = url; });

  try {
    const release = await window.VoidOneAPI.getLatestRelease();
    if (!release) throw new Error('No release');
    const installer = window.VoidOneAPI.getReleaseAsset(release, ['.msi']);
    const portable = window.VoidOneAPI.getReleaseAsset(release, ['.zip']);
    const installerURL = window.VoidOneAPI.getReleaseAssetURL(installer);
    const portableURL = window.VoidOneAPI.getReleaseAssetURL(portable);
    text('[data-release-version], [data-version]', release.tag_name || 'Unknown version');
    text('[data-release-name]', release.name || release.tag_name || 'VoidOne release');
    text('[data-release-date]', release.published_at ? new Date(release.published_at).toLocaleDateString() : 'Date unavailable');
    text('[data-release-status]', release.prerelease ? 'PRE-RELEASE' : 'LATEST STABLE');
    text('[data-meta]', `${release.name || release.tag_name || 'VoidOne release'} · ${release.prerelease ? 'Pre-release' : 'Stable'}`);
    link('[data-release-url]', release.html_url || fallback);
    link('[data-download="msi"], [data-installer]', installerURL || release.html_url || fallback);
    link('[data-download="zip"], [data-portable]', portableURL || release.html_url || fallback);
    document.querySelectorAll('[data-asset="msi"]').forEach((node) => { node.textContent = installer?.name || 'Open release page'; });
    document.querySelectorAll('[data-asset="zip"]').forEach((node) => { node.textContent = portable?.name || 'Open release page'; });
  } catch (_) {
    text('[data-release-version], [data-version]', 'Release unavailable');
    text('[data-release-name]', 'Open GitHub Releases');
    text('[data-release-status]', 'VIEW RELEASES');
    text('[data-meta]', 'Release information unavailable');
    link('[data-release-url], [data-installer], [data-portable], [data-download="msi"], [data-download="zip"]', fallback);
  }
});
