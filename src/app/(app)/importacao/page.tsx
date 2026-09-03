import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { FormularioUpload } from './formulario-upload';

export default async function PaginaImportacao() {
  const supabase = await criarClienteServidor();

  const [empresas, contas, lotes] = await Promise.all([
    supabase.from('empresas').select('id, nome').eq('ativo', true).order('nome'),
    supabase
      .from('contas_bancarias_empresa')
      .select('id, empresa_id, apelido, agencia, conta, bancos_templates ( nome_banco, formato_origem )')
      .order('criado_em'),
    supabase
      .from('lotes_importacao')
      .select('id, periodo_inicio, periodo_fim, status, criado_em, nome_arquivo, empresas ( nome )')
      .order('criado_em', { ascending: false })
      .limit(10),
  ]);

  const listaContas = (contas.data ?? []).map((conta) => {
    const template = conta.bancos_templates as unknown as
      | { nome_banco: string; formato_origem: string }
      | null;
    return {
      id: conta.id as string,
      empresaId: conta.empresa_id as string,
      rotulo: `${conta.apelido ?? 'Conta'} — ${template?.nome_banco ?? 'banco'} · Ag. ${
        conta.agencia ?? '—'
      } / CC ${conta.conta ?? '—'}`,
      formato: template?.formato_origem ?? 'pdf',
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Importação de extrato</h1>
        <p className="text-sm text-slate-500">
          O arquivo é processado em memória e descartado — só o resultado da leitura fica gravado.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <FormularioUpload empresas={empresas.data ?? []} contas={listaContas} />

        <div className="cartao">
          <h2 className="mb-4 text-sm font-semibold">Importações recentes</h2>
          {(lotes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma importação ainda.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Período</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(lotes.data ?? []).map((lote) => {
                  const empresa = lote.empresas as unknown as { nome: string } | null;
                  return (
                    <tr key={lote.id}>
                      <td>
                        <Link
                          href={`/importacao/${lote.id}`}
                          className="underline underline-offset-2"
                        >
                          {empresa?.nome ?? '—'}
                        </Link>
                        <div className="text-xs text-slate-400">{lote.nome_arquivo}</div>
                      </td>
                      <td className="text-xs tabular-nums">
                        {lote.periodo_inicio ?? '—'} a {lote.periodo_fim ?? '—'}
                      </td>
                      <td className="text-xs">{lote.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
