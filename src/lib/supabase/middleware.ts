import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { CHAVE_ANONIMA_SUPABASE, URL_SUPABASE, problemasDeConfiguracao } from './configuracao';

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/auth'];

/**
 * Renova a sessão a cada request e redireciona quem não está autenticado.
 *
 * O middleware roda em TODA rota: se ele lança, o site inteiro devolve 500 e
 * nem a tela de login carrega. Por isso ele degrada em vez de quebrar — deixa o
 * request seguir e registra o motivo no log.
 *
 * Deixar passar é seguro: quem realmente barra o acesso é o layout do app (que
 * checa o usuário e redireciona) e, sobretudo, o RLS no Postgres. O middleware
 * é conveniência de navegação, não a fronteira de segurança.
 */
export async function atualizarSessao(request: NextRequest) {
  const problemas = problemasDeConfiguracao();
  if (problemas.length > 0) {
    console.error('[supabase] configuração ausente ou inválida:', problemas.join(' '));
    return NextResponse.next({ request });
  }

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(URL_SUPABASE, CHAVE_ANONIMA_SUPABASE, {
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
  });

  let usuarioAutenticado = false;
  try {
    const { data } = await supabase.auth.getUser();
    usuarioAutenticado = Boolean(data.user);
  } catch (erro) {
    // Indisponibilidade momentânea do Supabase não pode derrubar o site.
    console.error('[supabase] falha ao validar a sessão no middleware:', erro);
    return resposta;
  }

  const caminho = request.nextUrl.pathname;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => caminho.startsWith(rota));

  if (!usuarioAutenticado && !ehPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login';
    destino.searchParams.set('proximo', caminho);
    return NextResponse.redirect(destino);
  }

  if (usuarioAutenticado && caminho === '/login') {
    const destino = request.nextUrl.clone();
    destino.pathname = '/empresas';
    destino.search = '';
    return NextResponse.redirect(destino);
  }

  return resposta;
}
