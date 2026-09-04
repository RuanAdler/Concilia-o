import type { FragmentoPdf } from '@/lib/parsers/pdf-texto';

/**
 * Fragmentos posicionados que reproduzem a geometria REAL do extrato do Banco
 * do Brasil, medida no PDF de referência (LCI Serviços Médicos, agosto/2026).
 *
 * Os nomes e documentos são fictícios — o extrato real tem CPF e nome de
 * clientes e não entra no repositório —, mas todas as coordenadas, larguras de
 * coluna e quebras vêm do arquivo verdadeiro.
 */

export function fragmento(texto: string, x: number, y: number, largura?: number): FragmentoPdf {
  return { texto, x, y, largura: largura ?? texto.length * 4.7 };
}

/** Cabeçalho que se repete no topo de cada página do extrato. */
export function cabecalhoPagina(alturaBase = 810.7): FragmentoPdf[] {
  return [
    fragmento('Extrato de Conta Corrente', 70, alturaBase, 116.7),
    fragmento('Cliente', 71, alturaBase - 22, 31.1),
    fragmento('CLINICA EXEMPLO LTDA', 110, alturaBase - 22, 147.8),
    fragmento('Agência: 4231-5', 220, alturaBase - 43, 72.8),
    fragmento('Conta: 108959-5', 303.9, alturaBase - 43, 74.5),
    fragmento('Lançamentos', 30, alturaBase - 60, 66),
    // Linha de rótulos: é dela que o parser lê a posição de cada coluna.
    fragmento('Dia', 30, alturaBase - 74.7, 15),
    fragmento('Lote', 91, alturaBase - 74.7, 19.5),
    fragmento('Documento', 152, alturaBase - 74.7, 51.1),
    fragmento('Histórico', 266, alturaBase - 74.7, 38.9),
    fragmento('Valor', 546.7, alturaBase - 74.7, 23.3),
  ];
}

/**
 * Lançamento no formato mais comum: o tipo de operação fica ACIMA da data, e o
 * complemento na mesma altura do valor.
 */
export function lancamentoComum(opcoes: {
  base: number;
  data: string;
  lote: string;
  documento: string;
  tipo: string;
  complemento: string;
  valor: string;
}): FragmentoPdf[] {
  return [
    fragmento(opcoes.tipo, 266, opcoes.base + 10.5, 93.5),
    fragmento(opcoes.data, 30, opcoes.base + 5.2, 45),
    fragmento(opcoes.lote, 91, opcoes.base, 25),
    fragmento(opcoes.documento, 152, opcoes.base, 70.1),
    fragmento(opcoes.complemento, 266, opcoes.base, 187.1),
    fragmento(opcoes.valor, 533.7, opcoes.base, 36.3),
  ];
}

/**
 * Variante observada no extrato real (ex.: "Seg Créd Proteg Empresa"): o tipo
 * de operação fica na MESMA altura da data e o complemento cai ABAIXO do valor.
 * É o caso que derruba qualquer parser baseado em linha visual.
 */
export function lancamentoTipoAlinhadoComData(opcoes: {
  base: number;
  data: string;
  lote: string;
  documento: string;
  tipo: string;
  complemento: string;
  valor: string;
}): FragmentoPdf[] {
  return [
    fragmento(opcoes.data, 30, opcoes.base + 5.2, 45),
    fragmento(opcoes.tipo, 266, opcoes.base + 5.2, 105.5),
    fragmento(opcoes.lote, 91, opcoes.base, 25),
    fragmento(opcoes.documento, 152, opcoes.base, 25),
    fragmento(opcoes.valor, 531, opcoes.base, 39),
    fragmento(opcoes.complemento, 266, opcoes.base - 5.3, 137.5),
  ];
}

/** Linha de saldo: ocupa uma linha da tabela, mas não é lançamento. */
export function linhaSaldo(base: number, data: string, texto: string, valor: string): FragmentoPdf[] {
  return [
    fragmento(data, 30, base + 5.2, 45),
    fragmento(texto, 266, base, 57),
    fragmento(valor, 516.2, base, 53.8),
  ];
}
