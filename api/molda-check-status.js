import { dbGetPagamento, dbPatchPagamento, sendMoldaBoasVindasEmail } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  const SITE_URL = (process.env.SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')).replace(/\/$/, '');

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

    // o link de criar senha só sai daqui quando o próprio mercado pago
    // confirma "approved" — nunca antes, e nunca decidido pelo navegador.
    // o passo de criar a conta em si (molda-set-password) confere tudo de
    // novo, então isso aqui é só pra guiar a pessoa pra tela certa.
    const approved = data.status === 'approved';

    let setupLink = null;
    if (approved) {
      const row = await dbGetPagamento(paymentId);
      await dbPatchPagamento(paymentId, { status: 'approved' });

      const email = row && row.email;
      setupLink = (SITE_URL || '') + '/molda/app.html?setup=1&payment_id=' + encodeURIComponent(String(paymentId)) +
        (email ? '&email=' + encodeURIComponent(email) : '');

      if (row && row.email && !row.code_sent) {
        const sent = await sendMoldaBoasVindasEmail(row.email, setupLink);
        if (sent) await dbPatchPagamento(paymentId, { code_sent: true });
      }
    }

    res.status(200).json({
      status: data.status,
      approved: approved,
      setupLink: setupLink
    });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
