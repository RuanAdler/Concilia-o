import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { parsearExtrato, type BancoTemplate, type EstruturaHistorico } from '@/lib/parsers';
import { classificarLote } from '@/lib/classificacao/motor';
import { montarIndiceSinonimos } from '@/lib/classificacao/similaridade';
import type { EstatisticaRegra, RegraCtx } from '@/lib/classificacao/tipos';
import { mediana } from '@/lib/nucleo/numero';

// pdfjs precisa do runtime Node; o Edge não tem os módulos que ele usa.
export const runtime = 'nodejs';
export const maxDuration = 60;

const TAMANHO_MAXIMO = 15 * 1024 * 1024;
const LIMITE_HISTORICO_ESTATISTICA = 5000;

/**
 * Processa o extrato em memória e grava apenas o resultado da leitura.
 * O arquivo enviado nunca é persistido (seção 2 da especificação).
 */
export async function POST(request: NextRequest) {
  const supabase = await criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const formulario = await request.formData();
  const contaBancariaId = String(formulario.get('conta_bancaria_id') ?? '');
  const arquivo = formulario.get('arquivo');

  if (!contaBancariaId) {
    return NextResponse.json({ erro: 'Selecione a conta bancária.' }, { status: 400 });
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ erro: 'Envie o arquivo do extrato.' }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: 'Arquivo maior que 15 MB.' }, { status: 400 });
  }

  // A conta bancária define a empresa E o template de leitura (seção 6.4).
  const { data: conta, error: erroConta } = await supabase
    .from('contas_bancarias_empresa')
    .select('id, empresa_id, banco_template_id, bancos_templates ( * )')
    .eq('id', contaBancariaId)
    .maybeSingle();

  if (erroConta || !conta) {
    return NextResponse.json({ erro: 'Conta bancária não encontrada.' }, { status: 404 });
  }

  const template = conta.bancos_templates as unknown as BancoTemplate | null;
  if (!template) {
    return NextResponse.json({ erro: 'Template de banco não encontrado.' }, { status: 404 });
  }

  const estrutura = (template.estrutura_historico ?? null) as EstruturaHistorico | null;

  let resultado;
  try {
    resultado = await parsearExtrato(new Uint8Array(await arquivo.arrayBuffer()), template);
  } catch (erro) {
    return NextResponse.json(
      { erro: `Falha ao ler o arquivo: ${(erro as Error).message}` },
      { status: 422 },
    );
  }

  if (resultado.lancamentos.length === 0) {
    // Diagnóstico em memória, para calibrar o template sem precisar do arquivo.
    return NextResponse.json(
      {
        erro: resultado.avisos[0] ?? 'Nenhum lançamento reconhecido.',
        linhasBrutas: resultado.linhasBrutas.slice(0, 80),
      },
      { status: 422 },
    );
  }

  const empresaId = conta.empresa_id as string;

  const [pessoas, regras, historicoValores, hashesAnteriores] = await Promise.all([
    supabase
      .from('pessoas_especiais')
      .select('id, identificador, tipo_identificador, nome_exibicao, papel, conta_contabil_id')
      .eq('empresa_id', empresaId),
    supabase
      .from('regras_classificacao')
      .select('id, banco_template_id, tipo_chave, valor_chave, conta_contabil_id, confianca, multiplicador_outlier')
      .eq('empresa_id', empresaId),
    supabase
      .from('lancamentos_importados')
      .select('regra_aplicada_id, valor')
      .eq('empresa_id', empresaId)
      .not('regra_aplicada_id', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(LIMITE_HISTORICO_ESTATISTICA),
    supabase
      .from('lancamentos_importados')
      .select('hash_deduplicacao')
      .eq('empresa_id', empresaId)
      .limit(LIMITE_HISTORICO_ESTATISTICA),
  ]);

  const classificados = classificarLote(
    resultado.lancamentos,
    {
      bancoTemplateId: template.id,
      pessoasEspeciais: pessoas.data ?? [],
      regras: (regras.data ?? []) as RegraCtx[],
      estatisticasPorRegra: montarEstatisticas(historicoValores.data ?? []),
      indiceSinonimos: montarIndiceSinonimos(estrutura?.sinonimos),
    },
    estrutura,
    template.regex_documento,
  );

  // Sinaliza reimportação de extrato já processado — não bloqueia (seção 6.4).
  const conhecidos = new Set((hashesAnteriores.data ?? []).map((linha) => linha.hash_deduplicacao));
  for (const lancamento of classificados) {
    lancamento.duplicadoSuspeito = conhecidos.has(lancamento.hashDeduplicacao);
  }

  const { data: lote, error: erroLote } = await supabase
    .from('lotes_importacao')
    .insert({
      empresa_id: empresaId,
      conta_bancaria_id: contaBancariaId,
      periodo_inicio: resultado.periodoInicio,
      periodo_fim: resultado.periodoFim,
      nome_arquivo: arquivo.name,
      status: 'aguardando_revisao',
    })
    .select('id')
    .single();

  if (erroLote || !lote) {
    return NextResponse.json({ erro: erroLote?.message ?? 'Falha ao criar o lote.' }, { status: 500 });
  }

  const { error: erroLancamentos } = await supabase.from('lancamentos_importados').insert(
    classificados.map((lancamento) => ({
      lote_id: lote.id,
      empresa_id: empresaId,
      data_lancamento: lancamento.data,
      historico_bruto: lancamento.historicoBruto,
      historico_normalizado: lancamento.historicoNormalizado,
      tipo_operacao: lancamento.tipoOperacao || null,
      documento_extraido: lancamento.documentoExtraido,
      valor: lancamento.valor,
      tipo: lancamento.tipo,
      hash_deduplicacao: lancamento.hashDeduplicacao,
      regra_aplicada_id: lancamento.regraAplicadaId,
      conta_contabil_id: lancamento.contaContabilId,
      status_revisao: lancamento.statusRevisao,
      duplicado_suspeito: lancamento.duplicadoSuspeito,
    })),
  );

  if (erroLancamentos) {
    // Sem lançamentos o lote não serve para nada — desfaz para não deixar lixo.
    await supabase.from('lotes_importacao').delete().eq('id', lote.id);
    return NextResponse.json({ erro: erroLancamentos.message }, { status: 500 });
  }

  // Marca as regras que acabaram de ser usadas, para a futura limpeza (3.6).
  const regrasUsadas = [
    ...new Set(classificados.map((l) => l.regraAplicadaId).filter((id): id is string => Boolean(id))),
  ];
  if (regrasUsadas.length > 0) {
    await supabase
      .from('regras_classificacao')
      .update({ ultima_utilizacao: new Date().toISOString() })
      .in('id', regrasUsadas);
  }

  return NextResponse.json({
    loteId: lote.id,
    total: classificados.length,
    avisos: resultado.avisos,
  });
}

function montarEstatisticas(
  linhas: Array<{ regra_aplicada_id: string | null; valor: number | string }>,
): Map<string, EstatisticaRegra> {
  const porRegra = new Map<string, number[]>();

  for (const linha of linhas) {
    if (!linha.regra_aplicada_id) continue;
    const valor = Number(linha.valor);
    if (!Number.isFinite(valor)) continue;
    const lista = porRegra.get(linha.regra_aplicada_id) ?? [];
    lista.push(valor);
    porRegra.set(linha.regra_aplicada_id, lista);
  }

  const estatisticas = new Map<string, EstatisticaRegra>();
  for (const [regraId, valores] of porRegra) {
    estatisticas.set(regraId, { mediana: mediana(valores), quantidade: valores.length });
  }
  return estatisticas;
}
