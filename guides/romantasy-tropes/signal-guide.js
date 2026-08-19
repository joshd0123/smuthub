(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const artworkSections = [
    { element: document.querySelector('.signal-list'), property: '--list-art-y', speed: -.035, limit: 55 },
    { element: document.querySelector('.signal-next'), property: '--next-art-y', speed: -.025, limit: 42 }
  ].filter((item) => item.element);

  if (!reducedMotion && artworkSections.length) {
    let queued = false;
    const updateArtwork = () => {
      artworkSections.forEach(({ element, property, speed, limit }) => {
        const distance = Math.max(-limit, Math.min(limit, Math.round(element.getBoundingClientRect().top * speed)));
        element.style.setProperty(property, `${distance}px`);
      });
      queued = false;
    };
    const requestUpdate = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(updateArtwork);
    };
    updateArtwork();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  }

  // Section rail scroll-spy: highlight the link for whatever section is in view.
  const railLinks = [...document.querySelectorAll('.guide-rail__sections a')];
  if (railLinks.length) {
    const sections = railLinks
      .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);
    const setActive = (id) => railLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    const spy = new IntersectionObserver((entries) => {
      const inView = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (inView[0]) setActive(inView[0].target.id);
    }, { rootMargin: '-130px 0px -55% 0px', threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  const rail = document.querySelector('.signal-compare__grid');
  const previous = document.querySelector('[data-compare-prev]');
  const next = document.querySelector('[data-compare-next]');
  if (!rail || !previous || !next) return;

  const move = (direction) => {
    const page = rail.querySelector('.compare-page');
    const distance = page ? page.getBoundingClientRect().width + 16 : rail.clientWidth;
    rail.scrollBy({ left: distance * direction, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
})();
