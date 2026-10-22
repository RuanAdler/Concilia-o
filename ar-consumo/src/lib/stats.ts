import { parseYmd, ymd } from './fmt';

export type Dia = { data: string; kwh: number };
export type Tarifas = Record<string, number>;

export const mapaParaDias = (m: Record<string, number>): Dia[] =>
  Object.entries(m)
    .map(([data, kwh]) => ({ data, kwh }))
    .sort((a, b) => a.data.localeCompare(b.data));

export const soma = (ds: Dia[]) => ds.reduce((s, d) => s + d.kwh, 0);
export const addDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const diasNoMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();
export const doMes = (ds: Dia[], ano: number, mes: number) =>
  ds.filter((d) => {
    const x = parseYmd(d.data);
    return x.getFullYear() === ano && x.getMonth() === mes;
  });

export function delta(atual: number, anterior: number) {
  if (!anterior) return null;
  const r = atual / anterior - 1;
  return { r, subiu: r >= 0, pct: Math.abs(r * 100) };
}

/** Média diária dos até `n` dias anteriores a hoje que têm dado (hoje não entra). */
export function mediaAnterior(ds: Dia[], hoje: Date, n = 30): number {
  const de = ymd(addDias(hoje, -n));
  const ate = ymd(hoje);
  const p = ds.filter((d) => d.data >= de && d.data < ate);
  return p.length ? soma(p) / p.length : 0;
}

/**
 * Tarifa que valia no mês `ym` (AAAA-MM): a última registrada até esse mês;
 * antes do primeiro registro vale a primeira; sem registros, a tarifa atual.
 */
export function tarifaDoMes(tarifas: Tarifas, atual: number, ym: string): number {
  const ks = Object.keys(tarifas).sort();
  if (!ks.length) return atual;
  let t = tarifas[ks[0]];
  for (const k of ks) if (k <= ym) t = tarifas[k];
  return t;
}

export const custoDe = (ds: Dia[], tarifas: Tarifas, atual: number) =>
  ds.reduce((s, d) => s + d.kwh * tarifaDoMes(tarifas, atual, d.data.slice(0, 7)), 0);

export function periodos(ds: Dia[], hoje: Date, desde: string, base: number) {
  const h = ymd(hoje);
  const ult7 = ds.filter((d) => d.data >= ymd(addDias(hoje, -6)) && d.data <= h);
  const ant7 = ds.filter((d) => d.data >= ymd(addDias(hoje, -13)) && d.data <= ymd(addDias(hoje, -7)));
  const mes = doMes(ds, hoje.getFullYear(), hoje.getMonth()).filter((d) => d.data <= h);
  const pm = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnt = doMes(ds, pm.getFullYear(), pm.getMonth()).filter((d) => Number(d.data.slice(8)) <= hoje.getDate());
  const acum = ds.filter((d) => d.data >= desde && d.data <= h);
  // só compara com o mês anterior se o histórico dele cobre quase todos os dias já decorridos neste mês
  const mesAntCompleto = mesAnt.length >= Math.ceil(hoje.getDate() * 0.8);
  return { ult7, ant7: ant7.length === 7 ? ant7 : [], mes, mesAnt, mesAntCompleto, acum, acumKwh: soma(acum) + base };
}

export const projecaoMes = (kwhMes: number, hoje: Date) =>
  (kwhMes / hoje.getDate()) * diasNoMes(hoje.getFullYear(), hoje.getMonth());

export function faixasSemana(ds: Dia[], dim: number) {
  const faixas: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, 28], [29, dim]];
  return faixas.map(([a, b]) => {
    const x = ds.filter((d) => {
      const n = Number(d.data.slice(8));
      return n >= a && n <= b;
    });
    return { a, b, k: soma(x), n: x.length };
  });
}

