/** Converte "DD/MM/AAAA" ou "DD/MM/AA" para ISO "AAAA-MM-DD". */
export function dataBrParaIso(texto: string, anoReferencia?: number): string | null {
  const achado = texto.trim().match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/);
  if (!achado) return null;

  const [, dia, mes, anoBruto] = achado;
  let ano: number;

  if (!anoBruto) {
    // Linha de extrato sem ano (ex.: "03/08") — usa o ano do período do extrato.
    if (!anoReferencia) return null;
    ano = anoReferencia;
  } else if (anoBruto.length === 2) {
    ano = 2000 + Number(anoBruto);
  } else {
    ano = Number(anoBruto);
  }

  const diaNum = Number(dia);
  const mesNum = Number(mes);
  if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) return null;

  return `${String(ano).padStart(4, '0')}-${mes}-${dia}`;
}

/** Converte ISO "AAAA-MM-DD" para "DD/MM/AAAA" (formato do campo 2 do registro 6100). */
export function isoParaDataDominio(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
