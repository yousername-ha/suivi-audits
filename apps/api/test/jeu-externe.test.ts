/* Chargement d'un jeu de données externe (suivi charger-jeu) : format contrôlé, dates relatives, instance vide exigée,
   écritures par l'API publique. Le dépôt ne contient aucun jeu : celui du test est minimal et fictif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chargerJeuExterne, resoudre } from '../src/jeu-externe.js';
import { createTestApp, makeUser, type TestApp } from './helpers.js';

let t: TestApp;
const cfg = { publicUrl: 'https://localhost' };
const jeu = {
  nom: 'Organisation fictive de test',
  etat: {
    scope: { organisation: 'Organisation fictive de test', text: 'Périmètre fictif.' },
    processes: [{ id: 'PR1', name: 'Processus fictif', family: 'Management', owner: 'Direction', purpose: '' }],
  },
  risques: [{ code: 'R01', nom: 'Risque fictif', gravite: 3, vraisemblance: 2, revue: '@J+30' }],
  actions: [{ nom: 'Action fictive en retard', echeance: '@J-10' }],
  ecarts: [{ nom: 'Écart fictif clos', statut: 'closed', echeance: '@J-5' }],
  documents: [
    {
      fichier: 'politique-fictive.txt',
      titre: 'Politique fictive',
      base64: Buffer.from('Politique fictive de test.').toString('base64'),
    },
  ],
  liens: [{ title: 'Lien fictif', url: 'https://exemple.invalid/' }],
  assistant: { contexte: 'Contexte fictif.', missions: [{ profil: 'mise_en_oeuvre', consigne: 'Mission fictive.' }] },
};

beforeAll(async () => {
  t = await createTestApp({ PUBLIC_URL: 'https://localhost' });
  await makeUser(t, 'jeu_admin', 'admin');
});
afterAll(async () => {
  await t?.close();
});

describe('jeu de données externe', () => {
  it('remplace les dates relatives et le compte dans toutes les chaînes', () => {
    const jour = (n: number) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
    expect(resoudre({ a: '@J+3', b: ['du @J-1 au @J+0', '@MOI'], c: 4 }, 'id-fictif')).toEqual({
      a: jour(3),
      b: [`du ${jour(-1)} au ${jour(0)}`, 'id-fictif'],
      c: 4,
    });
  });

  it('refuse un jeu mal formé et un compte inconnu, sans rien écrire', async () => {
    await expect(chargerJeuExterne(t.svc, t.app, 'jeu_admin', { nom: 'x', inconnu: 1 }, cfg)).rejects.toThrow();
    await expect(chargerJeuExterne(t.svc, t.app, 'personne', jeu, cfg)).rejects.toThrow('Compte inconnu');
    expect((await t.svc.db.q("SELECT 1 FROM grc_objects WHERE kind IN ('action', 'risk')")).rows).toEqual([]);
  });

  it('charge le jeu par l’API, attribue les actions au compte et ferme sa session temporaire', async () => {
    const bilan = await chargerJeuExterne(t.svc, t.app, 'jeu_admin', jeu, cfg);
    expect(bilan).toMatchObject({
      etat: true,
      referentiels: ['iso-27001-2022', 'hds'],
      risques: 1,
      actions: 1,
      ecarts: 1,
      documents: 1,
      liens: 1,
      missions: 1,
    });
    const { rows } = await t.svc.db.q<{ kind: string; data: Record<string, string> }>(
      "SELECT kind, data FROM grc_objects WHERE kind IN ('action', 'nonconformity') ORDER BY kind",
    );
    const moi = (await t.svc.db.q<{ id: string }>("SELECT id::text FROM users WHERE username = 'jeu_admin'")).rows[0]!
      .id;
    expect(rows[0]!.data.ownerId).toBe(moi);
    expect(String(rows[0]!.data.dueAt) < new Date().toISOString()).toBe(true);
    expect(rows[1]!.data.status).toBe('closed');
    expect((await t.svc.db.q("SELECT 1 FROM sessions WHERE user_agent = 'charger-jeu'")).rows).toEqual([]);
    expect((await t.svc.db.q<{ contexte: string }>('SELECT contexte FROM assistant_reglages')).rows[0]!.contexte).toBe(
      'Contexte fictif.',
    );
  });

  it('refuse un second chargement : l’instance n’est plus vide', async () => {
    await expect(chargerJeuExterne(t.svc, t.app, 'jeu_admin', jeu, cfg)).rejects.toThrow('instance vide');
  });
});
