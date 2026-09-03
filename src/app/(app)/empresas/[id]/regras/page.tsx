import { criarClienteServidor } from '@/lib/supabase/cliente-servidor';
import { atualizarRegra, removerRegra } from '../acoes';

const ROTULO_CHAVE: Record<string, string> = {
  tipo_operacao: 'Tipo de operação',
  cnpj_cpf: 'CNPJ/CPF',
  pessoa_especial: 'Pessoa especial',
  valor_recorrente: 'Valor recorrente',
};

export default async function PaginaRegras({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = await params;
  const supabase = await criarClienteServidor();

  const [regras, planoContas] = await Promise.all([
    supabase
      .from('regras_classificacao')
      .select('id, tipo_chave, valor_chave, conta_contabil_id, confianca, origem, multiplicador_outlier, criado_em, ultima_utilizacao, bancos_templates ( nome_banco )')
      .eq('empresa_id', empresaId)
      .order('tipo_chave')
      .order('valor_chave'),
    supabase
      .from('plano_contas_empresa')
      .select('id, codigo_conta_dominio, descricao')
      .eq('empresa_id', empresaId)
      .order('codigo_conta_dominio'),
  ]);

  const lista = regras.data ?? [];
  const contas = planoContas.data ?? [];

  return (
    <div className="cartao overflow-x-auto">
      <h2 className="mb-1 text-sm font-semibold">Regras de classificação aprendidas</h2>
      <p className="mb-4 text-xs text-slate-500">
        Criadas automaticamente quando um lançamento é vinculado à mão na tela de importação.
        Corrigir aqui evita esperar o próximo lançamento daquele tipo para consertar um vínculo
        errado.
      </p>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma regra ainda. Elas aparecem sozinhas conforme você classifica lançamentos.
        </p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Chave</th>
              <th>Valor</th>
              <th>Banco</th>
              <th>Conta contábil</th>
              <th>Outlier</th>
              <th>Origem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((regra) => {
              const banco = regra.bancos_templates as unknown as { nome_banco: string } | null;
              return (
                <tr key={regra.id}>
                  <td className="whitespace-nowrap text-xs">{ROTULO_CHAVE[regra.tipo_chave]}</td>
                  <td className="font-mono text-xs">{regra.valor_chave}</td>
                  <td className="text-xs">{banco?.nome_banco ?? 'Todos'}</td>
                  <td colSpan={3}>
                    <form
                      action={atualizarRegra.bind(null, empresaId, regra.id)}
                      className="flex items-center gap-2"
                    >
                      <select
                        name="conta_contabil_id"
                        defaultValue={regra.conta_contabil_id}
                        className="campo w-56 py-1"
                      >
                        {contas.map((conta) => (
                          <option key={conta.id} value={conta.id}>
                            {conta.codigo_conta_dominio} — {conta.descricao}
                          </option>
                        ))}
                      </select>
                      <input
                        name="multiplicador_outlier"
                        type="number"
                        step="0.5"
                        min="1"
                        defaultValue={regra.multiplicador_outlier}
                        className="campo w-20 py-1"
                        title="Múltiplo da mediana histórica acima do qual o valor vira outlier"
                      />
                      <span className="text-xs text-slate-400">{regra.origem}</span>
                      <button className="botao-secundario py-1">Salvar</button>
                    </form>
                  </td>
                  <td className="text-right">
                    <form action={removerRegra.bind(null, empresaId, regra.id)}>
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
  );
}
