/**
 * Configuração do Supabase lida do ambiente.
 *
 * Atenção: variáveis `NEXT_PUBLIC_*` são substituídas em tempo de BUILD pelo
 * Next.js. Corrigir o valor no painel da Vercel não basta — é preciso um novo
 * deploy para o valor entrar em vigor.
 */

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const CHAVE_ANONIMA_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Valores que vêm do `.env.example` e passam despercebidos num deploy apressado. */
const VALORES_DE_EXEMPLO = [/xxxxxxxxxxxx\.supabase\.co/i, /^eyJhbGciOi\.\.\./];

function pareceExemplo(valor: string): boolean {
  return VALORES_DE_EXEMPLO.some((padrao) => padrao.test(valor));
}

/** Lista legível do que falta — usada nas telas e nos logs. */
export function problemasDeConfiguracao(): string[] {
  const problemas: string[] = [];

  if (!URL_SUPABASE) {
    problemas.push('NEXT_PUBLIC_SUPABASE_URL não está definida.');
  } else if (pareceExemplo(URL_SUPABASE)) {
    problemas.push(`NEXT_PUBLIC_SUPABASE_URL ainda está com o valor de exemplo (${URL_SUPABASE}).`);
  }

  if (!CHAVE_ANONIMA_SUPABASE) {
    problemas.push('NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida.');
  } else if (pareceExemplo(CHAVE_ANONIMA_SUPABASE)) {
    problemas.push('NEXT_PUBLIC_SUPABASE_ANON_KEY ainda está com o valor de exemplo.');
  }

  return problemas;
}

export const supabaseConfigurado = problemasDeConfiguracao().length === 0;
