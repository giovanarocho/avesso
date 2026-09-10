import { dbUpdateMoldaSenha, hashPassword, issueMoldaToken, moldaAuthConfigured, verifyMoldaResetToken } from '../lib/services.js';

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

  const token = String(body.token || '');
  const password = String(body.password || '');

  if (password.length < 8) {
    res.status(400).json({ error: 'a senha precisa ter pelo menos 8 caracteres' });
    return;
  }

  const email = verifyMoldaResetToken(token);
  if (!email) {
    res.status(400).json({ error: 'esse link de redefinição expirou ou é inválido — peça um novo' });
    return;
  }

  try {
    const { hash, salt } = hashPassword(password);
    const ok = await dbUpdateMoldaSenha(email, hash, salt);
    if (!ok) {
      res.status(500).json({ error: 'não consegui salvar a nova senha agora' });
      return;
    }
    const sessionToken = issueMoldaToken(email);
    res.status(200).json({ token: sessionToken, email });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
