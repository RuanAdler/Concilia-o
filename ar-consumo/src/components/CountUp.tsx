'use client';

import { useEffect, useRef, useState } from 'react';
import { easeOutCubica, reduzMovimento } from '@/lib/movimento';

const DURACAO = 700;

/** Número que sobe até o valor (700 ms, ease-out). Parte do valor anterior; com "reduzir movimento" já aparece no final. */
export function CountUp({ v, fmt }: { v: number; fmt: (n: number) => string }) {
  const [mostrado, setMostrado] = useState(() => (reduzMovimento() ? v : 0));
  const atual = useRef(0);
  const primeira = useRef(true);

  useEffect(() => {
    if (reduzMovimento() || !Number.isFinite(v)) { atual.current = v; setMostrado(v); return; }
    const de = primeira.current ? 0 : atual.current;
    primeira.current = false;
    if (de === v) { setMostrado(v); return; }
    const ini = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - ini) / DURACAO);
      atual.current = de + (v - de) * easeOutCubica(p);
      setMostrado(atual.current);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [v]);

  return <span aria-label={fmt(v)}>{fmt(mostrado)}</span>;
}
