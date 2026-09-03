import { createBrowserClient } from '@supabase/ssr';
import { CHAVE_ANONIMA_SUPABASE, URL_SUPABASE } from './configuracao';

export function criarClienteNavegador() {
  return createBrowserClient(
    URL_SUPABASE,
    CHAVE_ANONIMA_SUPABASE,
  );
}
