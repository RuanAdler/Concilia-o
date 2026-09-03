'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { apenasDigitos, normalizarNome } from '@/lib/nucleo/texto';

export interface EstadoFormulario {
  erro?: string;
  sucesso?: string;
}

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

// ---------------------------------------------------------------------------
// Plano de contas (aba Plano de Contas)
// ---------------------------------------------------------------------------

export async function criarContaContabil(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const empresaId = texto(dados, 'empresa_id');
  const codigo = texto(dados, 'codigo_conta_dominio');
  const descricao = texto(dados, 'descricao');

  if (!codigo || !descricao) return { erro: 'Informe o código do Domínio e a descrição.' };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from('plano_contas_empresa').insert({
    empresa_id: empresaId,
    codigo_conta_dominio: codigo,
    descricao,
  });

  if (error) {
    return { erro: error.code === '23505' ? 'Esse código já existe nesta empresa.' : error.message };
  }

  revalidatePath(`/empresas/${empresaId}/plano-contas`);
  return { sucesso: `Conta ${codigo} cadastrada.` };
}

export async function removerContaContabil(empresaId: string, id: string) {
  const supabase = await criarClienteServidor();
  await supabase.from('plano_contas_empresa').delete().eq('id', id);
  revalidatePath(`/empresas/${empresaId}/plano-contas`);
}

// ---------------------------------------------------------------------------
// Contas bancárias (aba Bancos)
// ---------------------------------------------------------------------------

export async function criarContaBancaria(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const empresaId = texto(dados, 'empresa_id');
  const bancoTemplateId = texto(dados, 'banco_template_id');
  const contaContabilId = texto(dados, 'conta_contabil_id');
  const codigoHistorico = texto(dados, 'codigo_historico_padrao_dominio');

  if (!bancoTemplateId) return { erro: 'Selecione o template de banco.' };
  if (!contaContabilId) {
    return { erro: 'Selecione a conta contábil do banco no plano de contas da empresa.' };
  }
  if (!codigoHistorico) {
    return { erro: 'Informe o código do Histórico Padrão do Domínio (ex.: 75).' };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from('contas_bancarias_empresa').insert({
    empresa_id: empresaId,
    banco_template_id: bancoTemplateId,
    agencia: texto(dados, 'agencia') || null,
    conta: texto(dados, 'conta') || null,
    conta_contabil_id: contaContabilId,
    codigo_historico_padrao_dominio: codigoHistorico,
    descricao_historico_padrao: texto(dados, 'descricao_historico_padrao') || null,
    apelido: texto(dados, 'apelido') || null,
  });

  if (error) return { erro: error.message };

  revalidatePath(`/empresas/${empresaId}/bancos`);
  return { sucesso: 'Conta bancária cadastrada.' };
}

export async function removerContaBancaria(empresaId: string, id: string) {
  const supabase = await criarClienteServidor();
  await supabase.from('contas_bancarias_empresa').delete().eq('id', id);
  revalidatePath(`/empresas/${empresaId}/bancos`);
}

// ---------------------------------------------------------------------------
// Pessoas especiais (aba Pessoas Especiais)
// ---------------------------------------------------------------------------

export async function criarPessoaEspecial(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const empresaId = texto(dados, 'empresa_id');
  const tipo = texto(dados, 'tipo_identificador') as 'cpf' | 'cnpj' | 'nome';
  const nomeExibicao = texto(dados, 'nome_exibicao');
  const contaContabilId = texto(dados, 'conta_contabil_id');
  const bruto = texto(dados, 'identificador');

  if (!nomeExibicao) return { erro: 'Informe o nome de exibição.' };
  if (!contaContabilId) return { erro: 'Selecione a conta contábil de destino.' };

  // CPF/CNPJ são guardados só com dígitos; nome é guardado normalizado, que é a
  // forma que o motor compara contra o histórico do extrato (seção 4.2).
  let identificador: string;
  if (tipo === 'nome') {
    identificador = normalizarNome(bruto || nomeExibicao);
  } else {
    identificador = apenasDigitos(bruto);
    const tamanhoEsperado = tipo === 'cpf' ? 11 : 14;
    if (identificador.length !== tamanhoEsperado) {
      return { erro: `O ${tipo.toUpperCase()} deve ter ${tamanhoEsperado} dígitos.` };
    }
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from('pessoas_especiais').insert({
    empresa_id: empresaId,
    identificador,
    tipo_identificador: tipo,
    nome_exibicao: nomeExibicao,
    papel: texto(dados, 'papel'),
    conta_contabil_id: contaContabilId,
  });

  if (error) {
    return { erro: error.code === '23505' ? 'Essa pessoa já está cadastrada.' : error.message };
  }

  revalidatePath(`/empresas/${empresaId}/pessoas-especiais`);
  return { sucesso: 'Pessoa especial cadastrada.' };
}

export async function removerPessoaEspecial(empresaId: string, id: string) {
  const supabase = await criarClienteServidor();
  await supabase.from('pessoas_especiais').delete().eq('id', id);
  revalidatePath(`/empresas/${empresaId}/pessoas-especiais`);
}

// ---------------------------------------------------------------------------
// Regras aprendidas (aba Regras)
// ---------------------------------------------------------------------------

export async function atualizarRegra(empresaId: string, id: string, dados: FormData) {
  const contaContabilId = String(dados.get('conta_contabil_id') ?? '');
  const multiplicador = Number(dados.get('multiplicador_outlier') ?? 5);

  const supabase = await criarClienteServidor();
  await supabase
    .from('regras_classificacao')
    .update({
      conta_contabil_id: contaContabilId,
      multiplicador_outlier: Number.isFinite(multiplicador) && multiplicador > 0 ? multiplicador : 5,
    })
    .eq('id', id);

  revalidatePath(`/empresas/${empresaId}/regras`);
}

export async function removerRegra(empresaId: string, id: string) {
  const supabase = await criarClienteServidor();
  await supabase.from('regras_classificacao').delete().eq('id', id);
  revalidatePath(`/empresas/${empresaId}/regras`);
}
