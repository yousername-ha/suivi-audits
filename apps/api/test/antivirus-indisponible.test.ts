/* ClamAV indisponible (L10, G3) : analyse limitée à 15 s, refus clair si elle est obligatoire, et au plus une alerte par heure
   au contact technique (ni aux administrateurs, ni pour chaque dépôt). Pas de disjoncteur : chaque dépôt retente l'analyse. */
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { DEMANDEUR_ALERTE } from '../src/alertes-exploitation.js';
import { loadConfig } from '../src/config.js';
import { DELAI_ANALYSE_MS, FileRejected, scanFile } from '../src/files.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const CONTACT = 'tech-antivirus@exemple.test';
const serveurs: net.Server[] = [];
const apps: TestApp[] = [];
afterEach(async () => {
  for (const s of serveurs.splice(0)) s.close();
  for (const a of apps.splice(0)) await a.close();
});
const config = (env: Record<string, string>) =>
  loadConfig({ DB_HOST: 'x', DB_PASSWORD: 'x', DOC_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'), ...env });
/** Démon qui accepte les connexions et ne répond jamais. */
const demonMuet = () =>
  new Promise<number>((resolve) => {
    const s = net.createServer(() => {});
    serveurs.push(s);
    s.listen(0, '127.0.0.1', () => resolve((s.address() as net.AddressInfo).port));
  });

describe('délai de l’analyse', () => {
  it('est de 15 secondes par défaut', () => {
    expect(DELAI_ANALYSE_MS).toBe(15_000);
  });
  it('un démon muet est abandonné à l’échéance : refus clair si obligatoire, une seule notification d’échec', async () => {
    const port = await demonMuet();
    let echecs = 0;
    const debut = Date.now();
    const erreur = await scanFile(
      config({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(port), CLAMAV_REQUIRED: 'true' }),
      PDF,
      {
        delaiMs: 200,
        surEchec: () => echecs++,
      },
    ).catch((e) => e as Error);
    expect(erreur).toBeInstanceOf(FileRejected);
    expect((erreur as FileRejected).infected).toBe(false);
    expect((erreur as Error).message).toContain('Analyse antivirale indisponible : dépôt refusé.');
    expect((erreur as Error).message).toContain('Réessayez');
    expect(Date.now() - debut).toBeLessThan(3000);
    expect(echecs).toBe(1);
  });
  it('si l’analyse n’est pas obligatoire, le fichier passe « non analysé » et l’échec est notifié', async () => {
    const port = await demonMuet();
    let echecs = 0;
    const r = await scanFile(
      config({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(port), CLAMAV_REQUIRED: 'false' }),
      PDF,
      {
        delaiMs: 200,
        surEchec: () => echecs++,
      },
    );
    expect(r).toBe('non_analysé');
    expect(echecs).toBe(1);
  });
  it('sans antivirus configuré, rien n’est signalé', async () => {
    let echecs = 0;
    expect(await scanFile(config({}), PDF, { surEchec: () => echecs++ })).toBe('non_analysé');
    expect(echecs).toBe(0);
  });
});

describe('alerte au contact technique', () => {
  async function installation(requis: boolean) {
    // Port 1 : connexion refusée aussitôt, comme un service arrêté.
    const t = await createTestApp({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: '1', CLAMAV_REQUIRED: String(requis) });
    apps.push(t);
    const admin = await makeUser(t, 'rssi', 'admin');
    await t.svc.db.q('UPDATE users SET email=$2 WHERE id=$1', [admin.id, 'rssi@exemple.test']);
    const a = await login(t, admin);
    const g = await a.get('/api/settings/courriel');
    const m = await a.put(
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
    expect(m.statusCode, m.body).toBe(200);
    await t.svc.db.q('DELETE FROM courriel_jobs');
    return { t, a };
  }
  const deposer = (a: Agent, nom: string) =>
    a.req('POST', '/api/documents', {
      body: PDF,
      headers: { 'x-file-name': encodeURIComponent(nom), 'x-meta': encodeURIComponent('{}') },
    });
  const alertes = (t: TestApp) =>
    t.svc.db.q<{ to_address: string; subject: string; body: string }>(
      'SELECT to_address, subject, body FROM courriel_jobs WHERE requested_by=$1',
      [DEMANDEUR_ALERTE],
    );
  const attendre = (ms = 300) => new Promise((r) => setTimeout(r, ms));

  it('obligatoire : chaque dépôt est refusé, une seule alerte part, vers le contact technique seul', async () => {
    const { t, a } = await installation(true);
    for (let i = 0; i < 3; i++) {
      const r = await deposer(a, `rapport-${i}.pdf`);
      expect(r.statusCode).toBe(422);
      expect(r.json().error).toContain('Analyse antivirale indisponible : dépôt refusé.');
    }
    await attendre();
    const mails = (await alertes(t)).rows;
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to_address).toBe(CONTACT);
    expect(mails[0]!.subject).toContain('Analyse antivirale indisponible');
    expect(mails[0]!.body).toContain('refusés');
    expect(mails[0]!.body).not.toContain('rapport-');
    const audit = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action IN ('document.scan_unavailable','document.scan_alerte')",
    );
    const n = (x: string) => audit.rows.filter((r) => r.action === x).length;
    expect([n('document.scan_unavailable'), n('document.scan_alerte')]).toEqual([3, 1]);
  }, 30_000);

  it('non obligatoire : le dépôt est accepté « non analysé » et l’échec est signalé une fois', async () => {
    const { t, a } = await installation(false);
    for (let i = 0; i < 2; i++) {
      const r = await deposer(a, `note-${i}.pdf`);
      expect(r.statusCode, r.body).toBe(201);
    }
    await attendre();
    const mails = (await alertes(t)).rows;
    expect(mails).toHaveLength(1);
    expect(mails[0]!.body).toContain('sans analyse');
  }, 30_000);

  it('sans courriel configuré, aucun message n’est mis en file et le refus reste clair', async () => {
    const t = await createTestApp({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: '1', CLAMAV_REQUIRED: 'true' });
    apps.push(t);
    const a = await login(t, await makeUser(t, 'rssi', 'admin'));
    const r = await deposer(a, 'rapport.pdf');
    expect(r.statusCode).toBe(422);
    await attendre();
    expect((await alertes(t)).rows).toHaveLength(0);
  }, 30_000);
});
