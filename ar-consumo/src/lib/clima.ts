import type { Dia } from './stats';

// Barreiras-BA. Serviço gratuito e sem chave (Open-Meteo): máxima de cada dia, com os últimos 92 dias.
export const LATITUDE = -12.15;
export const LONGITUDE = -45.0;
export const URL_CLIMA = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=temperature_2m_max&timezone=America%2FBahia&past_days=92&forecast_days=1`;

export type Clima = Record<string, number>;
export type CacheClima = { dias: Clima; atualizadoEm: number };

/** Escala fixa do gráfico, em °C. */
export const T_MIN = 26;
export const T_MAX = 40;

/** Lê a resposta do serviço; devolve null se ela não tiver o formato esperado. */
export function parseClima(json: unknown): Clima | null {
  const daily = (json as { daily?: { time?: unknown; temperature_2m_max?: unknown } } | null)?.daily;
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.temperature_2m_max) || daily.time.length !== daily.temperature_2m_max.length) return null;
  const mapa: Clima = {};
  daily.time.forEach((t, i) => {
    const v = (daily.temperature_2m_max as unknown[])[i];
    if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && typeof v === 'number' && Number.isFinite(v)) mapa[t] = v;
  });
  return Object.keys(mapa).length ? mapa : null;
}

/** O cache guarda tudo o que já veio (inclusive dias fora da janela de 92); o dado novo vence. */
export const mesclarClima = (antigo: Clima, novo: Clima): Clima => ({ ...antigo, ...novo });

export const HORAS_ATE_BUSCAR_DE_NOVO = 3;
export const precisaBuscar = (cache: CacheClima | null, agora: number) =>
  !cache || !Object.keys(cache.dias).length || agora - cache.atualizadoEm > HORAS_ATE_BUSCAR_DE_NOVO * 3_600_000;

/**
 * Caminho SVG (viewBox 0 0 100 100) da máxima de cada dia: um ponto no centro de cada espaço,
 * com falhas nos dias sem dado e um pontinho para um dia isolado.
 */
export function caminhoClima(valores: (number | null)[], min = T_MIN, max = T_MAX): string {
  const n = valores.length;
  const partes: string[] = [];
  let aberto = false;
  valores.forEach((v, i) => {
    if (v == null) { aberto = false; return; }
    const x = ((i + 0.5) / n) * 100;
    const y = 100 - Math.min(1, Math.max(0, (v - min) / (max - min))) * 100;
    const proximoTem = i + 1 < n && valores[i + 1] != null;
    if (!aberto) {
      partes.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
      if (!proximoTem) partes.push(`l 0.01 0`);
      aberto = true;
    } else {
      partes.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  });
  return partes.join(' ');
}

export const posY = (t: number, min = T_MIN, max = T_MAX) => 100 - Math.min(1, Math.max(0, (t - min) / (max - min))) * 100;

export type InsightClima =
  | { estado: 'ok'; limite: number; diferenca: number; reais: number; igual: boolean }
  | { estado: 'poucos' };

/**
 * Compara o consumo dos dias quentes com o dos amenos (hoje fica de fora porque ainda está contando).
 * Precisa de pelo menos 5 dias de cada lado; tenta 34 °C e, se faltar dado, outros cortes próximos.
 */
export function insightClima(dias: Dia[], clima: Clima, hojeStr: string, tarifa: number): InsightClima {
  const pares = dias.filter((d) => d.data < hojeStr && clima[d.data] != null).map((d) => ({ t: clima[d.data], k: d.kwh }));
  const ordenadas = pares.map((p) => p.t).sort((a, b) => a - b);
  const mediana = ordenadas.length ? Math.round(ordenadas[Math.floor(ordenadas.length / 2)]) : 34;
  for (const limite of [34, 33, 35, 32, 36, 31, mediana]) {
    const quentes = pares.filter((p) => p.t > limite);
    const amenos = pares.filter((p) => p.t <= limite);
    if (quentes.length < 5 || amenos.length < 5) continue;
    const media = (l: typeof pares) => l.reduce((s, p) => s + p.k, 0) / l.length;
    const diferenca = media(quentes) - media(amenos);
    return { estado: 'ok', limite, diferenca, reais: Math.abs(diferenca) * tarifa, igual: Math.abs(diferenca) < 0.3 };
  }
  return { estado: 'poucos' };
}
