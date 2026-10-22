import { useEffect, useState } from 'react';
import type { Tarifas } from './stats';

export type Conta = { valor: string; kwh: string; fixas: string; mes: string; inicio: string; fim: string };

export type Config = {
  tariffMode: 'direto' | 'conta';
  tariff: string;
  billValue: string;
  billKwh: string;
  base: string;
  since: string;
  goalType: 'R$' | 'kWh';
  goal: string;
  goalKwh: string;
  alert80: boolean;
  alert100: boolean;
  theme: 'auto' | 'claro' | 'escuro';
  nome: string;
  conta: Conta;
  tarifas: Tarifas;
  tarifaDefinida: boolean;
};

export const CONFIG_PADRAO: Config = {
  tariffMode: 'direto',
  tariff: '0,95',
  billValue: '',
  billKwh: '',
  base: '0',
  since: '',
  goalType: 'R$',
  goal: '150',
  goalKwh: '170',
  alert80: true,
  alert100: true,
  theme: 'auto',
  nome: '',
  conta: { valor: '', kwh: '', fixas: '0', mes: '', inicio: '', fim: '' },
  tarifas: {},
  tarifaDefinida: false,
};

/** useState persistido no localStorage (seguro para SSR e para navegação privada). */
export function usarLocal<T>(chave: string, inicial: T) {
  const [v, setV] = useState<T>(inicial);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem(chave);
      if (s) setV(JSON.parse(s) as T);
    } catch {
      // sem localStorage: segue com o valor inicial
    }
    setPronto(true);
  }, [chave]);
  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(chave, JSON.stringify(v));
    } catch {
      // armazenamento indisponível
    }
  }, [chave, v, pronto]);
  return [v, setV, pronto] as const;
}

/** true um instante depois de montar: dispara as animações de crescimento. */
export function useMontado() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), 80);
    return () => clearTimeout(t);
  }, []);
  return m;
}
