'use client';

import { Check, CircleAlert, FileJson } from 'lucide-react';
import { dl, parseYmd } from '@/lib/fmt';
import type { ResumoBackup } from '@/lib/backup';
import { Folha } from './Sheets';
import { Spinner } from './ui';

export type FaseRestaurar = 'confirmar' | 'invalido' | 'restaurando' | 'pronto';

type Props = {
  fase: FaseRestaurar;
  arquivo: string;
  resumo: ResumoBackup | null;
  motivo: string;
  onConfirmar: () => void;
  onOutro: () => void;
  onFechar: () => void;
};

const linha = { display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 44, alignItems: 'center', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 600 } as const;
const dataCurta = (s: string | null) => (s ? `${dl(parseYmd(s))}` : '—');

export default function RestaurarBackup({ fase, arquivo, resumo, motivo, onConfirmar, onOutro, onFechar }: Props) {
  return (
    <Folha onFechar={fase === 'restaurando' ? () => {} : onFechar}>
      {fase === 'confirmar' && resumo && (
        <div style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Restaurar backup?</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px' }}>
            <FileJson size={22} style={{ flex: 'none' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, wordBreak: 'break-all' }}>{arquivo}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>criado em {resumo.criadoEm}</div>
            </div>
          </div>
          <div>
            <div style={linha}><span>Contas salvas por você</span><b>{resumo.contas}</b></div>
            <div style={linha}><span>Dias de consumo</span><b>{resumo.dias}{resumo.primeiro ? ` (${dataCurta(resumo.primeiro)} a ${dataCurta(resumo.ultimo)})` : ''}</b></div>
            <div style={{ ...linha, borderBottom: 'none' }}><span>Ajustes</span><b style={{ textAlign: 'right' }}>preço, meta e aparelho</b></div>
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
            Isto substitui os dados deste celular pelos do arquivo. O que não estiver no arquivo será perdido. Continuar?
          </p>
          <button onClick={onConfirmar} className="press" style={{ height: 52, borderRadius: 16, background: 'var(--red)', color: '#fff', fontSize: 15, fontWeight: 800 }}>Substituir dados deste celular</button>
          <button onClick={onFechar} className="press" style={{ height: 48, borderRadius: 16, fontSize: 15, fontWeight: 800 }}>Cancelar</button>
        </div>
      )}

      {fase === 'invalido' && (
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center', padding: '8px 0' }}>
          <span style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--red-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'dcnudge .32s ease-in-out 1' }}><CircleAlert size={30} color="var(--red)" /></span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Este arquivo não é um backup do app</h2>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>
            Nada foi mudado. Escolha o arquivo que começa com &quot;consumo-do-ar-backup&quot; e termina em .json.
            {motivo ? ` (${motivo})` : ''}
          </p>
          <button onClick={onOutro} className="press" style={{ width: '100%', height: 52, borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 800 }}>Escolher outro arquivo</button>
          <button onClick={onFechar} style={{ minHeight: 44, fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>Cancelar</button>
        </div>
      )}

      {fase === 'restaurando' && (
        <div style={{ display: 'grid', gap: 14, justifyItems: 'center', padding: '28px 0' }}>
          <Spinner size={28} />
          <div style={{ fontSize: 16, fontWeight: 800 }}>Restaurando os dados…</div>
        </div>
      )}

      {fase === 'pronto' && resumo && (
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center', padding: '8px 0' }}>
          <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'dcpop .4s cubic-bezier(.2,.8,.2,1)' }}><Check size={32} color="var(--green)" strokeWidth={2.6} /></span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Dados restaurados</h2>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.45 }}>{resumo.contas === 0 ? 'Nenhuma conta salva' : `${resumo.contas} ${resumo.contas === 1 ? 'conta salva' : 'contas salvas'}`} e {resumo.dias} dias de consumo voltaram para este celular.</p>
          <button onClick={onFechar} className="press" style={{ width: '100%', height: 52, borderRadius: 16, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 800 }}>Pronto</button>
        </div>
      )}
    </Folha>
  );
}
