export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WDL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const nf = (v: number, d = 1) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const brl = (v: number) => 'R$ ' + nf(v, 2);
export const brl0 = (v: number) => 'R$ ' + nf(v, 0);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
export function parseNum(s: string): number {
  let t = String(s).trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

const dois = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const parseYmd = (s: string) => new Date(`${s}T00:00:00`);
export const dl = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;
export const hhmm = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
