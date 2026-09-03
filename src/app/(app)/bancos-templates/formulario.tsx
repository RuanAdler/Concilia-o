'use client';

import { useActionState } from 'react';
import { BotaoSubmit } from '@/components/botao-submit';
import { Mensagem } from '@/components/mensagem';
import { salvarTemplate, type EstadoFormulario } from './acoes';

const ESTADO_INICIAL: EstadoFormulario = {};

interface Template {
  id: string;
  nome_banco: string;
  formato_origem: string;
  versao_layout: string;
  regex_documento: string | null;
  estrutura_historico: unknown;
  formato_valor: string;
}

export function FormularioTemplate({ template }: { template: Template | null }) {
  const [estado, executar] = useActionState(salvarTemplate, ESTADO_INICIAL);

  return (
    <form action={executar} className="cartao h-fit space-y-4">
      <input type="hidden" name="id" value={template?.id ?? ''} />
      <h2 className="text-sm font-semibold">
        {template ? `Editar: ${template.nome_banco}` : 'Novo template'}
      </h2>

      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
        <div>
          <label className="rotulo" htmlFor="nome_banco">Banco</label>
          <input
            id="nome_banco"
            name="nome_banco"
            required
            defaultValue={template?.nome_banco ?? ''}
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="formato_origem">Formato</label>
          <select
            id="formato_origem"
            name="formato_origem"
            className="campo"
            defaultValue={template?.formato_origem ?? 'pdf'}
          >
            <option value="pdf">PDF</option>
            <option value="ofx">OFX</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="versao_layout">Layout</label>
          <input
            id="versao_layout"
            name="versao_layout"
            defaultValue={template?.versao_layout ?? 'v1'}
            className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="regex_documento">Regex de CPF/CNPJ</label>
        <input
          id="regex_documento"
          name="regex_documento"
          defaultValue={template?.regex_documento ?? ''}
          className="campo font-mono text-xs"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="formato_valor">Formato de valor</label>
        <input
          id="formato_valor"
          name="formato_valor"
          defaultValue={template?.formato_valor ?? 'br_sinal_sufixo'}
          className="campo"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="estrutura_historico">Estrutura do histórico (JSON)</label>
        <textarea
          id="estrutura_historico"
          name="estrutura_historico"
          rows={14}
          className="campo font-mono text-xs"
          defaultValue={JSON.stringify(template?.estrutura_historico ?? {}, null, 2)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Campos aceitos: <code>modo</code>, <code>validarDigitoDocumento</code>,{' '}
          <code>maxLinhasComplemento</code>, <code>tokensIgnorarRegex</code>,{' '}
          <code>linhasIgnorar</code>, <code>sinonimos</code>, <code>colunas</code>,{' '}
          <code>separadorCsv</code>.
        </p>
      </div>

      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <BotaoSubmit>{template ? 'Salvar alterações' : 'Cadastrar'}</BotaoSubmit>
    </form>
  );
}
