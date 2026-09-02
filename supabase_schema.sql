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
