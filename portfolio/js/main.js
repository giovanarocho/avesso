// ---------- menu mobile ----------
const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.querySelector('.main-nav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    document.body.classList.toggle('nav-open', mainNav.classList.contains('open'));
  });
  mainNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mainNav.classList.remove('open');
      document.body.classList.remove('nav-open');
    });
  });
}

// ---------- reveal on scroll ----------
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && revealEls.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}

// ---------- teaser grid (home) ----------
const teaserGrid = document.querySelector('[data-teaser]');
if (teaserGrid && typeof window.loadCatalog === 'function') {
  window.loadCatalog().then(({ TEASER_COVERS }) => {
    teaserGrid.innerHTML = TEASER_COVERS.map(item => `
      <a class="card reveal" href="${item.href}">
        <div class="thumb">
          <img src="${item.image}" alt="${item.title}" loading="lazy">
        </div>
        <div class="meta">
          <span class="cat">${item.cat}</span>
          <h3>${item.title}</h3>
        </div>
      </a>
    `).join('');

    // re-observe the freshly injected cards
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io2.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      teaserGrid.querySelectorAll('.reveal').forEach(el => io2.observe(el));
    } else {
      teaserGrid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    }
  });
}
