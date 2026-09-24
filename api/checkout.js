// POST /api/checkout — cria o pedido e abre o pagamento no Mercado Pago
import {
  supabase, turma, PLANOS, novoToken, emailValido, contarLivrosVendidos, siteUrl, env, json, soMetodo,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!soMetodo(req, res, "POST")) return;
  const { nome, email, plano } = req.body || {};
  if (!nome || String(nome).trim().length < 2) return json(res, 400, { erro: "Escreva seu nome." });
  if (!emailValido(email)) return json(res, 400, { erro: "Confira o e-mail." });
  if (!PLANOS[plano]) return json(res, 400, { erro: "Plano inválido." });

  try {
    const db = supabase();
    const t = await turma(db);
    if (!t.aberta) return json(res, 409, { erro: "As inscrições desta turma estão encerradas." });
    if (plano === "kit_livro" && (await contarLivrosVendidos(db)) >= t.vagasTotal) {
      return json(res, 409, { erro: "Os livros desta turma esgotaram. O kit sozinho continua disponível." });
    }

    const valor = PLANOS[plano].preco(t);
    if (!(valor > 0)) throw new Error("Preço não configurado no painel.");
    const { data: pedido, error } = await db
      .from("pedidos")
      .insert({
        nome: String(nome).trim().slice(0, 120),
        email: String(email).trim().toLowerCase(),
        plano,
        valor,
        turma: t.nome,
        token: novoToken(),
      })
      .select()
      .single();
    if (error) throw error;

    const volta = (s) => `${siteUrl()}/obrigado?plano=${plano}&status=${s}`;
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("MP_ACCESS_TOKEN")}`,
        "content-type": "application/json",
        "x-idempotency-key": pedido.id,
      },
      body: JSON.stringify({
        items: [{ id: plano, title: PLANOS[plano].titulo, quantity: 1, unit_price: valor, currency_id: "BRL" }],
        payer: { name: pedido.nome, email: pedido.email },
        external_reference: pedido.id,
        notification_url: `${siteUrl()}/api/webhook-mercadopago`,
        back_urls: { success: volta("approved"), pending: volta("pending"), failure: volta("rejected") },
        auto_return: "approved",
        statement_descriptor: "AFETUE",
      }),
    });
    const pref = await r.json();
    if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(pref)}`);

    await db.from("pedidos").update({ mp_preferencia: pref.id }).eq("id", pedido.id);
    json(res, 200, { url: pref.init_point });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "Não deu pra abrir o pagamento agora." });
  }
}
