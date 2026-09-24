// POST /api/webhook-mercadopago — o Mercado Pago avisa aqui quando um pagamento muda.
// Pagamento aprovado → marca o pedido como pago e manda o e-mail certo (só uma vez).
import crypto from "node:crypto";
import { supabase, turma, env, enviarEmail, anexoKit, emailKit, emailKitLivro, json } from "./_lib.js";

function assinaturaValida(req, dataId) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  if (!segredo) return true; // sem segredo configurado, não valida (configure em produção)
  const cab = String(req.headers["x-signature"] || "");
  const partes = Object.fromEntries(cab.split(",").map((p) => p.trim().split("=")));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId;
  const manifesto = `id:${id};request-id:${req.headers["x-request-id"] || ""};ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex");
  return esperado.length === partes.v1.length &&
    crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 200, { ok: true });
  const tipo = req.query.type || req.body?.type || req.query.topic;
  const dataId = req.query["data.id"] || req.body?.data?.id || req.query.id;
  if (tipo !== "payment" || !dataId) return json(res, 200, { ignorado: true });
  if (!assinaturaValida(req, String(dataId))) return json(res, 401, { erro: "assinatura" });

  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { authorization: `Bearer ${env("MP_ACCESS_TOKEN")}` },
    });
    if (!r.ok) throw new Error(`Mercado Pago ${r.status}`);
    const pg = await r.json();
    const db = supabase();

    if (pg.status === "approved" && pg.external_reference) {
      // só quem virar "pago" agora manda e-mail — evita e-mail duplicado quando o MP avisa mais de uma vez
      const { data: virou } = await db
        .from("pedidos")
        .update({ status: "pago", mp_pagamento: String(pg.id), pago_em: new Date().toISOString() })
        .eq("id", pg.external_reference)
        .neq("status", "pago")
        .select();
      const pedido = virou?.[0];
      if (pedido) {
        const m = pedido.plano === "kit_livro" ? emailKitLivro(pedido, await turma(db)) : emailKit(pedido);
        await enviarEmail({ para: pedido.email, assunto: m.assunto, html: m.html, anexos: await anexoKit() });
        await db.from("pedidos").update({ email_enviado_em: new Date().toISOString() }).eq("id", pedido.id);
        if (process.env.EMAIL_ADMIN) {
          await enviarEmail({
            para: env("EMAIL_ADMIN"),
            assunto: `Nova venda: ${pedido.plano === "kit_livro" ? "kit + livro" : "kit"} · ${pedido.nome}`,
            html: `<p>${pedido.nome} (${pedido.email}) comprou <b>${pedido.plano}</b> por R$ ${pedido.valor}.</p>`,
          }).catch((e) => console.error("aviso admin", e));
        }
      }
    } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(pg.status) && pg.external_reference) {
      await db.from("pedidos").update({ status: pg.status === "refunded" ? "reembolsado" : "cancelado" })
        .eq("id", pg.external_reference).neq("status", "pago");
    }
    json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "falhou" }); // 500 faz o Mercado Pago tentar de novo mais tarde
  }
}
