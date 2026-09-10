import {
  dbConfigured,
  dbGetMoldaUsuario,
  dbGetPagamento,
  dbInsertMoldaUsuario,
  dbUpdateMoldaSenha,
  hashPassword,
  issueMoldaResetToken,
  issueMoldaToken,
  moldaAuthConfigured,
  sendMoldaResetEmail,
  verifyMoldaResetToken,
  verifyMoldaToken,
  verifyPassword
} from '../lib/services.js';

// tudo que é login/conta do molda, junto num arquivo só — ações separadas
// por ?action= (GET, pra sessão) ou body.action (POST, pro resto). isso
// existe só pra caber no limite de 12 funções serverless do plano hobby da
// vercel; o comportamento de cada ação é idêntico ao que era antes, quando
// cada uma tinha seu próprio arquivo (molda-login.js, molda-set-password.js,
// molda-request-reset.js, molda-reset-password.js, molda-session.js).

async function actionSession(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : (req.query.token || '');
  const email = verifyMoldaToken(token);
  if (!email) {
    res.status(200).json({ valid: false });
    return;
  }
  res.status(200).json({ valid: true, email });
}

async function actionLogin(req, res, body) {
  if (!moldaAuthConfigured()) {
    res.status(500).json({ error: 'MOLDA_SESSION_SECRET não configurado no servidor' });
    return;
  }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) {
    res.status(400).json({ error: 'e-mail e senha obrigatórios' });
    return;
  }
  const user = await dbGetMoldaUsuario(email);
  // mesma mensagem tanto pra "não existe" quanto pra "senha errada" —
  // não dá pista de qual e-mail tem conta ou não.
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    res.status(401).json({ error: 'e-mail ou senha incorretos' });
    return;
  }
  const token = issueMoldaToken(email);
  res.status(200).json({ token, email });
}

async function actionSetPassword(req, res, body) {
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
}

async function actionRequestReset(req, res, body) {
  if (!moldaAuthConfigured()) {
    res.status(500).json({ error: 'MOLDA_SESSION_SECRET não configurado no servidor' });
    return;
  }
  const SITE_URL = (process.env.SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')).replace(/\/$/, '');

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) {
    res.status(400).json({ error: 'e-mail inválido' });
    return;
  }

  const user = await dbGetMoldaUsuario(email);
  // sempre responde "ok" mesmo se a conta não existir — não dá pra
  // confirmar por aqui quais e-mails têm conta ou não.
  if (user) {
    const token = issueMoldaResetToken(email);
    const resetLink = (SITE_URL || '') + '/molda/app.html?reset=1&token=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email);
    await sendMoldaResetEmail(email, resetLink);
  }
  res.status(200).json({ ok: true });
}

async function actionResetPassword(req, res, body) {
  if (!moldaAuthConfigured()) {
    res.status(500).json({ error: 'MOLDA_SESSION_SECRET não configurado no servidor' });
    return;
  }

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

  const { hash, salt } = hashPassword(password);
  const ok = await dbUpdateMoldaSenha(email, hash, salt);
  if (!ok) {
    res.status(500).json({ error: 'não consegui salvar a nova senha agora' });
    return;
  }
  const sessionToken = issueMoldaToken(email);
  res.status(200).json({ token: sessionToken, email });
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
    if (req.method === 'GET' && req.query.action === 'session') {
      await actionSession(req, res);
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
    if (action === 'set-password') return actionSetPassword(req, res, body);
    if (action === 'request-reset') return actionRequestReset(req, res, body);
    if (action === 'reset-password') return actionResetPassword(req, res, body);

    res.status(400).json({ error: 'ação inválida' });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
