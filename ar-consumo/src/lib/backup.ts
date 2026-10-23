import type { Config } from './cliente';
import { dl, hhmm, ymd } from './fmt';
import type { Previsao } from './previsao';
import type { ContaSalva } from './stats';

export type BackupFile = {
  app: 'consumo-do-ar';
  version: 3;
  createdAt: string;
  bills: Record<string, ContaSalva>; // só as contas salvas pelo usuário (as fixas já vêm no app)
  days: Record<string, number>;
  forecasts: Record<string, Previsao>;
  settings: Config;
};

export const nomeDoArquivo = (d = new Date()) => `consumo-do-ar-backup-${ymd(d)}.json`;

export function criarBackup(e: { bills: Record<string, ContaSalva>; days: Record<string, number>; forecasts: Record<string, Previsao>; settings: Config }, agora = new Date()): BackupFile {
  return { app: 'consumo-do-ar', version: 3, createdAt: agora.toISOString(), ...e };
}

export type ResumoBackup = { contas: number; dias: number; primeiro: string | null; ultimo: string | null; criadoEm: string };
export type LeituraBackup = { ok: true; backup: BackupFile; resumo: ResumoBackup } | { ok: false; motivo: string };

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Confere se o texto é um backup deste app antes de qualquer coisa ser substituída. */
export function lerBackup(texto: string): LeituraBackup {
  let j: unknown;
  try {
    j = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'O arquivo não é um JSON válido.' };
  }
  if (!ehObjeto(j) || j.app !== 'consumo-do-ar') return { ok: false, motivo: 'O arquivo não é um backup do Consumo do Ar.' };
  if (typeof j.version !== 'number' || j.version > 3) return { ok: false, motivo: 'O backup é de uma versão mais nova do app.' };
  const { bills, days, forecasts, settings } = j;
  if (!ehObjeto(bills) || !ehObjeto(days) || !ehObjeto(forecasts) || !ehObjeto(settings)) return { ok: false, motivo: 'Faltam partes do backup.' };
  if (Object.keys(days).length > 5000 || Object.keys(bills).length > 300) return { ok: false, motivo: 'O arquivo é maior do que o esperado.' };
  for (const [data, kwh] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !num(kwh) || (kwh as number) < 0) return { ok: false, motivo: 'Os dias de consumo estão num formato inesperado.' };
  }
  for (const [ref, c] of Object.entries(bills)) {
    if (!/^\d{4}-\d{2}$/.test(ref) || !ehObjeto(c) || c.mes !== ref || !num(c.valor) || !num(c.kwh) || !num(c.fixas)) return { ok: false, motivo: 'Uma das contas está num formato inesperado.' };
  }
  for (const [ref, p] of Object.entries(forecasts)) {
    if (!ehObjeto(p) || p.ref !== ref || !num(p.valor) || !num(p.margem)) return { ok: false, motivo: 'Uma das previsões está num formato inesperado.' };
  }
  if (typeof settings.tariff !== 'string' || typeof settings.diaLeitura !== 'string') return { ok: false, motivo: 'Os ajustes estão num formato inesperado.' };

  const datas = Object.keys(days).sort();
  const criado = typeof j.createdAt === 'string' ? new Date(j.createdAt) : null;
  const criadoEm = criado && !Number.isNaN(criado.getTime()) ? `${dl(criado)}, ${hhmm(criado)}` : 'data desconhecida';
  return {
    ok: true,
    backup: j as unknown as BackupFile,
    resumo: { contas: Object.keys(bills).length, dias: datas.length, primeiro: datas[0] ?? null, ultimo: datas[datas.length - 1] ?? null, criadoEm },
  };
}

/** Dias inteiros desde uma data ISO (null se não houver data). */
export function diasDesde(iso: string | null | undefined, agora = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / 86_400_000)) : null;
}

export const DIAS_BACKUP_ATRASADO = 30;
