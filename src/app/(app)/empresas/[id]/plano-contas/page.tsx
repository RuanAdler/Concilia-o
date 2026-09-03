import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { removerContaContabil } from '../acoes';
import { FormularioContaContabil } from './formulario';

export default async function PaginaPlanoContas({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = await params;
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from('plano_contas_empresa')
    .select('id, codigo_conta_dominio, descricao')
    .eq('empresa_id', empresaId)
    .order('codigo_conta_dominio');

  const contas = data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="cartao">
        <h2 className="mb-1 text-sm font-semibold">Contas contábeis desta empresa</h2>
        <p className="mb-4 text-xs text-slate-500">
          Só o subconjunto relevante para classificação — não precisa replicar o plano inteiro do
          Domínio. Estes códigos pertencem exclusivamente a esta empresa e nunca são copiados de
          outra.
        </p>

        {contas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Código Domínio</th>
                <th>Descrição</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id}>
                  <td className="font-mono tabular-nums">{conta.codigo_conta_dominio}</td>
                  <td>{conta.descricao}</td>
                  <td className="text-right">
                    <form action={removerContaContabil.bind(null, empresaId, conta.id)}>
                      <button className="text-xs text-red-600 underline underline-offset-2">
                        Remover
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <FormularioContaContabil empresaId={empresaId} />
    </div>
  );
}
