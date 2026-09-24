// afetue · painel do admin
const $ = (s, el = document) => el.querySelector(s);
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const hora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const PLANO = { kit: "Só o kit", kit_livro: "Kit + livro" };
const PAG = { pago: "Pago", pendente: "Pendente", cancelado: "Cancelado", reembolsado: "Reembolsado" };
const LIVRO = {
  aguardando: "Aguardando envio",
  enviado: "Recebido",
  em_producao: "Em produção",
  na_grafica: "Encadernando",
  entregue: "Entregue",
};

let senha = "";
let demo = false;
let pedidos = [];
let turma = {};
let filtro = "pagos";
let busca = "";

// ---------------- chamadas ----------------
async function api(metodo, params = {}) {
  const opts = { method: metodo, headers: { "x-admin-senha": senha } };
  let url = "/api/admin";
  if (metodo === "GET") url += "?" + new URLSearchParams(params);
  else {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(params);
  }
  const r = await fetch(url, opts);
  const tipo = r.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) throw Object.assign(new Error("sem servidor"), { semServidor: true });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.erro || "Erro"), { status: r.status });
  return j;
}

// ---------------- login ----------------
function lembrar(s) {
  try { s ? sessionStorage.setItem("afetue-admin", s) : sessionStorage.removeItem("afetue-admin"); } catch {}
}
function lembrado() {
  try { return sessionStorage.getItem("afetue-admin") || ""; } catch { return ""; }
}

async function entrar(s) {
  senha = s;
  try {
    const j = await api("GET", { acao: "lista" });
    pedidos = j.pedidos;
    turma = j.turma;
    lembrar(s);
  } catch (e) {
    if (e.semServidor) {
      demo = true;
      ({ pedidos, turma } = exemplo());
    } else {
      lembrar("");
      throw e;
    }
  }
  $("#login").hidden = true;
  $("#painel").hidden = false;
  $("#sair").hidden = false;
  $("#aviso-demo").hidden = !demo;
  desenhar();
}

$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#login-msg");
  msg.hidden = true;
  try {
    await entrar($("#senha").value);
  } catch (err) {
    msg.className = "erro";
    msg.textContent = err.status === 401 ? "Senha incorreta." : err.message;
    msg.hidden = false;
  }
});
$("#sair").addEventListener("click", () => {
  lembrar("");
  location.reload();
});

// ---------------- resumo ----------------
function tile(rotulo, valor, sub, alerta) {
  const d = document.createElement("div");
  d.className = "tile" + (alerta ? " alerta" : "");
  d.append(Object.assign(document.createElement("span"), { textContent: rotulo }));
  d.append(Object.assign(document.createElement("strong"), { textContent: valor }));
  if (sub) d.append(Object.assign(document.createElement("small"), { textContent: sub }));
  return d;
}

function desenharResumo() {
  const pagos = pedidos.filter((p) => p.status === "pago");
  const livros = pagos.filter((p) => p.plano === "kit_livro");
  const recebidos = livros.filter((p) => p.envio_status !== "aguardando");
  const aguardando = livros.length - recebidos.length;
  const fat = pagos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const t = $("#tiles");
  t.replaceChildren(
    tile("Vendas pagas", String(pagos.length), `${pagos.length - livros.length} só kit · ${livros.length} kit + livro`),
    tile("Faturamento", brl(fat), `${turma.nome || ""} · ${turma.aberta === false ? "inscrições fechadas" : "inscrições abertas"}`),
    tile("Livros vendidos", `${livros.length}/${turma.vagasTotal ?? "?"}`, `${Math.max(0, (turma.vagasTotal || 0) - livros.length)} vagas restantes`),
    tile("Livros recebidos", String(recebidos.length), "prontos pra diagramar"),
    tile("Aguardando envio", String(aguardando), "famílias ainda fazendo a oficina", aguardando > 0)
  );
}

