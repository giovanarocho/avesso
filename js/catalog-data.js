/* ==========================================================================
   PORTFÓLIO — ROCHO LAB (dados de reserva)
   ==========================================================================
   A partir de agora, o jeito recomendado de atualizar o catálogo é pela
   planilha do Google Sheets (veja js/catalog-config.js e o guia
   GUIA-CATALOGO.pdf). Este arquivo entra em ação como "plano B": se a
   planilha ainda não estiver configurada, ou ficar fora do ar por
   qualquer motivo, o site mostra os projetos daqui, pra nunca ficar com
   a página vazia.

   Se quiser, ainda dá pra editar um projeto direto aqui (funciona igual
   antes) — mas o mais prático pro dia a dia é usar a planilha.

   Categorias (não mude as chaves "identidade" / "sites" / "social" /
   "outros" — elas são usadas pelos filtros e pelos links da prévia):

   1) IDENTIDADE — cada marca é uma apresentação própria, com Problema e
      Solução. Pra adicionar uma marca: crie uma pasta em
      /assets/portfolio2/identidade/nome-da-marca/ com as imagens numeradas
      (0.webp, 1.webp...) e copie um bloco abaixo.

   2) SITES — uma peça grande por projeto (print da página inteira), com
      título e uma etiqueta curta — sem parágrafo de descrição. Só uma
      "intro" geral explicando o que é uma landing page. Pra adicionar um
      projeto nesta categoria, copie um bloco de "items" abaixo e coloque
      o arquivo em /assets/portfolio2/sites/.

   3) SOCIAL — mesma lógica dos sites: lista simples de posts, sem
      descrição por projeto, com uma "intro" geral sobre materiais pra
      redes sociais.

   4) OUTROS — também é lista simples (sem separar por marca), mas cada
      imagem aqui é exibida grande, uma embaixo da outra, sem cortar nem
      obedecer uma proporção fixa — porque materiais como cardápios não
      têm o mesmo formato de uma foto ou de um post.
   ========================================================================== */

