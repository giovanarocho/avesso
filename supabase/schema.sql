-- afetue · banco de dados (rode uma vez no SQL Editor do Supabase)

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null,
  email text not null,
  plano text not null check (plano in ('kit', 'kit_livro')),
  valor numeric(10,2) not null,
  turma text not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado', 'reembolsado')),
  token text not null,
  mp_preferencia text,
  mp_pagamento text,
  pago_em timestamptz,
  email_enviado_em timestamptz,
  envio_status text not null default 'aguardando'
    check (envio_status in ('aguardando', 'enviado', 'em_producao', 'na_grafica', 'entregue')),
  enviado_em timestamptz
);
create index if not exists pedidos_email_idx on public.pedidos (email);
create index if not exists pedidos_plano_status_idx on public.pedidos (plano, status);

create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  pedido_id uuid not null unique references public.pedidos(id) on delete cascade,
  titulo text not null,
  autor text not null,
  idade int,
  com_ajuda_de text,
  dedicatoria text not null,
  sobre_autor text not null,
  capa_path text not null,
  dedicatoria_path text,
  autor_foto_path text not null,
  paginas jsonb not null,
  entrega jsonb not null,
  fotos_apagadas_em timestamptz
);
-- se a tabela já existia antes do painel:
alter table public.envios add column if not exists fotos_apagadas_em timestamptz;

-- Preços e dados da turma (editados pelo painel /admin → "Preços e turma")
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  preco_kit numeric(10,2) not null,
  preco_kit_livro numeric(10,2) not null,
  vagas_livro int not null,
  inscricoes_ate text not null,
  turma_nome text not null,
  turma_aberta boolean not null default true,
  atualizado_em timestamptz not null default now()
);
insert into public.config (id, preco_kit, preco_kit_livro, vagas_livro, inscricoes_ate, turma_nome, turma_aberta)
values (1, 47, 497, 15, '30/10', 'Turma de Natal', true)
on conflict (id) do nothing;
alter table public.config enable row level security;

-- Segurança: ninguém acessa essas tabelas pelo navegador.
-- Só as funções do site (com a service role key) leem e gravam.
alter table public.pedidos enable row level security;
alter table public.envios enable row level security;

-- Pasta privada das fotos dos livros (20 MB por arquivo, só imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('livros', 'livros', false, 20971520, array['image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do nothing;

-- Visão prática pra acompanhar a turma no painel (Table Editor → painel_turma)
create or replace view public.painel_turma
with (security_invoker = true) as
select p.criado_em, p.nome, p.email, p.plano, p.valor, p.status, p.envio_status,
       e.titulo, e.autor, jsonb_array_length(e.paginas) as paginas_historia,
       e.entrega->>'cidade' as cidade, e.entrega->>'uf' as uf
from public.pedidos p
left join public.envios e on e.pedido_id = p.id
where p.status = 'pago'
order by p.criado_em desc;
