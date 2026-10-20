function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderInfo(out, message) {
  out.replaceChildren(
    element('span', 'dim', '[INFO]'),
    document.createTextNode(' ' + message)
  );
}

function renderError(out, message) {
  out.replaceChildren(
    element('span', 'dim', '[ERROR]'),
    document.createTextNode(' ' + message)
  );
}

async function verifyFile(file, out) {
  out.replaceChildren(
    element('span', 'dim', '[HASH]'),
    document.createTextNode(' Computing SHA-256 locally…')
  );

  if (!globalThis.crypto?.subtle) {
    renderError(out, 'This browser does not expose Web Crypto in the current context.');
    return;
  }

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const actualHash = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  const response = await fetch('/download/manifest.json', {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Release manifest returned HTTP ' + response.status + '.');

  const manifest = await response.json();
  if (manifest?.schema !== 2 || !manifest.platforms) {
    throw new Error('The release manifest is missing a valid SHA-256 contract.');
  }

  const assets = Object.values(manifest.platforms)
    .flatMap(platform => [platform?.installer, platform?.portable])
    .filter(Boolean);
  const asset = assets.find(item => item.filename === file.name);
  const expectedHash = typeof asset?.sha256 === 'string' ? asset.sha256.trim() : '';

  if (!asset || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    renderInfo(out, 'No published SHA-256 is available for this exact filename. No verification claim was made.');
    return;
  }

  const matches = actualHash.toLowerCase() === expectedHash.toLowerCase();
  out.replaceChildren(
    element('span', matches ? 'ok' : 'dim', matches ? '[VERIFIED]' : '[MISMATCH]'),
    document.createTextNode(' ' + actualHash),
    document.createElement('br'),
    element('span', 'dim', 'Expected:'),
    document.createTextNode(' ' + expectedHash)
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#file');
  const button = document.querySelector('#go');
  const output = document.querySelector('#out');
  if (!input || !button || !output) return;

  button.addEventListener('click', async () => {
    const file = input.files?.[0];
    if (!file) {
      renderInfo(output, 'Select a file first.');
      input.focus();
      return;
    }

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Verifying…';
    try {
      await verifyFile(file, output);
    } catch (_) {
      renderError(output, 'Verification could not complete. Check the connection and try again.');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
});
