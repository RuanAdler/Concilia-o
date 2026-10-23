'use client';

import { TrendingUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const base = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 11, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', flex: 'none' } as const;

export type TipoSelo = 'real' | 'estimativa' | 'previsao' | 'diferenca' | 'neutro' | 'erro' | 'ok' | 'calibrando' | 'poucos';

/** Selo que diz de onde vem um número: sempre texto e forma, nunca só cor. */
export function Selo({ tipo, texto }: { tipo: TipoSelo; texto?: string }) {
  if (tipo === 'real')
    return (
      <span style={{ ...base, background: 'var(--accent-soft)', color: 'var(--ink)' }}>
        <i style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
        {texto ?? 'Real · LG'}
      </span>
    );
  if (tipo === 'estimativa')
    return <span style={{ ...base, background: 'var(--surface2)', border: '1px solid var(--muted)', color: 'var(--ink)' }}>{texto ?? '≈ Estimativa'}</span>;
  if (tipo === 'previsao')
    return (
      <span style={{ ...base, border: '1.5px dashed var(--muted)', color: 'var(--ink)' }}>
        <TrendingUp size={12} /> {texto ?? 'Previsão'}
      </span>
    );
  if (tipo === 'ok') return <span style={{ ...base, background: 'var(--green-soft)', color: 'var(--green)' }}>{texto}</span>;
  if (tipo === 'calibrando') return <span style={{ ...base, background: 'var(--accent-soft)', color: 'var(--ink)' }}>{texto}</span>;
  if (tipo === 'poucos') return <span style={{ ...base, border: '1.5px dashed var(--muted)', color: 'var(--ink)' }}>{texto}</span>;
  if (tipo === 'neutro') return <span style={{ ...base, background: 'var(--surface2)', color: 'var(--muted)' }}>{texto}</span>;
  if (tipo === 'erro') return <span style={{ ...base, background: 'var(--red-soft)', color: 'var(--red)' }}>{texto}</span>;
  return <span style={{ ...base, background: 'var(--amber-soft)', color: 'var(--amber)' }}>{texto ?? '≈ Estimada pela diferença'}</span>;
}

/** Botão "?" que abre a explicação dentro do próprio cartão. */
export function Ajuda({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-label="O que é isto?" style={{ width: 44, height: 44, margin: '-9px -9px -9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--muted)', background: aberto ? 'var(--surface2)' : 'transparent' }}>?</span>
      </button>
      {aberto && (
        <div role="note" style={{ flexBasis: '100%', order: 99, background: 'var(--surface2)', borderRadius: 14, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>{children}</div>
      )}
    </>
  );
}
