-- migração pra adicionar o Molda ao banco que já existe.
-- cole isso no editor sql do supabase (seu projeto > SQL Editor > New query)
-- e clique em "run". só precisa fazer isso uma vez.
--
-- é só adição — nada do que já existe (guia, pagamentos, config) é apagado
-- ou alterado. depois de rodar isso, o /painel passa a mostrar também o
-- campo de preço do molda.

-- marca de qual produto é cada pagamento (o guia já existente continua
-- valendo 'guia' por padrão, sem precisar tocar nas linhas antigas).
alter table pagamentos add column if not exists produto text default 'guia';

-- preço do molda, editável pelo /painel do mesmo jeito que os outros preços.
alter table config add column if not exists molda_price numeric;
update config set molda_price = 29.90 where id = 1 and molda_price is null;

-- contas de verdade do molda (e-mail + senha, criadas só depois de um
-- pagamento aprovado). senha nunca fica em texto puro — só hash + salt.
create table if not exists molda_usuarios (
  email text primary key,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz default now()
);