// ---------------- filtros ----------------
const FILTROS = [
  ["pagos", "Todos pagos", (p) => p.status === "pago"],
  ["kit", "Só kit", (p) => p.status === "pago" && p.plano === "kit"],
  ["livro", "Kit + livro", (p) => p.status === "pago" && p.plano === "kit_livro"],
  ["aguardando", "Aguardando envio", (p) => p.status === "pago" && p.plano === "kit_livro" && p.envio_status === "aguardando"],
  ["recebidos", "Recebidos", (p) => p.plano === "kit_livro" && ["enviado", "em_producao", "na_grafica"].includes(p.envio_status)],
  ["entregues", "Entregues", (p) => p.envio_status === "entregue"],
  ["naopagos", "Não pagos", (p) => p.status !== "pago"],
];

function desenharChips() {
  const c = $("#chips");
  c.replaceChildren(
    ...FILTROS.map(([id, nome, fn]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("aria-pressed", String(filtro === id));
      b.append(nome, Object.assign(document.createElement("b"), { textContent: pedidos.filter(fn).length }));
      b.addEventListener("click", () => {
        filtro = id;
        desenhar();
      });
      return b;
    })
  );
}

function visiveis() {
  const fn = FILTROS.find((f) => f[0] === filtro)[2];
  const q = busca.trim().toLowerCase();
  return pedidos.filter(fn).filter((p) =>
    !q || [p.nome, p.email, p.envio?.titulo, p.envio?.autor].some((v) => String(v || "").toLowerCase().includes(q))
  );
}

$("#busca").addEventListener("input", (e) => {
  busca = e.target.value;
  desenharTabela();
});

// ---------------- tabela ----------------
function pill(txt, cls) {
  return Object.assign(document.createElement("span"), { className: "pill " + cls, textContent: txt });
}
function celula(...conteudo) {
  const td = document.createElement("td");
  td.append(...conteudo);
  return td;
}

function desenharTabela() {
  const lista = visiveis();
  $("#vazio").hidden = lista.length > 0;
  $("#linhas").replaceChildren(
    ...lista.map((p) => {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      const nome = document.createElement("span");
      nome.textContent = p.nome;
      const email = Object.assign(document.createElement("span"), { className: "sub", textContent: p.email });
      const titulo = p.envio ? Object.assign(document.createElement("span"), { className: "sub", textContent: `“${p.envio.titulo}”` }) : "";
      const livro =
        p.plano === "kit_livro"
          ? pill(LIVRO[p.envio_status] || p.envio_status, "l-" + p.envio_status)
          : pill("—", "l-nenhum");
      tr.append(
        Object.assign(celula(data(p.criado_em)), { className: "num" }),
        celula(nome, email),
        celula(PLANO[p.plano] || p.plano),
        Object.assign(celula(brl(p.valor)), { className: "num" }),
        celula(pill(PAG[p.status] || p.status, "p-" + p.status)),
        celula(livro, titulo)
      );
      const abrir = () => abrirDetalhe(p);
      tr.addEventListener("click", abrir);
      tr.addEventListener("keydown", (e) => e.key === "Enter" && abrir());
      return tr;
    })
  );
}

function desenhar() {
  desenharResumo();
  desenharChips();
  desenharTabela();
}

// ---------------- detalhe ----------------
const dlg = $("#detalhe");
dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());

function el(tag, props = {}, ...filhos) {
  const { dataset, ...resto } = props;
  const e = Object.assign(document.createElement(tag), resto);
  if (dataset) Object.entries(dataset).forEach(([k, v]) => v != null && (e.dataset[k] = v));
  e.append(...filhos.filter((f) => f !== null && f !== undefined && f !== ""));
  return e;
}
function campo(rotulo, valor) {
  return el("div", {}, el("span", { textContent: rotulo }), el("strong", { textContent: valor || "—", style: "font-weight:500" }));
}
function copiar(botao, texto) {
  const ok = () => {
    const antes = botao.textContent;
    botao.textContent = "Copiado!";
    setTimeout(() => (botao.textContent = antes), 1500);
  };
  navigator.clipboard?.writeText(texto).then(ok, () => prompt("Copie:", texto));
}

