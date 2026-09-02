import { dbPatchPagamento } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  const code = (req.query.code || '').toString().trim();

  if (!code) {
    res.status(400).json({ valid: false, error: 'código obrigatório' });
    return;
  }
  if (!ACCESS_TOKEN) {
    res.status(500).json({ valid: false, error: 'MP_ACCESS_TOKEN não configurado no servidor' });
    return;
  }

  try {
    // o "código de acesso" que a cliente digita é o próprio id do pagamento
    // pix no mercado pago. quem confirma se ele é válido é sempre a própria
    // api do mercado pago, na hora — nunca um banco nosso.
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(code), {
      headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN }
    });

    if (!mpRes.ok) {
      // código não existe, não é um pagamento válido, etc.
      res.status(200).json({ valid: false });
      return;
    }

    const data = await mpRes.json();
    const isGuia = (data.description || '').indexOf('Guia Marketing Essencial') !== -1;
    const valid = data.status === 'approved' && isGuia;

    if (valid) {
      // se tiver banco configurado, registra a primeira vez que esse código
      // foi usado pra abrir o guia (só preenche se ainda estiver vazio —
      // não sobrescreve a cada novo acesso). puramente informativo.
      await dbPatchPagamento(code, { guia_acessado_em: new Date().toISOString() }, '&guia_acessado_em=is.null');
    }

    res.status(200).json({ valid: valid });
  } catch (err) {
    res.status(500).json({ valid: false, error: 'erro interno' });
  }
}
