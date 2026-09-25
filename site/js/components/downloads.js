document.addEventListener('DOMContentLoaded', async () => {
  const fallback = 'https://github.com/VoidOne-App/VoidOne/releases';
  const text = (selector, value) => document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  const link = (selector, url) => document.querySelectorAll(selector).forEach((node) => { node.href = url; });

  try {
    const response = await fetch('/download/manifest.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Download manifest ${response.status}`);
    const manifest = await response.json();
    if (!manifest.release) throw new Error('Invalid download manifest');

    const release = manifest.release;
    const installer = manifest.assets?.installer;
    const portable = manifest.assets?.portable;

    text('[data-release-version], [data-version]', release.version || 'Unknown version');
    text('[data-release-name]', release.name || release.version || 'VoidOne release');
    text('[data-release-date]', release.published_at ? new Date(release.published_at).toLocaleDateString() : 'Date unavailable');
    text('[data-release-status]', release.prerelease ? 'PRE-RELEASE' : 'LATEST STABLE');
    text('[data-meta]', `${release.name || release.version || 'VoidOne release'} · ${release.prerelease ? 'Pre-release' : 'Stable'}`);

    link('[data-release-url]', release.notes_url || fallback);
    link('[data-download="msi"], [data-installer]', installer?.url || release.notes_url || fallback);
    link('[data-download="zip"], [data-portable]', portable?.url || release.notes_url || fallback);

    document.querySelectorAll('[data-asset="msi"]').forEach((node) => {
      node.textContent = installer?.filename || 'Open release page';
    });
    document.querySelectorAll('[data-asset="zip"]').forEach((node) => {
      node.textContent = portable?.filename || 'Open release page';
    });
  } catch (_) {
    text('[data-release-version], [data-version]', 'Release unavailable');
    text('[data-release-name]', 'Open GitHub Releases');
    text('[data-release-status]', 'VIEW RELEASES');
    text('[data-meta]', 'Release information unavailable');
    link('[data-release-url], [data-installer], [data-portable], [data-download="msi"], [data-download="zip"]', fallback);
  } finally {
    document.querySelectorAll('[data-release-panel]').forEach((node) => node.removeAttribute('data-loading'));
  }
});
