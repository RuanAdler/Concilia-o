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

/** Consumo médio da casa antes do ar (contas de junho e julho), em kWh por dia. */
export const CASA_SEM_AR_PADRAO = '4,3';

/** Dia em que o ar-condicionado foi instalado; ciclos que terminam até essa data são "antes do ar". */
export const AR_INSTALADO_EM = '2026-08-14';
