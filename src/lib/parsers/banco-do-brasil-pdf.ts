import { dataBrParaIso } from '@/lib/nucleo/data';
import { valorBrParaNumero } from '@/lib/nucleo/numero';
import { extrairLinhasDoPdf } from './pdf-texto';
import type { EstruturaHistorico, LancamentoParseado, ResultadoParse } from './tipos';

/**
 * Parser do extrato do Banco do Brasil em PDF (seção 5).
 *
 * Estrutura observada: cada lançamento ocupa duas linhas visuais.
 *   linha 1 -> data, dependência de origem, TIPO DE OPERAÇÃO, documento, valor + sinal
 *   linha 2 -> complemento variável (hora, CPF/CNPJ, nome truncado da contraparte)
 *
 * A âncora é a linha 1: ela é a única que começa com data E termina com valor
 * assinado. Tudo que vem depois dela, sem esses dois marcadores, é complemento.
 *
 * O parser é deliberadamente tolerante — larguras de coluna variam entre versões
 * do extrato, então dependemos de marcadores textuais, não de posições fixas.
 */

const REGEX_DATA_INICIO = /^(\d{2}\/\d{2}\/\d{2,4})\b/;

/** "1.234,56 (+)", "1.234,56 (-)", "1.234,56 C", "1.234,56 D" ou "-1.234,56". */
const REGEX_VALOR_FIM = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*(?:\(\s*([+-])\s*\)|([+-])|\b([CD])\b)?\s*$/;

const TOKENS_IGNORAR_PADRAO = /^[0-9]{1,20}([-./][0-9]{1,20})*$/;

const LINHAS_IGNORAR_PADRAO = [
  /^S\s*A\s*L\s*D\s*O/i,
  /SALDO\s+(ANTERIOR|DO DIA|EM CONTA)/i,
  /^EXTRATO DE CONTA/i,
  /^CLIENTE:/i,
  /^AG[EÊ]NCIA/i,
  /^CONTA CORRENTE/i,
  /^BANCO DO BRASIL/i,
  /^P[AÁ]GINA/i,
  /^DATA\s+DEPEND/i,
  /OUVIDORIA/i,
  /^SAC\b/i,
];

export async function parsearExtratoBancoDoBrasil(
  dados: Uint8Array,
  estrutura: EstruturaHistorico | null,
): Promise<ResultadoParse> {
  const linhas = await extrairLinhasDoPdf(dados);
  return parsearLinhasBancoDoBrasil(linhas, estrutura);
}

/** Separado da leitura do PDF para poder ser testado com linhas sintéticas. */
export function parsearLinhasBancoDoBrasil(
  linhas: string[],
  estrutura: EstruturaHistorico | null,
): ResultadoParse {
  const ignorar = compilarIgnorados(estrutura);
  const tokensIgnorar = estrutura?.tokensIgnorarRegex
    ? new RegExp(estrutura.tokensIgnorarRegex)
    : TOKENS_IGNORAR_PADRAO;
  const maxComplemento = estrutura?.maxLinhasComplemento ?? 3;

  const anoReferencia = detectarAnoReferencia(linhas);
  const avisos: string[] = [];
  const lancamentos: LancamentoParseado[] = [];

  let atual: LancamentoParseado | null = null;
  let linhasComplementoUsadas = 0;

  const finalizar = () => {
    if (!atual) return;
    atual.historicoBruto = montarHistoricoBruto(atual.tipoOperacao, atual.complemento);
    lancamentos.push(atual);
    atual = null;
    linhasComplementoUsadas = 0;
  };

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.replace(/\s+/g, ' ').trim();
    if (linha.length === 0) continue;

    if (ignorar.some((padrao) => padrao.test(linha))) {
      finalizar();
      continue;
    }

    const ancora = extrairAncora(linha, anoReferencia);
    if (ancora) {
      finalizar();
      atual = montarLancamento(ancora, tokensIgnorar);
      continue;
    }

    if (atual && linhasComplementoUsadas < maxComplemento) {
      atual.complemento = `${atual.complemento} ${linha}`.trim();
      linhasComplementoUsadas += 1;
    }
  }

  finalizar();

  if (lancamentos.length === 0) {
    avisos.push(
      'Nenhum lançamento reconhecido no PDF. Confira as linhas extraídas no diagnóstico abaixo — ' +
        'pode ser uma versão de layout diferente da cadastrada no template do banco.',
    );
  }

  const datas = lancamentos.map((l) => l.data).sort();

  return {
    lancamentos,
    periodoInicio: datas[0] ?? null,
    periodoFim: datas[datas.length - 1] ?? null,
    linhasBrutas: linhas,
    avisos,
  };
}

