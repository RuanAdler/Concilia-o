'use client';

import { CalendarCheck, CalendarClock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { MONTHS, brl, brl0, dl, nf, parseYmd } from '@/lib/fmt';
import type { AnaliseConta } from '@/lib/conta-analise';
import type { Comparacao } from '@/lib/previsao';
import { Selo } from './selos';
import { card } from './ui';

const entrada = { animation: 'dcin .3s cubic-bezier(.2,.8,.2,1)' } as const;

/** Faixa fina, tracejada, para ações rápidas que não são alarme (lembrete de conta, backup). */
export function Faixa({ icone, texto, botao, onBotao, neutro = false, onFechar }: { icone: ReactNode; texto: string; botao: string; onBotao: () => void; neutro?: boolean; onFechar: () => void }) {
  return (
    <div style={{ ...entrada, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px 8px 14px', borderRadius: 18, border: '1.5px dashed var(--line)' }}>
      <span style={{ flex: 'none', display: 'flex', color: neutro ? 'var(--muted)' : 'var(--accent)' }}>{icone}</span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{texto}</span>
      <button onClick={onBotao} className="press" style={{ flex: 'none', height: 44, padding: '0 14px', borderRadius: 14, fontSize: 13.5, fontWeight: 800, background: neutro ? 'var(--surface2)' : 'var(--accent)', color: neutro ? 'var(--ink)' : 'var(--on-accent)' }}>{botao}</button>
      <button onClick={onFechar} aria-label="Dispensar" style={{ flex: 'none', width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><X size={18} /></button>
    </div>
  );
}

export const IconeLembrete = <CalendarClock size={20} />;

const venceEm = (fim: string) => MONTHS[Number(fim.slice(5, 7)) % 12];

/** Resumo de como a conta que acabou de fechar terminou (aparece só nos primeiros dias depois da leitura). */
export function ResumoConta({ a, anterior, comp, onVer, onFechar }: { a: AnaliseConta; anterior: AnaliseConta | null; comp: Comparacao | null; onVer: () => void; onFechar: () => void }) {
  const incompleta = a.tipo === 'incompleta';
  const arR = a.arR;
  const base = anterior && anterior.tipo !== 'antes' && anterior.tipo !== 'incompleta' && anterior.arR != null && anterior.arR >= 25 ? anterior.arR : null;
  const dif = arR != null && base != null ? arR - base : null;
  const ref = `${a.c.mes.slice(5)}/${a.c.mes.slice(0, 4)}`;
  const frase = incompleta
    ? `O ar custou ${arR != null ? brl0(arR) : 'um valor que não dá para calcular'} nesta conta. Falta o consumo (kWh) da conta para saber quanto dela foi do ar.`
    : arR == null
      ? 'O app não tem dados do ar suficientes para esta conta.'
      : `O ar custou ${brl0(arR)}, ${nf((a.f.share ?? 0) * 100, 0)}% da conta${dif != null ? `, ${brl0(Math.abs(dif))} a ${dif >= 0 ? 'mais' : 'menos'} que a anterior` : '. Ainda não há conta anterior para comparar'}.`;

  return (
    <section style={{ ...card(26, '18px'), ...entrada, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><CalendarCheck size={22} color="var(--accent)" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Conta {ref} fechou</h2>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{dl(parseYmd(a.inicio))} a {dl(parseYmd(a.fim))} · vence em {venceEm(a.fim)}</div>
        </div>
        <button onClick={onFechar} aria-label="Dispensar resumo" style={{ width: 44, height: 44, margin: '-8px -8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><X size={20} /></button>
      </div>

      <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.4 }}>{frase}</p>

      {!incompleta && arR != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[
            { r: 'O ar custou', v: brl0(arR), s: '≈ estimativa', cor: 'var(--ink)' },
            { r: 'Da conta', v: a.f.share != null ? `${nf(a.f.share * 100, 0)}%` : '—', s: `de ${brl0(a.c.valor)}`, cor: 'var(--ink)' },
            { r: 'Vs. anterior', v: dif != null ? `${dif >= 0 ? '+' : '−'}${brl0(Math.abs(dif))}` : '—', s: dif != null ? (dif >= 0 ? 'a mais' : 'a menos') : 'sem comparação', cor: dif == null ? 'var(--ink)' : dif >= 0 ? 'var(--amber)' : 'var(--green)' },
          ].map((t) => (
            <div key={t.r} style={{ background: 'var(--surface2)', borderRadius: 16, padding: '10px 12px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{t.r}</div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: t.cor }}>{t.v}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{t.s}</div>
            </div>
          ))}
        </div>
      )}

      {comp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>
          <Selo tipo="previsao" />
          <span>Previsto {brl(comp.previsto)}, veio {brl(comp.real)} ({Math.round(comp.diferenca) === 0 ? 'acertou' : `R$ ${Math.abs(Math.round(comp.diferenca))} a ${comp.diferenca > 0 ? 'mais' : 'menos'}`}).</span>
        </div>
      )}

      <button onClick={onVer} className="press" style={{ height: 48, borderRadius: 16, fontSize: 15, fontWeight: 800, background: incompleta ? 'var(--accent)' : 'var(--surface2)', color: incompleta ? 'var(--on-accent)' : 'var(--ink)' }}>
        {incompleta ? 'Completar conta' : 'Ver detalhes ›'}
      </button>
    </section>
  );
}
