/* Renderiza a página de portfólio (filtros por categoria + lightbox)
   a partir do catálogo (planilha do Google Sheets, com fallback pros
   dados de js/catalog-data.js — veja js/catalog-loader.js). */

(async function () {
  const panels = {
    identidade: document.querySelector('[data-panel="identidade"]'),
    sites: document.querySelector('[data-panel="sites"]'),
    social: document.querySelector('[data-panel="social"]'),
    outros: document.querySelector('[data-panel="outros"]'),
    audiovisual: document.querySelector('[data-panel="audiovisual"]')
  };
  if (!panels.identidade || typeof window.loadCatalog !== 'function') return;

  const { PORTFOLIO } = await window.loadCatalog();

  // ---------- observador de reveal pros elementos injetados ----------
  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' })
    : null;

  function observeReveals(root) {
    const els = root.querySelectorAll('.reveal');
    if (io) els.forEach(el => io.observe(el));
    else els.forEach(el => el.classList.add('is-visible'));
  }

  // ---------- identidade: "como está" — problema x solução, por marca ----------
  panels.identidade.innerHTML = PORTFOLIO.identidade.items.map((c, i) => `
    <article class="caso reveal ${i % 2 === 1 ? 'alt' : ''}" id="${c.slug}">
      <div class="wrap">
        <div class="caso-head">
          <span class="caso-num">${String(i + 1).padStart(2, '0')}</span>
          <div>
            <span class="eyebrow">${c.category}</span>
            <h2>${c.title}</h2>
          </div>
        </div>
        <div class="caso-body">
          <div class="caso-text">
            <h3>Problema</h3>
            <p>${c.problem}</p>
          </div>
          <div class="caso-text">
            <h3>Solução</h3>
            <p>${c.solution}</p>
          </div>
        </div>
        <div class="caso-gallery">
          ${c.images.map(src => `
            <div class="caso-img"><img class="lb-img" data-group="identidade-${c.slug}" src="${src}" alt="${c.title}" loading="lazy"></div>
          `).join('')}
        </div>
      </div>
    </article>
  `).join('');

  // ---------- sites: uma peça grande por projeto, print da página inteira,
  // com título + etiqueta. Rola no próprio quadro — sem lightbox aqui,
  // porque a imagem é muito mais alta que larga e fica ruim ampliada. ----------
  function renderSitesShowcase() {
    const data = PORTFOLIO.sites;
    const panel = panels.sites;
    panel.innerHTML = `
      <div class="wrap">
        <p class="cat-intro reveal">${data.intro}</p>
        <div class="showcase-list">
          ${data.items.map((it, i) => `
            <article class="showcase-item reveal">
              <div class="showcase-frame">
                <img src="${it.image}" alt="${it.title}" loading="lazy">
              </div>
              <div class="showcase-caption">
                <span class="showcase-num">${String(i + 1).padStart(2, '0')}</span>
                ${it.title ? `<h3>${it.title}</h3>` : ''}
                ${it.tag ? `<span class="showcase-tag">${it.tag}</span>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
  }
  renderSitesShowcase();

  // ---------- sites: rolagem controlada pela própria pessoa (mouse/trackpad)
  // dentro do quadro, em vez de uma animação automática — assim ela decide
  // o ritmo de ver a página inteira. Quando chega no topo/fim da imagem, o
  // scroll normal da página volta a funcionar sozinho. ----------
  function initShowcaseScroll() {
    document.querySelectorAll('.showcase-frame').forEach(frame => {
      const img = frame.querySelector('img');
      let offset = 0;
      let maxOffset = 0;

      function computeMax() {
        const frameH = frame.clientHeight;
        const imgH = img.getBoundingClientRect().height || img.naturalHeight;
        maxOffset = Math.max(0, imgH - frameH);
      }
      if (img.complete) computeMax();
      img.addEventListener('load', computeMax);
      window.addEventListener('resize', computeMax);

      frame.addEventListener('wheel', (e) => {
        if (maxOffset <= 0) return;
        const goingDown = e.deltaY > 0;
        const canMove = goingDown ? offset < maxOffset : offset > 0;
        if (!canMove) return; // já chegou no limite: deixa o scroll da página seguir normal
        e.preventDefault();
        offset = Math.min(maxOffset, Math.max(0, offset + e.deltaY));
        img.style.transform = `translateY(${-offset}px)`;
      }, { passive: false });

      frame.addEventListener('mouseleave', () => {
        offset = 0;
        img.style.transform = 'translateY(0)';
      });

      // ---------- celular/tablet: arrastar o dedo faz o mesmo efeito do
      // scroll do mouse. Sem isso, quem acessa pelo celular fica preso
      // vendo só o topo da imagem, sem conseguir rolar pra ver o resto. ----------
      let touchStartY = 0;
      let touchStartOffset = 0;
      frame.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        touchStartOffset = offset;
      }, { passive: true });

      frame.addEventListener('touchmove', (e) => {
        if (maxOffset <= 0) return;
        const deltaY = touchStartY - e.touches[0].clientY; // dedo sobe = quer ver mais pra baixo
        const goingDown = deltaY > 0;
        const canMove = goingDown ? offset < maxOffset : offset > 0;
        if (!canMove) return; // já chegou no limite: deixa o scroll da página seguir normal
        e.preventDefault();
        offset = Math.min(maxOffset, Math.max(0, touchStartOffset + deltaY));
        img.style.transform = `translateY(${-offset}px)`;
      }, { passive: false });
    });
  }
  initShowcaseScroll();

  // ---------- social: lista simples, sem separar por marca ----------
  function renderFlat(panelKey) {
    const data = PORTFOLIO[panelKey];
    const panel = panels[panelKey];
    panel.innerHTML = `
      <div class="wrap">
        <p class="cat-intro reveal">${data.intro}</p>
        <div class="flat-gallery">
          ${data.images.map((src, i) => `
            <div class="caso-img reveal"><img class="lb-img" data-group="${panelKey}" src="${src}" alt="${data.label} ${i + 1}" loading="lazy"></div>
          `).join('')}
        </div>
      </div>
    `;
  }
  renderFlat('social');
  renderFlat('audiovisual');

  // ---------- outros: imagem grande, uma embaixo da outra, sem proporção fixa ----------
  const outros = PORTFOLIO.outros;
  panels.outros.innerHTML = `
    <div class="wrap">
      <p class="cat-intro reveal">${outros.intro}</p>
      <div class="outros-list">
        ${outros.images.map((src, i) => `
          <img class="lb-img reveal" data-group="outros" src="${src}" alt="Outros materiais ${i + 1}" loading="lazy">
        `).join('')}
      </div>
    </div>
  `;

  Object.values(panels).forEach(p => observeReveals(p));

  // ---------- filtros por categoria ----------
  const tabs = document.querySelectorAll('[data-filters] .filter-btn');
  function activate(cat, { scrollToHash } = {}) {
    if (!panels[cat]) cat = 'identidade';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    Object.entries(panels).forEach(([key, panel]) => {
      panel.hidden = key !== cat;
    });
    if (scrollToHash) {
      const target = document.getElementById(scrollToHash);
      if (target) {
        // espera o painel ficar visível antes de rolar até a marca
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
      }
    }
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      activate(btn.dataset.cat);
      const url = new URL(window.location.href);
      url.searchParams.set('cat', btn.dataset.cat);
      url.hash = '';
      history.replaceState(null, '', url);
    });
  });

  // estado inicial vindo da URL (?cat=identidade#jasu, por exemplo — usado
  // pelos links da prévia na home)
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get('cat') || 'identidade';
  const initialHash = window.location.hash ? window.location.hash.slice(1) : null;
  activate(initialCat, { scrollToHash: initialHash });

  // ==========================================================================
  // LIGHTBOX — clique numa imagem do portfólio pra abrir maior, com X pra
  // fechar (também fecha clicando fora ou com ESC). Setas navegam entre as
  // imagens do mesmo grupo (mesma marca / mesma categoria).
  // ==========================================================================
  const lightbox = document.querySelector('[data-lightbox]');
  const lbImg = lightbox.querySelector('.lightbox-stage img');
  const lbCount = lightbox.querySelector('.lightbox-info .count');
  const btnClose = lightbox.querySelector('.lightbox-close');
  const btnPrev = lightbox.querySelector('[data-lb-prev]');
  const btnNext = lightbox.querySelector('[data-lb-next]');

  let currentGroup = [];
  let currentIndex = 0;

  function showAt(index) {
    if (!currentGroup.length) return;
    currentIndex = (index + currentGroup.length) % currentGroup.length;
    const img = currentGroup[currentIndex];
    lbImg.src = img.src;
    lbImg.alt = img.alt || '';
    lbCount.textContent = currentGroup.length > 1 ? `${currentIndex + 1} / ${currentGroup.length}` : '';
  }

  function openLightbox(img) {
    const group = img.dataset.group || 'geral';
    currentGroup = Array.from(document.querySelectorAll(`.lb-img[data-group="${group}"]`));
    const idx = currentGroup.indexOf(img);
    showAt(idx === -1 ? 0 : idx);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.lb-img');
    if (img) { openLightbox(img); return; }
    if (e.target === lightbox) { closeLightbox(); }
  });
  btnClose.addEventListener('click', closeLightbox);
  btnPrev.addEventListener('click', () => showAt(currentIndex - 1));
  btnNext.addEventListener('click', () => showAt(currentIndex + 1));
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showAt(currentIndex - 1);
    if (e.key === 'ArrowRight') showAt(currentIndex + 1);
  });
})();
