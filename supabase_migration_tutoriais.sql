-- adiciona um lugar pra guardar os links dos vídeos-tutorial de cada marco
-- do guia marketing essencial (editáveis pelo painel /painel, sem precisar
-- de redeploy). seguro rodar mesmo que você já tenha rodado as migrações
-- anteriores — só adiciona coluna se ela não existir.
--
-- cole no SQL Editor do Supabase e clique em Run.

alter table config add column if not exists tutoriais jsonb default '{}'::jsonb;
