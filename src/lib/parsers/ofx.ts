import type { EstruturaHistorico, LancamentoParseado, ResultadoParse } from './tipos';

/**
 * Parser de OFX (SGML/XML).
 *
 * Seção 5: quando o banco oferece OFX, é o formato preferencial — vem com data,
 * valor, tipo, descrição e um ID único de transação (FITID), que resolve a
 * deduplicação sem depender de hash de texto.
 */

const REGEX_TRANSACAO = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

export function parsearOfx(texto: string, _estrutura: EstruturaHistorico | null): ResultadoParse {
  const lancamentos: LancamentoParseado[] = [];
  const avisos: string[] = [];

  for (const bloco of texto.matchAll(REGEX_TRANSACAO)) {
    const corpo = bloco[1];

    const dataOfx = campo(corpo, 'DTPOSTED');
    const valorTexto = campo(corpo, 'TRNAMT');
    if (!dataOfx || !valorTexto) continue;

    const data = dataOfxParaIso(dataOfx);
    const valor = Number(valorTexto.replace(',', '.'));
    if (!data || !Number.isFinite(valor)) continue;

    const tipoOperacao = (campo(corpo, 'NAME') ?? campo(corpo, 'TRNTYPE') ?? '').trim();
    const complemento = (campo(corpo, 'MEMO') ?? '').trim();

    lancamentos.push({
      data,
      tipoOperacao,
      complemento,
      historicoBruto: [tipoOperacao, complemento].filter(Boolean).join(' ').trim(),
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'debito' : 'credito',
      idExterno: campo(corpo, 'FITID')?.trim() ?? null,
    });
  }

  if (lancamentos.length === 0) avisos.push('Nenhum bloco <STMTTRN> encontrado no arquivo OFX.');

  const datas = lancamentos.map((l) => l.data).sort();

  return {
    lancamentos,
    periodoInicio: datas[0] ?? null,
    periodoFim: datas[datas.length - 1] ?? null,
    linhasBrutas: [],
    avisos,
  };
}

/** OFX aceita tags fechadas e não fechadas; ambos os casos param na próxima tag. */
function campo(corpo: string, tag: string): string | null {
  const achado = corpo.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return achado ? achado[1].trim() : null;
}

/** "20260803" ou "20260803120000[-3:BRT]" -> "2026-08-03". */
function dataOfxParaIso(valor: string): string | null {
  const achado = valor.match(/^(\d{4})(\d{2})(\d{2})/);
  return achado ? `${achado[1]}-${achado[2]}-${achado[3]}` : null;
}
