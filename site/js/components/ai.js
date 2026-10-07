(() => {
  const form = document.querySelector('[data-ai-form]');
  const input = document.querySelector('[data-ai-input]');
  const output = document.querySelector('[data-ai-output]');
  const status = document.querySelector('[data-ai-status]');
  const submit = document.querySelector('[data-ai-submit]');

  if (!form || !input || !output || !status || !submit) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    submit.disabled = true;
    input.disabled = true;
    status.textContent = 'THINKING';
    output.textContent = 'VoidOne AI is processing your question…';

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'AI request failed');

      output.textContent = data.response || 'No response returned.';
      status.textContent = 'ONLINE';
    } catch (error) {
      output.textContent = error instanceof Error
        ? error.message
        : 'VoidOne AI is temporarily unavailable.';
      status.textContent = 'OFFLINE';
    } finally {
      submit.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
})();
