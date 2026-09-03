-- =============================================================================
-- Conciliação Bancária Automatizada Multiempresa — schema base
-- Referência: especificação, seção 3 (Modelo de Dados)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Multi-tenant: escritório contábil + membros
-- A especificação (seção 2) pede RLS por escritório/usuário desde o início.
-- -----------------------------------------------------------------------------
create table if not exists public.escritorios (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  criado_em  timestamptz not null default now()
);

create table if not exists public.membros_escritorio (
  user_id       uuid not null references auth.users (id) on delete cascade,
  escritorio_id uuid not null references public.escritorios (id) on delete cascade,
  papel         text not null default 'admin' check (papel in ('admin', 'membro')),
  criado_em     timestamptz not null default now(),
  primary key (user_id, escritorio_id)
);

create index if not exists idx_membros_escritorio_user on public.membros_escritorio (user_id);

-- -----------------------------------------------------------------------------
-- 3.1 empresas
-- -----------------------------------------------------------------------------
create table if not exists public.empresas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios (id) on delete cascade,
  nome          text not null,
  cnpj          text not null,
  segmento      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  constraint empresas_cnpj_apenas_digitos check (cnpj ~ '^[0-9]{14}$')
);

create unique index if not exists uq_empresas_escritorio_cnpj
  on public.empresas (escritorio_id, cnpj);

-- -----------------------------------------------------------------------------
-- 3.2 bancos_templates  (global — não pertence a nenhuma empresa)
-- -----------------------------------------------------------------------------
create table if not exists public.bancos_templates (
  id                  uuid primary key default gen_random_uuid(),
  nome_banco          text not null,
  formato_origem      text not null check (formato_origem in ('pdf', 'ofx', 'csv')),
  estrutura_historico jsonb not null default '{}'::jsonb,
  regex_documento     text,
  formato_valor       text not null default 'br_sinal_sufixo',
  versao_layout       text not null default 'v1',
  criado_em           timestamptz not null default now()
);

create unique index if not exists uq_bancos_templates_nome_versao
  on public.bancos_templates (nome_banco, versao_layout);

-- -----------------------------------------------------------------------------
-- 3.4 plano_contas_empresa
-- Declarada antes de contas_bancarias_empresa por causa da FK conta_contabil_id.
-- -----------------------------------------------------------------------------
create table if not exists public.plano_contas_empresa (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas (id) on delete cascade,
  codigo_conta_dominio  text not null,
  descricao             text not null,
  criado_em             timestamptz not null default now()
);

create unique index if not exists uq_plano_contas_empresa_codigo
  on public.plano_contas_empresa (empresa_id, codigo_conta_dominio);

-- -----------------------------------------------------------------------------
-- 3.3 contas_bancarias_empresa
-- -----------------------------------------------------------------------------
create table if not exists public.contas_bancarias_empresa (
  id                              uuid primary key default gen_random_uuid(),
  empresa_id                      uuid not null references public.empresas (id) on delete cascade,
  banco_template_id               uuid not null references public.bancos_templates (id) on delete restrict,
  agencia                         text,
  conta                           text,
  -- Conta contábil do próprio banco no balancete (campo 3 ou 4 do registro 6100).
  conta_contabil_id               uuid references public.plano_contas_empresa (id) on delete restrict,
  -- Código do "Histórico Padrão" cadastrado dentro do Domínio (ex.: '75').
  -- Fixo por conta bancária; nunca compartilhado entre empresas (seção 7.2).
  codigo_historico_padrao_dominio text,
  descricao_historico_padrao      text,
  apelido                         text,
  criado_em                       timestamptz not null default now()
);

create index if not exists idx_contas_bancarias_empresa on public.contas_bancarias_empresa (empresa_id);

-- -----------------------------------------------------------------------------
-- 3.5 pessoas_especiais
-- -----------------------------------------------------------------------------
create table if not exists public.pessoas_especiais (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas (id) on delete cascade,
  identificador     text not null,
  tipo_identificador text not null check (tipo_identificador in ('cpf', 'cnpj', 'nome')),
  nome_exibicao     text not null,
  papel             text not null check (papel in ('socio', 'funcionario', 'administrador', 'parte_relacionada')),
  conta_contabil_id uuid not null references public.plano_contas_empresa (id) on delete restrict,
  criado_em         timestamptz not null default now()
);

