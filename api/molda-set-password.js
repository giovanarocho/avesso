import {
  dbConfigured,
  dbGetPagamento,
  dbInsertMoldaUsuario,
  hashPassword,
  issueMoldaToken,
  moldaAuthConfigured
} from '../lib/services.js';

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

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
    return;
  }
  if (!moldaAuthConfigured()) {
    res.status(500).json({ error: 'MOLDA_SESSION_SECRET não configurado no servidor' });
    return;
  }
  if (!dbConfigured()) {
    res.status(500).json({ error: 'banco não configurado — contas do molda precisam do supabase' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const paymentId = String(body.payment_id || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!paymentId) {
    res.status(400).json({ error: 'payment_id obrigatório' });
    return;
  }
  if (!email || email.indexOf('@') === -1) {
    res.status(400).json({ error: 'e-mail inválido' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'a senha precisa ter pelo menos 8 caracteres' });
    return;
  }

  try {
    // confere no mercado pago, ao vivo, que esse pagamento é aprovado e é
    // do molda — nunca confia em nada que venha só do navegador. mesmo
    // princípio anti-fraude do /api/verify-code do guia.
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
      headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN }
    });
    if (!mpRes.ok) {
      res.status(400).json({ error: 'pagamento não encontrado' });
      return;
    }
    const data = await mpRes.json();
    const isMolda = (data.description || '').indexOf('Molda') !== -1;
    if (data.status !== 'approved' || !isMolda) {
      res.status(400).json({ error: 'esse pagamento não confere ou ainda não foi aprovado' });
      return;
    }

    // o e-mail da conta tem que ser o mesmo que pagou — confere contra o
    // que ficou salvo no banco na hora da criação do pix.
    const row = await dbGetPagamento(paymentId);
    const emailOnFile = row && row.email ? String(row.email).toLowerCase() : null;
    if (emailOnFile && emailOnFile !== email) {
      res.status(400).json({ error: 'esse e-mail não confere com o do pagamento' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const created = await dbInsertMoldaUsuario({ email, password_hash: hash, password_salt: salt });
    if (!created) {
      res.status(409).json({ error: 'já existe uma conta com esse e-mail — faça login em vez de criar de novo' });
      return;
    }

    const token = issueMoldaToken(email);
    res.status(200).json({ token, email });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
