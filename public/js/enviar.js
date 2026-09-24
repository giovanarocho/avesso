// afetue · página de envio do livro
const MAX_PAGINAS = 16;
const MAX_MB = 20;

const q = new URLSearchParams(location.search);
const pedido = q.get("pedido");
const token = q.get("t");
const $ = (s) => document.querySelector(s);

function mostrar(el, tipo, texto) {
  el.className = tipo;
  el.textContent = texto;
  el.hidden = false;
}

function ligarFoto(box) {
  const input = box.querySelector("input[type=file]");
  const quadro = box.querySelector(".quadro");
  const botao = document.createElement("span");
  botao.className = "escolher";
  botao.textContent = "Escolher foto";
  botao.setAttribute("aria-hidden", "true");
  input.after(botao);
  quadro.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    box.classList.remove("falta");
    const f = input.files[0];
    botao.textContent = f ? "Trocar foto" : "Escolher foto";
    if (!f) {
      quadro.style.backgroundImage = "";
      quadro.classList.remove("tem");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      alertaCampo(input, `Essa foto tem mais de ${MAX_MB} MB. Tire outra ou reduza o tamanho.`);
      input.value = "";
      return;
    }
    quadro.style.backgroundImage = `url(${URL.createObjectURL(f)})`;
    quadro.classList.add("tem");
    input.setCustomValidity("");
  });
}

function alertaCampo(input, texto) {
  input.setCustomValidity(texto);
  input.reportValidity();
}

// ---------- páginas da história ----------
const lista = $("#paginas");
const tpl = $("#tpl-pagina");
const addBtn = $("#add-pagina");

function renumerar() {
  const pags = [...lista.children];
  pags.forEach((p, i) => {
    p.querySelector("[data-n]").textContent = i + 1;
    p.querySelector("[data-acao=subir]").disabled = i === 0;
    p.querySelector("[data-acao=descer]").disabled = i === pags.length - 1;
    p.querySelector("[data-acao=remover]").disabled = pags.length === 1;
  });
  addBtn.disabled = pags.length >= MAX_PAGINAS;
  addBtn.textContent = pags.length >= MAX_PAGINAS ? "Limite de 16 páginas" : "+ Adicionar página";
}

function novaPagina(texto = "") {
  const el = tpl.content.firstElementChild.cloneNode(true);
  el.querySelector("textarea").value = texto;
  el.querySelector("textarea").addEventListener("input", salvarRascunho);
  ligarFoto(el.querySelector(".foto"));
  el.addEventListener("click", (e) => {
    const acao = e.target.dataset?.acao;
    if (!acao) return;
    if (acao === "subir" && el.previousElementSibling) lista.insertBefore(el, el.previousElementSibling);
    if (acao === "descer" && el.nextElementSibling) lista.insertBefore(el.nextElementSibling, el);
    if (acao === "remover") el.remove();
    renumerar();
    salvarRascunho();
  });
  lista.appendChild(el);
  renumerar();
  return el;
}
addBtn.addEventListener("click", () => {
  const el = novaPagina();
  el.querySelector("input[type=file]").focus();
  salvarRascunho();
});

// ---------- rascunho dos textos (neste aparelho) ----------
const chave = `afetue-rascunho-${pedido || "previa"}`;
const form = $("#livro");

function salvarRascunho() {
  try {
    const campos = Object.fromEntries(
      [...form.querySelectorAll("input[name]:not([type=checkbox]),textarea[name]")].map((i) => [i.name, i.value])
    );
    const paginas = [...lista.querySelectorAll("textarea")].map((t) => t.value);
    localStorage.setItem(chave, JSON.stringify({ campos, paginas }));
  } catch {}
}
function lerRascunho() {
  try {
    return JSON.parse(localStorage.getItem(chave) || "null");
  } catch {
    return null;
  }
}

// ---------- envio ----------
function coletarArquivos() {
  const arquivos = [];
  document.querySelectorAll("[data-campo]").forEach((box) => {
    const f = box.querySelector("input[type=file]").files[0];
    if (f) arquivos.push({ campo: box.dataset.campo, file: f });
  });
  [...lista.children].forEach((p, i) => {
    const f = p.querySelector("input[type=file]").files[0];
    if (f) arquivos.push({ campo: `pagina_${String(i + 1).padStart(2, "0")}`, file: f });
  });
  return arquivos;
}

function subir(url, file, aoProgredir) {
  return new Promise((ok, falha) => {
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("x-upsert", "true");
    x.upload.onprogress = (e) => e.lengthComputable && aoProgredir(e.loaded);
    x.onload = () => (x.status < 300 ? ok() : falha(new Error(`upload ${x.status}`)));
    x.onerror = () => falha(new Error("rede"));
    x.send(fd);
  });
}

