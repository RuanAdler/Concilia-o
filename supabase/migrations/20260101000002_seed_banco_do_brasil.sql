-- =============================================================================
-- Template de leitura do extrato do Banco do Brasil (PDF)
-- Seção 5 da especificação: cada lançamento ocupa duas linhas — a primeira é o
-- tipo de operação, a segunda o complemento variável (hora, CPF/CNPJ, nome).
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
    "modo": "duas_linhas",
    "validarDigitoDocumento": true,
    "maxLinhasComplemento": 3,
    "tokensIgnorarRegex": "^[0-9]{1,20}([-./][0-9]{1,20})*$",
    "linhasIgnorar": [
      "^S\\s*A\\s*L\\s*D\\s*O",
      "SALDO ANTERIOR",
      "SALDO DO DIA",
      "SALDO EM CONTA",
      "S A L D O",
      "EXTRATO DE CONTA",
      "^CLIENTE:",
      "^AG[EÊ]NCIA",
      "^CONTA CORRENTE",
      "^BANCO DO BRASIL",
      "^P[AÁ]GINA",
      "^DATA\\s+DEPEND",
      "OUVIDORIA",
      "SAC ",
      "^LANCAMENTOS? DO DIA"
    ],
    "sinonimos": {
      "PIX RECEBIDO": ["PIX - RECEBIDO", "PIX-RECEBIDO", "PIX RECEBIDO QR CODE", "PIX-RECEBIDO QR CODE", "PIX RECEBIDO DEVOLUCAO"],
      "PIX ENVIADO": ["PIX - ENVIADO", "PIX-ENVIADO", "PIX ENVIADO QR CODE", "PIX-ENVIADO QR CODE"],
      "TARIFA PIX ENVIADO": ["TARIFA PIX - ENVIADO", "TAR PIX ENVIADO"],
      "TARIFA PACOTE DE SERVICOS": ["TAR PACOTE SERVICOS", "TARIFA PACOTE SERVICOS", "PACOTE DE SERVICOS"],
      "PAGAMENTO DE BOLETO": ["PAGTO DE BOLETO", "PAGAMENTO BOLETO", "PAGTO BOLETO"],
      "TRANSFERENCIA RECEBIDA": ["TED RECEBIDA", "TED - RECEBIDA", "TRANSF RECEBIDA"],
      "TRANSFERENCIA ENVIADA": ["TED ENVIADA", "TED - ENVIADA", "TRANSF ENVIADA"]
    }
  }'::jsonb
)
on conflict (nome_banco, versao_layout) do nothing;
