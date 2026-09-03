import { describe, expect, it } from 'vitest';
import { parsearLinhasBancoDoBrasil } from '@/lib/parsers/banco-do-brasil-pdf';
import type { EstruturaHistorico } from '@/lib/parsers/tipos';

const ESTRUTURA: EstruturaHistorico = {
  modo: 'duas_linhas',
  validarDigitoDocumento: true,
  maxLinhasComplemento: 3,
};

/**
 * Linhas no formato que a extração posicional produz a partir do PDF do BB:
 * âncora (data ... valor com sinal) seguida da linha de complemento.
 */
const LINHAS = [
  'Banco do Brasil - Extrato de Conta Corrente',
  'Agência 4231-5  Conta 108959-5  Período 01/08/2026 a 31/08/2026',
  'Data Dependência Histórico Documento Valor R$',
  'Saldo Anterior 1.500,00 (+)',
  '03/08/2026 4231-5 Pix-Recebido QR Code 00003833265590 45,00 (+)',
  '03/08 11:01 00003833265590 MARCONI DOS',
  '04/08/2026 4231-5 Pix - Enviado 00004411220033 650,00 (-)',
  '04/08 08:42 CLEDSON ALVES DE SOUZA SA',
  '05/08/2026 4231-5 Tarifa Pix Enviado 1,90 (-)',
  'S A L D O 894,10 (+)',
];

describe('parsearLinhasBancoDoBrasil', () => {
  const resultado = parsearLinhasBancoDoBrasil(LINHAS, ESTRUTURA);

  it('lê um lançamento por par de linhas, ignorando cabeçalho e saldos', () => {
    expect(resultado.lancamentos).toHaveLength(3);
  });

  it('deriva o sentido a partir do sinal do extrato', () => {
    expect(resultado.lancamentos.map((l) => l.tipo)).toEqual(['credito', 'debito', 'debito']);
  });

  it('sempre devolve valor positivo', () => {
    expect(resultado.lancamentos.map((l) => l.valor)).toEqual([45, 650, 1.9]);
  });

  it('separa tipo de operação (linha 1) do complemento (linha 2)', () => {
    const primeiro = resultado.lancamentos[0];
    expect(primeiro.tipoOperacao).toBe('Pix-Recebido QR Code');
    expect(primeiro.complemento).toBe('03/08 11:01 00003833265590 MARCONI DOS');
  });

  it('monta o histórico bruto como tipo + complemento (campo 7 do 6100)', () => {
    expect(resultado.lancamentos[0].historicoBruto).toBe(
      'Pix-Recebido QR Code 03/08 11:01 00003833265590 MARCONI DOS',
    );
    expect(resultado.lancamentos[1].historicoBruto).toBe(
      'Pix - Enviado 04/08 08:42 CLEDSON ALVES DE SOUZA SA',
    );
  });

  it('não duplica o tipo quando a linha de complemento já o repete', () => {
    const comRepeticao = parsearLinhasBancoDoBrasil(
      [
        '03/08/2026 4231-5 Pix-Recebido QR Code 00003833265590 45,00 (+)',
        'Pix-Recebido QR Code 03/08 11:01 00003833265590 MARCONI DOS',
      ],
      ESTRUTURA,
    );
    expect(comRepeticao.lancamentos[0].historicoBruto).toBe(
      'Pix-Recebido QR Code 03/08 11:01 00003833265590 MARCONI DOS',
    );
  });

  it('converte a data para ISO', () => {
    expect(resultado.lancamentos.map((l) => l.data)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
  });

  it('extrai o período do lote a partir das datas lidas', () => {
    expect(resultado.periodoInicio).toBe('2026-08-03');
    expect(resultado.periodoFim).toBe('2026-08-05');
  });

  it('avisa quando não reconhece nada, devolvendo as linhas para diagnóstico', () => {
    const vazio = parsearLinhasBancoDoBrasil(['linha qualquer', 'outra linha'], ESTRUTURA);
    expect(vazio.lancamentos).toHaveLength(0);
    expect(vazio.avisos).toHaveLength(1);
    expect(vazio.linhasBrutas).toHaveLength(2);
  });

  it('descarta linha com valor sem marcador de sinal em vez de adivinhar o sentido', () => {
    const semSinal = parsearLinhasBancoDoBrasil(['03/08/2026 4231-5 Pix Recebido 45,00'], ESTRUTURA);
    expect(semSinal.lancamentos).toHaveLength(0);
  });
});
