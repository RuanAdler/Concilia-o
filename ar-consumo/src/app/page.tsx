'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CONFIG_PADRAO, type Config, type Sessao, formatarHoras, resumo,
} from '@/lib/consumo';
import { dataLocal, mesclarDias, parseEnergia, resumoReal } from '@/lib/energia';

type Ar = { modo: string; nome?: string; ligado?: boolean | null; erro?: string; erroEnergia?: string | null; energia?: unknown };

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
  const [dias, setDias] = usarLocal<Record<string, number>>('ar.dias', {});
  const [desde, setDesde] = usarLocal<string>('ar.desde', dataLocal(Date.now()));
  const [ar, setAr] = useState<Ar | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const carregar = useCallback(async () => {
    try {
      const dados: Ar = await (await fetch('/api/ar')).json();
      setAr(dados);
      const novos = parseEnergia(dados.energia);
      if (novos.length) setDias((antigos) => mesclarDias(antigos, novos));
    } catch {
      setAr({ modo: 'lg', erro: 'Não consegui falar com o servidor' });
    }
  }, [setDias]);

  useEffect(() => {
    carregar();
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [carregar]);

  const aberta = sessoes.find((s) => s.fim === null);
  const r = resumo(sessoes, cfg, agora);
  const real = Object.keys(dias).length > 0;
  const rr = resumoReal(dias, agora, desde);
  const ultimos = Object.keys(dias).sort().slice(-14);
  const maxDia = Math.max(0.001, ...ultimos.map((d) => dias[d]));

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

      {real ? (
        <>
          <div className="card">
            <div className="k">Gasto acumulado desde {desde.split('-').reverse().join('/')} (dados da LG)</div>
            <div className="big">{brl(rr.acumulado * cfg.tarifa + cfg.baseKwh * cfg.tarifa)}</div>
            <div className="k">{kwhFmt(rr.acumulado + cfg.baseKwh)}{cfg.baseKwh ? ` (inclui ${kwhFmt(cfg.baseKwh)} de base)` : ''}</div>
          </div>
          <div className="grid">
            {([['Hoje', rr.hoje], ['7 dias', rr.semana], ['Este mês', rr.mes]] as const).map(([t, kwh]) => (
              <div className="card" key={t}>
                <div className="k">{t}</div>
                <div className="v">{brl(kwh * cfg.tarifa)}</div>
                <div className="k">{kwhFmt(kwh)}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="k">Últimos dias (kWh)</div>
            <div className="barras">
              {ultimos.map((d) => (
                <div key={d} className="barra" title={`${d}: ${kwhFmt(dias[d])}`}>
                  <div style={{ height: `${(dias[d] / maxDia) * 100}%` }} />
                  <span>{d.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}

      <div className="card grid">
        {!real && (
          <label>Potência estimada (W)
            <input inputMode="decimal" value={cfg.potenciaW} onChange={num('potenciaW')} />
          </label>
        )}
        <label>Tarifa (R$/kWh)
          <input inputMode="decimal" value={cfg.tarifa} onChange={num('tarifa')} />
        </label>
        <label>Base já gasta (kWh)
          <input inputMode="decimal" value={cfg.baseKwh} onChange={num('baseKwh')} />
        </label>
        {real && (
          <label>Acumular desde
            <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
          </label>
        )}
      </div>
      <p className="k">
        {real
          ? 'Consumo lido da LG (valores em Wh convertidos para kWh; confira com a sua conta de luz). A tarifa é provisória: ajuste com a sua conta. O histórico fica salvo neste aparelho.'
          : 'Sem dados de consumo da LG: o valor é estimado por potência × tempo ligado. Ajuste potência e tarifa.'}
      </p>
      <Link href="/diagnostico">Diagnóstico da conexão com a LG</Link>
    </main>
  );
}
