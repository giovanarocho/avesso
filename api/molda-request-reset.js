import { dbGetMoldaUsuario, issueMoldaResetToken, moldaAuthConfigured, sendMoldaResetEmail } from '../lib/services.js';

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

  const SITE_URL = (process.env.SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')).replace(/\/$/, '');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) {
    res.status(400).json({ error: 'e-mail inválido' });
    return;
  }

  try {
    const user = await dbGetMoldaUsuario(email);
    // sempre responde "ok" mesmo se a conta não existir — não dá pra
    // confirmar por aqui quais e-mails têm conta ou não.
    if (user) {
      const token = issueMoldaResetToken(email);
      const resetLink = (SITE_URL || '') + '/molda/app.html?reset=1&token=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email);
      await sendMoldaResetEmail(email, resetLink);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
