import { dbUpsertPagamento, resolvePrices } from '../lib/services.js';

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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const email = (body.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) {
    res.status(400).json({ error: 'e-mail inválido' });
    return;
  }

  // o valor cobrado vem sempre do servidor (banco, com a variável de
  // ambiente como reserva) — nunca do que o navegador manda.
  const { moldaPrice } = await resolvePrices();
  const amount = moldaPrice;

  try {
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now() + '-' + Math.random());

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ACCESS_TOKEN,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: 'Molda - estúdio avesso',
        payment_method_id: 'pix',
        payer: { email: email }
      })
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      res.status(502).json({ error: 'falha ao criar pagamento no mercado pago', details: data });
      return;
    }

    const txData = data.point_of_interaction && data.point_of_interaction.transaction_data;

    // guarda o registro do pagamento marcado como produto "molda" — é assim
    // que o check-status sabe que esse pagamento dá acesso ao molda (e não
    // ao guia) na hora de montar o link de criar senha.
    await dbUpsertPagamento({
      payment_id: String(data.id),
      email: email,
      amount: amount,
      status: data.status,
      code_sent: false,
      produto: 'molda'
    });

    res.status(200).json({
      payment_id: data.id,
      status: data.status,
      qr_code: txData ? txData.qr_code : null,
      qr_code_base64: txData ? txData.qr_code_base64 : null,
      ticket_url: txData ? txData.ticket_url : null,
      amount: amount
    });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
