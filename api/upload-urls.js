// POST /api/upload-urls — gera links temporários pra subir as fotos direto no Supabase Storage
// (as fotos não passam pela Vercel, que tem limite de 4,5 MB por requisição)
import { supabase, pedidoPorToken, BUCKET, json, soMetodo } from "./_lib.js";

const CAMPOS = /^(capa|dedicatoria|autor_foto|pagina_(0[1-9]|1[0-6]))$/;
const MAX = 20 * 1024 * 1024;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp" };

export default async function handler(req, res) {
  if (!soMetodo(req, res, "POST")) return;
  const { pedido, t, arquivos } = req.body || {};
  const db = supabase();
  const p = await pedidoPorToken(db, pedido, t);
  if (!p || p.plano !== "kit_livro" || p.status !== "pago") return json(res, 403, { erro: "Link inválido." });
  if (p.envio_status !== "aguardando") return json(res, 409, { erro: "Este livro já foi enviado." });
  if (!Array.isArray(arquivos) || !arquivos.length || arquivos.length > 19) return json(res, 400, { erro: "Arquivos inválidos." });

  const campos = new Set();
  for (const a of arquivos) {
    if (!CAMPOS.test(a.campo) || campos.has(a.campo)) return json(res, 400, { erro: "Arquivos inválidos." });
    if (!String(a.tipo).startsWith("image/")) return json(res, 400, { erro: "Envie só fotos (JPG, PNG ou HEIC)." });
    if (!(a.tamanho > 0 && a.tamanho <= MAX)) return json(res, 400, { erro: "Uma das fotos passou de 20 MB." });
    campos.add(a.campo);
  }
  if (!campos.has("capa") || !campos.has("autor_foto") || !campos.has("pagina_01")) {
    return json(res, 400, { erro: "Faltam fotos: capa, sobre o autor e pelo menos uma página." });
  }

  try {
    const lote = Date.now();
    const urls = [];
    for (const a of arquivos) {
      const ext = EXT[a.tipo] || "jpg";
      const caminho = `${p.id}/${lote}/${a.campo}.${ext}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
      if (error) throw error;
      urls.push({ campo: a.campo, path: data.path, signedUrl: data.signedUrl });
    }
    json(res, 200, { urls });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "Não deu pra preparar o envio agora." });
  }
}
