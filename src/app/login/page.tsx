import { ConfiguracaoAusente } from '@/components/configuracao-ausente';
import { supabaseConfigurado } from '@/lib/supabase/configuracao';
import { FormularioAuth } from './formulario';

export default function PaginaLogin() {
  if (!supabaseConfigurado) return <ConfiguracaoAusente />;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Conciliação Bancária</h1>
        <p className="mt-1 mb-6 text-center text-sm text-slate-500">
          Acesso ao painel do escritório
        </p>
        <FormularioAuth />
      </div>
    </main>
  );
}
