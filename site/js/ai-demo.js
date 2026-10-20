(() => {
  const endpoint = '/api/ai';
  const maxChars = 2000;

  function addMessage(container, role, text) {
    const item = document.createElement('article');
    item.className = 'ai-message ai-message-' + role;
    const label = document.createElement('strong');
    label.className = 'ai-message-label';
    label.textContent = role === 'user' ? 'YOU' : 'VOIDONE AI';
    const content = document.createElement('p');
    content.textContent = text;
    item.append(label, content);
    container.append(item);
    container.scrollTop = container.scrollHeight;
    return item;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-ai-form]');
    const input = document.querySelector('[data-ai-input]');
    const messages = document.querySelector('[data-ai-messages]');
    const status = document.querySelector('[data-ai-status]');
    const submit = form?.querySelector('button[type="submit"]');
    if (!form || !input || !messages || !status || !submit) return;

    document.querySelectorAll('[data-ai-prompt]').forEach((button) => {
      button.addEventListener('click', () => {
        input.value = button.dataset.aiPrompt || '';
        input.focus();
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) {
        status.textContent = 'Write a message first.';
        input.focus();
        return;
      }
      if (message.length > maxChars) {
        status.textContent = 'Please keep your message under ' + maxChars + ' characters.';
        return;
      }

      addMessage(messages, 'user', message);
      input.value = '';
      input.disabled = true;
      submit.disabled = true;
      status.textContent = 'VoidOne AI is thinking…';

      const pending = addMessage(messages, 'assistant', 'Working on your request…');
      pending.setAttribute('aria-busy', 'true');

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ message })
        });
        let payload;
        try {
          payload = await response.json();
        } catch (_) {
          payload = {};
        }
        if (!response.ok || typeof payload.response !== 'string' || !payload.response.trim()) {
          const errorText = payload.message || (
            response.status === 429
              ? 'You have reached the temporary usage limit. Please wait a few minutes.'
              : response.status === 403
                ? 'Cloudflare blocked this request. Please try again later.'
                : 'The AI service is unavailable right now. Please try again shortly.'
          );
          pending.querySelector('p').textContent = errorText;
          pending.classList.add('ai-message-error');
          status.textContent = 'Request failed (' + response.status + ').';
          return;
        }
        pending.querySelector('p').textContent = payload.response;
        status.textContent = 'Response received · ' + (payload.model || 'VoidOne AI');
      } catch (_) {
        pending.querySelector('p').textContent = 'Could not reach the AI service. Check your connection and try again.';
        pending.classList.add('ai-message-error');
        status.textContent = 'Connection error.';
      } finally {
        pending.removeAttribute('aria-busy');
        input.disabled = false;
        submit.disabled = false;
        input.focus();
        messages.scrollTop = messages.scrollHeight;
      }
    });
  });
})();