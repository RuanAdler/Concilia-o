import { AR_INSTALADO_EM } from './contas-iniciais';
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

export const DIA_LEITURA_PADRAO = 16;

/** Dia da leitura válido: de 1 a 28, para existir em todos os meses. */
export const clampDia = (n: number) => (Number.isFinite(n) ? Math.min(28, Math.max(1, Math.round(n))) : DIA_LEITURA_PADRAO);

/** Ciclo de faturamento: do dia da leitura (inclusive) até a leitura seguinte (exclusive). `ref` é o mês da conta. */
export type Ciclo = { inicio: string; fim: string; ref: string };

const noDia = (ano: number, mes0: number, dia: number) => ymd(new Date(ano, mes0, dia));

export function cicloDe(data: Date, dia: number): Ciclo {
  const d = clampDia(dia);
  const a = data.getFullYear();
  const m = data.getMonth();
  const [mi, mf] = data.getDate() >= d ? [m, m + 1] : [m - 1, m];
  const fim = noDia(a, mf, d);
  return { inicio: noDia(a, mi, d), fim, ref: fim.slice(0, 7) };
}

/** Ciclo de uma conta pelo mês de referência (AAAA-MM): termina na leitura daquele mês. */
export function cicloPorRef(ref: string, dia: number): Ciclo {
  const d = clampDia(dia);
  const a = Number(ref.slice(0, 4));
  const m = Number(ref.slice(5, 7)) - 1;
  return { inicio: noDia(a, m - 1, d), fim: noDia(a, m, d), ref };
}

export function cicloAnterior(c: Ciclo, dia: number): Ciclo {
  return cicloPorRef(c.inicio.slice(0, 7), dia);
}

export function periodosCiclo(ds: Dia[], hoje: Date, dia: number, desde: string, base: number) {
  const h = ymd(hoje);
  const ciclo = cicloDe(hoje, dia);
  const ant = cicloAnterior(ciclo, dia);
  const totalDias = diasEntre(ciclo.inicio, ciclo.fim);
  const decorridos = diasEntre(ciclo.inicio, h) + 1; // conta o dia de hoje
  const noCiclo = diasDoPeriodo(ds, ciclo.inicio, ciclo.fim).filter((d) => d.data <= h);
  // mesma quantidade de dias do ciclo anterior, para comparar o que já passou
  const cicloAnt = diasDoPeriodo(ds, ant.inicio, ymd(addDias(parseYmd(ant.inicio), decorridos)));
  const ult7 = ds.filter((d) => d.data >= ymd(addDias(hoje, -6)) && d.data <= h);
  const ant7 = ds.filter((d) => d.data >= ymd(addDias(hoje, -13)) && d.data <= ymd(addDias(hoje, -7)));
  const acum = ds.filter((d) => d.data >= desde && d.data <= h);
  return {
    ciclo, ant, totalDias, decorridos, noCiclo, cicloAnt,
    // só compara com o ciclo anterior se o histórico dele cobre quase todos os dias já decorridos
    cicloAntCompleto: cicloAnt.length >= Math.ceil(decorridos * 0.8),
    ult7, ant7: ant7.length === 7 ? ant7 : [], acum, acumKwh: soma(acum) + base,
  };
}

export const projecaoCiclo = (kwh: number, decorridos: number, totalDias: number) => (kwh / decorridos) * totalDias;

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

/** Agrupa os dias por ciclo da conta, do mais antigo para o mais novo. */
export function agruparCiclos(ds: Dia[], dia: number) {
  const mapa = new Map<string, { ciclo: Ciclo; dias: Dia[] }>();
  for (const d of ds) {
    const ciclo = cicloDe(parseYmd(d.data), dia);
    const g = mapa.get(ciclo.ref);
    if (g) g.dias.push(d);
    else mapa.set(ciclo.ref, { ciclo, dias: [d] });
  }
  return [...mapa.values()]
    .sort((a, b) => a.ciclo.ref.localeCompare(b.ciclo.ref))
    .map(({ ciclo, dias }) => ({
      ym: ciclo.ref,
      ano: Number(ciclo.ref.slice(0, 4)),
      mes: Number(ciclo.ref.slice(5, 7)) - 1,
      inicio: ciclo.inicio,
      fim: ciclo.fim,
      totalDias: diasEntre(ciclo.inicio, ciclo.fim),
      dias,
      k: soma(dias),
      n: dias.length,
    }));
}

export type ContaNumeros = { valor: number; kwh: number; fixas: number; mes: string; inicio?: string; fim?: string };

/** Dias com dado entre `inicio` (inclusive) e `fim` (exclusive), como nas datas de leitura da conta. */
export const diasDoPeriodo = (ds: Dia[], inicio: string, fim: string) => ds.filter((d) => d.data >= inicio && d.data < fim);

export const diasEntre = (inicio: string, fim: string) =>
  Math.round((parseYmd(fim).getTime() - parseYmd(inicio).getTime()) / 86_400_000);

/**
 * A partir da conta de luz (valor, kWh e taxas fixas de um mês AAAA-MM) calcula a tarifa
 * e a fatia que foi do ar-condicionado, com os dias que o app tem daquele mês.
 */
