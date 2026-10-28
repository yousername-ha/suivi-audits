/* Alerte de verrouillage (L7, ADR 0069) : plafond horaire. Base dédiée : le décompte porte sur le journal d'audit, qui est en ajout
   seul et ne peut donc pas être purgé entre deux tests. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMANDEUR_ALERTE } from '../src/alertes-exploitation.js';
import { ALERTES_PAR_HEURE } from '../src/alertes-securite.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const CONTACT = 'plafond@exemple.test';
let t: TestApp;

beforeAll(async () => {
  t = await createTestApp({ PUBLIC_URL: 'https://suivi.test' });
  const admin: Agent = await login(t, await makeUser(t, 'plafond-admin', 'admin'));
  const g = await admin.get('/api/settings/courriel');
  const r = await admin.put(
    '/api/settings/courriel',
    {
      ...g.json().values,
      actif: true,
      hote: 'smtp.exemple.test',
      expediteur: 'suivi@exemple.test',
      contactTechnique: CONTACT,
    },
    { 'if-match': g.headers.etag as string },
  );
  expect(r.statusCode, r.body).toBe(200);
});
afterAll(() => t.close());

describe('alerte de verrouillage : anti-inondation', () => {
  it('douze verrous dans l’heure : dix alertes détaillées, puis une seule synthèse, jamais d’adresse IP', async () => {
    expect(ALERTES_PAR_HEURE).toBe(10);
    // Échecs enregistrés directement (le chemin HTTP est couvert dans alerte-verrouillage.test.ts) : 12 × 5 vérifications
    // scrypt seraient trop longues. Un seul destinataire (le contact technique) : un verrou = un courriel.
    for (let i = 0; i < 12; i++) {
      const u = await makeUser(t, `plafond-${i}`, 'rw');
      for (let j = 0; j < 5; j++) await t.svc.auth.enregistrerEchec(u.id, 'mot_de_passe', '203.0.113.9');
    }
    const envois = (
      await t.svc.db.q<{ to_address: string; subject: string; body: string }>(
        'SELECT to_address, subject, body FROM courriel_jobs WHERE requested_by = $1 ORDER BY created_at',
        [DEMANDEUR_ALERTE],
      )
    ).rows;
    const detail = envois.filter((e) => /Compte verrouillé :/.test(e.subject));
    const synthese = envois.filter((e) => /comptes verrouillés/i.test(e.subject));
    expect(detail).toHaveLength(10);
    expect(synthese).toHaveLength(1);
    expect(synthese[0]!.subject).toMatch(/11 comptes verrouillés depuis \d{2}:\d{2}/);
    expect(synthese[0]!.body).toContain('https://suivi.test/admin/audit');
    expect(envois).toHaveLength(11);
    expect(envois.map((e) => e.body).join('\n')).not.toContain('203.0.113.9');
    // Le journal garde les douze événements, même au-delà du plafond de courriels.
    const journal = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='auth.account_locked'",
    );
    expect(journal!.n).toBe(12);
  }, 60_000);
});
