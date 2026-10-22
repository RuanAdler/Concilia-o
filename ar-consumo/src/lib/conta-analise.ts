import { contaAtual, cicloPorRef, diasEntre, fatiaDaConta, type ContaSalva, type Dia } from './stats';

export type TipoConta = 'lg' | 'estimativa' | 'diferenca' | 'antes' | 'incompleta' | 'semdados';

/** Tudo o que as telas mostram sobre uma conta: período, fatia do ar e como ela foi calculada. */
export function analisarConta(c: ContaSalva, dias: Dia[], semArDia: number) {
  const a = contaAtual(c, dias);
  const f = fatiaDaConta(a, semArDia);
  const auto = cicloPorRef(a.mes, 16);
  const inicio = a.inicio ?? auto.inicio;
  const fim = a.fim ?? auto.fim;
  const tipo: TipoConta = f.antesDoAr ? 'antes' : f.incompleta ? 'incompleta' : f.share == null ? 'semdados' : f.porDiferenca ? 'diferenca' : f.estimada ? 'estimativa' : 'lg';
  const arR = f.custoAr;
  const resto = arR != null ? Math.max(0, a.valor - a.fixas - arR) : null;
  return { c: a, f, inicio, fim, nDias: diasEntre(inicio, fim), tipo, arR, resto };
}

export type AnaliseConta = ReturnType<typeof analisarConta>;
