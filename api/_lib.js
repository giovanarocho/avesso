// afetue · utilidades compartilhadas das funções (arquivos com _ não viram rota na Vercel)
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const env = (k, padrao) => {
  const v = process.env[k];
  if (v === undefined || v === "") {
    if (padrao !== undefined) return padrao;
    throw new Error(`Variável de ambiente ausente: ${k}`);
  }
  return v;
};

export const supabase = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export const BUCKET = "livros";
export const KIT_ARQUIVO = path.join(process.cwd(), "private", "oficina-de-autor-em-casa.pdf");

/**
 * Preços e dados da turma. Vêm da tabela "config" (editada pelo painel /admin).
 * Se a tabela ainda não existir, usa as variáveis de ambiente como reserva.
 */
export async function turma(db = supabase()) {
  const { data } = await db.from("config").select("*").eq("id", 1).maybeSingle();
  if (data) {
    return {
      nome: data.turma_nome,
      aberta: data.turma_aberta,
      vagasTotal: data.vagas_livro,
      precoKit: Number(data.preco_kit),
      precoKitLivro: Number(data.preco_kit_livro),
      inscricoesAte: data.inscricoes_ate,
    };
  }
  return {
    nome: env("TURMA_NOME", "Turma de Natal"),
    aberta: env("TURMA_ABERTA", "sim") === "sim",
    vagasTotal: Number(env("VAGAS_LIVRO", "15")),
    precoKit: Number(env("PRECO_KIT", "47")),
    precoKitLivro: Number(env("PRECO_KIT_LIVRO", "497")),
    inscricoesAte: env("INSCRICOES_ATE", "30/10"),
  };
}

export const PLANOS = {
  kit: { titulo: "Oficina de Autor em Casa (kit em PDF)", preco: (t) => t.precoKit },
  kit_livro: { titulo: "Oficina de Autor em Casa + livro de capa dura feito à mão (frete incluso)", preco: (t) => t.precoKitLivro },
};

export const novoToken = () => crypto.randomBytes(24).toString("base64url");

export function tokenConfere(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const emailValido = (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export async function contarLivrosVendidos(db) {
  const { count, error } = await db
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("plano", "kit_livro")
    .eq("status", "pago");
  if (error) throw error;
  return count || 0;
}

/** Busca o pedido e confere o token do link. Devolve null se não bater. */
export async function pedidoPorToken(db, id, t) {
  if (!id || !t || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (!data || !tokenConfere(data.token, t)) return null;
  return data;
}

export const siteUrl = () => env("SITE_URL").replace(/\/$/, "");
export const linkEnvio = (p) => `${siteUrl()}/enviar?pedido=${p.id}&t=${p.token}`;
export const linkKit = (p) => `${siteUrl()}/api/kit?pedido=${p.id}&t=${p.token}`;

// ---------------- e-mail (Resend) ----------------
export async function enviarEmail({ para, assunto, html, anexos, responderPara }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: Array.isArray(para) ? para : [para],
      subject: assunto,
      html,
      reply_to: responderPara || env("EMAIL_RESPOSTA", env("EMAIL_ADMIN")),
      attachments: anexos,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function anexoKit() {
  const buf = await fs.readFile(KIT_ARQUIVO);
  return [{ filename: "oficina-de-autor-em-casa.pdf", content: buf.toString("base64") }];
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export { esc };

/** Moldura dos e-mails, no tom e nas cores da afetue. */
export function moldura(corpo) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1e9dc;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#2b211a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf8f2;border-radius:16px">
<tr><td style="padding:32px 32px 8px"><img src="${siteUrl()}/assets/logo-email.png" width="96" alt="afetue" style="display:block;width:96px;height:auto"></td></tr>
<tr><td style="padding:8px 32px 32px;font-size:16px;line-height:1.6">${corpo}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2d7c6;font-size:13px;color:#6b5b4d">afetue · afeto como ato<br>Responda este e-mail se precisar de qualquer coisa.</td></tr>
</table></td></tr></table></body></html>`;
}

export const botao = (href, texto) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#7a4a24;color:#fbf8f2;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px;display:inline-block">${texto}</a></p>`;

export function emailKit(p) {
  const nome = esc(p.nome.split(" ")[0]);
  return {
    assunto: "Sua Oficina de Autor em Casa chegou",
    html: moldura(`
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px">Oi, ${nome}. A oficina é de vocês.</h1>
<p>O kit está anexado neste e-mail. Se preferir, baixe pelo botão (o link é seu e não expira):</p>
${botao(linkKit(p), "Baixar a Oficina de Autor")}
<p><strong>Por onde começar</strong></p>
<ol style="padding-left:20px;margin:0 0 16px">
<li>Leia as páginas 2 e 3 (são pra você, adulto).</li>
<li>Imprima as folhas em A4, na opção <em>tamanho real</em> ou <em>100%</em>.</li>
<li>Escolham uma tarde e comecem pelo encontro 1. Vinte minutos bastam.</li>
</ol>
<p>Pulou uma semana? Tudo bem. É possível, não perfeito.</p>`),
  };
}

export function emailKitLivro(p, t) {
  const nome = esc(p.nome.split(" ")[0]);
  return {
    assunto: "Sua vaga na Oficina de Autor está garantida",
    html: moldura(`
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px">Oi, ${nome}. Vai ter livro na estante!</h1>
<p>Sua vaga na <strong>${esc(t.nome)}</strong> está garantida. O kit está anexado neste e-mail e também pode ser baixado aqui:</p>
${botao(linkKit(p), "Baixar a Oficina de Autor")}
<p><strong>Como vai ser</strong></p>
<ol style="padding-left:20px;margin:0 0 16px">
<li>Façam os 5 encontros, no ritmo de vocês.</li>
<li>Fotografem as folhas de cima, com luz do dia.</li>
<li>Enviem tudo pela sua página pessoal.</li>
<li>Eu diagramo e encaderno o livro à mão, e ele chega na sua casa com frete incluso.</li>
</ol>
<p>Guarde este e-mail: o botão abaixo é o seu link pessoal de envio.</p>
${botao(linkEnvio(p), "Abrir minha página de envio")}`),
  };
}

export function emailLink(p, t) {
  return {
    assunto: "Seu link pra enviar o livro",
    html: moldura(`
<p>Oi, ${esc(p.nome.split(" ")[0])}. Aqui está o seu link pessoal pra enviar o livro da Oficina de Autor.</p>
${botao(linkEnvio(p), "Abrir minha página de envio")}`),
  };
}

export function emailRecebido(p, dados) {
  return {
    assunto: `Recebemos "${dados.titulo}"`,
    html: moldura(`
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px">Recebemos o livro de ${esc(dados.autor)}!</h1>
<p><strong>${esc(dados.titulo)}</strong> chegou inteirinho por aqui. Agora é comigo: vou diagramar página por página e encadernar o livro à mão. Você recebe notícias quando ele estiver a caminho.</p>
<p>Se lembrar de alguma mudança, é só responder este e-mail.</p>
<p>E guardem as folhas originais. O livro é uma cópia; aquelas folhas com cheiro de canetinha são o original.</p>`),
  };
}

// ---------------- respostas ----------------
export function json(res, status, corpo) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(corpo));
}

export function soMetodo(req, res, metodo) {
  if (req.method !== metodo) {
    res.setHeader("allow", metodo);
    json(res, 405, { erro: "Método não permitido." });
    return false;
  }
  return true;
}
