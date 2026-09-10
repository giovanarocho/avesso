-- migração pra conta única (e-mail + senha) servindo qualquer ferramenta,
-- não só o molda. seguro rodar mesmo que você já tenha rodado a migração
-- antiga do molda antes — tudo aqui é "só adiciona se não existir".
--
-- cole no SQL Editor do Supabase e clique em Run. não mexe na tabela
-- "pagamentos" existente nem apaga nenhuma venda já registrada.

-- como ainda ninguém comprou nada com conta (a tabela antiga do molda
-- segue vazia), dá pra recriar limpo em vez de converter dado nenhum.
drop table if exists molda_usuarios;

create table if not exists usuarios (
  email text primary key,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz default now()
);

alter table pagamentos add column if not exists produto text default 'guia';

alter table config add column if not exists molda_price numeric;
update config set molda_price = 29.90 where id = 1 and molda_price is null;

-- preço de ferramentas novas (além de guia e molda, que continuam usando
-- as colunas guia_price/molda_price de sempre) — assim, adicionar uma
-- ferramenta nova não precisa de nenhuma migração de banco: o preço dela
-- só existe aqui se for definido pelo painel; sem isso, usa a variável de
-- ambiente/valor padrão do catálogo (lib/products.js).
alter table config add column if not exists precos jsonb default '{}'::jsonb;
