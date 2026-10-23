'use client';

import { Thermometer } from 'lucide-react';

/** Selo de clima: retângulo de cantos pequenos, de propósito diferente das pílulas de número. */
export function ClimaBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 8px', borderRadius: 6, border: '1.5px solid var(--clima)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <Thermometer size={13} color="var(--clima)" /> Clima · máx. do dia
    </span>
  );
}

/** Interruptor pequeno (40×24) com o rótulo "Mostrar". */
export function MiniInterruptor({ ligado, onClick }: { ligado: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={ligado} aria-label="Mostrar clima no gráfico" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
      Mostrar
      <span style={{ width: 40, height: 24, borderRadius: 12, background: ligado ? 'var(--green)' : 'var(--line)', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: ligado ? 19 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
      </span>
    </button>
  );
}
