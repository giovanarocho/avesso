// POST /api/reenviar-link — reenvia o link de envio pro e-mail da compra (sem revelar se o e-mail existe)
import { supabase, emailValido, turma, enviarEmail, emailLink, json, soMetodo } from "./_lib.js";

export default async function handler(req, res) {
  if (!soMetodo(req, res, "POST")) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!emailValido(email)) return json(res, 400, { erro: "Confira o e-mail." });
  try {
    const db = supabase();
    const { data } = await db
      .from("pedidos").select("*")
      .eq("email", email).eq("plano", "kit_livro").eq("status", "pago")
      .order("criado_em", { ascending: false }).limit(1);
    if (data?.[0]) {
      const m = emailLink(data[0], await turma(db));
      await enviarEmail({ para: email, assunto: m.assunto, html: m.html });
    }
  } catch (e) {
    console.error(e);
  }
  json(res, 200, { ok: true });
}
