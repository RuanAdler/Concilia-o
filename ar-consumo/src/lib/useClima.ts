'use client';

import { useCallback, useEffect, useState } from 'react';
import { usarLocal } from './cliente';
import { URL_CLIMA, mesclarClima, parseClima, precisaBuscar, type CacheClima } from './clima';

export type EstadoClima = 'ocioso' | 'carregando' | 'ok' | 'erro';

/** Máxima do dia em Barreiras-BA: busca no máximo de 3 em 3 horas e guarda no celular o que já veio. */
export function useClima(ativo: boolean) {
  const [cache, setCache, pronto] = usarLocal<CacheClima | null>('ar.clima', null);
  const [estado, setEstado] = useState<EstadoClima>('ocioso');

  const buscar = useCallback(async () => {
    setEstado('carregando');
    const ctl = new AbortController();
    const limite = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(URL_CLIMA, { signal: ctl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const novo = parseClima(await r.json());
      if (!novo) throw new Error('formato');
      setCache((c) => ({ dias: mesclarClima(c?.dias ?? {}, novo), atualizadoEm: Date.now() }));
      setEstado('ok');
    } catch {
      setEstado('erro');
    } finally {
      clearTimeout(limite);
    }
  }, [setCache]);

  useEffect(() => {
    if (!ativo || !pronto) return;
    if (precisaBuscar(cache, Date.now())) buscar();
    else setEstado('ok');
    // só decide ao ligar o clima ou quando o cache local termina de carregar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, pronto]);

  return { dias: cache?.dias ?? {}, estado, tentar: buscar };
}
