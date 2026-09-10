# avesso — página de venda + checkout automático das ferramentas

Isso é um projetinho completo pra publicar na Vercel (grátis). Ele tem:

- `index.html` — a página de venda principal (hero, proposta, seção "nossas ferramentas" com guia + molda, depois os outros dois formatos sob consulta).
- `guia-venda/index.html` e `molda/index.html` — a página de venda própria de cada ferramenta (link direto, divulgável sem passar pela home).
- `guia/index.html` e `molda/app.html` — as ferramentas em si, atrás de conta (e-mail + senha).
- `conta/index.html` — a página `/conta`: login único, "criar senha" (primeira compra), "esqueci a senha", e a lista de ferramentas que a pessoa já tem (com atalho pra abrir) e as que ainda não tem (com botão de comprar ali mesmo — fica fácil comprar uma segunda ferramenta depois).
- `shared/gate.js` e `shared/checkout.js` — dois arquivinhos reaproveitados por qualquer ferramenta: um tranca o acesso até confirmar login + posse daquela ferramenta (e manda pra `/conta` se faltar algo), o outro cuida do checkout pix inteiro (gerar QR, checar pagamento). **é isso que deixa simples adicionar uma ferramenta nova** — veja a seção "como adicionar uma ferramenta nova" mais abaixo.
- `lib/products.js` — o catálogo: uma lista com todas as ferramentas vendidas por conta. Login, checkout, painel e a página `/conta` leem daqui — não são arquivos separados por ferramenta.
- `painel/index.html` — o painel administrativo (`/painel`), protegido por senha: edita os preços de todas as ferramentas do catálogo (sem precisar de redeploy) e mostra a lista de vendas.
- `api/` — as 6 funções que rodam no servidor da Vercel: `payment.js` (criar/checar pix de qualquer ferramenta), `auth.js` (login/criar senha/redefinir senha/sessão), `account.js` (lista de ferramentas de quem está logado), `admin.js` (painel), `config.js` (preços pro site) e `webhook.js` (aviso do mercado pago).

## conta única pra tudo

Todo mundo que compra qualquer ferramenta usa a **mesma conta** (e-mail + senha). Na primeira compra, a pessoa cria a senha; nas próximas (de outra ferramenta), ela só entra com a senha de sempre — sem passar de novo pelo passo de criar conta. A página `/conta` mostra tudo: o que ela já tem (com atalho pra abrir) e o que ainda não tem (com botão de comprar).

Isso substitui o antigo "código de acesso" do guia (que era o próprio id do pagamento, sem senha nenhuma) — agora guia e molda funcionam do mesmo jeito.

## passo a passo pra colocar no ar

### 1. crie sua conta no Mercado Pago (se ainda não tiver)

Vá em https://www.mercadopago.com.br, crie a conta (pode ser a mesma que você já usa pra vender).

### 2. pegue o Access Token de produção

1. Acesse https://www.mercadopago.com.br/developers/panel
2. Crie uma aplicação (qualquer nome, ex: "avesso")
3. Vá em **Credenciais de produção**
4. Copie o **Access Token** (começa com `APP_USR-...`) — guarde, você vai usar no passo 5.

### 3. crie uma conta na Vercel (grátis)

Vá em https://vercel.com/signup e crie a conta (pode entrar com o e-mail ou com GitHub).

### 4. suba este projeto

A forma mais simples, sem precisar de terminal: sobe esta pasta pra um repositório no GitHub e importa em https://vercel.com/new.

Se preferir terminal: instale a CLI (`npm i -g vercel`) e, dentro da pasta do projeto, rode `vercel`.

### 5. configure as variáveis de ambiente

No painel da Vercel: **seu projeto > Settings > Environment Variables**, adicione:

