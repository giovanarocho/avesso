// afetue · dados da turma e compra
// Os valores abaixo só aparecem se o servidor não responder (ex.: na prévia).
// Os valores de verdade vêm de /api/turma, configurados nas variáveis da Vercel.
const TURMA_PADRAO = {
  nome: "Turma de Natal",
  aberta: true,
  vagasTotal: 15,
  vagasRestantes: null,
  inscricoesAte: "30/10",
  precoKit: 47,
  precoKitLivro: 497,
};

const brl = (v) =>
  v == null ? "R$ [valor]" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Number.isInteger(v) ? 0 : 2 });

async function carregarTurma() {
  try {
    const r = await fetch("/api/turma", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    return { ...TURMA_PADRAO, ...(await r.json()), online: true };
  } catch {
    return { ...TURMA_PADRAO, online: false };
  }
}

function preencherTurma(t) {
  const set = (sel, txt) => document.querySelectorAll(sel).forEach((el) => (el.textContent = txt));
  set("[data-t=inscricoes]", t.inscricoesAte);
  set("[data-t=preco-kit]", brl(t.precoKit));
  set("[data-t=preco-livro]", brl(t.precoKitLivro));
  const vagas =
    t.vagasRestantes == null
      ? `${t.vagasTotal} livros`
      : t.vagasRestantes > 0
      ? `restam ${t.vagasRestantes} de ${t.vagasTotal} livros`
      : "livros esgotados nesta turma";
  set("[data-t=vagas]", vagas);
  const esgotado = t.vagasRestantes === 0 || !t.aberta;
  document.querySelectorAll("[data-plano=kit_livro]").forEach((b) => {
    b.disabled = esgotado;
    if (esgotado) b.textContent = t.aberta ? "Livros esgotados" : "Turma encerrada";
  });
  if (!t.aberta) document.querySelectorAll("[data-plano=kit]").forEach((b) => (b.disabled = true));
}

function iniciarCompra(turma) {
  const dlg = document.getElementById("compra");
  if (!dlg) return;
  const form = dlg.querySelector("form");
  const msg = dlg.querySelector("[data-msg]");
  const titulo = dlg.querySelector("[data-titulo]");
  const enviar = form.querySelector("button[type=submit]");
  let plano = "kit_livro";

  document.querySelectorAll("[data-plano]").forEach((b) =>
    b.addEventListener("click", () => {
      plano = b.dataset.plano;
      titulo.textContent = plano === "kit" ? "Só o kit" : "Kit + livro";
      msg.hidden = true;
      dlg.showModal();
      form.querySelector("input").focus();
    })
  );
  dlg.querySelector(".fechar").addEventListener("click", () => dlg.close());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const dados = Object.fromEntries(new FormData(form));
    if (!turma.online) {
      msg.className = "aviso";
      msg.textContent = "Esta é uma prévia do site. O pagamento funciona quando o site estiver no ar.";
      msg.hidden = false;
      return;
    }
    enviar.disabled = true;
    enviar.textContent = "Abrindo o pagamento…";
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...dados, plano }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.erro || "Não deu pra abrir o pagamento agora.");
      location.href = j.url;
    } catch (err) {
      msg.className = "erro";
      msg.textContent = err.message + " Tente de novo em alguns minutos.";
      msg.hidden = false;
      enviar.disabled = false;
      enviar.textContent = "Ir para o pagamento";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.querySelector("[data-t]") && !document.getElementById("compra")) return;
  const t = await carregarTurma();
  preencherTurma(t);
  iniciarCompra(t);
});
