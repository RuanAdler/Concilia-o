export type Vibracao = 'leve' | 'sucesso' | 'erro';

const PADROES: Record<Vibracao, number | number[]> = { leve: 7, sucesso: [10, 40, 10], erro: [60, 40, 60] };

let ligada = true;
export const definirVibracao = (on: boolean) => { ligada = on; };

/** Vibra se o aparelho permitir (só Android) e o usuário não desligou nos Ajustes. */
export function vibrar(tipo: Vibracao) {
  if (!ligada || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(PADROES[tipo]); } catch { /* sem suporte */ }
}

export const reduzMovimento = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const easeOutCubica = (p: number) => 1 - Math.pow(1 - p, 3);
