/* Command palette (Ctrl/Cmd + K): fuzzy search across pages, sections and actions. */
(() => {
  const env = window.VoidOneEnv;
  if (!env) return;

  const COPY = {
    en: {
      placeholder: 'Search pages, sections and actions…',
      label: 'Command palette',
      empty: 'No matches. Try “download”, “build” or “accent”.',
      pages: 'Pages',
      sections: 'Sections',
      actions: 'Actions',
      loading: 'Loading index…',
      failed: 'Index unavailable — use the navigation instead.',
      copied: 'Copied to clipboard',
      copyFailed: 'Clipboard unavailable',
      open: 'Open',
      run: 'Run'
    },
    fa: {
      placeholder: 'جستجو در صفحه‌ها، بخش‌ها و دستورها…',
      label: 'جستجوی فرمان',
      empty: 'موردی پیدا نشد. «دانلود» یا «ساخت» را امتحان کنید.',
      pages: 'صفحه‌ها',
      sections: 'بخش‌ها',
      actions: 'دستورها',
      loading: 'در حال بارگذاری فهرست…',
      failed: 'فهرست در دسترس نیست.',
      copied: 'در کلیپ‌بورد کپی شد',
      copyFailed: 'کلیپ‌بورد در دسترس نیست',
      open: 'باز کن',
      run: 'اجرا'
    }
  };

  const t = COPY[env.rtl ? 'fa' : 'en'] || COPY.en;
  const LABELS = env.rtl
    ? { navigate: 'پیمایش', select: 'انتخاب', deck: 'دک ویدوان' }
    : { navigate: 'NAVIGATE', select: 'SELECT', deck: 'VOIDONE DECK' };
  const GROUP_ORDER = ['page', 'section', 'action'];
  const GROUP_LABEL = { page: t.pages, section: t.sections, action: t.actions };

  let overlay = null;
  let input = null;
  let results = null;
  let entries = [];
  let visible = [];
  let cursor = 0;
  let lastFocus = null;
  let requested = false;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'palette';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="palette-dialog" role="dialog" aria-modal="true" aria-label="${t.label}">
        <div class="palette-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
          <input class="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-results"
                 aria-autocomplete="list" placeholder="${t.placeholder}" aria-label="${t.label}" autocomplete="off" spellcheck="false">
          <kbd>Esc</kbd>
        </div>
        <ul class="palette-results" id="palette-results" role="listbox" aria-label="${t.label}"></ul>
        <div class="palette-foot">
          <div><kbd>↑</kbd><kbd>↓</kbd><span>${LABELS.navigate}</span><kbd>↵</kbd><span>${LABELS.select}</span></div>
          <div><span>${LABELS.deck}</span></div>
        </div>
      </div>`;

    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close();
    });

    input = overlay.querySelector('.palette-input');
    results = overlay.querySelector('.palette-results');

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (visible[cursor]) run(visible[cursor]);
      } else if (event.key === 'Home') {
        event.preventDefault();
        move(-cursor);
      } else if (event.key === 'End') {
        event.preventDefault();
        move(visible.length - 1 - cursor);
      } else if (event.key === 'Tab') {
        event.preventDefault();
      }
    });

    results.addEventListener('click', (event) => {
      const item = event.target.closest('.palette-item');
      if (!item) return;
      run(visible[Number(item.dataset.index) || 0]);
    });

    document.body.append(overlay);
  }

  async function load() {
    if (requested) return entries;
    requested = true;
    try {
      const response = await fetch(env.url('data/search.json'), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Search index ${response.status}`);
      const data = await response.json();
      const language = env.rtl ? 'fa' : 'en';
      entries = [...(data.entries || []), ...(data.actions || [])]
        .filter((entry) => !entry.lang || entry.lang === language)
        .map((entry) => ({ ...entry, haystack: `${entry.title} ${entry.text || ''} ${entry.keywords || ''}`.toLowerCase() }));
    } catch (_) {
      entries = [];
    }
    return entries;
  }

  function score(entry, query) {
    if (!query) return entry.kind === 'page' ? 10 : 5;
    const title = entry.title.toLowerCase();
    const haystack = entry.haystack;
    if (title === query) return 1000;
    if (title.startsWith(query)) return 700;
    if (title.includes(query)) return 520;
    if (haystack.includes(query)) return 320;
    let position = 0;
    let hits = 0;
    for (const char of query) {
      const found = haystack.indexOf(char, position);
      if (found === -1) return 0;
      hits += found === position ? 2 : 1;
      position = found + 1;
    }
    return 40 + hits;
  }

  function render(query) {
    const trimmed = String(query || '').trim().toLowerCase();
    const ranked = entries
      .map((entry) => ({ entry, value: score(entry, trimmed) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 24);

    const groups = GROUP_ORDER
      .map((kind) => ({ kind, rows: ranked.filter((row) => row.entry.kind === kind) }))
      .filter((group) => group.rows.length);

    visible = [];
    results.textContent = '';

    if (!requested) {
      const pending = document.createElement('li');
      pending.className = 'palette-empty';
      pending.textContent = t.loading;
      results.append(pending);
      return;
    }

    if (!groups.length) {
      const empty = document.createElement('li');
      empty.className = 'palette-empty';
      empty.textContent = entries.length ? t.empty : t.failed;
      results.append(empty);
      return;
    }

    groups.forEach((group) => {
      const label = document.createElement('li');
      label.className = 'palette-group';
      label.setAttribute('role', 'presentation');
      label.textContent = GROUP_LABEL[group.kind] || group.kind;
      results.append(label);

      group.rows.forEach((row) => {
        const index = visible.length;
        visible.push(row.entry);
        const item = document.createElement('li');
        item.className = 'palette-item';
        item.id = `palette-option-${index}`;
        item.dataset.index = String(index);
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.innerHTML = `
          <span class="palette-kind">${group.kind}</span>
          <span><strong></strong><span></span></span>
          <kbd>${group.kind === 'action' ? t.run : t.open}</kbd>`;
        item.querySelector('strong').textContent = row.entry.title;
        item.querySelector('strong + span').textContent = row.entry.text || '';
        results.append(item);
      });
    });

    cursor = 0;
    paintCursor();
  }

  function paintCursor() {
    results.querySelectorAll('.palette-item').forEach((item) => {
      const active = Number(item.dataset.index) === cursor;
      item.setAttribute('aria-selected', String(active));
      if (active) {
        input.setAttribute('aria-activedescendant', item.id);
        const top = item.offsetTop;
        const bottom = top + item.offsetHeight;
        if (top < results.scrollTop) results.scrollTop = top - 8;
        else if (bottom > results.scrollTop + results.clientHeight) results.scrollTop = bottom - results.clientHeight + 8;
      }
    });
  }

  function move(step) {
    if (!visible.length) return;
    cursor = (cursor + step + visible.length) % visible.length;
    paintCursor();
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', 'readonly');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  function run(entry) {
    if (!entry) return;
    close();
    if (entry.action === 'copy') {
      copyText(entry.value).then((ok) => {
        if (window.VoidOneHUD) window.VoidOneHUD.toast(ok ? t.copied : t.copyFailed, 'CLIPBOARD');
      });
      return;
    }
    if (entry.action === 'accent') {
      const accent = env.cycleAccent();
      if (window.VoidOneHUD) window.VoidOneHUD.toast(accent.toUpperCase(), 'DECK');
      return;
    }
    if (entry.action === 'motion') {
      const reduced = env.toggleMotion();
      if (window.VoidOneHUD) {
        window.VoidOneHUD.toast(reduced ? 'MOTION OFF' : 'MOTION ON', 'DECK');
      }
      return;
    }
    if (entry.action === 'manifest') {
      const url = env.url('download/manifest.json');
      copyText(url).then((ok) => {
        if (window.VoidOneHUD) window.VoidOneHUD.toast(ok ? url : t.copyFailed, 'CLIPBOARD');
      });
      return;
    }
    if (/^https?:/i.test(entry.url || '')) {
      window.open(entry.url, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(env.url(entry.url || '/'));
  }

  async function open() {
    if (!overlay) build();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => overlay.classList.add('is-open'));
    input.value = '';
    render('');
    input.focus();
    const data = await load();
    if (!overlay.hidden) render(input.value);
    return data;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('voidone:palette:open', open);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();
