'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { formatarMoeda } from '@/lib/nucleo/numero';

export interface LancamentoTela {
  id: string;
  data: string;
  historico: string;
  tipoOperacao: string;
  documento: string | null;
  valor: number;
  tipo: 'debito' | 'credito';
  status: 'auto_classificado' | 'revisar' | 'outlier' | 'confirmado';
  duplicado: boolean;
  contaContabilId: string | null;
  contaRotulo: string | null;
  exportado: boolean;
}

interface ContaContabil {
  id: string;
  codigo_conta_dominio: string;
  descricao: string;
}

/**
 * Mapa de resultado da seção 6.4, em três blocos:
 *   verde    — classificados automaticamente, prontos para exportar
 *   amarelo  — outliers de valor, confirmados com um clique
 *   vermelho — não identificados, exigem vínculo manual (e aí o sistema aprende)
 */
export function MapaRevisao({
  loteId,
  lancamentos,
  planoContas,
  jaExportado,
}: {
  loteId: string;
  lancamentos: LancamentoTela[];
  planoContas: ContaContabil[];
  jaExportado: boolean;
}) {
  const router = useRouter();
  const [emTransicao, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const blocos = useMemo(() => {
    return {
      verdes: lancamentos.filter(
        (l) => l.status === 'auto_classificado' || (l.status === 'confirmado' && l.contaContabilId),
      ),
      amarelos: lancamentos.filter((l) => l.status === 'outlier'),
      vermelhos: lancamentos.filter((l) => l.status === 'revisar' || !l.contaContabilId),
    };
  }, [lancamentos]);

  const pendentes = blocos.vermelhos.length;

  async function chamar(id: string, corpo: Record<string, unknown>) {
    setErro(null);
    setOcupado(id);
    try {
      const resposta = await fetch(`/api/lancamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!resposta.ok) {
        const dados = await resposta.json();
        setErro(dados.erro ?? 'Falha ao atualizar o lançamento.');
        return;
      }
      iniciarTransicao(() => router.refresh());
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <Bloco
        cor="vermelho"
        titulo="Não identificados"
        subtitulo="Vincule a uma conta contábil. A regra é salva automaticamente para as próximas importações."
        lancamentos={blocos.vermelhos}
      >
        {(lancamento) => (
          <form
            className="flex items-center gap-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              const dados = new FormData(evento.currentTarget);
              const contaContabilId = String(dados.get('conta') ?? '');
              if (!contaContabilId) return;
              void chamar(lancamento.id, {
                acao: 'classificar',
                contaContabilId,
                aprender: dados.get('aprender') === 'on',
              });
            }}
          >
            <select name="conta" required className="campo w-56 py-1 text-xs">
              <option value="">Selecione a conta…</option>
              {planoContas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.codigo_conta_dominio} — {conta.descricao}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" name="aprender" defaultChecked />
              aprender
            </label>
            <button
              className="botao-secundario py-1"
              disabled={ocupado === lancamento.id || emTransicao}
            >
              Vincular
            </button>
          </form>
        )}
      </Bloco>

      <Bloco
        cor="amarelo"
        titulo="Atenção / outliers"
        subtitulo="Classificados, mas com valor fora do padrão histórico da regra. Confirme ou reclassifique."
        lancamentos={blocos.amarelos}
      >
        {(lancamento) => (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">{lancamento.contaRotulo ?? '—'}</span>
            <button
              className="botao-secundario py-1"
              disabled={ocupado === lancamento.id || emTransicao}
              onClick={() => void chamar(lancamento.id, { acao: 'confirmar' })}
            >
              Confirmar
            </button>
            <select
              className="campo w-48 py-1 text-xs"
              defaultValue=""
              onChange={(evento) => {
                if (!evento.target.value) return;
                void chamar(lancamento.id, {
                  acao: 'classificar',
                  contaContabilId: evento.target.value,
                  aprender: true,
                });
              }}
            >
              <option value="">Reclassificar…</option>
              {planoContas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.codigo_conta_dominio} — {conta.descricao}
                </option>
              ))}
            </select>
          </div>
        )}
      </Bloco>

      <Bloco
        cor="verde"
        titulo="Classificados automaticamente"
        subtitulo="Prontos para exportar. A conta aplicada fica visível para conferência rápida."
        lancamentos={blocos.verdes}
      >
        {(lancamento) => (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700">
              {lancamento.contaRotulo ?? '—'}
            </span>
            <select
              className="campo w-44 py-1 text-xs"
              defaultValue=""
              onChange={(evento) => {
                if (!evento.target.value) return;
                void chamar(lancamento.id, {
                  acao: 'classificar',
                  contaContabilId: evento.target.value,
                  aprender: true,
                });
              }}
            >
              <option value="">Corrigir…</option>
              {planoContas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.codigo_conta_dominio} — {conta.descricao}
                </option>
              ))}
            </select>
          </div>
        )}
      </Bloco>

      <div className="cartao flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm">
          {jaExportado ? (
            <span className="text-slate-600">
              Lote já exportado. Lançamentos exportados não entram numa nova geração.
            </span>
          ) : pendentes > 0 ? (
            <span className="text-red-600">
              {pendentes} lançamento(s) ainda sem conta contábil — resolva antes de gerar o TXT.
            </span>
          ) : (
            <span className="text-emerald-700">Sem pendências. Pronto para gerar o arquivo.</span>
          )}
        </div>

        <a
          href={`/api/lotes/${loteId}/exportar`}
          className={pendentes > 0 || jaExportado ? 'botao pointer-events-none opacity-50' : 'botao'}
          aria-disabled={pendentes > 0 || jaExportado}
        >
          Gerar TXT do Domínio
        </a>
      </div>
    </div>
  );
}

const ESTILO_BLOCO = {
  verde: 'border-emerald-200 bg-emerald-50/40',
  amarelo: 'border-amber-200 bg-amber-50/40',
  vermelho: 'border-red-200 bg-red-50/40',
} as const;

const ESTILO_PONTO = {
  verde: 'bg-emerald-500',
  amarelo: 'bg-amber-500',
  vermelho: 'bg-red-500',
} as const;

function Bloco({
  cor,
  titulo,
  subtitulo,
  lancamentos,
  children,
}: {
  cor: keyof typeof ESTILO_BLOCO;
  titulo: string;
  subtitulo: string;
  lancamentos: LancamentoTela[];
  children: (lancamento: LancamentoTela) => React.ReactNode;
}) {
  if (lancamentos.length === 0) return null;

  return (
    <section className={`rounded-lg border p-4 ${ESTILO_BLOCO[cor]}`}>
      <header className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${ESTILO_PONTO[cor]}`} />
        <h2 className="text-sm font-semibold">
          {titulo} <span className="text-slate-500">({lancamentos.length})</span>
        </h2>
      </header>
      <p className="mb-3 text-xs text-slate-600">{subtitulo}</p>

      <div className="overflow-x-auto">
        <table className="tabela bg-white">
          <thead>
            <tr>
              <th>Data</th>
              <th>Histórico</th>
              <th className="text-right">Valor</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((lancamento) => (
              <tr key={lancamento.id}>
                <td className="whitespace-nowrap tabular-nums text-xs">
                  {lancamento.data.split('-').reverse().join('/')}
                </td>
                <td>
                  <div className="text-xs">{lancamento.historico}</div>
                  <div className="mt-0.5 flex gap-2 text-[11px] text-slate-400">
                    {lancamento.documento && <span>doc {lancamento.documento}</span>}
                    {lancamento.duplicado && (
                      <span className="text-amber-700">possível duplicado</span>
                    )}
                    {lancamento.exportado && <span>já exportado</span>}
                  </div>
                </td>
                <td
                  className={`whitespace-nowrap text-right tabular-nums text-xs ${
                    lancamento.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {lancamento.tipo === 'credito' ? '+' : '-'} {formatarMoeda(lancamento.valor)}
                </td>
                <td>{lancamento.exportado ? <span className="text-xs text-slate-400">—</span> : children(lancamento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
