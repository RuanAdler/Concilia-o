'use client';

import { useEffect, type ReactNode } from 'react';
import { Spinner } from './ui';

export function Folha({ onFechar, children }: { onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onFechar]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onFechar} style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,20,.45)', animation: 'dcfade .2s ease-out' }} />
      <div role="dialog" aria-modal="true" style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '92%', overflowY: 'auto', background: 'var(--surface)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(34px + env(safe-area-inset-bottom))', animation: 'dcsobe .32s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--line)', margin: '0 auto 16px' }} />
        {children}
      </div>
    </div>
  );
}

export type DiagLinha = { k: string; v: string; ok?: boolean | null };

export function SheetDiag({ linhas, testando, onTestar, onFechar }: { linhas: DiagLinha[]; testando: boolean; onTestar: () => void; onFechar: () => void }) {
  return (
    <Folha onFechar={onFechar}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Conexão com a LG</h2>
      {linhas.map((l) => (
        <div key={l.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{l.k}</span>
          <span style={{ fontWeight: 800, textAlign: 'right', color: l.ok === true ? 'var(--green)' : l.ok === false ? 'var(--red)' : 'var(--ink)', wordBreak: 'break-word' }}>{l.v}</span>
        </div>
      ))}
      <button onClick={onTestar} disabled={testando} className="press" style={{ marginTop: 18, width: '100%', height: 50, borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {testando && <Spinner cor="var(--on-accent)" />} {testando ? 'Testando…' : 'Testar conexão'}
      </button>
    </Folha>
  );
}

export function SheetApagar({ desde, onApagar, onFechar }: { desde: string; onApagar: () => void; onFechar: () => void }) {
  return (
    <Folha onFechar={onFechar}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Apagar histórico local?</h2>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
        Os dados guardados neste celular{desde ? ` desde ${desde}` : ''} serão apagados. Os últimos ~30 dias voltam da LG na próxima sincronização; o resto não.
      </p>
      <button onClick={onApagar} className="press" style={{ marginTop: 18, width: '100%', height: 50, borderRadius: 16, background: 'var(--red)', color: '#fff', fontSize: 15, fontWeight: 800 }}>Apagar histórico</button>
      <button onClick={onFechar} className="press" style={{ marginTop: 8, width: '100%', height: 50, borderRadius: 16, fontSize: 15, fontWeight: 800 }}>Cancelar</button>
    </Folha>
  );
}
