'use client';

import {
  ArrowDown, ArrowUp, Check, Clock, Droplet, Lightbulb, Lock, LockOpen, Minus, Plus, Power, RefreshCw, Snowflake, Sun,
  TriangleAlert, Wind, WifiOff, X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { MODES, type Device, type Mode } from '@/lib/device';
import { MONTHS, MON, WD, brl, brl0, cap, dl, hhmm, nf, parseNum, parseYmd } from '@/lib/fmt';
import { useMontado } from '@/lib/cliente';
import { calcularConta, contaAtual, fatiaDaConta, custoDe, delta, diasNoMes, mediaAnterior, periodos, projecaoMes, soma, tarifaDoMes } from '@/lib/stats';
import { Barras, LinhaMedia, Spinner, card, rotulo } from './ui';
import type { Cmd, Dados } from './tipos';

export type ConexaoEstado = 'loading' | 'ok' | 'error';

type Props = {
  d: Dados;
  conn: ConexaoEstado;
  device: Device | null;
  lidoEm: number | null;
  draft: number | null;
  cmd: Cmd;
  desligaEmH: number | null;
  ligadoHa: number | null;
  unlocked: boolean;
  dicaOculta: boolean;
  avisoOculto: boolean;
  erroUso: string | null;
  onRetryUso: () => void;
  selDia: number | null;
  onSelDia: (i: number) => void;
  onLock: () => void;
  onRetryConn: () => void;
  onPower: () => void;
  onTemp: (delta: number) => void;
  onMode: (m: Mode) => void;
  onTimer: (h: 1 | 2 | 4) => void;
  onHideTip: () => void;
  onHideAviso: () => void;
};

const MODE_ICON: Record<Mode, ReactNode> = {
  frio: <Snowflake size={17} />,
  ventilar: <Wind size={17} />,
  desumidificar: <Droplet size={17} />,
  aquecer: <Sun size={17} />,
  auto: <RefreshCw size={17} />,
};

function Seta({ subiu, size = 12 }: { subiu: boolean; size?: number }) {
  return subiu ? <ArrowUp size={size} strokeWidth={2.6} /> : <ArrowDown size={size} strokeWidth={2.6} />;
}

export default function Inicio(p: Props) {
  const { d, conn, device, cmd } = p;
  const montado = useMontado();
  const { cfg, dias, hoje, tarifa, tarifas } = d;
  const err = conn === 'error';
  const loading = conn === 'loading' && !device;
  const on = Boolean(device?.on) && !err;
  const nome = cfg.nome.trim() || device?.name || 'Ar-condicionado';
  const mesAtual = hoje.getMonth();
  const ym = `${hoje.getFullYear()}-${String(mesAtual + 1).padStart(2, '0')}`;
  const tarifaMes = tarifaDoMes(tarifas, tarifa, ym);

  // consumo
  const hojeStr = `${hoje.getFullYear()}-${String(mesAtual + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const hojeKwh = dias.find((x) => x.data === hojeStr)?.kwh ?? 0;
  const media30 = mediaAnterior(dias, hoje);
  const dHoje = delta(hojeKwh, media30);
  const insight = !media30
    ? 'Primeiro dia de uso. A comparação com a sua média aparece a partir de amanhã.'
    : dHoje && dHoje.r > 0.15
      ? `Hoje está ${nf(dHoje.r * 100, 0)}% acima da sua média de 30 dias (${nf(media30)} kWh). Valor diário informado pela LG.`
      : dHoje && dHoje.r < -0.15
        ? `Hoje está ${nf(-dHoje.r * 100, 0)}% abaixo da sua média de 30 dias (${nf(media30)} kWh). Abaixo do padrão recente.`
        : `Hoje está dentro da sua média de 30 dias (${nf(media30)} kWh).`;

  const per = periodos(dias, hoje, d.desde, d.base);
  const k7 = soma(per.ult7);
  const kMes = soma(per.mes);
  const kMesAnt = soma(per.mesAnt);
  const nomeMes = cap(MONTHS[mesAtual]);
  const nomeMesAnt = cap(MONTHS[(mesAtual + 11) % 12]);
  const cartoes = [
    { rot: '7 dias', reais: custoDe(per.ult7, tarifas, tarifa), kwh: nf(k7), d: delta(k7, soma(per.ant7)) },
    { rot: nomeMes, reais: custoDe(per.mes, tarifas, tarifa), kwh: nf(kMes), d: per.mesAntCompleto ? delta(kMes, kMesAnt) : null },
    { rot: 'Acumulado', reais: custoDe(per.acum, tarifas, tarifa) + d.base * tarifaMes, kwh: nf(per.acumKwh, 0), d: null },
  ];

  // meta
  const emReais = cfg.goalType === 'R$';
  const meta = parseNum(emReais ? cfg.goal : cfg.goalKwh) || 1;
  const gasto = emReais ? custoDe(per.mes, tarifas, tarifa) : kMes;
  const proj = emReais ? projecaoMes(kMes, hoje) * tarifaMes : projecaoMes(kMes, hoje);
  const f = (v: number) => (emReais ? brl0(v) : `${nf(v, 0)} kWh`);
  const pct = gasto / meta;
  const projPct = proj / meta;
  const corMeta = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--amber-fill)' : 'var(--green)';
  const corTexto = pct >= 1 ? 'var(--red)' : pct >= 0.8 || projPct > 1 ? 'var(--amber)' : 'var(--green)';
  const C = 2 * Math.PI * 38;
  const escala = Math.max(1, projPct * 1.08);
  const restam = diasNoMes(hoje.getFullYear(), mesAtual) - hoje.getDate();
  const msgMeta = pct >= 1
    ? `Meta estourada em ${f(gasto - meta)}`
    : projPct > 1
      ? `No ritmo atual, fecha ${nf((projPct - 1) * 100, 0)}% acima da meta`
      : `No ritmo atual, fecha ${nf((1 - projPct) * 100, 0)}% abaixo da meta`;
  const avisoMeta = pct >= 1 && cfg.alert100
    ? { bg: 'var(--red-soft)', fg: 'var(--red)', t: `Meta de ${MONTHS[mesAtual]} estourada`, s: `${f(gasto)} gastos de ${f(meta)} · faltam ${restam} dias` }
    : pct >= 0.8 && cfg.alert80
      ? { bg: 'var(--amber-soft)', fg: 'var(--amber)', t: `Você já usou ${nf(pct * 100, 0)}% da meta`, s: `Restam ${f(meta - gasto)} para ${restam} dias` }
      : null;

  // fatia do ar na conta de luz: a conta salva mais recente (ou, se não houver, o que está digitado)
  const salvaRecente = Object.values(d.contas).sort((a, b) => b.mes.localeCompare(a.mes))[0];
  const fSalva = salvaRecente ? fatiaDaConta(contaAtual(salvaRecente, dias)) : null;
  const mesPrev = `${new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getFullYear()}-${String(((hoje.getMonth() + 11) % 12) + 1).padStart(2, '0')}`;
  const rascunho = !salvaRecente && cfg.conta.valor && cfg.conta.kwh
    ? calcularConta({ valor: parseNum(cfg.conta.valor), kwh: parseNum(cfg.conta.kwh), fixas: parseNum(cfg.conta.fixas), mes: cfg.conta.mes || mesPrev }, dias, hoje)
    : null;
  const contaMes = MONTHS[Number((salvaRecente?.mes ?? (cfg.conta.mes || mesPrev)).slice(5, 7)) - 1];
  const fatia = fSalva ? fSalva.share : rascunho ? (rascunho.cobertura >= 0.95 ? rascunho.share : rascunho.shareMesCheio) : null;
  const fatiaReais = fSalva ? fSalva.custoAr : rascunho ? (rascunho.cobertura >= 0.95 ? rascunho.custoAr : rascunho.custoMesCheio) : null;
  const fatiaEstimada = fSalva ? fSalva.estimada : rascunho ? rascunho.cobertura < 0.95 : false;
  const conta = fSalva ?? rascunho;
  const kwhContaTxt = salvaRecente ? nf(salvaRecente.kwh, 0) : nf(parseNum(cfg.conta.kwh), 0);
  const kwhArTxt = fSalva ? nf(contaAtual(salvaRecente, dias).kwhAr, 0) : rascunho ? nf(rascunho.kwhAr, 0) : '';

  // mês × mês passado
  const mx = Math.max(kMes, kMesAnt) || 1;
  const comp = per.mesAntCompleto ? delta(kMes, kMesAnt) : null;

  // gráfico 30 dias
  const l30 = dias.slice(-30);
  const max30 = Math.max(...l30.map((x) => x.kwh), 1);
  const sel = Math.min(p.selDia ?? l30.length - 1, l30.length - 1);
  const sd = l30[sel];
  const semana = (s: string) => cap(WD[parseYmd(s).getDay()]);

  const mostrarControles = !err && device;
  const alvo = p.draft ?? device?.targetC ?? 24;
  const ctrlOp = on ? 1 : 0.4;

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            {cap(`${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][hoje.getDay()]}${hoje.getDay() > 0 && hoje.getDay() < 6 ? '-feira' : ''}, ${hoje.getDate()} de ${MONTHS[mesAtual]}`)}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Consumo do Ar</h1>
        </div>
        <button onClick={p.onLock} className="press" style={{ height: 44, padding: '0 14px', borderRadius: 22, background: 'var(--surface2)', fontSize: 13, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {p.unlocked ? <LockOpen size={16} /> : <Lock size={16} />}
          {p.unlocked ? 'Liberado' : 'Bloqueado'}
        </button>
      </header>

      {err && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: 'var(--red-soft)' }}>
          <WifiOff size={20} color="var(--red)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Sem conexão com a LG</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {p.lidoEm ? `Mostrando dados salvos às ${hhmm(new Date(p.lidoEm))}. ` : ''}Controles indisponíveis.
            </div>
          </div>
          <button onClick={p.onRetryConn} style={{ minHeight: 44, padding: '0 6px', fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>Tentar</button>
        </div>
      )}

      {p.erroUso && !err && (
        <div style={{ padding: '14px 16px', borderRadius: 18, background: 'var(--amber-soft)', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TriangleAlert size={20} color="var(--amber)" style={{ flex: 'none' }} />
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Não consegui ler o consumo da LG</div>
            <button onClick={p.onRetryUso} style={{ minHeight: 44, padding: '0 6px', fontSize: 13, fontWeight: 800, color: 'var(--amber)' }}>Tentar</button>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', wordBreak: 'break-word' }}>{p.erroUso}</div>
        </div>
      )}

      {loading ? (
        <>
          <div className="skel" style={{ height: 300, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--muted)', fontWeight: 700, fontSize: 14 }}>
            <Spinner /> Conectando ao aparelho…
          </div>
          <div className="skel" style={{ height: 150, borderRadius: 24, animationDelay: '.15s' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 96, borderRadius: 18, animationDelay: `${0.3 + i * 0.05}s` }} />)}
          </div>
        </>
      ) : (
        <>
          <section style={{ ...card(26, '20px 20px 18px'), display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={rotulo}>Gasto hoje</span>
              {dHoje && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 28, padding: '0 10px', borderRadius: 14, fontSize: 13, fontWeight: 800, background: dHoje.subiu ? 'var(--amber-soft)' : 'var(--green-soft)', color: dHoje.subiu ? 'var(--amber)' : 'var(--green)' }}>
                  <Seta subiu={dHoje.subiu} size={13} /> {nf(dHoje.pct, 0)}%
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span>
                <span style={{ fontSize: 58, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1 }}>{nf(hojeKwh)}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)', marginLeft: 5 }}>kWh</span>
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>{brl(hojeKwh * tarifaMes)}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>{insight}</div>
          </section>

          {device && (
            <section style={{ ...card(26, '20px 20px 18px'), display: 'grid', gap: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? 'var(--accent)' : 'var(--muted)', boxShadow: on ? '0 0 0 4px var(--accent-soft)' : 'none' }} />
                  {err ? 'Estado desconhecido' : on ? `Ligado · ${MODES[device.mode]}` : 'Desligado'}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{nome}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Ambiente <b style={{ fontSize: 15, color: 'var(--ink)' }}>{device.ambientC != null ? `${device.ambientC} °C` : '—'}</b></span>
                  <span style={{ whiteSpace: 'nowrap' }}>Vento <b style={{ fontSize: 15, color: 'var(--ink)' }}>{device.fan}</b></span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={p.onPower}
                  aria-label={on ? 'Desligar o ar' : 'Ligar o ar'}
                  className="press"
                  style={{ width: 76, height: 76, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s', background: on ? 'var(--accent)' : 'var(--surface2)', color: on ? 'var(--on-accent)' : 'var(--ink)', boxShadow: on ? '0 0 0 8px var(--accent-soft), 0 10px 24px -8px var(--accent)' : 'none' }}
                >
                  <Power size={32} strokeWidth={2.2} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: ctrlOp }}>
                <button onClick={() => p.onTemp(-1)} aria-label="Diminuir temperatura" className="press" style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={26} /></button>
                <div style={{ textAlign: 'center' }}>
                  <div style={rotulo}>Alvo</div>
                  <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, color: p.draft != null ? 'var(--accent)' : 'var(--ink)' }}>
                    {alvo}<span style={{ fontSize: 26, verticalAlign: 'super', marginLeft: 2 }}>°C</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                    {p.draft != null ? 'enviando em instantes…' : on ? (device.ambientC != null ? `ambiente ${device.ambientC} °C` : '') : 'ar desligado'}
                  </div>
                </div>
                <button onClick={() => p.onTemp(1)} aria-label="Aumentar temperatura" className="press" style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={26} /></button>
              </div>

              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px', opacity: ctrlOp }}>
                {(Object.keys(MODES) as Mode[]).map((k) => {
                  const a = device.mode === k && on;
                  return (
                    <button key={k} onClick={() => p.onMode(k)} className="press" style={{ flex: 'none', height: 44, padding: '0 14px', borderRadius: 22, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: a ? 'var(--accent)' : 'var(--surface2)', color: a ? 'var(--on-accent)' : 'var(--ink)' }}>
                      {MODE_ICON[k]} {MODES[k]}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: ctrlOp }}>
                <Clock size={18} color="var(--muted)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginRight: 4 }}>
                  {device.timerAtivo ? (p.desligaEmH ? `Desliga em até ${p.desligaEmH} h` : 'Timer ativo') : 'Desligar em'}
                </span>
                {([1, 2, 4] as const).map((h) => {
                  const a = device.timerAtivo && p.desligaEmH === h;
                  return (
                    <button key={h} onClick={() => p.onTimer(h)} className="press" style={{ height: 44, minWidth: 48, borderRadius: 14, fontSize: 13, fontWeight: 800, background: a ? 'var(--accent)' : 'var(--surface2)', color: a ? 'var(--on-accent)' : 'var(--ink)' }}>{h}h</button>
                  );
                })}
              </div>

              {cmd && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, fontSize: 13, fontWeight: 700, background: cmd.status === 'error' ? 'var(--red-soft)' : cmd.status === 'ok' ? 'var(--green-soft)' : 'var(--accent-soft)' }}>
                  {cmd.status === 'pending' && <Spinner />}
                  {cmd.status === 'ok' && <Check size={18} color="var(--green)" />}
                  {cmd.status === 'error' && <TriangleAlert size={18} color="var(--red)" />}
                  <span style={{ flex: 1 }}>
                    {cmd.status === 'pending' && `Enviando ao ${nome}: ${cmd.label}…`}
                    {cmd.status === 'ok' && `Pronto: ${cmd.label}.`}
                    {cmd.status === 'error' && `O ${nome} não respondeu (${cmd.label}). Ele pode estar fora do Wi-Fi.`}
                  </span>
                  {cmd.status === 'error' && cmd.retry && (
                    <button onClick={cmd.retry} style={{ height: 36, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', color: 'var(--red)', fontSize: 13, fontWeight: 800 }}>Repetir</button>
                  )}
                </div>
              )}
            </section>
          )}

          {mostrarControles && on && !device.timerAtivo && !p.avisoOculto && p.ligadoHa != null && p.ligadoHa >= 6 * 3600_000 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 20, background: 'var(--amber-soft)' }}>
              <Clock size={22} color="var(--amber)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Ligado há {Math.floor(p.ligadoHa / 3600_000)}h {String(Math.floor((p.ligadoHa % 3600_000) / 60_000)).padStart(2, '0')}min</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>Contado desde que o app viu o ar ligado.</div>
              </div>
              <button onClick={() => p.onTimer(1)} style={{ height: 44, padding: '0 12px', borderRadius: 14, background: 'var(--surface)', color: 'var(--amber)', fontSize: 13, fontWeight: 800 }}>Desligar em 1h</button>
              <button onClick={p.onHideAviso} aria-label="Dispensar" style={{ width: 36, height: 44 }}><X size={18} /></button>
            </div>
          )}

          {avisoMeta && (
            <div style={{ padding: '14px 16px', borderRadius: 20, background: avisoMeta.bg }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: avisoMeta.fg }}>{avisoMeta.t}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{avisoMeta.s}</div>
            </div>
          )}

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {cartoes.map((c) => (
              <div key={c.rot} style={card(20, '14px 12px')}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{c.rot}</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>{brl0(c.reais)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{c.kwh} kWh</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: c.d ? (c.d.subiu ? 'var(--amber)' : 'var(--green)') : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  {c.rot === 'Acumulado' ? `desde ${dl(parseYmd(d.desde))}` : c.d ? <><Seta subiu={c.d.subiu} size={11} /> {nf(c.d.pct, 0)}%</> : 'sem comparação'}
                </div>
              </div>
            ))}
          </section>

          <section style={{ ...card(26, '18px 20px'), display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`${nf(pct * 100, 0)}% da meta`}>
                <circle cx="46" cy="46" r="38" fill="none" stroke="var(--surface2)" strokeWidth="10" />
                <circle cx="46" cy="46" r="38" fill="none" stroke={corMeta} strokeWidth="10" strokeLinecap="round" transform="rotate(-90 46 46)" strokeDasharray={`${(montado ? Math.min(pct, 1) * C : 0).toFixed(1)} ${C.toFixed(1)}`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.8,.2,1)' }} />
                <text x="46" y="48" textAnchor="middle" fontSize="21" fontWeight="800" fill="var(--ink)">{nf(pct * 100, 0)}%</text>
                <text x="46" y="63" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--muted)">da meta</text>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Meta de {MONTHS[mesAtual]} · {f(meta)}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{f(gasto)} gastos</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: corTexto }}>{msgMeta}</div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                <span>Projeção do mês no ritmo atual</span><span>{f(proj)}</span>
              </div>
              <div style={{ position: 'relative', height: 12, borderRadius: 6, background: 'var(--surface2)' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${montado ? (projPct / escala) * 100 : 0}%`, background: corMeta, opacity: 0.35, borderRadius: 6, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
                <div style={{ position: 'absolute', inset: 0, width: `${montado ? (pct / escala) * 100 : 0}%`, background: corMeta, borderRadius: 6, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
                <div style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${100 / escala}% - 1px)`, width: 2, background: 'var(--ink)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginTop: 6 }}>
                <span>Dia {hoje.getDate()} de {diasNoMes(hoje.getFullYear(), mesAtual)}</span><span>Meta {f(meta)}</span>
              </div>
            </div>
          </section>

          {conta && fatia != null && fatiaReais != null && (
            <section style={{ ...card(26, '18px 20px'), display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>O ar na sua conta de {contaMes}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>{nf(fatia * 100, 0)}%</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>≈ {brl(fatiaReais)}</span>
              </div>
              <div style={{ height: 12, borderRadius: 6, background: 'var(--surface2)' }}>
                <div style={{ height: '100%', borderRadius: 6, background: 'var(--accent)', width: `${montado ? Math.min(100, fatia * 100) : 0}%`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
                {fatiaEstimada ? 'Estimativa: o app não tinha o mês inteiro.' : `${kwhArTxt} kWh do ar de ${kwhContaTxt} kWh da conta.`}
              </div>
            </section>
          )}

          <section style={{ ...card(26, '18px 20px'), display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{nomeMes} × {nomeMesAnt.toLowerCase()}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>dias 1 a {hoje.getDate()}</span>
            </div>
            {[{ l: MON[mesAtual].replace(/^./, (c) => c.toUpperCase()), k: kMes, bg: 'var(--accent)', reais: custoDe(per.mes, tarifas, tarifa) }, { l: MON[(mesAtual + 11) % 12].replace(/^./, (c) => c.toUpperCase()), k: kMesAnt, bg: 'var(--slate)', reais: custoDe(per.mesAnt, tarifas, tarifa) }].map((r) => (
              <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{r.l}</span>
                <div style={{ height: 14, borderRadius: 7, background: 'var(--surface2)' }}>
                  <div style={{ height: '100%', borderRadius: 7, background: r.bg, width: `${montado ? (r.k / mx) * 100 : 0}%`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{r.k ? brl0(r.reais) : '—'}</span>
              </div>
            ))}
            <div style={{ fontSize: 13, fontWeight: 700, color: comp ? (comp.subiu ? 'var(--amber)' : 'var(--green)') : 'var(--muted)' }}>
              {comp
                ? `${comp.subiu ? '+' : '−'}${nf(comp.pct, 0)}% em relação ao mesmo período de ${MONTHS[(mesAtual + 11) % 12]}`
                : kMesAnt
                  ? `O histórico de ${MONTHS[(mesAtual + 11) % 12]} está incompleto, então não dá para comparar.`
                  : `Sem dados de ${MONTHS[(mesAtual + 11) % 12]} para comparar.`}
            </div>
          </section>

          <section style={card(26, '18px 16px 14px')}>
            {l30.length < 2 ? (
              <div style={{ border: '1.5px dashed var(--line)', borderRadius: 16, padding: 18, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>
                O gráfico aparece a partir do segundo dia de uso. Hoje é o primeiro.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Últimos 30 dias</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{semana(sd.data)}, {dl(parseYmd(sd.data))}{sd.data === hojeStr ? ' · hoje' : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{nf(sd.kwh)} kWh</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{brl(sd.kwh * tarifaDoMes(tarifas, tarifa, sd.data.slice(0, 7)))}</div>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <Barras
                    altura={130}
                    itens={l30.map((x, i) => ({
                      h: montado ? `${Math.max(3, (x.kwh / max30) * 100)}%` : '0%',
                      bg: i === sel ? 'var(--ink)' : x.data === hojeStr ? 'var(--accent)' : 'var(--bar)',
                      aria: `${dl(parseYmd(x.data))}: ${nf(x.kwh)} kWh`,
                      onTap: () => p.onSelDia(i),
                    }))}
                  />
                  <LinhaMedia pct={(media30 / max30) * 100} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 6 }}>
                  <span>{dl(parseYmd(l30[0].data))}</span><span>- - média {nf(media30)} kWh</span><span>{l30[l30.length - 1].data === hojeStr ? 'hoje' : dl(parseYmd(l30[l30.length - 1].data))}</span>
                </div>
              </>
            )}
          </section>

          {!p.dicaOculta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px 12px 16px', borderRadius: 20, background: 'var(--green-soft)' }}>
              <Lightbulb size={22} color="var(--green)" style={{ flex: 'none' }} />
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Dica: alvo em 24 °C por 7 dias, depois compare com a semana anterior no Histórico.</div>
              <button onClick={p.onHideTip} aria-label="Dispensar dica" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>
          )}
        </>
      )}
    </>
  );
}
