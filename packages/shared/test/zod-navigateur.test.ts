/* Zod sans compilation à la volée dans le navigateur (zod-navigateur.ts, ADR 0006, addendum du 24/11/2026) : la sonde
   `new Function` de zod serait relevée par la CSP et par Trusted Types à chaque page. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

// Le réglage de zod est global (il survit au rechargement des modules) : remis à son état par défaut après chaque cas.
afterEach(async () => {
  vi.unstubAllGlobals();
  (await import('zod')).config({ jitless: undefined });
  vi.resetModules();
});

describe('zod dans le navigateur', () => {
  it('avec un document (navigateur) : jitless, la sonde new Function n’est jamais lancée', async () => {
    vi.stubGlobal('document', {});
    const sonde = vi.fn();
    vi.stubGlobal(
      'Function',
      new Proxy(Function, {
        construct: (cible, args) => {
          sonde();
          return Reflect.construct(cible, args);
        },
      }),
    );
    await import('../src/zod-navigateur.js');
    const { config, z } = await import('zod');
    expect(config().jitless).toBe(true);
    expect(z.object({ a: z.string() }).parse({ a: 'x' })).toEqual({ a: 'x' });
    expect(sonde).not.toHaveBeenCalled();
  });

  it('sans document (API sous Node) : la compilation à la volée reste permise', async () => {
    await import('../src/zod-navigateur.js');
    const { config } = await import('zod');
    expect(config().jitless).not.toBe(true);
  });

  it('chaque point d’entrée du paquet l’importe avant tout schéma', () => {
    for (const entree of ['index.ts', 'legacy/index.ts', 'carto/index.ts', 'audit/index.ts']) {
      const instructions = readFileSync(path.join(SRC, entree), 'utf8')
        .split('\n')
        .filter((l) => /^(import|export)\b/.test(l));
      expect(instructions[0], entree).toMatch(/^import '(\.\/|\.\.\/)zod-navigateur\.js';$/);
    }
  });
});
