import { extrairDocumento } from '@/lib/nucleo/documento';
import { calcularHashDeduplicacao } from '@/lib/nucleo/hash';
import { apenasDigitos, normalizarHistorico, normalizarNome } from '@/lib/nucleo/texto';
import type { EstruturaHistorico, LancamentoParseado } from '@/lib/parsers/tipos';
import { formaCanonica, similaridade } from './similaridade';
import type {
  ContextoClassificacao,
  LancamentoClassificado,
  PessoaEspecialCtx,
  RegraCtx,
} from './tipos';

export * from './tipos';

const LIMIAR_SIMILARIDADE_PADRAO = 0.85;
const AMOSTRA_MINIMA_OUTLIER_PADRAO = 3;

/**
 * Motor de classificação — seção 4 da especificação.
 *
 * As camadas são avaliadas em ordem e a primeira que casa define a conta
 * contábil; as seguintes nem são avaliadas. A camada 4 (outlier) roda POR CIMA
 * do resultado, sem substituí-lo.
 */
export function classificarLancamento(
  lancamento: LancamentoParseado,
  contexto: ContextoClassificacao,
  estrutura: EstruturaHistorico | null,
  regexDocumento: string | null,
): LancamentoClassificado {
  // ---- 4.1 Pré-processamento -----------------------------------------------
  const historicoNormalizado = normalizarHistorico(lancamento.historicoBruto);
  const tipoOperacaoNormalizado = formaCanonica(
    normalizarHistorico(lancamento.tipoOperacao),
    contexto.indiceSinonimos,
  );

  // O documento vive na parte variável; se ela vier vazia, procuramos no texto todo.
  const documento = extrairDocumento(
    lancamento.complemento || lancamento.historicoBruto,
    regexDocumento,
    estrutura?.validarDigitoDocumento ?? true,
  );

  const hashDeduplicacao = calcularHashDeduplicacao({
    data: lancamento.data,
    valor: lancamento.valor,
    historicoNormalizado,
    documento: lancamento.idExterno ?? documento?.numero ?? null,
  });

  const base: LancamentoClassificado = {
    ...lancamento,
    historicoNormalizado,
    tipoOperacaoNormalizado,
    documentoExtraido: documento?.numero ?? null,
    hashDeduplicacao,
    contaContabilId: null,
    regraAplicadaId: null,
    pessoaEspecialId: null,
    camada: 'nenhuma',
    statusRevisao: 'revisar',
    duplicadoSuspeito: false,
    motivo: 'Nenhuma regra correspondeu — precisa de vínculo manual.',
  };

  // ---- 4.2 Camada 1: pessoa especial ---------------------------------------
  const pessoa = casarPessoaEspecial(base, contexto.pessoasEspeciais);
  if (pessoa) {
    return {
      ...base,
      contaContabilId: pessoa.conta_contabil_id,
      pessoaEspecialId: pessoa.id,
      camada: 'pessoa_especial',
      statusRevisao: 'auto_classificado',
      // Confiança alta: nunca vai para revisão, mesmo com valor atípico (4.2).
      motivo: `Pessoa especial: ${pessoa.nome_exibicao} (${pessoa.papel}).`,
    };
  }

  const regrasDoBanco = contexto.regras.filter(
    (regra) => regra.banco_template_id === null || regra.banco_template_id === contexto.bancoTemplateId,
  );

  // ---- 4.3 Camada 2: CNPJ/CPF de fornecedor ou cliente recorrente -----------
  if (base.documentoExtraido) {
    const regra = regrasDoBanco.find(
      (r) => r.tipo_chave === 'cnpj_cpf' && apenasDigitos(r.valor_chave) === base.documentoExtraido,
    );
    if (regra) {
      return aplicarRegra(base, regra, contexto, 'cnpj_cpf', `Documento ${base.documentoExtraido} já vinculado.`);
    }
  }

  // ---- 4.4 Camada 3: tipo de operação puro (com tolerância a variação) ------
  const porTipo = casarTipoOperacao(base.tipoOperacaoNormalizado, regrasDoBanco, contexto);
  if (porTipo) {
    const sufixo =
      porTipo.escore >= 1
        ? 'correspondência exata'
        : `similaridade ${(porTipo.escore * 100).toFixed(0)}%`;
    return aplicarRegra(
      base,
      porTipo.regra,
      contexto,
      'tipo_operacao',
      `Tipo de operação "${porTipo.regra.valor_chave}" (${sufixo}).`,
    );
  }

  // ---- 4.6 Sem correspondência ---------------------------------------------
  return base;
}

function casarPessoaEspecial(
  lancamento: LancamentoClassificado,
  pessoas: PessoaEspecialCtx[],
): PessoaEspecialCtx | null {
  if (lancamento.documentoExtraido) {
    const porDocumento = pessoas.find(
      (p) =>
        (p.tipo_identificador === 'cpf' || p.tipo_identificador === 'cnpj') &&
        apenasDigitos(p.identificador) === lancamento.documentoExtraido,
    );
    if (porDocumento) return porDocumento;
  }

  // Pix e TED muitas vezes não trazem documento — sobra o nome (seção 4.2).
  for (const pessoa of pessoas) {
    if (pessoa.tipo_identificador !== 'nome') continue;
    const alvo = normalizarNome(pessoa.identificador || pessoa.nome_exibicao);
    if (alvo.length >= 5 && lancamento.historicoNormalizado.includes(alvo)) return pessoa;
  }

  return null;
}

