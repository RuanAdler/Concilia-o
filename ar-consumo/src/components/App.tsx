'use client';

import { ChartColumn, House, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG_PADRAO, usarLocal, type Config } from '@/lib/cliente';
import type { Comando, Device, Mode } from '@/lib/device';
import { MODES } from '@/lib/device';
import { mesclarDias, type DiaEnergia } from '@/lib/energia';
import { dl, hhmm, nf, parseNum, parseYmd, ymd } from '@/lib/fmt';
import { cicloDe, clampDia, contaAtual, fatiaDaConta, mapaParaDias, tarifaDoMes, type ContaSalva } from '@/lib/stats';
import { CONTAS_INICIAIS, TARIFAS_INICIAIS } from '@/lib/contas-iniciais';
import Ajustes from './Ajustes';
import Contas from './Contas';
import Introducao from './Introducao';
import Historico from './Historico';
import Inicio, { type ConexaoEstado, type Modo } from './Inicio';
import Pin from './Pin';
import { SheetApagar, SheetDiag, type DiagLinha } from './Sheets';
import type { Cmd, Dados } from './tipos';

type Aba = 'home' | 'hist' | 'contas' | 'set';
type Salvo = { device: Device; lidoEm: number } | null;
type Pendente = { label: string; comando: Comando | null } | null;

const json = async (r: Response) => (await r.json().catch(() => ({}))) as Record<string, any>;

