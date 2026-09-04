# Conciliação Bancária Automatizada Multiempresa

Lê extratos bancários (PDF/OFX/CSV), classifica os lançamentos automaticamente por empresa e gera
o TXT de importação de lançamentos contábeis do **Domínio** (registros 0000/6000/6100, Latin-1).

Implementa as fases 1–5 do roadmap da especificação: setup, cadastros, parser do Banco do Brasil,
motor de classificação em 4 camadas, tela de importação com mapa verde/amarelo/vermelho e
exportação para o Domínio.

## Stack

| Camada | Escolha |
| --- | --- |
| Frontend/Backend | Next.js 15 (App Router) + TypeScript |
| Banco de dados | Supabase (Postgres) com Row Level Security |
| Autenticação | Supabase Auth (e-mail/senha) |
| Hospedagem | Vercel (deploy automático do GitHub) |

O arquivo do extrato **não é persistido**: é lido em memória e descartado. Ficam gravados apenas
as configurações (empresas, plano de contas, pessoas especiais, regras) e o resultado da leitura
(lote + lançamentos).

## Fase 1 — colocar no ar

### 1. Supabase

1. Crie um projeto em <https://supabase.com/dashboard>.
2. Aplique as migrations na ordem, pelo **SQL Editor** do painel ou pela CLI:

   ```bash
   supabase link --project-ref <ref-do-projeto>
   supabase db push
   ```

   | Arquivo | O que faz |
   | --- | --- |
   | `supabase/migrations/20260101000000_schema.sql` | 8 tabelas da seção 3 + escritório/membros + provisionamento automático do usuário |
   | `supabase/migrations/20260101000001_rls.sql` | RLS por escritório em todas as tabelas |
   | `supabase/migrations/20260101000002_seed_banco_do_brasil.sql` | Template de leitura do extrato do BB (PDF) |

3. Em **Authentication > Providers**, mantenha Email habilitado. Para testar sem caixa de entrada,
   desligue *Confirm email* em **Authentication > Sign In / Providers**.
4. Em **Authentication > URL Configuration**, inclua a URL da Vercel em *Redirect URLs*.

Ao criar o primeiro usuário, um trigger cria o escritório e vincula o usuário como `admin` — não é
preciso inserir nada à mão.

### 2. Ambiente local

```bash
cp .env.example .env.local   # preencha com os dados de Project Settings > API
npm install
npm run dev
```

### 3. Vercel

