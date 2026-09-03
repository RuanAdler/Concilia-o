import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { chaveDeAprendizado } from '@/lib/classificacao/motor';
import { normalizarHistorico } from '@/lib/nucleo/texto';

export const runtime = 'nodejs';

/**
 * Revisão manual na tela de importação (seção 6.4).
 *
 * Duas ações:
 *   confirmar   -> aceita a classificação atual de um outlier, com um clique.
 *   classificar -> vincula a uma conta contábil e APRENDE a regra (seção 4.6),
 *                  que é a resposta à maior queixa sobre o sistema atual.
 */
export async function PATCH(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  const { id } = await contexto.params;
  const corpo = (await request.json()) as {
    acao: 'confirmar' | 'classificar';
    contaContabilId?: string;
    aprender?: boolean;
  };

  const supabase = await criarClienteServidor();

  const { data: lancamento, error } = await supabase
    .from('lancamentos_importados')
    .select('id, empresa_id, lote_id, tipo_operacao, historico_normalizado, documento_extraido, exportado, lotes_importacao ( conta_bancaria_id )')
    .eq('id', id)
    .maybeSingle();

  if (error || !lancamento) {
    return NextResponse.json({ erro: 'Lançamento não encontrado.' }, { status: 404 });
  }
  if (lancamento.exportado) {
    return NextResponse.json(
      { erro: 'Lançamento já exportado — não pode mais ser alterado.' },
      { status: 409 },
    );
  }

  if (corpo.acao === 'confirmar') {
    const { error: erroUpdate } = await supabase
      .from('lancamentos_importados')
      .update({ status_revisao: 'confirmado' })
      .eq('id', id);

    if (erroUpdate) return NextResponse.json({ erro: erroUpdate.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!corpo.contaContabilId) {
    return NextResponse.json({ erro: 'Informe a conta contábil.' }, { status: 400 });
  }

  let regraId: string | null = null;

  if (corpo.aprender !== false) {
    regraId = await aprenderRegra(supabase, {
      empresaId: lancamento.empresa_id as string,
      contaBancariaId:
        (lancamento.lotes_importacao as unknown as { conta_bancaria_id: string } | null)
          ?.conta_bancaria_id ?? null,
      contaContabilId: corpo.contaContabilId,
      documentoExtraido: lancamento.documento_extraido as string | null,
      tipoOperacaoNormalizado: normalizarHistorico(String(lancamento.tipo_operacao ?? '')),
      historicoNormalizado: String(lancamento.historico_normalizado ?? ''),
    });
  }

  const { error: erroUpdate } = await supabase
    .from('lancamentos_importados')
    .update({
      conta_contabil_id: corpo.contaContabilId,
      regra_aplicada_id: regraId,
      status_revisao: 'confirmado',
    })
    .eq('id', id);

  if (erroUpdate) return NextResponse.json({ erro: erroUpdate.message }, { status: 500 });

  return NextResponse.json({ ok: true, regraId });
}

type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/**
 * Cria (ou reaponta) a regra correspondente ao vínculo manual.
 *
 * A regra fica amarrada ao template do banco da conta importada: a mesma
 * descrição de "tipo de operação" pode significar coisas diferentes em bancos
 * diferentes, e nada aqui atravessa a fronteira da empresa (seção 7.2).
 */
async function aprenderRegra(
  supabase: ClienteSupabase,
  entrada: {
    empresaId: string;
    contaBancariaId: string | null;
    contaContabilId: string;
    documentoExtraido: string | null;
    tipoOperacaoNormalizado: string;
    historicoNormalizado: string;
  },
): Promise<string | null> {
  const chave = chaveDeAprendizado({
    documentoExtraido: entrada.documentoExtraido,
    tipoOperacaoNormalizado: entrada.tipoOperacaoNormalizado,
    historicoNormalizado: entrada.historicoNormalizado,
  });
  if (!chave) return null;

  let bancoTemplateId: string | null = null;
  if (entrada.contaBancariaId) {
    const { data } = await supabase
      .from('contas_bancarias_empresa')
      .select('banco_template_id')
      .eq('id', entrada.contaBancariaId)
      .maybeSingle();
    bancoTemplateId = (data?.banco_template_id as string | undefined) ?? null;
  }

  // Se a chave já existe, o vínculo novo é uma correção: reaponta a conta.
  const { data: existente } = await supabase
    .from('regras_classificacao')
    .select('id')
    .eq('empresa_id', entrada.empresaId)
    .eq('tipo_chave', chave.tipo_chave)
    .eq('valor_chave', chave.valor_chave)
    .maybeSingle();

  if (existente) {
    await supabase
      .from('regras_classificacao')
      .update({
        conta_contabil_id: entrada.contaContabilId,
        ultima_utilizacao: new Date().toISOString(),
      })
      .eq('id', existente.id);
    return existente.id as string;
  }

  const { data: criada, error } = await supabase
    .from('regras_classificacao')
    .insert({
      empresa_id: entrada.empresaId,
      banco_template_id: bancoTemplateId,
      tipo_chave: chave.tipo_chave,
      valor_chave: chave.valor_chave,
      conta_contabil_id: entrada.contaContabilId,
      confianca: 'alta',
      origem: 'manual',
      ultima_utilizacao: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return null;
  return criada.id as string;
}
