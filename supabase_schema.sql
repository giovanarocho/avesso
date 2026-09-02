-- cole isso no editor sql do supabase (seu projeto > SQL Editor > New query)
-- e clique em "run". só precisa fazer isso uma vez.

create table if not exists pagamentos (
  payment_id text primary key,
  email text,
  amount numeric,
  status text,
  code_sent boolean default false,
  guia_acessado_em timestamptz,
  created_at timestamptz default now()
);

-- índice pra você conseguir olhar "quem comprou e ainda não acessou o guia" rapidinho, se quiser:
create index if not exists idx_pagamentos_status on pagamentos (status);

-- tabela de configuração (preços), editável pelo painel /painel sem precisar
-- mexer em código nem redeploy. só existe uma linha (id sempre 1).
create table if not exists config (
  id int primary key default 1,
  guia_price numeric,
  base_price numeric,
  manutencao_price numeric,
  manutencao_vagas text,
  updated_at timestamptz default now()
);

insert into config (id, guia_price, base_price, manutencao_price, manutencao_vagas)
values (1, 39.90, 6000, 1500, 'restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.')
on conflict (id) do nothing;
