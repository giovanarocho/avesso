// catálogo "fixo" das ferramentas que têm campos sensíveis ao pagamento
// (guia e molda) — esses campos nunca vêm do banco, só daqui, por
// segurança: se alguém conseguisse escrever na tabela `produtos`, não dá
// pra redirecionar o pagamento de "guia" pra outro appPath/mpDescription.
//
// qualquer ferramenta nova, criada pelo painel (/painel → ferramentas),
// não precisa de entrada aqui — ela vive inteira na tabela `produtos` do
// supabase. quem junta as duas fontes (esse arquivo + banco) é
// lib/services.js → listProducts().
//
// "base pronta" e "manutenção contínua" não estão aqui de propósito — são
// os serviços sob consulta (formulário/whatsapp), não ferramentas de
// autoatendimento com conta.

export const DEFAULT_PRODUCTS = [
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
