'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface Empresa {
  id: string;
  nome: string;
}

interface Conta {
  id: string;
  empresaId: string;
  rotulo: string;
  formato: string;
}

export function FormularioUpload({
  empresas,
  contas,
}: {
  empresas: Empresa[];
  contas: Conta[];
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState('');
  const [contaId, setContaId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [linhasBrutas, setLinhasBrutas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const contasDaEmpresa = useMemo(
    () => contas.filter((conta) => conta.empresaId === empresaId),
    [contas, empresaId],
  );

  const formatoAceito = contasDaEmpresa.find((conta) => conta.id === contaId)?.formato;

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setLinhasBrutas([]);
    setEnviando(true);

    try {
      const resposta = await fetch('/api/importacao/processar', {
        method: 'POST',
        body: new FormData(evento.currentTarget),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo.erro ?? 'Falha ao processar o arquivo.');
        setLinhasBrutas(corpo.linhasBrutas ?? []);
        return;
      }

      router.push(`/importacao/${corpo.loteId}`);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="cartao h-fit space-y-4">
      <h2 className="text-sm font-semibold">Novo extrato</h2>

      <div>
        <label className="rotulo" htmlFor="empresa">Empresa</label>
        <select
          id="empresa"
          className="campo"
          value={empresaId}
          onChange={(evento) => {
            setEmpresaId(evento.target.value);
            setContaId('');
          }}
        >
          <option value="">Selecione…</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="rotulo" htmlFor="conta_bancaria_id">Conta bancária</label>
        <select
          id="conta_bancaria_id"
          name="conta_bancaria_id"
          className="campo"
          value={contaId}
          onChange={(evento) => setContaId(evento.target.value)}
          disabled={!empresaId}
          required
        >
          <option value="">Selecione…</option>
          {contasDaEmpresa.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.rotulo}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          A conta define o template de leitura — não é preciso escolher o layout.
        </p>
      </div>

      <div>
        <label className="rotulo" htmlFor="arquivo">
          Arquivo do extrato {formatoAceito ? `(${formatoAceito.toUpperCase()})` : ''}
        </label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          required
          accept=".pdf,.ofx,.csv,.txt"
          className="campo file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {linhasBrutas.length > 0 && (
        <details className="rounded border border-amber-200 bg-amber-50 p-3 text-xs" open>
          <summary className="cursor-pointer font-medium text-amber-900">
            Diagnóstico: linhas lidas do arquivo ({linhasBrutas.length} primeiras)
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-amber-950">
            {linhasBrutas.join('\n')}
          </pre>
          <p className="mt-2 text-amber-900">
            Use estas linhas para ajustar o template do banco (padrões de linha ignorada, tokens e
            regex de documento).
          </p>
        </details>
      )}

      <button type="submit" className="botao w-full" disabled={enviando || !contaId}>
        {enviando ? 'Processando…' : 'Processar extrato'}
      </button>
    </form>
  );
}
