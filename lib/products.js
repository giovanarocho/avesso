// catálogo central das ferramentas vendidas por conta (e-mail + senha).
// pra adicionar uma ferramenta nova: adiciona uma entrada aqui e sobe a
// página da ferramenta — não precisa criar endpoint novo, nem mexer no
// checkout, no login, no painel ou na página /conta, porque todos eles
// leem esse arquivo pra saber quais produtos existem.
//
// "base pronta" e "manutenção contínua" não estão aqui de propósito — são
// os serviços sob consulta (formulário/whatsapp), não ferramentas de
// autoatendimento com conta.

export const PRODUCTS = [
  {
    slug: 'guia',
    nome: 'marketing essencial',
    tagline: 'o guia passo a passo',
    // usado pra achar o pagamento certo no mercado pago (bate com o texto
    // mandado em "description" na hora de criar o pix).
    mpDescription: 'Guia Marketing Essencial - estúdio avesso',
    // variável de ambiente e valor padrão, usados só se o preço não tiver
    // sido definido no banco (pelo painel) ainda.
    precoEnv: 'GUIA_PRICE',
    precoPadrao: 39.90,
    // pra onde a pessoa vai quando clica "abrir" na página /conta.
    appPath: '/guia/index.html',
    // página de venda própria da ferramenta (link direto, divulgável).
    vendaPath: '/guia-venda'
  },
  {
    slug: 'molda',
    nome: 'molda',
    tagline: 'gerador de conteúdo pra lançamentos',
    mpDescription: 'Molda - estúdio avesso',
    precoEnv: 'MOLDA_PRICE',
    precoPadrao: 29.90,
    appPath: '/molda/app.html',
    vendaPath: '/molda'
  }
];

export function getProduct(slug) {
  return PRODUCTS.find(function (p) { return p.slug === slug; }) || null;
}

// acha o produto a partir do texto salvo em "description" no mercado pago —
// usado pra conferir, no set-password e no check de pagamento, que o
// pagamento aprovado é mesmo do produto que a pessoa diz estar comprando.
export function getProductByMpDescription(description) {
  const text = String(description || '');
  return PRODUCTS.find(function (p) { return text.indexOf(p.mpDescription) !== -1; }) || null;
}
