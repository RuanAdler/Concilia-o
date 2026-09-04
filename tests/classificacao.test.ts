import { describe, expect, it } from 'vitest';
import { chaveDeAprendizado, classificarLote } from '@/lib/classificacao/motor';
import { montarIndiceSinonimos } from '@/lib/classificacao/similaridade';
import type { ContextoClassificacao } from '@/lib/classificacao/tipos';
import type { LancamentoParseado } from '@/lib/parsers/tipos';

const BANCO = 'banco-bb';
// CNPJ e CPF com dígito verificador válido — o motor rejeita documento inválido.
const CNPJ_FORNECEDOR = '17401989000148';
const CPF_SOCIO = '52998224725';

function lancamento(parcial: Partial<LancamentoParseado>): LancamentoParseado {
  return {
    data: '2026-08-03',
    tipoOperacao: 'Pix - Recebido',
    complemento: '',
    historicoBruto: 'Pix - Recebido',
    valor: 100,
    tipo: 'credito',
    ...parcial,
  };
}

function contexto(parcial: Partial<ContextoClassificacao> = {}): ContextoClassificacao {
  return {
    bancoTemplateId: BANCO,
    pessoasEspeciais: [],
    regras: [],
    estatisticasPorRegra: new Map(),
    indiceSinonimos: montarIndiceSinonimos({
      'PIX RECEBIDO': ['PIX RECEBIDO QR CODE'],
    }),
    ...parcial,
  };
}

describe('camada 1 — pessoa especial', () => {
  it('classifica por CPF e não vai para revisão nem com valor atípico', () => {
    const ctx = contexto({
      pessoasEspeciais: [
        {
          id: 'p1',
          identificador: CPF_SOCIO,
          tipo_identificador: 'cpf',
          nome_exibicao: 'Socio Exemplo',
          papel: 'socio',
          conta_contabil_id: 'conta-socio',
        },
      ],
    });

    const [resultado] = classificarLote(
      [lancamento({ complemento: `03/08 10:14 ${CPF_SOCIO} SOCIO EXEMPLO`, valor: 99999 })],
      ctx,
      null,
      null,
    );

    expect(resultado.camada).toBe('pessoa_especial');
    expect(resultado.contaContabilId).toBe('conta-socio');
    expect(resultado.statusRevisao).toBe('auto_classificado');
  });

  it('casa por nome quando o Pix não traz documento', () => {
    const ctx = contexto({
      pessoasEspeciais: [
        {
          id: 'p2',
          identificador: 'SOCIO EXEMPLO DA SILVA',
          tipo_identificador: 'nome',
          nome_exibicao: 'Socio Exemplo da Silva',
          papel: 'socio',
          conta_contabil_id: 'conta-socio',
        },
      ],
    });

    const [resultado] = classificarLote(
      [
        lancamento({
          complemento: '03/08 10:14 SOCIO EXEMPLO DA SILVA',
          historicoBruto: 'Pix - Recebido 03/08 10:14 Socio Exemplo da Silva',
        }),
      ],
      ctx,
      null,
      null,
    );

    expect(resultado.camada).toBe('pessoa_especial');
  });
});

describe('camada 2 — CNPJ/CPF recorrente', () => {
  it('aplica a conta da regra mesmo com o nome truncado diferente', () => {
    const ctx = contexto({
      regras: [
        {
          id: 'r1',
          banco_template_id: null,
          tipo_chave: 'cnpj_cpf',
          valor_chave: CNPJ_FORNECEDOR,
          conta_contabil_id: 'conta-aluguel',
          confianca: 'alta',
          multiplicador_outlier: 5,
        },
      ],
    });

    const [resultado] = classificarLote(
      [
        lancamento({
          tipoOperacao: 'Pagamento de Boleto',
          complemento: `04/08 09:00 ${CNPJ_FORNECEDOR} IMOBILIARIA X`,
          tipo: 'debito',
        }),
      ],
      ctx,
      null,
      null,
    );

    expect(resultado.camada).toBe('cnpj_cpf');
    expect(resultado.contaContabilId).toBe('conta-aluguel');
  });

  it('ignora número longo que não é documento válido (id de transação Pix)', () => {
    const [resultado] = classificarLote(
      [lancamento({ complemento: '03/08 11:01 88888888888888 FULANO DOS' })],
      contexto(),
      null,
      null,
    );

    expect(resultado.documentoExtraido).toBeNull();
  });

  it('reconhece o CPF que o BB preenche com zeros até 14 dígitos', () => {
    // O BB completa o CPF do pagador com zeros até 14 dígitos. Sem tratar
    // isso, nenhum Pix de pessoa física teria documento.
    const [resultado] = classificarLote(
      [lancamento({ complemento: '03/08 11:01 00052998224725 FULANO DE TA' })],
      contexto(),
      null,
      null,
    );

    expect(resultado.documentoExtraido).toBe(CPF_SOCIO);
  });

  it('lê CNPJ de 14 dígitos sem confundir com os 11 primeiros', () => {
    const [resultado] = classificarLote(
      [lancamento({ complemento: '03/08 14:44 11222333000181 EMPRESA EXEM' })],
      contexto(),
      null,
      null,
    );

    expect(resultado.documentoExtraido).toBe('11222333000181');
  });
});