1. Importe o repositório em <https://vercel.com/new>.
2. Defina as variáveis de ambiente (Production e Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. `main` = produção; cada push gera deploy.

## Fase 2 — cadastros da primeira empresa

Ordem que funciona de ponta a ponta (é a ordem em que as telas dependem uma da outra):

1. **Empresas** — razão social, CNPJ (só dígitos), segmento.
2. **Plano de Contas** — só as contas usadas na classificação, com o código exato do Domínio.
   Inclua a conta do próprio banco no balancete (ex.: `8`).
3. **Bancos** — conta bancária: template (Banco do Brasil), agência, conta, conta contábil do banco
   e o **código de Histórico Padrão do Domínio** (ex.: `75`, "VALOR REF. A").
4. **Pessoas Especiais** — sócios, funcionários e partes relacionadas, por CPF/CNPJ ou por nome.

Os códigos de conta e de histórico são **por empresa** e nunca são sugeridos ou copiados de outra,
mesmo que coincidam (seção 7.2 da especificação).

## Fases 3–4 — importar e revisar

Em **Importação**: escolha empresa e conta bancária (a conta define o template de leitura), envie o
arquivo e revise o mapa em três blocos:

| Bloco | Significado | Ação |
| --- | --- | --- |
| 🟢 Verde | Classificado automaticamente | Conferir; pode corrigir |
| 🟡 Amarelo | Classificado, valor fora do padrão da regra | Confirmar com um clique ou reclassificar |
| 🔴 Vermelho | Não identificado | Vincular a uma conta — **a regra é salva automaticamente** |

Lançamentos com hash já visto em outra importação aparecem marcados como *possível duplicado* —
sinalizados, nunca bloqueados.

Se o parser não reconhecer nenhum lançamento, a tela mostra as linhas cruas extraídas do arquivo.
Use-as para ajustar `linhasIgnorar`, `tokensIgnorarRegex` e `regex_documento` em **Templates de
Banco** — sem precisar mexer em código.

### Motor de classificação (seção 4)

As camadas são avaliadas em ordem; a primeira que casa define a conta.

1. **Pessoa especial** — por CPF/CNPJ ou por nome. Confiança alta: nunca vai para revisão, mesmo
   com valor atípico.
2. **CNPJ/CPF recorrente** — resolve fornecedor fixo cujo nome vem truncado ou variando.
   CPF/CNPJ são validados por dígito verificador, para não confundir com o id de transação Pix de
   14 dígitos que o BB coloca no complemento.
3. **Tipo de operação** — comparação por similaridade (Levenshtein) mais tabela de sinônimos do
   template, para que "Pix - Recebido" e "Pix-Recebido QR Code" caiam na mesma regra.
4. **Outlier de valor** — roda por cima das camadas 1–3. Valor acima de `multiplicador_outlier` ×
   mediana histórica da regra vira amarelo. Exige ao menos 3 lançamentos de histórico.

Sem correspondência, o lançamento vai para o vermelho. Ao ser vinculado à mão, o sistema cria a
regra (por CNPJ/CPF quando há documento, senão por tipo de operação) — é o aprendizado.

## Fase 5 — exportação Domínio

```
|0000|17401989000148|
|6000|X||||
|6100|03/08/2026|8|504|45,00|75|Pix-Recebido QR Code 03/08 11:01 00052998224725 FULANO DE TA||||
```

- **Débito/crédito vem do sinal do extrato**, não da conta: entrada → campo 3 = conta banco,
  campo 4 = contrapartida; saída → invertido.
- **Encoding ISO-8859-1 (Latin-1)**, não UTF-8. Caracteres fora do Latin-1 (travessão, aspas
  tipográficas) são convertidos para ASCII antes de gravar.
- O botão só habilita sem pendências no bloco vermelho. Depois de exportado, o lote é marcado e os
  lançamentos não entram numa nova geração.

Tudo isso vive em `src/lib/export/dominio.ts`, isolado, com o caso de referência coberto por teste.

## Desenvolvimento

```bash
npm run dev        # servidor local
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

### Mapa do código

```
src/lib/nucleo/          normalização de texto, CPF/CNPJ, hash, data, número
src/lib/parsers/         extração de PDF, parser do BB, OFX, CSV, despacho por template
src/lib/classificacao/   motor de 4 camadas, similaridade, aprendizado
src/lib/export/dominio.ts  geração do TXT + conversão Latin-1
src/app/(app)/           telas: empresas, configuração, importação, templates
src/app/api/             processamento do extrato, revisão manual, download do TXT
supabase/migrations/     schema, RLS e seed
```

## Calibração contra o extrato real

Parser e exportação foram calibrados contra um extrato real do Banco do Brasil (agosto/2026, 205
lançamentos, 10 páginas) e o TXT que o próprio Domínio gerou a partir dele.

**Resultado:** os 205 lançamentos saem idênticos em data, valor, sentido e histórico, e o arquivo
gerado é **byte a byte igual** ao de referência (21.262 bytes).

O extrato e o TXT não estão no repositório — são dados reais de clientes, com CPF e nomes. Os testes
usam fixtures sintéticas que reproduzem a geometria medida (`tests/ajuda/fragmentos-bb.ts`).

### O que a calibração corrigiu

| Achado | Antes | Depois |
| --- | --- | --- |
| Quebra de linha do TXT | CRLF (suposição) | **LF**, medido: 411 quebras, nenhuma CRLF |
| Estrutura do extrato | duas linhas de texto por lançamento | **tabela**, com colunas em alturas diferentes |
| CPF do pagador Pix | descartado | `00052998224725` é o CPF `038.332.655-90` com zeros à esquerda |
| Lançamento na quebra de página | perdido ou fundido com o vizinho | costurado (a data chega partida em `14/08/202` + `6`) |

O campo 7 (histórico) não tem limite fixo: no arquivo real varia de 20 a 61 caracteres, sem corte em
valor redondo. `LIMITE_HISTORICO` segue `null` em `src/lib/export/dominio.ts`.

### Por que o parser lê por coluna

O extrato do BB não é texto corrido. Cada lançamento espalha seus pedaços por três alturas:

```
Dia(x30)   Lote(x91)  Documento(x152)  Histórico(x266)          Valor(dir.)
──────────────────────────────────────────────────────────────────────────
                                       Pix-Recebido QR Code       <- tipo
03/08/2026 14397      31101193368792   03/08 11:01 ... FULANO    45,00 (+)
                                       ^ complemento
```

Quem delimita a linha é o **valor** — há exatamente um por lançamento, e cada fragmento pertence ao
valor mais próximo em Y. As posições de coluna são lidas do próprio cabeçalho da tabela, então uma
mudança de largura no extrato não quebra o parser.

### Cobertura do motor no extrato real

| Camada | Alcance |
| --- | --- |
| 2 — CNPJ/CPF | 136 de 205 lançamentos (56 CPF, 80 CNPJ) |
| 3 — tipo de operação | 21 tipos distintos; `Pix-Recebido QR Code` cai em 504 nos 34 casos |
| — | os 69 sem documento são tarifas e transferências, que o extrato não identifica |

`tests/similaridade-tipos-reais.test.ts` garante que a comparação por similaridade una apenas
`Pix - Recebido` com `Pix-Recebido QR Code` e **nunca** confunda entrada com saída.
