import { NextResponse } from 'next/server';
import { lerDispositivo, textoDoErro } from '@/lib/thinq';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ device: await lerDispositivo(), lidoEm: Date.now() });
  } catch (e) {
    return NextResponse.json({ erro: textoDoErro(e) }, { status: 502 });
  }
}
