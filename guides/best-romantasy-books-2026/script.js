(() => {
  const links = [...document.querySelectorAll('.guide-rail__sections a')];
  const fan = document.querySelector('.cover-fan');
  const books = [...document.querySelectorAll('.fan-book')];
  const verdicts = [...document.querySelectorAll('.verdict')];
  const header = document.querySelector('.site-header');

  let lastScrollY = Math.max(window.scrollY, 0);
  let headerFrame = 0;

  const showHeader = () => header?.classList.remove('is-hidden');
  const updateHeader = () => {
    const currentScrollY = Math.max(window.scrollY, 0);
    const movement = currentScrollY - lastScrollY;

    if (currentScrollY <= 24 || movement < -6) {
      showHeader();
    } else if (movement > 6 && !header?.matches(':focus-within')) {
      header?.classList.add('is-hidden');
    }

    if (Math.abs(movement) > 6 || currentScrollY <= 24) lastScrollY = currentScrollY;
    headerFrame = 0;
  };

  window.addEventListener('scroll', () => {
    if (!headerFrame) headerFrame = window.requestAnimationFrame(updateHeader);
  }, { passive: true });
  window.addEventListener('hashchange', showHeader);
  header?.addEventListener('focusin', showHeader);
  header?.querySelectorAll('.guide-rail a').forEach((link) => link.addEventListener('click', showHeader));

  const setActive = (key) => {
    fan?.classList.toggle('has-focus', Boolean(key));
    books.forEach((book) => book.classList.toggle('is-active', book.dataset.book === key));
    verdicts.forEach((verdict) => verdict.classList.toggle('is-active', verdict.dataset.book === key));
  };

  [...books, ...verdicts].forEach((item) => {
    item.addEventListener('pointerenter', () => setActive(item.dataset.book));
    item.addEventListener('pointerleave', () => setActive(null));
    item.addEventListener('focusin', () => setActive(item.dataset.book));
    item.addEventListener('focusout', () => setActive(null));
  });

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!current) return;
    links.forEach((link) => link.classList.toggle('is-active', link.hash === `#${current.target.id}`));
  }, { rootMargin: '-25% 0px -60%', threshold: [0, .2, .5] });
  links.forEach((link) => {
    const section = document.querySelector(link.hash);
    if (section) observer.observe(section);
  });
})();
