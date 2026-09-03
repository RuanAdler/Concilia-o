import { parsearExtratoBancoDoBrasil } from './banco-do-brasil-pdf';
import { parsearCsv } from './csv';
import { parsearOfx } from './ofx';
import type { BancoTemplate, ResultadoParse } from './tipos';

export * from './tipos';
export { parsearLinhasBancoDoBrasil } from './banco-do-brasil-pdf';
export { parsearOfx } from './ofx';
export { parsearCsv } from './csv';

/**
 * Ponto único de entrada da camada de parsing: a empresa escolhe a conta
 * bancária, a conta aponta para um template, e o template decide qual parser
 * roda (seção 1.2 — a empresa nunca redefine o layout de leitura).
 */
export async function parsearExtrato(
  arquivo: Uint8Array,
  template: BancoTemplate,
): Promise<ResultadoParse> {
  const estrutura = template.estrutura_historico ?? null;

  switch (template.formato_origem) {
    case 'pdf':
      return parsearExtratoBancoDoBrasil(arquivo, estrutura);
    case 'ofx':
      return parsearOfx(decodificar(arquivo), estrutura);
    case 'csv':
      return parsearCsv(decodificar(arquivo), estrutura);
    default:
      throw new Error(`Formato de origem não suportado: ${template.formato_origem}`);
  }
}

/**
 * Extratos brasileiros em texto vêm em UTF-8 ou Latin-1. Tentamos UTF-8 estrito
 * e caímos para Latin-1 quando há byte inválido — o contrário produziria
 * "Ã§" no lugar de "ç" no histórico exportado.
 */
function decodificar(dados: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(dados);
  } catch {
    return new TextDecoder('iso-8859-1').decode(dados);
  }
}
