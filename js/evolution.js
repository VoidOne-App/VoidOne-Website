async function loadEvolution(targetSelector = '#evolution-list') {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  try {
    const response = await fetch('data/evolution.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Evolution data: ${response.status}`);
    const entries = await response.json();
    target.innerHTML = entries.map((entry) => `
      <article class="timeline-item">
        <time>${entry.date}</time>
        <div><h3>${entry.title}</h3><p>${entry.description}</p></div>
      </article>`).join('');
  } catch (error) {
    target.innerHTML = '<p>Evolution data is temporarily unavailable.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => loadEvolution());
