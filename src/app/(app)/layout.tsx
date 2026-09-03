import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/cliente-servidor';

const NAVEGACAO = [
  { href: '/empresas', rotulo: 'Empresas' },
  { href: '/importacao', rotulo: 'Importação' },
  { href: '/bancos-templates', rotulo: 'Templates de Banco' },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/empresas" className="text-sm font-semibold tracking-tight">
            Conciliação Bancária
          </Link>

          <nav className="flex flex-1 gap-4 text-sm text-slate-600">
            {NAVEGACAO.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-slate-900">
                {item.rotulo}
              </Link>
            ))}
          </nav>

          <span className="hidden text-xs text-slate-400 sm:inline">{usuario.email}</span>
          <form action="/auth/sair" method="post">
            <button type="submit" className="text-xs text-slate-500 underline underline-offset-2">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
