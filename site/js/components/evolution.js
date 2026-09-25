/* Evolution timeline rendered from data/evolution.json with status filters. */
(() => {
  const env = window.VoidOneEnv;
  const target = document.querySelector('#evolution-list');
  if (!env || !target) return;

  const COPY = {
    en: {
      all: 'All',
      shipped: 'Shipped',
      active: 'Active',
      next: 'Next',
      filterLabel: 'Filter evolution milestones',
      unavailable: 'Evolution data is temporarily unavailable. The repository remains the source of truth.'
    },
    fa: {
      all: 'همه',
      shipped: 'منتشر شده',
      active: 'در حال انجام',
      next: 'بعدی',
      filterLabel: 'فیلتر نقاط عطف',
      unavailable: 'داده‌های مسیر پروژه موقتاً در دسترس نیست؛ مخزن مرجع اصلی است.'
    }
  };

  const t = COPY[env.rtl ? 'fa' : 'en'] || COPY.en;
  const STATUSES = ['shipped', 'active', 'next'];
  const countFormat = new Intl.NumberFormat(env.rtl ? 'fa-IR' : 'en-US');

  const formatDate = (value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(`${value}T00:00:00Z`);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat(env.rtl ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }).format(date);
      }
    }
    return value;
  };

  function render(entries) {
    target.textContent = '';
    const ordered = entries.slice().reverse();

    ordered.forEach((entry) => {
      const item = document.createElement('article');
      item.className = 'timeline-item';
      item.dataset.status = entry.status || 'shipped';

      const time = document.createElement('time');
      time.textContent = formatDate(entry.date || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) time.dateTime = entry.date;

      const body = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = entry.title || '';
      const text = document.createElement('p');
      text.textContent = entry.description || '';
      body.append(heading, text);

      if (entry.tag) {
        const tag = document.createElement('span');
        tag.className = 'timeline-tag';
        tag.textContent = entry.tag;
        body.append(tag);
      }

      item.append(time, body);
      target.append(item);
    });

    reveal(ordered.length);
  }

  function reveal() {
    const items = target.querySelectorAll('.timeline-item');
    if (env.reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        instance.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    items.forEach((item) => observer.observe(item));
  }

  function buildFilters(entries) {
    const wrap = document.createElement('div');
    wrap.className = 'timeline-filters';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', t.filterLabel);

    const counts = { all: entries.length, shipped: 0, active: 0, next: 0 };
    entries.forEach((entry) => {
      const status = counts[entry.status] === undefined ? 'shipped' : entry.status;
      counts[status] += 1;
    });

    const options = [{ id: 'all', label: t.all }, ...STATUSES.map((status) => ({ id: status, label: t[status] }))];

    const buttons = options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = option.id;
      button.setAttribute('aria-pressed', String(option.id === 'all'));
      button.textContent = `${option.label} · ${countFormat.format(counts[option.id] || 0)}`;
      button.addEventListener('click', () => {
        buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        apply(option.id);
      });
      wrap.append(button);
      return button;
    });

    target.before(wrap);
  }

  function apply(filter) {
    target.querySelectorAll('.timeline-item').forEach((item) => {
      const match = filter === 'all' || item.dataset.status === filter;
      if (match) item.removeAttribute('data-hidden');
      else item.setAttribute('data-hidden', '');
    });
  }

  fetch(env.url('data/evolution.json'), { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Evolution ${response.status}`);
      return response.json();
    })
    .then((entries) => {
      if (!Array.isArray(entries) || !entries.length) throw new Error('Empty evolution dataset');
      render(entries);
      buildFilters(entries);
    })
    .catch(() => {
      target.textContent = '';
      const fallback = document.createElement('p');
      fallback.textContent = t.unavailable;
      target.append(fallback);
    });
})();
