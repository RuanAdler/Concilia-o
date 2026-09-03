'use client';

import { useActionState } from 'react';
import { BotaoSubmit } from '@/components/botao-submit';
import { Mensagem } from '@/components/mensagem';
import { criarContaContabil, type EstadoFormulario } from '../acoes';

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioContaContabil({ empresaId }: { empresaId: string }) {
  const [estado, executar] = useActionState(criarContaContabil, ESTADO_INICIAL);

  return (
    <form action={executar} className="cartao h-fit space-y-4">
      <input type="hidden" name="empresa_id" value={empresaId} />
      <h2 className="text-sm font-semibold">Nova conta contábil</h2>

      <div>
        <label className="rotulo" htmlFor="codigo_conta_dominio">Código no Domínio</label>
        <input id="codigo_conta_dominio" name="codigo_conta_dominio" required className="campo" placeholder="504" />
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">Descrição</label>
        <input id="descricao" name="descricao" required className="campo" placeholder="Clientes Diversos" />
      </div>

      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <BotaoSubmit>Cadastrar</BotaoSubmit>
    </form>
  );
}