export default function App() {
  const [cfgSalvo, setCfg] = usarLocal<Config>('ar.cfg2', CONFIG_PADRAO);
  // configurações antigas não têm os campos novos: completa com o padrão
  const cfg = useMemo<Config>(() => {
    const c = { ...CONFIG_PADRAO, ...cfgSalvo, conta: { ...CONFIG_PADRAO.conta, ...cfgSalvo.conta } };
    // a tarifa de R$ 0,95 era só provisória: quem nunca a definiu passa a usar a das contas
    return cfgSalvo.tarifaDefinida && cfgSalvo.tariff !== '0,95' ? c : { ...c, tariff: CONFIG_PADRAO.tariff, tarifaDefinida: true };
  }, [cfgSalvo]);
  const [mapa, setMapa] = usarLocal<Record<string, number>>('ar.dias', {});
  const [contas, setContas] = usarLocal<Record<string, ContaSalva>>('ar.contas', {});
  const [salvo, setSalvo] = usarLocal<Salvo>('ar.device', null);
  const [introVista, setIntroVista, introPronta] = usarLocal<boolean>('ar.intro', false);
  const [introAberta, setIntroAberta] = useState(false);

  const [aba, setAba] = useState<Aba>('home');
  const [conn, setConn] = useState<ConexaoEstado>('loading');
  const [device, setDevice] = useState<Device | null>(null);
  const [lidoEm, setLidoEm] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [pin, setPin] = useState({ configurado: true, liberado: false });
  const [pinAberto, setPinAberto] = useState(false);
  const [pendente, setPendente] = useState<Pendente>(null);
  const [cmd, setCmd] = useState<Cmd>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [desligaAs, setDesligaAs] = useState<number | null>(null);
  const [modo, setModo] = useState<Modo>('olhar');
  const [erroUso, setErroUso] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [folha, setFolha] = useState<null | 'diag' | 'apagar'>(null);
  const [diag, setDiag] = useState<{ testando: boolean; ok: boolean | null; texto: string; ms: number | null; modo: string }>({ testando: false, ok: null, texto: '', ms: null, modo: '' });

  const cmdRef = useRef<Cmd>(null);
  cmdRef.current = cmd;
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draftT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cmdT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draftRef = useRef<number | null>(null);
  const ultimaAcao = useRef(Date.now());

  const mostrar = useCallback((t: string) => {
    clearTimeout(toastT.current);
    setToast(t);
    toastT.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- dados derivados ----
  const dias = useMemo(() => mapaParaDias(mapa), [mapa]);
  const hoje = useMemo(() => new Date(agora), [agora]);
  const tarifa = cfg.tariffMode === 'direto' ? parseNum(cfg.tariff) : parseNum(cfg.billKwh) ? parseNum(cfg.billValue) / parseNum(cfg.billKwh) : 0;
  const primeiro = dias[0]?.data ?? ymd(hoje);
  const diaLeitura = clampDia(parseInt(cfg.diaLeitura, 10));
  const semArDia = parseNum(cfg.semAr);
  const contasTodas = useMemo(() => ({ ...CONTAS_INICIAIS, ...contas }), [contas]);
  const tarifasTodas = useMemo(() => ({ ...TARIFAS_INICIAIS, ...cfg.tarifas }), [cfg.tarifas]);
  const dados: Dados = { cfg, dias, hoje, tarifa, diaLeitura, semArDia, tarifas: tarifasTodas, desde: cfg.since || cicloDe(hoje, diaLeitura).inicio, base: parseNum(cfg.base), primeiro, contas: contasTodas };

  // guarda a tarifa de cada mês: mudar o valor não reescreve o custo dos meses passados
  useEffect(() => {
    if (!cfg.tarifaDefinida || tarifa <= 0) return;
    const ym = ymd(new Date()).slice(0, 7);
    if (cfg.tarifas[ym] !== tarifa) setCfg((c) => ({ ...c, tarifas: { ...c.tarifas, [ym]: tarifa } }));
  }, [cfg.tarifaDefinida, cfg.tarifas, tarifa, setCfg]);

  // tema
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      const escuro = cfg.theme === 'escuro' || (cfg.theme === 'auto' && mq.matches);
      document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    };
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [cfg.theme]);

  // ---- leitura da LG ----
  const lerEstado = useCallback(async () => {
    try {
      const r = await fetch('/api/lg/state', { cache: 'no-store' });
      const j = await json(r);
      if (!r.ok) throw new Error(j.erro);
      setDevice(j.device);
      setLidoEm(j.lidoEm);
      setConn('ok');
      setSalvo({ device: j.device, lidoEm: j.lidoEm });
    } catch {
      setConn('error');
    }
  }, [setSalvo]);

  const lerUso = useCallback(async () => {
    try {
      const r = await fetch('/api/lg/usage', { cache: 'no-store' });
      const j = await json(r);
      if (!r.ok) throw new Error(String(j.erro ?? `Erro ${r.status}`));
      setMapa((m) => mesclarDias(m, j.dias as DiaEnergia[]));
      setErroUso(null);
    } catch (e) {
      // segue com o histórico guardado e avisa na tela
      setErroUso(e instanceof Error ? e.message : 'Sem rede');
    }
  }, [setMapa]);

  useEffect(() => {
    fetch('/api/pin', { cache: 'no-store' }).then(json).then((j) => setPin({ configurado: Boolean(j.configurado), liberado: Boolean(j.liberado) })).catch(() => {});
    lerEstado();
    lerUso();
    const t = setInterval(() => {
      setAgora(Date.now());
      if (document.visibilityState === 'visible' && cmdRef.current?.status !== 'pending') lerEstado();
    }, 30_000);
    const t2 = setInterval(lerUso, 5 * 60_000);
    const vis = () => { if (document.visibilityState === 'visible') { setAgora(Date.now()); lerEstado(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); clearInterval(t2); document.removeEventListener('visibilitychange', vis); };
  }, [lerEstado, lerUso]);

  // sem conexão: mostra o último estado salvo
  const aparelho = device ?? (conn === 'error' ? salvo?.device ?? null : null);
  const lido = lidoEm ?? salvo?.lidoEm ?? null;

  // ---- comandos ----
  const abrirPin = (p: Pendente) => { setPendente(p); setPinAberto(true); };

  const exec = useCallback(async (label: string, comando: Comando) => {
    clearTimeout(cmdT.current);
    ultimaAcao.current = Date.now();
    setCmd({ status: 'pending', label });
    try {
      const r = await fetch('/api/lg/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(comando) });
      const j = await json(r);
      if (r.status === 401) {
        setCmd(null); setDraft(null);
        setPin((p) => ({ ...p, liberado: false }));
        abrirPin({ label, comando });
        return;
      }
      if (r.status === 503 || r.status === 400) { setCmd(null); setDraft(null); mostrar(String(j.erro ?? 'Comando recusado')); return; }
      if (!r.ok) throw new Error(String(j.erro));
      setDevice(j.device); setConn('ok'); setDraft(null);
      if (comando.action === 'timer') setDesligaAs(comando.value ? Date.now() + comando.value * 3600_000 : null);
      if (comando.action === 'power' && !comando.value) setDesligaAs(null);
      setCmd({ status: 'ok', label });
      cmdT.current = setTimeout(() => setCmd(null), 2200);
    } catch {
      setDraft(null);
      setCmd({ status: 'error', label, retry: () => exec(label, comando) });
    }
  }, [mostrar]);

  const executar = useCallback((label: string, comando: Comando) => {
    if (conn === 'error') return mostrar('Sem conexão com a LG. Os controles voltam quando reconectar.');
    if (cmdRef.current?.status === 'pending') return;
    if (!pin.configurado) return mostrar('Controles desativados: defina APP_PIN (6 dígitos) na hospedagem.');
    if (!pin.liberado) return abrirPin({ label, comando });
    exec(label, comando);
  }, [conn, pin, exec, mostrar]);

  const ligado = Boolean(aparelho?.on);
  const aoLigar = () => executar(ligado ? 'desligar' : 'ligar', { action: 'power', value: !ligado });

  const aoTemperatura = (delta: number) => {
    if (conn === 'error') return mostrar('Sem conexão com a LG. Os controles voltam quando reconectar.');
    if (!ligado) return mostrar('Ligue o ar para mudar a temperatura.');
    if (!pin.liberado) return pin.configurado ? abrirPin({ label: 'mudar a temperatura', comando: null }) : mostrar('Controles desativados: defina APP_PIN na hospedagem.');
    ultimaAcao.current = Date.now();
    const atual = draftRef.current ?? aparelho?.targetC ?? 24;
    const t = Math.max(16, Math.min(30, atual + delta));
    if (t === atual) return mostrar(t === 16 ? 'O mínimo é 16 °C.' : 'O máximo é 30 °C.');
    draftRef.current = t;
    setDraft(t);
    clearTimeout(draftT.current);
    draftT.current = setTimeout(() => { draftRef.current = null; exec(`temperatura ${t} °C`, { action: 'target', value: t }); }, 900);
  };

  const aoModo = (m: Mode) => {
    if (!ligado) return conn === 'error' ? undefined : mostrar('Ligue o ar para trocar o modo.');
    if (aparelho?.mode === m) return;
    executar(`modo ${MODES[m].toLowerCase()}`, { action: 'mode', value: m });
  };

  const aoTimer = (h: 1 | 2 | 4) => {
    if (!ligado) return mostrar('O timer só vale com o ar ligado.');
    const cancelar = Boolean(aparelho?.timerAtivo && desligaAs && Math.abs(desligaAs - Date.now() - h * 3600_000) < 1800_000);
    executar(cancelar ? 'cancelar timer' : `desligar em ${h}h`, { action: 'timer', value: cancelar ? null : h });
  };

  const conferirPin = async (digitos: string) => {
    try {
      const r = await fetch('/api/pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: digitos }) });
      const j = await json(r);
      if (!r.ok) return { ok: false, erro: r.status === 429 ? String(j.erro) : 'PIN errado. Tente de novo.' };
    } catch {
      return { ok: false, erro: 'Não consegui verificar o PIN. Tente de novo.' };
    }
    setPin((p) => ({ ...p, liberado: true }));
    setPinAberto(false);
    const p = pendente;
    setPendente(null);
    entrarEmControle();
    if (p?.comando) exec(p.label, p.comando);
    return { ok: true };
  };

  const entrarEmControle = () => {
    ultimaAcao.current = Date.now();
    setModo('controlar');
    mostrar(`Pronto para controlar. Volta para "só olhar" em ${cfg.lockMin} min sem uso.`);
  };

  const voltarParaOlhar = useCallback(async (aviso = 'Voltou para só olhar.') => {
    setModo('olhar');
    setPin((p) => ({ ...p, liberado: false }));
    await fetch('/api/pin', { method: 'DELETE' }).catch(() => {});
    mostrar(aviso);
  }, [mostrar]);

  const aoAlternarModo = () => {
    if (modo === 'controlar') return voltarParaOlhar();
    if (conn === 'error') return mostrar('Sem conexão com a LG. Os controles voltam quando reconectar.');
    if (!pin.configurado) return mostrar('Controles desativados: defina APP_PIN (6 dígitos) na hospedagem.');
    if (pin.liberado) return entrarEmControle();
    abrirPin(null);
  };

  // depois de alguns minutos sem mexer, volta sozinho para "só olhar"
  useEffect(() => {
    if (modo !== 'controlar') return;
    const t = setInterval(() => {
      if (Date.now() - ultimaAcao.current > cfg.lockMin * 60_000) voltarParaOlhar();
    }, 10_000);
    return () => clearInterval(t);
  }, [modo, cfg.lockMin, voltarParaOlhar]);

  // ---- dados / diagnóstico ----
  const exportar = () => {
    const blocoContas = Object.values(contasTodas)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((c) => {
        const a = contaAtual(c, dias);
        const f = fatiaDaConta(a, semArDia);
        return `${a.mes};${a.inicio ?? ''};${a.fim ?? ''};${nf(a.valor, 2)};${nf(a.kwh, 1)};${nf(a.fixas, 2)};${nf(a.kwhAr, 2)};${f.share != null ? nf(f.share * 100, 1) : ''};${f.antesDoAr ? 'antes do ar' : f.porDiferenca ? 'por diferença' : f.estimada ? 'estimada' : 'completa'}`;
      });
    const linhas = [
      'data;kwh;reais',
      ...dias.map((x) => `${x.data};${nf(x.kwh, 3)};${nf(x.kwh * tarifaDoMes(tarifasTodas, tarifa, x.data.slice(0, 7)), 2)}`),
      ...(blocoContas.length ? ['', 'mes;inicio_leitura;fim_leitura;valor_conta;kwh_conta;taxas_fixas;kwh_ar;fatia_ar_pct;cobertura', ...blocoContas] : []),
    ].join('\n');
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([linhas], { type: 'text/csv' }));
      a.download = 'consumo-do-ar.csv';
      a.click();
    } catch {
      return mostrar('Não consegui gerar o CSV.');
    }
    mostrar(`CSV exportado · ${dias.length} dias.`);
  };

  const apagar = async () => {
    setMapa({});
    setFolha(null);
    await lerUso();
    mostrar('Histórico local apagado. Os últimos 30 dias voltam da LG.');
  };

  const testar = async () => {
    setDiag((d) => ({ ...d, testando: true }));
    try {
      const r = await fetch('/api/lg/status', { cache: 'no-store' });
      const j = await json(r);
      setDiag({ testando: false, ok: r.ok && Boolean(j.ok), texto: String(j.erro ?? ''), ms: typeof j.latenciaMs === 'number' ? j.latenciaMs : null, modo: String(j.modo ?? '') });
      mostrar(r.ok ? `Conexão ok · ${j.latenciaMs} ms` : 'Falhou: a LG não respondeu.');
      if (r.ok) lerEstado();
    } catch {
      setDiag((d) => ({ ...d, testando: false, ok: false, texto: 'Sem rede' }));
      mostrar('Falhou: sem rede.');
    }
  };

  const conectado = conn !== 'error' && diag.ok !== false;
  const linhasDiag: DiagLinha[] = [
    { k: 'Status', v: conectado ? 'Conectado' : 'Erro de conexão', ok: conectado },
    { k: 'Modo', v: diag.modo === 'teste' ? 'Teste (sem LG)' : diag.modo === 'lg' ? 'LG ThinQ' : '—' },
    { k: 'Aparelho', v: aparelho?.name ?? '—' },
    { k: 'Última leitura', v: lido ? `hoje, ${hhmm(new Date(lido))}` : '—' },
    { k: 'Resposta', v: diag.ms != null ? `${diag.ms} ms` : '—' },
    ...(diag.texto ? [{ k: 'Erro', v: diag.texto, ok: false as const }] : []),
  ];

  const trocarAba = (a: Aba) => { setAba(a); window.scrollTo(0, 0); };
  const itens: [Aba, string, typeof House][] = [['home', 'Início', House], ['hist', 'Histórico', ChartColumn], ['contas', 'Contas', ReceiptText], ['set', 'Ajustes', SlidersHorizontal]];

  return (
    <>
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 'calc(env(safe-area-inset-top) + 24px) 18px 112px', display: 'grid', gap: aba === 'set' ? 12 : 14, alignContent: 'start' }}>
        {aba === 'home' && (
          <Inicio
            d={dados}
            conn={conn}
            device={aparelho}
            lidoEm={lido}
            draft={draft}
            cmd={cmd}
            modo={modo}
            desligaAs={desligaAs}
            erroUso={erroUso}
            onRetryUso={lerUso}
            onModo={aoAlternarModo}
            onRetryConn={() => { setConn('loading'); lerEstado(); }}
            onPower={aoLigar}
            onTemp={aoTemperatura}
            onMode={aoModo}
            onTimer={aoTimer}
            onIrContas={() => trocarAba('contas')}
          />
        )}
        {aba === 'hist' && <Historico d={dados} />}
        {aba === 'contas' && <Contas cfg={cfg} setCfg={setCfg} dias={dias} hoje={hoje} diaLeitura={diaLeitura} semArDia={semArDia} contas={contasTodas} salvas={contas} setContas={setContas} />}
        {aba === 'set' && (
          <Ajustes
            d={dados}
            setCfg={setCfg}
            nomeLg={aparelho?.name ?? ''}
            nDias={dias.length}
            pinConfigurado={pin.configurado}
            conectado={conectado}
            onExport={exportar}
            onApagar={() => setFolha('apagar')}
            onDiag={() => setFolha('diag')}
            onIntro={() => setIntroAberta(true)}
            onToast={mostrar}
          />
        )}
      </main>

      <nav aria-label="Navegação" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20, background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '8px 0 calc(10px + env(safe-area-inset-bottom))' }}>
          {itens.map(([k, rotulo, Icone]) => (
            <button key={k} onClick={() => trocarAba(k)} aria-current={aba === k ? 'page' : undefined} style={{ display: 'grid', justifyItems: 'center', gap: 4, minHeight: 56, color: aba === k ? 'var(--ink)' : 'var(--muted)' }}>
              <span style={{ width: 58, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: aba === k ? 'var(--accent-soft)' : 'transparent' }}><Icone size={22} /></span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{rotulo}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div role="status" style={{ position: 'fixed', left: 18, right: 18, bottom: 104, zIndex: 60, maxWidth: 444, margin: '0 auto', padding: '14px 16px', borderRadius: 16, background: 'var(--ink)', color: 'var(--bg)', fontSize: 14, fontWeight: 700, boxShadow: '0 10px 30px -8px rgba(0,0,0,.4)' }}>{toast}</div>
      )}

      {(introAberta || (introPronta && !introVista)) && <Introducao onFechar={() => { setIntroVista(true); setIntroAberta(false); }} />}
      {pinAberto && <Pin acao={pendente?.label ?? null} onFechar={() => { setPinAberto(false); setPendente(null); }} onConferir={conferirPin} />}
      {folha === 'diag' && <SheetDiag linhas={linhasDiag} testando={diag.testando} onTestar={testar} onFechar={() => setFolha(null)} />}
      {folha === 'apagar' && <SheetApagar desde={dias[0] ? `${dl(parseYmd(dias[0].data))} de ${parseYmd(dias[0].data).getFullYear()}` : ''} onApagar={apagar} onFechar={() => setFolha(null)} />}
    </>
  );
}
