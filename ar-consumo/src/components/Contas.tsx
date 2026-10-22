'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Config } from '@/lib/cliente';
import { MON, MONTHS, brl, brl0, cap, dl, nf, parseNum, parseYmd, ymd } from '@/lib/fmt';
import { calcularConta, cicloAnterior, cicloDe, cicloPorRef, contaAtual, diasEntre, fatiaDaConta, type ContaSalva, type Dia } from '@/lib/stats';
import { card, rotulo } from './ui';

type Props = {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  dias: Dia[];
  hoje: Date;
  diaLeitura: number;
  semArDia: number;
  contas: Record<string, ContaSalva>; // contas que já vêm no app + as salvas
  salvas: Record<string, ContaSalva>; // só as que o usuário salvou
  setContas: (f: (c: Record<string, ContaSalva>) => Record<string, ContaSalva>) => void;
};

const rot = { fontSize: 13, fontWeight: 700, color: 'var(--muted)' } as const;
const nomeMes = (ym: string) => cap(MONTHS[Number(ym.slice(5, 7)) - 1]);
const numTxt = (n: number) => String(n).replace('.', ',');

export default function Contas({ cfg, setCfg, dias, hoje, diaLeitura, semArDia, contas, salvas, setContas }: Props) {
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  const setConta = (k: 'valor' | 'kwh' | 'fixas' | 'mes' | 'inicio' | 'fim', v: string) => {
    setAviso(null);
    // ao trocar o mês da conta, as datas voltam a ser calculadas pelo dia da leitura
    setCfg((c) => ({ ...c, conta: { ...c.conta, [k]: v, ...(k === 'mes' ? { inicio: '', fim: '' } : {}) } }));
  };

  // a última conta recebida é a do ciclo que acabou de fechar
  const mesPadrao = cicloAnterior(cicloDe(hoje, diaLeitura), diaLeitura).ref;
  const mesConta = cfg.conta.mes || mesPadrao;
  const auto = cicloPorRef(mesConta, diaLeitura);
  const inicio = cfg.conta.inicio || auto.inicio;
  const fim = cfg.conta.fim || auto.fim;
  const periodoInvalido = fim <= inicio;
  const numeros = { valor: parseNum(cfg.conta.valor), kwh: parseNum(cfg.conta.kwh), fixas: parseNum(cfg.conta.fixas), mes: mesConta, inicio, fim };
  const rotuloPeriodo = periodoInvalido ? null : `${dl(parseYmd(inicio))} a ${dl(parseYmd(fim))}`;
  const r = calcularConta(numeros, dias, hoje);
  const jaSalva = Boolean(contas[mesConta]);

  const salvar = (preencher: boolean) => {
    if (!r) {
      setAviso({ erro: true, texto: periodoInvalido ? 'A leitura atual precisa ser depois da leitura anterior.' : 'Preencha o valor total e os kWh da conta (o valor tem que ser maior que as taxas fixas).' });
      return;
    }
    const salva: ContaSalva = { mes: mesConta, valor: numeros.valor, kwh: numeros.kwh, fixas: numeros.fixas, kwhAr: r.kwhAr, diasComDado: r.diasComDado, diasDoMes: r.diasDoMes, inicio, fim, salvoEm: Date.now() };
    setContas((c) => ({ ...c, [mesConta]: salva }));
    // a tarifa daquele mês também fica guardada, para o custo dele no Histórico; o mês atual segue a tarifa dos Ajustes
    if (!preencher && mesConta !== ymd(hoje).slice(0, 7)) setCfg((c) => ({ ...c, tarifas: { ...c.tarifas, [mesConta]: r.tarifa } }));

    let texto = `Conta de ${MONTHS[Number(mesConta.slice(5, 7)) - 1]} ${jaSalva ? 'atualizada' : 'salva'}.`;
    if (preencher) {
      const meta = r.custoMesCheio;
      const metaArred = meta != null ? Math.ceil(meta / 5) * 5 : null;
      setCfg((c) => ({
        ...c,
        tariffMode: 'direto',
        tariff: nf(r.tarifa, 4),
        tarifaDefinida: true,
        tarifas: { ...c.tarifas, [mesConta]: r.tarifa },
        since: r.desde,
        base: '0',
        ...(metaArred != null ? { goalType: 'R$' as const, goal: nf(metaArred, 0) } : {}),
        conta: { ...c.conta, mes: mesConta },
      }));
      texto += ` Preenchi: tarifa ${brl(r.tarifa)}/kWh, acumulado desde ${dl(parseYmd(r.desde))}${metaArred != null ? `, meta mensal ${brl0(metaArred)}` : ' (a meta não mudou: faltam dados daquele mês)'}.`;
    }
    setAviso({ erro: false, texto });
  };

  // meses salvos, do mais antigo para o mais novo (para calcular a variação)
  const cronologica = Object.values(contas)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((c) => {
      const a = contaAtual(c, dias);
      return { c: a, f: fatiaDaConta(a, semArDia) };
    });
  const lista = cronologica.map((x, i) => ({ ...x, ant: i > 0 ? cronologica[i - 1].f : null })).reverse();
  const comShare = cronologica.filter((x) => x.f.share != null).slice(-12);
  const mxShare = Math.max(...comShare.map((x) => x.f.share ?? 0), 0.01);

  const editar = (c: ContaSalva) => {
    setAviso(null);
    setCfg((cf) => ({ ...cf, conta: { valor: numTxt(c.valor), kwh: numTxt(c.kwh), fixas: numTxt(c.fixas), mes: c.mes, inicio: c.inicio ?? '', fim: c.fim ?? '' } }));
    window.scrollTo(0, 0);
  };

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Contas de luz</h1>

      <section style={{ ...card(26, '18px 20px'), display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
          Digite o que está na conta de um mês. O app mostra quanto dela foi do ar-condicionado, e você pode salvar para comparar os meses depois.
        </div>
        <label style={rot}>Mês da conta
          <input className="input" type="month" value={mesConta} onChange={(e) => e.target.value && setConta('mes', e.target.value)} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={rot}>Leitura anterior
            <input className="input" type="date" value={inicio} onChange={(e) => e.target.value && setConta('inicio', e.target.value)} />
          </label>
          <label style={rot}>Leitura atual
            <input className="input" type="date" value={fim} onChange={(e) => e.target.value && setConta('fim', e.target.value)} />
          </label>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, marginTop: -6 }}>
          {periodoInvalido
            ? 'A leitura atual precisa ser depois da anterior.'
            : `Contando o ar em ${diasEntre(inicio, fim)} dias, de ${rotuloPeriodo}. As datas vêm do dia da leitura (dia ${diaLeitura}, em Ajustes); você pode mudar se a sua conta tiver outras.`}
        </div>
        <label style={rot}>Valor total da conta (R$)
          <input className="input" inputMode="decimal" placeholder="ex.: 480,00" value={cfg.conta.valor} onChange={(e) => setConta('valor', e.target.value)} />
        </label>
        <label style={rot}>Consumo da conta (kWh)
          <input className="input" inputMode="decimal" placeholder="ex.: 400" value={cfg.conta.kwh} onChange={(e) => setConta('kwh', e.target.value)} />
        </label>
        <label style={rot}>Iluminação pública e outras taxas fixas (R$, opcional)
          <input className="input" inputMode="decimal" value={cfg.conta.fixas} onChange={(e) => setConta('fixas', e.target.value)} />
        </label>

        {r && (
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--accent-soft)', fontSize: 14, fontWeight: 700, lineHeight: 1.45 }}>
            {r.cobertura >= 0.95 ? (
              <>O ar foi <b>{nf(r.share * 100, 0)}%</b> da conta de {MONTHS[Number(mesConta.slice(5, 7)) - 1]}, cerca de <b>{brl(r.custoAr)}</b> ({nf(r.kwhAr, 0)} kWh).</>
            ) : r.shareMesCheio != null && r.custoMesCheio != null ? (
              <>Tenho {r.diasComDado} de {r.diasDoMes} dias desse período. Estimando o período inteiro, o ar deve ter sido cerca de <b>{nf(r.shareMesCheio * 100, 0)}%</b> da conta, <b>{brl(r.custoMesCheio)}</b>.</>
            ) : (
              <>Tenho só {r.diasComDado} de {r.diasDoMes} dias desse período, pouco para dizer quanto da conta foi do ar. Você ainda pode salvar a conta.</>
            )}
          </div>
        )}

        <button onClick={() => salvar(false)} className="press" style={{ height: 50, borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 800 }}>
          {jaSalva ? 'Atualizar este mês' : 'Salvar este mês'}
        </button>
        <button onClick={() => salvar(true)} className="press" style={{ height: 50, borderRadius: 16, background: 'var(--surface2)', fontSize: 15, fontWeight: 800 }}>
          Salvar e preencher os ajustes
        </button>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          Salvar guarda a conta e a tarifa daquele mês, sem mexer nos ajustes. &quot;Preencher os ajustes&quot; também calcula a tarifa atual, a meta mensal e o início do acumulado a partir desta conta.
        </div>
        {aviso && <div style={{ fontSize: 13, fontWeight: 700, color: aviso.erro ? 'var(--red)' : 'var(--green)', lineHeight: 1.4 }}>{aviso.texto}</div>}
      </section>

      <div style={{ ...rotulo, paddingLeft: 4 }}>Meses salvos</div>

      {lista.length === 0 ? (
        <div style={{ ...card(22, '24px 20px'), fontSize: 14, fontWeight: 600, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.45 }}>
          Nenhuma conta salva ainda. Salve a conta de cada mês para ver a fatia do ar mudar ao longo do tempo.
        </div>
      ) : (
        <>
          {comShare.length >= 2 && (
            <section style={card(26, '18px 16px 14px')}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Fatia do ar na conta</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
                {comShare.map((x) => (
                  <div key={x.c.mes} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800 }}>{nf((x.f.share ?? 0) * 100, 0)}%</span>
                    <span style={{ width: '100%', height: `${Math.max(4, ((x.f.share ?? 0) / mxShare) * 70)}%`, background: x.f.estimada ? 'var(--bar)' : 'var(--accent)', borderRadius: '5px 5px 2px 2px' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{cap(MON[Number(x.c.mes.slice(5, 7)) - 1])}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>Barras claras são estimativas (o app não tinha o mês inteiro).</div>
            </section>
          )}

          {lista.map(({ c, f, ant }) => {
            const dpBruto = f.share != null && ant?.share != null ? (f.share - ant.share) * 100 : null;
            const dp = dpBruto != null && Math.abs(dpBruto) >= 0.05 ? dpBruto : null;
            return (
              <section key={c.mes} style={{ ...card(22, '14px 16px'), display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{nomeMes(c.mes)} {c.mes.slice(0, 4)}</div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => editar(c)} aria-label={`Editar ${nomeMes(c.mes)}`} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={18} /></button>
                    {!salvas[c.mes] ? (
                      <span style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11.5, fontWeight: 800, color: 'var(--muted)' }}>fixa</span>
                    ) : apagando === c.mes ? (
                      <button onClick={() => { setContas((cs) => { const n = { ...cs }; delete n[c.mes]; return n; }); setApagando(null); }} style={{ height: 44, padding: '0 10px', fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>Confirmar</button>
                    ) : (
                      <button onClick={() => setApagando(c.mes)} aria-label={`Apagar ${nomeMes(c.mes)}`} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}><Trash2 size={18} /></button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  {f.antesDoAr ? (
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>Antes do ar: a casa gastou isso sem ar-condicionado.</span>
                  ) : f.share != null && f.custoAr != null ? (
                    <>
                      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{nf(f.share * 100, 0)}%</span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>≈ {brl(f.custoAr)}</span>
                      {f.estimada && <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--amber)' }}>{f.porDiferenca ? 'estimado pela diferença' : 'estimativa'}</span>}
                    </>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Sem dados do ar suficientes nesse mês.</span>
                  )}
                </div>
                {!f.antesDoAr && !f.porDiferenca && f.kwhDiferenca != null && f.kwhMes != null && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                    Conferindo: pela diferença com a casa sem o ar (≈ {nf(semArDia, 1)} kWh por dia), o ar teria gastado ≈ {nf(f.kwhDiferenca, 0)} kWh. A LG informa ≈ {nf(f.kwhMes, 0)} kWh.
                  </div>
                )}
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {c.inicio && c.fim ? `Leitura ${dl(parseYmd(c.inicio))} a ${dl(parseYmd(c.fim))} · ` : ''}Conta {brl(c.valor)} · {nf(c.kwh, 0)} kWh · tarifa {brl(f.tarifa)}/kWh
                  {dp != null && <> · <b style={{ color: dp > 0 ? 'var(--amber)' : 'var(--green)' }}>{dp > 0 ? '+' : '−'}{nf(Math.abs(dp), 1)} pontos</b> na fatia do ar</>}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
