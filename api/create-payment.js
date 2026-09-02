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

  const email = (body.email || '').trim();
  if (!email || email.indexOf('@') === -1) {
    res.status(400).json({ error: 'e-mail inválido' });
    return;
  }

  // o valor cobrado vem sempre do servidor (banco, com a variável de
  // ambiente como reserva) — nunca do que o navegador manda, assim
  // ninguém consegue "pagar menos" mexendo na página. é o mesmo valor que
  // o /api/config mostra na tela, e o mesmo que o painel /painel edita.
  const { guiaPrice } = await resolvePrices();
  const amount = guiaPrice;

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
        description: 'Guia Marketing Essencial - estúdio avesso',
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

    // guarda o registro do pagamento (se o supabase estiver configurado) —
    // é daqui que o check-status vai pegar o e-mail depois, pra mandar o
    // código quando o pix confirmar. se isso falhar, não atrapalha o pix
    // (a função já engole o próprio erro; o await aqui é só pra garantir
    // que a função termine antes da vercel encerrar essa execução).
    await dbUpsertPagamento({
      payment_id: String(data.id),
      email: email,
      amount: amount,
      status: data.status,
      code_sent: false
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
