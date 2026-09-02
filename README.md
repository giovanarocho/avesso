# avesso — página de venda + checkout automático do guia

Isso é um projetinho completo pra publicar na Vercel (grátis). Ele tem:

- `index.html` — a página de venda nova (hero limpa, guia em destaque, depois os outros dois formatos).
- `api/` — 4 funções que rodam no servidor da Vercel (não no seu navegador) e conversam com o Mercado Pago pra gerar o pix, confirmar o pagamento e só então liberar o link do guia.

Sem isso, qualquer pessoa com o link do guia acessava sem pagar. Com isso, o link só é entregue depois que o Mercado Pago confirma o pagamento — a confirmação acontece no servidor, então não tem como "enganar" clicando em algum botão sem pagar de verdade.

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
| `GUIA_LINK` | o link do guia (ex: `https://claude.ai/code/artifact/c8e94bcd-a732-48f4-ac37-e92a9f011391`) |
| `GUIA_PRICE` | `39.90` |
| `BASE_PRICE` | `6000` |
| `MANUTENCAO_PRICE` | `1500` |
| `MANUTENCAO_VAGAS` | `restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.` |

Depois de salvar, vá na aba **Deployments**, clique nos "..." do último deploy e escolha **Redeploy** (isso é tudo que você precisa fazer sempre que quiser mudar um preço depois — trocar o valor aqui e clicar em redeploy, sem mexer em nenhum código).

### 6. teste com um pagamento pequeno de verdade

Recomendo gerar um pix de teste pagando com um valor baixo (pode temporariamente colocar `GUIA_PRICE=1` pra testar com R$1) antes de deixar no ar com o preço final. Depois volte o valor e clique em redeploy.

### 7. (opcional) use seu domínio próprio

Em **Settings > Domains** na Vercel, você pode apontar um domínio seu (tipo `avesso.com.br`) pra esse projeto, seguindo as instruções que a própria Vercel mostra na tela.

## como funciona por dentro (resumo)

1. A pessoa clica em "quero o guia — pagar com pix" e digita o e-mail.
2. A página chama `/api/create-payment`, que pede ao Mercado Pago pra gerar um pix (usando seu Access Token, que fica só no servidor, nunca no navegador de ninguém).
3. A página mostra o QR code e o código copia-e-cola, e começa a checar a cada 3 segundos se o pagamento já foi aprovado (`/api/check-status`).
4. Quando o Mercado Pago confirma o pagamento, `/api/check-status` responde com o link do guia — só nesse momento ele aparece na tela.
5. Enquanto isso, `/api/webhook` recebe (e registra nos logs da Vercel) os avisos do Mercado Pago, só como registro — o fluxo principal não depende dele.

## se quiser trocar algo depois

- **preço de qualquer um dos três serviços**: mude a variável de ambiente na Vercel e clique em redeploy. Não precisa mexer em código.
- **texto de vagas da manutenção**: mesma coisa, variável `MANUTENCAO_VAGAS`.
- **link do guia**: variável `GUIA_LINK`.
- **textos, cores, seções**: aí sim precisa editar o `index.html` (ou me pedir pra ajustar e te mandar o arquivo atualizado).
