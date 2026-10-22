'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Diagnostico() {
  const [saida, setSaida] = useState('');
  const rodar = async () => {
    setSaida('Consultando...');
    try {
      const r = await fetch('/api/ar?diag=1');
      setSaida(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setSaida(String(e));
    }
  };
  return (
    <main>
      <h1>Diagnóstico LG</h1>
      <p className="k">Mostra o que a LG devolve para o seu aparelho (sem o token). Serve para ajustar a leitura de consumo.</p>
      <button onClick={rodar}>Consultar a LG</button>
      <pre>{saida}</pre>
      <Link href="/">Voltar</Link>
    </main>
  );
}
