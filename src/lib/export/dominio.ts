import { isoParaDataDominio } from '@/lib/nucleo/data';
import { numeroParaValorDominio } from '@/lib/nucleo/numero';
import { apenasDigitos, prepararParaLatin1 } from '@/lib/nucleo/texto';

/**
 * Gerador do TXT de importação do Domínio — seção 7 da especificação.
 *
 * Layout validado contra um arquivo real gerado pelo próprio Domínio
 * (Utilitários > Importação > Importador). Mantido isolado neste módulo,
 * incluindo a conversão de encoding, para que qualquer ajuste de layout fique
 * num ponto só (recomendação da seção 7.5).
 */

/**
 * Todo registro é escrito como |campo|campo|...|campo| — pipe na abertura,
 * no fechamento e entre campos.
 */
function montarRegistro(campos: Array<string | null | undefined>): string {
  return `|${campos.map((campo) => campo ?? '').join('|')}|`;
}

/**
 * Campos reservados do registro 6100 (8 em diante). No arquivo de referência
 * eles aparecem sempre vazios, resultando no sufixo "||||" após o histórico.
 * Isolado como constante porque é a pendência 7.5 a confirmar com o Domínio.
 */
const CAMPOS_RESERVADOS_6100 = 3;

/**
 * Quebra de linha do arquivo. O importador do Domínio roda em Windows; CRLF é o
 * padrão dos arquivos gerados por ele. Trocar aqui caso o arquivo de referência
 * use LF.
 */
export const QUEBRA_LINHA = '\r\n';

/**
 * Limite de caracteres do campo 7. A especificação (7.5) deixa isso como
 * pendência; `null` desliga o truncamento e preserva o histórico inteiro.
 */
export const LIMITE_HISTORICO: number | null = null;

export interface LancamentoParaExportar {
  /** Data ISO AAAA-MM-DD. */
  data: string;
  /** Sentido no extrato: `credito` = entrou dinheiro, `debito` = saiu. */
  tipo: 'debito' | 'credito';
  /** Sempre positivo. */
  valor: number;
  /** Código Domínio da conta contábil da contraparte (o que o motor decide). */
  codigoContaContrapartida: string;
  /** Histórico completo: tipo de operação + complemento do extrato. */
  historico: string;
}

export interface DadosExportacao {
  /** CNPJ da empresa; a pontuação é removida na geração. */
  cnpjEmpresa: string;
  /** Código Domínio da conta contábil do próprio banco no balancete. */
  codigoContaBanco: string;
  /** Código do Histórico Padrão cadastrado no Domínio (ex.: '75'). */
  codigoHistoricoPadrao: string;
  lancamentos: LancamentoParaExportar[];
}

/**
 * Regra de débito/crédito (seção 7.3): derivada do sinal do extrato, não de um
 * atributo da conta.
 *   entrada (crédito no extrato) -> campo 3 = conta banco, campo 4 = contrapartida
 *   saída   (débito  no extrato) -> campo 3 = contrapartida, campo 4 = conta banco
 */
export function resolverDebitoCredito(
  tipo: 'debito' | 'credito',
  codigoContaBanco: string,
  codigoContaContrapartida: string,
): { debito: string; credito: string } {
  return tipo === 'credito'
    ? { debito: codigoContaBanco, credito: codigoContaContrapartida }
    : { debito: codigoContaContrapartida, credito: codigoContaBanco };
}

/** Gera o conteúdo do arquivo como string (ainda em UTF-16 interno do JS). */
export function gerarTxtDominio(dados: DadosExportacao): string {
  const linhas: string[] = [];

  // Registro 0000 — cabeçalho do arquivo, uma única vez.
  linhas.push(montarRegistro(['0000', apenasDigitos(dados.cnpjEmpresa)]));

  const reservados = Array<string>(CAMPOS_RESERVADOS_6100).fill('');

  for (const lancamento of dados.lancamentos) {
    // Registro 6000 — abertura, repetido antes de cada 6100. Constante.
    linhas.push(montarRegistro(['6000', 'X', '', '', '']));

    const { debito, credito } = resolverDebitoCredito(
      lancamento.tipo,
      dados.codigoContaBanco,
      lancamento.codigoContaContrapartida,
    );

    linhas.push(
      montarRegistro([
        '6100',
        isoParaDataDominio(lancamento.data),
        debito,
        credito,
        numeroParaValorDominio(lancamento.valor),
        dados.codigoHistoricoPadrao,
        prepararHistorico(lancamento.historico),
        ...reservados,
      ]),
    );
  }

  return linhas.join(QUEBRA_LINHA) + QUEBRA_LINHA;
}

/**
 * Ponto crítico da seção 7.4: o arquivo DEVE sair em ISO-8859-1 (Latin-1).
 * Em UTF-8 (padrão do Node/Next) todo caractere acentuado do histórico —
 * "Crédito", "Transferência", "Serviços" — chega corrompido dentro do Domínio.
 */
export function gerarArquivoDominio(dados: DadosExportacao): Buffer {
  return Buffer.from(prepararParaLatin1(gerarTxtDominio(dados)), 'latin1');
}

function prepararHistorico(historico: string): string {
  // O pipe é o separador de campos: se aparecer no histórico, quebra o layout.
  const limpo = historico.replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return LIMITE_HISTORICO ? limpo.slice(0, LIMITE_HISTORICO) : limpo;
}

/** Nome sugerido para o download. */
export function nomeArquivoExportacao(cnpj: string, periodoInicio: string | null): string {
  const marcador = periodoInicio ? periodoInicio.replace(/-/g, '') : 'sem-periodo';
  return `dominio_${apenasDigitos(cnpj)}_${marcador}.txt`;
}
