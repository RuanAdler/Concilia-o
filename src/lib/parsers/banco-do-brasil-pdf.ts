import { dataBrParaIso } from '@/lib/nucleo/data';
import { valorBrParaNumero } from '@/lib/nucleo/numero';
import { normalizarHistorico } from '@/lib/nucleo/texto';
import {
  agruparEmLinhas,
  extrairPaginasDoPdf,
  juntarFragmentos,
  type FragmentoPdf,
} from './pdf-texto';
import type { EstruturaHistorico, LancamentoParseado, ResultadoParse } from './tipos';

/**
 * Parser do extrato do Banco do Brasil em PDF.
 *
 * O extrato é uma TABELA, e ler por linha visual não funciona: os pedaços de um
 * mesmo lançamento ficam em alturas diferentes. Layout real, medido no extrato
 * de referência:
 *
 *   Dia(x30)   Lote(x91)  Documento(x152)  Histórico(x266)          Valor(dir.)
 *   ─────────────────────────────────────────────────────────────────────────
 *                                          Pix-Recebido QR Code       <- tipo
 *   03/08/2026 14397      31101193368792   03/08 11:01 ... FULANO    45,00 (+)
 *                                          ^ complemento
 *
 * A coluna Histórico traz duas linhas por lançamento: a de cima é o tipo de
 * operação, a de baixo o complemento. A altura relativa da data varia, então
 * quem delimita a linha é o VALOR — há exatamente um por lançamento, e cada
 * fragmento pertence ao valor mais próximo em Y.
 *
 * A quebra de página corta lançamentos ao meio: o extrato de referência tem uma
 * linha cuja data sai como "14/08/202" no rodapé de uma página e "6" no topo da
 * seguinte, com o complemento junto. Por isso os fragmentos órfãos no topo de
 * cada página são costurados de volta no último lançamento da página anterior.
 */

/** "1.234,56 (+)", "1.234,56 (-)", "1.234,56 C", "1.234,56 D" ou "-1.234,56". */
const REGEX_VALOR =
  /^(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*(?:\(\s*([+-])\s*\)|([+-])|\b([CD])\b)?$/;

const REGEX_DATA = /^(\d{2}\/\d{2}\/\d{4})$/;

/** Linhas de saldo: ocupam uma linha da tabela sem ser lançamento. */
const HISTORICOS_IGNORADOS = [/\bSALDO\s+(ANTERIOR|DO DIA|EM CONTA)\b/i, /\bS A L D O\b/i];

/** Posições das colunas usadas quando o cabeçalho da tabela não é encontrado. */
const COLUNAS_PADRAO: ColunasPdf = { dia: 30, lote: 91, documento: 152, historico: 266 };

interface ColunasPdf {
  dia: number;
  lote: number;
  documento: number;
  historico: number;
}

interface FragmentoPosicionado extends FragmentoPdf {
  pagina: number;
}

interface Bloco {
  ancora: FragmentoPosicionado;
  colunas: ColunasPdf;
  fragmentos: FragmentoPosicionado[];
}

export async function parsearExtratoBancoDoBrasil(
  dados: Uint8Array,
  estrutura: EstruturaHistorico | null,
): Promise<ResultadoParse> {
  const paginas = await extrairPaginasDoPdf(dados);
  return parsearPaginasBancoDoBrasil(paginas, estrutura);
}

/** Separado da leitura do PDF para poder ser testado com fragmentos sintéticos. */
export function parsearPaginasBancoDoBrasil(
  paginas: FragmentoPdf[][],
  estrutura: EstruturaHistorico | null,
): ResultadoParse {
  const colunasConfiguradas = { ...COLUNAS_PADRAO, ...(estrutura?.colunasPdf ?? {}) };
  const blocos: Bloco[] = [];
  const avisos: string[] = [];

  paginas.forEach((fragmentosDaPagina, indicePagina) => {
    const detectadas = detectarColunas(fragmentosDaPagina);
    const colunas = detectadas ?? colunasConfiguradas;

    // Tudo acima da linha de rótulos é cabeçalho da página (nome do cliente,
    // agência/conta, título) e não pertence a lançamento nenhum.
    const corpo: FragmentoPosicionado[] = fragmentosDaPagina
      .filter((f) => (detectadas ? f.y < detectadas.alturaCabecalho - 1 : true))
      .map((f) => ({ ...f, pagina: indicePagina }));

    const ancoras = corpo
      .filter((f) => REGEX_VALOR.test(f.texto.trim()))
      .sort((a, b) => b.y - a.y);

    if (ancoras.length === 0) return;

    const novos: Bloco[] = ancoras.map((ancora) => ({ ancora, colunas, fragmentos: [] }));
    const anterior = blocos[blocos.length - 1];

    // O tipo de operação do PRIMEIRO lançamento da página também fica acima da
    // âncora dele (cerca de um terço da altura da linha). Só é continuação da
    // página anterior o que estiver mais de meia linha acima.
    const limiteOrfao = ancoras[0].y + alturaDaLinha(ancoras) / 2;

    for (const fragmento of corpo) {
      // Órfão no topo da página: continuação do lançamento que ficou cortado no
      // rodapé da página anterior.
      if (fragmento.y > limiteOrfao && anterior) {
        anterior.fragmentos.push(fragmento);
        continue;
      }

      let melhor = novos[0];
      let menorDistancia = Math.abs(fragmento.y - melhor.ancora.y);
      for (const bloco of novos) {
        const distancia = Math.abs(fragmento.y - bloco.ancora.y);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          melhor = bloco;
        }
      }
      melhor.fragmentos.push(fragmento);
    }

    blocos.push(...novos);
  });

  const lancamentos: LancamentoParseado[] = [];
  for (const bloco of blocos) {
    const lancamento = montarLancamento(bloco);
    if (lancamento) lancamentos.push(lancamento);
  }

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
    linhasBrutas: paginas.flatMap((fragmentos) => agruparEmLinhas(fragmentos)),
    avisos,
  };
}

