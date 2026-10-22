import { type Comando, type Device } from './device';
import { type DiaEnergia } from './energia';
import { ymd } from './fmt';

// Modo de teste (LG_MOCK=1 ou sem LG_PAT): aparelho em memória e consumo sintético.
let estado: Device = { name: 'Gelinho', on: true, mode: 'frio', ambientC: 27, targetC: 23, fan: 'Auto', timerAtivo: false };

export const mockDispositivo = async (): Promise<Device> => ({ ...estado });

export async function mockComando(c: Comando): Promise<void> {
  if (c.action === 'power') estado = { ...estado, on: c.value, timerAtivo: c.value ? estado.timerAtivo : false };
  if (c.action === 'target') estado = { ...estado, targetC: c.value };
  if (c.action === 'mode') estado = { ...estado, mode: c.value };
  if (c.action === 'timer') estado = { ...estado, timerAtivo: c.value !== null };
}

const pseudo = (i: number) => {
  const x = Math.sin(i * 91.7 + 7.3) * 43758.5453;
  return x - Math.floor(x);
};

export async function mockUso(): Promise<DiaEnergia[]> {
  const hoje = new Date();
  const dias: DiaEnergia[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
    const fds = d.getDay() === 0 || d.getDay() === 6 ? 1.6 : 0;
    dias.push({ data: ymd(d), kwh: Math.round((3.7 + fds + pseudo(i) * 2.2) * 10) / 10 });
  }
  return dias;
}
