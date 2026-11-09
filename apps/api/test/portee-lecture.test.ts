/* Porte de lecture autorisée (ADR 0083) : la portée calculée pour un lecteur applique droit de module, périmètre, registre
   restreint et rôle attribué, et laisse les administrateurs contourner les masques. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PorteeLecture } from '../src/acces/portee.js';
import {
  createTestApp,
  login,
  makeUser,
  seedState,
  sessionUser,
  type Agent,
  type TestApp,
  type TestUser,
} from './helpers.js';

describe('porte de lecture autorisée', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, secret: string;
  let publicId: string, secretId: string;
  const u: Record<'admin' | 'membre' | 'attribue' | 'hors' | 'externe' | 'sansDroit', TestUser> = {} as never;

  const portee = async (x: TestUser) => PorteeLecture.pour(t.svc.grc, await sessionUser(t, x));
  const noms = async (x: TestUser) => {
    const p = await portee(x);
    const q = await p.filtrerObjets(t.svc.db.k.selectFrom('grc_objects').select('name'));
    return (await q.execute()).map((r) => r.name).sort();
  };

  beforeAll(async () => {
    t = await createTestApp();
    u.admin = await makeUser(t, 'pl_admin', 'admin');
    u.membre = await makeUser(t, 'pl_membre', 'ro');
    u.attribue = await makeUser(t, 'pl_attribue', 'ro');
    u.hors = await makeUser(t, 'pl_hors', 'ro');
    u.externe = await makeUser(t, 'pl_externe', 'auditeur_externe', {
      modules: ['audit'],
      expiresAt: new Date(Date.now() + 86400000),
    });
    u.sansDroit = await makeUser(t, 'pl_sans_droit', null);
    admin = await login(t, u.admin);
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre fictif', scope: 'x', timezone: 'Europe/Paris' })).json()
      .id;
    for (const x of [u.membre, u.attribue, u.externe])
      expect((await admin.put(`/api/grc/${A}/members`, { userId: x.id, write: false })).statusCode).toBe(204);
    secret = (
      await admin.post('/api/registres', { kind: 'ecarts', name: 'Écarts secrets', referenceId: A, restreint: true })
    ).json().id;
    const ecart = (name: string, registreId?: string) =>
      admin.post(`/api/grc/${A}/objects`, {
        kind: 'nonconformity',
        name,
        registreId,
        data: { cause: 'cause fictive' },
      });
    const pub = await ecart('Écart public');
    expect(pub.statusCode, pub.body).toBe(200);
    publicId = pub.json().id;
    const sec = await ecart('Écart secret', secret);
    expect(sec.statusCode, sec.body).toBe(200);
    secretId = sec.json().id;
    // Rôle attribué sur le registre restreint seulement.
    const r = await admin.put(`/api/droits/registre/${secret}`, {
      subjectType: 'utilisateur',
      subjectId: u.attribue.id,
      role: 'lecteur',
    });
    expect(r.statusCode, r.body).toBeLessThan(300);
    await seedState(t, {
      suppliers: [{ id: 's1', name: 'Fournisseur fictif', certs: [], controls: [] }],
      processes: [{ id: 'P1', name: 'Processus fictif', family: 'Support', owner: 'Responsable' }],
    });
  }, 60000);
  afterAll(() => t.close());

  it('estAdmin : seul l’administrateur contourne les masques', async () => {
    expect(await (await portee(u.admin)).estAdmin()).toBe(true);
    for (const x of [u.membre, u.attribue, u.hors, u.externe, u.sansDroit])
      expect(await (await portee(x)).estAdmin(), x.username).toBe(false);
  });

  it('peutLireModule : droit de module effectif, y compris pour un auditeur externe limité', async () => {
    expect(await (await portee(u.membre)).peutLireModule('ecarts')).toBe(true);
    expect(await (await portee(u.externe)).peutLireModule('audit')).toBe(true);
    expect(await (await portee(u.externe)).peutLireModule('ecarts')).toBe(false);
    expect(await (await portee(u.sansDroit)).peutLireModule('ecarts')).toBe(false);
  });

  it('perimetreLisible : membre et administrateur oui, non-membre d’un périmètre restreint non', async () => {
    expect(await (await portee(u.admin)).perimetreLisible(A)).toBe(true);
    expect(await (await portee(u.membre)).perimetreLisible(A)).toBe(true);
    expect(await (await portee(u.hors)).perimetreLisible(A)).toBe(false);
    // Le module est contrôlé avec le périmètre.
    expect(await (await portee(u.externe)).perimetreLisible(A, 'audit')).toBe(true);
    expect(await (await portee(u.externe)).perimetreLisible(A, 'ecarts')).toBe(false);
  });

  it('registresMasques : vide pour l’administrateur et pour le détenteur d’un rôle attribué, plein pour les autres', async () => {
    expect([...(await (await portee(u.admin)).registresMasques())]).toEqual([]);
    expect([...(await (await portee(u.attribue)).registresMasques())]).toEqual([]);
    expect([...(await (await portee(u.membre)).registresMasques())]).toEqual([secret]);
    expect([...(await (await portee(u.hors)).registresMasques())]).toEqual([secret]);
  });

  it('filtrerObjets : module, périmètre et registre restreint appliqués', async () => {
    expect(await noms(u.admin)).toEqual(['Écart public', 'Écart secret']);
    expect(await noms(u.attribue)).toEqual(['Écart public', 'Écart secret']);
    expect(await noms(u.membre)).toEqual(['Écart public']);
    // Non-membre du périmètre, auditeur externe sans le module des écarts, compte sans droit : rien.
    expect(await noms(u.hors)).toEqual([]);
    expect(await noms(u.externe)).toEqual([]);
    expect(await noms(u.sansDroit)).toEqual([]);
  });

  it('filtrerObjets : la requête de l’appelant (recherche, pagination) est conservée', async () => {
    const p = await portee(u.attribue);
    const q = await p.filtrerObjets(
      t.svc.db.k.selectFrom('grc_objects').select('name').where('name', 'ilike', '%secret%').limit(5),
    );
    expect((await q.execute()).map((r) => r.name)).toEqual(['Écart secret']);
  });

  it('nomSiLisible et refLisible : nom rendu seulement si la référence se résout avec les droits du lecteur', async () => {
    const ref = (id: string) => 'object:' + id;
    const nom = async (x: TestUser, id: string) => (await portee(x)).nomSiLisible(A, ref(id));
    expect(await nom(u.admin, secretId)).toBe('Écart secret');
    expect(await nom(u.attribue, secretId)).toBe('Écart secret');
    expect(await nom(u.membre, secretId)).toBeNull();
    expect(await nom(u.membre, publicId)).toBe('Écart public');
    expect(await nom(u.hors, publicId)).toBeNull();
    expect(await nom(u.sansDroit, publicId)).toBeNull();
    const p = await portee(u.membre);
    expect(await p.refLisible(A, ref(secretId))).toBe(false);
    expect(await p.refLisible(A, ref(publicId))).toBe(true);
    expect(await p.refLisible(A, 'object:00000000-0000-4000-8000-0000000000ff')).toBe(false);
  });

  it('etatHistorique : les clés d’un module illisible sont vidées, les autres sont conservées', async () => {
    const clair = (await (await portee(u.admin)).etatHistorique()).data;
    expect((clair.suppliers as unknown[]).length).toBe(1);
    expect((clair.processes as unknown[]).length).toBe(1);
    // L’auditeur externe (module « audit » seul) ne lit ni les fournisseurs ni le pilotage.
    const ext = (await (await portee(u.externe)).etatHistorique()).data;
    expect(ext.suppliers).toEqual([]);
    expect(ext.processes).toEqual([]);
    // Le lecteur d’un module métier lit ces deux clés.
    const ro = (await (await portee(u.membre)).etatHistorique()).data;
    expect((ro.suppliers as unknown[]).length).toBe(1);
  });

  it('la portée garde ses résultats pendant sa durée de vie (calculés une fois)', async () => {
    const p = await portee(u.membre);
    expect(p.registresMasques()).toBe(p.registresMasques());
    expect(p.perimetresLisibles()).toBe(p.perimetresLisibles());
    expect(p.estAdmin()).toBe(p.estAdmin());
    await Promise.all([p.registresMasques(), p.perimetresLisibles(), p.estAdmin()]);
  });
});
