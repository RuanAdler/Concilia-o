export type Mode = 'frio' | 'ventilar' | 'desumidificar' | 'aquecer' | 'auto';

export const MODES: Record<Mode, string> = {
  frio: 'Frio',
  ventilar: 'Ventilar',
  desumidificar: 'Tirar umidade',
  aquecer: 'Aquecer',
  auto: 'Automático',
};

export const LG_MODE: Record<Mode, string> = {
  frio: 'COOL',
  ventilar: 'FAN',
  desumidificar: 'AIR_DRY',
  aquecer: 'HEAT',
  auto: 'AUTO',
};

const MODE_DA_LG: Record<string, Mode> = {
  COOL: 'frio', FAN: 'ventilar', AIR_DRY: 'desumidificar', DRY: 'desumidificar', HEAT: 'aquecer', AUTO: 'auto',
};

const VENTO: Record<string, string> = {
  AUTO: 'Auto', LOW: 'Baixo', LOW_MID: 'Baixo-médio', MID: 'Médio', MID_HIGH: 'Médio-alto', HIGH: 'Alto', POWER: 'Turbo', NATURE: 'Natural',
};

export type Device = {
  name: string;
  on: boolean;
  mode: Mode;
  ambientC: number | null;
  targetC: number | null;
  fan: string;
  timerAtivo: boolean;
};

type Estado = {
  response?: {
    operation?: { airConOperationMode?: string };
    airConJobMode?: { currentJobMode?: string };
    temperature?: { currentTemperature?: number; targetTemperature?: number };
    airFlow?: { windStrength?: string; windStrengthDetail?: string };
    timer?: { absoluteStopTimer?: string; relativeStopTimer?: string };
    sleepTimer?: { relativeStopTimer?: string };
  };
};

export function parseEstado(nome: string, raw: unknown): Device {
  const r = (raw as Estado | null)?.response ?? {};
  const vento = r.airFlow?.windStrength ?? '';
  const timers = [r.timer?.absoluteStopTimer, r.timer?.relativeStopTimer, r.sleepTimer?.relativeStopTimer];
  return {
    name: nome.trim() || 'Ar-condicionado',
    on: r.operation?.airConOperationMode === 'POWER_ON',
    mode: MODE_DA_LG[r.airConJobMode?.currentJobMode ?? ''] ?? 'auto',
    ambientC: typeof r.temperature?.currentTemperature === 'number' ? r.temperature.currentTemperature : null,
    targetC: typeof r.temperature?.targetTemperature === 'number' ? r.temperature.targetTemperature : null,
    fan: VENTO[vento] ?? (vento ? vento.toLowerCase() : '—'),
    timerAtivo: timers.some((t) => t === 'SET'),
  };
}

export type Comando =
  | { action: 'power'; value: boolean }
  | { action: 'target'; value: number }
  | { action: 'mode'; value: Mode }
  | { action: 'timer'; value: 1 | 2 | 4 | null };

export function validarComando(b: unknown): Comando | null {
  const { action, value } = (b ?? {}) as { action?: unknown; value?: unknown };
  if (action === 'power' && typeof value === 'boolean') return { action, value };
  if (action === 'target' && typeof value === 'number' && Number.isInteger(value) && value >= 16 && value <= 30) return { action, value };
  if (action === 'mode' && typeof value === 'string' && value in LG_MODE) return { action, value: value as Mode };
  if (action === 'timer' && (value === null || value === 1 || value === 2 || value === 4)) return { action, value };
  return null;
}

/** Corpo do POST /devices/{id}/control da ThinQ Connect. */
export function corpoDoComando(c: Comando): Record<string, unknown> {
  switch (c.action) {
    case 'power':
      return { operation: { airConOperationMode: c.value ? 'POWER_ON' : 'POWER_OFF' } };
    case 'target':
      return { temperature: { targetTemperature: c.value, unit: 'C' } };
    case 'mode':
      return { airConJobMode: { currentJobMode: LG_MODE[c.value] } };
    case 'timer':
      return c.value === null
        ? { timer: { relativeStopTimer: 'UNSET' } }
        : { timer: { relativeHourToStop: c.value, relativeMinuteToStop: 0 } };
  }
}

/** O estado lido depois do comando já reflete o que foi pedido? */
export function confirmado(c: Comando, d: Device): boolean {
  switch (c.action) {
    case 'power': return d.on === c.value;
    case 'target': return d.targetC === c.value;
    case 'mode': return d.mode === c.value;
    case 'timer': return d.timerAtivo === (c.value !== null);
  }
}
