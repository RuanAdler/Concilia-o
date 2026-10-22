export type Sessao = { id: string; inicio: number; fim: number | null };

export type Config = {
  potenciaW: number;
  tarifa: number;
  baseKwh: number;
};

export const CONFIG_PADRAO: Config = { potenciaW: 1000, tarifa: 0.95, baseKwh: 0 };

export function horasDaSessao(s: Sessao, agora: number): number {
  const fim = s.fim ?? agora;
  return Math.max(0, fim - s.inicio) / 3_600_000;
}

export function kwhEstimado(horas: number, potenciaW: number): number {
  return (horas * potenciaW) / 1000;
}

export function custo(kwh: number, tarifa: number): number {
  return kwh * tarifa;
}

export function inicioDoDia(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Horas de uso de uma sessão que caem dentro da janela [de, ate). */
export function horasNaJanela(s: Sessao, de: number, ate: number, agora: number): number {
  const ini = Math.max(s.inicio, de);
  const fim = Math.min(s.fim ?? agora, ate);
  return Math.max(0, fim - ini) / 3_600_000;
}

export function resumo(sessoes: Sessao[], cfg: Config, agora: number) {
  const hoje = inicioDoDia(agora);
  const semana = hoje - 6 * 86_400_000;
  const d = new Date(agora);
  const mes = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const fimTudo = agora + 1;
  const soma = (de: number) =>
    sessoes.reduce((h, s) => h + horasNaJanela(s, de, fimTudo, agora), 0);
  const montar = (horas: number, extraKwh = 0) => {
    const kwh = kwhEstimado(horas, cfg.potenciaW) + extraKwh;
    return { horas, kwh, reais: custo(kwh, cfg.tarifa) };
  };
  return {
    hoje: montar(soma(hoje)),
    semana: montar(soma(semana)),
    mes: montar(soma(mes)),
    total: montar(soma(0), cfg.baseKwh),
  };
}

export function formatarHoras(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}
