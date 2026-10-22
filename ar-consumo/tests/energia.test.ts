import { describe, expect, it } from 'vitest';
import { mesclarDias, parseEnergia } from '../src/lib/energia';

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
});
