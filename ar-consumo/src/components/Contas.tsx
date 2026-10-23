'use client';

import { ChevronRight, CircleAlert, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Config } from '@/lib/cliente';
import { CONTAS_INICIAIS } from '@/lib/contas-iniciais';
import { MONTHS, brl, brl0, cap, dl, nf, parseNum, parseYmd, ymd } from '@/lib/fmt';
import { cicloAnterior, cicloDe, cicloPorRef, contaAtual, diasDoPeriodo, diasEntre, fatiaDaConta, soma, type ContaSalva, type Dia } from '@/lib/stats';
import { analisarConta, type AnaliseConta, type TipoConta } from '@/lib/conta-analise';
import { Ajuda, Selo } from './selos';
import { ContaInteira, PrevistoReal } from './previsaoUi';
import type { Dados } from './tipos';
import { Folha } from './Sheets';
import { Switch, card, rotulo } from './ui';

type Props = {
  d: Dados;
  setCfg: (f: (c: Config) => Config) => void;
  salvas: Record<string, ContaSalva>; // só as que o usuário salvou (d.contas traz também as fixas do app)
  setContas: (f: (c: Record<string, ContaSalva>) => Record<string, ContaSalva>) => void;
  onIrCalibracao: () => void;
};

/** Props do formulário (janela de adicionar conta). */
type PropsForm = {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  dias: Dia[];
  hoje: Date;
  diaLeitura: number;
  semArDia: number;
  contas: Record<string, ContaSalva>;
  salvas: Record<string, ContaSalva>;
  setContas: (f: (c: Record<string, ContaSalva>) => Record<string, ContaSalva>) => void;
};

const MON3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const nomeRef = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;
const mesNome = (ym: string) => cap(MONTHS[Number(ym.slice(5, 7)) - 1]);
const venceEm = (fim: string) => MONTHS[Number(fim.slice(5, 7)) % 12];
const numTxt = (n: number) => (n ? String(n).replace('.', ',') : '');

type Analise = AnaliseConta;
const analisar = analisarConta;
type Tipo = TipoConta;

