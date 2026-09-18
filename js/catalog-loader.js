/* ==========================================================================
   CATALOG LOADER — busca o catálogo na planilha do Google Sheets
   ==========================================================================
   Não precisa mexer neste arquivo. Ele:
   1) tenta buscar as 4 abas configuradas em js/catalog-config.js;
   2) transforma cada aba em objetos no mesmo formato que o site já usa;
   3) se uma aba não estiver configurada, ou a busca falhar, ou vier
      vazia — usa os dados de reserva de js/catalog-data.js só pra
      aquela aba (as outras continuam vindo da planilha normalmente).

   window.loadCatalog() devolve uma Promise com { PORTFOLIO, TEASER_COVERS }.
   ========================================================================== */

(function () {
  const FETCH_TIMEOUT_MS = 7000;

  function sheetCsvUrl(tabName) {
    if (typeof CATALOG_SHEET_ID === "undefined" || !CATALOG_SHEET_ID || !tabName) {
      return null;
    }
    // usa o nome da aba (não precisa descobrir "gid" nenhum) — por isso é
    // importante não renomear as abas da planilha.
    return `https://docs.google.com/spreadsheets/d/${CATALOG_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }

  async function fetchText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // parser CSV simples (lida com aspas, vírgulas e quebras de linha dentro de campos)
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else if (c === "\r") {
        // ignora — o \n do CRLF fecha a linha
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1)
      .filter(r => r.some(cell => cell.trim() !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
        return obj;
      });
  }

  async function fetchTab(tabName) {
    const url = sheetCsvUrl(tabName);
    if (!url) return null;
    try {
      const text = await fetchText(url);
      const rows = parseCsv(text);
      return rows.length ? rows : null;
    } catch (err) {
      console.warn("[catálogo] não deu pra buscar a aba da planilha, usando dados de reserva.", err);
      return null;
    }
  }

  function isAtivo(v) {
    if (v === undefined || v === "") return true; // sem coluna "ativo" preenchida = mostra
    const s = String(v).trim().toLowerCase();
    // "falso" entra aqui porque, quando a coluna "ativo" é uma caixinha de
    // marcar (checkbox) numa planilha em português, o Google Sheets exporta
    // o valor como "FALSO"/"VERDADEIRO" em vez de "FALSE"/"TRUE".
    return !(s === "false" || s === "falso" || s === "não" || s === "nao" || s === "0");
  }
  function rowIsAtivo(r) { return isAtivo(r.ativo); }

  function byOrdem(a, b) {
    const na = parseFloat(a.ordem), nb = parseFloat(b.ordem);
    if (isNaN(na) && isNaN(nb)) return 0;
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  }

  // converte um link do Google Drive (de vários formatos possíveis) numa
  // URL de imagem direta. Se não reconhecer o formato, devolve como veio
  // (funciona pra URLs diretas e pra caminhos locais tipo assets/...).
  function resolveImageUrl(raw) {
    const v = (raw || "").trim();
    if (!v) return v;
    if (!/drive\.google\.com/.test(v)) return v;
    const m = v.match(/\/d\/([a-zA-Z0-9_-]{15,})/) || v.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1600`;
    return v;
  }

  function buildIdentidade(rows) {
    return rows
      .filter(rowIsAtivo)
      .sort(byOrdem)
      .map(r => ({
        slug: r.slug,
        title: r.titulo,
        category: r.categoria,
        problem: r.problema,
        solution: r.solucao,
        images: ["imagem1", "imagem2", "imagem3", "imagem4", "imagem5", "imagem6"]
          .map(k => resolveImageUrl(r[k]))
          .filter(Boolean)
      }))
      .filter(item => item.slug && item.images.length);
  }

  function buildProjetos(rows, categoria) {
    return rows
      .filter(rowIsAtivo)
      .filter(r => (r.categoria || "").trim().toLowerCase() === categoria)
      .sort(byOrdem)
      .map(r => resolveImageUrl(r.imagem))
      .filter(Boolean);
  }

  // "sites" tem uma apresentação diferente (uma peça grande por projeto,
  // com título e uma etiqueta curta) — usa as mesmas colunas "titulo" e
  // "tag" da aba projetos, só preenchidas nas linhas de categoria=sites.
  function buildSitesShowcase(rows) {
    return rows
      .filter(rowIsAtivo)
      .filter(r => (r.categoria || "").trim().toLowerCase() === "sites")
      .sort(byOrdem)
      .map(r => ({
        image: resolveImageUrl(r.imagem),
        title: r.titulo || "",
        tag: r.tag || ""
      }))
      .filter(it => it.image);
  }

  function buildCapas(rows) {
    return rows
      .filter(rowIsAtivo)
      .sort(byOrdem)
      .map(r => {
        const categoria = (r.categoria || "").trim().toLowerCase();
        const href = categoria === "identidade"
          ? `/portfolio?cat=identidade#${r.referencia}`
          : `/portfolio?cat=${categoria}`;
        return {
          image: resolveImageUrl(r.imagem),
          title: r.titulo,
          cat: r.categoria_exibida || r.categoria,
          href
        };
      })
      .filter(c => c.image);
  }

  function buildConfig(rows) {
    const map = {};
    rows.forEach(r => { if (r.chave) map[r.chave.trim()] = r.valor; });
    return map;
  }

  async function loadCatalog() {
    const tabs = typeof CATALOG_TABS !== "undefined" ? CATALOG_TABS : {};
    const [identRows, projRows, capasRows, configRows] = await Promise.all([
      fetchTab(tabs.identidade || "identidade"),
      fetchTab(tabs.projetos || "projetos"),
      fetchTab(tabs.capas || "capas"),
      fetchTab(tabs.config || "config")
    ]);

    const fallback = typeof FALLBACK_PORTFOLIO !== "undefined" ? FALLBACK_PORTFOLIO : null;
    const fallbackCovers = typeof FALLBACK_TEASER_COVERS !== "undefined" ? FALLBACK_TEASER_COVERS : [];
    const cfg = configRows ? buildConfig(configRows) : {};

    const PORTFOLIO = {
      identidade: {
        label: "Identidade visual",
        items: identRows ? buildIdentidade(identRows) : (fallback ? fallback.identidade.items : [])
      },
      sites: {
        label: "Sites & landing pages",
        intro: cfg.sites_intro || (fallback ? fallback.sites.intro : ""),
        items: projRows ? buildSitesShowcase(projRows) : (fallback ? fallback.sites.items : [])
      },
      social: {
        label: "Sistemas visuais",
        intro: cfg.social_intro || (fallback ? fallback.social.intro : ""),
        images: projRows ? buildProjetos(projRows, "social") : (fallback ? fallback.social.images : [])
      },
      outros: {
        label: "Outros",
        intro: cfg.outros_intro || (fallback ? fallback.outros.intro : ""),
        images: projRows ? buildProjetos(projRows, "outros") : (fallback ? fallback.outros.images : [])
      },
      audiovisual: {
        label: "Audiovisual",
        intro: cfg.audiovisual_intro || (fallback ? fallback.audiovisual.intro : ""),
        images: projRows ? buildProjetos(projRows, "audiovisual") : (fallback ? fallback.audiovisual.images : [])
      }
    };

    // segurança extra: se uma aba configurada voltou vazia depois de
    // filtrar (ex: nenhum "ativo"), volta pro conteúdo de reserva
    // daquela categoria em vez de deixar a seção vazia no site.
    if (fallback) {
      if (!PORTFOLIO.identidade.items.length) PORTFOLIO.identidade.items = fallback.identidade.items;
      if (!PORTFOLIO.sites.items.length) PORTFOLIO.sites.items = fallback.sites.items;
      if (!PORTFOLIO.social.images.length) PORTFOLIO.social.images = fallback.social.images;
      if (!PORTFOLIO.outros.images.length) PORTFOLIO.outros.images = fallback.outros.images;
      if (!PORTFOLIO.audiovisual.images.length) PORTFOLIO.audiovisual.images = fallback.audiovisual.images;
    }

    let TEASER_COVERS = capasRows ? buildCapas(capasRows) : fallbackCovers;
    if (!TEASER_COVERS.length) TEASER_COVERS = fallbackCovers;

    return { PORTFOLIO, TEASER_COVERS };
  }

  let cached = null;
  window.loadCatalog = function () {
    if (!cached) cached = loadCatalog();
    return cached;
  };
})();
