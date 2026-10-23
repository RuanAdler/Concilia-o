'use client';

import {
  Check, ChartPie, ChevronRight, Clock, Droplet, Eye, LockOpen, Minus, Plus, Power, RefreshCw, Snowflake, Sun,
  TriangleAlert, Wind, WifiOff, X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { MODES, type Device, type Mode } from '@/lib/device';
import { MONTHS, WD, WDL, brl, brl0, cap, dl, hhmm, nf, parseNum, parseYmd, ymd } from '@/lib/fmt';
import { useMontado } from '@/lib/cliente';
import { addDias, contaAtual, custoDe, delta, diasDoPeriodo, fatiaDaConta, periodosCiclo, previsaoCiclo, soma, tarifaDoMes } from '@/lib/stats';
import { Ajuda, Selo } from './selos';
import { ContaInteira } from './previsaoUi';
import { Spinner, card, rotulo } from './ui';
import type { Cmd, Dados } from './tipos';

export type ConexaoEstado = 'loading' | 'ok' | 'error';
export type Modo = 'olhar' | 'controlar';

type Props = {
  d: Dados;
  conn: ConexaoEstado;
  device: Device | null;
  lidoEm: number | null;
  draft: number | null;
  cmd: Cmd;
  modo: Modo;
  desligaAs: number | null;
  erroUso: string | null;
  onRetryUso: () => void;
  onModo: () => void;
  onRetryConn: () => void;
  onPower: () => void;
  onTemp: (delta: number) => void;
  onMode: (m: Mode) => void;
  onTimer: (h: 1 | 2 | 4) => void;
  onIrContas: () => void;
};

const MODE_ICON: Record<Mode, ReactNode> = {
  frio: <Snowflake size={17} />,
  ventilar: <Wind size={17} />,
  desumidificar: <Droplet size={17} />,
  aquecer: <Sun size={17} />,
  auto: <RefreshCw size={17} />,
};

const DIAS_EXTENSO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const titulo = { margin: 0, fontSize: 17, fontWeight: 800 } as const;
const transicao = 'cubic-bezier(.2,.8,.2,1)';

export default function Inicio(p: Props) {
  const { d, conn, device, cmd } = p;
  const montado = useMontado();
  const [selDia, setSelDia] = useState<number | null>(null);
  const { cfg, dias, hoje, tarifa, tarifas } = d;
  const err = conn === 'error';
  const loading = conn === 'loading' && !device;
  const on = Boolean(device?.on) && !err;
  const nome = cfg.nome.trim() || device?.name || 'Ar-condicionado';
  const hojeStr = ymd(hoje);
  const tarifaMes = tarifaDoMes(tarifas, tarifa, hojeStr.slice(0, 7));
  const controlando = p.modo === 'controlar';

  // ---- Esta conta ----
  const per = periodosCiclo(dias, hoje, d.diaLeitura, d.desde, d.base);
  const kCiclo = soma(per.noCiclo);
  const gasto = custoDe(per.noCiclo, tarifas, tarifa);
  const prevKwh = previsaoCiclo(per.noCiclo, hojeStr, per.totalDias);
  const prevReais = prevKwh != null ? prevKwh * tarifaMes : null;
  const meta = (cfg.goalType === 'R$' ? parseNum(cfg.goal) : parseNum(cfg.goalKwh) * tarifaMes) || 1;
  const passou = gasto >= meta;
  const estado: 'ok' | 'warn' | 'over' =
    passou && cfg.alert100 ? 'over' : passou || (prevReais != null && prevReais > meta) || (cfg.alert80 && gasto >= meta * 0.8) ? 'warn' : 'ok';
  const corMeta = estado === 'over' ? 'var(--red)' : estado === 'warn' ? 'var(--amber-fill)' : 'var(--green)';
  const escala = Math.max(meta, prevReais ?? 0, gasto) * 1.08;
  const venceEm = MONTHS[Number(per.ciclo.fim.slice(5, 7)) % 12];
  const diff = prevReais != null ? Math.abs(prevReais - meta) : 0;
  const frase =
    passou
      ? `Você já passou ${brl0(gasto - meta)} da meta de ${brl0(meta)}.${prevReais != null ? ` No ritmo atual, a conta do ar fecha em ${brl0(prevReais)}.` : ''}`
      : prevReais != null
        ? `No ritmo atual, a conta do ar fecha em ${brl0(prevReais)}, ${brl0(diff)} ${estado === 'warn' ? 'acima da' : 'abaixo da'} sua meta de ${brl0(meta)}.`
        : `A previsão aparece a partir do 3º dia desta conta. Sua meta é ${brl0(meta)}.`;
  const rotuloEstado = estado === 'over' ? 'Meta estourada' : passou ? 'Passou da meta' : estado === 'warn' ? (prevReais != null && prevReais > meta ? 'Previsão acima da meta' : 'Chegando perto da meta') : 'Dentro da meta';

  // ---- Últimos 7 dias ----
  const dias7 = Array.from({ length: 7 }, (_, i) => ymd(addDias(hoje, i - 6)));
  const kwhDia = (data: string) => dias.find((x) => x.data === data)?.kwh ?? null;
  const max7 = Math.max(...dias7.map((x) => kwhDia(x) ?? 0), 0.1);
  const custo7 = custoDe(per.ult7, tarifas, tarifa);
  const custoAnt7 = custoDe(per.ant7, tarifas, tarifa);
  const d7 = per.ant7.length === 7 ? delta(custo7, custoAnt7) : null;
  const frase7 = d7
    ? d7.pct < 1
      ? `Esta semana o ar custou ${brl0(custo7)}, praticamente igual à anterior.`
      : `Esta semana o ar custou ${brl0(custo7)}, ${nf(d7.pct, 0)}% ${d7.subiu ? 'mais' : 'menos'} que a anterior.`
    : `Esta semana o ar custou ${brl0(custo7)}. A comparação aparece com duas semanas de uso.`;
  const sel = selDia ?? 6;
  const selData = dias7[sel];
  const selKwh = kwhDia(selData);
  const selDate = parseYmd(selData);

  // ---- Conta passada ----
  const custoCiclo = gasto;
  const custoCicloAnt = custoDe(per.cicloAnt, tarifas, tarifa);
  const dConta = per.cicloAntCompleto ? delta(custoCiclo, custoCicloAnt) : null;
  const antInteiro = diasDoPeriodo(dias, per.ant.inicio, per.ant.fim);
  const antCobre = antInteiro.length >= Math.ceil(per.totalDias * 0.95) || antInteiro.length >= Math.round((parseYmd(per.ant.fim).getTime() - parseYmd(per.ant.inicio).getTime()) / 86_400_000) * 0.95;
  const maxConta = Math.max(custoCiclo, custoCicloAnt, 1);

  // ---- atalho para a fatia do ar ----
  const recente = Object.values(d.contas)
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .map((c) => ({ c, f: fatiaDaConta(contaAtual(c, dias), d.semArDia) }))
    .find((x) => x.f.share != null && !x.f.antesDoAr);

  const alvo = p.draft ?? device?.targetC ?? 24;
  const desligaTxt = device?.timerAtivo ? (p.desligaAs ? `Desliga às ${hhmm(new Date(p.desligaAs))}` : 'Timer ativo') : 'Sem timer';

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{cap(`${DIAS_EXTENSO[hoje.getDay()]}, ${hoje.getDate()} de ${MONTHS[hoje.getMonth()]}`)}</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Consumo do Ar</h1>
        </div>
        <button onClick={p.onModo} className="press" style={{ height: 44, padding: '0 14px', borderRadius: 22, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, background: controlando ? 'var(--accent)' : 'var(--surface2)', color: controlando ? 'var(--on-accent)' : 'var(--muted)' }}>
          {controlando ? <LockOpen size={16} /> : <Eye size={16} />}
          {controlando ? 'Controlando' : 'Só olhar'}
        </button>
      </header>

      {err && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: 'var(--red-soft)' }}>
          <WifiOff size={20} color="var(--red)" style={{ flex: 'none' }} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
            <b style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>Sem conexão com a LG</b>
            {p.lidoEm ? `Os números são da última leitura, às ${hhmm(new Date(p.lidoEm))}. ` : ''}Não dá para mexer no {nome} agora.
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
            <Spinner /> Buscando os dados da LG…
          </div>
          <div className="skel" style={{ height: 150, borderRadius: 24, animationDelay: '.15s' }} />
          <div className="skel" style={{ height: 120, borderRadius: 24, animationDelay: '.3s' }} />
        </>
      ) : (
        <>
          {/* 1. Esta conta */}
          <section style={{ ...card(26, '20px 20px 18px'), display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={titulo}>Esta conta</h2>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>de {dl(parseYmd(per.ciclo.inicio))} a {dl(parseYmd(per.ciclo.fim))} · vence em {venceEm}</div>
            </div>
            <Ajuda>O gasto é uma estimativa: o consumo que a LG informa (kWh) vezes o preço do kWh dos Ajustes. A previsão supõe que os próximos dias serão parecidos com os últimos. Não é o valor da conta de luz, que inclui o resto da casa.</Ajuda>
            <div style={{ flexBasis: '100%', display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>O ar já custou</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05 }}>{brl0(gasto)}</span>
                  <Selo tipo="estimativa" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  {nf(kCiclo)} kWh até agora · dia {per.decorridos} de {per.totalDias} <Selo tipo="real" />
                </div>
              </div>

              <div>
                <div style={{ position: 'relative', height: 16, borderRadius: 8, background: 'var(--surface2)', marginTop: 22 }}>
                  {prevReais != null && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${montado ? (Math.max(prevReais, gasto) / escala) * 100 : 0}%`, borderRadius: 8, backgroundImage: `repeating-linear-gradient(135deg, ${corMeta} 0 3px, transparent 3px 7px)`, transition: `width 1s ${transicao}` }} />
                  )}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${montado ? (gasto / escala) * 100 : 0}%`, borderRadius: 8, background: corMeta, transition: `width 1s ${transicao}` }} />
                  <div style={{ position: 'absolute', top: -4, bottom: -4, left: `calc(${(meta / escala) * 100}% - 1px)`, width: 2, background: 'var(--ink)' }}>
                    <span style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 2, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>meta {brl0(meta)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginTop: 8 }}>
                  <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: corMeta, marginRight: 5 }} />até agora</span>
                  {prevReais != null && <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, backgroundImage: `repeating-linear-gradient(135deg, ${corMeta} 0 2px, transparent 2px 4px)`, marginRight: 5 }} />previsão</span>}
                  <span><i style={{ display: 'inline-block', width: 2, height: 10, background: 'var(--ink)', marginRight: 5 }} />sua meta</span>
                </div>
              </div>

              {prevReais != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>Previsão para esta conta</div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{brl0(prevReais)}</div>
                  </div>
                  <Selo tipo="previsao" />
                </div>
              )}

              <div style={{ borderRadius: 16, padding: '12px 14px', display: 'grid', gap: 4, background: prevReais == null && estado === 'ok' ? 'var(--surface2)' : estado === 'over' ? 'var(--red-soft)' : estado === 'warn' ? 'var(--amber-soft)' : 'var(--green-soft)' }}>
                {(prevReais != null || passou || estado === 'warn') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: estado === 'over' ? 'var(--red)' : estado === 'warn' ? 'var(--amber)' : 'var(--green)' }}>
                    {estado === 'over' ? <X size={16} /> : estado === 'warn' ? <TriangleAlert size={16} /> : <Check size={16} />} {rotuloEstado}
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{frase}</div>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <ContaInteira p={d.contaPrev} />
              </div>
            </div>
          </section>

          {/* 2. Gelinho agora */}
          {device && (
            <section style={{ ...card(26, '20px 20px 18px'), display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? 'var(--accent)' : 'var(--muted)', boxShadow: on ? '0 0 0 4px var(--accent-soft)' : 'none' }} />
                  {err ? 'Sem conexão · estado desconhecido' : on ? `Ligado · ${MODES[device.mode]}` : 'Desligado'}
                </div>
                <h2 style={{ margin: '2px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{nome} agora</h2>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Ambiente <b style={{ fontSize: 15, color: 'var(--ink)' }}>{device.ambientC != null ? `${device.ambientC} °C` : '—'}</b></div>
              </div>
              <Ajuda>Olhar não precisa de nada. Para mexer (ligar, temperatura, modo, timer) é preciso o PIN de 6 dígitos. Depois de {cfg.lockMin} min sem mexer, volta sozinho para &quot;só olhar&quot;.</Ajuda>

              {!controlando ? (
                <div style={{ flexBasis: '100%', display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    {[['Temperatura', on && device.targetC != null ? `${device.targetC} °C` : '—'], ['Modo', MODES[device.mode]], ['Timer', desligaTxt]].map(([r, v]) => (
                      <div key={r} style={{ background: 'var(--surface2)', borderRadius: 16, padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{r}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={p.onModo} disabled={err} className="press" style={{ height: 56, borderRadius: 18, background: 'var(--ink)', color: 'var(--bg)', fontSize: 16, fontWeight: 800, opacity: err ? 0.4 : 1 }}>Controlar o {nome}</button>
                </div>
              ) : (
                <div style={{ flexBasis: '100%', display: 'grid', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <button onClick={p.onPower} aria-label={on ? 'Desligar o ar' : 'Ligar o ar'} className="press" style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s', background: on ? 'var(--accent)' : 'var(--surface2)', color: on ? 'var(--on-accent)' : 'var(--ink)', boxShadow: on ? '0 0 0 7px var(--accent-soft), 0 10px 24px -8px var(--accent)' : 'none' }}>
                      <Power size={32} strokeWidth={2.2} />
                    </button>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{on ? 'Ligado · toque para desligar' : 'Desligado · toque para ligar'}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: on ? 1 : 0.4 }}>
                    <button onClick={() => p.onTemp(-1)} aria-label="Diminuir temperatura" className="press" style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={26} /></button>
                    <div style={{ textAlign: 'center' }}>
                      <div style={rotulo}>Temperatura</div>
                      <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, color: p.draft != null ? 'var(--accent)' : 'var(--ink)' }}>
                        {alvo}<span style={{ fontSize: 26, verticalAlign: 'super', marginLeft: 2 }}>°C</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{p.draft != null ? 'enviando em instantes…' : on ? (device.ambientC != null ? `ambiente ${device.ambientC} °C` : '') : 'ar desligado'}</div>
                    </div>
                    <button onClick={() => p.onTemp(1)} aria-label="Aumentar temperatura" className="press" style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={26} /></button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px', opacity: on ? 1 : 0.4 }}>
                    {(Object.keys(MODES) as Mode[]).map((k) => {
                      const a = device.mode === k && on;
                      return (
                        <button key={k} onClick={() => p.onMode(k)} className="press" style={{ flex: 'none', height: 44, padding: '0 14px', borderRadius: 22, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: a ? 'var(--accent)' : 'var(--surface2)', color: a ? 'var(--on-accent)' : 'var(--ink)' }}>
                          {MODE_ICON[k]} {MODES[k]}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: on ? 1 : 0.4 }}>
                    <Clock size={18} color="var(--muted)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginRight: 4 }}>{device.timerAtivo ? desligaTxt : 'Desligar em'}</span>
                    {([1, 2, 4] as const).map((h) => {
                      const a = Boolean(device.timerAtivo && p.desligaAs && Math.abs(p.desligaAs - Date.now() - h * 3600_000) < 3600_000 / 2);
                      return <button key={h} onClick={() => p.onTimer(h)} className="press" style={{ height: 44, minWidth: 48, borderRadius: 14, fontSize: 13, fontWeight: 800, background: a ? 'var(--accent)' : 'var(--surface2)', color: a ? 'var(--on-accent)' : 'var(--ink)' }}>{h}h</button>;
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
                        {cmd.status === 'error' && `O ${nome} não respondeu (${cmd.label}). Ele pode estar sem Wi-Fi.`}
                      </span>
                      {cmd.status === 'error' && cmd.retry && (
                        <button onClick={cmd.retry} style={{ height: 36, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', color: 'var(--red)', fontSize: 13, fontWeight: 800 }}>Tentar de novo</button>
                      )}
                    </div>
                  )}

                  <button onClick={p.onModo} style={{ minHeight: 44, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Voltar para só olhar · volta sozinho em {cfg.lockMin} min</button>
                </div>
              )}
            </section>
          )}

          {/* 3. Últimos 7 dias */}
          <section style={{ ...card(26, '18px 20px'), display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={titulo}>Últimos 7 dias</h2>
              <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{frase7}</p>
            </div>
            <Ajuda>Soma do custo estimado dos últimos 7 dias, comparada com os 7 dias antes deles. As barras mostram o consumo de cada dia informado pela LG. Hoje ainda está contando.</Ajuda>
            <div style={{ flexBasis: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                {dias7.map((data, i) => {
                  const k = kwhDia(data);
                  return (
                    <button key={data} onClick={() => setSelDia(i)} aria-label={`${dl(parseYmd(data))}: ${k != null ? `${nf(k)} kWh` : 'sem dado'}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <span style={{ display: 'block', width: '100%', height: k != null ? (montado ? `${Math.max(4, (k / max7) * 100)}%` : '0%') : '6%', borderRadius: '5px 5px 3px 3px', border: k != null ? 'none' : '1.5px dashed var(--line)', background: k == null ? 'transparent' : i === sel ? 'var(--ink)' : i === 6 ? 'var(--accent)' : 'var(--bar)', transition: `height .7s ${transicao}` }} />
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {dias7.map((data, i) => <span key={data} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: i === sel ? 800 : 700, color: i === sel ? 'var(--ink)' : 'var(--muted)' }}>{i === 6 ? 'hoje' : WD[parseYmd(data).getDay()]}</span>)}
              </div>
              <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700 }}>
                {cap(WDL[selDate.getDay()])}, {dl(selDate)}: {selKwh != null ? `${nf(selKwh)} kWh · ${brl(selKwh * tarifaDoMes(tarifas, tarifa, selData.slice(0, 7)))}` : 'sem dado'}{sel === 6 ? ' (ainda contando)' : ''}
              </div>
            </div>
          </section>

          {/* 4. Comparado com a conta passada */}
          <section style={{ ...card(26, '18px 20px'), display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={titulo}>Comparado com a conta passada</h2>
              {dConta ? (
                <p style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>
                  Nos primeiros {per.decorridos} dias, esta conta está {brl0(Math.abs(custoCiclo - custoCicloAnt))} {dConta.subiu ? 'acima' : 'abaixo'} da passada ({dConta.subiu ? '+' : '−'}{nf(dConta.pct, 0)}%).
                </p>
              ) : (
                <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Ainda não há conta passada com dados da LG para comparar. Ela aparece aqui depois da primeira leitura completa.
                </p>
              )}
            </div>
            <Ajuda>Para ser justo, comparamos o mesmo número de dias: os primeiros dias desta conta com os primeiros dias da conta passada.</Ajuda>
            {dConta && (
              <div style={{ flexBasis: '100%', display: 'grid', gap: 8 }}>
                {[{ l: 'Esta', v: custoCiclo, bg: 'var(--accent)' }, { l: 'Passada', v: custoCicloAnt, bg: 'var(--slate)' }].map((r) => (
                  <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{r.l}</span>
                    <div style={{ height: 12, borderRadius: 6, background: 'var(--surface2)' }}>
                      <div style={{ height: '100%', borderRadius: 6, background: r.bg, width: `${montado ? (r.v / maxConta) * 100 : 0}%`, transition: `width 1s ${transicao}` }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{brl0(r.v)}</span>
                  </div>
                ))}
                {antCobre && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                    A conta passada inteira ({dl(parseYmd(per.ant.inicio))} a {dl(parseYmd(per.ant.fim))}) teve {brl0(custoDe(antInteiro, tarifas, tarifa))} de ar.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 5. Atalho para a fatia do ar */}
          {recente && recente.f.share != null && (
            <button onClick={p.onIrContas} className="press" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 22, background: 'var(--accent-soft)', textAlign: 'left' }}>
              <ChartPie size={24} color="var(--accent)" style={{ flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                Na conta {recente.c.mes.slice(5)}/{recente.c.mes.slice(0, 4)}, o ar foi {nf(recente.f.share * 100, 0)}% da conta de luz
              </span>
              <ChevronRight size={20} />
            </button>
          )}
        </>
      )}
    </>
  );
}