export function calcularConta(c: ContaNumeros, dias: Dia[], hoje: Date) {
  if (!(c.kwh > 0) || !(c.valor - c.fixas > 0) || !/^\d{4}-\d{2}$/.test(c.mes)) return null;
  const periodo = c.inicio && c.fim ? { inicio: c.inicio, fim: c.fim } : null;
  if (periodo && !(periodo.fim > periodo.inicio)) return null;
  const tarifa = (c.valor - c.fixas) / c.kwh;
  const ano = Number(c.mes.slice(0, 4));
  const mes0 = Number(c.mes.slice(5)) - 1;
  const dm = periodo ? diasDoPeriodo(dias, periodo.inicio, periodo.fim) : doMes(dias, ano, mes0);
  const diasDoMes = periodo ? diasEntre(periodo.inicio, periodo.fim) : diasNoMes(ano, mes0);
  const cobertura = dm.length / diasDoMes;
  const kwhAr = soma(dm);
  const mesCheio = cobertura >= 0.3 ? kwhAr / cobertura : null; // estimativa do período inteiro
  const seguinte = new Date(ano, mes0 + 1, 1);
  const desde = periodo
    ? parseYmd(periodo.fim) > hoje ? periodo.inicio : periodo.fim
    : ymd(seguinte > hoje ? new Date(ano, mes0, 1) : seguinte);
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
    desde,
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
  inicio?: string; // datas de leitura da conta (início inclusive, fim exclusive); sem elas vale o mês
  fim?: string;
  salvoEm: number;
  fixa?: boolean; // conta que já vem no app
  antesDoAr?: boolean; // ciclo antes de o ar ser instalado
};

/**
 * Tarifa e fatia do ar de uma conta. Com os dias do ar que o app tem, usa-os (estimando o período inteiro
 * se faltarem dias). Sem dados suficientes, estima pela diferença entre a conta e o consumo da casa sem o ar.
 */
export function fatiaDaConta(
  c: Pick<ContaSalva, 'valor' | 'kwh' | 'fixas' | 'kwhAr' | 'diasComDado' | 'diasDoMes' | 'inicio' | 'fim' | 'antesDoAr'>,
  semArDia = 0,
) {
  const tarifa = c.kwh > 0 ? Math.max(0, c.valor - c.fixas) / c.kwh : 0;
  const diasPeriodo = c.inicio && c.fim ? diasEntre(c.inicio, c.fim) : c.diasDoMes;
  const cobertura = c.diasDoMes > 0 ? c.diasComDado / c.diasDoMes : 0;
  const kwhDiferenca = semArDia > 0 && diasPeriodo > 0 ? Math.max(0, c.kwh - semArDia * diasPeriodo) : null;
  const antesDoAr = Boolean(c.antesDoAr) || Boolean(c.fim && c.fim <= AR_INSTALADO_EM);
  const incompleta = !(c.kwh > 0);
  const base = { tarifa, cobertura, kwhDiferenca, antesDoAr, incompleta };
  if (antesDoAr) return { ...base, estimada: false, porDiferenca: false, share: 0, custoAr: 0, kwhMes: 0 };
  const kwhMes = cobertura >= 0.95 ? c.kwhAr : cobertura >= 0.3 ? c.kwhAr / cobertura : null;
  if (kwhMes != null && c.kwh > 0) {
    return { ...base, estimada: cobertura < 0.95, porDiferenca: false, share: kwhMes / c.kwh, custoAr: kwhMes * tarifa, kwhMes };
  }
  if (kwhDiferenca != null && c.kwh > 0) {
    return { ...base, estimada: true, porDiferenca: true, share: kwhDiferenca / c.kwh, custoAr: kwhDiferenca * tarifa, kwhMes: kwhDiferenca };
  }
  return { ...base, estimada: cobertura < 0.95, porDiferenca: false, share: null as number | null, custoAr: null as number | null, kwhMes: null as number | null };
}

/** Usa os dias que o app tem hoje daquele mês, a menos que o registro salvo tenha mais dias. */
export function contaAtual(c: ContaSalva, dias: Dia[]): ContaSalva {
  const dm = c.inicio && c.fim ? diasDoPeriodo(dias, c.inicio, c.fim) : doMes(dias, Number(c.mes.slice(0, 4)), Number(c.mes.slice(5)) - 1);
  return dm.length >= c.diasComDado ? { ...c, kwhAr: soma(dm), diasComDado: dm.length } : c;
}

/**
 * Previsão de consumo do ciclo inteiro pelo ritmo dos dias já fechados (hoje fica de fora, porque ainda está
 * contando). Só existe com pelo menos `minDias` dias fechados e nunca fica abaixo do que já foi gasto.
 */
export function previsaoCiclo(noCiclo: Dia[], hojeStr: string, totalDias: number, minDias = 3): number | null {
  const fechados = noCiclo.filter((d) => d.data < hojeStr);
  if (fechados.length < minDias) return null;
  return Math.max((soma(fechados) / fechados.length) * totalDias, soma(noCiclo));
}

/** Meses de referência de todos os ciclos que o app conhece: contas, dias guardados e o ciclo atual. */
export function refsDeCiclos(refsContas: string[], dias: Dia[], hoje: Date, dia: number): string[] {
  const set = new Set(refsContas);
  for (const d of dias) set.add(cicloDe(parseYmd(d.data), dia).ref);
  set.add(cicloDe(hoje, dia).ref);
  return [...set].sort();
}

/** Preço do kWh da conta mais recente que tem consumo: (total − taxas fixas) ÷ kWh. */
export function tarifaDaUltimaConta(contas: Record<string, ContaSalva>): { mes: string; tarifa: number } | null {
  const c = Object.values(contas)
    .filter((x) => x.kwh > 0 && x.valor > x.fixas)
    .sort((a, b) => b.mes.localeCompare(a.mes))[0];
  return c ? { mes: c.mes, tarifa: (c.valor - c.fixas) / c.kwh } : null;
}
