'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { MON, MONTHS, WD, WDL, brl, brl0, cap, dl, nf, parseYmd } from '@/lib/fmt';
import { useMontado } from '@/lib/cliente';
import { agruparMeses, custoDe, delta, diasNoMes, doMes, faixasSemana, mediaPorDiaSemana, projecaoMes, soma, tarifaDoMes } from '@/lib/stats';
import { Barras, LinhaMedia, Seg, card } from './ui';
import type { Dados } from './tipos';

type Vista = 'dia' | 'semana' | 'mes' | 'ano';

const nav = (disabled = false) => ({ width: 44, height: 44, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }) as const;

export default function Historico({ d }: { d: Dados }) {
  const { dias, hoje, tarifa, tarifas } = d;
  const montado = useMontado();
  const [vista, setVista] = useState<Vista>('dia');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [selI, setSelI] = useState<number | null>(null);

  const ehAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();
  const futuro = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());
  const dMes = doMes(dias, ano, mes);
  const dAno = dias.filter((x) => x.data.startsWith(String(ano)));
  const primeiro = d.primeiro ? parseYmd(d.primeiro) : hoje;
  const tf = (data: string) => tarifaDoMes(tarifas, tarifa, data.slice(0, 7));
  const reais = (ds: typeof dias) => custoDe(ds, tarifas, tarifa);
  const irAtual = () => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()); setSelI(null); };
  const porMes = vista === 'dia' || vista === 'semana';

  const vazio =
    porMes && !dMes.length
      ? {
          titulo: futuro ? `${cap(MONTHS[mes])} ainda não chegou` : `Ainda não há dados de ${MONTHS[mes]}`,
          texto: futuro
            ? 'Os dados aparecem aqui conforme os dias passam.'
            : `O histórico começa a ser guardado a partir do primeiro acesso (${dl(primeiro)} de ${primeiro.getFullYear()}). Os meses vão aparecendo aqui conforme acumulam.`,
        }
      : vista === 'ano' && !dAno.length
        ? { titulo: `Sem dados em ${ano}`, texto: `O histórico começa a ser guardado a partir do primeiro acesso (${dl(primeiro)} de ${primeiro.getFullYear()}).` }
        : null;

  const anterior = () => {
    setSelI(null);
    if (vista === 'ano') return setAno(ano - 1);
    if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1);
  };
  const proximo = () => {
    setSelI(null);
    if (vista === 'ano') { if (ano < hoje.getFullYear()) setAno(ano + 1); return; }
    if (ehAtual || futuro) return;
    if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1);
  };
  const proximoOff = vista === 'ano' ? ano >= hoje.getFullYear() : ehAtual || futuro;

  const kMes = soma(dMes);
  const media = dMes.length ? kMes / dMes.length : 0;
  const pior = dMes.reduce<typeof dMes[number] | null>((a, x) => (!a || x.kwh > a.kwh ? x : a), null);
  const melhor = dMes.reduce<typeof dMes[number] | null>((a, x) => (!a || x.kwh < a.kwh ? x : a), null);
  const dim = diasNoMes(ano, mes);
  const mxDia = Math.max(...dMes.map((x) => x.kwh), 1);
  const sel = selI ?? dMes.length - 1;
  const hs = dMes[sel];
  const sub = vista === 'ano' ? '' : ehAtual ? `até hoje, dia ${hoje.getDate()}` : dMes.length && Number(dMes[0].data.slice(8)) > 1 ? `desde o primeiro acesso, dia ${Number(dMes[0].data.slice(8))}` : dMes.length ? 'mês completo' : '';

  const resumo = dMes.length && pior && melhor
    ? [
        { l: 'Total', v: `${nf(kMes)} kWh`, s: `${dMes.length} dias com dado`, c: 'var(--ink)' },
        { l: 'Custo', v: brl(reais(dMes)), s: `tarifa ${brl(tf(dMes[dMes.length - 1].data))}/kWh`, c: 'var(--ink)' },
        { l: 'Média por dia', v: `${nf(media)} kWh`, s: `${brl(reais(dMes) / dMes.length)} por dia`, c: 'var(--ink)' },
        { l: 'Pior dia', v: `${nf(pior.kwh)} kWh`, s: `${cap(WD[parseYmd(pior.data).getDay()])}, ${dl(parseYmd(pior.data))}`, c: 'var(--amber)' },
        { l: 'Melhor dia', v: `${nf(melhor.kwh)} kWh`, s: `${cap(WD[parseYmd(melhor.data).getDay()])}, ${dl(parseYmd(melhor.data))}`, c: 'var(--green)' },
        { l: 'Projeção', v: ehAtual ? brl0(projecaoMes(kMes, hoje) * tf(dMes[dMes.length - 1].data)) : '—', s: ehAtual ? 'fechamento no ritmo atual' : 'mês encerrado', c: 'var(--ink)' },
      ]
    : [];

  const faixas = faixasSemana(dMes, dim);
  const mxFaixa = Math.max(...faixas.map((w) => w.k), 1);
  const diasSemana = mediaPorDiaSemana(dias);
  const mxSemana = Math.max(...diasSemana.map((x) => x.v), 1);
  const topSemana = diasSemana.reduce((a, x) => (x.v > a.v ? x : a), diasSemana[0]);

  const meses = agruparMeses(dias);
  const mxMes = Math.max(...meses.map((m) => m.k), 1);
  const mxMesR = Math.max(...meses.map((m) => reais(m.dias)), 1);

  const anoMeses = Array.from({ length: 12 }, (_, m) => { const a = doMes(dAno, ano, m); return { m, k: soma(a), n: a.length, r: reais(a) }; });
  const mxAno = Math.max(...anoMeses.map((x) => x.r), 1);
  const topAno = anoMeses.reduce((a, x) => (x.r > a.r ? x : a), anoMeses[0]);

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Histórico</h1>
      <Seg<Vista> opts={[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano']]} cur={vista} onSel={(v) => { setVista(v); setSelI(null); }} />

      {vista !== 'mes' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={anterior} aria-label="Anterior" className="press" style={nav()}><ChevronLeft size={22} /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{vista === 'ano' ? ano : `${cap(MONTHS[mes])} ${ano}`}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', minHeight: 16 }}>{sub}</div>
          </div>
          <button onClick={proximo} aria-label="Próximo" className="press" style={nav(proximoOff)}><ChevronRight size={22} /></button>
        </div>
      )}

      {vazio && (
        <div style={{ ...card(26, '32px 24px'), textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 10 }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarDays size={32} color="var(--accent)" /></div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{vazio.titulo}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>{vazio.texto}</div>
          <button onClick={irAtual} className="press" style={{ height: 46, padding: '0 22px', borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 800, fontSize: 15 }}>Ver o mês mais recente</button>
        </div>
      )}

      {vista === 'dia' && !vazio && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {resumo.map((r) => (
              <div key={r.l} style={card(18, '12px 14px')}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{r.l}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: r.c }}>{r.v}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.s}</div>
              </div>
            ))}
          </div>
          <section style={card(26, '18px 16px 14px')}>
            {hs && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{cap(WD[parseYmd(hs.data).getDay()])}, {dl(parseYmd(hs.data))}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{nf(hs.kwh)} kWh · {brl(hs.kwh * tf(hs.data))}</span>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Barras
                altura={150}
                itens={Array.from({ length: dim }, (_, i) => {
                  const idx = dMes.findIndex((y) => Number(y.data.slice(8)) === i + 1);
                  if (idx < 0) return { h: '8%', bg: 'transparent', bd: '1.5px dashed var(--line)' };
                  const x = dMes[idx];
                  return { h: montado ? `${Math.max(3, (x.kwh / mxDia) * 100)}%` : '0%', bg: idx === sel ? 'var(--ink)' : 'var(--accent)', aria: `${dl(parseYmd(x.data))}: ${nf(x.kwh)} kWh`, onTap: () => setSelI(idx) };
                })}
              />
              <LinhaMedia pct={(media / mxDia) * 100} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 6 }}>
              <span>1</span><span>- - média {nf(media)} kWh</span><span>{dim}</span>
            </div>
          </section>
          <section style={{ ...card(22, '4px 16px') }}>
            {[...dMes].reverse().map((x, i, arr) => {
              const t = x === pior ? 'pior' : x === melhor ? 'melhor' : '';
              return (
                <div key={x.data} style={{ display: 'grid', gridTemplateColumns: '62px 1fr 64px 74px', alignItems: 'center', gap: 8, minHeight: 50, borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div><div style={{ fontSize: 14, fontWeight: 800 }}>{dl(parseYmd(x.data))}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{WDL[parseYmd(x.data).getDay()]}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ height: 6, borderRadius: 3, width: `${Math.max(4, (x.kwh / mxDia) * 100) * 0.7}%`, background: t === 'pior' ? 'var(--amber-fill)' : t === 'melhor' ? 'var(--green)' : 'var(--bar)' }} />
                    {t && <span style={{ fontSize: 11, fontWeight: 800, color: t === 'pior' ? 'var(--amber)' : 'var(--green)' }}>{t}</span>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{nf(x.kwh)}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'right' }}>{brl(x.kwh * tf(x.data))}</span>
                </div>
              );
            })}
          </section>
        </>
      )}

      {vista === 'semana' && !vazio && (
        <>
          <section style={card(26, '18px 16px')}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>kWh por semana do mês</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
              {faixas.map((w) => (
                <div key={w.a} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{w.n ? nf(w.k, 0) : '—'}</span>
                  <span style={{ width: '100%', height: montado && w.n ? `${Math.max(4, (w.k / mxFaixa) * 82)}%` : '2%', background: w.n ? 'var(--accent)' : 'var(--line)', borderRadius: '6px 6px 3px 3px', transition: 'height .7s cubic-bezier(.2,.8,.2,1)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{w.a}–{w.b}</span>
                </div>
              ))}
            </div>
          </section>
          <section style={{ ...card(26, '18px 20px'), display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Dia da semana mais gastador</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
              {dias.length > 6 ? `${cap(WDL[topSemana.w])} é o dia que mais gasta: média de ${nf(topSemana.v)} kWh (${brl(topSemana.v * tarifa)}).` : 'Precisa de pelo menos uma semana de dados.'}
            </div>
            {diasSemana.map((x) => (
              <div key={x.w} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 70px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: x === topSemana ? 'var(--ink)' : 'var(--muted)' }}>{cap(WD[x.w])}</span>
                <div style={{ height: 12, borderRadius: 6, background: 'var(--surface2)' }}><div style={{ height: '100%', borderRadius: 6, width: `${montado ? (x.v / mxSemana) * 100 : 0}%`, background: x === topSemana ? 'var(--amber-fill)' : 'var(--bar)', transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} /></div>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{nf(x.v)} kWh</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>média de kWh por dia, todo o histórico</div>
          </section>
        </>
      )}

      {vista === 'mes' && (
        meses.length === 0 ? (
          <div style={{ ...card(26, '28px 24px'), textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Ainda não há meses para comparar.</div>
        ) : (
          <>
            <section style={card(26, '18px 16px')}>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', marginRight: 5 }} />kWh</span>
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--slate)', marginRight: 5 }} />R$</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 170 }}>
                {meses.slice(-6).map((m) => {
                  const r = reais(m.dias);
                  const emAndamento = m.ano === hoje.getFullYear() && m.mes === hoje.getMonth();
                  return (
                    <div key={m.ym} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%', height: '82%' }}>
                        {[{ v: m.k, mx: mxMes, bg: 'var(--accent)', t: nf(m.k, 0) }, { v: r, mx: mxMesR, bg: 'var(--slate)', t: nf(r, 0) }].map((b, i) => (
                          <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{b.t}</span>
                            <span style={{ width: '100%', height: montado ? `${(b.v / b.mx) * 80}%` : '0%', background: b.bg, borderRadius: '5px 5px 2px 2px', transition: 'height .7s cubic-bezier(.2,.8,.2,1)' }} />
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>{cap(MON[m.mes])}{emAndamento ? '*' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <section style={card(22, '4px 16px')}>
              {meses.slice().reverse().map((m, i, arr) => {
                const prev = arr[i + 1];
                const dd = prev ? delta(m.k / m.n, prev.k / prev.n) : null;
                const emAndamento = m.ano === hoje.getFullYear() && m.mes === hoje.getMonth();
                return (
                  <div key={m.ym} style={{ display: 'grid', gridTemplateColumns: '1.3fr .8fr 1fr .7fr', alignItems: 'center', gap: 6, minHeight: 56, borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <div><div style={{ fontSize: 14, fontWeight: 800 }}>{cap(MONTHS[m.mes])}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{m.n} dias{emAndamento ? ' · em andamento' : ''}</div></div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{nf(m.k / m.n)} kWh/dia</span>
                    <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'right' }}>{brl0(reais(m.dias))}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, textAlign: 'right', color: dd ? (dd.subiu ? 'var(--amber)' : 'var(--green)') : 'var(--muted)' }}>{dd ? `${dd.subiu ? '+' : '−'}${nf(dd.pct, 0)}%` : '—'}</span>
                  </div>
                );
              })}
            </section>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>* mês em andamento. A variação (Δ) compara a média por dia, já que o primeiro e o último meses podem estar incompletos.</div>
          </>
        )
      )}

      {vista === 'ano' && !vazio && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={card(18, '12px 14px')}><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>Total no ano</div><div style={{ fontSize: 19, fontWeight: 800 }}>{brl0(reais(dAno))}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{nf(soma(dAno), 0)} kWh · {dAno.length} dias</div></div>
            <div style={card(18, '12px 14px')}><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>Mês mais caro</div><div style={{ fontSize: 19, fontWeight: 800 }}>{topAno.n ? cap(MONTHS[topAno.m]) : '—'}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{topAno.n ? brl0(topAno.r) : ''}</div></div>
          </div>
          <section style={card(26, '18px 16px 14px')}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 150 }}>
              {anoMeses.map((x) => (
                <div key={x.m} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: '100%', height: x.n ? (montado ? `${Math.max(4, (x.r / mxAno) * 90)}%` : '0%') : '10%', background: x.n ? (x.m === hoje.getMonth() && ano === hoje.getFullYear() ? 'var(--accent)' : 'var(--bar)') : 'transparent', border: x.n ? 'none' : '1.5px dashed var(--line)', borderRadius: '5px 5px 2px 2px', transition: 'height .7s cubic-bezier(.2,.8,.2,1)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{MON[x.m][0].toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Barras tracejadas são meses sem dados (o histórico só existe desde o primeiro acesso).</div>
          </section>
        </>
      )}
    </>
  );
}
