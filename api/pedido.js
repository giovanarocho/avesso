// GET /api/pedido?pedido=…&t=… — dados mínimos pra página de envio
import { supabase, pedidoPorToken, json, soMetodo } from "./_lib.js";

export default async function handler(req, res) {
  if (!soMetodo(req, res, "GET")) return;
  const p = await pedidoPorToken(supabase(), req.query.pedido, req.query.t);
  if (!p) return json(res, 404, { erro: "Esse link não é válido. Confira se copiou o link inteiro do e-mail." });
  if (p.plano !== "kit_livro") return json(res, 403, { erro: "Este pedido é só do kit, sem livro." });
  if (p.status !== "pago") return json(res, 402, { erro: "O pagamento deste pedido ainda não foi confirmado." });
  json(res, 200, { nome: p.nome, envio_status: p.envio_status });
}
