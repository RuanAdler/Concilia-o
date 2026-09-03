import type { LancamentoParseado } from '@/lib/parsers/tipos';

export interface PessoaEspecialCtx {
  id: string;
  identificador: string;
  tipo_identificador: 'cpf' | 'cnpj' | 'nome';
  nome_exibicao: string;
  papel: string;
  conta_contabil_id: string;
}

export interface RegraCtx {
  id: string;
  banco_template_id: string | null;
  tipo_chave: 'tipo_operacao' | 'cnpj_cpf' | 'pessoa_especial' | 'valor_recorrente';
  valor_chave: string;
  conta_contabil_id: string;
  confianca: 'alta' | 'media';
  multiplicador_outlier: number;
}

/** Distribuição histórica de valores por regra, para a camada 4 (seção 4.5). */
export interface EstatisticaRegra {
  mediana: number;
  quantidade: number;
}

export interface ContextoClassificacao {
  bancoTemplateId: string;
  pessoasEspeciais: PessoaEspecialCtx[];
  regras: RegraCtx[];
  estatisticasPorRegra: Map<string, EstatisticaRegra>;
  indiceSinonimos: Map<string, string>;
  limiarSimilaridade?: number;
  /** Amostra mínima antes de acusar outlier — evita alarme com histórico raso. */
  amostraMinimaOutlier?: number;
}

export type CamadaAplicada =
  | 'pessoa_especial'
  | 'cnpj_cpf'
  | 'tipo_operacao'
  | 'nenhuma';

export interface LancamentoClassificado extends LancamentoParseado {
  historicoNormalizado: string;
  tipoOperacaoNormalizado: string;
  documentoExtraido: string | null;
  hashDeduplicacao: string;
  contaContabilId: string | null;
  regraAplicadaId: string | null;
  pessoaEspecialId: string | null;
  camada: CamadaAplicada;
  statusRevisao: 'auto_classificado' | 'revisar' | 'outlier' | 'confirmado';
  duplicadoSuspeito: boolean;
  /** Explicação legível do porquê da classificação — aparece na tela de revisão. */
  motivo: string;
}
