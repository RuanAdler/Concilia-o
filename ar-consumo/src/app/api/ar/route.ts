import { NextResponse } from 'next/server';
import { ThinqError, energiaDoDispositivo, estadoDoDispositivo, listarDispositivos } from '@/lib/thinq';

export const dynamic = 'force-dynamic';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function achar(obj: unknown): { id: string; nome: string } | null {
  const lista = (obj as { response?: unknown })?.response;
  if (!Array.isArray(lista)) return null;
  const ar = lista.find((d) => String((d as { deviceInfo?: { deviceType?: string } }).deviceInfo?.deviceType).includes('AIR_CONDITIONER')) ?? lista[0];
  if (!ar) return null;
  const a = ar as { deviceId: string; deviceInfo?: { alias?: string } };
  return { id: a.deviceId, nome: a.deviceInfo?.alias ?? 'Ar-condicionado' };
}

export async function GET(req: Request) {
  if (process.env.LG_MOCK || !process.env.LG_PAT) {
    return NextResponse.json({
      modo: process.env.LG_MOCK ? 'mock' : 'sem-token',
      nome: 'Ar-condicionado (exemplo)',
      ligado: false,
      dispositivos: null,
      estado: null,
      energia: null,
    });
  }

  const diag = new URL(req.url).searchParams.get('diag') === '1';
  try {
    const dispositivos = await listarDispositivos();
    const ar = achar(dispositivos);
    if (!ar) return NextResponse.json({ modo: 'lg', erro: 'Nenhum aparelho encontrado na conta', dispositivos });

    const estado = await estadoDoDispositivo(ar.id);
    const op = (estado as { response?: { operation?: { airConOperationMode?: string } } }).response?.operation?.airConOperationMode;
    const ligado = op ? op === 'POWER_ON' : null;

    let energia: unknown = null;
    let erroEnergia: string | null = null;
    const hoje = new Date();
    const ini = new Date(hoje.getTime() - 30 * 86_400_000);
    try {
      energia = await energiaDoDispositivo(ar.id, 'DAILY', ymd(ini), ymd(hoje));
    } catch (e) {
      erroEnergia = e instanceof ThinqError ? `${e.message}: ${JSON.stringify(e.corpo)}` : String(e);
    }

    return NextResponse.json({
      modo: 'lg',
      nome: ar.nome,
      ligado,
      energia,
      erroEnergia,
      ...(diag ? { dispositivos, estado } : {}),
    });
  } catch (e) {
    const msg = e instanceof ThinqError ? `${e.message}: ${JSON.stringify(e.corpo)}` : String(e);
    return NextResponse.json({ modo: 'lg', erro: msg }, { status: 502 });
  }
}
