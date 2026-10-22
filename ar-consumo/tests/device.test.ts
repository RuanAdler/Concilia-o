import { describe, expect, it } from 'vitest';
import { confirmado, corpoDoComando, parseEstado, validarComando } from '../src/lib/device';

const estado = {
  response: {
    operation: { airConOperationMode: 'POWER_OFF' },
    airConJobMode: { currentJobMode: 'COOL' },
    temperature: { currentTemperature: 27, targetTemperature: 20 },
    airFlow: { windStrength: 'HIGH' },
    timer: { absoluteStartTimer: 'UNSET', absoluteStopTimer: 'UNSET' },
    sleepTimer: { relativeStopTimer: 'UNSET' },
  },
};

describe('estado do aparelho', () => {
  it('interpreta a resposta real da LG', () => {
    expect(parseEstado('Gelinho ', estado)).toEqual({
      name: 'Gelinho', on: false, mode: 'frio', ambientC: 27, targetC: 20, fan: 'Alto', timerAtivo: false,
    });
  });

  it('não quebra com resposta vazia', () => {
    expect(parseEstado('', null).name).toBe('Ar-condicionado');
  });
});

describe('comandos', () => {
  it('valida a entrada', () => {
    expect(validarComando({ action: 'power', value: true })).toEqual({ action: 'power', value: true });
    expect(validarComando({ action: 'target', value: 15 })).toBeNull();
    expect(validarComando({ action: 'target', value: 22.5 })).toBeNull();
    expect(validarComando({ action: 'mode', value: 'turbo' })).toBeNull();
    expect(validarComando({ action: 'timer', value: 3 })).toBeNull();
    expect(validarComando({ action: 'timer', value: null })).toEqual({ action: 'timer', value: null });
    expect(validarComando(null)).toBeNull();
  });

  it('monta o corpo do controle', () => {
    expect(corpoDoComando({ action: 'power', value: true })).toEqual({ operation: { airConOperationMode: 'POWER_ON' } });
    expect(corpoDoComando({ action: 'target', value: 22 })).toEqual({ temperature: { targetTemperature: 22, unit: 'C' } });
    expect(corpoDoComando({ action: 'mode', value: 'ventilar' })).toEqual({ airConJobMode: { currentJobMode: 'FAN' } });
  });

  it('confere se o aparelho obedeceu', () => {
    const d = parseEstado('x', estado);
    expect(confirmado({ action: 'power', value: false }, d)).toBe(true);
    expect(confirmado({ action: 'target', value: 22 }, d)).toBe(false);
  });
});
