import { dbUpsertPagamento, resolveProductPrice, confirmarPagamento } from '../lib/services.js';
import { getProduct } from '../lib/products.js';

// cria e confere pagamentos pix pra qualquer ferramenta do catálogo
// (lib/products.js) — um endpoint só, ação por ?action=create|status e
// produto por ?produto=guia|molda|... . antes disso existia um par de
// arquivos (create-payment.js/check-status.js) pra cada ferramenta; juntar
// aqui é o que deixa simples adicionar uma ferramenta nova sem criar
// função nenhuma no servidor.

async function actionCreate(req, res, body) {
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
    return;
  }

  const produtoSlug = String(req.query.produto || body.produto || '').trim();
  const produto = getProduct(produtoSlug);
  if (!produto) {
    res.status(400).json({ error: 'produto inválido' });
    return;
  }

  // no pix o e-mail vem direto do formulário (body.email); no cartão ele
  // vem de dentro do formData que o Payment Brick devolve (body.payer.email).
  const email = String(body.email || (body.payer && body.payer.email) || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) {
    res.status(400).json({ error: 'e-mail inválido' });
    return;
  }

  // o valor cobrado vem sempre do servidor (banco, com a variável de
  // ambiente como reserva) — nunca do que o navegador manda, assim
  // ninguém consegue "pagar menos" mexendo na página.
  const amount = await resolveProductPrice(produto.slug);

  const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now() + '-' + Math.random());

  // método vem do cliente só pra saber que payload montar — nunca decide o
  // valor cobrado (isso é sempre o `amount` resolvido acima).
  const metodo = body.method === 'cartao' ? 'cartao' : 'pix';

  let paymentBody;
  if (metodo === 'pix') {
    paymentBody = {
      transaction_amount: amount,
      description: produto.mpDescription,
      payment_method_id: 'pix',
      payer: { email: email }
    };
  } else {
    // cartão via Payment Brick: o número do cartão nunca passa pelo nosso
    // servidor — o Brick tokeniza direto no navegador da pessoa (a chamada
    // vai pro Mercado Pago via JS SDK deles), aqui só chega o token pronto.
    const token = String(body.token || '');
    const paymentMethodId = String(body.payment_method_id || '');
    if (!token || !paymentMethodId) {
      res.status(400).json({ error: 'dados do cartão incompletos' });
      return;
    }
    paymentBody = {
      transaction_amount: amount,
      description: produto.mpDescription,
      token: token,
      installments: parseInt(body.installments, 10) || 1,
      payment_method_id: paymentMethodId,
      payer: {
        email: email,
        identification: (body.payer && body.payer.identification) || undefined
      }
    };
    if (body.issuer_id) paymentBody.issuer_id = body.issuer_id;
  }

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(paymentBody)
  });

  const data = await mpRes.json();
  if (!mpRes.ok) {
    res.status(502).json({ error: 'falha ao criar pagamento no mercado pago', details: data });
    return;
  }

  const txData = data.point_of_interaction && data.point_of_interaction.transaction_data;

  // guarda o registro do pagamento marcado com o produto — é assim que o
  // "status" sabe qual ferramenta liberar quando o pagamento confirmar.
  await dbUpsertPagamento({
    payment_id: String(data.id),
    email: email,
    amount: amount,
    status: data.status,
    code_sent: false,
    produto: produto.slug
  });

  res.status(200).json({
    payment_id: data.id,
    status: data.status,
    status_detail: data.status_detail || null,
    qr_code: txData ? txData.qr_code : null,
    qr_code_base64: txData ? txData.qr_code_base64 : null,
    ticket_url: txData ? txData.ticket_url : null,
    amount: amount
  });
}

async function actionStatus(req, res) {
  const paymentId = req.query.payment_id;
  if (!paymentId) {
    res.status(400).json({ error: 'payment_id obrigatório' });
    return;
  }

  const result = await confirmarPagamento(paymentId);
  if (!result.ok) {
    res.status(result.error === 'pagamento não encontrado' ? 400 : 500).json({ error: result.error });
    return;
  }

  res.status(200).json({
    status: result.status,
    approved: result.approved,
    hasAccount: result.hasAccount,
    contaLink: result.contaLink
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const action = req.query.action;

    if (action === 'status') {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'method not allowed' });
        return;
      }
      await actionStatus(req, res);
      return;
    }

    if (action === 'create') {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'method not allowed' });
        return;
      }
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      body = body || {};
      await actionCreate(req, res, body);
      return;
    }

    res.status(400).json({ error: 'ação inválida' });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
