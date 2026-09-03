import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { removerPessoaEspecial } from '../acoes';
import { FormularioPessoaEspecial } from './formulario';

const PAPEIS: Record<string, string> = {
  socio: 'Sócio',
  funcionario: 'Funcionário',
  administrador: 'Administrador',
  parte_relacionada: 'Parte relacionada',
};

export default async function PaginaPessoasEspeciais({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: empresaId } = await params;
  const supabase = await criarClienteServidor();

  const [pessoas, planoContas] = await Promise.all([
    supabase
      .from('pessoas_especiais')
      .select('id, identificador, tipo_identificador, nome_exibicao, papel, plano_contas_empresa ( codigo_conta_dominio, descricao )')
      .eq('empresa_id', empresaId)
      .order('nome_exibicao'),
    supabase
      .from('plano_contas_empresa')
      .select('id, codigo_conta_dominio, descricao')
      .eq('empresa_id', empresaId)
      .order('codigo_conta_dominio'),
  ]);

  const lista = pessoas.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="cartao overflow-x-auto">
        <h2 className="mb-1 text-sm font-semibold">Pessoas especiais</h2>
        <p className="mb-4 text-xs text-slate-500">
          Contrapartes com tratamento contábil fixo. São a camada 1 do motor: classificam direto,
          com confiança alta, independentemente do valor.
        </p>

        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma pessoa especial cadastrada.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Identificador</th>
                <th>Papel</th>
                <th>Conta contábil</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((pessoa) => {
                const conta = pessoa.plano_contas_empresa as unknown as
                  | { codigo_conta_dominio: string; descricao: string }
                  | null;
                return (
                  <tr key={pessoa.id}>
                    <td className="font-medium">{pessoa.nome_exibicao}</td>
                    <td>
                      <span className="font-mono text-xs">{pessoa.identificador}</span>
                      <span className="ml-1 text-xs uppercase text-slate-400">
                        {pessoa.tipo_identificador}
                      </span>
                    </td>
                    <td>{PAPEIS[pessoa.papel] ?? pessoa.papel}</td>
                    <td>
                      {conta ? `${conta.codigo_conta_dominio} — ${conta.descricao}` : '—'}
                    </td>
                    <td className="text-right">
                      <form action={removerPessoaEspecial.bind(null, empresaId, pessoa.id)}>
                        <button className="text-xs text-red-600 underline underline-offset-2">
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(planoContas.data ?? []).length === 0 ? (
        <div className="cartao h-fit text-sm text-slate-600">
          Cadastre contas na aba{' '}
          <Link href={`/empresas/${empresaId}/plano-contas`} className="underline underline-offset-2">
            Plano de Contas
          </Link>{' '}
          antes de vincular pessoas.
        </div>
      ) : (
        <FormularioPessoaEspecial empresaId={empresaId} planoContas={planoContas.data ?? []} />
      )}
    </div>
  );
}
