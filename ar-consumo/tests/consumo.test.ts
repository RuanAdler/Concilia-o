import { describe, expect, it } from 'vitest';
import { custo, horasNaJanela, kwhEstimado, resumo, CONFIG_PADRAO } from '../src/lib/consumo';

const H = 3_600_000;

describe('consumo', () => {
  it('converte horas e potência em kWh e reais', () => {
    expect(kwhEstimado(2, 1000)).toBe(2);
    expect(custo(2, 0.9)).toBeCloseTo(1.8);
  });

  it('corta sessões na janela', () => {
    const s = { id: '1', inicio: 0, fim: 10 * H };
    expect(horasNaJanela(s, 4 * H, 20 * H, 99 * H)).toBe(6);
  });

  it('sessão aberta conta até agora e soma a base no total', () => {
    const agora = new Date(2026, 9, 22, 12).getTime();
    const s = { id: '1', inicio: agora - 2 * H, fim: null };
    const r = resumo([s], { ...CONFIG_PADRAO, potenciaW: 1000, tarifa: 1, baseKwh: 5 }, agora);
    expect(r.hoje.kwh).toBeCloseTo(2);
    expect(r.total.kwh).toBeCloseTo(7);
    expect(r.total.reais).toBeCloseTo(7);
  });
});
