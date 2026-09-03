import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { formatarMoeda } from '@/lib/nucleo/numero';
import { MapaRevisao, type LancamentoTela } from './mapa-revisao';

export default async function PaginaRevisao({ params }: { params: Promise<{ loteId: string }> }) {
  const { loteId } = await params;
  const supabase = await criarClienteServidor();

  const { data: lote } = await supabase
    .from('lotes_importacao')
    .select('id, empresa_id, periodo_inicio, periodo_fim, status, nome_arquivo, exportado_em, empresas ( nome, cnpj ), contas_bancarias_empresa ( apelido, codigo_historico_padrao_dominio, plano_contas_empresa ( codigo_conta_dominio, descricao ) )')
    .eq('id', loteId)
    .maybeSingle();

  if (!lote) notFound();

  const [lancamentos, planoContas] = await Promise.all([
    supabase
      .from('lancamentos_importados')
      .select('id, data_lancamento, historico_bruto, tipo_operacao, documento_extraido, valor, tipo, status_revisao, duplicado_suspeito, conta_contabil_id, exportado, plano_contas_empresa ( codigo_conta_dominio, descricao )')
      .eq('lote_id', loteId)
      .order('data_lancamento')
      .order('criado_em'),
    supabase
      .from('plano_contas_empresa')
      .select('id, codigo_conta_dominio, descricao')
      .eq('empresa_id', lote.empresa_id as string)
      .order('codigo_conta_dominio'),
  ]);

  const lista: LancamentoTela[] = (lancamentos.data ?? []).map((linha) => {
    const conta = linha.plano_contas_empresa as unknown as
      | { codigo_conta_dominio: string; descricao: string }
      | null;
    return {
      id: linha.id as string,
      data: linha.data_lancamento as string,
      historico: linha.historico_bruto as string,
      tipoOperacao: (linha.tipo_operacao as string | null) ?? '',
      documento: linha.documento_extraido as string | null,
      valor: Number(linha.valor),
      tipo: linha.tipo as 'debito' | 'credito',
      status: linha.status_revisao as LancamentoTela['status'],
      duplicado: Boolean(linha.duplicado_suspeito),
      contaContabilId: linha.conta_contabil_id as string | null,
      contaRotulo: conta ? `${conta.codigo_conta_dominio} — ${conta.descricao}` : null,
      exportado: Boolean(linha.exportado),
    };
  });

  const empresa = lote.empresas as unknown as { nome: string; cnpj: string } | null;
  const contaBancaria = lote.contas_bancarias_empresa as unknown as
    | {
        apelido: string | null;
        codigo_historico_padrao_dominio: string | null;
        plano_contas_empresa: { codigo_conta_dominio: string; descricao: string } | null;
      }
    | null;

  const totalCreditos = lista
    .filter((l) => l.tipo === 'credito')
    .reduce((soma, l) => soma + l.valor, 0);
  const totalDebitos = lista
    .filter((l) => l.tipo === 'debito')
    .reduce((soma, l) => soma + l.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/importacao" className="text-xs text-slate-500 underline underline-offset-2">
          ← Importação
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {empresa?.nome ?? 'Lote'} · {contaBancaria?.apelido ?? 'conta'}
        </h1>
        <p className="text-sm text-slate-500">
          {lote.periodo_inicio ?? '—'} a {lote.periodo_fim ?? '—'} · {lista.length} lançamentos ·
          arquivo {lote.nome_arquivo ?? '—'}
        </p>
      </div>

      {/* Resumo de conferência contra o saldo do extrato (seção 6.5). */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Indicador titulo="Lançamentos" valor={String(lista.length)} />
        <Indicador titulo="Total de créditos" valor={formatarMoeda(totalCreditos)} />
        <Indicador titulo="Total de débitos" valor={formatarMoeda(totalDebitos)} />
        <Indicador
          titulo="Conta banco / histórico"
          valor={`${contaBancaria?.plano_contas_empresa?.codigo_conta_dominio ?? '—'} / ${
            contaBancaria?.codigo_historico_padrao_dominio ?? '—'
          }`}
        />
      </div>

      <MapaRevisao
        loteId={loteId}
        lancamentos={lista}
        planoContas={planoContas.data ?? []}
        jaExportado={lote.status === 'exportado'}
      />
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="cartao py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{valor}</div>
    </div>
  );
}