create unique index if not exists uq_pessoas_especiais_identificador
  on public.pessoas_especiais (empresa_id, tipo_identificador, identificador);

-- -----------------------------------------------------------------------------
-- 3.6 regras_classificacao  (o coração do motor)
-- -----------------------------------------------------------------------------
create table if not exists public.regras_classificacao (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas (id) on delete cascade,
  -- nulo = regra vale para qualquer banco daquela empresa
  banco_template_id     uuid references public.bancos_templates (id) on delete set null,
  tipo_chave            text not null check (tipo_chave in ('tipo_operacao', 'cnpj_cpf', 'pessoa_especial', 'valor_recorrente')),
  valor_chave           text not null,
  conta_contabil_id     uuid not null references public.plano_contas_empresa (id) on delete restrict,
  confianca             text not null default 'alta' check (confianca in ('alta', 'media')),
  origem                text not null default 'manual' check (origem in ('manual', 'sugerida_sistema')),
  -- Seção 4.5: v1 usa limite fixo por regra (múltiplo da mediana histórica).
  multiplicador_outlier numeric not null default 5,
  criado_em             timestamptz not null default now(),
  ultima_utilizacao     timestamptz
);

-- Uma chave só pode apontar para uma conta dentro da mesma empresa/banco.
create unique index if not exists uq_regras_classificacao_chave
  on public.regras_classificacao (empresa_id, tipo_chave, valor_chave, (coalesce(banco_template_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- -----------------------------------------------------------------------------
-- 3.7 lotes_importacao  (o arquivo do extrato NÃO é persistido — só a sessão)
-- -----------------------------------------------------------------------------
create table if not exists public.lotes_importacao (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas (id) on delete cascade,
  conta_bancaria_id uuid not null references public.contas_bancarias_empresa (id) on delete cascade,
  periodo_inicio    date,
  periodo_fim       date,
  nome_arquivo      text,
  status            text not null default 'processando'
                    check (status in ('processando', 'aguardando_revisao', 'concluido', 'exportado')),
  criado_em         timestamptz not null default now(),
  exportado_em      timestamptz
);

create index if not exists idx_lotes_empresa on public.lotes_importacao (empresa_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- 3.8 lancamentos_importados
-- -----------------------------------------------------------------------------
create table if not exists public.lancamentos_importados (
  id                    uuid primary key default gen_random_uuid(),
  lote_id               uuid not null references public.lotes_importacao (id) on delete cascade,
  empresa_id            uuid not null references public.empresas (id) on delete cascade,
  data_lancamento       date not null,
  historico_bruto       text not null,
  historico_normalizado text not null,
  tipo_operacao         text,
  documento_extraido    text,
  valor                 numeric(14, 2) not null check (valor >= 0),
  tipo                  text not null check (tipo in ('debito', 'credito')),
  hash_deduplicacao     text not null,
  regra_aplicada_id     uuid references public.regras_classificacao (id) on delete set null,
  conta_contabil_id     uuid references public.plano_contas_empresa (id) on delete set null,
  status_revisao        text not null default 'revisar'
                        check (status_revisao in ('auto_classificado', 'revisar', 'outlier', 'confirmado')),
  duplicado_suspeito    boolean not null default false,
  exportado             boolean not null default false,
  criado_em             timestamptz not null default now()
);

-- Impede duplicidade dentro do mesmo lote (seção 3.8).
create unique index if not exists uq_lancamentos_lote_hash
  on public.lancamentos_importados (lote_id, hash_deduplicacao);

-- Detecta reimportação de um extrato já processado em outra sessão (não bloqueia).
create index if not exists idx_lancamentos_empresa_hash
  on public.lancamentos_importados (empresa_id, hash_deduplicacao);

create index if not exists idx_lancamentos_lote on public.lancamentos_importados (lote_id);
create index if not exists idx_lancamentos_regra on public.lancamentos_importados (regra_aplicada_id);

-- -----------------------------------------------------------------------------
-- Provisionamento automático: todo usuário novo ganha um escritório próprio.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escritorio uuid;
begin
  insert into public.escritorios (nome)
  values (coalesce(nullif(new.raw_user_meta_data ->> 'escritorio', ''), 'Meu Escritório'))
  returning id into v_escritorio;

  insert into public.membros_escritorio (user_id, escritorio_id, papel)
  values (new.id, v_escritorio, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
