'use client';

import { useActionState, useState } from 'react';
import { BotaoSubmit } from '@/components/botao-submit';
import { Mensagem } from '@/components/mensagem';
import { criarPessoaEspecial, type EstadoFormulario } from '../acoes';

const ESTADO_INICIAL: EstadoFormulario = {};

interface ContaContabil {
  id: string;
  codigo_conta_dominio: string;
  descricao: string;
}

export function FormularioPessoaEspecial({
  empresaId,
  planoContas,
}: {
  empresaId: string;
  planoContas: ContaContabil[];
}) {
  const [estado, executar] = useActionState(criarPessoaEspecial, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<'cpf' | 'cnpj' | 'nome'>('cpf');

  return (
    <form action={executar} className="cartao h-fit space-y-4">
      <input type="hidden" name="empresa_id" value={empresaId} />
      <h2 className="text-sm font-semibold">Nova pessoa especial</h2>

      <div>
        <label className="rotulo" htmlFor="nome_exibicao">Nome de exibição</label>
        <input
          id="nome_exibicao"
          name="nome_exibicao"
          required
          className="campo"
          placeholder="Luiz Carlos L Almeida Jr"
        />
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <div>
          <label className="rotulo" htmlFor="tipo_identificador">Tipo</label>
          <select
            id="tipo_identificador"
            name="tipo_identificador"
            className="campo"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as 'cpf' | 'cnpj' | 'nome')}
          >
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
            <option value="nome">Nome</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="identificador">Identificador</label>
          <input
            id="identificador"
            name="identificador"
            className="campo"
            placeholder={tipo === 'nome' ? 'Deixe vazio para usar o nome acima' : 'Só dígitos'}
          />
        </div>
      </div>
      {tipo === 'nome' && (
        <p className="-mt-2 text-xs text-slate-500">
          Casamento por nome exige pelo menos 5 caracteres e é feito por conteúdo dentro do
          histórico — use quando o Pix/TED não traz documento.
        </p>
      )}

      <div>
        <label className="rotulo" htmlFor="papel">Papel</label>
        <select id="papel" name="papel" required className="campo" defaultValue="socio">
          <option value="socio">Sócio</option>
          <option value="funcionario">Funcionário</option>
          <option value="administrador">Administrador</option>
          <option value="parte_relacionada">Parte relacionada</option>
        </select>
      </div>

      <div>
        <label className="rotulo" htmlFor="conta_contabil_id">Conta contábil</label>
        <select id="conta_contabil_id" name="conta_contabil_id" required className="campo">
          <option value="">Selecione…</option>
          {planoContas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.codigo_conta_dominio} — {conta.descricao}
            </option>
          ))}
        </select>
      </div>

      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <BotaoSubmit>Cadastrar</BotaoSubmit>
    </form>
  );
}
