-- =============================================================================
-- Calibração do template do Banco do Brasil contra o extrato real.
--
-- A primeira versão do template assumia que cada lançamento ocupava duas linhas
-- de texto. O extrato real é uma tabela cujas colunas se cruzam em alturas
-- diferentes, então a configuração de leitura por linha (linhasIgnorar,
-- tokensIgnorarRegex) deixou de existir e deu lugar às posições de coluna.
--
-- Migration separada da seed para trazer bancos já migrados para o mesmo estado.
-- =============================================================================

update public.bancos_templates
set
  estrutura_historico = '{
    "modo": "colunas",
    "validarDigitoDocumento": true,
    "colunasPdf": { "dia": 30, "lote": 91, "documento": 152, "historico": 266 },
    "sinonimos": {
      "PIX RECEBIDO": ["PIX RECEBIDO QR CODE", "PIX RECEBIDO DEVOLUCAO"],
      "PIX ENVIADO": ["PIX ENVIADO QR CODE"],
      "TRANSFERENCIA RECEBIDA": ["TED CREDITO EM CONTA", "TED RECEBIDA"],
      "TRANSFERENCIA ENVIADA": ["TED PAG FORNECEDORES", "TED ENVIADA"]
    }
  }'::jsonb,
  regex_documento = '(?<!\d)(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14}|\d{11})(?!\d)'
where nome_banco = 'Banco do Brasil'
  and versao_layout = 'v1';
