import { randomUUID } from 'node:crypto';
import { type Device, type Comando, corpoDoComando, parseEstado } from './device';
import { type DiaEnergia, parseEnergia } from './energia';
import { ymd } from './fmt';
import { mockDispositivo, mockComando, mockUso } from './mock';

// Chave pública da API ThinQ Connect (a mesma da documentação oficial da LG).
const API_KEY = 'v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3';

export class ThinqError extends Error {
  constructor(message: string, public status?: number, public corpo?: unknown) {
    super(message);
  }
}

export const modoMock = () => Boolean(process.env.LG_MOCK) || !process.env.LG_PAT;

function headers(): Record<string, string> {
  const token = process.env.LG_PAT;
  if (!token) throw new ThinqError('LG_PAT não configurado');
  return {
    Authorization: `Bearer ${token}`,
    'x-country': process.env.LG_COUNTRY || 'BR',
    'x-message-id': randomUUID().replace(/-/g, '').slice(0, 22),
    'x-client-id': 'ar-consumo',
    'x-api-key': API_KEY,
    'x-service-phase': 'OP',
    'Content-Type': 'application/json',
  };
}

export async function chamar(caminho: string, corpo?: unknown): Promise<unknown> {
  const url = `https://api-${process.env.LG_REGION || 'aic'}.lgthinq.com${caminho}`;
  const res = await fetch(url, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: headers(),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: 'no-store',
    signal: AbortSignal.timeout(9000),
  });
  const texto = await res.text();
  let json: unknown = texto;
  try {
    json = JSON.parse(texto);
  } catch {
    // resposta não-JSON: devolve o texto cru no erro
  }
  if (!res.ok) throw new ThinqError(`LG respondeu ${res.status}`, res.status, json);
  return json;
}

export const textoDoErro = (e: unknown) =>
  e instanceof ThinqError ? `${e.message}${e.corpo ? `: ${JSON.stringify(e.corpo)}` : ''}` : String(e);

type Aparelho = { id: string; nome: string };
let cache: Aparelho | null = null;

async function aparelho(): Promise<Aparelho> {
  if (cache) return cache;
  const lista = ((await chamar('/devices')) as { response?: unknown }).response;
  if (!Array.isArray(lista) || !lista.length) throw new ThinqError('Nenhum aparelho encontrado na conta');
  const tipo = (d: unknown) => String((d as { deviceInfo?: { deviceType?: string } }).deviceInfo?.deviceType);
  const ar = (lista.find((d) => tipo(d).includes('AIR_CONDITIONER')) ?? lista[0]) as {
    deviceId: string;
    deviceInfo?: { alias?: string };
  };
  cache = { id: ar.deviceId, nome: ar.deviceInfo?.alias ?? 'Ar-condicionado' };
  return cache;
}

export async function lerDispositivo(): Promise<Device> {
  if (modoMock()) return mockDispositivo();
  const { id, nome } = await aparelho();
  return parseEstado(nome, await chamar(`/devices/${encodeURIComponent(id)}/state`));
}

export async function enviarComando(c: Comando): Promise<void> {
  if (modoMock()) return mockComando(c);
  const { id } = await aparelho();
  await chamar(`/devices/${encodeURIComponent(id)}/control`, corpoDoComando(c));
}

/** Consumo diário dos últimos 30 dias. */
export async function lerUso(): Promise<DiaEnergia[]> {
  if (modoMock()) return mockUso();
  const { id } = await aparelho();
  const perfil = (await chamar(`/devices/energy/${encodeURIComponent(id)}/profile`)) as {
    response?: { result?: { property?: unknown } };
  };
  const props = perfil.response?.result?.property;
  const propriedade = Array.isArray(props) ? props[0] : props;
  if (typeof propriedade !== 'string') throw new ThinqError('Perfil de energia sem propriedade reconhecida');
  const hoje = new Date();
  const ini = new Date(hoje.getTime() - 30 * 86_400_000);
  // O formato de data aceito não está documentado: tenta AAAA-MM-DD e depois AAAAMMDD.
  let ultimo: unknown;
  for (const compacto of [false, true]) {
    const f = (d: Date) => (compacto ? ymd(d).replace(/-/g, '') : ymd(d));
    const q = new URLSearchParams({ property: propriedade, period: 'DAILY', startDate: f(ini), endDate: f(hoje) });
    try {
      return parseEnergia(await chamar(`/devices/energy/${encodeURIComponent(id)}/usage?${q}`));
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo;
}
