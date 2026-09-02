import { resolvePrices } from '../lib/services.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const prices = await resolvePrices();
  res.status(200).json(prices);
}
