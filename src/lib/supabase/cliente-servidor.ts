import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Toda consulta passa por RLS — a sessão do usuário é quem define o escopo.
 */
export async function criarClienteServidor() {
  const armazenamento = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => armazenamento.getAll(),
        setAll: (cookiesParaDefinir: Array<{ name: string; value: string; options: CookieOptions }>) => {
          try {
            for (const { name, value, options } of cookiesParaDefinir) {
              armazenamento.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie; o middleware já renova
            // a sessão antes de a página renderizar.
          }
        },
      },
    },
  );
}

/** Retorna o usuário autenticado ou `null`. */
export async function usuarioAtual() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
