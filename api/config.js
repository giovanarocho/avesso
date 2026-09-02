export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const guiaPrice = parseFloat(process.env.GUIA_PRICE || '39.90');
  const basePrice = parseFloat(process.env.BASE_PRICE || '6000');
  const manutencaoPrice = parseFloat(process.env.MANUTENCAO_PRICE || '1500');
  const manutencaoVagas = process.env.MANUTENCAO_VAGAS ||
    'restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.';

  res.status(200).json({
    guiaPrice: guiaPrice,
    basePrice: basePrice,
    manutencaoPrice: manutencaoPrice,
    manutencaoVagas: manutencaoVagas
  });
}
