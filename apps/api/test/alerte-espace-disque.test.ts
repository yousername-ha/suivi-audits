/* Alerte d'espace disque (ADR 0106) : releve du disque des données publié par l'exécutant d'exploitation (sans chemin), alerte
   dans l'application pour chaque administrateur actif quand l'espace libre passe sous 15 %, une seule fois par franchissement
   (réarmée à 20 %), avec l'occupation par les sauvegardes et par les images ; le bandeau mène à l'écran des sauvegardes. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SEUIL_ESPACE_LIBRE_POURCENT } from '@suivi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SEUIL_ESPACE_REARMEMENT_POURCENT } from '../src/alertes-securite.js';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

const GIO = 1024 ** 3;
let t: TestApp, admin: Agent, adminUser: TestUser, dir: string;
const disque = (librePourcent: number, imagesOctets: number | null = 3 * GIO) => ({
  libreOctets: Math.round((librePourcent / 100) * 100 * GIO),
  totalOctets: 100 * GIO,
  sauvegardesOctets: 21 * GIO,
  imagesOctets,
});
const alertes = async (userId: string) =>
  (
    await t.svc.db.q<{ title: string; message: string; due_key: string; smsi_id: string | null }>(
      "SELECT title, message, due_key, smsi_id FROM grc_notifications WHERE user_id = $1 AND kind = 'alerte_securite' AND due_key LIKE 'disque:%' ORDER BY created_at",
      [userId],
    )
  ).rows;
const publier = (releve: unknown, vu = new Date()) =>
  writeFileSync(
    path.join(dir, 'exploitation/etat.json'),
    JSON.stringify({
      seenAt: vu.toISOString(),
      backupReady: true,
      restoreReady: true,
      tlsManaged: true,
      tlsMode: 'env',
      destination: 'fictif',
      message: 'Prêt',
      archives: [],
      certificate: null,
      jobs: [],
      disque: releve,
    }),
  );

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'suivi-espace-disque-'));
  mkdirSync(path.join(dir, 'exploitation'));
  t = await createTestApp({ ETAT_DIR: dir, PUBLIC_URL: 'https://suivi.test' });
  adminUser = await makeUser(t, 'disque-admin', 'admin');
  admin = await login(t, adminUser);
});
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await t.svc.db.q("DELETE FROM grc_notifications WHERE kind = 'alerte_securite'");
  await t.svc.db.q("DELETE FROM settings WHERE key = 'exploitation:espace-disque'");
});

describe('alerte d’espace disque', () => {
  it('alerte chaque administrateur actif une seule fois par franchissement, avec l’occupation, sans chemin', async () => {
    const autre = await makeUser(t, 'disque-admin-2', 'admin');
    const lecteur = await makeUser(t, 'disque-rw', 'rw');
    expect(SEUIL_ESPACE_LIBRE_POURCENT).toBe(15);
    expect(await t.svc.alertesSecurite.espaceDisque(disque(40))).toBe('normal');
    expect(await alertes(adminUser.id)).toHaveLength(0);
    expect(await t.svc.alertesSecurite.espaceDisque(disque(12))).toBe('bas');
    for (const u of [adminUser, autre]) {
      const l = await alertes(u.id);
      expect(l).toHaveLength(1);
      expect(l[0]!.smsi_id).toBeNull();
      expect(l[0]!.title).toBe('Espace disque bas sur le serveur : 12 % libre');
      expect(l[0]!.message).toContain('12 Go libres sur 100 Go');
      expect(l[0]!.message).toContain('sauvegardes 21 Go');
      expect(l[0]!.message).toContain('images de l’application 3 Go');
      expect(l[0]!.message).not.toContain(dir);
    }
    expect(await alertes(lecteur.id)).toHaveLength(0);
    // Toujours sous le seuil, ou remonté entre le seuil et le réarmement : pas de rafale.
    for (const p of [10, 14, 16, SEUIL_ESPACE_REARMEMENT_POURCENT - 0.5, 13])
      expect(await t.svc.alertesSecurite.espaceDisque(disque(p))).toBe('bas');
    expect(await alertes(adminUser.id)).toHaveLength(1);
    // Place libérée au-delà du réarmement, puis nouveau franchissement : une seconde alerte.
    expect(await t.svc.alertesSecurite.espaceDisque(disque(SEUIL_ESPACE_REARMEMENT_POURCENT))).toBe('normal');
    expect(await t.svc.alertesSecurite.espaceDisque(disque(9, null))).toBe('bas');
    const l = await alertes(adminUser.id);
    expect(l).toHaveLength(2);
    expect(l[1]!.message).toContain('images de l’application non mesurées');
    const actions = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE 'exploitation.espace_disque_%' ORDER BY id",
    );
    expect(actions.rows.map((r) => r.action).slice(-3)).toEqual([
      'exploitation.espace_disque_bas',
      'exploitation.espace_disque_retabli',
      'exploitation.espace_disque_bas',
    ]);
  });

  it('releve absent, incohérent ou périmé : rien n’est émis', async () => {
    expect(await t.svc.alertesSecurite.espaceDisque(null)).toBeNull();
    expect(await t.svc.alertesSecurite.espaceDisque(undefined)).toBeNull();
    expect(
      await t.svc.alertesSecurite.espaceDisque({ ...disque(5), libreOctets: 200 * GIO, totalOctets: 100 * GIO }),
    ).toBeNull();
    publier(disque(5), new Date(Date.now() - 10 * 60_000));
    expect(t.svc.operations.disqueHote()).toBeNull();
    publier(disque(5));
    expect(t.svc.operations.disqueHote()).toEqual(disque(5));
    expect(await alertes(adminUser.id)).toHaveLength(0);
  });

  it('le releve publié est lu à la synchronisation de l’exécutant ; le bandeau mène aux sauvegardes', async () => {
    publier(disque(11));
    await t.svc.alertesSecurite.espaceDisque(t.svc.operations.disqueHote());
    const r = await admin.get('/api/account/alertes-securite');
    expect(r.statusCode).toBe(200);
    const disqueBas = r.json().find((a: { title: string }) => a.title.startsWith('Espace disque bas'));
    expect(disqueBas).toMatchObject({ lien: '/systeme/sauvegardes', libelleLien: 'Sauvegardes et restauration' });
    // Relevé exposé aux lecteurs de l'exploitation, sans chemin.
    const e = (await admin.get('/api/admin/exploitation')).json();
    expect(e.host.disque).toEqual(disque(11));
  });
});
