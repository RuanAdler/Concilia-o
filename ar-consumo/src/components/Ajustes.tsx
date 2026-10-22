'use client';

import { Download, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Config } from '@/lib/cliente';
import { brl } from '@/lib/fmt';
import { Seg, Switch, card, rotulo } from './ui';

type Props = {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  tarifa: number;
  desde: string;
  nomeLg: string;
  nDias: number;
  pinConfigurado: boolean;
  conectado: boolean;
  onExport: () => void;
  onApagar: () => void;
  onDiag: () => void;
  onIrContas: () => void;
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

export default function Ajustes({ cfg, setCfg, tarifa, desde, nomeLg, nDias, pinConfigurado, conectado, onExport, onApagar, onDiag, onIrContas }: Props) {
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const tarifaTxt = (k: 'tariff', v: string) => setCfg((c) => ({ ...c, [k]: v, tariffMode: 'direto', tarifaDefinida: true }));
  return (
    <>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Ajustes</h1>

      <button onClick={onIrContas} className="press" style={{ ...card(22, '14px 16px'), textAlign: 'left', display: 'grid', gap: 4 }}>
        <span style={{ fontWeight: 800 }}>Preencher pela conta de luz</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>Na aba Contas você digita a conta de um mês e o app calcula a tarifa, a meta e o acumulado sozinho.</span>
      </button>

      <Secao titulo="Ciclo da conta">
        <Linha ultimo>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Dia da leitura da conta
            <input className="input" inputMode="numeric" value={cfg.diaLeitura} onChange={(e) => set('diaLeitura', e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </label>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
            A distribuidora lê o medidor todo mês nesse dia (de 1 a 28). A meta, a projeção, o &quot;ciclo atual&quot; e o acumulado seguem de uma leitura à outra, como a conta.
          </div>
        </Linha>
      </Secao>

      <Secao titulo="Casa sem o ar">
        <Linha ultimo>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Consumo da casa sem o ar-condicionado (kWh por dia)
            <input className="input" inputMode="decimal" value={cfg.semAr} onChange={(e) => set('semAr', e.target.value)} />
          </label>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>
            Média de antes de o ar ser instalado (contas de junho e julho: cerca de 4,3). Serve para estimar a fatia do ar nos meses em que a LG não tem dados.
          </div>
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

      <Secao titulo="Meta por ciclo">
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
