import { analisarConta } from './conta-analise';
import { AR_INSTALADO_EM, CICLOS_ANTES_DO_AR } from './contas-iniciais';
import { ymd, parseYmd } from './fmt';
import { addDias, cicloDe, contaAtual, diasDoPeriodo, diasEntre, previsaoCiclo, soma, type ContaSalva, type Dia } from './stats';

export const arred5 = (n: number) => Math.round(n / 5) * 5;

// ---------------------------------------------------------------- calibração

export type CicloUsavel = { ref: string; kwh: number; dias: number; kwhDia: number; origem: 'antes' | 'lg' };

/**
 * Ciclos em que dá para medir a casa sem o ar: (a) antes do ar, com o consumo da conta; ou (b) com a LG
 * cobrindo pelo menos 90% dos dias: consumo da conta menos o do ar. Do mais recente para o mais antigo.
 */
export function ciclosUsaveis(contas: Record<string, ContaSalva>, dias: Dia[]): CicloUsavel[] {
  const mapa = new Map<string, CicloUsavel>();
  for (const c of CICLOS_ANTES_DO_AR) {
    if (!c.estimado) mapa.set(c.ref, { ref: c.ref, kwh: c.kwh, dias: c.dias, kwhDia: c.kwh / c.dias, origem: 'antes' });
  }
  for (const conta of Object.values(contas)) {
    if (!(conta.kwh > 0)) continue;
    const a = contaAtual(conta, dias);
    const nDias = a.inicio && a.fim ? diasEntre(a.inicio, a.fim) : a.diasDoMes;
    if (nDias <= 0) continue;
    if (a.antesDoAr || (a.fim && a.fim <= AR_INSTALADO_EM)) {
      mapa.set(a.mes, { ref: a.mes, kwh: a.kwh, dias: nDias, kwhDia: a.kwh / nDias, origem: 'antes' });
      continue;
    }
    const cobertura = a.diasComDado / nDias;
    if (cobertura >= 0.9) {
      const casa = a.kwh - a.kwhAr / cobertura;
      if (casa > 0) mapa.set(a.mes, { ref: a.mes, kwh: casa, dias: nDias, kwhDia: casa / nDias, origem: 'lg' });
    }
  }
  return [...mapa.values()].sort((a, b) => b.ref.localeCompare(a.ref));
}

export type EstadoCalib = 'poucos' | 'calibrando' | 'calibrado' | 'manual';
export type Calibracao = { valor: number; calculado: number; estado: EstadoCalib; usados: CicloUsavel[]; n: number };

/** Casa sem o ar (kWh por dia): total de kWh ÷ total de dias dos até `max` ciclos utilizáveis mais recentes. */
export function calibrar(usaveis: CicloUsavel[], auto: boolean, manual: number, padrao: number, max = 6): Calibracao {
  const usados = usaveis.slice(0, max);
  const dias = usados.reduce((s, c) => s + c.dias, 0);
  const calculado = dias ? usados.reduce((s, c) => s + c.kwh, 0) / dias : padrao;
  if (!auto) return { valor: manual > 0 ? manual : calculado, calculado, estado: 'manual', usados, n: usados.length };
  const estado: EstadoCalib = usados.length >= 3 ? 'calibrado' : usados.length > 0 ? 'calibrando' : 'poucos';
  return { valor: calculado, calculado, estado, usados, n: usados.length };
}

// ------------------------------------------------------------------ previsão

export type Previsao = { ref: string; valor: number; margem: number; salvoEm: string };

/** Margem da faixa: média do erro das últimas previsões + 4 pontos (mínimo 5%, ou 10% sem calibração). Sem erros: 12%. */
export function margemDaFaixa(erros: number[], calibrado: boolean): number {
  if (!erros.length) return 0.12;
  const ult = erros.slice(-3);
  const media = ult.reduce((s, e) => s + e, 0) / ult.length;
  return Math.max(calibrado ? 0.05 : 0.1, media + 0.04);
}

