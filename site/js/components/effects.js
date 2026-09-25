/* Motion layer: particle field, pointer tilt, glitch text, counters and typing loops. */
(() => {
  const env = window.VoidOneEnv;
  if (!env) return;

  const reduce = () => env.reducedMotion;
  const accentColor = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim();
    return value || '#00eaff';
  };

  const hexToRgb = (value) => {
    const hex = value.replace('#', '').trim();
    const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
    const int = parseInt(full, 16);
    if (Number.isNaN(int)) return { r: 0, g: 234, b: 255 };
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  };

  /* ---------- particle field ---------- */
  const fields = [];

  function createField(canvas) {
    const context = canvas.getContext('2d');
    if (!context) return null;

    const state = { nodes: [], width: 0, height: 0, dpr: 1, raf: 0, pointer: { x: 0.5, y: 0.5 }, active: true, visible: true };

    const seed = () => {
      const area = state.width * state.height;
      const count = Math.max(26, Math.min(90, Math.round(area / 15000)));
      state.nodes = Array.from({ length: count }, () => ({
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.5 + 0.7
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      state.dpr = Math.min(2, window.devicePixelRatio || 1);
      state.width = Math.max(1, Math.round(rect.width));
      state.height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      seed();
    };

    const draw = () => {
      const rgb = hexToRgb(accentColor());
      const stroke = `rgba(${rgb.r},${rgb.g},${rgb.b},`;
      context.clearRect(0, 0, state.width, state.height);
      const link = Math.min(150, Math.max(90, state.width / 8));

      for (let i = 0; i < state.nodes.length; i += 1) {
        const node = state.nodes[i];
        for (let j = i + 1; j < state.nodes.length; j += 1) {
          const other = state.nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance < link) {
            context.strokeStyle = `${stroke}${(0.14 * (1 - distance / link)).toFixed(3)})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(node.x, node.y);
            context.lineTo(other.x, other.y);
            context.stroke();
          }
        }
      }

      state.nodes.forEach((node) => {
        context.fillStyle = `${stroke}0.55)`;
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fill();
      });
    };

    const step = () => {
      const offsetX = (state.pointer.x - 0.5) * 14;
      const offsetY = (state.pointer.y - 0.5) * 10;
      state.nodes.forEach((node) => {
        node.x += node.vx + offsetX * 0.004;
        node.y += node.vy + offsetY * 0.004;
        if (node.x < -20) node.x = state.width + 20;
        if (node.x > state.width + 20) node.x = -20;
        if (node.y < -20) node.y = state.height + 20;
        if (node.y > state.height + 20) node.y = -20;
      });
      draw();
      state.raf = window.requestAnimationFrame(step);
    };

    const stop = () => {
      state.active = false;
      window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    };

    const start = () => {
      if (state.active && !state.raf && state.visible && !document.hidden && !reduce()) {
        state.raf = window.requestAnimationFrame(step);
      }
    };

    resize();

    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else window.addEventListener('resize', resize);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        state.visible = entries[0].isIntersecting;
        if (state.visible) start();
        else stop();
      }, { threshold: 0.02 }).observe(canvas);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });

    const host = canvas.parentElement || canvas;
    host.addEventListener('pointermove', (event) => {
      const rect = host.getBoundingClientRect();
      state.pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      state.pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    }, { passive: true });

    const refresh = () => {
      stop();
      resize();
      draw();
      start();
    };

    env.on('voidone:accent', () => {
      draw();
    });
    env.on('voidone:motion', () => {
      if (reduce()) {
        stop();
        draw();
      } else refresh();
    });

    draw();
    start();
    return { refresh };
  }

  document.querySelectorAll('[data-fx-canvas]').forEach((canvas) => {
    const field = createField(canvas);
    if (field) fields.push(field);
  });

  /* ---------- pointer tilt ---------- */
  const finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)').matches : false;

  if (finePointer) {
    document.querySelectorAll('[data-fx="tilt"]').forEach((card) => {
      card.classList.add('tilt');
      let frame = 0;
      const reset = () => {
        window.cancelAnimationFrame(frame);
        card.classList.remove('is-tilting');
        card.style.transform = '';
        card.style.boxShadow = '';
      };
      card.addEventListener('pointermove', (event) => {
        if (reduce()) return;
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          card.classList.add('is-tilting');
          card.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-3px)`;
          card.style.boxShadow = `0 26px 60px rgba(0,0,0,.42), 0 0 34px rgba(var(--accent-rgb),.12)`;
        });
      });
      card.addEventListener('pointerleave', reset);
      card.addEventListener('blur', reset);
    });
  }

  /* ---------- glitch text ---------- */
  document.querySelectorAll('[data-fx="glitch"]').forEach((node) => {
    node.classList.add('glitch');
    if (!node.dataset.text) node.dataset.text = node.textContent.trim();
    const pulse = () => {
      if (reduce() || document.hidden) return;
      node.classList.add('is-glitching');
      window.setTimeout(() => node.classList.remove('is-glitching'), 460);
    };
    node.addEventListener('pointerenter', pulse);
    const delay = 4200 + Math.random() * 5200;
    window.setInterval(pulse, delay);
  });

  /* ---------- counters ---------- */
  const counters = document.querySelectorAll('[data-count-to]');

  function runCounter(node) {
    const target = Number(node.dataset.countTo);
    if (Number.isNaN(target)) return;
    if (reduce()) {
      node.textContent = String(target);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(tick);
      else node.textContent = String(target);
    };
    window.requestAnimationFrame(tick);
  }

  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
    } else {
      const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          instance.unobserve(entry.target);
        });
      }, { threshold: 0.4 });
      counters.forEach((node) => observer.observe(node));
    }
  }

  /* ---------- typing loop ---------- */
  document.querySelectorAll('[data-fx="type"]').forEach((node) => {
    const words = String(node.dataset.words || '').split('|').filter(Boolean);
    if (!words.length) return;
    if (reduce()) {
      node.textContent = words[0];
      return;
    }
    node.classList.add('typing');
    let word = 0;
    let char = 0;
    let removing = false;
    const loop = () => {
      const current = words[word % words.length];
      if (removing) {
        char -= 1;
        node.textContent = current.slice(0, char);
        if (char <= 0) {
          removing = false;
          word += 1;
        }
        window.setTimeout(loop, 55);
        return;
      }
      char += 1;
      node.textContent = current.slice(0, char);
      if (char >= current.length) {
        removing = true;
        window.setTimeout(loop, 1800);
        return;
      }
      window.setTimeout(loop, 85);
    };
    window.setTimeout(loop, 600);
  });
})();
