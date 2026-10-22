import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'ar_sess';
export const DURACAO_S = 12 * 3600;

const sha = (s: string) => createHash('sha256').update(s).digest();

export const pinConfigurado = () => /^\d{6}$/.test(process.env.APP_PIN ?? '');

export function conferePin(tentativa: string): boolean {
  if (!pinConfigurado()) return false;
  return timingSafeEqual(sha(tentativa), sha(process.env.APP_PIN as string));
}

const chave = () => sha(`ar-consumo|${process.env.APP_PIN ?? ''}|${process.env.LG_PAT ?? ''}`);
const assinar = (exp: string) => createHmac('sha256', chave()).update(exp).digest('hex');

export function criarToken(agora = Date.now()): string {
  const exp = String(Math.floor(agora / 1000) + DURACAO_S);
  return `${exp}.${assinar(exp)}`;
}

export function tokenValido(token: string | undefined, agora = Date.now()): boolean {
  if (!token || !pinConfigurado()) return false;
  const [exp, assinatura] = token.split('.');
  if (!exp || !assinatura || !/^\d+$/.test(exp)) return false;
  const esperada = assinar(exp);
  if (assinatura.length !== esperada.length) return false;
  if (!timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return false;
  return Number(exp) * 1000 > agora;
}

export async function liberado(): Promise<boolean> {
  return tokenValido((await cookies()).get(COOKIE)?.value);
}