const FALLBACK_PORTFOLIO = {

  identidade: {
    label: "Identidade visual",
    items: [
      {
        slug: "jasu",
        title: "Jasu",
        category: "moda • plus size • roupas sob medida",
        problem: "A Jasu conquistou seu espaço pela excelência na criação de roupas plus size sob medida, mas sua identidade visual já não refletia a qualidade, o cuidado e a exclusividade presentes em cada peça.",
        solution: "Para fortalecer esse diferencial, desenvolvemos uma marca que traduz acolhimento, elegância e autenticidade, posicionando a Jasu como referência em moda plus size feita para valorizar cada corpo.",
        images: [
          "/assets/portfolio2/identidade/jasu/0.webp",
          "/assets/portfolio2/identidade/jasu/1.webp",
          "/assets/portfolio2/identidade/jasu/2.webp"
        ]
      },
      {
        slug: "bemvita",
        title: "BemVita",
        category: "desenvolvimento infantil • psicologia • psicopedagogia",
        problem: "A BemVita atuava com excelência no cuidado ao desenvolvimento infantil, mas sua comunicação visual não transmitia o acolhimento, a confiança e a especialização que a clínica oferecia às famílias.",
        solution: "Criamos uma identidade visual acolhedora e ao mesmo tempo especializada, capaz de transmitir cuidado sem infantilizar e segurança sem parecer fria — posicionando a BemVita como referência no desenvolvimento infantil.",
        images: [
          "/assets/portfolio2/identidade/bemvita/0.webp",
          "/assets/portfolio2/identidade/bemvita/1.webp"
        ]
      },
      {
        slug: "essenza",
        title: "Essenza",
        category: "móveis sob medida • feito por e para mulheres exigentes",
        problem: "A Essenza entregava móveis sob medida de alto padrão, mas sua identidade visual não refletia o nível de sofisticação, inteligência e excelência presentes em cada projeto, limitando a percepção de valor da marca e seu posicionamento no mercado.",
        solution: "Desenvolvemos uma identidade visual minimalista e sofisticada, pensada para comunicar exclusividade e alto padrão em todos os pontos de contato. O resultado é uma marca elegante e estratégica, alinhada ao conceito de móveis feitos por e para mulheres exigentes.",
        images: [
          "/assets/portfolio2/identidade/essenza/0.webp",
          "/assets/portfolio2/identidade/essenza/1.webp",
          "/assets/portfolio2/identidade/essenza/2.webp"
        ]
      },
      {
        slug: "brasa",
        title: "Brasa",
        category: "gastronomia • delivery",
        problem: "A Brasa nasceu para entregar o gostinho do churrasco de domingo em qualquer dia da semana, mas ainda não tinha uma identidade visual com a mesma personalidade descontraída e o sabor que a marca promete entregar.",
        solution: "Desenvolvemos uma identidade divertida e saborosa — com mascote, paleta vibrante e aplicações que vão da caixa de delivery à embalagem — posicionando a Brasa como aquele churrasco de domingo que virou rotina.",
        images: [
          "/assets/portfolio2/identidade/brasa/0.webp"
        ]
      }
    ]
  },

  sites: {
    label: "Sites & landing pages",
    intro: "Uma landing page ou site institucional é o lugar onde a marca para de se explicar aos pedaços e passa a comunicar tudo de uma vez: identidade, informação e propósito, numa página só. É a página que representa o negócio antes mesmo de alguém falar com você — por isso cada escolha ali, do texto ao botão, precisa ter uma razão de existir. Alguns sites e landing pages que já saíram do laboratório — role a imagem pra ver a página inteira:",
    items: [
      {
        image: "/assets/portfolio2/sites/showcase-tempocriativo.webp",
        title: "Tempo Criativo",
        tag: "e-commerce • velas e presentes artesanais"
      },
      {
        image: "/assets/portfolio2/sites/showcase-essenza.webp",
        title: "Essenza",
        tag: "institucional • marcenaria sob medida"
      },
      {
        image: "/assets/portfolio2/sites/showcase-jasu.webp",
        title: "Jasu",
        tag: "e-commerce • moda plus size"
      }
    ]
  },

  social: {
    label: "Sistemas visuais",
    intro: "Redes sociais pedem um tipo de comunicação que muda de formato o tempo todo — carrossel, post estático, story, feed — mas que precisa continuar parecendo a mesma marca em qualquer um deles. Uma seleção de peças feitas para Instagram e outras plataformas, sempre pensadas para funcionar em conjunto, não como posts avulsos:",
    images: [
      "/assets/portfolio2/social/0.webp","/assets/portfolio2/social/1.webp","/assets/portfolio2/social/2.webp",
      "/assets/portfolio2/social/3.webp","/assets/portfolio2/social/4.webp","/assets/portfolio2/social/5.webp",
      "/assets/portfolio2/social/6.webp","/assets/portfolio2/social/7.webp","/assets/portfolio2/social/8.webp",
      "/assets/portfolio2/social/9.webp","/assets/portfolio2/social/10.webp","/assets/portfolio2/social/11.webp",
      "/assets/portfolio2/social/12.webp","/assets/portfolio2/social/13.webp","/assets/portfolio2/social/14.webp",
      "/assets/portfolio2/social/15.webp","/assets/portfolio2/social/16.webp","/assets/portfolio2/social/17.webp",
      "/assets/portfolio2/social/18.webp","/assets/portfolio2/social/19.webp","/assets/portfolio2/social/20.webp",
      "/assets/portfolio2/social/21.webp","/assets/portfolio2/social/22.webp","/assets/portfolio2/social/23.webp",
      "/assets/portfolio2/social/24.webp","/assets/portfolio2/social/25.webp","/assets/portfolio2/social/26.webp",
      "/assets/portfolio2/social/27.webp","/assets/portfolio2/social/28.webp","/assets/portfolio2/social/29.webp",
      "/assets/portfolio2/social/30.webp","/assets/portfolio2/social/31.webp","/assets/portfolio2/social/32.webp",
      "/assets/portfolio2/social/33.webp","/assets/portfolio2/social/34.webp","/assets/portfolio2/social/35.webp"
    ]
  },

  outros: {
    label: "Outros",
    intro: "Nem tudo que uma marca precisa comunicar cabe num site ou num post. Cardápio, papelaria, embalagem — cada material tem seu próprio formato e sua própria função, mas continua seguindo a mesma linha visual do resto da marca. Alguns desses materiais que já saíram do laboratório:",
    images: [
      "/assets/portfolio2/outros/0.webp",
      "/assets/portfolio2/outros/1.webp"
    ]
  }

};

/* capas usadas na prévia do portfólio, na home — 6 cartões fixos, em 2
   linhas de 3: jasu / bemvita / brasa na primeira, sites / social /
   outros na segunda. pra trocar uma capa, só troque o caminho da
   imagem — a ordem deste array é a ordem que aparece na tela. */
const FALLBACK_TEASER_COVERS = [
  { image: "/assets/portfolio2/identidade/jasu/0.webp", title: "Jasu — moda plus size", cat: "Identidade visual", href: "/portfolio?cat=identidade#jasu" },
  { image: "/assets/portfolio2/identidade/bemvita/0.webp", title: "BemVita — psicologia infantil", cat: "Identidade visual", href: "/portfolio?cat=identidade#bemvita" },
  { image: "/assets/portfolio2/identidade/brasa/0.webp", title: "Brasa — Delivery", cat: "Identidade visual", href: "/portfolio?cat=identidade#brasa" },
  { image: "/assets/portfolio2/sites/0.webp", title: "Sites & landing pages", cat: "Sites & landing pages", href: "/portfolio?cat=sites" },
  { image: "/assets/portfolio2/social/35.webp", title: "Sistemas visuais", cat: "Sistemas visuais", href: "/portfolio?cat=social" },
  { image: "/assets/portfolio2/outros/1.webp", title: "Outros materiais", cat: "Outros", href: "/portfolio?cat=outros" }
];
