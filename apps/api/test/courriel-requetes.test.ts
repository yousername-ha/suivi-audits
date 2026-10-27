/* Requêtes du courriel (conversion Kysely, ADR 0062) : mot de passe scellé (présence, remplacement, retrait), demande de test
   abandonnée close avant une nouvelle, dernière demande, demande inconnue. Données fictives, aucun envoi réel. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
const acteur = { username: 'mailq_admin' };

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('courriel : requêtes', () => {
  it('mot de passe scellé : défini, remplacé, retiré', async () => {
    expect(await t.svc.courriel.motDePasseDefini()).toBe(false);
    await t.svc.courriel.definirMotDePasse('premier-fictif', acteur, '127.0.0.1');
    await t.svc.courriel.definirMotDePasse('second-fictif', acteur, '127.0.0.1');
    expect(await t.svc.courriel.motDePasseDefini()).toBe(true);
    const brut = await t.svc.db.one<{ value: { sealed: string } }>(
      "SELECT value FROM settings WHERE key='secret:courriel'",
    );
    expect(typeof brut!.value.sealed).toBe('string');
    expect(brut!.value.sealed).not.toContain('second-fictif');
    await t.svc.courriel.retirerMotDePasse(acteur, '127.0.0.1');
    expect(await t.svc.courriel.motDePasseDefini()).toBe(false);
  });

  it('une demande de test abandonnée est close avant d’en accepter une nouvelle', async () => {
    const conf = {
      ...((await t.svc.settings.read('courriel')).values as never as Record<string, unknown>),
      actif: true,
      hote: 'smtp.exemple.test',
      expediteur: 'suivi@exemple.test',
      contactTechnique: 'technique@exemple.test',
      utilisateur: '',
    } as never;
    await t.svc.backups.heartbeat(true);
    expect(await t.svc.courriel.derniere()).toBeNull();
    const d1 = await t.svc.courriel.demanderTest(conf, acteur, '127.0.0.1');
    expect(d1).toMatchObject({ status: 'en_attente', requestedBy: 'mailq_admin', to: 'technique@exemple.test' });
    await expect(t.svc.courriel.demanderTest(conf, acteur, '127.0.0.1')).rejects.toThrow(/déjà en cours/);
    await t.svc.db.q("UPDATE courriel_jobs SET created_at = now() - interval '5 minutes' WHERE id=$1", [d1.id]);
    const d2 = await t.svc.courriel.demanderTest(conf, acteur, '127.0.0.1');
    expect(await t.svc.courriel.lireDemande(d1.id)).toMatchObject({
      status: 'echec',
      steps: [],
      error: 'Demande abandonnée : l’exécutant n’a pas répondu.',
    });
    expect((await t.svc.courriel.lireDemande(d1.id)).finishedAt).not.toBeNull();
    expect((await t.svc.courriel.derniere())!.id).toBe(d2.id);
    await expect(t.svc.courriel.lireDemande(randomUUID())).rejects.toThrow(/introuvable/);
  });
});
