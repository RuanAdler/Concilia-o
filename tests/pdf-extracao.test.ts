import { describe, expect, it } from 'vitest';
import { extrairLinhasDoPdf } from '@/lib/parsers/pdf-texto';
import { parsearExtratoBancoDoBrasil } from '@/lib/parsers/banco-do-brasil-pdf';
import { montarPdfComLinhas } from './ajuda/pdf-minimo';

const LINHAS_EXTRATO = [
  'Banco do Brasil - Extrato de Conta Corrente',
  'Agencia 4231-5 Conta 108959-5 Periodo 01/08/2026 a 31/08/2026',
  'Saldo Anterior 1.500,00 (+)',
  '03/08/2026 4231-5 Pix-Recebido QR Code 00003833265590 45,00 (+)',
  '03/08 11:01 00003833265590 MARCONI DOS',
  '04/08/2026 4231-5 Pix - Enviado 650,00 (-)',
  '04/08 08:42 CLEDSON ALVES DE SOUZA SA',
];

describe('extração posicional de PDF (pdfjs no runtime Node)', () => {
  it('reconstrói as linhas visuais do documento', async () => {
    const linhas = await extrairLinhasDoPdf(montarPdfComLinhas(LINHAS_EXTRATO));
    expect(linhas).toEqual(LINHAS_EXTRATO);
  });

  it('vai do PDF ao lançamento classificável, ponta a ponta', async () => {
    const resultado = await parsearExtratoBancoDoBrasil(montarPdfComLinhas(LINHAS_EXTRATO), null);

    expect(resultado.lancamentos).toHaveLength(2);
    expect(resultado.lancamentos[0]).toMatchObject({
      data: '2026-08-03',
      tipo: 'credito',
      valor: 45,
      historicoBruto: 'Pix-Recebido QR Code 03/08 11:01 00003833265590 MARCONI DOS',
    });
    expect(resultado.lancamentos[1]).toMatchObject({
      data: '2026-08-04',
      tipo: 'debito',
      valor: 650,
      historicoBruto: 'Pix - Enviado 04/08 08:42 CLEDSON ALVES DE SOUZA SA',
    });
  });
});
