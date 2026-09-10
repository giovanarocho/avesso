import {
  adminConfigured,
  checkAdminPassword,
  dbConfigured,
  dbListPagamentos,
  dbSetConfig,
  dbSetPrecoProduto,
  issueAdminToken,
  verifyAdminToken
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
  if (body.manutencaoVagas !== undefined) fields.manutencao_vagas = String(body.manutencaoVagas);

  for (const key of ['base_price', 'manutencao_price']) {
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

  if (Object.keys(fields).length === 0 && Object.keys(precos).length === 0) {
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

    res.status(400).json({ error: 'ação inválida' });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
