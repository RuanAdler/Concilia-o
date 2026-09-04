import { describe, expect, it } from 'vitest';
import { parsearExtratoBancoDoBrasil } from '@/lib/parsers/banco-do-brasil-pdf';
import { gerarTxtDominio } from '@/lib/export/dominio';
import { cabecalhoPagina, lancamentoComum, linhaSaldo } from './ajuda/fragmentos-bb';
import { montarPdfPosicionado } from './ajuda/pdf-minimo';

/**
 * Caminho completo: bytes de PDF -> pdfjs -> parser por coluna -> registro do
 * Domínio. É o teste que garante que a extração posicional continua alimentando
 * o parser com o que ele espera.
 */
const PAGINA = [
  ...cabecalhoPagina(),
  ...linhaSaldo(713.9, '31/07/2026', 'Saldo Anterior', '38.292,84 (+)'),
  ...lancamentoComum({
    base: 688.4,
    data: '03/08/2026',
    lote: '14397',
    documento: '31101193368792',
    tipo: 'Pix-Recebido QR Code',
    complemento: '03/08 11:01 00052998224725 FULANO DE TA',
    valor: '45,00 (+)',
  }),
  ...lancamentoComum({
    base: 657.4,
    data: '04/08/2026',
    lote: '99015',
    documento: '553338000020323',
    tipo: 'Pix - Enviado',
    complemento: '04/08 08:42 BELTRANO ALVES DE SOUZA SA',
    valor: '650,00 (-)',
  }),
];

describe('PDF real do início ao fim (pdfjs no runtime Node)', () => {
  it('lê os lançamentos a partir dos bytes do PDF', async () => {
    const resultado = await parsearExtratoBancoDoBrasil(montarPdfPosicionado(PAGINA), null);

    expect(resultado.lancamentos).toHaveLength(2);
    expect(resultado.lancamentos[0]).toMatchObject({
      data: '2026-08-03',
      tipo: 'credito',
      valor: 45,
      historicoBruto: 'Pix-Recebido QR Code 03/08 11:01 00052998224725 FULANO DE TA',
    });
    expect(resultado.lancamentos[1]).toMatchObject({
      data: '2026-08-04',
      tipo: 'debito',
      valor: 650,
      historicoBruto: 'Pix - Enviado 04/08 08:42 BELTRANO ALVES DE SOUZA SA',
    });
  });

  it('chega ao registro 6100 com débito e crédito na posição certa', async () => {
    const resultado = await parsearExtratoBancoDoBrasil(montarPdfPosicionado(PAGINA), null);

    const txt = gerarTxtDominio({
      cnpjEmpresa: '17401989000148',
      codigoContaBanco: '8',
      codigoHistoricoPadrao: '75',
      lancamentos: resultado.lancamentos.map((lancamento) => ({
        data: lancamento.data,
        tipo: lancamento.tipo,
        valor: lancamento.valor,
        codigoContaContrapartida: lancamento.tipo === 'credito' ? '504' : '837',
        historico: lancamento.historicoBruto,
      })),
    });

    expect(txt.split('\n').filter(Boolean)).toEqual([
      '|0000|17401989000148|',
      '|6000|X||||',
      '|6100|03/08/2026|8|504|45,00|75|Pix-Recebido QR Code 03/08 11:01 00052998224725 FULANO DE TA||||',
      '|6000|X||||',
      '|6100|04/08/2026|837|8|650,00|75|Pix - Enviado 04/08 08:42 BELTRANO ALVES DE SOUZA SA||||',
    ]);
  });
});
