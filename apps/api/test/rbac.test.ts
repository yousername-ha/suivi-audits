/* Droits (RBAC) : matrice automatique permissions × routes, garde-fous, rôles, groupes, expiration, revue des accès,
   filtrage de l'outil historique selon les modules. */
import zlib from 'node:zlib';
import { ALL_PERMISSIONS, isPermission, type Permission } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allRoutes } from '../src/app.js';
import { expireAccounts } from '../src/rights.js';
import { Agent, createTestApp, login, makeUser, PASSWORD, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let admin: TestUser;
let A: Agent;

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'admin', 'admin');
  A = await login(t, admin);
});
afterAll(() => t.close());

const etag = async (a: Agent, url: string) => (await a.get(url)).headers.etag as string;

/* ---------------------------------------------------------------- Matrice permissions × routes */
describe('matrice automatique : chaque route refuse sans la permission requise', () => {
  const PARAMS: Record<string, string> = {
    id: '00000000-0000-4000-8000-000000000000',
    v: '1',
    client: 'client-test-1',
    file: 'absent.js',
  };
  const routes = allRoutes().flatMap((d) => {
    const methods = (Array.isArray(d.method) ? d.method : [d.method]).filter((m) => m !== 'HEAD');
    return methods.map((m) => ({ method: m, url: d.url, access: d.access, raw: !!d.raw }));
  });
  const guarded = routes.filter((r) => isPermission(r.access) || r.access === 'metier' || r.access === 'mur');

  /** Seules routes sans permission métier : authentification, compte personnel, temps réel, pages et fichiers statiques. */
  const UNGUARDED = new Set([
    'GET /healthz',
    'GET /api/health/ready',
    'GET /api/version',
    'GET /api/updates', // Versions et état uniquement : aucune commande.
    'GET /api/modules', // Métadonnées d'activation accessibles à toute session complète ; aucun contenu métier.
    'GET /api/openapi.json',
    'GET /api/auth/me',
    'POST /api/auth/login',
    'POST /api/auth/mfa',
    'POST /api/auth/logout',
    'GET /api/setup',
    'POST /api/setup',
    'POST /api/account/password',
    'POST /api/account/totp/begin',
    'POST /api/account/totp/confirm',
    'POST /api/account/totp/disable',
    'GET /api/account/sessions',
    'POST /api/account/sessions/revoke-others',
    'GET /api/events',
    'GET /api/presence',
    'POST /api/presence',
    'DELETE /api/presence/:client',
    'GET /api/settings/logo',
    'GET /api/account/preferences',
    'PUT /api/account/preferences',
    'POST /api/mur/activer',
    // Catalogue de configuration GRC : droits contrôlés par le service (pilotage, paramètres ou administration), testés dans
    // config-grc.test.ts (401, 403, portée du périmètre, droits de publication).
    // Registres et droits par ressource (ADR 0043) : l'autorisation (droits de module, périmètres, droits attribués) est évaluée
    // par le service ; refus 404/403, rôles et groupes testés dans registres-droits.test.ts.
    'GET /api/registres',
    'POST /api/registres',
    'GET /api/registres/:id',
    'PATCH /api/registres/:id',
    'PUT /api/registres/:id/perimetres',
    'PUT /api/registres/:id/ordre',
    'POST /api/registres/:id/archivage',
    'GET /api/registres/:id/elements',
    'GET /api/registres/elements',
    'GET /api/grc/:smsi/responsables',
    'POST /api/grc/:smsi/objects/:id/deplacement',
    'GET /api/registres/elements/:id/acces',
    'GET /api/grc/:smsi/objects/:id/validations',
    'POST /api/grc/:smsi/objects/:id/validations',
    'POST /api/grc/:smsi/objects/:id/validations/reouverture',
    'GET /api/droits/:type/:id',
    'GET /api/droits/:type/:id/titulaires',
    'PUT /api/droits/:type/:id',
    'DELETE /api/droits/:type/:id/:droitId',
    'POST /api/grc/:smsi/objects/:id/contribution',
    'GET /api/grc/:smsi/objects/:id', // droit de lecture attribué sur un registre ou droits de module : évalué par le service
    'GET /api/config-grc/templates',
    'POST /api/config-grc/templates/:id/adopt',
    'GET /api/config-grc/items',
    'POST /api/config-grc/items',
    'GET /api/config-grc/items/:id',
    'PUT /api/config-grc/items/:id/draft',
    'POST /api/config-grc/items/:id/preview',
    'POST /api/config-grc/items/:id/publish',
    'GET /api/config-grc/items/:id/versions/:version',
    'GET /api/config-grc/items/:id/usages',
    'GET /api/config-grc/items/:id/impact',
    'POST /api/config-grc/items/:id/derive',
    'POST /api/config-grc/items/:id/archive',
    'POST /api/config-grc/items/:id/restore',
    'DELETE /api/config-grc/items/:id',
  ]);

  it('toute route hors de la liste explicite exige une permission (ou un module métier lisible)', () => {
    const unexpected = routes
      .filter((r) => !isPermission(r.access) && r.access !== 'metier' && r.access !== 'mur')
      .map((r) => `${r.method} ${r.url}`)
      .filter((k) => !UNGUARDED.has(k));
    expect(unexpected).toEqual([]);
    expect(guarded.length).toBeGreaterThan(40);
  });

  it('refus sans la permission, accès avec la seule permission requise', async () => {
    // Un compte, un rôle personnalisé dont la matrice est réécrite avant chaque appel (droits relus à chaque requête).
    await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ('r_matrice', 'Matrice de test', '{}')");
    const u = await makeUser(t, 'matrice', 'r_matrice');
    const a = await login(t, u);
    const setPerms = (p: readonly string[]) =>
      t.svc.db.q("UPDATE roles SET permissions = $1 WHERE id = 'r_matrice'", [p]);
    const call = (r: (typeof guarded)[number]) => {
      const url = r.url.replace(/:(\w+)/g, (_, k: string) => PARAMS[k] ?? 'x');
      return r.raw
        ? a.req(r.method as 'POST', url + (url.includes('?') ? '' : '?mode=merge'), { body: Buffer.from('{}') })
        : a.req(r.method as 'GET', url, r.method === 'GET' || r.method === 'DELETE' ? {} : { json: {} });
    };
    const failures: string[] = [];
    for (const r of guarded) {
      const required: Permission[] =
        r.access === 'metier' || r.access === 'mur' ? ['audit:lire'] : [r.access as Permission];
      // Sans la permission (toutes les autres accordées ; pour « metier », aucune lecture métier).
      await setPerms(
        r.access === 'metier' || r.access === 'mur'
          ? ALL_PERMISSIONS.filter(
              (p) =>
                !/^(audit|ecarts|plan_audit|pilotage|fournisseurs|conformite|ia|crrc|investissements|incidents|cartographie):lire$/.test(
                  p,
                ),
            )
          : ALL_PERMISSIONS.filter((p) => p !== r.access),
      );
      const denied = await call(r);
      if (denied.statusCode !== 403)
        failures.push(`${r.method} ${r.url} sans ${required.join()} : ${denied.statusCode}`);
      // Avec la seule permission requise : jamais refusé pour cette permission-là.
      await setPerms(required);
      // Flux SSE : la réponse ne se termine pas, l'accord n'est pas vérifié ici (le refus l'est).
      if (r.url.endsWith('/events')) continue;
      const allowed = await call(r);
      const body = allowed.headers['content-type']?.toString().includes('json') ? allowed.json() : {};
      if (allowed.statusCode === 403 && (body.permission === r.access || r.access === 'metier' || r.access === 'mur'))
        failures.push(`${r.method} ${r.url} avec ${required.join()} : refusé`);
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

/* ---------------------------------------------------------------- Rôles */
describe('rôles prédéfinis et personnalisés', () => {
  it('les rôles prédéfinis ne sont ni modifiables ni supprimables', async () => {
    const r = await A.patch('/api/admin/roles/lecteur', { name: 'X' }, { 'if-match': '"1"' });
    expect(r.statusCode).toBe(409);
    expect((await A.del('/api/admin/roles/administrateur')).statusCode).toBe(409);
    await expect(t.svc.db.q("UPDATE roles SET name = 'X' WHERE id = 'lecteur'")).rejects.toThrow(/prédéfini/);
  });

  it('création par duplication, puis édition de la matrice', async () => {
    const r = await A.post('/api/admin/roles', { from: 'lecteur', name: 'Lecteur étendu' });
    expect(r.statusCode).toBe(201);
    const role = r.json();
    expect(role.system).toBe(false);
    expect(role.based_on).toBe('lecteur');
    expect(role.permissions).toContain('ecarts:lire');
    expect(role.permissions).not.toContain('ecarts:modifier');
    const p = await A.patch(
      `/api/admin/roles/${role.id}`,
      { permissions: [...role.permissions, 'ecarts:modifier', 'ecarts:exporter'] },
      { 'if-match': `"${role.version}"` },
    );
    expect(p.statusCode).toBe(200);
    expect(p.json().permissions).toEqual(expect.arrayContaining(['ecarts:modifier', 'ecarts:exporter']));
    expect((await A.post('/api/admin/roles', { from: 'lecteur', name: 'lecteur ÉTENDU' })).statusCode).toBe(409);
    expect((await A.post('/api/admin/roles', { from: 'auditeur_externe', name: 'Audit 2' })).statusCode).toBe(422);
  });

  it('modifier la matrice d’un rôle coupe les sessions de ses titulaires', async () => {
    const role = (await A.post('/api/admin/roles', { from: 'contributeur', name: 'Rôle à couper' })).json();
    const u = await makeUser(t, 'titulaire', role.id);
    const a = await login(t, u);
    expect((await a.me()).stage).toBe('ok');
    await A.patch(`/api/admin/roles/${role.id}`, { permissions: ['audit:lire'] }, { 'if-match': `"${role.version}"` });
    expect((await a.me()).stage).toBe('anon');
    const audit = await t.svc.db.one<{
      details: { before: { permissions: string[] }; after: { permissions: string[] } };
    }>("SELECT details FROM audit_log WHERE action = 'admin.role_update' ORDER BY id DESC LIMIT 1");
    expect(audit!.details.before.permissions).toContain('documents:modifier');
    expect(audit!.details.after.permissions).toEqual(['audit:lire']);
  });
});

/* ---------------------------------------------------------------- Groupes et droits effectifs */
describe('groupes et droits effectifs', () => {
  it('droits effectifs = rôles directs ∪ rôles des groupes, avec leur origine', async () => {
    const u = await makeUser(t, 'membre', 'lecteur');
    const g = await A.post('/api/admin/groups', { name: 'Équipe SSI', roles: ['contributeur'], members: [u.id] });
    expect(g.statusCode).toBe(201);
    const rights = (await A.get(`/api/admin/users/${u.id}/rights`)).json();
    const of = (p: string) => rights.permissions.find((x: { permission: string }) => x.permission === p);
    expect(of('ecarts:modifier').origins).toEqual([
      {
        roleId: 'contributeur',
        roleName: 'Contributeur',
        via: { kind: 'group', groupId: g.json().id, groupName: 'Équipe SSI' },
      },
    ]);
    expect(
      of('ecarts:lire')
        .origins.map((o: { via: { kind: string } }) => o.via.kind)
        .sort(),
    ).toEqual(['direct', 'group']);
    expect(of('ecarts:supprimer')).toBeUndefined();
    const a = await login(t, u);
    expect((await a.me()).permissions).toContain('documents:modifier');
  });

  it('retirer un membre coupe sa session ; le journal garde l’avant et l’après', async () => {
    const u = await makeUser(t, 'partant', null);
    const g = (
      await A.post('/api/admin/groups', { name: 'Groupe éphémère', roles: ['lecteur'], members: [u.id] })
    ).json();
    const a = await login(t, u);
    expect((await a.get('/api/documents')).statusCode).toBe(200);
    const r = await A.patch(`/api/admin/groups/${g.id}`, { members: [] }, { 'if-match': `"${g.version}"` });
    expect(r.statusCode).toBe(200);
    expect((await a.me()).stage).toBe('anon');
    const log = await t.svc.db.one<{ details: { before: { members: string[] }; after: { members: string[] } } }>(
      "SELECT details FROM audit_log WHERE action = 'admin.group_update' ORDER BY id DESC LIMIT 1",
    );
    expect(log!.details.before.members).toEqual(['partant']);
    expect(log!.details.after.members).toEqual([]);
  });

  it('le rôle Auditeur externe ne s’attribue pas à un groupe', async () => {
    const r = await A.post('/api/admin/groups', { name: 'Auditeurs', roles: ['auditeur_externe'] });
    expect(r.statusCode).toBe(422);
  });
});

/* ---------------------------------------------------------------- Garde-fous */
describe('garde-fous', () => {
  it('un utilisateur ne peut pas modifier ses propres droits, même par un groupe', async () => {
    const g = (await A.post('/api/admin/groups', { name: 'Admins', roles: [], members: [] })).json();
    const r = await A.patch(
      `/api/admin/groups/${g.id}`,
      { roles: ['lecteur'], members: [admin.id] },
      { 'if-match': `"${g.version}"` },
    );
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/propres droits/);
  });

  it('impossible de retirer le dernier administrateur actif et permanent', async () => {
    // Un gestionnaire des comptes (rôle personnalisé, compte à expiration) tente de rétrograder l'unique administrateur.
    const role = (await A.post('/api/admin/roles', { from: 'rssi', name: 'Gestionnaire des comptes' })).json();
    await A.patch(
      `/api/admin/roles/${role.id}`,
      { permissions: ['administration:lire', 'administration:administrer'] },
      { 'if-match': `"${role.version}"` },
    );
    const g = await makeUser(t, 'gestionnaire', role.id, { expiresAt: new Date(Date.now() + 86400e3) });
    const a = await login(t, g);
    const r = await a.patch(
      `/api/admin/users/${admin.id}`,
      { roles: [{ roleId: 'lecteur' }] },
      { 'if-match': await etag(a, `/api/admin/users/${admin.id}`) },
    );
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/au moins un administrateur/);
    const d = await a.patch(
      `/api/admin/users/${admin.id}`,
      { disabled: true },
      { 'if-match': await etag(a, `/api/admin/users/${admin.id}`) },
    );
    expect(d.statusCode).toBe(409);
    // Toujours administrateur.
    expect((await A.get('/api/admin/users')).statusCode).toBe(200);
  });

  it('Auditeur externe : date d’expiration et modules obligatoires, portée respectée', async () => {
    const base = { username: 'auditeur', roles: [{ roleId: 'auditeur_externe', modules: ['ecarts', 'documents'] }] };
    expect((await A.post('/api/admin/users', base)).statusCode).toBe(422);
    expect(
      (await A.post('/api/admin/users', { ...base, roles: [{ roleId: 'auditeur_externe' }], expiresAt: '2099-12-31' }))
        .statusCode,
    ).toBe(422);
    const ok = await A.post('/api/admin/users', { ...base, expiresAt: '2099-12-31' });
    expect(ok.statusCode).toBe(201);
    const rights = (await A.get(`/api/admin/users/${ok.json().id}/rights`)).json();
    expect(rights.permissions.map((p: { permission: string }) => p.permission)).toEqual([
      'ecarts:lire',
      'documents:lire',
    ]);
  });

  it('compte expiré : connexion refusée, désactivation automatique tracée', async () => {
    const u = await makeUser(t, 'temporaire', 'lecteur', { expiresAt: new Date(Date.now() + 60e3) });
    const a = await login(t, u);
    await t.svc.db.q("UPDATE users SET expires_at = now() - interval '1 minute' WHERE id = $1", [u.id]);
    expect((await a.me()).stage).toBe('anon');
    expect(
      (await new Agent(t).post('/api/auth/login', { username: 'temporaire', password: PASSWORD })).statusCode,
    ).toBe(401);
    expect(await expireAccounts(t.svc.db)).toContain('temporaire');
    expect(
      (await t.svc.db.one<{ disabled: boolean }>('SELECT disabled FROM users WHERE id=$1', [u.id]))!.disabled,
    ).toBe(true);
    expect(
      await t.svc.db.one("SELECT 1 FROM audit_log WHERE action = 'account.expired' AND target = 'temporaire'"),
    ).toBeTruthy();
  });
});

/* ---------------------------------------------------------------- Revue des accès */
describe('revue des accès (ISO 27001 A.5.18)', () => {
  it('export CSV', async () => {
    const r = await A.get('/api/admin/access-review?format=csv');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    const lines = r.body.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toMatch(/^"Identifiant";"Nom";"E-mail";"État";"Double authentification";"Groupes";"Rôles/);
    expect(lines.some((l) => l.startsWith('"admin"') && l.includes('Administrateur'))).toBe(true);
    expect(await t.svc.db.one("SELECT 1 FROM audit_log WHERE action = 'admin.access_review_export'")).toBeTruthy();
  });

  it('export Excel (.xlsx valide : archive ZIP, feuille avec en-têtes et comptes)', async () => {
    const r = await A.get('/api/admin/access-review?format=xlsx');
    expect(r.statusCode).toBe(200);
    const buf = r.rawPayload;
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    // Lecture du répertoire central et décompression de la feuille.
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    let p = buf.readUInt32LE(eocd + 16);
    const files: Record<string, string> = {};
    for (let i = 0; i < buf.readUInt16LE(eocd + 10); i++) {
      const size = buf.readUInt32LE(p + 20);
      const nlen = buf.readUInt16LE(p + 28);
      const off = buf.readUInt32LE(p + 42);
      const name = buf.subarray(p + 46, p + 46 + nlen).toString();
      const lnlen = buf.readUInt16LE(off + 26);
      const data = zlib.inflateRawSync(buf.subarray(off + 30 + lnlen, off + 30 + lnlen + size));
      expect(zlib.crc32(data) >>> 0).toBe(buf.readUInt32LE(p + 16));
      files[name] = data.toString('utf8');
      p += 46 + nlen;
    }
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
    expect(files['xl/worksheets/sheet1.xml']).toContain('Identifiant');
    expect(files['xl/worksheets/sheet1.xml']).toContain('>admin<');
  });

  it('réservée à la permission administration:exporter', async () => {
    const a = await login(t, await makeUser(t, 'rssi-revue', 'rssi'));
    expect((await a.get('/api/admin/access-review')).statusCode).toBe(403);
  });
});

/* ---------------------------------------------------------------- Outil historique selon les modules */
describe('état du suivi : lecture par module', () => {
  it('modules non lisibles masqués, modules lisibles conservés', async () => {
    await t.svc.db.q(
      "INSERT INTO roles(id, name, permissions) VALUES ('r_ecarts', 'Écarts seulement', '{ecarts:lire,ecarts:modifier}')",
    );
    const u = await makeUser(t, 'ecarts', 'r_ecarts');
    const a = await login(t, u);
    const st = await a.get('/api/suivi/etat');
    expect(st.statusCode).toBe(200);
    const data = st.json();
    expect(data.items).toEqual([]); // audit : non lisible
    const full = (await A.get('/api/suivi/etat')).json();
    expect(full.items.length).toBeGreaterThan(0);
    expect(data.findings).toEqual(full.findings);
  });

  it('sans aucun module métier lisible : état du suivi refusé', async () => {
    const a = await login(t, await makeUser(t, 'sans-droit', null));
    expect((await a.get('/api/suivi/etat')).statusCode).toBe(403);
    expect((await a.me()).permissions).toEqual([]);
  });
});
