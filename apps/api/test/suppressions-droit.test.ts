/* Suppressions : toute suppression d'un enregistrement exige le droit « supprimer » du module (ADR 0010 : un contributeur
   « ne peut plus supprimer »). Pour chaque route, un contributeur reçoit 403 ; un compte qui peut supprimer passe la garde
   (404 sur un identifiant inexistant). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const SMSI = '00000000-0000-4000-8000-000000000001';
const ID = '00000000-0000-4000-8000-0000000000aa';
const ROUTES: [string, string][] = [
  ['plans', `/api/plans/${ID}`],
  ['jour du plan d’audit', `/api/audit-suivi/plan/jours/${ID}`],
  ['créneau du plan d’audit', `/api/audit-suivi/plan/creneaux/${ID}`],
  ['personne du plan d’audit', `/api/audit-suivi/plan/personnes/${ID}`],
  ['GAP', `/api/gap/${ID}`],
  ['point du GAP', `/api/gap/${ID}/points/${ID}`],
  ['investissement', `/api/investissements/lignes/${ID}`],
  ['établissement CRRC', `/api/crrc/etablissements/${ID}`],
  ['ressource CRRC', `/api/crrc/ressources/${ID}`],
  ['sauvegarde CRRC', `/api/crrc/sauvegardes/${ID}`],
  ['offre CRRC', `/api/crrc/offres/${ID}`],
  ['incident', `/api/incidents/${ID}`],
  ['échéance de crise', `/api/crise/cellules/${ID}/echeances/0`],
  ['contact de crise', '/api/crise/contacts/0'],
  ['scénario de crise', `/api/crise/scenarios/${ID}`],
  ['action de scénario', `/api/crise/scenarios/${ID}/actions/0`],
  ['évaluation du clausier', `/api/evaluations-clausier/${ID}`],
  ['objectif', `/api/grc/${SMSI}/pilotage/objectifs/objectives/${ID}?confirm=SUPPRIMER`],
  ['processus', `/api/grc/${SMSI}/pilotage/objectifs/processes/${ID}?confirm=SUPPRIMER`],
  ['indicateur', `/api/grc/${SMSI}/pilotage/objectifs/indicators/${ID}?confirm=SUPPRIMER`],
  ['valeur d’indicateur', `/api/grc/${SMSI}/pilotage/objectifs/indicators/${ID}/values/0`],
];

describe('suppressions : droit « supprimer » exigé', () => {
  let t: TestApp;
  let contributeur: Agent, rssi: Agent;
  beforeAll(async () => {
    t = await createTestApp();
    contributeur = await login(t, await makeUser(t, 'sup_contrib', 'rw'));
    rssi = await login(t, await makeUser(t, 'sup_rssi', 'rssi'));
  });
  afterAll(() => t.close());

  it.each(ROUTES)('%s : refusé à un contributeur', async (_nom, url) => {
    const r = await contributeur.del(url);
    expect(r.statusCode, r.body).toBe(403);
  });

  it.each(ROUTES)('%s : la garde laisse passer qui peut supprimer', async (_nom, url) => {
    const r = await rssi.del(url);
    expect(r.statusCode, r.body).toBe(404);
  });
});
