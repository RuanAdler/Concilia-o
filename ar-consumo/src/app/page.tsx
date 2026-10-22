'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CONFIG_PADRAO, type Config, type Sessao, formatarHoras, resumo,
} from '@/lib/consumo';

type Ar = { modo: string; nome?: string; ligado?: boolean | null; erro?: string; erroEnergia?: string | null };

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const kwhFmt = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh`;

function usarLocal<T>(chave: string, inicial: T) {
  const [v, setV] = useState<T>(inicial);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem(chave);
      if (s) setV(JSON.parse(s) as T);
    } catch {
      // sem localStorage: segue com o valor inicial
    }
    setPronto(true);
  }, [chave]);
  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(chave, JSON.stringify(v));
    } catch {
      // armazenamento indisponível
    }
  }, [chave, v, pronto]);
  return [v, setV] as const;
}

export default function Home() {
  const [cfg, setCfg] = usarLocal<Config>('ar.cfg', CONFIG_PADRAO);
  const [sessoes, setSessoes] = usarLocal<Sessao[]>('ar.sessoes', []);
  const [ar, setAr] = useState<Ar | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const carregar = useCallback(async () => {
    try {
      setAr(await (await fetch('/api/ar')).json());
    } catch {
      setAr({ modo: 'lg', erro: 'Não consegui falar com o servidor' });
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [carregar]);

  const aberta = sessoes.find((s) => s.fim === null);
  const r = resumo(sessoes, cfg, agora);

  const alternar = () => {
    const t = Date.now();
    setAgora(t);
    setSessoes((ss) =>
      aberta
        ? ss.map((s) => (s.id === aberta.id ? { ...s, fim: t } : s))
        : [...ss, { id: String(t), inicio: t, fim: null }],
    );
  };

  const num = (campo: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg({ ...cfg, [campo]: Number(e.target.value.replace(',', '.')) || 0 });

  return (
    <main>
      <h1>Consumo do ar-condicionado</h1>

      <div className="card">
        <div className="k">{ar?.nome ?? 'Aparelho'}</div>
        <div>
          {ar?.ligado === true && <span className="pill on">Ligado agora (LG)</span>}
          {ar?.ligado === false && <span className="pill">Desligado (LG)</span>}
          {(ar?.ligado === null || ar?.ligado === undefined) && <span className="pill">Estado LG indisponível</span>}
        </div>
        {ar?.modo === 'sem-token' && <p className="k">LG não conectada: configure LG_PAT. Enquanto isso use o registro manual.</p>}
        {ar?.erro && <p className="k">Erro LG: {ar.erro}</p>}
      </div>

      <div className="card">
        <div className="k">Gasto acumulado (base + registros)</div>
        <div className="big">{brl(r.total.reais)}</div>
        <div className="k">{kwhFmt(r.total.kwh)} · {formatarHoras(r.total.horas)} de uso registrado</div>
      </div>

      <div className="grid">
        {([['Hoje', r.hoje], ['7 dias', r.semana], ['Este mês', r.mes]] as const).map(([t, x]) => (
          <div className="card" key={t}>
            <div className="k">{t}</div>
            <div className="v">{brl(x.reais)}</div>
            <div className="k">{kwhFmt(x.kwh)} · {formatarHoras(x.horas)}</div>
          </div>
        ))}
      </div>

      <button className={aberta ? 'stop' : ''} onClick={alternar}>
        {aberta ? 'Desliguei o ar (parar contagem)' : 'Liguei o ar (iniciar contagem)'}
      </button>

      <div className="card grid">
        <label>Potência estimada (W)
          <input inputMode="decimal" value={cfg.potenciaW} onChange={num('potenciaW')} />
        </label>
        <label>Tarifa (R$/kWh)
          <input inputMode="decimal" value={cfg.tarifa} onChange={num('tarifa')} />
        </label>
        <label>Base já gasta (kWh)
          <input inputMode="decimal" value={cfg.baseKwh} onChange={num('baseKwh')} />
        </label>
      </div>
      <p className="k">Os valores de potência e tarifa são provisórios. Ajuste com a etiqueta do aparelho e a conta de luz. O consumo é estimado por potência × tempo ligado.</p>
      <Link href="/diagnostico">Diagnóstico da conexão com a LG</Link>
    </main>
  );
}
