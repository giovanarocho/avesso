import { confirmarPagamento } from '../lib/services.js';

export default async function handler(req, res) {
  // O mercado pago manda uma notificação aqui a cada mudança de status.
  // Não é obrigatório pro fluxo de compra funcionar (o /api/payment?action=
  // status, que a própria página chama enquanto espera o pix, já cobre
  // isso) — mas serve de reforço: se a cliente pagar e fechar a aba na
  // hora, é esse aviso que garante que o e-mail sai mesmo assim.
  try {
    console.log('MP webhook query:', JSON.stringify(req.query));
    console.log('MP webhook body:', JSON.stringify(req.body));

    const paymentId = extractPaymentId(req);
    if (paymentId) {
      await confirmarPagamento(paymentId);
    }
  } catch (e) {
    console.log('erro processando webhook (respondendo 200 mesmo assim):', e.message);
  }

  // sempre responde 200 rápido — é o que o mercado pago espera, mesmo se
  // algo acima falhar.
  res.status(200).send('ok');
}

function extractPaymentId(req) {
  const q = req.query || {};
  const body = req.body || {};
  return (
    q['data.id'] ||
    (body.data && body.data.id) ||
    q.id ||
    body.id ||
    null
  );
}
