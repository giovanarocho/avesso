// GET /api/turma — datas, preços e vagas restantes da turma atual
import { supabase, turma, contarLivrosVendidos, json, soMetodo } from "./_lib.js";

export default async function handler(req, res) {
  if (!soMetodo(req, res, "GET")) return;
  try {
    const db = supabase();
    const t = await turma(db);
    const vendidos = await contarLivrosVendidos(db);
    res.setHeader("cache-control", "public, max-age=30");
    json(res, 200, { ...t, vagasRestantes: Math.max(0, t.vagasTotal - vendidos) });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "Não deu pra carregar a turma agora." });
  }
}
