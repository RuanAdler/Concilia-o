import { describe, expect, it } from 'vitest';
import {
  agruparCiclos, calcularConta, cicloAnterior, cicloDe, cicloPorRef, contaAtual, custoDe, delta, diasEntre, faixasSemana,
  fatiaDaConta, mediaAnterior, mediaPorDiaSemana, periodosCiclo, previsaoCiclo, projecaoCiclo, refsDeCiclos, tarifaDaUltimaConta, tarifaDoMes,
} from '../src/lib/stats';
import { parseNum } from '../src/lib/fmt';
import { CASA_SEM_AR_PADRAO, CICLOS_ANTES_DO_AR, CONTAS_INICIAIS, TARIFAS_INICIAIS, faixaCasaSemAr, mediaCasaSemAr } from '../src/lib/contas-iniciais';

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

describe('ciclo da conta (leitura no dia 16)', () => {
  it('acha o ciclo que contém a data', () => {
    expect(cicloDe(new Date(2026, 9, 22), 16)).toEqual({ inicio: '2026-10-16', fim: '2026-11-16', ref: '2026-11' });
    expect(cicloDe(new Date(2026, 9, 16), 16).inicio).toBe('2026-10-16');
    expect(cicloDe(new Date(2026, 9, 15), 16)).toEqual({ inicio: '2026-09-16', fim: '2026-10-16', ref: '2026-10' });
  });

  it('vira o ano', () => {
    expect(cicloDe(new Date(2026, 11, 20), 16)).toEqual({ inicio: '2026-12-16', fim: '2027-01-16', ref: '2027-01' });
    expect(cicloDe(new Date(2027, 0, 5), 16)).toEqual({ inicio: '2026-12-16', fim: '2027-01-16', ref: '2027-01' });
  });

  it('a conta de referência 10/2026 cobre de 16/09 a 16/10', () => {
    const c = cicloPorRef('2026-10', 16);
    expect(c).toEqual({ inicio: '2026-09-16', fim: '2026-10-16', ref: '2026-10' });
    expect(diasEntre(c.inicio, c.fim)).toBe(30);
    expect(cicloAnterior(cicloDe(new Date(2026, 9, 22), 16), 16)).toEqual(c);
  });
});

