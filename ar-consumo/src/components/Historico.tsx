'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { analisarConta, type AnaliseConta } from '@/lib/conta-analise';
import { MONTHS, WD, WDL, brl, brl0, cap, dl, nf, parseNum, parseYmd, ymd } from '@/lib/fmt';
import { useMontado } from '@/lib/cliente';
import { addDias, cicloDe, cicloPorRef, custoDe, diasDoPeriodo, diasEntre, mediaPorDiaSemana, previsaoCiclo, refsDeCiclos, soma, tarifaDoMes, type Ciclo } from '@/lib/stats';
import { Ajuda, Selo } from './selos';
import { Seg, card } from './ui';
import type { Dados } from './tipos';

type Vista = 'dia' | 'conta';

const PLURAL = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados'];
const MON3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const nomeRef = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;
const venceEm = (fim: string) => MONTHS[Number(fim.slice(5, 7)) % 12];
const botaoNav = (desligado: boolean) => ({ width: 44, height: 44, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: desligado ? 0.35 : 1 }) as const;
const crescer = 'cubic-bezier(.2,.8,.2,1)';

export default function Historico({ d }: { d: Dados }) {
  const { cfg, dias, hoje, tarifa, tarifas, diaLeitura, semArDia, contas } = d;
  const montado = useMontado();
  const [vista, setVista] = useState<Vista>('dia');
  const hojeStr = ymd(hoje);
  const atual = cicloDe(hoje, diaLeitura);
  const tarifaMes = tarifaDoMes(tarifas, tarifa, hojeStr.slice(0, 7));
  const primeiro = dias[0]?.data ?? hojeStr;

  // todos os ciclos conhecidos (contas + dias guardados + o atual), com as datas reais quando há conta
  const refs = refsDeCiclos(Object.keys(contas), dias, hoje, diaLeitura);
  const ciclos: Ciclo[] = refs.map((r) => {
    if (r === atual.ref) return atual;
    const c = contas[r];
    const auto = cicloPorRef(r, diaLeitura);
    return { ref: r, inicio: c?.inicio ?? auto.inicio, fim: c?.fim ?? auto.fim };
  });

  const [selRef, setSelRef] = useState<string>(atual.ref);
  const [selDia, setSelDia] = useState<string | null>(null);
  const [selConta, setSelConta] = useState<string>(atual.ref);

  return (
    <>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Histórico</h1>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Tudo aqui segue a conta de luz: de um dia {diaLeitura} ao outro.</div>
      </header>
      <Seg<Vista> opts={[['dia', 'Dia a dia'], ['conta', 'Conta a conta']]} cur={vista} onSel={setVista} />

      {vista === 'dia' ? diaADia() : contaAConta()}
    </>
  );

  // ---------------------------------------------------------------- Dia a dia
  function diaADia() {
    const i = Math.max(0, ciclos.findIndex((c) => c.ref === selRef));
    const ciclo = ciclos[i];
    const andamento = ciclo.ref === atual.ref;
    const doCiclo = diasDoPeriodo(dias, ciclo.inicio, ciclo.fim).filter((x) => x.data <= hojeStr);
    const totalDias = diasEntre(ciclo.inicio, ciclo.fim);
    const decorridos = andamento ? diasEntre(ciclo.inicio, hojeStr) + 1 : totalDias;
    const kwh = soma(doCiclo);
    const custo = custoDe(doCiclo, tarifas, tarifa);
    const max = Math.max(...doCiclo.map((x) => x.kwh), 0.1);
    const slots = Array.from({ length: totalDias }, (_, n) => ymd(addDias(parseYmd(ciclo.inicio), n)));
    const selecionado = selDia && slots.includes(selDia) ? selDia : doCiclo[doCiclo.length - 1]?.data ?? null;
    const selK = selecionado ? doCiclo.find((x) => x.data === selecionado)?.kwh ?? null : null;
    const caro = doCiclo.reduce<typeof doCiclo[number] | null>((m, x) => (!m || x.kwh > m.kwh ? x : m), null);
    const semana = mediaPorDiaSemana(dias);
    const topSemana = semana.reduce((m, x) => (x.v > m.v ? x : m), semana[0]);
    const custoDia = (x: { data: string; kwh: number }) => x.kwh * tarifaDoMes(tarifas, tarifa, x.data.slice(0, 7));

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => { setSelRef(ciclos[i - 1].ref); setSelDia(null); }} disabled={i === 0} aria-label="Conta anterior" className="press" style={botaoNav(i === 0)}><ChevronLeft size={22} /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Conta {nomeRef(ciclo.ref)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{dl(parseYmd(ciclo.inicio))} a {dl(parseYmd(ciclo.fim))}{andamento ? ' · em andamento' : ` · vence em ${venceEm(ciclo.fim)}`}</div>
          </div>
          <button onClick={() => { setSelRef(ciclos[i + 1].ref); setSelDia(null); }} disabled={i === ciclos.length - 1} aria-label="Próxima conta" className="press" style={botaoNav(i === ciclos.length - 1)}><ChevronRight size={22} /></button>
        </div>

        {doCiclo.length === 0 ? (
          <div style={{ ...card(26, '30px 22px'), textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 10 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarDays size={32} color="var(--accent)" /></div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Esta conta é de antes do app guardar o dia a dia</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
              O app começou a guardar o consumo de cada dia em {dl(parseYmd(primeiro))} de {primeiro.slice(0, 4)}. Para esta conta, veja o total em Conta a conta.
            </div>
            <button onClick={() => { setSelConta(ciclo.ref); setVista('conta'); }} className="press" style={{ height: 46, padding: '0 22px', borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 800, fontSize: 15 }}>Ver Conta a conta</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {[
                { r: 'Custo do ar', v: brl0(custo), s: '≈ estimativa' },
                { r: 'Consumo', v: `${nf(kwh, 0)} kWh`, s: '● real · LG' },
                { r: 'Por dia', v: `${nf(kwh / doCiclo.length, 1)} kWh`, s: brl(custo / doCiclo.length) },
              ].map((t) => (
                <div key={t.r} style={card(18, '12px 12px')}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{t.r}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{t.v}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{t.s}</div>
                </div>
              ))}
            </div>

            <section style={card(26, '18px 16px 14px')}>
              <div style={{ minHeight: 40, marginBottom: 10 }}>
                {selecionado && (
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {cap(WDL[parseYmd(selecionado).getDay()])}, {dl(parseYmd(selecionado))}:{' '}
                    {selK != null ? `${nf(selK)} kWh · ${brl(custoDia({ data: selecionado, kwh: selK }))}` : 'sem dado'}
                    {selecionado === hojeStr ? ' (ainda contando)' : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 150 }}>
                {slots.map((data) => {
                  const k = doCiclo.find((x) => x.data === data)?.kwh ?? null;
                  return (
                    <button key={data} onClick={() => setSelDia(data)} aria-label={`${dl(parseYmd(data))}: ${k != null ? `${nf(k)} kWh` : 'sem dado'}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <span style={{ display: 'block', width: '100%', height: k != null ? (montado ? `${Math.max(4, (k / max) * 100)}%` : '0%') : '6%', borderRadius: '3px 3px 2px 2px', border: k != null ? 'none' : '1.5px dashed var(--line)', background: k == null ? 'transparent' : data === selecionado ? 'var(--ink)' : data === hojeStr ? 'var(--accent)' : 'var(--bar)', transition: `height .7s ${crescer}` }} />
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 6 }}>
                <span>{dl(parseYmd(slots[0]))}</span><span>{dl(parseYmd(slots[Math.floor(slots.length / 2)]))}</span><span>{dl(parseYmd(slots[slots.length - 1]))}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Toque numa barra para ver o dia. Tracejado = sem dado ou ainda não chegou.</div>
            </section>

            <section style={{ ...card(22, '14px 16px'), display: 'grid', gap: 8, fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
              {andamento && <div>Conta em andamento: dia {decorridos} de {totalDias}.</div>}
              {!andamento && doCiclo.length < totalDias && <div>O app só tem {doCiclo.length} de {totalDias} dias desta conta.</div>}
              {caro && <div>Dia mais caro: {WDL[parseYmd(caro.data).getDay()]}, {dl(parseYmd(caro.data))} ({brl(custoDia(caro))}).</div>}
              {dias.length >= 14 && topSemana.v > 0 && <div>{PLURAL[topSemana.w]} costumam custar mais: em média {brl(topSemana.v * tarifaMes)} por dia.</div>}
            </section>
          </>
        )}
      </>
    );
  }

  // ------------------------------------------------------------- Conta a conta
  function contaAConta() {
    const meta = (cfg.goalType === 'R$' ? parseNum(cfg.goal) : parseNum(cfg.goalKwh) * tarifaMes) || 0;
    type Linha = { ref: string; ciclo: Ciclo; arR: number | null; prevR: number | null; tipo: 'lg' | 'estimativa' | 'diferenca' | 'antes' | 'andamento' | 'semdados'; a: AnaliseConta | null };
    const linhas: Linha[] = ciclos.map((ciclo) => {
      if (ciclo.ref === atual.ref) {
        const noCiclo = diasDoPeriodo(dias, ciclo.inicio, ciclo.fim).filter((x) => x.data <= hojeStr);
        const gasto = custoDe(noCiclo, tarifas, tarifa);
        const prev = previsaoCiclo(noCiclo, hojeStr, diasEntre(ciclo.inicio, ciclo.fim));
        return { ref: ciclo.ref, ciclo, arR: gasto, prevR: prev != null ? Math.max(prev * tarifaMes, gasto) : null, tipo: 'andamento', a: null };
      }
      const c = contas[ciclo.ref];
      if (c) {
        const a = analisarConta(c, dias, semArDia);
        const tipo = a.tipo === 'antes' ? 'antes' : a.tipo === 'incompleta' || a.arR == null ? 'semdados' : (a.tipo as 'lg' | 'estimativa' | 'diferenca');
        return { ref: ciclo.ref, ciclo, arR: tipo === 'antes' ? 0 : a.arR, prevR: null, tipo, a };
      }
      // ciclo com dias guardados mas sem conta lançada
      const dc = diasDoPeriodo(dias, ciclo.inicio, ciclo.fim);
      return { ref: ciclo.ref, ciclo, arR: dc.length ? custoDe(dc, tarifas, tarifa) : null, prevR: null, tipo: dc.length ? 'estimativa' : 'semdados', a: null };
    });
    const maxR = Math.max(...linhas.map((l) => Math.max(l.arR ?? 0, l.prevR ?? 0)), meta, 1) * 1.1;
    const alvo = linhas.find((l) => l.ref === selConta) ?? linhas[linhas.length - 1];
    const idx = linhas.indexOf(alvo);
    const anterior = idx > 0 ? linhas[idx - 1] : null;
    const base = alvo.tipo === 'andamento' ? alvo.prevR : alvo.arR;
    const comparavel = base != null && anterior && anterior.arR != null && anterior.tipo !== 'antes' && anterior.tipo !== 'semdados' && anterior.arR >= 25 ? anterior.arR : null; // base pequena demais não serve de comparação
    const dif = comparavel != null && base != null ? base - comparavel : null;
    const seloTipo = alvo.tipo === 'lg' ? <Selo tipo="real" texto="Real · LG" /> : alvo.tipo === 'diferenca' ? <Selo tipo="diferenca" /> : alvo.tipo === 'estimativa' ? <Selo tipo="estimativa" /> : alvo.tipo === 'andamento' ? <Selo tipo="previsao" /> : <Selo tipo="neutro" texto={alvo.tipo === 'antes' ? 'Antes do ar' : 'Sem dados do ar'} />;
    const decorridos = diasEntre(atual.inicio, hojeStr) + 1;

    return (
      <section style={{ ...card(26, '18px 16px 16px'), display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Custo do ar em cada conta</h2>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>o mês é o da conta de luz{meta > 0 ? ` · — meta ${brl0(meta)}` : ''}</div>
        </div>
        <Ajuda>Cada barra é uma conta de luz (de dia {diaLeitura} a dia {diaLeitura}). Barra cheia: consumo informado pela LG. Barra clara com &quot;≈&quot;: estimada pela diferença com o consumo da casa sem o ar. Listrado: previsão até o fim desta conta.</Ajuda>

        <div style={{ flexBasis: '100%', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170 }}>
            {linhas.slice(-7).map((l) => {
              const sel = l.ref === alvo.ref;
              const sol = l.arR ?? 0;
              const prevExtra = l.prevR != null ? Math.max(0, l.prevR - sol) : 0;
              const vazio = l.tipo === 'antes' || l.tipo === 'semdados';
              return (
                <button key={l.ref} onClick={() => setSelConta(l.ref)} aria-label={`Conta ${nomeRef(l.ref)}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>{l.tipo === 'antes' ? 'sem ar' : l.tipo === 'semdados' ? '?' : `${l.tipo === 'diferenca' ? '≈ ' : ''}${nf(l.tipo === 'andamento' && l.prevR != null ? l.prevR : sol, 0)}`}</span>
                  <span style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: `${montado ? Math.max(4, ((sol + prevExtra) / maxR) * 85) : 0}%`, minHeight: vazio ? 14 : 0, transition: `height .7s ${crescer}`, outline: sel ? '2px solid var(--ink)' : 'none', outlineOffset: 3, borderRadius: 6, border: vazio ? '1.5px dashed var(--muted)' : 'none', overflow: 'hidden' }}>
                    {prevExtra > 0 && <span style={{ flex: prevExtra, backgroundImage: 'repeating-linear-gradient(135deg, var(--accent) 0 3px, transparent 3px 7px)' }} />}
                    {!vazio && <span style={{ flex: Math.max(sol, 0.01), background: l.tipo === 'lg' || l.tipo === 'andamento' ? 'var(--accent)' : 'var(--bar)' }} />}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: sel ? 'var(--ink)' : 'var(--muted)' }}>{MON3[Number(l.ref.slice(5, 7)) - 1]}</span>
                </button>
              );
            })}
          </div>
          {meta > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(${(meta / maxR) * 85}% + 24px)`, borderTop: '1.5px dashed var(--ink)', opacity: 0.55, pointerEvents: 'none' }} />
          )}
        </div>

        <div style={{ flexBasis: '100%', borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>Conta {nomeRef(alvo.ref)}</span>
            {seloTipo}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{dl(parseYmd(alvo.ciclo.inicio))} a {dl(parseYmd(alvo.ciclo.fim))}</div>
          {alvo.tipo === 'antes' ? (
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>Nesta conta o ar ainda não existia{alvo.a ? `: a casa gastou ${nf(alvo.a.c.kwh, 0)} kWh sozinha.` : '.'}</div>
          ) : alvo.arR == null ? (
            <div style={{ fontSize: 15, fontWeight: 700 }}>Sem dados do ar neste período.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05 }}>{brl0(alvo.tipo === 'andamento' && alvo.prevR != null ? alvo.prevR : alvo.arR)}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>{alvo.tipo === 'andamento' ? (alvo.prevR != null ? 'previsão de ar' : 'de ar até agora') : 'de ar'}</span>
              </div>
              {alvo.tipo === 'andamento' ? (
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Conta em andamento: dia {decorridos} de {diasEntre(atual.inicio, atual.fim)}. {brl0(alvo.arR)} até agora{alvo.prevR != null ? `, previsão ${brl0(alvo.prevR)}` : ''}.
                </div>
              ) : alvo.a && alvo.a.f.share != null ? (
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)' }}>{nf(alvo.a.f.share * 100, 0)}% da conta de luz de {brl(alvo.a.c.valor)}</div>
              ) : null}
            </>
          )}
          {dif != null && Math.abs(dif) >= 1 && comparavel != null && (
            <div style={{ fontSize: 14, fontWeight: 800, color: dif > 0 ? 'var(--amber)' : 'var(--green)' }}>
              {dif > 0 ? '↑' : '↓'} {brl0(Math.abs(dif))} a {dif > 0 ? 'mais' : 'menos'} que a conta anterior ({dif > 0 ? '+' : '−'}{nf((Math.abs(dif) / comparavel) * 100, 0)}%){alvo.tipo === 'andamento' ? ', pela previsão' : ''}
            </div>
          )}
        </div>
      </section>
    );
  }
}
