# avesso — página de venda + checkout automático do guia

Isso é um projetinho completo pra publicar na Vercel (grátis). Ele tem:

- `index.html` — a página de venda nova (hero limpa, guia em destaque, depois os outros dois formatos).
- `guia/index.html` — o guia em si (o caderno interativo), protegido por um código de acesso.
- `api/` — 5 funções que rodam no servidor da Vercel (não no seu navegador) e conversam com o Mercado Pago pra gerar o pix, confirmar o pagamento e liberar o código de acesso do guia.

Sem isso, qualquer pessoa com o link do guia acessava sem pagar. Com isso, o guia fica atrás de um código de acesso — e esse código só é gerado depois que o Mercado Pago confirma o pagamento, no servidor. Não tem como "enganar" clicando em algum botão sem pagar de verdade.

### sobre o código de acesso (isso é novo)

O link `/guia` pode ficar público sem problema — ele mesmo pede o código antes de mostrar qualquer coisa. O código é simplesmente o número do pagamento pix da pessoa. Funciona assim:

1. Depois que o pix é confirmado, a tela mostra o código (e um botão "abrir o guia" que já leva o código junto no link, então na maioria das vezes a pessoa nem precisa digitar nada).
2. Se a pessoa fechar a aba e voltar depois, ela digita esse mesmo código na tela de acesso do guia (`/guia`) — ele fica salvo ali com “comprou e perdeu o código? fala com a gente no whatsapp” como saída, caso ela perca.
3. Uma vez validado uma vez naquele navegador, o guia libera sozinho nas próximas visitas (fica lembrado ali no aparelho).

Como não guardamos o pagamento em nenhum banco de dados nosso, quem verifica o código é sempre a própria API do Mercado Pago (`/api/verify-code`), na hora — não tem como fraudar digitando um código qualquer.

## passo a passo pra colocar no ar

### 1. crie sua conta no Mercado Pago (se ainda não tiver)

Vá em https://www.mercadopago.com.br, crie a conta (pode ser a mesma que você já usa pra vender).

### 2. pegue o Access Token de produção

1. Acesse https://www.mercadopago.com.br/developers/panel
2. Crie uma aplicação (qualquer nome, ex: "avesso guia")
3. Vá em **Credenciais de produção**
4. Copie o **Access Token** (começa com `APP_USR-...`) — guarde, você vai usar no passo 5.

### 3. crie uma conta na Vercel (grátis)

Vá em https://vercel.com/signup e crie a conta (pode entrar com o e-mail ou com GitHub).

### 4. suba este projeto

A forma mais simples, sem precisar de GitHub:

1. Instale a CLI da Vercel (uma vez só): abra o terminal e rode `npm i -g vercel`
2. Dentro da pasta deste projeto, rode `vercel` e siga as perguntas (aceite as opções padrão)
3. Ele vai te dar um link tipo `https://avesso-site.vercel.app` — esse já é o site funcionando (mas ainda sem as chaves configuradas, então o pix não vai gerar ainda).

Se preferir não usar terminal, você também pode:
1. Subir esta pasta pra um repositório no GitHub
2. Em https://vercel.com/new, importar esse repositório
3. Clicar em "Deploy"

### 5. configure as variáveis de ambiente

No painel da Vercel: **seu projeto > Settings > Environment Variables**, adicione:

| nome | valor |
|---|---|
| `MP_ACCESS_TOKEN` | o access token de produção que você copiou no passo 2 |
| `GUIA_LINK` | deixe em branco (o padrão já é `/guia`, a página que vem dentro deste projeto) — só preencha se um dia hospedar o guia em outro lugar |
| `GUIA_PRICE` | `39.90` |
| `BASE_PRICE` | `6000` |
| `MANUTENCAO_PRICE` | `1500` |
| `MANUTENCAO_VAGAS` | `restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.` |

Depois de salvar, vá na aba **Deployments**, clique nos "..." do último deploy e escolha **Redeploy** (isso é tudo que você precisa fazer sempre que quiser mudar um preço depois — trocar o valor aqui e clicar em redeploy, sem mexer em nenhum código).

### 5b. (opcional, mas recomendado) ative o e-mail automático do código + registro das vendas

Sem fazer isso, o site funciona normalmente — o código de acesso continua aparecendo na tela depois do pix. Com isso, o código também é mandado sozinho por e-mail, e toda venda fica registrada numa tabela que você pode consultar.

**banco de dados (supabase):**

1. Crie uma conta grátis em https://supabase.com e crie um novo projeto (escolha uma senha de banco qualquer, você não vai precisar dela).
2. Dentro do projeto, vá em **SQL Editor** → **New query**, cole o conteúdo do arquivo `supabase_schema.sql` (vem junto nesta pasta) e clique em **Run**. Isso cria a tabela `pagamentos`.
3. Vá em **Project Settings > API** e copie dois valores: a **Project URL** e a chave **service_role** (não é a `anon`/pública — é a outra, marcada como secreta).

