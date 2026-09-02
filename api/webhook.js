export default async function handler(req, res) {
  // O mercado pago manda uma notificação aqui a cada mudança de status.
  // Não é obrigatório pro fluxo de compra funcionar (o check-status já
  // confirma direto na API do mercado pago), mas fica registrado nos logs
  // da vercel — útil pra conferir depois se precisar.
  try {
    console.log('MP webhook query:', JSON.stringify(req.query));
    console.log('MP webhook body:', JSON.stringify(req.body));
  } catch (e) {
    // ignora erro de log
  }
  res.status(200).send('ok');
}
