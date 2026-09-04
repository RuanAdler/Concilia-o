/** Formato interno único para o qual todo parser de banco converte (seção 1.3). */
export interface LancamentoParseado {
  /** Data no formato ISO AAAA-MM-DD. */
  data: string;
  /** Histórico completo, como será gravado no campo 7 do registro 6100. */
  historicoBruto: string;
  /** Parte fixa: o tipo de operação ("Pix - Recebido", "Tarifa Pix Enviado"...). */
  tipoOperacao: string;
  /** Parte variável: hora, documento, nome truncado do favorecido. */
  complemento: string;
  /** Sempre positivo — o sentido vai em `tipo`. */
  valor: number;
  /** Sentido no extrato bancário: `credito` = dinheiro entrou, `debito` = saiu. */
  tipo: 'debito' | 'credito';
  /** Identificador único da transação, quando o formato oferece (FITID do OFX). */
  idExterno?: string | null;
}

export interface ResultadoParse {
  lancamentos: LancamentoParseado[];
  periodoInicio: string | null;
  periodoFim: string | null;
  /**
   * Linhas cruas extraídas do arquivo. Guardadas apenas em memória, para exibir
   * um diagnóstico na tela quando o parser não reconhece nenhum lançamento —
   * nunca são persistidas (o extrato é descartado, seção 2).
   */
  linhasBrutas: string[];
  avisos: string[];
}

/** Conteúdo de `bancos_templates.estrutura_historico` (3.2). */
export interface EstruturaHistorico {
  modo?: 'duas_linhas' | 'linha_unica' | 'colunas';
  validarDigitoDocumento?: boolean;
  maxLinhasComplemento?: number;
  tokensIgnorarRegex?: string;
  linhasIgnorar?: string[];
  /** Forma canônica -> variações aceitas (seção 4.4). */
  sinonimos?: Record<string, string[]>;
  /** Mapeamento de colunas, para formatos CSV. */
  colunas?: {
    data?: string;
    historico?: string;
    complemento?: string;
    valor?: string;
    valorDebito?: string;
    valorCredito?: string;
    documento?: string;
  };
  /** Separador usado no CSV; padrão detectado automaticamente. */
  separadorCsv?: string;
  /**
   * Posição X das colunas no PDF, usada só quando o cabeçalho da tabela não é
   * encontrado — normalmente elas são lidas do próprio cabeçalho.
   */
  colunasPdf?: { dia?: number; lote?: number; documento?: number; historico?: number };
}

export interface BancoTemplate {
  id: string;
  nome_banco: string;
  formato_origem: 'pdf' | 'ofx' | 'csv';
  estrutura_historico: EstruturaHistorico | null;
  regex_documento: string | null;
  formato_valor: string;
  versao_layout: string;
}
