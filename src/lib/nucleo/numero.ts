/** Converte "1.234,56" (formato brasileiro) para 1234.56. */
export function valorBrParaNumero(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : NaN;
}

/** Converte 1234.56 para "1234,56" — layout do Domínio: vírgula decimal, sem milhar. */
export function numeroParaValorDominio(valor: number): string {
  return Math.abs(valor).toFixed(2).replace('.', ',');
}

/** Formata para exibição na tela: "R$ 1.234,56". */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Mediana de uma lista de números (usada na detecção de outlier, seção 4.5). */
export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}
