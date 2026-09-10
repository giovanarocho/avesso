import {
  adminConfigured,
  checkAdminPassword,
  dbConfigured,
  dbListPagamentos,
  dbSetConfig,
  issueAdminToken,
  verifyAdminToken
} from '../lib/services.js';

// login, lista de vendas e edição de preços do painel, juntos num arquivo
// só (ações por ?action=) — só pra caber no limite de 12 funções
// serverless do plano hobby da vercel. comportamento idêntico ao que era
// antes em admin-login.js, admin-sales.js e admin-update-config.js.

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
  if (body.guiaPrice !== undefined && body.guiaPrice !== '') fields.guia_price = parseFloat(body.guiaPrice);
  if (body.basePrice !== undefined && body.basePrice !== '') fields.base_price = parseFloat(body.basePrice);
  if (body.manutencaoPrice !== undefined && body.manutencaoPrice !== '') {
    fields.manutencao_price = parseFloat(body.manutencaoPrice);
  }
  if (body.manutencaoVagas !== undefined) fields.manutencao_vagas = String(body.manutencaoVagas);
  if (body.moldaPrice !== undefined && body.moldaPrice !== '') fields.molda_price = parseFloat(body.moldaPrice);

  for (const key of ['guia_price', 'base_price', 'manutencao_price', 'molda_price']) {
    if (key in fields && (isNaN(fields[key]) || fields[key] < 0)) {
      res.status(400).json({ error: 'preço inválido' });
      return;
    }
  }

  if (Object.keys(fields).length === 0) {
    res.status(400).json({ error: 'nada pra atualizar' });
    return;
  }
  fields.updated_at = new Date().toISOString();

  const ok = await dbSetConfig(fields);
  if (!ok) {
    res.status(502).json({ error: 'falha ao salvar no banco' });
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
