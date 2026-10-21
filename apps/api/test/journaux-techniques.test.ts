/* Journaux techniques (012-13) : niveau réglable à chaud (warn, info ; debug toujours temporaire), état réellement
   appliqué, erreurs toujours collectées, secrets masqués, téléchargement tracé, audit indépendant. Données fictives. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent;
const url = '/api/admin/journaux-techniques';
const niveau = (corps: Record<string, unknown>) =>
  admin.put(`${url}/niveau`, { reason: 'Diagnostic de recette', confirm: 'APPLIQUER', ...corps });
const liste = async (q = '') =>
  (await admin.get(`${url}${q}`)).json() as {
    etat: { niveauPermanent: string; niveauApplique: string; debugJusqua: string | null; tampon: { taille: number } };
    entrees: { n: number; niveau: string; message: string; contexte: Record<string, unknown> }[];
    reste: boolean;
  };

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'jt_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'jt_lecteur', 'ro'));
});
afterAll(() => t.close());
afterEach(() => vi.useRealTimers());

describe('niveau de journalisation', () => {
  it('refuse sans droit, et le niveau debug sans durée', async () => {
    expect((await lecteur.get(url)).statusCode).toBe(403);
    expect((await lecteur.put(`${url}/niveau`, { niveau: 'info', confirm: 'APPLIQUER' })).statusCode).toBe(403);
    const r = await niveau({ niveau: 'debug' });
    expect(r.statusCode, r.body).toBe(422);
    expect((await niveau({ niveau: 'debug', dureeMinutes: 24 * 60 + 1 })).statusCode).toBe(422);
    expect((await niveau({ niveau: 'error' })).statusCode).toBe(422);
  });

  it('applique le niveau à chaud et lit l’état réellement appliqué', async () => {
    const r = await niveau({ niveau: 'info' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ niveauPermanent: 'info', niveauApplique: 'info', debugJusqua: null });
    expect(t.svc.log.level).toBe('info');
    t.svc.log.debug('message-debug-ignore');
    t.svc.log.info('message-info-conserve');
    // Les journaux de requêtes (info) contiennent la recherche elle-même : on ne retient que les messages fictifs.
    const e = await liste('?q=message-');
    expect(e.entrees.map((x) => x.message).filter((m) => m.startsWith('message-'))).toEqual(['message-info-conserve']);
  });

  it('warn ne garde que les avertissements et les erreurs, toujours collectées', async () => {
    expect((await niveau({ niveau: 'warn' })).json()).toMatchObject({ niveauApplique: 'warn' });
    t.svc.log.info('seuil-info-ecarte');
    t.svc.log.warn('seuil-warn');
    t.svc.log.error('seuil-erreur');
    const e = await liste('?q=seuil-');
    expect(e.entrees.map((x) => [x.niveau, x.message])).toEqual([
      ['error', 'seuil-erreur'],
      ['warn', 'seuil-warn'],
    ]);
    expect((await liste('?q=seuil-&niveau=error')).entrees.map((x) => x.message)).toEqual(['seuil-erreur']);
  });

  it('debug est temporaire : il s’applique puis le seuil permanent reprend', async () => {
    const r = await niveau({ niveau: 'debug', dureeMinutes: 10 });
    expect(r.json()).toMatchObject({ niveauPermanent: 'warn', niveauApplique: 'debug' });
    expect(r.json().debugJusqua).toBeTruthy();
    t.svc.log.debug('debug-actif');
    expect((await liste('?q=debug-actif')).entrees.filter((x) => x.message === 'debug-actif')).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 11 * 60_000 });
    expect(await t.svc.journalTechnique.expirer()).toBe(true);
    vi.useRealTimers();
    expect((await liste()).etat).toMatchObject({ niveauPermanent: 'warn', niveauApplique: 'warn', debugJusqua: null });
    const audit = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE 'admin.journal_technique%' ORDER BY id",
    );
    expect(audit.rows.map((x) => x.action)).toContain('admin.journal_technique_debug_expire');
  });

  it('un niveau permanent met fin au debug en cours et chaque changement est audité', async () => {
    await niveau({ niveau: 'debug', dureeMinutes: 10 });
    const r = await niveau({ niveau: 'info' });
    expect(r.json()).toMatchObject({ niveauApplique: 'info', debugJusqua: null });
    const audit = await t.svc.db.q<{ details: { apres: { applique: string } } }>(
      "SELECT details FROM audit_log WHERE action='admin.journal_technique_niveau' ORDER BY id DESC LIMIT 1",
    );
    expect(audit.rows[0]!.details.apres.applique).toBe('info');
  });

  it('une configuration enregistrée est reprise au démarrage ; un debug échu n’est pas rétabli', async () => {
    await niveau({ niveau: 'warn' });
    await t.svc.db.q("UPDATE journal_technique_config SET debug_jusqua = now() - interval '1 minute' WHERE id=1");
    t.svc.log.level = 'info';
    await t.svc.journalTechnique.charger();
    expect(t.svc.log.level).toBe('warn');
    await t.svc.db.q("UPDATE journal_technique_config SET debug_jusqua = now() + interval '30 minutes' WHERE id=1");
    await t.svc.journalTechnique.charger();
    expect(t.svc.log.level).toBe('debug');
    await niveau({ niveau: 'info' });
  });
});

describe('consultation et téléchargement', () => {
  // Niveau warn : les journaux de requêtes (info) ne se mêlent pas aux entrées fictives.
  beforeAll(async () => {
    await niveau({ niveau: 'warn' });
  });
  it('masque les secrets et pagine par numéro d’entrée', async () => {
    t.svc.log.warn({ body: { password: 'secret-fictif', ok: 1 } }, 'masquage-test');
    t.svc.log.warn('pagination-a');
    t.svc.log.warn('pagination-b');
    const e = await liste('?q=masquage-test');
    expect(JSON.stringify(e.entrees[0]!.contexte)).not.toContain('secret-fictif');
    expect(JSON.stringify(e.entrees[0]!.contexte)).toContain('[masqué]');
    const p1 = await liste('?q=pagination-&limite=1');
    expect(p1.entrees.map((x) => x.message)).toEqual(['pagination-b']);
    expect(p1.reste).toBe(true);
    const p2 = await liste(`?q=pagination-&limite=1&avant=${p1.entrees[0]!.n}`);
    expect(p2.entrees.map((x) => x.message)).toEqual(['pagination-a']);
    expect(p2.reste).toBe(false);
  });

  it('le téléchargement exige le droit d’exportation, est chronologique et tracé', async () => {
    t.svc.log.warn('export-1');
    t.svc.log.warn('export-2');
    const ko = await lecteur.get(`${url}?format=ndjson&export=1`);
    expect(ko.statusCode).toBe(403);
    const r = await admin.get(`${url}?format=ndjson&export=1&q=export-`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers['content-disposition']).toMatch(
      /attachment; filename="journaux-techniques-\d{4}-\d{2}-\d{2}\.ndjson"/,
    );
    expect(r.headers['content-type']).toMatch(/application\/x-ndjson/);
    const lignes = r.body
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { message: string });
    expect(lignes.map((l) => l.message)).toEqual(['export-1', 'export-2']);
    const audit = await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='admin.journal_technique_export'");
    expect(audit.rowCount).toBeGreaterThan(0);
  });
});
