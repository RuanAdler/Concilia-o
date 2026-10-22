import { describe, expect, it } from 'vitest';
import { agruparMeses, custoDe, delta, faixasSemana, mediaAnterior, mediaPorDiaSemana, periodos, projecaoMes, tarifaDoMes } from '../src/lib/stats';
import { parseNum } from '../src/lib/fmt';

const dia = (data: string, kwh: number) => ({ data, kwh });
const hoje = new Date(2026, 9, 22);

describe('delta', () => {
  it('calcula variação e trata base zero', () => {
    expect(delta(12, 10)?.pct).toBeCloseTo(20);
    expect(delta(5, 10)?.subiu).toBe(false);
    expect(delta(5, 0)).toBeNull();
  });
});

describe('mediaAnterior', () => {
  it('exclui hoje e usa só os dias com dado', () => {
    const ds = [dia('2026-10-20', 4), dia('2026-10-21', 6), dia('2026-10-22', 100)];
    expect(mediaAnterior(ds, hoje)).toBe(5);
    expect(mediaAnterior([dia('2026-10-22', 3)], hoje)).toBe(0);
  });
});

describe('tarifaDoMes', () => {
  it('usa a tarifa que valia em cada mês', () => {
    const t = { '2026-09': 0.9, '2026-11': 1.1 };
    expect(tarifaDoMes(t, 1.1, '2026-08')).toBe(0.9);
    expect(tarifaDoMes(t, 1.1, '2026-10')).toBe(0.9);
    expect(tarifaDoMes(t, 1.1, '2026-12')).toBe(1.1);
    expect(tarifaDoMes({}, 0.95, '2026-10')).toBe(0.95);
  });

  it('mudar a tarifa não reescreve meses passados', () => {
    const ds = [dia('2026-10-10', 10), dia('2026-11-10', 10)];
    expect(custoDe(ds, { '2026-10': 1, '2026-11': 2 }, 2)).toBe(30);
  });
});

describe('periodos e projeção', () => {
  it('separa 7 dias, mês, mês anterior e acumulado', () => {
    const ds = [
      dia('2026-09-10', 5), dia('2026-09-25', 7),
      dia('2026-10-01', 2), dia('2026-10-20', 3), dia('2026-10-22', 4),
    ];
    const p = periodos(ds, hoje, '2026-10-01', 1);
    expect(p.ult7.map((d) => d.data)).toEqual(['2026-10-20', '2026-10-22']);
    expect(p.mes).toHaveLength(3);
    expect(p.mesAnt.map((d) => d.data)).toEqual(['2026-09-10']);
    expect(p.acumKwh).toBe(10);
    expect(p.mesAntCompleto).toBe(false);
  });

  it('considera o mês anterior comparável quando o histórico cobre os dias', () => {
    const set = Array.from({ length: 20 }, (_, i) => dia(`2026-09-${String(i + 1).padStart(2, '0')}`, 1));
    expect(periodos(set, hoje, '2026-09-01', 0).mesAntCompleto).toBe(true);
  });

  it('projeta o mês pelo ritmo até hoje', () => {
    expect(projecaoMes(22, hoje)).toBeCloseTo(31);
  });
});

describe('agrupamentos', () => {
  it('agrupa em faixas de semana', () => {
    const f = faixasSemana([dia('2026-10-02', 1), dia('2026-10-09', 2), dia('2026-10-30', 4)], 31);
    expect(f.map((w) => w.k)).toEqual([1, 2, 0, 0, 4]);
  });

  it('média por dia da semana começa na segunda', () => {
    const m = mediaPorDiaSemana([dia('2026-10-19', 4), dia('2026-10-26', 6), dia('2026-10-25', 9)]);
    expect(m[0]).toEqual({ w: 1, v: 5 });
    expect(m[6]).toEqual({ w: 0, v: 9 });
  });

  it('agrupa por mês em ordem', () => {
    const g = agruparMeses([dia('2026-10-01', 1), dia('2026-09-30', 2), dia('2026-10-02', 3)]);
    expect(g.map((x) => [x.ym, x.k, x.n])).toEqual([['2026-09', 2, 1], ['2026-10', 4, 2]]);
  });
});

describe('parseNum', () => {
  it('aceita vírgula, ponto e milhar', () => {
    expect(parseNum('0,89')).toBe(0.89);
    expect(parseNum('1.234,5')).toBe(1234.5);
    expect(parseNum('12.5')).toBe(12.5);
    expect(parseNum('abc')).toBe(0);
  });
});