function Empilhada({ a, altura = 20, legenda = false }: { a: Analise; altura?: number; legenda?: boolean }) {
  const total = a.c.valor || 1;
  const ar = a.arR ?? 0;
  const resto = a.resto ?? Math.max(0, a.c.valor - a.c.fixas);
  const seg = [
    { l: 'Ar', v: ar, bg: a.tipo === 'lg' ? 'var(--accent)' : 'var(--bar)' },
    { l: 'Resto da casa', v: resto, bg: 'var(--slate)' },
    { l: 'Taxas fixas (iluminação pública)', v: a.c.fixas, bg: 'var(--fee)' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: altura, borderRadius: altura / 2, overflow: 'hidden' }} role="img" aria-label={`Ar ${brl0(ar)}, resto da casa ${brl0(resto)}, taxas ${brl0(a.c.fixas)}`}>
        {seg.map((x) => x.v > 0 && <span key={x.l} style={{ width: `${(x.v / total) * 100}%`, background: x.bg, ...(a.tipo !== 'lg' && x.l === 'Ar' ? { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 3px, rgba(255,255,255,.35) 3px 5px)' } : {}) }} />)}
      </div>
      {legenda && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {seg.map((x) => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: x.bg, flex: 'none' }} />
              <span style={{ flex: 1, color: 'var(--muted)' }}>{x.l}</span>
              <b>{brl(x.v)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const seloCalculo = (t: Tipo) =>
  t === 'lg' ? <Selo tipo="real" texto="Ar pela LG" /> : t === 'diferenca' ? <Selo tipo="diferenca" texto="≈ Estimada pela diferença" /> : t === 'estimativa' ? <Selo tipo="estimativa" /> : t === 'antes' ? <Selo tipo="neutro" texto="Antes do ar" /> : t === 'incompleta' ? <Selo tipo="erro" texto="Incompleta" /> : <Selo tipo="neutro" texto="Sem dados do ar" />;

export default function Contas({ d, setCfg, salvas, setContas, onIrCalibracao }: Props) {
  const { cfg, dias, hoje, diaLeitura, semArDia, contas } = d;
  const [sel, setSel] = useState<string | null>(null);
  const [folha, setFolha] = useState<{ editando: string | null } | null>(null);

  const lista = Object.values(contas)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((c) => analisar(c, dias, semArDia));
  const recentes = [...lista].reverse();
  const ativa = lista.find((x) => x.c.mes === sel) ?? lista[lista.length - 1];
  const proxima = cicloDe(hoje, diaLeitura);

  return (
    <>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Contas de luz</h1>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Quanto de cada conta foi do ar.</div>
      </header>

      {/* próxima conta: previsão da conta de luz inteira */}
      <section style={{ ...card(26, '18px 20px'), display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Próxima conta · {nomeRef(proxima.ref)}</h2>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Leitura em {dl(parseYmd(proxima.fim))} · vence em {venceEm(proxima.fim)}</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>Conta de luz prevista</div>
          <ContaInteira p={d.contaPrev} destaque />
        </div>
        <button onClick={onIrCalibracao} className="press" style={{ minHeight: 48, borderRadius: 14, background: 'var(--surface2)', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 700, textAlign: 'left' }}>
          <span>Casa sem o ar: {nf(semArDia, 1)} kWh por dia · {d.cal.estado === 'calibrado' ? 'Calibrado' : d.cal.estado === 'calibrando' ? 'Calibrando' : d.cal.estado === 'manual' ? 'Manual' : 'Poucos dados'}</span>
          <ChevronRight size={18} />
        </button>
      </section>

      {/* chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }} role="tablist" aria-label="Contas">
        {lista.map((x) => {
          const a = ativa?.c.mes === x.c.mes;
          return (
            <button key={x.c.mes} role="tab" aria-selected={a} onClick={() => setSel(x.c.mes)} className="press" style={{ flex: 'none', height: 44, padding: '0 16px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: a ? 'var(--ink)' : 'var(--surface)', color: a ? 'var(--bg)' : 'var(--ink)', border: '1px solid var(--line)' }}>
              {MON3[Number(x.c.mes.slice(5, 7)) - 1]} · {x.c.mes.slice(5)}
            </button>
          );
        })}
      </div>

      {/* resposta em destaque */}
      {ativa && (
        <section style={{ ...card(26, '20px 20px 18px'), display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Conta {nomeRef(ativa.c.mes)}</h2>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Cobre {dl(parseYmd(ativa.inicio))} a {dl(parseYmd(ativa.fim))} · vence em {venceEm(ativa.fim)}</div>
          </div>
          <Ajuda>A fatia do ar é quanto do consumo da conta foi do Gelinho. Quando a LG tem os dados do período, usamos eles. Quando não tem, estimamos: consumo da conta menos o que a casa gasta sem o ar (cerca de {nf(semArDia, 1)} kWh por dia).</Ajuda>

          <div style={{ flexBasis: '100%', display: 'grid', gap: 14 }}>
            {ativa.tipo === 'incompleta' ? (
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 18, background: 'var(--red-soft)' }}>
                <CircleAlert size={22} color="var(--red)" style={{ flex: 'none' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Falta o consumo desta conta</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', margin: '2px 0 8px' }}>Sem o total em kWh, não dá para saber quanto da conta foi do ar.</div>
                  <button onClick={() => setFolha({ editando: ativa.c.mes })} className="press" style={{ height: 44, padding: '0 16px', borderRadius: 14, background: 'var(--surface)', color: 'var(--red)', fontSize: 14, fontWeight: 800 }}>Completar conta</button>
                </div>
              </div>
            ) : ativa.tipo === 'antes' ? (
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>Nesta conta o ar ainda não existia</div>
                <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
                  A casa gastou {nf(ativa.c.kwh, 0)} kWh em {ativa.nDias} dias, ou {nf(ativa.c.kwh / ativa.nDias, 1)} kWh por dia, sem ar-condicionado. Contas assim servem de base para estimar as outras.
                </p>
              </div>
            ) : ativa.f.share != null && ativa.arR != null ? (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>{ativa.tipo === 'diferenca' ? 'Estimamos que o ar foi cerca de' : 'O ar foi'}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05 }}>{nf(ativa.f.share * 100, 0)}%</span>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>da sua conta</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>cerca de {brl0(ativa.arR)} de {brl(ativa.c.valor)}</div>
                <div style={{ marginTop: 8 }}>{seloCalculo(ativa.tipo)}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Sem dados do ar neste período</div>
                <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Preencha o consumo da casa sem o ar nos Ajustes para estimar pela diferença.</p>
              </div>
            )}

            {ativa.tipo !== 'incompleta' && ativa.tipo !== 'antes' && ativa.arR != null && <Empilhada a={ativa} legenda />}

            {ativa.tipo === 'diferenca' && ativa.f.kwhDiferenca != null && (
              <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--amber-soft)', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>
                <b style={{ color: 'var(--amber)' }}>≈ </b>A LG ainda não tinha dados deste período. Conta: consumo da conta ({nf(ativa.c.kwh, 0)} kWh) menos o da casa sem o ar ({nf(semArDia, 1)} kWh × {ativa.nDias} dias = {nf(semArDia * ativa.nDias, 0)} kWh).
              </div>
            )}
            {ativa.tipo === 'estimativa' && (
              <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--surface2)', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>
                O app tinha {ativa.c.diasComDado} de {ativa.nDias} dias deste período e estimou o resto no mesmo ritmo.
                {ativa.f.kwhDiferenca != null && <> Pela diferença com a casa sem o ar, o ar teria gastado ≈ {nf(ativa.f.kwhDiferenca, 0)} kWh, contra ≈ {nf(ativa.f.kwhMes ?? 0, 0)} kWh pela LG.</>}
              </div>
            )}
            {ativa.tipo === 'lg' && ativa.f.kwhDiferenca != null && ativa.f.kwhMes != null && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
                Conferindo: pela diferença com a casa sem o ar, o ar teria gastado ≈ {nf(ativa.f.kwhDiferenca, 0)} kWh. A LG informa ≈ {nf(ativa.f.kwhMes, 0)} kWh.
              </div>
            )}

            {ativa.tipo !== 'antes' && ativa.tipo !== 'incompleta' && (() => {
              const comp = d.comps.find((c) => c.ref === ativa.c.mes) ?? null;
              const maisRecente = ativa.c.mes === lista[lista.length - 1]?.c.mes;
              if (!comp && !maisRecente) return null;
              return <PrevistoReal comp={comp} primeira={d.comps[0]?.ref === ativa.c.mes} />;
            })()}
          </div>
        </section>
      )}

      {/* comparativo conta a conta */}
      {lista.length > 1 && (
        <section style={{ ...card(26, '18px 16px 14px'), display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Conta a conta</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
            {lista.slice(-6).map((x) => {
              const max = Math.max(...lista.slice(-6).map((y) => y.c.valor), 1);
              const alt = (x.c.valor / max) * 100;
              const ar = x.arR ?? 0;
              const resto = x.resto ?? Math.max(0, x.c.valor - x.c.fixas);
              const a = ativa?.c.mes === x.c.mes;
              return (
                <button key={x.c.mes} onClick={() => setSel(x.c.mes)} aria-label={`Conta ${nomeRef(x.c.mes)}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>{x.tipo === 'antes' ? '—' : x.f.share != null ? `${nf(x.f.share * 100, 0)}%` : '?'}</span>
                  <span style={{ width: '100%', height: `${Math.max(8, alt * 0.75)}%`, display: 'flex', flexDirection: 'column', borderRadius: 6, overflow: 'hidden', gap: 1, outline: a ? '2px solid var(--ink)' : 'none', outlineOffset: 2 }}>
                    <span style={{ flex: x.c.fixas, background: 'var(--fee)' }} />
                    <span style={{ flex: resto, background: 'var(--slate)' }} />
                    {ar > 0 && <span style={{ flex: ar, background: x.tipo === 'lg' ? 'var(--accent)' : 'var(--bar)' }} />}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: a ? 'var(--ink)' : 'var(--muted)' }}>{MON3[Number(x.c.mes.slice(5, 7)) - 1]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>Azul: ar (claro = estimado) · cinza: resto da casa · claro embaixo: taxas fixas. O número no topo é a fatia do ar.</div>
        </section>
      )}

      {/* suas contas */}
      <div style={{ ...rotulo, paddingLeft: 4 }}>Suas contas</div>
      {recentes.map((x) => (
        <button key={x.c.mes} onClick={() => { setSel(x.c.mes); window.scrollTo(0, 0); }} className="press" style={{ ...card(22, '14px 16px'), textAlign: 'left', display: 'grid', gap: 8, outline: ativa?.c.mes === x.c.mes ? '2px solid var(--ink)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Conta {nomeRef(x.c.mes)}</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{brl(x.c.valor)}</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
            {dl(parseYmd(x.inicio))} a {dl(parseYmd(x.fim))} · {x.c.kwh > 0 ? `${nf(x.c.kwh, 0)} kWh` : 'sem kWh'}
            {x.f.share != null && x.tipo !== 'antes' && <> · ar {nf(x.f.share * 100, 0)}% (≈ {brl0(x.arR ?? 0)})</>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {salvas[x.c.mes] ? <Selo tipo="neutro" texto="Salva por você" /> : <Selo tipo="neutro" texto="Fixa do app" />}
            {seloCalculo(x.tipo)}
          </div>
        </button>
      ))}

      <button onClick={() => setFolha({ editando: null })} className="press" style={{ height: 54, borderRadius: 18, background: 'var(--ink)', color: 'var(--bg)', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Plus size={20} /> Adicionar ou corrigir conta
      </button>

      {folha && (
        <FormularioConta
          editando={folha.editando ? contas[folha.editando] ?? null : null}
          cfg={cfg}
          setCfg={setCfg}
          dias={dias}
          hoje={hoje}
          diaLeitura={diaLeitura}
          semArDia={semArDia}
          contas={contas}
          salvas={salvas}
          setContas={setContas}
          onFechar={() => setFolha(null)}
          onSalvou={(mes) => { setSel(mes); setFolha(null); window.scrollTo(0, 0); }}
        />
      )}
    </>
  );
}

function Campo({ rot, dica, children }: { rot: string; dica?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 15, fontWeight: 700 }}>
      {rot}
      {children}
      {dica && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>{dica}</span>}
    </label>
  );
}

function FormularioConta({ editando, cfg, setCfg, dias, hoje, diaLeitura, semArDia, contas, salvas, setContas, onFechar, onSalvou }: PropsForm & {
  editando: ContaSalva | null;
  onFechar: () => void;
  onSalvou: (mes: string) => void;
}) {
  const padrao = cicloAnterior(cicloDe(hoje, diaLeitura), diaLeitura).ref;
  const [mes, setMes] = useState(editando?.mes ?? padrao);
  const auto = cicloPorRef(mes, diaLeitura);
  const carregar = (m: string) => contas[m];
  const [valor, setValor] = useState(numTxt(carregar(mes)?.valor ?? 0));
  const [kwh, setKwh] = useState(numTxt(carregar(mes)?.kwh ?? 0));
  const [fixas, setFixas] = useState(numTxt(carregar(mes)?.fixas ?? 0));
  const [inicio, setInicio] = useState(carregar(mes)?.inicio ?? '');
  const [fim, setFim] = useState(carregar(mes)?.fim ?? '');
  const [erro, setErro] = useState('');
  const [apagando, setApagando] = useState(false);
  const refs = Object.keys(contas);
  const ehMaisRecente = refs.every((r) => mes >= r);
  const [atualizar, setAtualizar] = useState(ehMaisRecente);
  useEffect(() => { setAtualizar(refs.every((r) => mes >= r)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mes]);

  const ini = inicio || auto.inicio;
  const f = fim || auto.fim;
  const periodoOk = f > ini;
  const total = parseNum(valor);
  const consumo = parseNum(kwh);
  const taxas = parseNum(fixas);

  const opcoes: string[] = [];
  const base = cicloDe(hoje, diaLeitura).ref;
  for (let i = 0; i < 24; i++) {
    const d = new Date(Number(base.slice(0, 4)), Number(base.slice(5)) - 1 - i, 1);
    opcoes.push(ymd(d).slice(0, 7));
  }
  if (!opcoes.includes(mes)) opcoes.push(mes);

  // pré-visualização: monta a conta com o que está digitado e usa o mesmo cálculo da lista
  const dm = periodoOk ? diasDoPeriodo(dias, ini, f) : [];
  const rascunho: ContaSalva = { mes, valor: total, kwh: consumo, fixas: taxas, kwhAr: soma(dm), diasComDado: dm.length, diasDoMes: periodoOk ? diasEntre(ini, f) : 0, inicio: ini, fim: f, salvoEm: Date.now() };
  const prev = total > 0 ? fatiaDaConta(rascunho, semArDia) : null;

  const salvar = () => {
    if (!(total > 0)) return setErro('Preencha o total a pagar.');
    if (!periodoOk) return setErro('A leitura atual precisa ser depois da leitura anterior.');
    if (taxas >= total) return setErro('As taxas fixas não podem ser maiores que o total.');
    setContas((c) => ({ ...c, [mes]: rascunho }));
    const tarifa = consumo > 0 ? (total - taxas) / consumo : null;
    const mesAtualCal = ymd(hoje).slice(0, 7);
    if (atualizar && tarifa != null) {
      const arR = prev?.custoAr != null && !prev.antesDoAr ? prev.custoAr : null;
      setCfg((c) => ({
        ...c,
        tariffMode: 'direto',
        tariff: nf(tarifa, 4),
        tarifaDefinida: true,
        tarifas: { ...c.tarifas, [mes]: tarifa },
        since: f > ymd(hoje) ? ini : f,
        base: '0',
        ...(arR != null ? { goalType: 'R$' as const, goal: nf(Math.ceil(arR / 5) * 5, 0) } : {}),
      }));
    } else if (tarifa != null && mes !== mesAtualCal) {
      setCfg((c) => ({ ...c, tarifas: { ...c.tarifas, [mes]: tarifa } }));
    }
    onSalvou(mes);
  };

  const apagar = () => {
    setContas((c) => { const n = { ...c }; delete n[mes]; return n; });
    onSalvou(CONTAS_INICIAIS[mes] ? mes : (Object.keys(contas).filter((r) => r !== mes).sort().pop() ?? mes));
  };

  const existe = Boolean(contas[mes]);

  return (
    <Folha onFechar={onFechar}>
      <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>Adicionar ou corrigir conta</h2>
      <div style={{ display: 'grid', gap: 14 }}>
        <Campo rot="Mês da conta" dica='Na conta aparece como "Referência".'>
          <select className="input" value={mes} onChange={(e) => { const m = e.target.value; const c = carregar(m); setMes(m); setValor(numTxt(c?.valor ?? 0)); setKwh(numTxt(c?.kwh ?? 0)); setFixas(numTxt(c?.fixas ?? 0)); setInicio(c?.inicio ?? ''); setFim(c?.fim ?? ''); setErro(''); }}>
            {opcoes.map((o) => <option key={o} value={o}>{mesNome(o)} {o.slice(0, 4)}</option>)}
          </select>
        </Campo>
        {existe && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', marginTop: -6 }}>Corrigindo a conta de {MONTHS[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}: ao salvar, os números abaixo substituem os atuais.</div>}
        <Campo rot="Total a pagar (R$)" dica="O valor em destaque no topo da conta.">
          <input className="input" inputMode="decimal" placeholder="ex.: 367,89" value={valor} onChange={(e) => { setValor(e.target.value); setErro(''); }} />
        </Campo>
        <Campo rot="Consumo (kWh)" dica='No quadro de leitura do medidor, linha "Consumo kWh". Se não tiver, deixe em branco.'>
          <input className="input" inputMode="decimal" placeholder="ex.: 286" value={kwh} onChange={(e) => setKwh(e.target.value)} />
        </Campo>
        <Campo rot="Iluminação pública (R$)" dica='Em "Outros lançamentos", às vezes como "CIP" ou "COSIP". Se houver créditos (como o da Itaipu), desconte aqui.'>
          <input className="input" inputMode="decimal" placeholder="ex.: 26,30" value={fixas} onChange={(e) => { setFixas(e.target.value); setErro(''); }} />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rot="Leitura anterior">
            <input className="input" type="date" value={ini} onChange={(e) => e.target.value && setInicio(e.target.value)} />
          </Campo>
          <Campo rot="Leitura atual">
            <input className="input" type="date" value={f} onChange={(e) => e.target.value && setFim(e.target.value)} />
          </Campo>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4, marginTop: -6 }}>
          {periodoOk ? `${diasEntre(ini, f)} dias, preenchidos pelo dia da leitura (${diaLeitura}). Se a sua conta tiver outras datas, corrija aqui.` : 'A leitura atual precisa ser depois da anterior.'}
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--accent-soft)', fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
          {prev == null
            ? 'Preencha o total para ver quanto da conta foi do ar.'
            : prev.antesDoAr
              ? 'Essa conta é de antes do ar: serve de base para as outras.'
              : prev.incompleta
                ? 'Sem o consumo (kWh), não dá para calcular a fatia do ar. A conta fica salva como incompleta.'
                : prev.share != null && prev.custoAr != null
                  ? `Com esses números, o ar foi ${nf(prev.share * 100, 0)}% desta conta (${brl0(prev.custoAr)}).${prev.porDiferenca ? ' Estimado pela diferença com a casa sem o ar.' : ''}`
                  : 'Ainda não há dados do ar neste período.'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>Usar esta conta para atualizar o preço do kWh e a meta</span>
          <Switch on={atualizar} onClick={() => setAtualizar(!atualizar)} label="Atualizar preço do kWh e meta" />
        </div>

        {erro && <div role="alert" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--red)' }}>{erro}</div>}
        <button onClick={salvar} className="press" style={{ height: 52, borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 16, fontWeight: 800 }}>Salvar conta</button>
        {salvas[mes] && (
          apagando ? (
            <button onClick={apagar} style={{ minHeight: 44, fontSize: 14, fontWeight: 800, color: 'var(--red)' }}>Confirmar: {CONTAS_INICIAIS[mes] ? 'voltar ao valor original' : 'apagar esta conta'}</button>
          ) : (
            <button onClick={() => setApagando(true)} style={{ minHeight: 44, fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{CONTAS_INICIAIS[mes] ? 'Voltar ao valor original do app' : 'Apagar esta conta'}</button>
          )
        )}
      </div>
    </Folha>
  );
}