async function enviarLivro(e) {
  e.preventDefault();
  const msg = $("#msg-envio");
  msg.hidden = true;
  const semFoto = [...form.querySelectorAll("input[type=file]")].find((i) => !i.checkValidity());
  if (semFoto) {
    const box = semFoto.closest(".foto");
    box.classList.add("falta");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    mostrar(msg, "erro", "Falta escolher uma foto. Ela está marcada em vermelho.");
    return;
  }
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  if (!pedido || !token) {
    mostrar(msg, "aviso", "Esta é uma prévia. O envio funciona pelo link pessoal que chega no e-mail depois da compra.");
    return;
  }
  const botao = $("#enviar");
  const barra = $("#progresso");
  const arquivos = coletarArquivos();
  botao.disabled = true;
  botao.textContent = "Enviando…";
  try {
    const r1 = await fetch("/api/upload-urls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pedido,
        t: token,
        arquivos: arquivos.map((a) => ({ campo: a.campo, tipo: a.file.type, tamanho: a.file.size, nome: a.file.name })),
      }),
    });
    const j1 = await r1.json().catch(() => ({}));
    if (!r1.ok) throw new Error(j1.erro || "Não deu pra preparar o envio.");

    const total = arquivos.reduce((s, a) => s + a.file.size, 0);
    const feito = new Array(arquivos.length).fill(0);
    barra.hidden = false;
    const atualizar = () =>
      (barra.firstElementChild.style.width = `${Math.round((feito.reduce((s, v) => s + v, 0) / total) * 100)}%`);

    // sobe de 3 em 3 pra não travar celular com conexão fraca
    const fila = arquivos.map((a, i) => ({ ...a, i, destino: j1.urls.find((u) => u.campo === a.campo) }));
    const trabalhador = async () => {
      while (fila.length) {
        const a = fila.shift();
        await subir(a.destino.signedUrl, a.file, (n) => {
          feito[a.i] = n;
          atualizar();
        });
        feito[a.i] = a.file.size;
        atualizar();
      }
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);

    const dados = Object.fromEntries(new FormData(form));
    delete dados.consentimento;
    delete dados.conferi;
    const r2 = await fetch("/api/enviar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pedido,
        t: token,
        dados,
        paginas: [...lista.children].map((p, i) => ({
          n: i + 1,
          texto: p.querySelector("textarea").value,
          arquivo: j1.urls.find((u) => u.campo === `pagina_${String(i + 1).padStart(2, "0")}`)?.path,
        })),
        arquivos: j1.urls.map((u) => ({ campo: u.campo, path: u.path })),
      }),
    });
    const j2 = await r2.json().catch(() => ({}));
    if (!r2.ok) throw new Error(j2.erro || "Não deu pra concluir o envio.");
    try { localStorage.removeItem(chave); } catch {}
    form.hidden = true;
    mostrar($("#estado"), "ok", "Recebemos o seu livro! Mandamos uma confirmação pro seu e-mail. Agora é comigo: vou diagramar e encadernar o livro à mão, e você recebe notícias quando ele estiver a caminho.");
    $("#estado").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    mostrar(msg, "erro", `${err.message} Nada se perdeu: confira a conexão e toque em enviar de novo.`);
    botao.disabled = false;
    botao.textContent = "Enviar meu livro";
  }
}

// ---------- pedir link de novo ----------
$("#pedir-link").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = f.querySelector("[data-msg]");
  const b = f.querySelector("button");
  b.disabled = true;
  try {
    const r = await fetch("/api/reenviar-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: f.email.value }),
    });
    if (!r.ok) throw new Error();
    mostrar(msg, "ok", "Se existir uma compra de kit + livro com esse e-mail, o link chega em alguns minutos. Olhe também o spam.");
  } catch {
    mostrar(msg, "aviso", "Esta é uma prévia do site. No ar, o link é reenviado pro seu e-mail.");
  }
  b.disabled = false;
});

// ---------- início ----------
async function iniciar() {
  document.querySelectorAll("[data-campo]").forEach(ligarFoto);
  const r = lerRascunho();
  if (r) {
    Object.entries(r.campos || {}).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el && "value" in el) el.value = v;
    });
    (r.paginas?.length ? r.paginas : [""]).forEach((t) => novaPagina(t));
  } else {
    novaPagina();
  }
  form.addEventListener("input", salvarRascunho);
  form.addEventListener("submit", enviarLivro);

  const estado = $("#estado");
  if (!pedido || !token) {
    // prévia/sem link: mostra o pedido de link e, abaixo, o formulário de exemplo
    $("#pedir-link").hidden = false;
    form.hidden = false;
    mostrar(estado, "aviso", "Você está vendo o formulário de envio. Pra enviar de verdade, abra o link pessoal que chegou no seu e-mail.");
    return;
  }
  try {
    const res = await fetch(`/api/pedido?pedido=${encodeURIComponent(pedido)}&t=${encodeURIComponent(token)}`);
    const p = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(p.erro || "Link inválido."), { status: res.status });
    $("#saudacao").textContent = `Oi, ${p.nome.split(" ")[0]}. Aqui você manda as folhas e o texto da história. A gente cuida do resto.`;
    if (p.envio_status && p.envio_status !== "aguardando") {
      mostrar(estado, "ok", "Seu livro já foi enviado. Precisa mudar alguma coisa? Responda o e-mail de confirmação.");
      return;
    }
    form.hidden = false;
  } catch (err) {
    mostrar(estado, "erro", err.status ? err.message : "Não conseguimos abrir seu pedido agora. Tente de novo em alguns minutos.");
    $("#pedir-link").hidden = false;
  }
}
iniciar();