async function abrirDetalhe(p) {
  const c = $("#d-corpo");
  const e = p.envio;
  c.replaceChildren(
    el("header", {},
      el("div", { style: "display:grid;gap:6px" },
        el("p", { className: "eyebrow", textContent: `${PLANO[p.plano]} · ${hora(p.criado_em)}` }),
        el("h2", { id: "d-titulo", textContent: e ? `“${e.titulo}”` : p.nome })
      ),
      el("button", { className: "fechar-d", type: "button", ariaLabel: "Fechar", textContent: "×", onclick: () => dlg.close() })
    ),
    compradorBox(p),
    e ? livroBox(p, e) : p.plano === "kit_livro" && p.status === "pago" ? el("div", { className: "aviso", textContent: "Esta família ainda não enviou o livro." }) : ""
  );
  dlg.showModal();
  if (e && !e.fotos_apagadas_em) carregarFotos(p, e);
}

function compradorBox(p) {
  const box = el("section", { className: "caixa" }, el("h3", { textContent: "Compra" }));
  box.append(
    el("div", { className: "grade" },
      campo("Cliente", p.nome),
      campo("E-mail", p.email),
      campo("Valor", brl(p.valor)),
      campo("Pagamento", `${PAG[p.status] || p.status}${p.pago_em ? " em " + hora(p.pago_em) : ""}`),
      campo("Turma", p.turma),
      campo("Nº Mercado Pago", p.mp_pagamento)
    )
  );
  const acoes = el("div", { className: "acoes-d" });
  if (p.link_envio) {
    const b = el("button", { className: "btn linha", type: "button", textContent: "Copiar link de envio" });
    b.onclick = () => copiar(b, p.link_envio);
    acoes.append(b);
  }
  if (p.status === "pago") {
    const b = el("button", { className: "btn linha", type: "button", textContent: "Reenviar e-mail da compra" });
    b.onclick = async () => {
      b.disabled = true;
      try {
        if (!demo) await api("POST", { acao: "reenviar-email", pedido: p.id });
        b.textContent = "E-mail reenviado";
      } catch (err) {
        b.textContent = err.message;
        b.disabled = false;
      }
    };
    acoes.append(b);
  }
  if (acoes.children.length) box.append(acoes);
  return box;
}

