export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  const GUIA_LINK = process.env.GUIA_LINK || '';

  const paymentId = req.query.payment_id;
  if (!paymentId) {
    res.status(400).json({ error: 'payment_id obrigatório' });
    return;
  }
  if (!ACCESS_TOKEN) {
    res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
    return;
  }

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + paymentId, {
      headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN }
    });
    const data = await mpRes.json();

    if (!mpRes.ok) {
      res.status(502).json({ error: 'falha ao consultar pagamento', details: data });
      return;
    }

    // o link do guia só sai daqui quando o próprio mercado pago confirma
    // "approved" — nunca antes disso, e nunca decidido pelo navegador.
    const approved = data.status === 'approved';

    res.status(200).json({
      status: data.status,
      approved: approved,
      link: approved ? GUIA_LINK : null
    });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
