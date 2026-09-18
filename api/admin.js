import {
  adminConfigured,
  checkAdminPassword,
  dbConfigured,
  dbListPagamentos,
  dbSetConfig,
  dbSetPrecoProduto,
  dbSetTutoriais,
  issueAdminToken,
  verifyAdminToken,
  listProducts,
  dbUpsertProduto,
  dbDeleteProduto
} from '../lib/services.js';

// login, lista de vendas e edição de preços do painel, juntos num arquivo
// só (ações por ?action=) — pra caber com folga no limite de funções
// serverless do plano hobby da vercel, mesmo depois de o catálogo de
// ferramentas crescer.

function getToken(req) {
  const auth = (req.headers && req.headers.authorization) || '';
  return auth.indexOf('Bearer ') === 0 ? auth.slice(7) : null;
}

async function actionLogin(req, res, body) {
  if (!adminConfigured()) {
    res.status(500).json({ error: 'ADMIN_PASSWORD não configurado no servidor' });
    return;
  }
  if (!checkAdminPassword(body.password)) {
    res.status(401).json({ error: 'senha incorreta' });
    return;
  }
  res.status(200).json({ token: issueAdminToken() });
}

async function actionSales(req, res) {
  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  if (!dbConfigured()) {
    res.status(200).json({ pagamentos: [], dbConfigured: false });
    return;
  }
  const pagamentos = await dbListPagamentos(300);
  res.status(200).json({ pagamentos: pagamentos, dbConfigured: true });
}

async function actionUpdateConfig(req, res, body) {
  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  if (!dbConfigured()) {
    res.status(500).json({ error: 'banco de dados (supabase) não configurado no servidor' });
    return;
  }

  const fields = {};
  if (body.basePrice !== undefined && body.basePrice !== '') fields.base_price = parseFloat(body.basePrice);
  if (body.manutencaoPrice !== undefined && body.manutencaoPrice !== '') {
    fields.manutencao_price = parseFloat(body.manutencaoPrice);
  }
  if (body.acompanhamentoPrice !== undefined && body.acompanhamentoPrice !== '') {
    fields.acompanhamento_price = parseFloat(body.acompanhamentoPrice);
  }
  if (body.supportPrice !== undefined && body.supportPrice !== '') {
    fields.support_price = parseFloat(body.supportPrice);
  }
  if (body.manutencaoVagas !== undefined) fields.manutencao_vagas = String(body.manutencaoVagas);

  for (const key of ['base_price', 'manutencao_price', 'acompanhamento_price', 'support_price']) {
    if (key in fields && (isNaN(fields[key]) || fields[key] < 0)) {
      res.status(400).json({ error: 'preço inválido' });
      return;
    }
  }

  // preços das ferramentas do catálogo (guia, molda, e qualquer uma nova)
  // vêm num objeto único { guia: 39.9, molda: 29.9, ... } — cada um grava
  // no lugar certo (coluna fixa pras duas de sempre, campo genérico pro
  // resto) via dbSetPrecoProduto.
  const precos = body.precos && typeof body.precos === 'object' ? body.precos : {};
  for (const slug of Object.keys(precos)) {
    const valor = parseFloat(precos[slug]);
    if (precos[slug] === '' || precos[slug] === undefined) continue;
    if (isNaN(valor) || valor < 0) {
      res.status(400).json({ error: 'preço inválido' });
      return;
    }
    await dbSetPrecoProduto(slug, valor);
  }

  // links dos vídeos-tutorial de cada marco do guia — objeto único
  // { escopo: "https://drive...", "identidade-visual": "...", ... }.
  // string vazia limpa o link (marco volta a mostrar "em breve").
  const tutoriais = body.tutoriais && typeof body.tutoriais === 'object' ? body.tutoriais : {};
  let tutoriaisChanged = false;
  for (const key of Object.keys(tutoriais)) {
    if (typeof tutoriais[key] !== 'string') { delete tutoriais[key]; continue; }
    tutoriais[key] = tutoriais[key].trim();
    tutoriaisChanged = true;
  }
  if (tutoriaisChanged) {
    const ok = await dbSetTutoriais(tutoriais);
    if (!ok) {
      res.status(502).json({ error: 'falha ao salvar links de tutorial no banco' });
      return;
    }
  }

  if (Object.keys(fields).length === 0 && Object.keys(precos).length === 0 && !tutoriaisChanged) {
    res.status(400).json({ error: 'nada pra atualizar' });
    return;
  }

  if (Object.keys(fields).length > 0) {
    fields.updated_at = new Date().toISOString();
    const ok = await dbSetConfig(fields);
    if (!ok) {
      res.status(502).json({ error: 'falha ao salvar no banco' });
      return;
    }
  }

  res.status(200).json({ ok: true });
}

