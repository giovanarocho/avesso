import { verifyAdminToken, dbSetConfig, dbConfigured } from '../lib/services.js';

function getToken(req) {
  const auth = (req.headers && req.headers.authorization) || '';
  return auth.indexOf('Bearer ') === 0 ? auth.slice(7) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  if (!dbConfigured()) {
    res.status(500).json({ error: 'banco de dados (supabase) não configurado no servidor' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

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