/** Média de kWh por dia da semana (segunda a domingo). */
export function mediaPorDiaSemana(ds: Dia[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((w) => {
    const a = ds.filter((d) => parseYmd(d.data).getDay() === w);
    return { w, v: a.length ? soma(a) / a.length : 0 };
  });
}

export function agruparMeses(ds: Dia[]) {
  const mapa = new Map<string, Dia[]>();
  for (const d of ds) {
    const k = d.data.slice(0, 7);
    mapa.set(k, [...(mapa.get(k) ?? []), d]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, dias]) => ({ ym, ano: Number(ym.slice(0, 4)), mes: Number(ym.slice(5)) - 1, dias, k: soma(dias), n: dias.length }));
}

export type ContaNumeros = { valor: number; kwh: number; fixas: number; mes: string };

/**
 * A partir da conta de luz (valor, kWh e taxas fixas de um mês AAAA-MM) calcula a tarifa
 * e a fatia que foi do ar-condicionado, com os dias que o app tem daquele mês.
 */
export function calcularConta(c: ContaNumeros, dias: Dia[], hoje: Date) {
  if (!(c.kwh > 0) || !(c.valor - c.fixas > 0) || !/^\d{4}-\d{2}$/.test(c.mes)) return null;
  const tarifa = (c.valor - c.fixas) / c.kwh;
  const ano = Number(c.mes.slice(0, 4));
  const mes0 = Number(c.mes.slice(5)) - 1;
  const dm = doMes(dias, ano, mes0);
  const diasDoMes = diasNoMes(ano, mes0);
  const cobertura = dm.length / diasDoMes;
  const kwhAr = soma(dm);
  const mesCheio = cobertura >= 0.3 ? kwhAr / cobertura : null; // estimativa do mês inteiro
  const seguinte = new Date(ano, mes0 + 1, 1);
  return {
    tarifa,
    kwhAr,
    custoAr: kwhAr * tarifa,
    share: kwhAr / c.kwh,
    diasComDado: dm.length,
    diasDoMes,
    cobertura,
    shareMesCheio: mesCheio != null ? mesCheio / c.kwh : null,
    custoMesCheio: mesCheio != null ? mesCheio * tarifa : null,
    desde: ymd(seguinte > hoje ? new Date(ano, mes0, 1) : seguinte),
  };
}

/** Conta de luz salva para um mês, com o consumo do ar daquele mês no momento em que foi salva. */
export type ContaSalva = {
  mes: string; // AAAA-MM
  valor: number;
  kwh: number;
  fixas: number;
  kwhAr: number;
  diasComDado: number;
  diasDoMes: number;
  salvoEm: number;
};

/** Tarifa e fatia do ar de uma conta; estima o mês inteiro se o app só tinha parte dos dias. */
export function fatiaDaConta(c: Pick<ContaSalva, 'valor' | 'kwh' | 'fixas' | 'kwhAr' | 'diasComDado' | 'diasDoMes'>) {
  const tarifa = c.kwh > 0 ? Math.max(0, c.valor - c.fixas) / c.kwh : 0;
  const cobertura = c.diasDoMes > 0 ? c.diasComDado / c.diasDoMes : 0;
  const kwhMes = cobertura >= 0.95 ? c.kwhAr : cobertura >= 0.3 ? c.kwhAr / cobertura : null;
  return {
    tarifa,
    cobertura,
    estimada: cobertura < 0.95,
    share: kwhMes != null && c.kwh > 0 ? kwhMes / c.kwh : null,
    custoAr: kwhMes != null ? kwhMes * tarifa : null,
    kwhMes,
  };
}

/** Usa os dias que o app tem hoje daquele mês, a menos que o registro salvo tenha mais dias. */
export function contaAtual(c: ContaSalva, dias: Dia[]): ContaSalva {
  const dm = doMes(dias, Number(c.mes.slice(0, 4)), Number(c.mes.slice(5)) - 1);
  return dm.length >= c.diasComDado ? { ...c, kwhAr: soma(dm), diasComDado: dm.length } : c;
}
