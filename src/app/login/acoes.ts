'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';

export interface EstadoAuth {
  erro?: string;
  mensagem?: string;
}

export async function entrar(_estado: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const email = String(dados.get('email') ?? '').trim();
  const senha = String(dados.get('senha') ?? '');

  if (!email || !senha) return { erro: 'Informe e-mail e senha.' };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) return { erro: traduzirErro(error.message) };

  revalidatePath('/', 'layout');
  redirect('/empresas');
}

export async function cadastrar(_estado: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const email = String(dados.get('email') ?? '').trim();
  const senha = String(dados.get('senha') ?? '');
  const escritorio = String(dados.get('escritorio') ?? '').trim();

  if (!email || senha.length < 6) {
    return { erro: 'Informe um e-mail válido e uma senha com pelo menos 6 caracteres.' };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { escritorio: escritorio || 'Meu Escritório' },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/empresas`,
    },
  });

  if (error) return { erro: traduzirErro(error.message) };

  // Com confirmação de e-mail ligada no Supabase, não há sessão neste ponto.
  if (!data.session) {
    return { mensagem: 'Conta criada. Confirme o e-mail que enviamos e faça login.' };
  }

  revalidatePath('/', 'layout');
  redirect('/empresas');
}

function traduzirErro(mensagem: string): string {
  if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha incorretos.';
  if (/user already registered/i.test(mensagem)) return 'Já existe uma conta com esse e-mail.';
  if (/email not confirmed/i.test(mensagem)) return 'Confirme seu e-mail antes de entrar.';
  return mensagem;
}
