-- =============================================================================
-- Template de leitura do extrato do Banco do Brasil (PDF)
--
-- Calibrado contra um extrato real (agosto/2026, 205 lançamentos, 10 páginas).
-- O extrato é uma TABELA: as posições de coluna são lidas do próprio cabeçalho
-- em tempo de execução, e os valores abaixo servem só de fallback caso o
-- cabeçalho mude de rótulo.
--
-- Este cadastro é GLOBAL: descreve apenas COMO ler o extrato. Nenhum código de
-- conta contábil ou de histórico padrão do Domínio mora aqui (seção 7.2).
-- =============================================================================

insert into public.bancos_templates
  (nome_banco, formato_origem, regex_documento, formato_valor, versao_layout, estrutura_historico)
values (
  'Banco do Brasil',
  'pdf',
  '(?<!\d)(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14}|\d{11})(?!\d)',
  'br_sinal_sufixo',
  'v1',
  '{
    "modo": "colunas",
    "validarDigitoDocumento": true,
    "colunasPdf": { "dia": 30, "lote": 91, "documento": 152, "historico": 266 },
    "sinonimos": {
      "PIX RECEBIDO": ["PIX RECEBIDO QR CODE", "PIX RECEBIDO DEVOLUCAO"],
      "PIX ENVIADO": ["PIX ENVIADO QR CODE"],
      "TRANSFERENCIA RECEBIDA": ["TED CREDITO EM CONTA", "TED RECEBIDA"],
      "TRANSFERENCIA ENVIADA": ["TED PAG FORNECEDORES", "TED ENVIADA"]
    }
  }'::jsonb
)
on conflict (nome_banco, versao_layout) do nothing;