function livroBox(p, e) {
  const box = el("section", { className: "caixa" }, el("h3", { textContent: "O livro" }));
  box.append(
    el("div", { className: "grade" },
      campo("Autor", `${e.autor}${e.idade ? `, ${e.idade} anos` : ""}`),
      campo("Com a ajuda de", e.com_ajuda_de),
      campo("Recebido em", hora(e.criado_em)),
      campo("Páginas de história", String(e.paginas?.length || 0))
    )
  );

  // status + ações
  const sel = el("select", { ariaLabel: "Andamento do livro" },
    ...Object.entries(LIVRO).map(([v, t]) => el("option", { value: v, textContent: t, selected: v === p.envio_status })));
  const salvar = el("button", { className: "btn", type: "button", textContent: "Salvar andamento" });
  salvar.onclick = async () => {
    salvar.disabled = true;
    try {
      if (!demo) await api("POST", { acao: "status", pedido: p.id, envio_status: sel.value });
      p.envio_status = sel.value;
      desenhar();
      salvar.textContent = "Salvo";
      setTimeout(() => ((salvar.textContent = "Salvar andamento"), (salvar.disabled = false)), 1500);
    } catch (err) {
      salvar.textContent = err.message;
      salvar.disabled = false;
    }
  };
  box.append(el("div", { className: "acoes-d" }, sel, salvar));

  // páginas especiais
  box.append(
    el("div", { className: "especiais" },
      el("div", { className: "pag" }, el("b", { textContent: "Capa" }), el("a", { className: "img", dataset: { path: e.capa_path } })),
      el("div", { className: "pag" }, el("b", { textContent: "Dedicatória · p. 2" }),
        e.dedicatoria_path ? el("a", { className: "img", dataset: { path: e.dedicatoria_path } }) : "",
        el("p", { textContent: e.dedicatoria })),
      el("div", { className: "pag" }, el("b", { textContent: "Sobre o autor · p. 19" }),
        el("a", { className: "img", dataset: { path: e.autor_foto_path } }),
        el("p", { textContent: e.sobre_autor }))
    )
  );

  // história
  box.append(
    el("h3", { textContent: "A história" }),
    el("div", { className: "paginas" },
      ...(e.paginas || []).map((pg) =>
        el("div", { className: "pag" },
          el("b", { textContent: `Página ${pg.n} · p. ${pg.n + 2}` }),
          el("a", { className: "img", dataset: { path: pg.arquivo } }),
          el("p", { textContent: pg.texto || "(sem texto)" })
        )
      )
    )
  );

  // entrega
  const en = e.entrega || {};
  const endereco = `${en.destinatario}\n${en.rua}, ${en.numero}${en.complemento ? " – " + en.complemento : ""}\n${en.bairro} · ${en.cidade}/${en.uf}\nCEP ${en.cep}\nTel. ${en.telefone}`;
  const copiarEnd = el("button", { className: "btn linha", type: "button", textContent: "Copiar endereço" });
  copiarEnd.onclick = () => copiar(copiarEnd, endereco);
  box.append(el("h3", { textContent: "Entrega" }), el("p", { className: "endereco", textContent: endereco }), el("div", { className: "acoes-d" }, copiarEnd));

  // fotos
  const fotos = el("div", { className: "acoes-d" });
  if (e.fotos_apagadas_em) {
    fotos.append(el("p", { className: "nota", textContent: `Fotos apagadas em ${hora(e.fotos_apagadas_em)}.` }));
  } else {
    const zip = el("button", { className: "btn", type: "button", textContent: "Baixar todas as fotos (.zip)" });
    zip.onclick = () => baixarZip(p, e, zip);
    const apagar = el("button", { className: "btn linha", type: "button", textContent: "Apagar fotos" });
    let confirmando = false;
    apagar.onclick = async () => {
      if (!confirmando) {
        confirmando = true;
        apagar.textContent = "Confirmar: apagar para sempre";
        apagar.style.color = "var(--vinho)";
        apagar.style.boxShadow = "inset 0 0 0 1.5px var(--vinho)";
        setTimeout(() => {
          if (confirmando) { confirmando = false; apagar.textContent = "Apagar fotos"; apagar.style = ""; }
        }, 5000);
        return;
      }
      confirmando = false;
      apagar.disabled = true;
      try {
        if (!demo) await api("POST", { acao: "apagar-fotos", pedido: p.id });
        e.fotos_apagadas_em = new Date().toISOString();
        abrirDetalhe(p);
      } catch (err) {
        apagar.textContent = err.message;
        apagar.disabled = false;
      }
    };
    fotos.append(zip, apagar);
  }
  box.append(el("h3", { textContent: "Fotos" }), fotos,
    el("p", { className: "nota", textContent: "Apague depois que o livro for impresso: o site promete isso às famílias." }));
  return box;
}

let urlsAtuais = {};
async function carregarFotos(p, e) {
  try {
    urlsAtuais = demo ? exemploFotos(e) : (await api("GET", { acao: "fotos", pedido: p.id })).urls;
  } catch {
    urlsAtuais = {};
  }
  document.querySelectorAll("#d-corpo a.img").forEach((a) => {
    const u = urlsAtuais[a.dataset.path];
    if (u) {
      a.style.backgroundImage = `url("${u}")`;
      a.href = u;
      a.target = "_blank";
      a.rel = "noopener";
    }
  });
}

