import { NextResponse } from 'next/server';
import { ThinqError, energiaDoDispositivo, estadoDoDispositivo, listarDispositivos, perfilDeEnergia } from '@/lib/thinq';

export const dynamic = 'force-dynamic';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    let perfilEnergia: unknown = null;
    let erroEnergia: string | null = null;
    const texto = (e: unknown) => (e instanceof ThinqError ? `${e.message}: ${JSON.stringify(e.corpo)}` : String(e));
    try {
      perfilEnergia = await perfilDeEnergia(ar.id);
      const props = (perfilEnergia as { response?: { property?: unknown } }).response?.property;
      const propriedade = (Array.isArray(props) ? props[0] : props) as string | undefined;
      if (typeof propriedade === 'string') {
        const hoje = new Date();
        const ini = new Date(hoje.getTime() - 30 * 86_400_000);
        energia = await energiaDoDispositivo(ar.id, propriedade, 'DAILY', ymd(ini), ymd(hoje));
      } else {
        erroEnergia = 'Perfil de energia sem propriedade reconhecida';
      }
    } catch (e) {
      erroEnergia = texto(e);
    }

    return NextResponse.json({
      modo: 'lg',
      nome: ar.nome,
      ligado,
      energia,
      perfilEnergia,
      erroEnergia,
      ...(diag ? { dispositivos, estado } : {}),
    });
  } catch (e) {
    const msg = e instanceof ThinqError ? `${e.message}: ${JSON.stringify(e.corpo)}` : String(e);
    return NextResponse.json({ modo: 'lg', erro: msg }, { status: 502 });
  }
}
