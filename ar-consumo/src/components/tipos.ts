import type { Config } from '@/lib/cliente';
import type { Calibracao, Comparacao, PrevisaoDaConta, Previsao } from '@/lib/previsao';
import type { ContaSalva, Tarifas, Dia } from '@/lib/stats';

export type Cmd = { status: 'pending' | 'ok' | 'error'; label: string; retry?: () => void } | null;

/** Dados já derivados que as telas consomem. */
export type Dados = {
  cfg: Config;
  dias: Dia[];
  hoje: Date;
  tarifa: number;
  diaLeitura: number;
  semArDia: number;
  tarifas: Tarifas;
  desde: string;
  base: number;
  primeiro: string;
  contas: Record<string, ContaSalva>;
  cal: Calibracao;
  calibAviso: CalibAviso | null;
  contaPrev: PrevisaoDaConta;
  previsoes: Record<string, Previsao>;
  comps: Comparacao[];
};

export type CalibAviso = { de: number; para: number; ref: string; em: number };
