import { problemasDeConfiguracao } from '@/lib/supabase/configuracao';

/**
 * Painel exibido quando o app subiu sem a configuração do Supabase.
 * Melhor do que uma página em branco: diz exatamente o que falta e onde mexer.
 */
export function ConfiguracaoAusente() {
  const problemas = problemasDeConfiguracao();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="cartao w-full max-w-xl space-y-4">
        <h1 className="text-lg font-semibold">Configuração incompleta</h1>

        <p className="text-sm text-slate-600">
          O app subiu, mas não consegue falar com o Supabase. Nada foi perdido — é só ajustar as
          variáveis de ambiente.
        </p>

        <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">Como corrigir na Vercel</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Settings &gt; Environment Variables</li>
            <li>Corrija os valores acima com os dados de Project Settings &gt; API do Supabase</li>
            <li>
              Deployments &gt; <span className="font-mono text-xs">⋯</span> &gt; Redeploy
            </li>
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            O passo 3 não é opcional: variáveis <span className="font-mono">NEXT_PUBLIC_*</span> são
            embutidas durante o build, então só passam a valer num deploy novo.
          </p>
        </div>
      </div>
    </main>
  );
}
