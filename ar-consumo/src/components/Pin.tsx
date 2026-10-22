'use client';

import { Delete, Lock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  acao: string | null;
  onFechar: () => void;
  onConferir: (pin: string) => Promise<{ ok: boolean; erro?: string }>;
};

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function Pin({ acao, onFechar, onConferir }: Props) {
  const [entrada, setEntrada] = useState('');
  const [erro, setErro] = useState('');
  const [tremer, setTremer] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const sacudir = () => {
    [-12, 12, -8, 8, -4, 0].forEach((x, i) => timers.current.push(setTimeout(() => setTremer(x), i * 60)));
  };

  const conferir = async (pin: string) => {
    setOcupado(true);
    const r = await onConferir(pin);
    setOcupado(false);
    if (!r.ok) {
      setEntrada('');
      setErro(r.erro ?? 'PIN incorreto. Tente de novo.');
      sacudir();
    }
  };

  const tecla = (k: string) => {
    if (ocupado) return;
    if (k === 'del') { setEntrada(entrada.slice(0, -1)); setErro(''); return; }
    if (entrada.length >= 6) return;
    const e = entrada + k;
    setEntrada(e);
    setErro('');
    if (e.length === 6) timers.current.push(setTimeout(() => conferir(e), 160));
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Digite seu PIN" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 18px 32px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onFechar} aria-label="Fechar" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
      </div>
      <div style={{ width: 64, height: 64, borderRadius: 22, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}><Lock size={28} color="var(--accent)" /></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: '16px 0 4px' }}>Controlar o Gelinho</h2>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>
        Digite o PIN {acao ? `para ${acao}` : 'para controlar o ar'}. Para só olhar, não precisa.
      </p>
      <div style={{ display: 'flex', gap: 14, margin: '28px 0 10px', transform: `translateX(${tremer}px)` }} aria-label={`${entrada.length} de 6 dígitos`}>
        {Array.from({ length: 6 }, (_, i) => {
          const cheio = i < entrada.length;
          return <span key={i} style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${cheio ? 'var(--accent)' : 'var(--muted)'}`, background: cheio ? (erro ? 'var(--red)' : 'var(--accent)') : 'transparent' }} />;
        })}
      </div>
      <div style={{ minHeight: 22, fontSize: 13.5, fontWeight: 700, color: 'var(--red)' }} role="alert">{erro}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: '14px 26px', marginTop: 14 }}>
        {TECLAS.map((k, i) => (
          <button
            key={i}
            onClick={() => k && tecla(k)}
            aria-label={k === 'del' ? 'Apagar' : k || undefined}
            className="press"
            style={{ width: 76, height: 76, borderRadius: '50%', fontSize: 28, fontWeight: 700, background: k === 'del' || !k ? 'transparent' : 'var(--surface)', visibility: k ? 'visible' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {k === 'del' ? <Delete size={26} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