/**
 * Campo 7 do registro 6100: tipo de operação + complemento, em texto único.
 *
 * Em algumas versões do extrato a linha de complemento já repete o tipo de
 * operação; nesse caso o prefixo repetido é descartado, para que o histórico
 * saia igual ao do arquivo de referência do Domínio (seção 7.6).
 */
function montarHistoricoBruto(tipoOperacao: string, complemento: string): string {
  const tipo = tipoOperacao.trim();
  const resto = complemento.trim();

  if (tipo && resto.toUpperCase().startsWith(tipo.toUpperCase())) return resto;

  return [tipo, resto].filter((parte) => parte.length > 0).join(' ').replace(/\s+/g, ' ').trim();
}

interface Ancora {
  dataIso: string;
  meio: string;
  valor: number;
  tipo: 'debito' | 'credito';
}

function extrairAncora(linha: string, anoReferencia: number | undefined): Ancora | null {
  const inicio = linha.match(REGEX_DATA_INICIO);
  if (!inicio) return null;

  const dataIso = dataBrParaIso(inicio[1], anoReferencia);
  if (!dataIso) return null;

  const fim = linha.match(REGEX_VALOR_FIM);
  if (!fim) return null;

  const bruto = fim[1];
  const valor = valorBrParaNumero(bruto);
  if (!Number.isFinite(valor)) return null;

  const marcador = fim[2] ?? fim[3] ?? fim[4] ?? null;
  const tipo = determinarSentido(bruto, marcador);
  if (!tipo) return null;

  const meio = linha
    .slice(inicio[0].length, linha.length - fim[0].length)
    .replace(/\s+/g, ' ')
    .trim();

  return { dataIso, meio, valor: Math.abs(valor), tipo };
}

/**
 * Sentido do lançamento no extrato (seção 7.3): é o sinal que decide débito e
 * crédito na exportação, não uma configuração da conta contábil.
 */
function determinarSentido(bruto: string, marcador: string | null): 'debito' | 'credito' | null {
  if (marcador === '+' || marcador === 'C') return 'credito';
  if (marcador === '-' || marcador === 'D') return 'debito';
  if (bruto.startsWith('-')) return 'debito';
  // Sem marcador de sinal não dá para afirmar o sentido — melhor descartar a
  // linha do que gerar um lançamento invertido no Domínio.
  return null;
}

function montarLancamento(ancora: Ancora, tokensIgnorar: RegExp): LancamentoParseado {
  const tipoOperacao = ancora.meio
    .split(' ')
    .filter((token) => token.length > 0 && !tokensIgnorar.test(token))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    data: ancora.dataIso,
    historicoBruto: '',
    tipoOperacao,
    complemento: '',
    valor: ancora.valor,
    tipo: ancora.tipo,
  };
}

function compilarIgnorados(estrutura: EstruturaHistorico | null): RegExp[] {
  if (!estrutura?.linhasIgnorar?.length) return LINHAS_IGNORAR_PADRAO;

  const compilados: RegExp[] = [];
  for (const padrao of estrutura.linhasIgnorar) {
    try {
      compilados.push(new RegExp(padrao, 'i'));
    } catch {
      // Um padrão inválido no template não pode derrubar a importação inteira.
    }
  }
  return compilados.length > 0 ? compilados : LINHAS_IGNORAR_PADRAO;
}

/**
 * O cabeçalho do extrato traz o período ("01/08/2026 a 31/08/2026"). O ano dali
 * é usado nas linhas que só trazem dia/mês.
 */
function detectarAnoReferencia(linhas: string[]): number | undefined {
  for (const linha of linhas) {
    const achado = linha.match(/\b\d{2}\/\d{2}\/(\d{4})\b/);
    if (achado) return Number(achado[1]);
  }
  return undefined;
}
