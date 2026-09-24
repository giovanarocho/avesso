// /api/admin — painel da afetue. Toda chamada precisa do cabeçalho x-admin-senha = ADMIN_SENHA.
import crypto from "node:crypto";
import {
  supabase, BUCKET, env, turma, linkEnvio, enviarEmail, anexoKit, emailKit, emailKitLivro, json,
} from "./_lib.js";

const STATUS_LIVRO = ["aguardando", "enviado", "em_producao", "na_grafica", "entregue"];

function autorizado(req) {
  const senha = String(req.headers["x-admin-senha"] || "");
  const certa = env("ADMIN_SENHA");
  const a = crypto.createHash("sha256").update(senha).digest();
  const b = crypto.createHash("sha256").update(certa).digest();
  return senha.length > 0 && crypto.timingSafeEqual(a, b);
}

const caminhosDoEnvio = (e) =>
  e ? [e.capa_path, e.dedicatoria_path, e.autor_foto_path, ...(e.paginas || []).map((p) => p.arquivo)].filter(Boolean) : [];

async function listarArquivos(db, pasta) {
  const saida = [];
  const { data } = await db.storage.from(BUCKET).list(pasta, { limit: 1000 });
  for (const item of data || []) {
    const caminho = `${pasta}/${item.name}`;
    if (item.id === null) saida.push(...(await listarArquivos(db, caminho))); // subpasta
    else saida.push(caminho);
  }
  return saida;
}

export default async function handler(req, res) {
  if (!autorizado(req)) {
    await new Promise((r) => setTimeout(r, 800)); // freia quem tenta adivinhar
    return json(res, 401, { erro: "Senha incorreta." });
  }
  const db = supabase();
  const acao = req.method === "GET" ? req.query.acao : req.body?.acao;

  try {
    if (req.method === "GET" && acao === "lista") {
      const { data, error } = await db.from("pedidos").select("*, envios(*)").order("criado_em", { ascending: false });
      if (error) throw error;
      const pedidos = data.map((p) => {
        const envio = Array.isArray(p.envios) ? p.envios[0] || null : p.envios || null;
        const { token, envios, ...resto } = p;
        return {
          ...resto,
          envio,
          link_envio: p.plano === "kit_livro" && p.status === "pago" ? linkEnvio(p) : null,
        };
      });
      return json(res, 200, { pedidos, turma: await turma(db) });
    }

    if (req.method === "GET" && acao === "fotos") {
      const { data: e } = await db.from("envios").select("*").eq("pedido_id", req.query.pedido).maybeSingle();
      const caminhos = caminhosDoEnvio(e);
      if (!caminhos.length || e?.fotos_apagadas_em) return json(res, 200, { urls: {} });
      const { data, error } = await db.storage.from(BUCKET).createSignedUrls(caminhos, 60 * 60);
      if (error) throw error;
      return json(res, 200, { urls: Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) });
    }

    if (req.method === "POST" && acao === "status") {
      const { pedido, envio_status } = req.body;
      if (!STATUS_LIVRO.includes(envio_status)) return json(res, 400, { erro: "Status inválido." });
      const { error } = await db.from("pedidos").update({ envio_status }).eq("id", pedido);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && acao === "reenviar-email") {
      const { data: p } = await db.from("pedidos").select("*").eq("id", req.body.pedido).maybeSingle();
      if (!p || p.status !== "pago") return json(res, 400, { erro: "Só dá pra reenviar e-mail de pedido pago." });
      const m = p.plano === "kit_livro" ? emailKitLivro(p, await turma(db)) : emailKit(p);
      await enviarEmail({ para: p.email, assunto: m.assunto, html: m.html, anexos: await anexoKit() });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && acao === "apagar-fotos") {
      const id = req.body.pedido;
      if (!/^[0-9a-f-]{36}$/i.test(String(id))) return json(res, 400, { erro: "Pedido inválido." });
      const arquivos = await listarArquivos(db, id);
      if (arquivos.length) {
        const { error } = await db.storage.from(BUCKET).remove(arquivos);
        if (error) throw error;
      }
      await db.from("envios").update({ fotos_apagadas_em: new Date().toISOString() }).eq("pedido_id", id);
      return json(res, 200, { ok: true, apagados: arquivos.length });
    }

    if (req.method === "POST" && acao === "config") {
      const c = req.body.config || {};
      const precoKit = Number(String(c.precoKit).replace(",", "."));
      const precoKitLivro = Number(String(c.precoKitLivro).replace(",", "."));
      const vagas = parseInt(c.vagasTotal, 10);
      if (!(precoKit > 0) || !(precoKitLivro > 0)) return json(res, 400, { erro: "Preencha os dois preços com valores maiores que zero." });
      if (!(vagas >= 0)) return json(res, 400, { erro: "Número de vagas inválido." });
      const linha = {
        id: 1,
        preco_kit: Math.round(precoKit * 100) / 100,
        preco_kit_livro: Math.round(precoKitLivro * 100) / 100,
        vagas_livro: vagas,
        inscricoes_ate: String(c.inscricoesAte || "").trim().slice(0, 40),
        turma_nome: String(c.nome || "").trim().slice(0, 60) || "Turma",
        turma_aberta: Boolean(c.aberta),
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await db.from("config").upsert(linha);
      if (error) throw error;
      return json(res, 200, { ok: true, turma: await turma(db) });
    }

    json(res, 400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "Algo deu errado no servidor. Tente de novo." });
  }
}
