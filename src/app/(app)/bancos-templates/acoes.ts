'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';

export interface EstadoFormulario {
  erro?: string;
  sucesso?: string;
}

export async function salvarTemplate(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const id = String(dados.get('id') ?? '').trim();
  const nomeBanco = String(dados.get('nome_banco') ?? '').trim();
  const formatoOrigem = String(dados.get('formato_origem') ?? '').trim();
  const regexDocumento = String(dados.get('regex_documento') ?? '').trim() || null;
  const versaoLayout = String(dados.get('versao_layout') ?? '').trim() || 'v1';
  const estruturaTexto = String(dados.get('estrutura_historico') ?? '').trim() || '{}';

  if (!nomeBanco) return { erro: 'Informe o nome do banco.' };
  if (!['pdf', 'ofx', 'csv'].includes(formatoOrigem)) {
    return { erro: 'Formato de origem inválido.' };
  }

  let estrutura: unknown;
  try {
    estrutura = JSON.parse(estruturaTexto);
  } catch {
    return { erro: 'A estrutura do histórico não é um JSON válido.' };
  }

  // Uma regex inválida só apareceria na hora da importação — melhor barrar aqui.
  if (regexDocumento) {
    try {
      new RegExp(regexDocumento);
    } catch {
      return { erro: 'A regex de documento é inválida.' };
    }
  }

  const supabase = await criarClienteServidor();
  const registro = {
    nome_banco: nomeBanco,
    formato_origem: formatoOrigem,
    regex_documento: regexDocumento,
    versao_layout: versaoLayout,
    estrutura_historico: estrutura,
    formato_valor: String(dados.get('formato_valor') ?? 'br_sinal_sufixo').trim(),
  };

  const { error } = id
    ? await supabase.from('bancos_templates').update(registro).eq('id', id)
    : await supabase.from('bancos_templates').insert(registro);

  if (error) {
    return {
      erro:
        error.code === '23505'
          ? 'Já existe um template com esse banco e versão de layout.'
          : error.message,
    };
  }

  revalidatePath('/bancos-templates');
  return { sucesso: id ? 'Template atualizado.' : 'Template cadastrado.' };
}
