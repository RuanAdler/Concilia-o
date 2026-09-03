/**
 * Normalização de texto usada pelo motor de classificação (seção 4.1).
 * Tudo em maiúsculo, sem acento, sem espaço duplicado, sem pontuação irrelevante.
 */

/** Remove acentos preservando as letras (NFD + descarte dos diacríticos combinantes). */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Forma canônica usada para comparação textual.
 * Mantém letras, dígitos e espaço; qualquer outra pontuação vira espaço,
 * de modo que "Pix - Recebido" e "Pix-Recebido" colapsam para o mesmo texto.
 */
export function normalizarHistorico(texto: string): string {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza um nome de pessoa/empresa para comparação (mesma regra do histórico). */
export function normalizarNome(nome: string): string {
  return normalizarHistorico(nome);
}

/** Mantém somente os dígitos — usado em CPF/CNPJ. */
export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Converte para ISO-8859-1 "seguro": caracteres fora da faixa Latin-1
 * (aspas tipográficas, travessões, espaços especiais) viram equivalentes ASCII,
 * para que a conversão final de encoding não produza lixo dentro do Domínio
 * (seção 7.4 da especificação).
 */
const SUBSTITUICOES_LATIN1: Array<[RegExp, string]> = [
  [/[‘’‛′]/g, "'"],
  [/[“”‟″]/g, '"'],
  [/[–—−]/g, '-'],
  [/[…]/g, '...'],
  [/[•]/g, '-'],
  [/[  -​ 　]/g, ' '],
];

export function prepararParaLatin1(texto: string): string {
  let saida = texto;
  for (const [de, para] of SUBSTITUICOES_LATIN1) saida = saida.replace(de, para);

  // Qualquer resíduo acima de U+00FF perde o acento; se nem assim couber, vira '?'.
  return Array.from(saida)
    .map((caractere) => {
      if (caractere.charCodeAt(0) <= 0xff) return caractere;
      const semAcento = removerAcentos(caractere);
      return semAcento && semAcento.charCodeAt(0) <= 0xff ? semAcento : '?';
    })
    .join('');
}
