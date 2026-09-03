import Papa from 'papaparse';
import { dataBrParaIso } from '@/lib/nucleo/data';
import { valorBrParaNumero } from '@/lib/nucleo/numero';
import type { EstruturaHistorico, LancamentoParseado, ResultadoParse } from './tipos';

/**
 * Parser genérico de CSV, guiado pelo mapeamento de colunas do template do banco
 * (`estrutura_historico.colunas`). Aceita tanto uma coluna única de valor com
 * sinal quanto colunas separadas de débito e crédito.
 */
export function parsearCsv(texto: string, estrutura: EstruturaHistorico | null): ResultadoParse {
  const colunas = estrutura?.colunas ?? {};
  const avisos: string[] = [];

  const analise = Papa.parse<Record<string, string>>(texto.trim(), {
    header: true,
    skipEmptyLines: true,
    delimiter: estrutura?.separadorCsv ?? '',
    transformHeader: (cabecalho) => cabecalho.trim(),
  });

  if (analise.errors.length > 0) {
    avisos.push(`CSV com ${analise.errors.length} aviso(s) de leitura; linhas problemáticas foram ignoradas.`);
  }

  const lancamentos: LancamentoParseado[] = [];

  for (const linha of analise.data) {
    const dataTexto = ler(linha, colunas.data ?? 'Data');
    if (!dataTexto) continue;

    const data = dataTexto.includes('/') ? dataBrParaIso(dataTexto) : normalizarIso(dataTexto);
    if (!data) continue;

    let valor: number | null = null;
    let tipo: 'debito' | 'credito' | null = null;

    if (colunas.valorDebito || colunas.valorCredito) {
      const debito = valorBrParaNumero(ler(linha, colunas.valorDebito ?? '') ?? '');
      const credito = valorBrParaNumero(ler(linha, colunas.valorCredito ?? '') ?? '');
      if (Number.isFinite(credito) && credito !== 0) {
        valor = Math.abs(credito);
        tipo = 'credito';
      } else if (Number.isFinite(debito) && debito !== 0) {
        valor = Math.abs(debito);
        tipo = 'debito';
      }
    } else {
      const bruto = valorBrParaNumero(ler(linha, colunas.valor ?? 'Valor') ?? '');
      if (Number.isFinite(bruto) && bruto !== 0) {
        valor = Math.abs(bruto);
        tipo = bruto < 0 ? 'debito' : 'credito';
      }
    }

    if (valor === null || tipo === null) continue;

    const tipoOperacao = (ler(linha, colunas.historico ?? 'Historico') ?? '').trim();
    const complemento = (ler(linha, colunas.complemento ?? 'Complemento') ?? '').trim();

    lancamentos.push({
      data,
      tipoOperacao,
      complemento,
      historicoBruto: [tipoOperacao, complemento].filter(Boolean).join(' ').trim(),
      valor,
      tipo,
    });
  }

  if (lancamentos.length === 0) {
    avisos.push('Nenhuma linha do CSV pôde ser interpretada — confira o mapeamento de colunas do template.');
  }

  const datas = lancamentos.map((l) => l.data).sort();

  return {
    lancamentos,
    periodoInicio: datas[0] ?? null,
    periodoFim: datas[datas.length - 1] ?? null,
    linhasBrutas: [],
    avisos,
  };
}

function ler(linha: Record<string, string>, coluna: string): string | null {
  if (!coluna) return null;
  const direto = linha[coluna];
  if (direto !== undefined) return direto;

  // Tolera diferença de caixa/espaço no cabeçalho.
  const alvo = coluna.trim().toLowerCase();
  for (const [chave, valor] of Object.entries(linha)) {
    if (chave.trim().toLowerCase() === alvo) return valor;
  }
  return null;
}

function normalizarIso(texto: string): string | null {
  const achado = texto.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return achado ? `${achado[1]}-${achado[2]}-${achado[3]}` : null;
}
