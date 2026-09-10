import { verifyMoldaToken } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  const auth = req.headers.authorization || '';
  const token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : (req.query.token || '');

  const email = verifyMoldaToken(token);
  if (!email) {
    res.status(200).json({ valid: false });
    return;
  }
  res.status(200).json({ valid: true, email });
}
