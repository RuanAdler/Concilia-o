import { describe, expect, it } from 'vitest';
import { similaridade } from '@/lib/classificacao/similaridade';
import { normalizarHistorico } from '@/lib/nucleo/texto';

/**
 * Os 21 tipos de operação distintos que aparecem no extrato real do Banco do
 * Brasil usado como referência (agosto/2026, 205 lançamentos). São rótulos do
 * banco, não dados de cliente.
 *
 * A camada 3 do motor compara por similaridade, então dois tipos diferentes
 * casarem seria um erro grave e silencioso: um lançamento de saída classificado
 * na conta de entrada só apareceria como diferença de saldo no fim do mês.
 */
const TIPOS_REAIS = [
  'BB GIRO FGO PRONAMPE',
  'Cheque Compensado',
  'Dep dinheiro inter ag',
  'Pagamento de Boleto',
  'Pagamento de Impostos',
  'Pagto conta telefone',
  'Pix - Enviado',
  'Pix - Recebido',
  'Pix-Recebido QR Code',
  'Recebimento Fornecedor',
  'Recebimentos Diversos',
  'Seg Créd Proteg Empresa',
  'TED-Crédito em Conta',
  'TED-Pag Fornecedores',
  'Tarifa MSG - Mês Anterior',
  'Tarifa Pacote de Serviços',
  'Tarifa Pix Enviado',
  'Tarifa Pix Recebido',
  'Tarifa Renovação Cadastro',
  'Transferência enviada',
  'Transferência recebida',
];

const LIMIAR = 0.85;

function casam(a: string, b: string): boolean {
  return similaridade(normalizarHistorico(a), normalizarHistorico(b)) >= LIMIAR;
}

describe('camada 3 sobre os tipos reais do extrato', () => {
  it('só unifica a variação de QR Code, como a especificação pede', () => {
    const pares: string[] = [];

    for (let i = 0; i < TIPOS_REAIS.length; i++) {
      for (let j = i + 1; j < TIPOS_REAIS.length; j++) {
        if (casam(TIPOS_REAIS[i], TIPOS_REAIS[j])) {
          pares.push(`${TIPOS_REAIS[i]} <-> ${TIPOS_REAIS[j]}`);
        }
      }
    }

    expect(pares).toEqual(['Pix - Recebido <-> Pix-Recebido QR Code']);
  });

  it('nunca confunde entrada com saída', () => {
    expect(casam('Pix - Recebido', 'Pix - Enviado')).toBe(false);
    expect(casam('Transferência recebida', 'Transferência enviada')).toBe(false);
    expect(casam('Tarifa Pix Recebido', 'Tarifa Pix Enviado')).toBe(false);
  });

  it('mantém as tarifas separadas por subtipo', () => {
    // A especificação prevê que cada subtipo de tarifa possa ir para uma conta
    // própria. No extrato de referência todas caem em 374, mas unificá-las aqui
    // tiraria do usuário a possibilidade de separar.
    expect(casam('Tarifa Pacote de Serviços', 'Tarifa Renovação Cadastro')).toBe(false);
    expect(casam('Tarifa MSG - Mês Anterior', 'Tarifa Pix Recebido')).toBe(false);
  });
});
