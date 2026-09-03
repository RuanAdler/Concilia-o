import { distance } from 'fastest-levenshtein';

/**
 * Similaridade 0..1 entre dois textos já normalizados.
 * Usada na camada 3 (tipo de operação), onde "PIX RECEBIDO" e
 * "PIX RECEBIDO QR CODE" precisam apontar para a mesma regra base.
 */
export function similaridade(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maior = Math.max(a.length, b.length);
  const base = 1 - distance(a, b) / maior;

  // Um texto que é prefixo do outro (variação com sufixo, como "QR CODE")
  // é forte indício de mesma operação, mesmo com Levenshtein baixo.
  if (a.startsWith(b) || b.startsWith(a)) {
    const cobertura = Math.min(a.length, b.length) / maior;
    return Math.max(base, 0.8 + cobertura * 0.2);
  }

  return base;
}

/**
 * Índice de sinônimos do template do banco: cada variação aponta para a forma
 * canônica, para que a comparação vire uma igualdade barata.
 */
export function montarIndiceSinonimos(
  sinonimos: Record<string, string[]> | undefined | null,
): Map<string, string> {
  const indice = new Map<string, string>();
  if (!sinonimos) return indice;

  for (const [canonico, variacoes] of Object.entries(sinonimos)) {
    indice.set(canonico, canonico);
    for (const variacao of variacoes) indice.set(variacao, canonico);
  }
  return indice;
}

export function formaCanonica(texto: string, indice: Map<string, string>): string {
  return indice.get(texto) ?? texto;
}
