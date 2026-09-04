import { describe, expect, it } from 'vitest';
import { parsearPaginasBancoDoBrasil } from '@/lib/parsers/banco-do-brasil-pdf';
import type { FragmentoPdf } from '@/lib/parsers/pdf-texto';
import {
  cabecalhoPagina,
  fragmento,
  lancamentoComum,
  lancamentoTipoAlinhadoComData,
  linhaSaldo,
} from './ajuda/fragmentos-bb';

/**
 * Geometria copiada do extrato real do Banco do Brasil (agosto/2026), com nomes
 * e documentos trocados por fictícios. As três armadilhas que o arquivo real
 * apresenta estão todas aqui.
 */
const PAGINA_1: FragmentoPdf[] = [
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
    data: '03/08/2026',
    lote: '13113',
    documento: '882151100366949',
    tipo: 'Tarifa Pix Enviado',
    complemento: 'Tar. agrupadas - ocorrencia 31/07/2026',
    valor: '10,00 (-)',
  }),
  // Armadilha 1: tipo na mesma altura da data, complemento ABAIXO do valor.
  ...lancamentoTipoAlinhadoComData({
    base: 626.4,
    data: '03/08/2026',
    lote: '13013',
    documento: '16551',
    tipo: 'Seg Créd Proteg Empresa',
    complemento: 'BB SEGURO CRED PROT EMPR',
    valor: '207,19 (-)',
  }),
  ...linhaSaldo(595.4, '00/00/0000', 'Saldo do dia', '38.398,00 (+)'),
  // Armadilha 2: lançamento cortado pela quebra de página. A data sai partida
  // ("05/08/202") e o complemento só aparece no topo da página seguinte.
  fragmento('Pix-Recebido QR Code', 266, 28.4, 93.5),
  fragmento('05/08/202', 30, 28.4, 40),
  fragmento('14397', 91, 26.4, 25),
  fragmento('140846461218061', 152, 26.4, 75.1),
  fragmento('45,00 (+)', 533.7, 26.4, 36.3),
];

const PAGINA_2: FragmentoPdf[] = [
  ...cabecalhoPagina(),
  // Continuação do lançamento cortado: o resto da data e o complemento.
  fragmento('05/08 08:46 12749755735 BELTRANO SOBRENO', 266, 724.1, 168.1),
  fragmento('6', 30, 718.9, 5),
  ...lancamentoComum({
    base: 693.4,
    data: '05/08/2026',
    lote: '14397',
    documento: '140913066281541',
    tipo: 'Pix - Recebido',
    complemento: '05/08 09:13 09289605529 CICLANO OLIVE',
    valor: '90,00 (+)',
  }),
  ...lancamentoComum({
    base: 662.4,
    data: '05/08/2026',
    lote: '99015',
    documento: '553338000020323',
    tipo: 'Transferência enviada',
    complemento: '05/08 15:28 SOCIO EXEMPLO DA SILVA',
    valor: '5.000,00 (-)',
  }),
];

describe('parsearPaginasBancoDoBrasil', () => {
  const resultado = parsearPaginasBancoDoBrasil([PAGINA_1, PAGINA_2], null);

  it('lê um lançamento por linha da tabela, descartando saldos e cabeçalho', () => {
    // 4 lançamentos na página 1 (um deles cortado ao meio) e 2 na página 2.
    expect(resultado.lancamentos).toHaveLength(6);
  });

  it('deriva o sentido a partir do sinal do extrato', () => {
    expect(resultado.lancamentos.map((l) => l.tipo)).toEqual([
      'credito',
      'debito',
      'debito',
      'credito',
      'credito',
      'debito',
    ]);
  });

  it('sempre devolve valor positivo, inclusive com separador de milhar', () => {
    expect(resultado.lancamentos.map((l) => l.valor)).toEqual([45, 10, 207.19, 45, 90, 5000]);
  });

  it('separa tipo de operação e complemento pela coluna, não pela linha visual', () => {
    const primeiro = resultado.lancamentos[0];
    expect(primeiro.tipoOperacao).toBe('Pix-Recebido QR Code');
    expect(primeiro.complemento).toBe('03/08 11:01 00052998224725 FULANO DE TA');
    expect(primeiro.historicoBruto).toBe(
      'Pix-Recebido QR Code 03/08 11:01 00052998224725 FULANO DE TA',
    );
  });

  it('resolve o caso em que o tipo está alinhado com a data e o complemento abaixo do valor', () => {
    const seguro = resultado.lancamentos[2];
    expect(seguro.tipoOperacao).toBe('Seg Créd Proteg Empresa');
    expect(seguro.historicoBruto).toBe('Seg Créd Proteg Empresa BB SEGURO CRED PROT EMPR');
  });

  it('costura o lançamento partido pela quebra de página', () => {
    const partido = resultado.lancamentos[3];
    // A data vinha como "05/08/202" + "6" em páginas diferentes.
    expect(partido.data).toBe('2026-08-05');
    expect(partido.historicoBruto).toBe(
      'Pix-Recebido QR Code 05/08 08:46 12749755735 BELTRANO SOBRENO',
    );
  });

  it('não confunde o tipo do primeiro lançamento da página com uma continuação', () => {
    expect(resultado.lancamentos[4].tipoOperacao).toBe('Pix - Recebido');
  });

  it('extrai o período a partir das datas lidas', () => {
    expect(resultado.periodoInicio).toBe('2026-08-03');
    expect(resultado.periodoFim).toBe('2026-08-05');
  });

  it('avisa e devolve as linhas cruas quando não reconhece nada', () => {
    const vazio = parsearPaginasBancoDoBrasil([[fragmento('documento sem tabela', 30, 700)]], null);
    expect(vazio.lancamentos).toHaveLength(0);
    expect(vazio.avisos).toHaveLength(1);
    expect(vazio.linhasBrutas).toContain('documento sem tabela');
  });

  it('descarta valor sem marcador de sinal em vez de adivinhar o sentido', () => {
    const semSinal = parsearPaginasBancoDoBrasil(
      [
        [
          ...cabecalhoPagina(),
          ...lancamentoComum({
            base: 688.4,
            data: '03/08/2026',
            lote: '14397',
            documento: '31101193368792',
            tipo: 'Pix - Recebido',
            complemento: '03/08 11:01 FULANO',
            valor: '45,00',
          }),
        ],
      ],
      null,
    );
    expect(semSinal.lancamentos).toHaveLength(0);
  });
});
