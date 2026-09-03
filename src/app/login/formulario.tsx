'use client';

import { useActionState, useState } from 'react';
import { cadastrar, entrar, type EstadoAuth } from './acoes';

const ESTADO_INICIAL: EstadoAuth = {};

export function FormularioAuth() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const acao = modo === 'entrar' ? entrar : cadastrar;
  const [estado, executar, pendente] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={executar} className="cartao space-y-4">
      {modo === 'cadastrar' && (
        <div>
          <label className="rotulo" htmlFor="escritorio">Nome do escritório</label>
          <input id="escritorio" name="escritorio" className="campo" placeholder="Meu Escritório" />
        </div>
      )}

      <div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="campo" />
      </div>

      <div>
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={6}
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          className="campo"
        />
      </div>

      {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      {estado.mensagem && <p className="text-sm text-emerald-700">{estado.mensagem}</p>}

      <button type="submit" className="botao w-full" disabled={pendente}>
        {pendente ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
      </button>

      <button
        type="button"
        className="w-full text-center text-xs text-slate-500 underline underline-offset-2"
        onClick={() => setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')}
      >
        {modo === 'entrar' ? 'Não tenho conta — criar agora' : 'Já tenho conta — entrar'}
      </button>
    </form>
  );
}
