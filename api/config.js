import { resolvePrices } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const prices = await resolvePrices();
  // a public key do Mercado Pago é feita pra ficar no navegador (diferente
  // do MP_ACCESS_TOKEN, que é secreto e só usado no servidor) — é o que o
  // Payment Brick usa no checkout com cartão.
  prices.mpPublicKey = process.env.MP_PUBLIC_KEY || null;
  res.status(200).json(prices);
}
