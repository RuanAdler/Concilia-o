import { NextResponse } from 'next/server';
import { COOKIE, DURACAO_S, conferePin, criarToken, liberado, pinConfigurado } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

// Melhor esforço: em serverless cada instância tem a sua memória.
const falhas = new Map<string, { n: number; ate: number }>();
const JANELA_MS = 10 * 60_000;
const MAX_FALHAS = 5;

const ip = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET() {
  return NextResponse.json({ configurado: pinConfigurado(), liberado: await liberado() });
}

export async function POST(req: Request) {
  if (!pinConfigurado()) return NextResponse.json({ erro: 'PIN não configurado' }, { status: 503 });
  const quem = ip(req);
  const f = falhas.get(quem);
  if (f && f.n >= MAX_FALHAS && f.ate > Date.now()) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  const { pin } = (await req.json().catch(() => ({}))) as { pin?: unknown };
  if (typeof pin !== 'string' || !conferePin(pin)) {
    await espera(700);
    const atual = f && f.ate > Date.now() ? f : { n: 0, ate: Date.now() + JANELA_MS };
    falhas.set(quem, { n: atual.n + 1, ate: atual.ate });
    return NextResponse.json({ erro: 'PIN incorreto' }, { status: 401 });
  }

  falhas.delete(quem);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: criarToken(),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_S,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
