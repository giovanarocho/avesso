# Integração Rocholab + Avesso — o que foi feito

## Como ficou a estrutura

Usei o **avesso-main** como base técnica (é o que já tem login, contas,
pagamento via Pix/Mercado Pago e entrega dos infoprodutos funcionando de
verdade). Em cima dele, adicionei:

- `/portfolio` — o portfólio do Rocho Lab, portado do `public_html`,
  com o mesmo sistema de planilha do Google já funcionando (nada mudou
  na planilha, o ID continua o mesmo).
- `/diagnostico` — a página do Diagnóstico de Posicionamento gratuito
  que construímos juntas, agora rodando com um backend de verdade
  (`/api/diagnostico.js`), não mais dependente do Claude.ai. Funciona
  pra qualquer visitante do site.
- `/assets/identidade-rocholab` — logo e notas de paleta/tipografia do
  Rocho Lab, prontos pra usar quando remontarmos a home.

A **home continua sendo a página de venda da Avesso por enquanto** —
de propósito. Você disse que ainda não decidiu como ela deve funcionar
com o novo posicionamento, e mexer nisso agora seria arriscar deixar
rasa ou bagunçada. Quando quiser, fazemos essa parte com calma, como
uma conversa própria.

## O que troquei

- E-mail de contato do formulário do portfólio: `suporte@rocholab.com`
  (estava com o e-mail pessoal).
- Exemplos de `.env` (`RESEND_FROM`, `SITE_URL`) atualizados pra
  refletir o domínio `rocholab.com` — mas são só exemplos; o valor real
  é configurado direto na Vercel (ver abaixo).

## O que eu NÃO toquei (de propósito) e por quê

- **Formulário principal da home (Formspree)**: o destino desse
  formulário é configurado no painel do próprio Formspree, não no
  código — não dá pra eu trocar por aqui. Se quiser mudar pra
  `suporte@rocholab.com`, é só atualizar lá.
- **"estúdio avesso" nos e-mails automáticos e na descrição dos
  pagamentos** (`lib/services.js`, `api/create-payment.js`,
  `api/molda-create-payment.js`): esses textos aparecem nos e-mails de
  acesso liberado, redefinição de senha, e na descrição que o Mercado
  Pago usa pra confirmar automaticamente qual produto foi comprado. Dá
  pra trocar pra "rocholab", mas eu preferi não mexer sem sua
  confirmação — é código que toca pagamento de cliente de verdade, e
  uma etapa mal feita aqui pode quebrar a confirmação automática de
  compra. Me avisa quando quiser que eu faça essa troca com cuidado.

## O que falta pra colocar no ar

1. **Hospedagem**: esse projeto precisa rodar num lugar que execute
   JavaScript no servidor (as pastas `/api`) — a Vercel é o que já
   está sendo usado. Não dá pra simplesmente subir os arquivos num
   servidor de arquivos estático (como costuma ser o caso na
   Hostinger) porque o login, o pagamento e agora o diagnóstico
   dependem dessas funções de servidor.
2. **Variáveis de ambiente na Vercel**: além das que já devem estar
   configuradas (Mercado Pago, Supabase, Resend), adicionar a nova:
   `ANTHROPIC_API_KEY` (pra fazer o diagnóstico funcionar). Se ainda
   não tiver uma, é criada em console.anthropic.com.
3. **Domínio**: apontar `rocholab.com` pra esse projeto na Vercel
   (hoje ele deve estar em `oestudioavesso.com.br` ou num subdomínio
   da própria Vercel).
4. **A home**: decidir com calma como ela vai comunicar o novo
   posicionamento — separado desse trabalho de estrutura.
