'use client';

import { useActionState } from 'react';
import { BotaoSubmit } from '@/components/botao-submit';
import { Mensagem } from '@/components/mensagem';
import { criarContaBancaria, type EstadoFormulario } from '../acoes';

const ESTADO_INICIAL: EstadoFormulario = {};

interface Template {
  id: string;
  nome_banco: string;
  formato_origem: string;
  versao_layout: string;
}

interface ContaContabil {
  id: string;
  codigo_conta_dominio: string;
  descricao: string;
}

export function FormularioContaBancaria({
  empresaId,
  templates,
  planoContas,
}: {
  empresaId: string;
  templates: Template[];
  planoContas: ContaContabil[];
}) {
  const [estado, executar] = useActionState(criarContaBancaria, ESTADO_INICIAL);

  return (
    <form action={executar} className="cartao h-fit space-y-4">
      <input type="hidden" name="empresa_id" value={empresaId} />
      <h2 className="text-sm font-semibold">Nova conta bancária</h2>

      <div>
        <label className="rotulo" htmlFor="banco_template_id">Template de banco</label>
        <select id="banco_template_id" name="banco_template_id" required className="campo">
          <option value="">Selecione…</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.nome_banco} ({template.formato_origem.toUpperCase()} · {template.versao_layout})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo" htmlFor="agencia">Agência</label>
          <input id="agencia" name="agencia" className="campo" placeholder="4231-5" />
        </div>
        <div>
          <label className="rotulo" htmlFor="conta">Conta</label>
          <input id="conta" name="conta" className="campo" placeholder="108959-5" />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="apelido">Apelido</label>
        <input id="apelido" name="apelido" className="campo" placeholder="BB Conta Movimento" />
      </div>

      <div>
        <label className="rotulo" htmlFor="conta_contabil_id">Conta contábil do banco</label>
        <select id="conta_contabil_id" name="conta_contabil_id" required className="campo">
          <option value="">Selecione…</option>
          {planoContas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.codigo_conta_dominio} — {conta.descricao}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Vai no campo 3 ou 4 do registro 6100, conforme o sinal do lançamento.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <div>
          <label className="rotulo" htmlFor="codigo_historico_padrao_dominio">Cód. histórico</label>
          <input
            id="codigo_historico_padrao_dominio"
            name="codigo_historico_padrao_dominio"
            required
            className="campo"
            placeholder="75"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="descricao_historico_padrao">Descrição (conferência)</label>
          <input
            id="descricao_historico_padrao"
            name="descricao_historico_padrao"
            className="campo"
            placeholder="VALOR REF. A"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Código já cadastrado dentro do Domínio em Arquivos &gt; Históricos Padrões. É único por
        conta bancária e nunca compartilhado com outra empresa.
      </p>

      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <BotaoSubmit>Cadastrar</BotaoSubmit>
    </form>
  );
}