**e-mail (resend):**

1. Crie uma conta grátis em https://resend.com (100 e-mails/dia grátis, dá bastante folga).
2. Vá em **Domains > Add Domain**, coloque `oestudioavesso.com.br` e siga as instruções — eles vão te dar alguns registros de DNS pra adicionar no mesmo lugar (registro.br) onde você configurou o domínio pra Vercel. Isso é necessário: sem verificar o domínio, o Resend só deixa mandar e-mail de teste pra você mesma, não pras suas clientes.
3. Depois do domínio aparecer como **verificado** (pode levar de minutos a algumas horas), vá em **API Keys > Create API Key** e copie a chave.

**juntando tudo na vercel:**

Volte em **Settings > Environment Variables** e adicione mais estas:

| nome | valor |
|---|---|
| `SUPABASE_URL` | a Project URL que você copiou |
| `SUPABASE_SERVICE_KEY` | a chave service_role que você copiou |
| `RESEND_API_KEY` | a chave que você criou no resend |
| `RESEND_FROM` | `estúdio avesso <guia@oestudioavesso.com.br>` (o domínio depois do @ precisa ser o que você verificou no resend) |
| `SITE_URL` | `https://oestudioavesso.com.br` |

Redeploy de novo depois de salvar. A partir daí, toda compra aprovada: manda o e-mail com o código automaticamente, e grava uma linha na tabela `pagamentos` do supabase (dá pra ver essa tabela a qualquer momento em **Table Editor**, dentro do próprio supabase — sem precisar de mim pra consultar).

### 6. teste com um pagamento pequeno de verdade

Recomendo gerar um pix de teste pagando com um valor baixo (pode temporariamente colocar `GUIA_PRICE=1` pra testar com R$1) antes de deixar no ar com o preço final. Depois volte o valor e clique em redeploy.

### 7. (opcional) use seu domínio próprio

Em **Settings > Domains** na Vercel, você pode apontar um domínio seu (tipo `avesso.com.br`) pra esse projeto, seguindo as instruções que a própria Vercel mostra na tela.

## como funciona por dentro (resumo)

1. A pessoa clica em "quero o guia — pagar com pix" e digita o e-mail.
2. A página chama `/api/create-payment`, que pede ao Mercado Pago pra gerar um pix (usando seu Access Token, que fica só no servidor, nunca no navegador de ninguém).
3. A página mostra o QR code e o código copia-e-cola, e começa a checar a cada 3 segundos se o pagamento já foi aprovado (`/api/check-status`).
4. Quando o Mercado Pago confirma o pagamento, `/api/check-status` responde com o código de acesso e o link `/guia?code=...` — só nesse momento eles aparecem na tela.
5. A pessoa clica em "abrir o guia": a página `/guia` lê o código da url, confirma com `/api/verify-code` (que também conversa direto com o Mercado Pago) e libera o conteúdo. O código fica salvo no navegador dela, então da próxima vez o guia libera sozinho.
6. Se você configurou o supabase e o resend (passo 5b): assim que `/api/check-status` vê o pagamento aprovado, ele manda o e-mail com o código (uma única vez por pagamento) e atualiza a linha da venda no banco. O `/api/webhook` faz a mesma coisa como reforço — útil se a pessoa pagar pelo app do banco e fechar a aba do site antes da confirmação aparecer na tela. Sem essas duas variáveis configuradas, esse passo simplesmente não acontece e o resto continua igual.

### (opcional) configurar o webhook no Mercado Pago

Isso deixa o envio de e-mail mais confiável (não depende da aba do site ficar aberta). No painel de desenvolvedor do Mercado Pago, na sua aplicação, procure por **Webhooks** / **Notificações** e cadastre a url `https://oestudioavesso.com.br/api/webhook` pro evento de pagamentos. Sem isso, tudo continua funcionando do mesmo jeito — só depende de a pessoa deixar a aba do site aberta até o pix confirmar (o que já é o padrão hoje).

## se quiser trocar algo depois

- **preço de qualquer um dos três serviços**: mude a variável de ambiente na Vercel e clique em redeploy. Não precisa mexer em código.
- **texto de vagas da manutenção**: mesma coisa, variável `MANUTENCAO_VAGAS`.
- **onde o guia está hospedado**: só mexe em `GUIA_LINK` se um dia tirar o guia daqui e hospedar em outro lugar. Do jeito que está, não precisa tocar nisso.
- **conteúdo do guia**: edite o `guia/index.html`.
- **textos, cores, seções da página de venda**: aí sim precisa editar o `index.html` (ou me pedir pra ajustar e te mandar o arquivo atualizado).
- **texto do e-mail do código**: no arquivo `lib/services.js`, dentro da função `sendCodeEmail` (ou me pede pra ajustar).
- **ver todas as vendas**: supabase.com > seu projeto > Table Editor > tabela `pagamentos`.
