'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { apenasDigitos } from '@/lib/nucleo/texto';

export interface EstadoFormulario {
  erro?: string;
  sucesso?: string;
}

export async function criarEmpresa(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const nome = String(dados.get('nome') ?? '').trim();
  const cnpj = apenasDigitos(String(dados.get('cnpj') ?? ''));
  const segmento = String(dados.get('segmento') ?? '').trim() || null;

  if (!nome) return { erro: 'Informe a razão social.' };
  if (cnpj.length !== 14) return { erro: 'O CNPJ deve ter 14 dígitos.' };

  const supabase = await criarClienteServidor();

  const { data: membro, error: erroMembro } = await supabase
    .from('membros_escritorio')
    .select('escritorio_id')
    .limit(1)
    .maybeSingle();

  if (erroMembro || !membro) {
    return { erro: 'Não foi possível identificar o escritório do usuário.' };
  }

  const { error } = await supabase.from('empresas').insert({
    escritorio_id: membro.escritorio_id,
    nome,
    cnpj,
    segmento,
  });

  if (error) {
    return {
      erro: error.code === '23505' ? 'Já existe uma empresa com esse CNPJ.' : error.message,
    };
  }

  revalidatePath('/empresas');
  return { sucesso: 'Empresa cadastrada.' };
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const supabase = await criarClienteServidor();
  await supabase.from('empresas').update({ ativo }).eq('id', id);
  revalidatePath('/empresas');
}
