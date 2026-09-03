import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';

const ABAS = [
  { slug: 'bancos', rotulo: 'Bancos' },
  { slug: 'plano-contas', rotulo: 'Plano de Contas' },
  { slug: 'pessoas-especiais', rotulo: 'Pessoas Especiais' },
  { slug: 'regras', rotulo: 'Regras' },
];

export default async function LayoutEmpresa({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome, cnpj, segmento')
    .eq('id', id)
    .maybeSingle();

  if (!empresa) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/empresas" className="text-xs text-slate-500 underline underline-offset-2">
          ← Empresas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{empresa.nome}</h1>
        <p className="text-sm text-slate-500">
          CNPJ {empresa.cnpj}
          {empresa.segmento ? ` · ${empresa.segmento}` : ''}
        </p>
      </div>

      <nav className="flex gap-1 border-b border-slate-200">
        {ABAS.map((aba) => (
          <Link
            key={aba.slug}
            href={`/empresas/${id}/${aba.slug}`}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