function casarTipoOperacao(
  tipoNormalizado: string,
  regras: RegraCtx[],
  contexto: ContextoClassificacao,
): { regra: RegraCtx; escore: number } | null {
  if (!tipoNormalizado) return null;

  const candidatas = regras.filter((r) => r.tipo_chave === 'tipo_operacao');
  const limiar = contexto.limiarSimilaridade ?? LIMIAR_SIMILARIDADE_PADRAO;

  let melhor: { regra: RegraCtx; escore: number } | null = null;

  for (const regra of candidatas) {
    const chave = formaCanonica(normalizarHistorico(regra.valor_chave), contexto.indiceSinonimos);
    const escore = similaridade(tipoNormalizado, chave);
    if (escore >= limiar && (!melhor || escore > melhor.escore)) melhor = { regra, escore };
  }

  return melhor;
}

function aplicarRegra(
  base: LancamentoClassificado,
  regra: RegraCtx,
  contexto: ContextoClassificacao,
  camada: 'cnpj_cpf' | 'tipo_operacao',
  motivo: string,
): LancamentoClassificado {
  const resultado: LancamentoClassificado = {
    ...base,
    contaContabilId: regra.conta_contabil_id,
    regraAplicadaId: regra.id,
    camada,
    statusRevisao: 'auto_classificado',
    motivo,
  };

  // ---- 4.5 Camada 4: detecção de outlier de valor --------------------------
  if (ehOutlier(resultado.valor, regra, contexto)) {
    const estatistica = contexto.estatisticasPorRegra.get(regra.id);
    return {
      ...resultado,
      statusRevisao: 'outlier',
      motivo: `${motivo} Valor fora do padrão da regra (mediana histórica ${
        estatistica ? estatistica.mediana.toFixed(2) : '—'
      }).`,
    };
  }

  return resultado;
}

/**
 * V1 conforme a especificação: limite fixo configurável por regra — múltiplo da
 * mediana histórica. Só dispara com amostra mínima, senão a primeira importação
 * marcaria tudo como suspeito.
 */
function ehOutlier(valor: number, regra: RegraCtx, contexto: ContextoClassificacao): boolean {
  const estatistica = contexto.estatisticasPorRegra.get(regra.id);
  const amostraMinima = contexto.amostraMinimaOutlier ?? AMOSTRA_MINIMA_OUTLIER_PADRAO;

  if (!estatistica || estatistica.quantidade < amostraMinima || estatistica.mediana <= 0) return false;

  const multiplicador = regra.multiplicador_outlier > 0 ? regra.multiplicador_outlier : 5;
  return valor > estatistica.mediana * multiplicador;
}

/**
 * Classifica o lote inteiro e marca duplicatas.
 *
 * @param hashesJaImportados hashes vistos em lotes anteriores da mesma empresa —
 *   sinalizados, nunca bloqueados automaticamente (seção 6.4).
 */
export function classificarLote(
  lancamentos: LancamentoParseado[],
  contexto: ContextoClassificacao,
  estrutura: EstruturaHistorico | null,
  regexDocumento: string | null,
  hashesJaImportados: Set<string> = new Set(),
): LancamentoClassificado[] {
  const vistosNesteLote = new Set<string>();
  const saida: LancamentoClassificado[] = [];

  for (const lancamento of lancamentos) {
    const classificado = classificarLancamento(lancamento, contexto, estrutura, regexDocumento);

    // Duplicidade dentro do próprio lote é erro de leitura, não lançamento novo:
    // o índice único (lote_id, hash) rejeitaria a segunda linha de qualquer jeito.
    if (vistosNesteLote.has(classificado.hashDeduplicacao)) continue;
    vistosNesteLote.add(classificado.hashDeduplicacao);

    classificado.duplicadoSuspeito = hashesJaImportados.has(classificado.hashDeduplicacao);
    saida.push(classificado);
  }

  return saida;
}

/**
 * Decide a chave da regra aprendida quando o usuário vincula um lançamento à mão
 * (seção 4.6): prefere o documento, porque é estável; cai para o tipo de operação
 * quando o extrato não traz documento.
 */
export function chaveDeAprendizado(lancamento: {
  documentoExtraido: string | null;
  tipoOperacaoNormalizado: string;
  historicoNormalizado: string;
}): { tipo_chave: 'cnpj_cpf' | 'tipo_operacao'; valor_chave: string } | null {
  if (lancamento.documentoExtraido) {
    return { tipo_chave: 'cnpj_cpf', valor_chave: lancamento.documentoExtraido };
  }

  const chave = lancamento.tipoOperacaoNormalizado || lancamento.historicoNormalizado;
  if (!chave) return null;

  return { tipo_chave: 'tipo_operacao', valor_chave: chave };
}
