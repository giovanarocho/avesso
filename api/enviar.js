// POST /api/enviar — registra o livro enviado (textos, endereço e caminhos das fotos)
import { supabase, pedidoPorToken, BUCKET, env, enviarEmail, emailRecebido, esc, json, soMetodo } from "./_lib.js";

const OBRIG = ["titulo", "autor", "dedicatoria", "sobre", "destinatario", "telefone", "rua", "numero", "cep", "bairro", "cidade", "uf"];
const corta = (v, n) => String(v ?? "").trim().slice(0, n);

export default async function handler(req, res) {
  if (!soMetodo(req, res, "POST")) return;
  const { pedido, t, dados = {}, paginas = [], arquivos = [] } = req.body || {};
  const db = supabase();
  const p = await pedidoPorToken(db, pedido, t);
  if (!p || p.plano !== "kit_livro" || p.status !== "pago") return json(res, 403, { erro: "Link inválido." });
  if (p.envio_status !== "aguardando") return json(res, 409, { erro: "Este livro já foi enviado." });

  const falta = OBRIG.filter((k) => !String(dados[k] ?? "").trim());
  if (falta.length) return json(res, 400, { erro: "Faltam alguns campos obrigatórios." });
  if (!Array.isArray(paginas) || paginas.length < 1 || paginas.length > 16) return json(res, 400, { erro: "Envie de 1 a 16 páginas." });
  const doPedido = (c) => typeof c === "string" && c.startsWith(`${p.id}/`);
  if (!arquivos.every((a) => doPedido(a.path)) || !paginas.every((pg) => doPedido(pg.arquivo))) {
    return json(res, 400, { erro: "Alguma foto não subiu. Tente enviar de novo." });
  }
  const caminho = (campo) => arquivos.find((a) => a.campo === campo)?.path || null;

  const registro = {
    pedido_id: p.id,
    titulo: corta(dados.titulo, 80),
    autor: corta(dados.autor, 60),
    idade: dados.idade ? Number(dados.idade) || null : null,
    com_ajuda_de: corta(dados.ajuda, 60) || null,
    dedicatoria: corta(dados.dedicatoria, 400),
    sobre_autor: corta(dados.sobre, 600),
    capa_path: caminho("capa"),
    dedicatoria_path: caminho("dedicatoria"),
    autor_foto_path: caminho("autor_foto"),
    paginas: paginas.map((pg, i) => ({ n: i + 1, texto: corta(pg.texto, 500), arquivo: pg.arquivo })),
    entrega: {
      destinatario: corta(dados.destinatario, 120), telefone: corta(dados.telefone, 30),
      rua: corta(dados.rua, 160), numero: corta(dados.numero, 20), complemento: corta(dados.complemento, 80),
      bairro: corta(dados.bairro, 80), cidade: corta(dados.cidade, 80), uf: corta(dados.uf, 2).toUpperCase(),
      cep: corta(dados.cep, 12),
    },
  };

  try {
    const { error } = await db.from("envios").insert(registro);
    if (error) throw error;
    await db.from("pedidos").update({ envio_status: "enviado", enviado_em: new Date().toISOString() }).eq("id", p.id);

    const m = emailRecebido(p, registro);
    await enviarEmail({ para: p.email, assunto: m.assunto, html: m.html }).catch((e) => console.error(e));

    if (process.env.EMAIL_ADMIN) {
      const todos = [registro.capa_path, registro.dedicatoria_path, registro.autor_foto_path, ...registro.paginas.map((x) => x.arquivo)].filter(Boolean);
      const { data: assinados } = await db.storage.from(BUCKET).createSignedUrls(todos, 60 * 60 * 24 * 7);
      const link = (path) => assinados?.find((s) => s.path === path)?.signedUrl;
      const e = registro.entrega;
      const html = `
<h2>Livro recebido: ${esc(registro.titulo)}</h2>
<p><b>Autor:</b> ${esc(registro.autor)}${registro.idade ? `, ${registro.idade} anos` : ""}${registro.com_ajuda_de ? ` · com a ajuda de ${esc(registro.com_ajuda_de)}` : ""}<br>
<b>Pedido:</b> ${p.id} · ${esc(p.nome)} (${esc(p.email)})</p>
<p><a href="${link(registro.capa_path)}">Capa</a>${registro.dedicatoria_path ? ` · <a href="${link(registro.dedicatoria_path)}">Folha da dedicatória</a>` : ""} · <a href="${link(registro.autor_foto_path)}">Foto do autor</a></p>
<p><b>Dedicatória:</b> ${esc(registro.dedicatoria)}</p>
<ol>${registro.paginas.map((x) => `<li><a href="${link(x.arquivo)}">foto</a> — ${esc(x.texto) || "<i>sem texto</i>"}</li>`).join("")}</ol>
<p><b>Sobre o autor:</b> ${esc(registro.sobre_autor)}</p>
<p><b>Entrega:</b> ${esc(e.destinatario)} · ${esc(e.telefone)}<br>${esc(e.rua)}, ${esc(e.numero)} ${esc(e.complemento)} · ${esc(e.bairro)}<br>${esc(e.cidade)}/${esc(e.uf)} · CEP ${esc(e.cep)}</p>
<p style="color:#888">Os links das fotos valem 7 dias. Depois, baixe pelo painel do Supabase (Storage → livros → ${p.id}).</p>`;
      await enviarEmail({ para: env("EMAIL_ADMIN"), assunto: `Livro recebido: ${registro.titulo} (${registro.autor})`, html, responderPara: p.email })
        .catch((err) => console.error("aviso admin", err));
    }
    json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "Não deu pra concluir o envio agora." });
  }
}