| nome | valor |
|---|---|
| `MP_ACCESS_TOKEN` | o access token de produção que você copiou no passo 2 |
| `GUIA_PRICE` | `39.90` |
| `MOLDA_PRICE` | `29.90` |
| `BASE_PRICE` | `6000` |
| `MANUTENCAO_PRICE` | `1500` |
| `MANUTENCAO_VAGAS` | `restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.` |

Depois de salvar, vá na aba **Deployments**, clique nos "..." do último deploy e escolha **Redeploy**.

### 5b. banco de dados (supabase) — necessário pras contas

Sem isso o site continua no ar, mas ninguém consegue criar conta nem comprar de verdade (as ferramentas dependem do supabase pra guardar e-mail/senha e o histórico de compras).

1. Crie uma conta grátis em https://supabase.com e crie um novo projeto (a senha de banco que ele pedir não é usada em nenhum lugar, pode ser qualquer uma).
2. Dentro do projeto, vá em **SQL Editor** → **New query**, cole o conteúdo do arquivo `supabase_schema.sql` e clique em **Run**. Isso cria as tabelas `pagamentos` (registro das vendas) e `config` (os preços editáveis pelo painel).
3. Repete o passo acima com o arquivo `supabase_migration_contas.sql` — cria a tabela `usuarios` (contas) e mais alguns campos. Seguro rodar mesmo que você já tenha rodado uma migração antiga antes (tudo aqui é "só adiciona se não existir").
4. Pra pegar a chave: **Settings → API Keys**, aba **"Legacy anon, service_role API keys"** (não a aba "Publishable and secret API keys", que é outro sistema) — copie a chave **service_role** (clique em **Reveal** primeiro).
5. Pra pegar a URL: **Settings → General** → copie o **Project ID** — a Project URL é `https://<esse-project-id>.supabase.co`.

Na Vercel, adicione:

| nome | valor |
|---|---|
| `SUPABASE_URL` | a Project URL |
| `SUPABASE_SERVICE_KEY` | a chave service_role |
| `CONTA_SESSION_SECRET` | uma senha longa qualquer (só ela usa, pra assinar as sessões de login) — pode gerar com `openssl rand -hex 32` |
| `SITE_URL` | `https://oestudioavesso.com.br` |

Redeploy depois de salvar.

### 5c. e-mail (resend) — recomendado

Sem isso, o site funciona normalmente, só não manda e-mail de boas-vindas/confirmação nem de redefinição de senha — a pessoa só vê a tela depois do pagamento.

1. Crie uma conta grátis em https://resend.com (100 e-mails/dia grátis).
2. **Domains > Add Domain**, coloque `oestudioavesso.com.br`, siga as instruções de DNS (no mesmo lugar onde configurou o domínio pra Vercel).
3. Depois de **verificado**, vá em **API Keys > Create API Key**.

Na Vercel, adicione:

| nome | valor |
|---|---|
| `RESEND_API_KEY` | a chave criada |
| `RESEND_FROM` | `estúdio avesso <guia@oestudioavesso.com.br>` (o domínio depois do @ precisa ser o verificado no resend) |

Redeploy.

### 5d. painel administrativo (`/painel`) — recomendado

1. Escolha uma senha forte.
2. Na Vercel, adicione `ADMIN_PASSWORD` com essa senha.
3. Redeploy.
4. Acesse `/painel`, digite a senha — dá pra mudar os preços de qualquer ferramenta na hora e ver a lista de vendas.

### 6. teste com um pagamento pequeno de verdade

Recomendo gerar um pix de teste com um valor baixo (pode temporariamente colocar `GUIA_PRICE=1`) antes de deixar no ar com o preço final. Depois volta o valor e clica em redeploy — ou já usa o painel pra isso, sem precisar mexer em variável nenhuma.

### 7. (opcional) use seu domínio próprio

**Settings > Domains** na Vercel.

### (opcional) webhook do mercado pago

Deixa o envio de e-mail mais confiável (não depende da aba do site ficar aberta). No painel de desenvolvedor do Mercado Pago, cadastre a url `https://oestudioavesso.com.br/api/webhook` pro evento de pagamentos.

