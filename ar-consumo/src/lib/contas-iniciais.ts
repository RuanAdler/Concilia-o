import type { ContaSalva } from './stats';

// Contas de luz já conhecidas (Neoenergia Coelba). Aparecem em qualquer aparelho, sem precisar digitar.
// "fixas" = iluminação pública menos créditos (o total menos a base de cálculo do ICMS).
// kwhAr/diasComDado em 0: o app usa os dias do ar que tiver de cada período.
const conta = (c: Omit<ContaSalva, 'kwhAr' | 'diasComDado' | 'diasDoMes' | 'salvoEm' | 'fixa'> & { dias: number }): ContaSalva => {
  const { dias, ...resto } = c;
  return { ...resto, kwhAr: 0, diasComDado: 0, diasDoMes: dias, salvoEm: 0, fixa: true };
};

export const CONTAS_INICIAIS: Record<string, ContaSalva> = {
  '2026-06': conta({ mes: '2026-06', valor: 177.55, kwh: 129, fixas: 20.81, inicio: '2026-05-15', fim: '2026-06-15', dias: 31, antesDoAr: true }),
  '2026-07': conta({ mes: '2026-07', valor: 182.44, kwh: 133, fixas: 21.48, inicio: '2026-06-15', fim: '2026-07-15', dias: 30, antesDoAr: true }),
  '2026-08': conta({ mes: '2026-08', valor: 215.73, kwh: 160, fixas: 24.77, inicio: '2026-07-15', fim: '2026-08-17', dias: 33 }),
  '2026-09': conta({ mes: '2026-09', valor: 297.05, kwh: 223, fixas: 26.3, inicio: '2026-08-17', fim: '2026-09-16', dias: 30 }),
  '2026-10': conta({ mes: '2026-10', valor: 367.89, kwh: 286, fixas: 26.3, inicio: '2026-09-16', fim: '2026-10-16', dias: 30 }),
};

/** Tarifa efetiva de cada conta: (total − taxas fixas) ÷ kWh, guardada no mês da conta. */
export const TARIFAS_INICIAIS: Record<string, number> = Object.fromEntries(
  Object.values(CONTAS_INICIAIS).map((c) => [c.mes, (c.valor - c.fixas) / c.kwh]),
);

/**
 * Consumo faturado da casa nos ciclos de antes do ar (histórico de consumo da conta de luz).
 * Nov/25 a fev/26 têm o mesmo valor repetido (70 kWh) e um salto em fevereiro (205 kWh): parecem
 * faturados por média e acertados na leitura seguinte, então valem só em conjunto (`estimado`).
 */
export type CicloAntesDoAr = { ref: string; kwh: number; dias: number; estimado?: boolean };

export const CICLOS_ANTES_DO_AR: CicloAntesDoAr[] = [
  { ref: '2025-11', kwh: 70, dias: 15, estimado: true },
  { ref: '2025-12', kwh: 70, dias: 33, estimado: true },
  { ref: '2026-01', kwh: 70, dias: 29, estimado: true },
  { ref: '2026-02', kwh: 205, dias: 29, estimado: true },
  { ref: '2026-03', kwh: 125, dias: 33 },
  { ref: '2026-04', kwh: 108, dias: 28 },
  { ref: '2026-05', kwh: 123, dias: 30 },
  { ref: '2026-06', kwh: 129, dias: 31 },
  { ref: '2026-07', kwh: 133, dias: 30 },
];

/** kWh por dia da casa sem o ar: total de kWh ÷ total de dias dos ciclos informados. */
export function mediaCasaSemAr(ciclos: CicloAntesDoAr[] = CICLOS_ANTES_DO_AR): number {
  const dias = ciclos.reduce((s, c) => s + c.dias, 0);
  return dias ? ciclos.reduce((s, c) => s + c.kwh, 0) / dias : 0;
}

/** Menor e maior kWh por dia entre os ciclos medidos de verdade (sem os estimados). */
export function faixaCasaSemAr(ciclos: CicloAntesDoAr[] = CICLOS_ANTES_DO_AR): { min: number; max: number } {
  const v = ciclos.filter((c) => !c.estimado && c.dias > 0).map((c) => c.kwh / c.dias);
  return { min: Math.min(...v), max: Math.max(...v) };
}

/** Valor padrão do campo "Casa sem o ar" (texto, com vírgula): a média de todos os ciclos de antes do ar. */
export const CASA_SEM_AR_PADRAO = (Math.round(mediaCasaSemAr() * 10) / 10).toFixed(1).replace('.', ',');

/** Dia em que o ar-condicionado foi instalado; ciclos que terminam até essa data são "antes do ar". */
export const AR_INSTALADO_EM = '2026-08-14';
