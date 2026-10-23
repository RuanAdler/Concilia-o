'use client';

import { Download, Eye, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Config } from '@/lib/cliente';
import { brl, brl0, dl, nf, parseNum, parseYmd } from '@/lib/fmt';
import { margemDaFaixa } from '@/lib/previsao';
import { custoDe, periodosCiclo, tarifaDaUltimaConta } from '@/lib/stats';
import { Selo } from './selos';
import { Seg, Switch, card, rotulo } from './ui';
import type { Dados } from './tipos';

type Props = {
  d: Dados;
  setCfg: (f: (c: Config) => Config) => void;
  nomeLg: string;
  nDias: number;
  pinConfigurado: boolean;
  conectado: boolean;
  onExport: () => void;
  onApagar: () => void;
  onDiag: () => void;
  onIntro: () => void;
  onToast: (t: string) => void;
  backup: { rotulo: string; salvando: boolean; salvoNome: string | null };
  onSalvarBackup: () => void;
  onRestaurar: () => void;
};

function Secao({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} style={{ display: 'grid', gap: 8, scrollMarginTop: 16 }}>
      <div style={{ ...rotulo, paddingLeft: 4 }}>{titulo}</div>
      <div style={card(22, '4px 16px')}>{children}</div>
    </section>
  );
}

function Linha({ children, ultimo }: { children: ReactNode; ultimo?: boolean }) {
  return <div style={{ padding: '12px 0', borderBottom: ultimo ? 'none' : '1px solid var(--line)', display: 'grid', gap: 6 }}>{children}</div>;
}

const dica = { fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 } as const;

/** Rótulo + campo à direita + dica com exemplo e onde achar na conta. */
function Campo({ rot, unidade, valor, aoMudar, ajuda, tipo = 'decimal', botao }: { rot: string; unidade?: string; valor: string; aoMudar: (v: string) => void; ajuda: string; tipo?: 'decimal' | 'numeric' | 'date'; botao?: ReactNode }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{rot}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: tipo === 'date' ? 170 : 130 }}>
          <input className="input" style={{ height: 46, fontSize: 17, textAlign: tipo === 'date' ? 'left' : 'right' }} type={tipo === 'date' ? 'date' : 'text'} inputMode={tipo === 'date' ? undefined : tipo} aria-label={rot} value={valor} onChange={(e) => aoMudar(e.target.value)} />
          {unidade && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{unidade}</span>}
        </div>
      </div>
      <div style={dica}>{ajuda}</div>
      {botao}
    </>
  );
}

