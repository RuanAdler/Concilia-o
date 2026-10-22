import { ymd } from './fmt';

export type DiaEnergia = { data: string; kwh: number };

/** A LG informa energyUsage por dia em Wh (confirmar contra a conta de luz). */
const WH_POR_KWH = 1000;

/** Extrai os dias da resposta de /devices/energy/{id}/usage. */
export function parseEnergia(raw: unknown): DiaEnergia[] {
  const lista = (raw as { response?: { result?: { dataList?: unknown } } } | null)?.response?.result?.dataList;
  if (!Array.isArray(lista)) return [];
  const dias: DiaEnergia[] = [];
  for (const item of lista) {
    const { usedDate, energyUsage } = item as { usedDate?: unknown; energyUsage?: unknown };
    if (typeof usedDate !== 'string' || !/^\d{8}$/.test(usedDate)) continue;
    if (typeof energyUsage !== 'number' || !Number.isFinite(energyUsage)) continue;
    dias.push({
      data: `${usedDate.slice(0, 4)}-${usedDate.slice(4, 6)}-${usedDate.slice(6)}`,
      kwh: energyUsage / WH_POR_KWH,
    });
  }
  return dias.sort((a, b) => a.data.localeCompare(b.data));
}

/** Junta dias novos ao histórico guardado; o valor mais recente de cada data vence. */
export function mesclarDias(antigos: Record<string, number>, novos: DiaEnergia[]): Record<string, number> {
  const saida = { ...antigos };
  for (const d of novos) saida[d.data] = d.kwh;
  return saida;
}

export const dataLocal = (ts: number) => ymd(new Date(ts));