async function baixarZip(p, e, botao) {
  if (!window.JSZip) return (botao.textContent = "Não carregou o compactador. Recarregue a página.");
  botao.disabled = true;
  const nomes = [
    [e.capa_path, "00-capa"],
    [e.dedicatoria_path, "02-dedicatoria"],
    ...(e.paginas || []).map((pg) => [pg.arquivo, `${String(pg.n + 2).padStart(2, "0")}-pagina-${pg.n}`]),
    [e.autor_foto_path, "19-sobre-o-autor"],
  ].filter(([c]) => c && urlsAtuais[c]);
  const zip = new JSZip();
  let i = 0;
  for (const [c, nome] of nomes) {
    botao.textContent = `Baixando ${++i} de ${nomes.length}…`;
    const blob = await (await fetch(urlsAtuais[c])).blob();
    zip.file(nome + "." + (c.split(".").pop() || "jpg"), blob);
  }
  zip.file("textos.txt",
    `${e.titulo}\npor ${e.autor}${e.idade ? `, ${e.idade} anos` : ""}${e.com_ajuda_de ? `\ncom a ajuda de ${e.com_ajuda_de}` : ""}\n\nDEDICATÓRIA\n${e.dedicatoria}\n\n` +
    (e.paginas || []).map((pg) => `PÁGINA ${pg.n} (p. ${pg.n + 2})\n${pg.texto}`).join("\n\n") +
    `\n\nSOBRE O AUTOR\n${e.sobre_autor}\n`);
  const blob = await zip.generateAsync({ type: "blob" });
  baixar(blob, `${slug(e.titulo)}-${slug(e.autor)}.zip`);
  botao.textContent = "Baixar todas as fotos (.zip)";
  botao.disabled = false;
}

const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function baixar(blob, nome) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------- planilha ----------------
$("#csv").addEventListener("click", () => {
  const cab = ["data", "nome", "email", "plano", "valor", "pagamento", "livro", "titulo", "autor", "cidade", "uf"];
  const linhas = visiveis().map((p) => [
    hora(p.criado_em), p.nome, p.email, PLANO[p.plano], String(p.valor).replace(".", ","), PAG[p.status],
    p.plano === "kit_livro" ? LIVRO[p.envio_status] : "", p.envio?.titulo, p.envio?.autor, p.envio?.entrega?.cidade, p.envio?.entrega?.uf,
  ]);
  const csv = [cab, ...linhas].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  baixar(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `afetue-pedidos-${new Date().toISOString().slice(0, 10)}.csv`);
});

// ---------------- preços e turma ----------------
const dlgCfg = $("#config");
const formCfg = $("#form-config");
const numBR = (v) => (v == null || isNaN(v) ? "" : Number(v).toFixed(2).replace(".", ","));
$("#abrir-config").addEventListener("click", () => {
  formCfg.precoKit.value = numBR(turma.precoKit);
  formCfg.precoKitLivro.value = numBR(turma.precoKitLivro);
  formCfg.vagasTotal.value = turma.vagasTotal ?? 15;
  formCfg.inscricoesAte.value = turma.inscricoesAte || "";
  formCfg.nome.value = turma.nome || "";
  formCfg.aberta.checked = turma.aberta !== false;
  $("#cfg-msg").hidden = true;
  dlgCfg.showModal();
});
dlgCfg.querySelector(".fechar").addEventListener("click", () => dlgCfg.close());
formCfg.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#cfg-msg");
  const botao = formCfg.querySelector("button[type=submit]");
  const config = {
    precoKit: formCfg.precoKit.value,
    precoKitLivro: formCfg.precoKitLivro.value,
    vagasTotal: formCfg.vagasTotal.value,
    inscricoesAte: formCfg.inscricoesAte.value,
    nome: formCfg.nome.value,
    aberta: formCfg.aberta.checked,
  };
  botao.disabled = true;
  try {
    if (demo) {
      const n = (v) => Number(String(v).replace(",", "."));
      turma = { ...turma, ...config, precoKit: n(config.precoKit), precoKitLivro: n(config.precoKitLivro), vagasTotal: parseInt(config.vagasTotal, 10) };
    } else {
      turma = (await api("POST", { acao: "config", config })).turma;
    }
    desenhar();
    msg.className = "ok";
    msg.textContent = demo ? "Salvo (só nesta prévia)." : "Salvo. O site já está com os valores novos.";
    msg.hidden = false;
  } catch (err) {
    msg.className = "erro";
    msg.textContent = err.message;
    msg.hidden = false;
  }
  botao.disabled = false;
});

