'use client';

import { Download, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Config } from '@/lib/cliente';
import { MONTHS, brl, brl0, dl, nf, parseNum, parseYmd, ymd } from '@/lib/fmt';
import { calcularConta, type Dia } from '@/lib/stats';
import { useState } from 'react';
import { Seg, Switch, card, rotulo } from './ui';

type Props = {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  tarifa: number;
  desde: string;
  dias: Dia[];
  hoje: Date;
  nomeLg: string;
  nDias: number;
  pinConfigurado: boolean;
  conectado: boolean;
  onExport: () => void;
  onApagar: () => void;
  onDiag: () => void;
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={{ ...rotulo, paddingLeft: 4 }}>{titulo}</div>
      <div style={card(22, '4px 16px')}>{children}</div>
    </section>
  );
}

function Linha({ children, ultimo }: { children: ReactNode; ultimo?: boolean }) {
  return <div style={{ minHeight: 62, padding: '10px 0', borderBottom: ultimo ? 'none' : '1px solid var(--line)', display: 'grid', gap: 6, alignContent: 'center' }}>{children}</div>;
}

export default function Ajustes({ cfg, setCfg, tarifa, desde, dias, hoje, nomeLg, nDias, pinConfigurado, conectado, onExport, onApagar, onDiag }: Props) {
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const tarifaTxt = (k: 'tariff', v: string) => setCfg((c) => ({ ...c, [k]: v, tariffMode: 'direto', tarifaDefinida: true }));
  const setConta = (k: 'valor' | 'kwh' | 'fixas' | 'mes', v: string) => setCfg((c) => ({ ...c, conta: { ...c.conta, [k]: v } }));
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);

  // mês da conta: o que o usuário escolheu ou, por padrão, o mês passado
  const mesPadrao = ymd(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)).slice(0, 7);
  const mesConta = cfg.conta.mes || mesPadrao;
  const mesNum = Number(mesConta.slice(5, 7)) - 1;
  const numeros = { valor: parseNum(cfg.conta.valor), kwh: parseNum(cfg.conta.kwh), fixas: parseNum(cfg.conta.fixas), mes: mesConta };
  const resultado = calcularConta(numeros, dias, hoje);

  const calcular = () => {
    if (!resultado) {
      setAviso({ erro: true, texto: 'Preencha o valor total e os kWh da conta (o valor tem que ser maior que as taxas fixas).' });
      return;
    }
    const t = resultado.tarifa;
    const meta = resultado.custoMesCheio;
    setCfg((c) => ({
      ...c,
      tariffMode: 'direto',
      tariff: nf(t, 4),
      tarifaDefinida: true,
      tarifas: { ...c.tarifas, [mesConta]: t },
      since: resultado.desde,
      base: '0',
      ...(meta != null ? { goalType: 'R$' as const, goal: nf(Math.ceil(meta / 5) * 5, 0) } : {}),
      conta: { ...c.conta, mes: mesConta },
    }));
    setAviso({
      erro: false,
      texto: `Preenchi: tarifa ${brl(t)}/kWh, acumulado desde ${dl(parseYmd(resultado.desde))}${meta != null ? `, meta mensal ${brl0(Math.ceil(meta / 5) * 5)} (o que o ar custou em ${MONTHS[mesNum]})` : ' (a meta não mudou: faltam dados daquele mês)'}.`,
    });
  };

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Ajustes</h1>

      <Secao titulo="Sua conta de luz">
        <Linha>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
            Digite o que está na sua conta e toque em <b>Calcular e preencher</b>. O app descobre sozinho a tarifa, a meta e a data de início do acumulado, e mostra quanto da conta foi do ar-condicionado.
          </div>
        </Linha>
        <Linha>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Valor total da conta (R$)
            <input className="input" inputMode="decimal" placeholder="ex.: 480,00" value={cfg.conta.valor} onChange={(e) => setConta('valor', e.target.value)} />
          </label>
        </Linha>
        <Linha>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Consumo da conta (kWh)
            <input className="input" inputMode="decimal" placeholder="ex.: 400" value={cfg.conta.kwh} onChange={(e) => setConta('kwh', e.target.value)} />
          </label>
        </Linha>
        <Linha>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Iluminação pública e outras taxas fixas (R$, opcional)
            <input className="input" inputMode="decimal" value={cfg.conta.fixas} onChange={(e) => setConta('fixas', e.target.value)} />
          </label>
        </Linha>
        <Linha>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Mês da conta
            <input className="input" type="month" value={mesConta} onChange={(e) => e.target.value && setConta('mes', e.target.value)} />
          </label>
        </Linha>
        <Linha ultimo>
          <button onClick={calcular} className="press" style={{ height: 50, borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 800 }}>Calcular e preencher</button>
          {aviso && <div style={{ fontSize: 13, fontWeight: 700, color: aviso.erro ? 'var(--red)' : 'var(--green)', lineHeight: 1.4 }}>{aviso.texto}</div>}
          {resultado && (
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--accent-soft)', fontSize: 14, fontWeight: 700, lineHeight: 1.45 }}>
              {resultado.cobertura >= 0.95 ? (
                <>O ar foi <b>{nf(resultado.share * 100, 0)}%</b> da sua conta de {MONTHS[mesNum]}, cerca de <b>{brl(resultado.custoAr)}</b> ({nf(resultado.kwhAr, 0)} kWh).</>
              ) : resultado.shareMesCheio != null && resultado.custoMesCheio != null ? (
                <>Tenho {resultado.diasComDado} de {resultado.diasDoMes} dias de {MONTHS[mesNum]}. Nesses dias o ar gastou {nf(resultado.kwhAr, 0)} kWh ({brl(resultado.custoAr)}). Estimando o mês inteiro, o ar deve ter sido cerca de <b>{nf(resultado.shareMesCheio * 100, 0)}%</b> da conta, <b>{brl(resultado.custoMesCheio)}</b>.</>
              ) : (
                <>Tenho só {resultado.diasComDado} de {resultado.diasDoMes} dias de {MONTHS[mesNum]}, pouco para dizer quanto da conta foi do ar. Com um mês completo registrado, esse cálculo fica certo.</>
              )}
            </div>
          )}
        </Linha>
      </Secao>

      <Secao titulo="Tarifa">
        <Linha ultimo>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800 }}>R$</span>
            <input className="input" inputMode="decimal" aria-label="Tarifa em reais por kWh" value={cfg.tariff} onChange={(e) => tarifaTxt('tariff', e.target.value)} />
            <span style={{ fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>/kWh</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
            Preço de 1 kWh. É preenchido pela conta de luz; você também pode digitar à mão.
            {!cfg.tarifaDefinida && ' O valor atual é provisório.'}
          </div>
        </Linha>
      </Secao>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6, paddingLeft: 4 }}>Cada mês guarda a tarifa que valia nele: mudar o valor não altera o custo dos meses passados.</div>

      <Secao titulo="Acumulado">
        <Linha>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Base já gasta (kWh) — soma ao acumulado
            <input className="input" inputMode="decimal" value={cfg.base} onChange={(e) => set('base', e.target.value)} />
          </label>
        </Linha>
        <Linha ultimo>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Acumular desde
            <input className="input" type="date" value={cfg.since || desde} onChange={(e) => e.target.value && set('since', e.target.value)} />
          </label>
        </Linha>
      </Secao>

      <Secao titulo="Meta mensal">
        <Linha>
          <Seg opts={[['R$', 'R$'], ['kWh', 'kWh']]} cur={cfg.goalType} onSel={(k) => set('goalType', k)} />
        </Linha>
        <Linha>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input className="input" inputMode="decimal" aria-label="Meta mensal" value={cfg.goalType === 'R$' ? cfg.goal : cfg.goalKwh} onChange={(e) => set(cfg.goalType === 'R$' ? 'goal' : 'goalKwh', e.target.value)} />
            <span style={{ fontWeight: 800 }}>{cfg.goalType}</span>
          </div>
        </Linha>
        <Linha>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>Avisar ao passar de 80% <Switch on={cfg.alert80} onClick={() => set('alert80', !cfg.alert80)} label="Avisar ao passar de 80%" /></div>
        </Linha>
        <Linha ultimo>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>Avisar ao passar de 100% <Switch on={cfg.alert100} onClick={() => set('alert100', !cfg.alert100)} label="Avisar ao passar de 100%" /></div>
        </Linha>
      </Secao>

      <Secao titulo="Aparelho e acesso">
        <Linha>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Nome do aparelho
            <input className="input" placeholder={nomeLg || 'Ar-condicionado'} value={cfg.nome} onChange={(e) => set('nome', e.target.value)} />
          </label>
        </Linha>
        <Linha>
          <div style={{ fontWeight: 800 }}>PIN de acesso</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
            {pinConfigurado ? 'Definido no servidor (variável APP_PIN). Para trocar, altere o valor na hospedagem.' : 'Não configurado: os controles ficam desativados. Defina APP_PIN (6 dígitos) na hospedagem.'}
          </div>
        </Linha>
        <Linha ultimo>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Tema</div>
          <Seg opts={[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']]} cur={cfg.theme} onSel={(k) => set('theme', k)} />
        </Linha>
      </Secao>

      <Secao titulo="Dados">
        <Linha>
          <button onClick={onExport} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%' }}>
            <Download size={20} />
            <span><div style={{ fontWeight: 800 }}>Exportar CSV</div><div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{nDias} dias · data, kWh, R$</div></span>
          </button>
        </Linha>
        <Linha ultimo>
          <button onClick={onApagar} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)', fontWeight: 800, width: '100%' }}>
            <Trash2 size={20} /> Apagar histórico local
          </button>
        </Linha>
      </Secao>

      <button onClick={onDiag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: conectado ? 'var(--green)' : 'var(--red)' }} />
        Conexão com a LG · {conectado ? 'conectado' : 'com erro'}
      </button>
    </>
  );
}
