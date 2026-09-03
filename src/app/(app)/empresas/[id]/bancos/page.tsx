import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { removerContaBancaria } from '../acoes';
import { FormularioContaBancaria } from './formulario';

export default async function PaginaBancos({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = await params;
  const supabase = await criarClienteServidor();

  const [contas, templates, planoContas] = await Promise.all([
    supabase
      .from('contas_bancarias_empresa')
      .select('id, agencia, conta, apelido, codigo_historico_padrao_dominio, descricao_historico_padrao, bancos_templates ( nome_banco, formato_origem ), plano_contas_empresa ( codigo_conta_dominio, descricao )')
      .eq('empresa_id', empresaId)
      .order('criado_em'),
    supabase.from('bancos_templates').select('id, nome_banco, formato_origem, versao_layout').order('nome_banco'),
    supabase
      .from('plano_contas_empresa')
      .select('id, codigo_conta_dominio, descricao')
      .eq('empresa_id', empresaId)
      .order('codigo_conta_dominio'),
  ]);

  const listaContas = contas.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="cartao overflow-x-auto">
        <h2 className="mb-1 text-sm font-semibold">Contas bancárias</h2>
        <p className="mb-4 text-xs text-slate-500">
          O layout de leitura vem do template do banco; aqui fica só o que é específico da conta,
          incluindo o código de Histórico Padrão do Domínio usado em todo lançamento gerado.
        </p>

        {listaContas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma conta bancária cadastrada.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Banco / Template</th>
                <th>Conta contábil do banco</th>
                <th>Hist. padrão</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listaContas.map((conta) => {
                const template = conta.bancos_templates as unknown as
                  | { nome_banco: string; formato_origem: string }
                  | null;
                const contabil = conta.plano_contas_empresa as unknown as
                  | { codigo_conta_dominio: string; descricao: string }
                  | null;

                return (
                  <tr key={conta.id}>
                    <td>
                      <div className="font-medium">{conta.apelido ?? 'Conta'}</div>
                      <div className="text-xs text-slate-500">
                        Ag. {conta.agencia ?? '—'} · CC {conta.conta ?? '—'}
                      </div>
                    </td>
                    <td>
                      {template?.nome_banco ?? '—'}
                      <span className="ml-1 text-xs uppercase text-slate-400">
                        {template?.formato_origem}
                      </span>
                    </td>
                    <td>
                      {contabil ? (
                        <>
                          <span className="font-mono">{contabil.codigo_conta_dominio}</span>{' '}
                          <span className="text-xs text-slate-500">{contabil.descricao}</span>
                        </>
                      ) : (
                        <span className="text-xs text-red-600">não vinculada</span>
                      )}
                    </td>
                    <td className="font-mono tabular-nums">
                      {conta.codigo_historico_padrao_dominio ?? '—'}
                      {conta.descricao_historico_padrao && (
                        <div className="font-sans text-xs text-slate-500">
                          {conta.descricao_historico_padrao}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <form action={removerContaBancaria.bind(null, empresaId, conta.id)}>
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
          Cadastre primeiro a conta contábil do banco na aba{' '}
          <Link
            href={`/empresas/${empresaId}/plano-contas`}
            className="underline underline-offset-2"
          >
            Plano de Contas
          </Link>
          .
        </div>
      ) : (
        <FormularioContaBancaria
          empresaId={empresaId}
          templates={templates.data ?? []}
          planoContas={planoContas.data ?? []}
        />
      )}
    </div>
  );
}
