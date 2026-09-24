# Site afetue

Site da marca afetue com a pré-venda da Oficina de Autor em Casa, o pagamento, o envio do kit por e-mail e a página onde as famílias enviam o livro.

Usa a mesma estrutura da Avesso: **Vercel** (site e funções), **Supabase** (pedidos e fotos), **Mercado Pago** (Pix e cartão) e **Resend** (e-mails).

## Como funciona

```
Família escolhe o plano em /oficina
  → /api/checkout cria o pedido (pendente) e abre o Mercado Pago
  → paga
  → Mercado Pago avisa /api/webhook-mercadopago
  → pedido vira "pago" e sai o e-mail:
      • só o kit ....... PDF anexado + link de download
      • kit + livro .... PDF anexado + link de download + link pessoal de envio
  → você recebe um aviso de venda

Família abre o link pessoal (/enviar?pedido=…&t=…)
  → preenche o livro e escolhe as fotos
  → as fotos sobem direto pro Supabase (pasta privada "livros")
  → /api/enviar registra tudo
  → a família recebe a confirmação
  → você recebe um e-mail com textos, endereço e links das fotos (valem 7 dias)
```

## Páginas

| Endereço | O que é |
|---|---|
| `/` | Apresentação da marca |
| `/oficina` | Pré-venda da Oficina de Autor (turma, preços, compra) |
| `/enviar` | Envio do livro (abre com o link pessoal do e-mail; sem link, pede o e-mail pra reenviar) |
| `/obrigado` | Volta do Mercado Pago (aprovado, pendente ou recusado) |
| `/admin` | Seu painel: compras, livros enviados, fotos, endereço e andamento (pede a senha `ADMIN_SENHA`) |

## Colocar no ar (uma vez)

1. **Supabase:** crie um projeto novo (ou use o da Avesso). Em *SQL Editor*, cole e rode `supabase/schema.sql`. Isso cria as tabelas `pedidos`, `envios` e `config` (preços e turma), a pasta privada `livros` e a visão `painel_turma`.
2. **Resend:** verifique o domínio de onde os e-mails vão sair (ex.: `afetue.com.br`, ou use o `rocholab.com` se ele já estiver verificado).
3. **Vercel:** crie um projeto a partir desta pasta (GitHub ou `vercel deploy`). Em *Settings → Environment Variables*, cadastre tudo o que está em `.env.example`.
4. **Mercado Pago:** em *Suas integrações → Webhooks*, cadastre `https://SEU-SITE/api/webhook-mercadopago` com o evento **Pagamentos**. Copie a *assinatura secreta* pra `MP_WEBHOOK_SECRET`.
5. **Teste:** no painel, mude o preço do kit pra R$ 1,00, compre com Pix e confira se o e-mail chega. Depois volte pra R$ 47.

## No dia a dia

- **Mudar preços, vagas, prazo ou fechar a turma:** no painel `/admin`, botão *Preços e turma*. Vale em até 1 minuto, sem redeploy.
- **Acompanhar tudo:** entre em `/admin` com a sua senha. Lá você vê resumo da turma, todas as compras, o livro de cada família (capa, páginas, textos, dedicatória, sobre o autor), copia o endereço, baixa as fotos num .zip, muda o andamento, reenvia o e-mail da compra e apaga as fotos.
- **Fechar a turma no prazo:** o site não fecha sozinho em 30/10. No dia, desmarque *Inscrições abertas* em *Preços e turma*.
- **Apagar depois da impressão (LGPD):** no painel, botão *Apagar fotos*. O site promete isso pras famílias.
- **Trocar o PDF do kit:** substitua `private/oficina-de-autor-em-casa.pdf` e faça deploy.

## Antes de divulgar

- [ ] Conferir os preços em *Preços e turma* no painel (já começam em R$ 47 e R$ 497)
- [ ] Senha do painel (`ADMIN_SENHA`)
- [ ] Instagram no rodapé (`@afetue` é exemplo)
- [ ] Revisar o card "52 momentos · em breve" da página inicial
