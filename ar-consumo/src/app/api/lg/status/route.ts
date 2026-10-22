import { NextResponse } from 'next/server';
import { lerDispositivo, modoMock, textoDoErro } from '@/lib/thinq';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();
  try {
    const d = await lerDispositivo();
    return NextResponse.json({ ok: true, aparelho: d.name, latenciaMs: Date.now() - t0, modo: modoMock() ? 'teste' : 'lg' });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: textoDoErro(e), latenciaMs: Date.now() - t0 }, { status: 502 });
  }
}
