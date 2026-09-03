import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/auth'];

/** Renova a sessão a cada request e protege as rotas do app. */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesParaDefinir: Array<{ name: string; value: string; options: CookieOptions }>) => {
          for (const { name, value } of cookiesParaDefinir) {
            request.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesParaDefinir) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const caminho = request.nextUrl.pathname;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => caminho.startsWith(rota));

  if (!data.user && !ehPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login';
    destino.searchParams.set('proximo', caminho);
    return NextResponse.redirect(destino);
  }

  if (data.user && caminho === '/login') {
    const destino = request.nextUrl.clone();
    destino.pathname = '/empresas';
    destino.search = '';
    return NextResponse.redirect(destino);
  }

  return resposta;
}
