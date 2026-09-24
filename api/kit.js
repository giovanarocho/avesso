// GET /api/kit?pedido=…&t=… — baixa o PDF da Oficina (só pra pedidos pagos)
import fs from "node:fs/promises";
import { supabase, pedidoPorToken, KIT_ARQUIVO, json } from "./_lib.js";

export default async function handler(req, res) {
  const p = await pedidoPorToken(supabase(), req.query.pedido, req.query.t);
  if (!p || p.status !== "pago") return json(res, 404, { erro: "Link inválido ou pagamento ainda não confirmado." });
  const buf = await fs.readFile(KIT_ARQUIVO);
  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", 'attachment; filename="oficina-de-autor-em-casa.pdf"');
  res.setHeader("cache-control", "private, no-store");
  res.status(200).end(buf);
}