export const faixaDe = (valor: number, margem: number) => ({ baixo: arred5(valor * (1 - margem)), alto: arred5(valor * (1 + margem)) });

export type ContaPrevista = {
  valor: number;
  baixo: number;
  alto: number;
  margem: number;
  kwhAr: number;
  kwhCasa: number;
  semAr: number;
  diasCiclo: number;
  tarifa: number;
  fixas: number;
};

/** Conta prevista = (kWh previstos do ar + casa sem o ar × dias do ciclo) × preço do kWh + taxas fixas. */
export function contaPrevista(p: { kwhAr: number; semAr: number; diasCiclo: number; tarifa: number; fixas: number; margem: number }): ContaPrevista {
  const kwhCasa = p.semAr * p.diasCiclo;
  const exato = (p.kwhAr + kwhCasa) * p.tarifa + p.fixas;
  return { valor: arred5(exato), ...faixaDe(exato, p.margem), margem: p.margem, kwhAr: p.kwhAr, kwhCasa, semAr: p.semAr, diasCiclo: p.diasCiclo, tarifa: p.tarifa, fixas: p.fixas };
}

/** Taxas fixas (iluminação pública) da conta mais recente. */
export function fixasDaUltimaConta(contas: Record<string, ContaSalva>): number {
  const c = Object.values(contas).filter((x) => x.fixas > 0).sort((a, b) => b.mes.localeCompare(a.mes))[0];
  return c?.fixas ?? 0;
}

export function previsaoDaConta(a: { dias: Dia[]; hoje: Date; diaLeitura: number; tarifa: number; semAr: number; fixas: number; margem: number; passada: number | null }) {
  const hojeStr = ymd(a.hoje);
  const ciclo = cicloDe(a.hoje, a.diaLeitura);
  const totalDias = diasEntre(ciclo.inicio, ciclo.fim);
  const decorridos = diasEntre(ciclo.inicio, hojeStr) + 1;
  const noCiclo = diasDoPeriodo(a.dias, ciclo.inicio, ciclo.fim).filter((d) => d.data <= hojeStr);
  const quartoDia = ymd(addDias(parseYmd(ciclo.inicio), 3));
  const prevAr = previsaoCiclo(noCiclo, hojeStr, totalDias);
  const base = { ciclo, totalDias, decorridos, quartoDia, passada: a.passada, gastoKwh: soma(noCiclo) };
  if (prevAr == null || a.tarifa <= 0) return { ...base, espera: true as const, prev: null };
  return { ...base, espera: false as const, prev: contaPrevista({ kwhAr: prevAr, semAr: a.semAr, diasCiclo: totalDias, tarifa: a.tarifa, fixas: a.fixas, margem: a.margem }) };
}
export type PrevisaoDaConta = ReturnType<typeof previsaoDaConta>;

// ------------------------------------------------------------ previsto × real

export type Comparacao = { ref: string; previsto: number; real: number; erro: number; margem: number; dentro: boolean; diferenca: number };

export function comparacoes(previsoes: Record<string, Previsao>, contas: Record<string, ContaSalva>): Comparacao[] {
  const lista: Comparacao[] = [];
  for (const p of Object.values(previsoes)) {
    const real = contas[p.ref]?.valor;
    if (!real || real <= 0) continue;
    const { baixo, alto } = faixaDe(p.valor, p.margem);
    lista.push({ ref: p.ref, previsto: p.valor, real, erro: Math.abs(real - p.valor) / real, margem: p.margem, dentro: real >= baixo && real <= alto, diferenca: real - p.valor });
  }
  return lista.sort((a, b) => a.ref.localeCompare(b.ref));
}

/** A previsão guardada fica a de meio de ciclo: vale a que o usuário viu quando ainda dava para mudar o ritmo. */
export const DIAS_PARA_GUARDAR_PREVISAO = 15;
export const deveGuardarPrevisao = (decorridos: number, jaGuardada: boolean) => decorridos >= 4 && (!jaGuardada || decorridos <= DIAS_PARA_GUARDAR_PREVISAO);
