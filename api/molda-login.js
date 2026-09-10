import { dbGetMoldaUsuario, issueMoldaToken, moldaAuthConfigured, verifyPassword } from '../lib/services.js';

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
  if (!moldaAuthConfigured()) {
    res.status(500).json({ error: 'MOLDA_SESSION_SECRET não configurado no servidor' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    res.status(400).json({ error: 'e-mail e senha obrigatórios' });
    return;
  }

  try {
    const user = await dbGetMoldaUsuario(email);
    // mesma mensagem tanto pra "não existe" quanto pra "senha errada" —
    // não dá pista de qual e-mail tem conta ou não.
    if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
      res.status(401).json({ error: 'e-mail ou senha incorretos' });
      return;
    }
    const token = issueMoldaToken(email);
    res.status(200).json({ token, email });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
