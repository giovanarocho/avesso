import { dbGetPagamento, dbPatchPagamento, sendCodeEmail } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  // GUIA_LINK aponta pra página do guia (por padrão, /guia deste mesmo site).
  // essa página não é mais um segredo em si — ela pede um código de acesso,
  // que é o próprio id do pagamento, então dá pra deixar esse link público.
  const GUIA_PAGE = process.env.GUIA_LINK || '/guia';

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

    // o código de acesso (e o link com ele) só saem daqui quando o próprio
    // mercado pago confirma "approved" — nunca antes disso, e nunca
    // decidido pelo navegador.
    const approved = data.status === 'approved';
    const sep = GUIA_PAGE.indexOf('?') === -1 ? '?' : '&';

    if (approved) {
      // se tiver banco configurado: atualiza o status e, se o e-mail com o
      // código ainda não foi mandado pra esse pagamento, manda agora — só
      // uma vez (por isso confere "code_sent" antes).
      const row = await dbGetPagamento(paymentId);
      await dbPatchPagamento(paymentId, { status: 'approved' });
      if (row && row.email && !row.code_sent) {
        const sent = await sendCodeEmail(row.email, String(paymentId));
        if (sent) await dbPatchPagamento(paymentId, { code_sent: true });
      }
    }

    res.status(200).json({
      status: data.status,
      approved: approved,
      code: approved ? String(paymentId) : null,
      link: approved ? (GUIA_PAGE + sep + 'code=' + encodeURIComponent(String(paymentId))) : null
    });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