export default function Ajustes({ d, setCfg, nomeLg, nDias, pinConfigurado, conectado, onExport, onApagar, onDiag, onIntro, onToast, backup, onSalvarBackup, onRestaurar }: Props) {
  const { cfg, dias, hoje, tarifa, tarifas, diaLeitura, contas } = d;
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const per = periodosCiclo(dias, hoje, diaLeitura, d.desde, d.base);
  const acumR = custoDe(per.acum, tarifas, tarifa) + d.base * tarifa;

  const preco = (v: string) => setCfg((c) => ({ ...c, tariff: v, tariffMode: 'direto', tarifaDefinida: true }));
  const calcularPelaConta = () => {
    const r = tarifaDaUltimaConta(contas);
    if (!r) return onToast('Salve uma conta com o consumo em kWh para calcular o preço.');
    setCfg((c) => ({ ...c, tariff: nf(r.tarifa, 4), tariffMode: 'direto', tarifaDefinida: true, tarifas: { ...c.tarifas, [r.mes]: r.tarifa } }));
    onToast(`Preço do kWh: ${brl(r.tarifa)}, calculado pela conta ${r.mes.slice(5)}/${r.mes.slice(0, 4)}.`);
  };
  const ultimaR = Object.values(contas).sort((a, b) => b.mes.localeCompare(a.mes)).find((c) => c.kwh > 0);
  const metaDica = `Exemplo: 170. Uma boa referência é o custo do ar na última conta${ultimaR ? ` (a conta ${ultimaR.mes.slice(5)}/${ultimaR.mes.slice(0, 4)} teve ${brl(ultimaR.valor)} no total)` : ''}.`;
  const metaReais = cfg.goalType === 'R$' ? cfg.goal : nf(parseNum(cfg.goalKwh) * tarifa, 0);

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Ajustes</h1>

      <Secao titulo="Conta de luz">
        <Linha>
          <Campo
            rot="Preço do kWh"
            unidade="R$"
            valor={cfg.tariff}
            aoMudar={preco}
            ajuda='Exemplo: 1,19. Na conta, divida o valor da energia (sem a iluminação pública) pelo "Consumo kWh".'
            botao={<button onClick={calcularPelaConta} className="press" style={{ height: 44, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--ink)', fontSize: 14, fontWeight: 800 }}>Calcular pela última conta</button>}
          />
        </Linha>
        <Linha ultimo>
          <Campo
            rot="Dia da leitura"
            tipo="numeric"
            valor={cfg.diaLeitura}
            aoMudar={(v) => set('diaLeitura', v.replace(/\D/g, '').slice(0, 2))}
            ajuda='Na conta, procure "Data da leitura" ou "Próxima leitura". É o dia em que o medidor é lido todo mês (de 1 a 28).'
          />
        </Linha>
      </Secao>

      <Secao titulo="Calibração" id="calibracao">
        <Linha>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Casa sem o ar</div>
            {d.cal.estado === 'calibrado' ? <Selo tipo="ok" texto="Calibrado" /> : d.cal.estado === 'calibrando' ? <Selo tipo="calibrando" texto={`Calibrando: ${d.cal.n} de 3 contas`} /> : d.cal.estado === 'manual' ? <Selo tipo="neutro" texto="Manual" /> : <Selo tipo="poucos" texto="Poucos dados" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{nf(d.cal.valor, 1)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>kWh por dia</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }} aria-label={`${Math.min(d.cal.n, 3)} de 3 contas usadas`}>
            {[0, 1, 2].map((i) => <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < Math.min(d.cal.n, 3) ? 'var(--green)' : 'var(--line)' }} />)}
          </div>
          <div style={dica}>
            {d.cal.estado === 'manual'
              ? 'Valor que você digitou. A previsão usa ele.'
              : d.cal.estado === 'poucos'
                ? `Preciso de uma conta com o ar medido quase o mês todo, ou de uma conta de antes do ar. Até lá, uso ${nf(d.cal.valor, 1)}.`
                : `Calculado com as últimas ${d.cal.n} contas (${d.cal.usados.map((u) => `${u.ref.slice(5)}/${u.ref.slice(0, 4)}`).join(', ')}).`}
          </div>
          {d.calibAviso && d.cal.estado !== 'manual' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--accent-soft)', fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>
              <RefreshCw size={18} style={{ flex: 'none' }} />
              Ajustei de {nf(d.calibAviso.de, 1)} para {nf(d.calibAviso.para, 1)}{d.calibAviso.ref ? ` com a conta ${d.calibAviso.ref.slice(5)}/${d.calibAviso.ref.slice(0, 4)}` : ''}.
            </div>
          )}
        </Linha>
        <Linha ultimo={cfg.calibAuto}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span><div style={{ fontWeight: 700, fontSize: 15 }}>Ajustar sozinho</div><div style={dica}>Recalcula a cada conta lançada</div></span>
            <Switch on={cfg.calibAuto} onClick={() => set('calibAuto', !cfg.calibAuto)} label="Ajustar sozinho" />
          </div>
        </Linha>
        {!cfg.calibAuto && (
          <Linha ultimo>
            <Campo
              rot="Ajuste manual"
              unidade="kWh/dia"
              valor={cfg.semAr}
              aoMudar={(v) => set('semAr', v)}
              ajuda="Exemplo: 4,3. Pegue uma conta sem o ar e divida o consumo pelos dias (133 kWh ÷ 30 dias = 4,4)."
            />
          </Linha>
        )}
        <div style={{ ...dica, padding: '0 0 12px', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          Com isso, a faixa da previsão da conta hoje é de ±{Math.round(margemDaFaixa(d.comps.map((c) => c.erro), d.cal.estado === 'calibrado') * 100)}%. Ela fica mais estreita conforme as previsões acertam.
        </div>
      </Secao>

      <Secao titulo="Meta">
        <Linha>
          <Campo
            rot="Quanto quero gastar com o ar por conta"
            unidade="R$"
            valor={metaReais}
            aoMudar={(v) => setCfg((c) => ({ ...c, goal: v, goalType: 'R$' }))}
            ajuda={metaDica}
          />
        </Linha>
        <Linha>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 15 }}>
            Avisar quando chegar a 80% da meta <Switch on={cfg.alert80} onClick={() => set('alert80', !cfg.alert80)} label="Avisar quando chegar a 80% da meta" />
          </div>
        </Linha>
        <Linha ultimo>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 15 }}>
            Avisar quando passar da meta <Switch on={cfg.alert100} onClick={() => set('alert100', !cfg.alert100)} label="Avisar quando passar da meta" />
          </div>
        </Linha>
      </Secao>

      <Secao titulo="Aparelho">
        <Linha>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Nome do aparelho</div>
          <input className="input" placeholder={nomeLg || 'Ar-condicionado'} value={cfg.nome} onChange={(e) => set('nome', e.target.value)} />
        </Linha>
        <Linha>
          <div style={{ fontSize: 15, fontWeight: 700 }}>PIN para controlar</div>
          <div style={dica}>{pinConfigurado ? 'O PIN está definido na hospedagem (variável APP_PIN). Para trocar, altere o valor lá.' : 'Sem PIN, os controles ficam desativados. Defina APP_PIN (6 dígitos) na hospedagem.'}</div>
        </Linha>
        <Linha ultimo>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Voltar para &quot;só olhar&quot; depois de</div>
          <Seg<'1' | '5' | '15'> opts={[['1', '1 min'], ['5', '5 min'], ['15', '15 min']]} cur={String(cfg.lockMin) as '1' | '5' | '15'} onSel={(k) => set('lockMin', Number(k))} />
          <div style={dica}>Sem mexer no aparelho por esse tempo, o app volta sozinho para o modo que só mostra os números.</div>
        </Linha>
      </Secao>

      <Secao titulo="Toque">
        <Linha ultimo>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 15 }}>
            <span>Vibrar nos comandos<div style={dica}>Uma vibração leve ao ligar, mudar a temperatura e quando o comando dá certo ou falha. Só funciona em alguns celulares.</div></span>
            <Switch on={cfg.vibrar !== false} onClick={() => set('vibrar', cfg.vibrar === false)} label="Vibrar nos comandos" />
          </div>
        </Linha>
      </Secao>

      <Secao titulo="Histórico">
        <Linha ultimo>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 15 }}>
            <span>Mostrar clima no gráfico<div style={dica}>Máxima do dia em Barreiras-BA, de um serviço gratuito.</div></span>
            <Switch on={cfg.showClima} onClick={() => set('showClima', !cfg.showClima)} label="Mostrar clima no gráfico" />
          </div>
        </Linha>
      </Secao>

      <Secao titulo="Aparência">
        <Linha ultimo>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Tema</div>
          <Seg opts={[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']]} cur={cfg.theme} onSel={(k) => set('theme', k)} />
        </Linha>
      </Secao>

      <Secao titulo="Dados">
        <Linha>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Total desde {dl(parseYmd(d.desde))}</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{nf(per.acumKwh, 0)} kWh · {brl0(acumR)}</span>
          </div>
          <div style={dica}>Soma do consumo do ar a partir da data abaixo.</div>
        </Linha>
        <Linha>
          <Campo rot="Somar desde" tipo="date" valor={cfg.since || d.desde} aoMudar={(v) => v && set('since', v)} ajuda="Primeiro dia que entra no total. Por padrão, é o início da conta atual." />
        </Linha>
        <Linha>
          <Campo rot="Somar consumo anterior" unidade="kWh" valor={cfg.base} aoMudar={(v) => set('base', v)} ajuda="Para incluir no total o consumo do ar de antes de o app começar a guardar os dias." />
        </Linha>
        <Linha>
          <button onClick={onSalvarBackup} disabled={backup.salvando} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', minHeight: 44 }}>
            <Save size={20} style={{ flex: 'none' }} />
            <span><div style={{ fontWeight: 800, fontSize: 15 }}>{backup.salvando ? 'Salvando backup…' : 'Salvar backup'}</div><div style={dica}>{backup.salvoNome ? `Salvo agora: ${backup.salvoNome}` : backup.rotulo}</div></span>
          </button>
        </Linha>
        <Linha>
          <button onClick={onRestaurar} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', minHeight: 44 }}>
            <RotateCcw size={20} style={{ flex: 'none' }} />
            <span><div style={{ fontWeight: 800, fontSize: 15 }}>Restaurar backup</div><div style={dica}>Substitui os dados deste celular</div></span>
          </button>
        </Linha>
        <Linha>
          <button onClick={onExport} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', minHeight: 44 }}>
            <Download size={20} />
            <span><div style={{ fontWeight: 800, fontSize: 15 }}>Exportar planilha (CSV)</div><div style={dica}>{nDias} dias · data, kWh, R$, e as contas</div></span>
          </button>
        </Linha>
        <Linha>
          <button onClick={onDiag} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', minHeight: 44 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: conectado ? 'var(--green)' : 'var(--red)', flex: 'none', margin: '0 5px' }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>Conexão com a LG · {conectado ? 'funcionando' : 'com erro'}</span>
          </button>
        </Linha>
        <Linha>
          <button onClick={onIntro} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', minHeight: 44, fontWeight: 800, fontSize: 15 }}>
            <Eye size={20} /> Rever a introdução
          </button>
        </Linha>
        <Linha ultimo>
          <button onClick={onApagar} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)', fontWeight: 800, fontSize: 15, width: '100%', minHeight: 44 }}>
            <Trash2 size={20} /> Apagar histórico deste celular
          </button>
        </Linha>
      </Secao>
    </>
  );
}
