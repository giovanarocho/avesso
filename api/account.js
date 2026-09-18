import { verifyContaToken, dbListComprasAprovadas, resolvePrices, listProducts } from '../lib/services.js';

// devolve, pra quem está logado, a lista de ferramentas que já tem acesso
// (com o link pra abrir) e as que ainda não comprou (com o preço, pra
// mostrar o botão de comprar direto na página /conta). isso é o que faz
// uma ferramenta nova aparecer sozinha pra todo mundo — sem precisar
// avisar cada conta ou mudar nada aqui: ela só precisa estar no catálogo
// (guia/molda em lib/products.js, ou uma ferramenta nova criada pelo
// painel, salva direto na tabela `produtos`) e marcada como ativa.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const auth = req.headers.authorization || '';
  const token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : '';
  const email = verifyContaToken(token);
  if (!email) {
    res.status(401).json({ error: 'não autorizado' });
    return;
  }

  try {
    const [compradas, prices, catalogo] = await Promise.all([
      dbListComprasAprovadas(email),
      resolvePrices(),
      listProducts()
    ]);
    const owned = new Set(compradas);

    const produtos = catalogo
      .filter(function (p) { return p.ativo !== false; })
      .map(function (p) {
        return {
          slug: p.slug,
          nome: p.nome,
          tagline: p.tagline,
          owned: owned.has(p.slug),
          appPath: p.appPath,
          vendaPath: p.vendaPath,
          preco: prices.precos[p.slug]
        };
      });

    res.status(200).json({ email: email, produtos: produtos });
  } catch (err) {
    res.status(500).json({ error: 'erro interno', message: err.message });
  }
}