describe('camada 3 — tipo de operação', () => {
  const ctx = contexto({
    regras: [
      {
        id: 'r2',
        banco_template_id: BANCO,
        tipo_chave: 'tipo_operacao',
        valor_chave: 'PIX RECEBIDO',
        conta_contabil_id: 'conta-clientes',
        confianca: 'alta',
        multiplicador_outlier: 5,
      },
    ],
  });

  it('tolera variação de pontuação entre "Pix - Recebido" e "Pix-Recebido"', () => {
    const [resultado] = classificarLote(
      [lancamento({ tipoOperacao: 'Pix-Recebido' })],
      ctx,
      null,
      null,
    );
    expect(resultado.contaContabilId).toBe('conta-clientes');
  });

  it('reconhece a variação com sufixo via tabela de sinônimos do template', () => {
    const [resultado] = classificarLote(
      [lancamento({ tipoOperacao: 'Pix-Recebido QR Code' })],
      ctx,
      null,
      null,
    );
    expect(resultado.camada).toBe('tipo_operacao');
  });

  it('não aplica regra de outro banco quando a regra é específica', () => {
    const outroBanco = { ...ctx, bancoTemplateId: 'banco-nubank' };
    const [resultado] = classificarLote([lancamento({})], outroBanco, null, null);
    expect(resultado.statusRevisao).toBe('revisar');
  });
});

describe('camada 4 — outlier de valor', () => {
  const regra = {
    id: 'r3',
    banco_template_id: null,
    tipo_chave: 'tipo_operacao' as const,
    valor_chave: 'PIX RECEBIDO',
    conta_contabil_id: 'conta-clientes',
    confianca: 'alta' as const,
    multiplicador_outlier: 5,
  };

  it('marca como outlier valor muito acima da mediana histórica', () => {
    const ctx = contexto({
      regras: [regra],
      estatisticasPorRegra: new Map([['r3', { mediana: 120, quantidade: 40 }]]),
    });

    const [resultado] = classificarLote([lancamento({ valor: 7000 })], ctx, null, null);
    expect(resultado.statusRevisao).toBe('outlier');
    expect(resultado.contaContabilId).toBe('conta-clientes');
  });

  it('não alarma com amostra histórica pequena', () => {
    const ctx = contexto({
      regras: [regra],
      estatisticasPorRegra: new Map([['r3', { mediana: 120, quantidade: 2 }]]),
    });

    const [resultado] = classificarLote([lancamento({ valor: 7000 })], ctx, null, null);
    expect(resultado.statusRevisao).toBe('auto_classificado');
  });
});

describe('deduplicação', () => {
  it('colapsa linhas idênticas dentro do mesmo lote', () => {
    const repetido = lancamento({});
    const resultado = classificarLote([repetido, { ...repetido }], contexto(), null, null);
    expect(resultado).toHaveLength(1);
  });

  it('sinaliza — sem descartar — lançamento já visto em outro lote', () => {
    const [primeiro] = classificarLote([lancamento({})], contexto(), null, null);
    const [segundo] = classificarLote(
      [lancamento({})],
      contexto(),
      null,
      null,
      new Set([primeiro.hashDeduplicacao]),
    );
    expect(segundo.duplicadoSuspeito).toBe(true);
  });
});

describe('aprendizado (seção 4.6)', () => {
  it('prefere o documento como chave, porque é estável', () => {
    expect(
      chaveDeAprendizado({
        documentoExtraido: CNPJ_FORNECEDOR,
        tipoOperacaoNormalizado: 'PAGAMENTO DE BOLETO',
        historicoNormalizado: 'PAGAMENTO DE BOLETO',
      }),
    ).toEqual({ tipo_chave: 'cnpj_cpf', valor_chave: CNPJ_FORNECEDOR });
  });

  it('cai para o tipo de operação quando não há documento', () => {
    expect(
      chaveDeAprendizado({
        documentoExtraido: null,
        tipoOperacaoNormalizado: 'TARIFA PACOTE DE SERVICOS',
        historicoNormalizado: 'TARIFA PACOTE DE SERVICOS 03 08',
      }),
    ).toEqual({ tipo_chave: 'tipo_operacao', valor_chave: 'TARIFA PACOTE DE SERVICOS' });
  });
});
