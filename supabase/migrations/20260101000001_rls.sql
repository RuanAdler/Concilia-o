-- =============================================================================
-- Row Level Security
-- Todo dado de negócio é isolado por escritório; empresas nunca enxergam
-- configuração umas das outras (seção 1.2 / 7.2 da especificação).
-- =============================================================================

-- Helpers ---------------------------------------------------------------------

create or replace function public.usuario_pertence_escritorio(p_escritorio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.membros_escritorio m
    where m.escritorio_id = p_escritorio
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.usuario_tem_acesso_empresa(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.empresas e
    join public.membros_escritorio m on m.escritorio_id = e.escritorio_id
    where e.id = p_empresa
      and m.user_id = auth.uid()
  );
$$;

-- Habilita RLS ----------------------------------------------------------------

alter table public.escritorios              enable row level security;
alter table public.membros_escritorio       enable row level security;
alter table public.empresas                 enable row level security;
alter table public.bancos_templates         enable row level security;
alter table public.plano_contas_empresa     enable row level security;
alter table public.contas_bancarias_empresa enable row level security;
alter table public.pessoas_especiais        enable row level security;
alter table public.regras_classificacao     enable row level security;
alter table public.lotes_importacao         enable row level security;
alter table public.lancamentos_importados   enable row level security;

-- escritorios / membros -------------------------------------------------------

drop policy if exists escritorios_membro on public.escritorios;
create policy escritorios_membro on public.escritorios
  for select to authenticated
  using (public.usuario_pertence_escritorio(id));

drop policy if exists membros_proprio on public.membros_escritorio;
create policy membros_proprio on public.membros_escritorio
  for select to authenticated
  using (user_id = auth.uid() or public.usuario_pertence_escritorio(escritorio_id));

-- empresas --------------------------------------------------------------------

drop policy if exists empresas_todas_operacoes on public.empresas;
create policy empresas_todas_operacoes on public.empresas
  for all to authenticated
  using (public.usuario_pertence_escritorio(escritorio_id))
  with check (public.usuario_pertence_escritorio(escritorio_id));

-- bancos_templates: cadastro global e compartilhado (seção 1.2).
-- Só define COMO ler o extrato — nunca contém código contábil de empresa.

drop policy if exists bancos_templates_leitura on public.bancos_templates;
create policy bancos_templates_leitura on public.bancos_templates
  for select to authenticated using (true);

drop policy if exists bancos_templates_escrita on public.bancos_templates;
create policy bancos_templates_escrita on public.bancos_templates
  for all to authenticated using (true) with check (true);

-- Tabelas filhas de empresa ---------------------------------------------------

drop policy if exists plano_contas_por_empresa on public.plano_contas_empresa;
create policy plano_contas_por_empresa on public.plano_contas_empresa
  for all to authenticated
  using (public.usuario_tem_acesso_empresa(empresa_id))
  with check (public.usuario_tem_acesso_empresa(empresa_id));

drop policy if exists contas_bancarias_por_empresa on public.contas_bancarias_empresa;
create policy contas_bancarias_por_empresa on public.contas_bancarias_empresa
  for all to authenticated
  using (public.usuario_tem_acesso_empresa(empresa_id))
  with check (public.usuario_tem_acesso_empresa(empresa_id));

drop policy if exists pessoas_especiais_por_empresa on public.pessoas_especiais;
create policy pessoas_especiais_por_empresa on public.pessoas_especiais
  for all to authenticated
  using (public.usuario_tem_acesso_empresa(empresa_id))
  with check (public.usuario_tem_acesso_empresa(empresa_id));

drop policy if exists regras_por_empresa on public.regras_classificacao;
create policy regras_por_empresa on public.regras_classificacao
  for all to authenticated
  using (public.usuario_tem_acesso_empresa(empresa_id))
  with check (public.usuario_tem_acesso_empresa(empresa_id));

drop policy if exists lotes_por_empresa on public.lotes_importacao;
create policy lotes_por_empresa on public.lotes_importacao
  for all to authenticated
  using (public.usuario_tem_acesso_empresa(empresa_id))
  with check (public.usuario_tem_acesso_empresa(empresa_id));

drop policy if exists lancamentos_por_empresa on public.lancamentos_importados;
create policy lancamentos_por_empresa on public.lancamentos_importados
  for all to authenticated
  using (public.usuario_tem_acesso_empresa(empresa_id))
  with check (public.usuario_tem_acesso_empresa(empresa_id));
