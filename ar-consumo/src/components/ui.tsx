'use client';

import type { CSSProperties, ReactNode } from 'react';

export const card = (raio = 26, pad = '18px 20px'): CSSProperties => ({
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: raio,
  padding: pad,
});

export const rotulo: CSSProperties = {
  fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)',
};

export function Spinner({ cor = 'var(--accent)', size = 16 }: { cor?: string; size?: number }) {
  return <span className="spin" style={{ width: size, height: size, borderColor: cor, borderTopColor: 'transparent' }} />;
}

export function Seg<T extends string>({ opts, cur, onSel }: { opts: [T, string][]; cur: T; onSel: (k: T) => void }) {
  return (
    <div style={{ display: 'flex', padding: 4, borderRadius: 16, background: 'var(--surface2)', gap: 2 }}>
      {opts.map(([k, l]) => {
        const a = k === cur;
        return (
          <button
            key={k}
            onClick={() => onSel(k)}
            aria-pressed={a}
            className="press"
            style={{
              flex: 1, height: 40, borderRadius: 12, fontSize: 14, fontWeight: 800,
              background: a ? 'var(--surface)' : 'transparent', color: a ? 'var(--ink)' : 'var(--muted)',
              boxShadow: a ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} aria-label={label} style={{ width: 52, height: 32, borderRadius: 16, background: on ? 'var(--green)' : 'var(--line)', position: 'relative', transition: 'background .2s', flex: 'none' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
    </button>
  );
}

export type BarraItem = { h: string; bg: string; bd?: string; aria?: string; onTap?: () => void };

export function Barras({ itens, altura = 130, gap = 2 }: { itens: BarraItem[]; altura?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height: altura, position: 'relative' }}>
      {itens.map((b, i) => (
        <button
          key={i}
          onClick={b.onTap}
          aria-label={b.aria}
          style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: b.onTap ? 'pointer' : 'default' }}
        >
          <span style={{ display: 'block', width: '100%', height: b.h, background: b.bg, border: b.bd ?? 'none', borderRadius: '4px 4px 2px 2px', transition: 'height .7s cubic-bezier(.2,.8,.2,1), background .2s' }} />
        </button>
      ))}
    </div>
  );
}

export function LinhaMedia({ pct }: { pct: number }) {
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${Math.min(100, pct)}%`, borderTop: '1.5px dashed var(--muted)', opacity: 0.7, pointerEvents: 'none' }} />;
}

export function Linha({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>{children}</div>;
}
