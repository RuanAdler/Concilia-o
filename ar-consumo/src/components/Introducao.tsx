'use client';

import { useState, type ReactNode } from 'react';
import { Selo } from './selos';

const passos: { titulo: string; texto: string; ilustracao: ReactNode }[] = [
  {
    titulo: 'Quanto o ar custa, de relance',
    texto: 'Em vez de números soltos, o app mostra quanto o ar já custou nesta conta, quanto deve custar até o fim e se isso cabe na sua meta.',
    ilustracao: (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: 18, display: 'grid', gap: 10, width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>O ar já custou</div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>R$ 43</div>
        <div style={{ height: 14, borderRadius: 7, background: 'var(--surface2)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: '78%', backgroundImage: 'repeating-linear-gradient(135deg, var(--amber-fill) 0 3px, transparent 3px 7px)' }} />
          <div style={{ position: 'absolute', inset: 0, width: '25%', background: 'var(--amber-fill)' }} />
        </div>
        <div style={{ borderRadius: 14, padding: '10px 12px', background: 'var(--amber-soft)', fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>No ritmo atual, a conta do ar fecha em R$ 189, R$ 19 acima da sua meta.</div>
      </div>
    ),
  },
  {
    titulo: 'Três tipos de número',
    texto: 'Cada número tem um selo que mostra de onde ele vem. Assim você sabe o que é dado do aparelho e o que é conta feita pelo app.',
    ilustracao: (
      <div style={{ display: 'grid', gap: 12, width: '100%' }}>
        {[
          { s: <Selo tipo="real" />, t: 'O consumo (kWh) que a LG informa, como o aparelho mediu.' },
          { s: <Selo tipo="estimativa" />, t: 'O custo em reais: o consumo vezes o preço do kWh. Não é o valor da conta de luz.' },
          { s: <Selo tipo="previsao" />, t: 'O que deve acontecer até o fim da conta, se os próximos dias forem parecidos.' },
        ].map((x, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px', display: 'grid', gap: 8, justifyItems: 'start' }}>
            {x.s}
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4 }}>{x.t}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    titulo: 'A conta de luz vai de 16 a 16',
    texto: 'A distribuidora lê o medidor todo dia 16. A conta de outubro cobre o consumo de 16/09 a 16/10 e vence em novembro. O app segue esse mesmo ciclo.',
    ilustracao: (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '22px 18px', width: '100%' }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ position: 'absolute', top: 9, left: 18, right: 18, height: 3, background: 'var(--line)' }} />
          {[['16/09', 'leitura'], ['16/10', 'leitura'], ['16/11', 'vence']].map(([d, r], i) => (
            <div key={d} style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 6, width: 80 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: i === 2 ? 'var(--amber-fill)' : 'var(--accent)', border: '3px solid var(--surface)' }} />
              <b style={{ fontSize: 15 }}>{d}</b>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Conta 10/2026: consumo de 16/09 a 16/10</div>
      </div>
    ),
  },
];

export default function Introducao({ onFechar }: { onFechar: () => void }) {
  const [i, setI] = useState(0);
  const p = passos[i];
  const ultimo = i === passos.length - 1;
  return (
    <div role="dialog" aria-modal="true" aria-label="Introdução" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100%', padding: 'calc(env(safe-area-inset-top) + 16px) 22px calc(env(safe-area-inset-bottom) + 24px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }} aria-label={`Passo ${i + 1} de ${passos.length}`}>
            {passos.map((_, n) => <span key={n} style={{ width: n === i ? 24 : 8, height: 8, borderRadius: 4, background: n === i ? 'var(--accent)' : 'var(--line)', transition: 'width .25s' }} />)}
          </div>
          <button onClick={onFechar} style={{ minHeight: 44, padding: '0 6px', fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>Pular</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>{p.ilustracao}</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{p.titulo}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.5 }}>{p.texto}</p>
        <button onClick={() => (ultimo ? onFechar() : setI(i + 1))} className="press" style={{ height: 56, borderRadius: 18, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 17, fontWeight: 800 }}>{ultimo ? 'Começar' : 'Continuar'}</button>
      </div>
    </div>
  );
}
