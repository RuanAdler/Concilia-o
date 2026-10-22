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

export function dataLocal(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function somarDesde(dias: Record<string, number>, desde: string, ate = '9999-99-99'): number {
  let total = 0;
  for (const [data, kwh] of Object.entries(dias)) if (data >= desde && data <= ate) total += kwh;
  return total;
}

export function resumoReal(dias: Record<string, number>, agora: number, desdeAcumulado: string) {
  const hoje = dataLocal(agora);
  const sete = dataLocal(agora - 6 * 86_400_000);
  const mes = `${hoje.slice(0, 8)}01`;
  return {
    hoje: somarDesde(dias, hoje),
    semana: somarDesde(dias, sete),
    mes: somarDesde(dias, mes),
    acumulado: somarDesde(dias, desdeAcumulado),
  };
}
