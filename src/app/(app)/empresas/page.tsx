import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { FormularioEmpresa } from './formulario';

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  segmento: string | null;
  ativo: boolean;
}

function formatarCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default async function PaginaEmpresas({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from('empresas')
    .select('id, nome, cnpj, segmento, ativo')
    .order('nome');

  if (busca?.trim()) {
    const termo = busca.trim();
    consulta = consulta.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%`);
  }

  const { data, error } = await consulta;
  const empresas = (data ?? []) as Empresa[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-slate-500">Clientes do escritório atendidos pela conciliação.</p>
        </div>

        <form className="flex gap-2">
          <input
            name="busca"
            defaultValue={busca ?? ''}
            placeholder="Buscar por nome ou CNPJ"
            className="campo w-64"
          />
          <button type="submit" className="botao-secundario">Buscar</button>
        </form>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="cartao overflow-x-auto">
          {empresas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>CNPJ</th>
                  <th>Segmento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td>
                      <Link
                        href={`/empresas/${empresa.id}/bancos`}
                        className="font-medium text-slate-900 underline underline-offset-2"
                      >
                        {empresa.nome}
                      </Link>
                    </td>
                    <td className="tabular-nums">{formatarCnpj(empresa.cnpj)}</td>
                    <td>{empresa.segmento ?? '—'}</td>
                    <td>
                      <span
                        className={
                          empresa.ativo
                            ? 'rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'
                            : 'rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                        }
                      >
                        {empresa.ativo ? 'Ativa' : 'Arquivada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <FormularioEmpresa />
      </div>
    </div>
  );
}
