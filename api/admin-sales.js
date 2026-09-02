import { verifyAdminToken, dbListPagamentos, dbConfigured } from '../lib/services.js';

function getToken(req) {
  const auth = (req.headers && req.headers.authorization) || '';
  return auth.indexOf('Bearer ') === 0 ? auth.slice(7) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!verifyAdminToken(getToken(req))) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }
  if (!dbConfigured()) {
    res.status(200).json({ pagamentos: [], dbConfigured: false });
    return;
  }

  const pagamentos = await dbListPagamentos(300);
  res.status(200).json({ pagamentos: pagamentos, dbConfigured: true });
}
