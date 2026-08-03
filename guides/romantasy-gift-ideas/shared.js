(() => {
  const toast = document.querySelector('[data-toast]');
  let toastTimer;

  function announce(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  document.querySelectorAll('[data-save]').forEach((button) => {
    button.addEventListener('click', async () => {
      const anchor = button.dataset.save || 'five-clues';
      const url = `${location.href.split('#')[0]}#${anchor}`;
      try {
        await navigator.clipboard.writeText(url);
        announce('Guide link copied — bookmark or add it to your home screen.');
      } catch {
        location.hash = anchor;
        announce('This section is ready to bookmark.');
      }
      button.classList.add('is-saved');
      const label = button.querySelector('[data-save-label]');
      if (label) label.textContent = 'Return link copied';
    });
  });

  document.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  document.querySelectorAll('[data-copy-list]').forEach((button) => {
    button.addEventListener('click', async () => {
      const text = 'Romantasy gift clues:\n□ Favorite series or author\n□ Reading format/device\n□ Reader, collector, or both\n□ Favorite character/world\n□ Useful, sentimental, collectible, experience, or choice';
      try { await navigator.clipboard.writeText(text); announce('Five-clue checklist copied.'); }
      catch { announce('Use Download cheat sheet to save the checklist.'); }
    });
  });

  document.querySelectorAll('[data-path]').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.closest('[data-paths]');
      group?.querySelectorAll('[data-path]').forEach((item) => {
        item.classList.toggle('is-active', item === button);
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      const target = document.querySelector(`[data-result="${button.dataset.path}"]`);
      document.querySelectorAll('[data-result]').forEach((result) => result.hidden = result !== target);
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  document.querySelectorAll('[data-term]').forEach((button) => {
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });
  });

  document.querySelectorAll('[data-check]').forEach((item) => {
    item.addEventListener('click', () => item.classList.toggle('is-checked'));
  });
})();
