/* Robustesse (L10, G1 et G6) : une transaction annulée par deadlock ou échec de sérialisation est rejouée entière, au plus
   deux fois ; une transaction restée inactive est coupée après une minute. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DELAI_TRANSACTION_INACTIVE_MS, RELANCES_MAX } from '../src/db/db.js';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
  await t.svc.db.q('CREATE TABLE essai_deadlock (id int PRIMARY KEY, v int NOT NULL DEFAULT 0)');
  await t.svc.db.q('INSERT INTO essai_deadlock(id) VALUES (1), (2)');
});
afterAll(async () => {
  await t.close();
});

/** Barrière : les deux transactions ont chacune pris leur premier verrou avant de demander le second. */
function barriere(n: number) {
  let arrives = 0;
  let ouvrir!: () => void;
  const ouverte = new Promise<void>((r) => (ouvrir = r));
  return () => {
    if (++arrives >= n) ouvrir();
    return ouverte;
  };
}

describe('relance sur conflit (G1)', () => {
  it('deux transactions qui se bloquent mutuellement réussissent toutes les deux : l’une est rejouée', async () => {
    const attendre = barriere(2);
    const essais = { a: 0, b: 0 };
    const avertissements: Array<Record<string, unknown>> = [];
    const warn = t.svc.db.log.warn.bind(t.svc.db.log);
    t.svc.db.log.warn = ((o: unknown, m?: string) => {
      if (m === 'transaction rejouée après conflit') avertissements.push(o as Record<string, unknown>);
      return (warn as (o: unknown, m?: string) => void)(o, m);
    }) as typeof t.svc.db.log.warn;
    try {
      const deux = (nom: 'a' | 'b', premier: number, second: number) =>
        t.svc.db.tx(async (c) => {
          essais[nom]++;
          await c.query('UPDATE essai_deadlock SET v = v + 1 WHERE id = $1', [premier]);
          // Seule la première tentative se synchronise : la tentative rejouée n'attend plus personne.
          if (essais[nom] === 1) await attendre();
          await c.query('UPDATE essai_deadlock SET v = v + 1 WHERE id = $1', [second]);
          return nom;
        });
      const r = await Promise.all([deux('a', 1, 2), deux('b', 2, 1)]);
      expect(r).toEqual(['a', 'b']);
      // Une des deux a été annulée par PostgreSQL (deadlock) et rejouée une fois ; l'autre n'a joué qu'une fois.
      expect(essais.a + essais.b).toBe(3);
      expect(avertissements).toHaveLength(1);
      expect(avertissements[0]).toMatchObject({ code: '40P01', essai: 1, max: RELANCES_MAX });
      // Chaque ligne a été modifiée exactement deux fois (une par transaction) : aucune écriture perdue ni doublée.
      const lignes = await t.svc.db.q<{ id: number; v: number }>('SELECT id, v FROM essai_deadlock ORDER BY id');
      expect(lignes.rows.map((x) => x.v)).toEqual([2, 2]);
    } finally {
      t.svc.db.log.warn = warn as typeof t.svc.db.log.warn;
    }
  }, 30_000);

  it('rejoue au plus deux fois, puis relance l’erreur ; les effets annulés ne subsistent pas', async () => {
    let essais = 0;
    const erreur = Object.assign(new Error('échec de sérialisation simulé'), { code: '40001' });
    await expect(
      t.svc.db.tx(async (c) => {
        essais++;
        await c.query('UPDATE essai_deadlock SET v = 100 WHERE id = 1');
        throw erreur;
      }),
    ).rejects.toBe(erreur);
    expect(essais).toBe(RELANCES_MAX + 1);
    expect((await t.svc.db.one<{ v: number }>('SELECT v FROM essai_deadlock WHERE id = 1'))!.v).not.toBe(100);
  }, 30_000);

  it('réussit à la dernière relance et ne rejoue pas les autres erreurs', async () => {
    let essais = 0;
    const r = await t.svc.db.tx(async () => {
      if (++essais <= RELANCES_MAX) throw Object.assign(new Error('conflit'), { code: '40001' });
      return 'ok';
    });
    expect([r, essais]).toEqual(['ok', RELANCES_MAX + 1]);
    for (const code of ['23505', '42P01', undefined]) {
      let n = 0;
      await expect(
        t.svc.db.tx(async () => {
          n++;
          throw Object.assign(new Error('autre'), { code });
        }),
      ).rejects.toThrow('autre');
      expect(n, String(code)).toBe(1);
    }
  });

  it('attend 50 à 200 ms entre deux tentatives', async () => {
    const debut = Date.now();
    let essais = 0;
    await t.svc.db.tx(async () => {
      if (++essais === 1) throw Object.assign(new Error('conflit'), { code: '40P01' });
    });
    const duree = Date.now() - debut;
    expect(duree).toBeGreaterThanOrEqual(45);
    expect(duree).toBeLessThan(2000);
  });
});

describe('transaction inactive (G6)', () => {
  it('le délai d’inactivité en transaction est d’une minute sur toutes les connexions du pool', async () => {
    expect(DELAI_TRANSACTION_INACTIVE_MS).toBe(60_000);
    const r = await t.svc.db.one<{ idle_in_transaction_session_timeout: string }>(
      'SHOW idle_in_transaction_session_timeout',
    );
    expect(r!.idle_in_transaction_session_timeout).toBe('1min');
  });

  it('une transaction inactive est coupée par le serveur et rend sa connexion', async () => {
    const c = await t.svc.db.pool.connect();
    // Le serveur ferme la connexion (erreur fatale 25P03) : l'évènement d'erreur du client est attendu.
    const fatales: string[] = [];
    c.on('error', (e) => fatales.push((e as { code?: string }).code ?? e.message));
    try {
      await c.query("SET idle_in_transaction_session_timeout = '300ms'");
      await c.query('BEGIN');
      await c.query('SELECT 1');
      await new Promise((r) => setTimeout(r, 1000));
      await expect(c.query('SELECT 1')).rejects.toBeTruthy();
      expect(fatales).toContain('25P03');
    } finally {
      c.release(true);
    }
    // Le pool reste utilisable.
    expect((await t.svc.db.one<{ ok: number }>('SELECT 1 AS ok'))!.ok).toBe(1);
  });
});