describe('periodosCiclo e projeção', () => {
  it('separa o ciclo atual, o anterior no mesmo ponto e o acumulado', () => {
    const ds = [
      dia('2026-09-10', 9), dia('2026-09-16', 5), dia('2026-09-20', 7), dia('2026-10-10', 3),
      dia('2026-10-16', 2), dia('2026-10-20', 3), dia('2026-10-22', 4),
    ];
    const p = periodosCiclo(ds, hoje, 16, '2026-10-16', 1);
    expect(p.ciclo.inicio).toBe('2026-10-16');
    expect(p.decorridos).toBe(7); // 16 a 22 de outubro
    expect(p.totalDias).toBe(31);
    expect(p.noCiclo.map((d) => d.data)).toEqual(['2026-10-16', '2026-10-20', '2026-10-22']);
    expect(p.cicloAnt.map((d) => d.data)).toEqual(['2026-09-16', '2026-09-20']);
    expect(p.cicloAntCompleto).toBe(false);
    expect(p.acumKwh).toBe(10);
  });

  it('considera o ciclo anterior comparável quando o histórico cobre os dias', () => {
    const ant = Array.from({ length: 7 }, (_, i) => dia(`2026-09-${String(16 + i).padStart(2, '0')}`, 1));
    expect(periodosCiclo(ant, hoje, 16, '2026-10-16', 0).cicloAntCompleto).toBe(true);
  });

  it('projeta o ciclo pelo ritmo até hoje', () => {
    expect(projecaoCiclo(7, 7, 31)).toBeCloseTo(31);
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

  it('agrupa por ciclo da conta, em ordem', () => {
    const g = agruparCiclos([dia('2026-10-17', 1), dia('2026-10-15', 2), dia('2026-10-20', 3), dia('2026-09-20', 5)], 16);
    expect(g.map((x) => [x.ym, x.k, x.n, x.inicio, x.totalDias])).toEqual([
      ['2026-10', 7, 2, '2026-09-16', 30],
      ['2026-11', 4, 2, '2026-10-16', 31],
    ]);
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

describe('calcularConta', () => {
  const mes = (n: number, kwh: number) => Array.from({ length: n }, (_, i) => dia(`2026-09-${String(i + 1).padStart(2, '0')}`, kwh));

  it('acha a tarifa e a fatia do ar com o mês completo', () => {
    const r = calcularConta({ valor: 450, kwh: 400, fixas: 50, mes: '2026-09' }, mes(30, 4), hoje);
    expect(r?.tarifa).toBe(1);
    expect(r?.kwhAr).toBe(120);
    expect(r?.share).toBeCloseTo(0.3);
    expect(r?.custoAr).toBe(120);
    expect(r?.cobertura).toBe(1);
    expect(r?.desde).toBe('2026-10-01');
  });

  it('estima o mês inteiro quando só há parte dos dias', () => {
    const r = calcularConta({ valor: 400, kwh: 400, fixas: 0, mes: '2026-09' }, mes(15, 4), hoje);
    expect(r?.kwhAr).toBe(60);
    expect(r?.custoMesCheio).toBeCloseTo(120);
    expect(r?.shareMesCheio).toBeCloseTo(0.3);
  });

  it('não estima com pouquíssimos dias e recusa dados inválidos', () => {
    expect(calcularConta({ valor: 400, kwh: 400, fixas: 0, mes: '2026-09' }, mes(3, 4), hoje)?.custoMesCheio).toBeNull();
    expect(calcularConta({ valor: 40, kwh: 400, fixas: 50, mes: '2026-09' }, [], hoje)).toBeNull();
    expect(calcularConta({ valor: 400, kwh: 0, fixas: 0, mes: '2026-09' }, [], hoje)).toBeNull();
  });

  it('o acumulado começa no mês da conta se o mês seguinte ainda não chegou', () => {
    expect(calcularConta({ valor: 400, kwh: 400, fixas: 0, mes: '2026-10' }, [], hoje)?.desde).toBe('2026-10-01');
  });
});

describe('contas salvas', () => {
  const base = { valor: 450, kwh: 400, fixas: 50, kwhAr: 120, diasComDado: 30, diasDoMes: 30 };

  it('calcula a fatia de uma conta completa', () => {
    const f = fatiaDaConta(base);
    expect(f.tarifa).toBe(1);
    expect(f.share).toBeCloseTo(0.3);
    expect(f.custoAr).toBe(120);
    expect(f.estimada).toBe(false);
  });

  it('estima quando faltam dias e recusa quando faltam muitos', () => {
    const f = fatiaDaConta({ ...base, kwhAr: 60, diasComDado: 15 });
    expect(f.estimada).toBe(true);
    expect(f.share).toBeCloseTo(0.3);
    expect(fatiaDaConta({ ...base, kwhAr: 10, diasComDado: 3 }).share).toBeNull();
  });

  it('atualiza com os dias que o app tem hoje, sem perder o que foi salvo', () => {
    const salva = { mes: '2026-09', ...base, kwhAr: 60, diasComDado: 15, salvoEm: 0 };
    const mais = Array.from({ length: 30 }, (_, i) => dia(`2026-09-${String(i + 1).padStart(2, '0')}`, 4));
    expect(contaAtual(salva, mais)).toMatchObject({ kwhAr: 120, diasComDado: 30 });
    // histórico apagado: continua valendo o registro salvo
    expect(contaAtual(salva, [])).toMatchObject({ kwhAr: 60, diasComDado: 15 });
  });
});

describe('conta com datas de leitura', () => {
  const todos = Array.from({ length: 61 }, (_, i) => dia(new Date(2026, 8, 1 + i).toISOString().slice(0, 10), 5));

  it('conta o ar só entre as leituras (início inclusive, fim exclusive)', () => {
    const r = calcularConta({ valor: 367.89, kwh: 286, fixas: 26.3, mes: '2026-10', inicio: '2026-09-16', fim: '2026-10-16' }, todos, hoje);
    expect(diasEntre('2026-09-16', '2026-10-16')).toBe(30);
    expect(r?.diasDoMes).toBe(30);
    expect(r?.diasComDado).toBe(30);
    expect(r?.kwhAr).toBe(150);
    expect(r?.tarifa).toBeCloseTo(1.1944, 3);
    expect(r?.desde).toBe('2026-10-16');
  });

  it('recusa leitura atual antes da anterior', () => {
    expect(calcularConta({ valor: 100, kwh: 100, fixas: 0, mes: '2026-10', inicio: '2026-10-16', fim: '2026-09-16' }, todos, hoje)).toBeNull();
  });

  it('a conta salva usa o período ao atualizar', () => {
    const salva = { mes: '2026-10', valor: 367.89, kwh: 286, fixas: 26.3, kwhAr: 100, diasComDado: 20, diasDoMes: 30, inicio: '2026-09-16', fim: '2026-10-16', salvoEm: 0 };
    expect(contaAtual(salva, todos)).toMatchObject({ kwhAr: 150, diasComDado: 30 });
  });
});

describe('contas que já vêm no app', () => {
  const cs = Object.values(CONTAS_INICIAIS);

  it('têm as cinco contas, com tarifa efetiva por mês', () => {
    expect(cs.map((c) => c.mes)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(TARIFAS_INICIAIS['2026-10']).toBeCloseTo(1.1944, 3);
    expect(TARIFAS_INICIAIS['2026-08']).toBeCloseTo(1.1935, 3);
    expect(diasEntre('2026-07-15', '2026-08-17')).toBe(33);
  });

  it('a base de cálculo do ICMS confere com total menos taxas fixas', () => {
    const base = Object.fromEntries(cs.map((c) => [c.mes, c.valor - c.fixas]));
    expect(base['2026-08']).toBeCloseTo(190.96, 2);
    expect(base['2026-09']).toBeCloseTo(270.75, 2);
    expect(base['2026-10']).toBeCloseTo(341.59, 2);
  });

  it('estima o ar pela diferença com a casa sem o ar quando a LG não tem dados', () => {
    const set = fatiaDaConta(CONTAS_INICIAIS['2026-09'], 4.3);
    expect(set.porDiferenca).toBe(true);
    expect(set.kwhMes).toBeCloseTo(223 - 4.3 * 30, 1);
    expect(set.share).toBeCloseTo((223 - 129) / 223, 2);
    const ago = fatiaDaConta(CONTAS_INICIAIS['2026-08'], 4.3);
    expect(ago.kwhMes).toBeCloseTo(160 - 4.3 * 33, 1);
  });

  it('antes do ar a fatia é zero, e sem a base não há estimativa', () => {
    expect(fatiaDaConta(CONTAS_INICIAIS['2026-06'], 4.3)).toMatchObject({ antesDoAr: true, share: 0, custoAr: 0 });
    expect(fatiaDaConta(CONTAS_INICIAIS['2026-09'], 0).share).toBeNull();
  });

  it('com dados da LG usa a LG e mostra a diferença só para conferir', () => {
    const f = fatiaDaConta({ ...CONTAS_INICIAIS['2026-10'], kwhAr: 144, diasComDado: 25 }, 4.3);
    expect(f.porDiferenca).toBe(false);
    expect(f.kwhMes).toBeCloseTo(172.8, 1);
    expect(f.kwhDiferenca).toBeCloseTo(286 - 129, 1);
  });
});

describe('previsão do ciclo', () => {
  const dias = (n: number) => Array.from({ length: n }, (_, i) => dia(`2026-10-${String(16 + i).padStart(2, '0')}`, 5));

  it('usa o ritmo dos dias fechados, sem contar hoje', () => {
    // 16 a 21 fechados (6 dias de 5 kWh) e hoje (22) com 2 kWh parciais
    const noCiclo = [...dias(6), dia('2026-10-22', 2)];
    expect(previsaoCiclo(noCiclo, '2026-10-22', 31)).toBeCloseTo(155);
  });

  it('só aparece com 3 dias fechados e nunca fica abaixo do já gasto', () => {
    expect(previsaoCiclo(dias(2), '2026-10-22', 31)).toBeNull();
    expect(previsaoCiclo(dias(3), '2026-10-22', 3)).toBe(15);
  });
});

describe('antes do ar', () => {
  it('ciclos que terminam até 14/08 não têm ar, mesmo sem a marca', () => {
    const c = { valor: 200, kwh: 150, fixas: 20, kwhAr: 0, diasComDado: 0, diasDoMes: 30, inicio: '2026-06-15', fim: '2026-07-15' };
    expect(fatiaDaConta(c, 4.3)).toMatchObject({ antesDoAr: true, share: 0 });
    expect(fatiaDaConta({ ...c, fim: '2026-08-17' }, 4.3).antesDoAr).toBe(false);
  });
});

describe('conta incompleta', () => {
  it('sem kWh não há fatia nem estimativa', () => {
    const f = fatiaDaConta({ valor: 200, kwh: 0, fixas: 20, kwhAr: 0, diasComDado: 0, diasDoMes: 30, inicio: '2026-09-16', fim: '2026-10-16' }, 4.3);
    expect(f.incompleta).toBe(true);
    expect(f.share).toBeNull();
    expect(f.tarifa).toBe(0);
  });
});

describe('ciclos conhecidos', () => {
  it('une as contas, os dias guardados e o ciclo atual, sem repetir', () => {
    const ds = [dia('2026-09-22', 5), dia('2026-10-20', 5)];
    expect(refsDeCiclos(['2026-08', '2026-09', '2026-10'], ds, new Date(2026, 9, 22), 16)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(refsDeCiclos([], [], new Date(2026, 9, 22), 16)).toEqual(['2026-11']);
  });
});

describe('preço do kWh pela última conta', () => {
  it('usa a conta mais recente com consumo', () => {
    const r = tarifaDaUltimaConta(CONTAS_INICIAIS);
    expect(r?.mes).toBe('2026-10');
    expect(r?.tarifa).toBeCloseTo(1.1944, 3);
  });

  it('ignora contas sem kWh e devolve null sem nenhuma', () => {
    const sem = { ...CONTAS_INICIAIS['2026-10'], kwh: 0 };
    expect(tarifaDaUltimaConta({ '2026-10': sem, '2026-09': CONTAS_INICIAIS['2026-09'] })?.mes).toBe('2026-09');
    expect(tarifaDaUltimaConta({})).toBeNull();
  });
});

describe('casa antes do ar', () => {
  it('a média de todos os ciclos é de cerca de 4,0 kWh por dia', () => {
    const total = CICLOS_ANTES_DO_AR.reduce((s, c) => s + c.kwh, 0);
    const dias = CICLOS_ANTES_DO_AR.reduce((s, c) => s + c.dias, 0);
    expect(total).toBe(1033);
    expect(dias).toBe(258);
    expect(mediaCasaSemAr()).toBeCloseTo(4.0, 1);
    expect(CASA_SEM_AR_PADRAO).toBe('4,0');
  });

  it('a faixa ignora os ciclos estimados', () => {
    const f = faixaCasaSemAr();
    expect(f.min).toBeCloseTo(125 / 33, 2);
    expect(f.max).toBeCloseTo(133 / 30, 2);
  });

  it('com a média de 4,0 a LG e a diferença ficam a menos de 5% em outubro', () => {
    // LG: 143,6 kWh em 25 dias, estendido a 30 dias; diferença: 286 kWh − média × 30 dias
    const lg = (143.6 / 25) * 30;
    const dif = 286 - mediaCasaSemAr() * 30;
    expect(Math.abs(lg - dif) / dif).toBeLessThan(0.05);
  });
});
