import { randomUUID } from 'node:crypto';

// Chave pública da API ThinQ Connect (a mesma da documentação oficial da LG).
const API_KEY = 'v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3';

export class ThinqError extends Error {
  constructor(message: string, public status?: number, public corpo?: unknown) {
    super(message);
  }
}

function base(): string {
  const regiao = process.env.LG_REGION || 'aic';
  return `https://api-${regiao}.lgthinq.com`;
}

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

export async function chamar(caminho: string): Promise<unknown> {
  const res = await fetch(`${base()}${caminho}`, { headers: headers(), cache: 'no-store' });
  const texto = await res.text();
  let corpo: unknown = texto;
  try {
    corpo = JSON.parse(texto);
  } catch {
    // resposta não-JSON: devolve o texto cru no erro
  }
  if (!res.ok) throw new ThinqError(`LG respondeu ${res.status}`, res.status, corpo);
  return corpo;
}

export const listarDispositivos = () => chamar('/devices');
export const estadoDoDispositivo = (id: string) => chamar(`/devices/${encodeURIComponent(id)}/state`);

export const perfilDeEnergia = (id: string) => chamar(`/devices/energy/${encodeURIComponent(id)}/profile`);

export function energiaDoDispositivo(id: string, propriedade: string, periodo: string, de: string, ate: string) {
  const q = new URLSearchParams({ property: propriedade, period: periodo, startDate: de, endDate: ate });
  return chamar(`/devices/energy/${encodeURIComponent(id)}/usage?${q}`);
}
