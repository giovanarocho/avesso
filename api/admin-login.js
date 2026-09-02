import { adminConfigured, checkAdminPassword, issueAdminToken } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  if (!adminConfigured()) {
    res.status(500).json({ error: 'ADMIN_PASSWORD não configurado no servidor' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  if (!checkAdminPassword(body.password)) {
    res.status(401).json({ error: 'senha incorreta' });
    return;
  }

  res.status(200).json({ token: issueAdminToken() });
}
