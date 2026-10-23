'use client';

import { useMontado } from '@/lib/cliente';
import { brl, brl0, dl, nf, parseYmd } from '@/lib/fmt';
import { faixaDe, type Comparacao, type PrevisaoDaConta } from '@/lib/previsao';
import { Ajuda, Selo } from './selos';

const listras = 'repeating-linear-gradient(135deg, var(--accent) 0 3px, transparent 3px 7px)';

/** Faixa da conta prevista, com o marcador da conta passada. */
function FaixaPrevista({ baixo, alto, passada }: { baixo: number; alto: number; passada: number | null }) {
  const montado = useMontado();
  const min = Math.min(baixo, passada ?? baixo) * 0.92;
  const max = Math.max(alto, passada ?? alto) * 1.06;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div style={{ paddingBottom: passada != null ? 20 : 0 }}>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--surface2)' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos(baixo)}%`, width: `${pos(alto) - pos(baixo)}%`, borderRadius: 5, backgroundImage: listras, boxShadow: 'inset 0 0 0 1.5px var(--accent)', transformOrigin: 'center', transform: montado ? 'scaleX(1)' : 'scaleX(0)', transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }} />
        {passada != null && (
          <>
            <div style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${pos(passada)}% - 1px)`, width: 2, background: 'var(--ink)' }} />
            <span style={{ position: 'absolute', top: 16, left: `${Math.min(80, Math.max(20, pos(passada)))}%`, transform: 'translateX(-50%)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>conta passada {brl0(passada)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Previsão da conta de luz inteira: compacta (dentro de "Esta conta") ou em destaque (Próxima conta). */
export function ContaInteira({ p, destaque = false }: { p: PrevisaoDaConta; destaque?: boolean }) {
  if (p.espera || !p.prev) {
    return (
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
        A previsão da conta de luz inteira aparece no 4º dia desta conta ({dl(parseYmd(p.quartoDia))}).
      </div>
    );
  }
  const q = p.prev;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!destaque && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Conta de luz inteira</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: destaque ? 15 : 14, fontWeight: 700, color: 'var(--muted)' }}>cerca de</span>
          <span style={{ fontSize: destaque ? 34 : 22, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{brl0(q.valor)}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>entre {brl0(q.baixo)} e {brl0(q.alto)}</div>
      </div>
      <Selo tipo="previsao" />
      <Ajuda>
        Entra na conta: o ar (previsão de {nf(q.kwhAr, 0)} kWh), a casa sem o ar ({nf(q.semAr, 1)} kWh × {q.diasCiclo} dias = {nf(q.kwhCasa, 0)} kWh), o preço do kWh ({brl(q.tarifa)}) e as taxas fixas da última conta ({brl(q.fixas)}). É uma faixa porque o consumo da casa e a bandeira tarifária mudam de um mês para outro.
      </Ajuda>
      <div style={{ flexBasis: '100%' }}>
        <FaixaPrevista baixo={q.baixo} alto={q.alto} passada={p.passada} />
      </div>
    </div>
  );
}

/** Previsto × real de uma conta já lançada. */
export function PrevistoReal({ comp, primeira }: { comp: Comparacao | null; primeira: boolean }) {
  const montado = useMontado();
  if (!comp) {
    return (
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Previsto × real</span>
          <Selo tipo="neutro" texto="Sem previsão" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>Não há previsão guardada: o app não estava sendo usado durante esta conta.</div>
      </div>
    );
  }
  const grande = comp.erro >= 0.05;
  const { baixo, alto } = faixaDe(comp.previsto, comp.margem);
  const max = Math.max(comp.previsto, comp.real);
  const dif = Math.abs(Math.round(comp.diferenca));
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Previsto × real</span>
        <Selo tipo={grande ? 'diferenca' : 'neutro'} texto={grande ? 'Erro grande' : 'Erro pequeno'} />
      </div>
      {[{ r: 'Previsto', v: comp.previsto, listrado: true }, { r: 'Veio', v: comp.real, listrado: false }].map((l) => (
        <div key={l.r} style={{ display: 'grid', gridTemplateColumns: '62px 1fr 70px', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{l.r}</span>
          <div style={{ height: 12, borderRadius: 6, background: 'var(--surface2)' }}>
            <div style={{ height: '100%', borderRadius: 6, width: `${montado ? (l.v / max) * 100 : 0}%`, transition: 'width .8s cubic-bezier(.2,.8,.2,1)', ...(l.listrado ? { backgroundImage: listras, boxShadow: 'inset 0 0 0 1.5px var(--accent)' } : { background: 'var(--ink)' }) }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'right' }}>{brl0(l.v)}</span>
        </div>
      ))}
      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, color: grande ? 'var(--amber)' : 'var(--ink)' }}>
        Previsto {brl0(comp.previsto)}, veio {brl0(comp.real)} ({dif === 0 ? 'acertou' : `R$ ${dif} a ${comp.diferenca > 0 ? 'mais' : 'menos'}`}).
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
        A faixa era de {brl0(baixo)} a {brl0(alto)}: veio {comp.dentro ? 'dentro' : 'fora'} dela. {primeira ? 'Primeira comparação: a partir da próxima conta, a faixa usa esse erro.' : 'A próxima faixa já leva esse erro em conta.'}
      </div>
    </div>
  );
}