async function actionListProducts(req, res) {
  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  const produtos = await listProducts();
  res.status(200).json({ produtos: produtos });
}

// cria ou atualiza uma ferramenta do catálogo (editor completo do painel).
// pra guia/molda, isso só sobrescreve o conteúdo (nome, tagline, hero,
// confiança, funcionalidades, passos, faq, depoimentos) — os campos
// sensíveis a pagamento continuam fixos em lib/products.js e são
// ignorados aqui mesmo se vierem no body. uma ferramenta nova (slug que
// não é guia/molda) grava tudo, inclusive mp_description/app_path/venda_path.
async function actionSaveProduct(req, res, body) {
  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  if (!dbConfigured()) {
    res.status(500).json({ error: 'banco de dados (supabase) não configurado no servidor' });
    return;
  }

  const slug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const nome = String(body.nome || '').trim();
  if (!slug || !nome) {
    res.status(400).json({ error: 'slug e nome são obrigatórios' });
    return;
  }

  const preco = body.preco !== undefined && body.preco !== '' ? parseFloat(body.preco) : null;
  if (preco !== null && (isNaN(preco) || preco < 0)) {
    res.status(400).json({ error: 'preço inválido' });
    return;
  }

  const isFixo = slug === 'guia' || slug === 'molda';

  const record = {
    slug: slug,
    nome: nome,
    tagline: String(body.tagline || ''),
    ativo: body.ativo !== false,
    hero_titulo: String(body.heroTitulo || ''),
    hero_subtitulo: String(body.heroSubtitulo || ''),
    hero_positioning: String(body.heroPositioning || ''),
    trust_items: Array.isArray(body.trustItems) ? body.trustItems : [],
    features: Array.isArray(body.features) ? body.features : [],
    passos: Array.isArray(body.passos) ? body.passos : [],
    faq: Array.isArray(body.faq) ? body.faq : [],
    depoimentos: Array.isArray(body.depoimentos) ? body.depoimentos : []
  };

  // ferramenta nova (fora do catálogo fixo): grava também preço e os
  // campos de rota/pagamento, direto do formulário do painel.
  if (!isFixo) {
    record.preco = preco;
    record.mp_description = String(body.mpDescription || (nome + ' - estúdio avesso'));
    record.app_path = String(body.appPath || '');
    // sem página de venda própria informada, usa a página genérica
    // (/loja?p=slug), que já existe pronta e lê o conteúdo direto do que
    // for preenchido aqui — assim toda ferramenta nova já nasce com um
    // link pra divulgar, sem precisar de um html novo pra cada uma.
    record.venda_path = String(body.vendaPath || '').trim() || ('/loja?p=' + slug);
  }

  const ok = await dbUpsertProduto(record);
  if (!ok) {
    res.status(502).json({ error: 'falha ao salvar ferramenta no banco' });
    return;
  }

  // preço de guia/molda mora em `config` (colunas próprias), não em
  // `produtos` — grava pelo mesmo caminho já usado na tela de preços.
  if (isFixo && preco !== null) {
    await dbSetPrecoProduto(slug, preco);
  }

  res.status(200).json({ ok: true, slug: slug });
}

async function actionDeleteProduct(req, res, body) {
  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  const slug = String((req.query.slug || body.slug || '')).trim();
  if (!slug) {
    res.status(400).json({ error: 'slug obrigatório' });
    return;
  }
  if (slug === 'guia' || slug === 'molda') {
    res.status(400).json({ error: 'guia e molda não podem ser removidas — desative em vez de excluir' });
    return;
  }
  const ok = await dbDeleteProduto(slug);
  if (!ok) {
    res.status(502).json({ error: 'falha ao remover ferramenta no banco' });
    return;
  }
  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET' && req.query.action === 'sales') {
      await actionSales(req, res);
      return;
    }

    if (req.method === 'GET' && req.query.action === 'list-products') {
      await actionListProducts(req, res);
      return;
    }

    if (req.method === 'DELETE' || (req.method === 'GET' && req.query.action === 'delete-product')) {
      await actionDeleteProduct(req, res, {});
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const action = req.query.action || body.action;
    if (action === 'login') return actionLogin(req, res, body);
    if (action === 'update-config') return actionUpdateConfig(req, res, body);
    if (action === 'save-product') return actionSaveProduct(req, res, body);
    if (action === 'delete-product') return actionDeleteProduct(req, res, body);

    res.status(400).json({ error: 'ação inválida' });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
