import { createHash } from 'node:crypto';

/**
 * Hash de deduplicação (seção 3.8): data + valor + histórico normalizado + documento.
 * Determinístico e estável entre importações — é o que permite avisar o usuário
 * que ele está reimportando um extrato já processado.
 */
export function calcularHashDeduplicacao(entrada: {
  data: string;
  valor: number;
  historicoNormalizado: string;
  documento?: string | null;
}): string {
  const partes = [
    entrada.data,
    entrada.valor.toFixed(2),
    entrada.historicoNormalizado,
    entrada.documento ?? '',
  ].join('|');

  return createHash('sha256').update(partes, 'utf8').digest('hex');
}
