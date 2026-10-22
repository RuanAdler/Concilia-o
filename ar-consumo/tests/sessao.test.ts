import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

import { conferePin, criarToken, pinConfigurado, tokenValido } from '../src/lib/sessao';

describe('sessão por PIN', () => {
  beforeEach(() => { process.env.APP_PIN = '123456'; process.env.LG_PAT = 'segredo'; });
  afterEach(() => { delete process.env.APP_PIN; delete process.env.LG_PAT; });

  it('só aceita PIN de 6 dígitos configurado', () => {
    expect(pinConfigurado()).toBe(true);
    process.env.APP_PIN = '12';
    expect(pinConfigurado()).toBe(false);
    expect(conferePin('12')).toBe(false);
  });

  it('confere o PIN correto e recusa o errado', () => {
    expect(conferePin('123456')).toBe(true);
    expect(conferePin('654321')).toBe(false);
    expect(conferePin('')).toBe(false);
  });

  it('valida o token assinado e recusa adulterado ou vencido', () => {
    const agora = Date.now();
    const t = criarToken(agora);
    expect(tokenValido(t, agora)).toBe(true);
    expect(tokenValido(t, agora + 13 * 3600 * 1000)).toBe(false);
    const [exp, sig] = t.split('.');
    expect(tokenValido(`${Number(exp) + 99999}.${sig}`, agora)).toBe(false);
    expect(tokenValido('lixo', agora)).toBe(false);
    expect(tokenValido(undefined, agora)).toBe(false);
  });

  it('sem APP_PIN nenhum token vale', () => {
    const t = criarToken();
    delete process.env.APP_PIN;
    expect(tokenValido(t)).toBe(false);
  });
});
