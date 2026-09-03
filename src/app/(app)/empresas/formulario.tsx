'use client';

import { useActionState } from 'react';
import { BotaoSubmit } from '@/components/botao-submit';
import { Mensagem } from '@/components/mensagem';
import { criarEmpresa, type EstadoFormulario } from './acoes';

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioEmpresa() {
  const [estado, executar] = useActionState(criarEmpresa, ESTADO_INICIAL);

  return (
    <form action={executar} className="cartao h-fit space-y-4">
      <h2 className="text-sm font-semibold">Nova empresa</h2>

      <div>
        <label className="rotulo" htmlFor="nome">Razão social</label>
        <input id="nome" name="nome" required className="campo" placeholder="LCI Serviços Médicos Ltda" />
      </div>

      <div>
        <label className="rotulo" htmlFor="cnpj">CNPJ</label>
        <input id="cnpj" name="cnpj" required className="campo" placeholder="17401989000148" />
      </div>

      <div>
        <label className="rotulo" htmlFor="segmento">Segmento</label>
        <input id="segmento" name="segmento" className="campo" placeholder="Clínica médica" />
      </div>

      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <BotaoSubmit>Cadastrar</BotaoSubmit>
    </form>
  );
}
