import { NextResponse } from 'next/server';
import { confirmado, validarComando } from '@/lib/device';
import { liberado, pinConfigurado } from '@/lib/sessao';
import { enviarComando, lerDispositivo, textoDoErro } from '@/lib/thinq';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  if (!pinConfigurado()) return NextResponse.json({ erro: 'Controles desativados: defina APP_PIN na hospedagem.' }, { status: 503 });
  if (!(await liberado())) return NextResponse.json({ erro: 'PIN necessário' }, { status: 401 });

  const comando = validarComando(await req.json().catch(() => null));
  if (!comando) return NextResponse.json({ erro: 'Comando inválido' }, { status: 400 });

  try {
    await enviarComando(comando);
  } catch (e) {
    return NextResponse.json({ erro: textoDoErro(e) }, { status: 502 });
  }

  // A LG aceita o comando antes do aparelho obedecer: confere o estado algumas vezes.
  for (let i = 0; i < 5; i++) {
    await espera(1500);
    try {
      const device = await lerDispositivo();
      if (confirmado(comando, device)) return NextResponse.json({ ok: true, device });
    } catch {
      // tenta de novo
    }
  }
  return NextResponse.json({ erro: 'O aparelho não confirmou a mudança a tempo.' }, { status: 504 });
}