## como funciona por dentro (resumo)

1. A pessoa clica em "comprar com pix" (na home, em `/guia-venda`, em `/molda` ou dentro de `/conta`) e digita o e-mail.
2. A página chama `/api/payment?action=create&produto=guia` (ou `molda`, ou o slug de qualquer ferramenta nova), que pede ao Mercado Pago pra gerar um pix.
3. A página mostra o QR code e checa a cada 3 segundos se aprovou (`/api/payment?action=status`).
4. Quando aprova: se o e-mail já tinha conta, a pessoa só precisa entrar (e-mail + senha de sempre); se é a primeira compra dela, ela cria uma senha em `/conta?setup=1&...`. Os dois casos também recebem e-mail (se o resend estiver configurado).
5. A partir daí, a pessoa entra em `/conta` (ou direto na ferramenta, que manda pra `/conta` sozinha se faltar login) com e-mail + senha, em qualquer aparelho — e vê ali tanto o que já comprou quanto o que ainda pode comprar.
6. Os preços que aparecem no site e o valor cobrado de verdade no pix vêm sempre do mesmo lugar: primeiro do banco (editável pelo `/painel`), e só como reserva da variável de ambiente.

## como adicionar uma ferramenta nova

Isso é o que a reestruturação inteira existe pra deixar simples — nenhum passo abaixo mexe em checkout, login, painel ou na página `/conta`, porque todos eles leem o catálogo (`lib/products.js`) sozinhos:

1. Adiciona uma entrada em `lib/products.js` (slug, nome, o texto que vai na descrição do pix, variável de ambiente e preço padrão, caminho da ferramenta e da página de venda dela).
2. Sobe a página da ferramenta em si, protegida por `<script src="/shared/gate.js" data-produto="seu-slug"></script>` — não precisa escrever nenhuma tela de login, ele cuida disso sozinho (manda pra `/conta` se faltar login ou se a conta não tiver aquela ferramenta).
3. (opcional) Sobe uma página de venda própria pra ela, reaproveitando o checkout com `<script src="/shared/checkout.js" data-produto="seu-slug"></script>` — copia o html do modal de `guia-venda/index.html` ou `molda/index.html` como base.
4. O preço dela já aparece sozinho no painel (`/painel`) — não precisa editar esse arquivo nem rodar nenhuma migração de banco, a não ser que você queira o preço com uma coluna própria no lugar do campo genérico (não é necessário).

Nenhum desses passos cria uma função nova na Vercel — o `/api/payment.js`, `/api/auth.js` e `/api/account.js` já servem qualquer ferramenta do catálogo.

## se quiser trocar algo depois

- **preço de qualquer ferramenta**: pelo `/painel` (vale na hora, sem redeploy) — ou pela variável de ambiente correspondente + redeploy, se o painel ainda não estiver configurado.
- **conteúdo do guia**: edite `guia/index.html`. **conteúdo/lógica do molda**: `molda/app.html`.
- **textos e páginas de venda**: `index.html` (home), `guia-venda/index.html`, `molda/index.html`.
- **textos dos e-mails**: `lib/services.js`, funções `sendBoasVindasEmail`, `sendCompraConfirmadaEmail`, `sendResetEmail`.
- **ver todas as vendas**: `/painel`, ou direto em supabase.com > seu projeto > Table Editor > tabela `pagamentos`.
- **ver as contas**: supabase.com > seu projeto > Table Editor > tabela `usuarios`.
- **trocar a senha do painel**: muda `ADMIN_PASSWORD` na Vercel e redeploy.
- **derrubar todas as sessões de conta de uma vez** (ex: se desconfiar de algo): troca `CONTA_SESSION_SECRET` na Vercel por um valor novo e redeploy — todo mundo precisa logar de novo, as contas e senhas continuam intactas.
