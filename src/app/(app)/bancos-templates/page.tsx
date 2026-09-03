import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { FormularioTemplate } from './formulario';

export default async function PaginaTemplates({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const { editar } = await searchParams;
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from('bancos_templates')
    .select('id, nome_banco, formato_origem, versao_layout, regex_documento, estrutura_historico, formato_valor')
    .order('nome_banco');

  const templates = data ?? [];
  const emEdicao = templates.find((template) => template.id === editar) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Templates de Banco</h1>
        <p className="text-sm text-slate-500">
          Cadastro global de como ler o extrato de cada banco. Nunca guarda código contábil nem
          código de histórico — isso é sempre da empresa.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="cartao">
          <h2 className="mb-4 text-sm font-semibold">Bancos suportados</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum template cadastrado.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Banco</th>
                  <th>Formato</th>
                  <th>Layout</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="font-medium">{template.nome_banco}</td>
                    <td className="uppercase">{template.formato_origem}</td>
                    <td>{template.versao_layout}</td>
                    <td className="text-right">
                      <a
                        href={`/bancos-templates?editar=${template.id}`}
                        className="text-xs underline underline-offset-2"
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <FormularioTemplate key={emEdicao?.id ?? 'novo'} template={emEdicao} />
      </div>
    </div>
  );
}
