import { describe, expect, it } from 'vitest';
import { mesclarDias, parseEnergia, resumoReal, somarDesde } from '../src/lib/energia';

const resposta = {
  response: {
    result: {
      dataList: [
        { energyUsage: 5030, usedDate: '20260922' },
        { usedDate: '20260923', energyUsage: 3000 },
        { energyUsage: 'x', usedDate: '20260924' },
        { energyUsage: 10, usedDate: 'invalida' },
      ],
    },
  },
};

describe('energia da LG', () => {
  it('converte Wh em kWh e ignora itens inválidos', () => {
    expect(parseEnergia(resposta)).toEqual([
      { data: '2026-09-22', kwh: 5.03 },
      { data: '2026-09-23', kwh: 3 },
    ]);
  });

  it('devolve lista vazia para respostas inesperadas', () => {
    expect(parseEnergia(null)).toEqual([]);
    expect(parseEnergia({ response: {} })).toEqual([]);
  });

  it('mescla histórico e o dado novo vence', () => {
    const m = mesclarDias({ '2026-09-22': 1, '2026-09-21': 2 }, parseEnergia(resposta));
    expect(m['2026-09-22']).toBe(5.03);
    expect(m['2026-09-21']).toBe(2);
  });

  it('soma por janela', () => {
    const dias = { '2026-10-20': 4, '2026-10-21': 3, '2026-10-22': 2, '2026-09-30': 9 };
    const agora = new Date(2026, 9, 22, 12).getTime();
    const r = resumoReal(dias, agora, '2026-10-21');
    expect(r.hoje).toBe(2);
    expect(r.semana).toBe(9);
    expect(r.mes).toBe(9);
    expect(r.acumulado).toBe(5);
    expect(somarDesde(dias, '2026-09-01')).toBe(18);
  });
});