/**
 * Altura de uma linha da tabela, medida pelo espaçamento entre âncoras da
 * própria página — assim não dependemos de constante fixa de layout.
 */
function alturaDaLinha(ancoras: FragmentoPosicionado[]): number {
  if (ancoras.length < 2) return 30;

  const espacamentos: number[] = [];
  for (let i = 1; i < ancoras.length; i++) espacamentos.push(ancoras[i - 1].y - ancoras[i].y);
  espacamentos.sort((a, b) => a - b);

  const mediana = espacamentos[Math.floor(espacamentos.length / 2)];
  return mediana > 0 ? mediana : 30;
}

/**
 * Lê as posições de coluna do próprio cabeçalho da tabela, em vez de fixá-las.
 * Assim uma mudança de largura no extrato do banco não quebra o parser.
 */
function detectarColunas(
  fragmentos: FragmentoPdf[],
): (ColunasPdf & { alturaCabecalho: number }) | null {
  const rotulos = new Map<string, FragmentoPdf>();

  for (const fragmento of fragmentos) {
    const texto = normalizarHistorico(fragmento.texto);
    if (['DIA', 'LOTE', 'DOCUMENTO', 'HISTORICO', 'VALOR'].includes(texto)) {
      if (!rotulos.has(texto)) rotulos.set(texto, fragmento);
    }
  }

  const dia = rotulos.get('DIA');
  const historico = rotulos.get('HISTORICO');
  if (!dia || !historico) return null;

  return {
    dia: dia.x,
    lote: rotulos.get('LOTE')?.x ?? dia.x + 60,
    documento: rotulos.get('DOCUMENTO')?.x ?? dia.x + 120,
    historico: historico.x,
    alturaCabecalho: Math.max(dia.y, historico.y),
  };
}

function montarLancamento(bloco: Bloco): LancamentoParseado | null {
  const achadoValor = bloco.ancora.texto.trim().match(REGEX_VALOR);
  if (!achadoValor) return null;

  const valor = valorBrParaNumero(achadoValor[1]);
  if (!Number.isFinite(valor)) return null;

  const marcador = achadoValor[2] ?? achadoValor[3] ?? achadoValor[4] ?? null;
  const tipo = determinarSentido(achadoValor[1], marcador);
  if (!tipo) return null;

  // Data: coluna Dia. Concatenada sem espaço, porque a quebra de página pode
  // partir "14/08/2026" em "14/08/202" + "6".
  const textoData = emOrdemDeLeitura(bloco.fragmentos)
    .filter((f) => Math.abs(f.x - bloco.colunas.dia) <= 5)
    .map((f) => f.texto.trim())
    .join('');

  // "00/00/0000" nas linhas de saldo do dia não passa na conversão.
  const dataIso = REGEX_DATA.test(textoData) ? dataBrParaIso(textoData) : null;
  if (!dataIso) return null;

  // Coluna Histórico: à direita dela e à esquerda da coluna de valor.
  const itensHistorico = bloco.fragmentos.filter(
    (f) => f.x >= bloco.colunas.historico - 5 && f.x < bloco.ancora.x - 5,
  );
  if (itensHistorico.length === 0) return null;

  const linhas = agruparEmLinhasDoHistorico(itensHistorico);
  const tipoOperacao = linhas[0] ?? '';
  const complemento = linhas.slice(1).join(' ').trim();

  const historicoCompleto = [tipoOperacao, complemento].filter(Boolean).join(' ');
  if (HISTORICOS_IGNORADOS.some((padrao) => padrao.test(historicoCompleto))) return null;

  return {
    data: dataIso,
    tipoOperacao,
    complemento,
    historicoBruto: historicoCompleto.replace(/\s+/g, ' ').trim(),
    valor: Math.abs(valor),
    tipo,
  };
}

/** Ordem de leitura real: página, depois Y decrescente, depois X. */
function emOrdemDeLeitura(fragmentos: FragmentoPosicionado[]): FragmentoPosicionado[] {
  return [...fragmentos].sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x);
}

/**
 * Agrupa os fragmentos da coluna Histórico em linhas. O Y reinicia a cada
 * página, então a chave de agrupamento precisa incluir a página.
 */
function agruparEmLinhasDoHistorico(fragmentos: FragmentoPosicionado[]): string[] {
  const porLinha = new Map<string, FragmentoPosicionado[]>();

  for (const fragmento of emOrdemDeLeitura(fragmentos)) {
    const chave = `${fragmento.pagina}:${Math.round(fragmento.y * 2) / 2}`;
    const lista = porLinha.get(chave) ?? [];
    lista.push(fragmento);
    porLinha.set(chave, lista);
  }

  return [...porLinha.values()]
    .map((itens) => juntarFragmentos(itens))
    .filter((linha) => linha.length > 0);
}

/**
 * Sentido do lançamento no extrato: é o sinal que decide débito e crédito na
 * exportação, não uma configuração da conta contábil.
 */
function determinarSentido(bruto: string, marcador: string | null): 'debito' | 'credito' | null {
  if (marcador === '+' || marcador === 'C') return 'credito';
  if (marcador === '-' || marcador === 'D') return 'debito';
  if (bruto.startsWith('-')) return 'debito';
  // Sem marcador de sinal não dá para afirmar o sentido — melhor descartar a
  // linha do que gerar um lançamento invertido no Domínio.
  return null;
}
