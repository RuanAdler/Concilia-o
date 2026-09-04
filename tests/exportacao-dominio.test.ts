import { describe, expect, it } from 'vitest';
import {
  gerarArquivoDominio,
  gerarTxtDominio,
  resolverDebitoCredito,
  type DadosExportacao,
} from '@/lib/export/dominio';

/**
 * Caso de referência da seção 7.6: mesmo arquivo real validado com o Domínio,
 * empresa LCI Serviços Médicos (CNPJ 17401989000148), histórico padrão 75.
 */
const CASO_REFERENCIA: DadosExportacao = {
  cnpjEmpresa: '17401989000148',
  codigoContaBanco: '8',
  codigoHistoricoPadrao: '75',
  lancamentos: [
    {
      data: '2026-08-03',
      tipo: 'credito',
      valor: 45,
      codigoContaContrapartida: '504',
      historico: 'Pix-Recebido QR Code 03/08 11:01 00052998224725 FULANO DE TA',
    },
    {
      data: '2026-08-04',
      tipo: 'debito',
      valor: 650,
      codigoContaContrapartida: '837',
      historico: 'Pix - Enviado 04/08 08:42 BELTRANO ALVES DE SOUZ',
    },
  ],
};

describe('gerarTxtDominio', () => {
  it('reproduz o arquivo de referência da seção 7.6', () => {
    const linhas = gerarTxtDominio(CASO_REFERENCIA).split('\n').filter(Boolean);

    expect(linhas).toEqual([
      '|0000|17401989000148|',
      '|6000|X||||',
      '|6100|03/08/2026|8|504|45,00|75|Pix-Recebido QR Code 03/08 11:01 00052998224725 FULANO DE TA||||',
      '|6000|X||||',
      '|6100|04/08/2026|837|8|650,00|75|Pix - Enviado 04/08 08:42 BELTRANO ALVES DE SOUZ||||',
    ]);
  });

  it('remove pontuação do CNPJ no registro 0000', () => {
    const txt = gerarTxtDominio({ ...CASO_REFERENCIA, cnpjEmpresa: '17.401.989/0001-48' });
    expect(txt.startsWith('|0000|17401989000148|')).toBe(true);
  });

  it('usa LF e termina o arquivo com quebra de linha, como o Domínio gera', () => {
    // Medido no arquivo real: 411 quebras, nenhuma delas CRLF.
    const txt = gerarTxtDominio(CASO_REFERENCIA);
    expect(txt).not.toContain('\r');
    expect(txt.endsWith('\n')).toBe(true);
  });

  it('formata valor com vírgula decimal e sem separador de milhar', () => {
    const txt = gerarTxtDominio({
      ...CASO_REFERENCIA,
      lancamentos: [{ ...CASO_REFERENCIA.lancamentos[0], valor: 12345.6 }],
    });
    expect(txt).toContain('|12345,60|');
  });

  it('nunca deixa o pipe do histórico quebrar o layout', () => {
    const txt = gerarTxtDominio({
      ...CASO_REFERENCIA,
      lancamentos: [{ ...CASO_REFERENCIA.lancamentos[0], historico: 'Pix | Recebido\nsegunda linha' }],
    });
    const linha6100 = txt.split('\n').find((l) => l.startsWith('|6100|'))!;
    expect(linha6100.split('|')).toHaveLength(12);
    expect(linha6100).toContain('Pix Recebido segunda linha');
  });
});

describe('resolverDebitoCredito', () => {
  it('entrada no extrato debita o banco e credita a contrapartida (seção 7.3)', () => {
    expect(resolverDebitoCredito('credito', '8', '504')).toEqual({ debito: '8', credito: '504' });
  });

  it('saída no extrato inverte a ordem', () => {
    expect(resolverDebitoCredito('debito', '8', '837')).toEqual({ debito: '837', credito: '8' });
  });
});

describe('gerarArquivoDominio', () => {
  it('grava em ISO-8859-1, não UTF-8 (seção 7.4)', () => {
    const buffer = gerarArquivoDominio({
      ...CASO_REFERENCIA,
      lancamentos: [
        { ...CASO_REFERENCIA.lancamentos[0], historico: 'Crédito Transferência Serviços' },
      ],
    });

    // "é" é 0xE9 em Latin-1 e vira dois bytes (0xC3 0xA9) em UTF-8.
    expect(buffer.includes(Buffer.from([0xe9]))).toBe(true);
    expect(buffer.includes(Buffer.from([0xc3, 0xa9]))).toBe(false);
    expect(buffer.toString('latin1')).toContain('Crédito Transferência Serviços');
  });

  it('converte caracteres fora do Latin-1 em equivalentes ASCII', () => {
    const buffer = gerarArquivoDominio({
      ...CASO_REFERENCIA,
      lancamentos: [{ ...CASO_REFERENCIA.lancamentos[0], historico: 'Pix – Recebido “QR”' }],
    });
    expect(buffer.toString('latin1')).toContain('Pix - Recebido "QR"');
  });
});
