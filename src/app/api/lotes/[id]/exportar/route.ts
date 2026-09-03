import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import {
  gerarArquivoDominio,
  nomeArquivoExportacao,
  type LancamentoParaExportar,
} from '@/lib/export/dominio';

export const runtime = 'nodejs';

/**
 * Exportação do lote no layout do Importador do Domínio (seção 7).
 *
 * Só gera quando não há mais pendência na fila "não identificados" (6.4).
 * Ao final, marca o lote como exportado e os lançamentos como já exportados,
 * para que não entrem de novo num arquivo futuro por engano (6.5).
 */
export async function GET(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id: loteId } = await contexto.params;
  const supabase = await criarClienteServidor();

  const { data: lote, error: erroLote } = await supabase
    .from('lotes_importacao')
    .select('id, empresa_id, periodo_inicio, status, empresas ( cnpj, nome ), contas_bancarias_empresa ( codigo_historico_padrao_dominio, plano_contas_empresa ( codigo_conta_dominio ) )')
    .eq('id', loteId)
    .maybeSingle();

  if (erroLote || !lote) {
    return NextResponse.json({ erro: 'Lote não encontrado.' }, { status: 404 });
  }

  const empresa = lote.empresas as unknown as { cnpj: string; nome: string } | null;
  const contaBancaria = lote.contas_bancarias_empresa as unknown as
    | {
        codigo_historico_padrao_dominio: string | null;
        plano_contas_empresa: { codigo_conta_dominio: string } | null;
      }
    | null;

  const codigoContaBanco = contaBancaria?.plano_contas_empresa?.codigo_conta_dominio;
  const codigoHistorico = contaBancaria?.codigo_historico_padrao_dominio;

  if (!empresa?.cnpj) {
    return NextResponse.json({ erro: 'A empresa não tem CNPJ cadastrado.' }, { status: 422 });
  }
  if (!codigoContaBanco) {
    return NextResponse.json(
      { erro: 'A conta bancária não tem conta contábil do banco vinculada.' },
      { status: 422 },
    );
  }
  if (!codigoHistorico) {
    return NextResponse.json(
      { erro: 'A conta bancária não tem código de Histórico Padrão do Domínio cadastrado.' },
      { status: 422 },
    );
  }

  const { data: lancamentos, error: erroLancamentos } = await supabase
    .from('lancamentos_importados')
    .select('id, data_lancamento, historico_bruto, valor, tipo, status_revisao, exportado, plano_contas_empresa ( codigo_conta_dominio )')
    .eq('lote_id', loteId)
    .eq('exportado', false)
    .order('data_lancamento')
    .order('criado_em');

  if (erroLancamentos) {
    return NextResponse.json({ erro: erroLancamentos.message }, { status: 500 });
  }

  const lista = lancamentos ?? [];
  if (lista.length === 0) {
    return NextResponse.json({ erro: 'Nada a exportar neste lote.' }, { status: 422 });
  }

  const pendentes = lista.filter(
    (lancamento) => lancamento.status_revisao === 'revisar' || !lancamento.plano_contas_empresa,
  );
  if (pendentes.length > 0) {
    return NextResponse.json(
      { erro: `Ainda há ${pendentes.length} lançamento(s) não identificado(s).` },
      { status: 409 },
    );
  }

  const paraExportar: LancamentoParaExportar[] = lista.map((lancamento) => ({
    data: lancamento.data_lancamento as string,
    tipo: lancamento.tipo as 'debito' | 'credito',
    valor: Number(lancamento.valor),
    codigoContaContrapartida: (
      lancamento.plano_contas_empresa as unknown as { codigo_conta_dominio: string }
    ).codigo_conta_dominio,
    historico: lancamento.historico_bruto as string,
  }));

  const conteudo = gerarArquivoDominio({
    cnpjEmpresa: empresa.cnpj,
    codigoContaBanco,
    codigoHistoricoPadrao: codigoHistorico,
    lancamentos: paraExportar,
  });

  const agora = new Date().toISOString();
  await supabase
    .from('lancamentos_importados')
    .update({ exportado: true })
    .in('id', lista.map((lancamento) => lancamento.id));
  await supabase
    .from('lotes_importacao')
    .update({ status: 'exportado', exportado_em: agora })
    .eq('id', loteId);

  const nome = nomeArquivoExportacao(empresa.cnpj, lote.periodo_inicio as string | null);

  return new NextResponse(new Uint8Array(conteudo), {
    headers: {
      // charset explícito: o arquivo é Latin-1, não UTF-8 (seção 7.4).
      'Content-Type': 'text/plain; charset=ISO-8859-1',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Content-Length': String(conteudo.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