// ---------------- dados de exemplo (só na prévia, sem servidor) ----------------
function exemplo() {
  const d = (dias) => new Date(Date.now() - dias * 864e5).toISOString();
  const envio = {
    criado_em: d(1), titulo: "Um castelo com pernas", autor: "Isabela", idade: 6, com_ajuda_de: "mamãe",
    dedicatoria: "Para a vovó Lu, que conta as melhores histórias.", dedicatoria_path: null,
    sobre_autor: "Eu me chamo Isabela e tenho 6 anos. Eu gosto de desenhar castelos. Escrevi este livro porque castelo também quer passear.",
    capa_path: "ex/capa.jpg", autor_foto_path: "ex/autor.jpg",
    paginas: [
      { n: 1, texto: "Era uma vez um castelo que cansou de ficar parado.", arquivo: "ex/p1" },
      { n: 2, texto: "Um dia ele acordou com pernas!", arquivo: "ex/p2" },
      { n: 3, texto: "Ele foi até o mar, mas a areia fazia cócegas.", arquivo: "ex/p3" },
      { n: 4, texto: "E voltou pra casa, porque lá era o lugar dele.", arquivo: "ex/p4" },
    ],
    entrega: { destinatario: "Carla Exemplo", telefone: "(48) 90000-0000", rua: "Rua das Flores", numero: "123", complemento: "ap 2", bairro: "Centro", cidade: "Florianópolis", uf: "SC", cep: "88000-000" },
    fotos_apagadas_em: null,
  };
  return {
    turma: { nome: "Turma de Natal", vagasTotal: 15, precoKit: 47, precoKitLivro: 497, inscricoesAte: "30/10", aberta: true },
    pedidos: [
      { id: "1", criado_em: d(6), nome: "Carla Exemplo", email: "carla@exemplo.com", plano: "kit_livro", valor: 497, status: "pago", pago_em: d(6), envio_status: "enviado", turma: "Turma de Natal", mp_pagamento: "000000001", envio, link_envio: "https://afetue.com.br/enviar?pedido=exemplo" },
      { id: "2", criado_em: d(4), nome: "Marcos Exemplo", email: "marcos@exemplo.com", plano: "kit_livro", valor: 497, status: "pago", pago_em: d(4), envio_status: "aguardando", turma: "Turma de Natal", mp_pagamento: "000000002", envio: null, link_envio: "https://afetue.com.br/enviar?pedido=exemplo" },
      { id: "3", criado_em: d(3), nome: "Júlia Exemplo", email: "julia@exemplo.com", plano: "kit", valor: 47, status: "pago", pago_em: d(3), envio_status: "aguardando", turma: "Turma de Natal", mp_pagamento: "000000003", envio: null },
      { id: "4", criado_em: d(2), nome: "Paula Exemplo", email: "paula@exemplo.com", plano: "kit_livro", valor: 497, status: "pendente", envio_status: "aguardando", turma: "Turma de Natal", envio: null },
    ],
  };
}
function exemploFotos(e) {
  const cores = ["#e8d3b5", "#cfd9c0", "#d6deef", "#f0e4a8", "#e9c9bd"];
  const quadro = (i) =>
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${cores[i % 5]}"/><text x="50" y="56" font-size="10" text-anchor="middle" fill="#6b5b4d" font-family="sans-serif">exemplo</text></svg>`);
  const u = { [e.capa_path]: "assets/livro-exemplo.jpg", [e.autor_foto_path]: quadro(4) };
  e.paginas.forEach((pg, i) => (u[pg.arquivo] = quadro(i)));
  return u;
}

// ---------------- início ----------------
(async () => {
  const s = lembrado();
  if (s) {
    try { await entrar(s); return; } catch {}
  }
  $("#login").hidden = false;
  $("#senha").focus();
})();
