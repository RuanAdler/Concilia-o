import { NextResponse } from 'next/server';
import { lerUso, textoDoErro } from '@/lib/thinq';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ dias: await lerUso() });
  } catch (e) {
    return NextResponse.json({ erro: textoDoErro(e) }, { status: 502 });
  }
}
