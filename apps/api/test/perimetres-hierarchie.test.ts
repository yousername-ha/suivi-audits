/* Hiérarchie des périmètres (lot H1) : parent/enfant sans boucle, niveau, héritage explicite des référentiels (le
   rattachement local l'emporte), protections de la base. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, groupe: string, hopital: string, labo: string, clinique: string;
let fw: string;
const def: FrameworkDefinition = {
  name: 'Référentiel de hiérarchie',
  identifier: 'HIER-FICTIF',
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-18',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'd', label: 'Domaine' }],
  requirements: [
    { id: 'R1', domain: 'd', title: 'Exigence fictive', description: 'Fictif', applicability: '', measureRefs: [] },
  ],
};
const creer = async (name: string, extra: Record<string, unknown> = {}) => {
  const r = await admin.post('/api/grc/smsis', {
    name,
    scope: 'Recette',
    nature: '',
    timezone: 'Europe/Paris',
    ...extra,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
};
const modifier = async (id: string, extra: Record<string, unknown>) => {
  const courant = (await admin.get('/api/grc/smsis')).json().find((x: { id: string }) => x.id === id);
  return admin.patch(
    `/api/grc/smsis/${id}`,
    {
      name: courant.name,
      scope: courant.scope,
      nature: courant.nature,
      timezone: courant.timezone,
      confirm: 'ENREGISTRER',
      ...extra,
    },
    { 'if-match': `"${courant.version}"` },
  );
};
const effectifs = async (id: string) =>
  (await admin.get(`/api/grc/${id}/framework-attachments`)).json() as {
    frameworkId: string;
    enabled: boolean;
    inherited: boolean;
    originName: string | null;
  }[];

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'hier_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'hier_reader', 'ro'));
  const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await admin.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  fw = r.json().id;
});
afterAll(() => t.close());

describe('rattachement parent/enfant', () => {
  it('crée une hiérarchie typée (organisation par défaut) et l’indicateur d’héritage, restitués par la liste', async () => {
    groupe = await creer('Groupe', { entityKind: 'organisation' });
    hopital = await creer('Hôpital', { parentId: groupe, entityKind: 'organisation', inheritFrameworks: true });
    labo = await creer('Laboratoire', { parentId: hopital, inheritFrameworks: true });
    clinique = await creer('Clinique', { parentId: groupe });
    const liste = (await admin.get('/api/grc/smsis')).json() as Record<string, unknown>[];
    const de = (id: string) => liste.find((x) => x.id === id);
    expect(de(groupe)).toMatchObject({ parentId: null, entityKind: 'organisation', inheritFrameworks: false });
    expect(de(hopital)).toMatchObject({ parentId: groupe, entityKind: 'organisation', inheritFrameworks: true });
    expect(de(labo)).toMatchObject({ parentId: hopital, entityKind: 'organisation', inheritFrameworks: true });
    expect(de(clinique)).toMatchObject({ inheritFrameworks: false });
  });
  it('rattache à une organisation des organisations enfants et un fournisseur', async () => {
    const a = await creer('Organisation A', {});
    const b = await creer('Organisation B', { parentId: a });
    const c = await creer('Organisation C', { parentId: a, entityKind: 'organisation' });
    const f = await creer('Fournisseur F', { parentId: a, entityKind: 'fournisseur' });
    const liste = (await admin.get('/api/grc/smsis')).json() as Record<string, unknown>[];
    const de = (id: string) => liste.find((x) => x.id === id);
    expect(de(a)).toMatchObject({ parentId: null, entityKind: 'organisation' });
    expect(de(b)).toMatchObject({ parentId: a, entityKind: 'organisation' });
    expect(de(c)).toMatchObject({ parentId: a, entityKind: 'organisation' });
    expect(de(f)).toMatchObject({ parentId: a, entityKind: 'fournisseur' });
    // Le type se modifie comme le reste, et le changement est journalisé.
    const r = await modifier(b, { entityKind: 'fournisseur' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().entityKind).toBe('fournisseur');
    const audit = await t.svc.db.one<{ details: { changed: string[] } }>(
      "SELECT details FROM audit_log WHERE action='grc.smsi.updated' AND target=$1 ORDER BY id DESC LIMIT 1",
      [b],
    );
    expect(audit!.details.changed).toContain('entityKind');
  });
  it('sous un fournisseur, seulement des fournisseurs (API et base)', async () => {
    const a = await creer('Organisation A2', {});
    const f = await creer('Fournisseur F2', { parentId: a, entityKind: 'fournisseur' });
    const sousTraitant = await creer('Sous-traitant S2', { parentId: f, entityKind: 'fournisseur' });
    expect(sousTraitant).toBeTruthy();
    const refus = await admin.post('/api/grc/smsis', {
      name: 'Organisation sous fournisseur',
      scope: '',
      timezone: 'Europe/Paris',
      parentId: f,
    });
    expect(refus.statusCode, refus.body).toBe(422);
    expect(refus.json().error ?? refus.body).toMatch(/fournisseur/);
    const o = await creer('Organisation O2', { parentId: a });
    expect((await modifier(o, { parentId: f })).statusCode).toBe(422);
    // Le sous-traitant ne peut pas redevenir une organisation tant qu'il est sous un fournisseur.
    expect((await modifier(sousTraitant, { entityKind: 'organisation' })).statusCode).toBe(422);
    // A a des organisations enfants : il ne peut pas devenir un fournisseur.
    expect((await modifier(a, { entityKind: 'fournisseur' })).statusCode).toBe(422);
    await expect(t.svc.db.q('UPDATE grc_smsis SET parent_id=$1 WHERE id=$2', [f, o])).rejects.toThrow(/fournisseur/);
    await expect(t.svc.db.q("UPDATE grc_smsis SET entity_kind='fournisseur' WHERE id=$1", [a])).rejects.toThrow(
      /fournisseur/,
    );
  });
  it('relie un périmètre fournisseur à sa fiche du registre, une seule fois, et la délie s’il devient une organisation', async () => {
    const sup = await admin.post('/api/suppliers', { name: 'Fiche fournisseur fictive' });
    expect(sup.statusCode, sup.body).toBe(200);
    const fiche = sup.json().id as string;
    const f = await creer('Fournisseur relié', { entityKind: 'fournisseur', supplierId: fiche });
    const de = async (id: string) =>
      ((await admin.get('/api/grc/smsis')).json() as Record<string, unknown>[]).find((x) => x.id === id);
    expect(await de(f)).toMatchObject({ entityKind: 'fournisseur', supplierId: fiche });
    // Une fiche n'est reliée qu'à un seul périmètre ; une fiche absente du registre est refusée.
    const doublon = await admin.post('/api/grc/smsis', {
      name: 'Doublon',
      scope: '',
      timezone: 'Europe/Paris',
      entityKind: 'fournisseur',
      supplierId: fiche,
    });
    expect(doublon.statusCode, doublon.body).toBe(409);
    const absente = await admin.post('/api/grc/smsis', {
      name: 'Absente',
      scope: '',
      timezone: 'Europe/Paris',
      entityKind: 'fournisseur',
      supplierId: 'SUP-999',
    });
    expect(absente.statusCode, absente.body).toBe(422);
    // Une organisation ne se relie pas à une fiche.
    const org = await admin.post('/api/grc/smsis', {
      name: 'Organisation avec fiche',
      scope: '',
      timezone: 'Europe/Paris',
      supplierId: fiche,
    });
    expect(org.statusCode, org.body).toBe(422);
    // Modifier sans préciser la fiche la conserve ; devenir une organisation la délie.
    expect((await modifier(f, { name: 'Fournisseur relié renommé' })).json().supplierId).toBe(fiche);
    const r = await modifier(f, { entityKind: 'organisation' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ entityKind: 'organisation', supplierId: null });
    await expect(t.svc.db.q("UPDATE grc_smsis SET supplier_id='SUP-001' WHERE id=$1", [f])).rejects.toThrow(
      /grc_smsis_fiche_fournisseur/,
    );
  });
  it('garde la nature enregistrée quand la modification ne la précise pas', async () => {
    const id = await creer('Avec nature', { nature: 'SMQ' });
    const courant = (await admin.get('/api/grc/smsis')).json().find((x: { id: string }) => x.id === id);
    const r = await admin.patch(
      `/api/grc/smsis/${id}`,
      { name: 'Avec nature renommé', scope: courant.scope, timezone: courant.timezone, confirm: 'ENREGISTRER' },
      { 'if-match': `"${courant.version}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().nature).toBe('SMQ');
  });
  it('refuse les anciennes étiquettes « entité » et « périmètre », à l’API comme en base', async () => {
    for (const entityKind of ['entite', 'perimetre']) {
      const r = await admin.post('/api/grc/smsis', { name: 'Ancien', scope: '', timezone: 'Europe/Paris', entityKind });
      expect(r.statusCode, r.body).toBe(422);
      expect((await modifier(groupe, { entityKind })).statusCode).toBe(422);
    }
    await expect(t.svc.db.q("UPDATE grc_smsis SET entity_kind='entite' WHERE id=$1", [groupe])).rejects.toThrow();
  });
  it('ignore l’héritage d’un périmètre sans parent', async () => {
    const seul = await creer('Sans parent', { inheritFrameworks: true });
    expect((await admin.get('/api/grc/smsis')).json().find((x: { id: string }) => x.id === seul)).toMatchObject({
      parentId: null,
      inheritFrameworks: false,
    });
  });
  it('refuse un parent inconnu, soi-même et toute boucle, sans rien modifier', async () => {
    const inconnu = await admin.post('/api/grc/smsis', {
      name: 'X',
      scope: '',
      timezone: 'Europe/Paris',
      parentId: crypto.randomUUID(),
    });
    expect(inconnu.statusCode).toBe(422);
    expect((await modifier(hopital, { parentId: hopital })).statusCode).toBe(422);
    const boucle = await modifier(groupe, { parentId: labo });
    expect(boucle.statusCode, boucle.body).toBe(422);
    expect(boucle.json().message ?? boucle.body).toMatch(/boucle/);
    const liste = (await admin.get('/api/grc/smsis')).json();
    expect(liste.find((x: { id: string }) => x.id === groupe).parentId).toBeNull();
  });
  it('la base refuse elle aussi une boucle écrite hors API', async () => {
    await expect(t.svc.db.q('UPDATE grc_smsis SET parent_id=$1 WHERE id=$2', [labo, groupe])).rejects.toThrow(/boucle/);
    await expect(t.svc.db.q('UPDATE grc_smsis SET parent_id=id WHERE id=$1', [groupe])).rejects.toThrow();
  });
  it('déplace un périmètre, détache avec null et journalise le changement', async () => {
    const r = await modifier(clinique, { parentId: hopital });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().parentId).toBe(hopital);
    const d = await modifier(clinique, { parentId: null });
    expect(d.json().parentId).toBeNull();
    const audit = await t.svc.db.one<{ details: { changed: string[]; previousParentId: string | null } }>(
      "SELECT details FROM audit_log WHERE action='grc.smsi.updated' AND target=$1 ORDER BY id DESC LIMIT 1",
      [clinique],
    );
    expect(audit!.details.changed).toContain('parentId');
    expect(audit!.details.previousParentId).toBe(hopital);
    // Omettre les champs de hiérarchie les laisse inchangés.
    await modifier(clinique, { parentId: groupe });
    const sans = await modifier(clinique, { name: 'Clinique renommée' });
    expect(sans.json()).toMatchObject({ parentId: groupe, name: 'Clinique renommée' });
  });
  it('réserve le rattachement à Pilotage:administrer', async () => {
    const r = await reader.post('/api/grc/smsis', {
      name: 'Refusé',
      scope: '',
      timezone: 'Europe/Paris',
      parentId: groupe,
    });
    expect(r.statusCode).toBe(403);
  });
});

describe('héritage explicite des référentiels', () => {
  it('un référentiel rattaché au parent apparaît, marqué hérité, chez les seuls enfants qui héritent', async () => {
    const a = await admin.put(`/api/grc/${groupe}/framework-attachments/${fw}`, {
      version: 1,
      statut: 'applique',
      confirm: 'RATTACHER',
    });
    expect(a.statusCode, a.body).toBe(200);
    expect((await effectifs(groupe))[0]).toMatchObject({ inherited: false, originName: null });
    // Hôpital et laboratoire héritent (chaîne ouverte) ; la clinique n'a pas ouvert l'héritage.
    expect(await effectifs(hopital)).toEqual([
      expect.objectContaining({ frameworkId: fw, inherited: true, originName: 'Groupe' }),
    ]);
    expect(await effectifs(labo)).toEqual([
      expect.objectContaining({ frameworkId: fw, inherited: true, originName: 'Groupe' }),
    ]);
    expect(await effectifs(clinique)).toEqual([]);
  });
  it('les exigences héritées sont proposées comme cibles de lien dans le périmètre enfant', async () => {
    const s = await admin.get(`/api/grc/${labo}/sources?search=R1`);
    expect(s.statusCode, s.body).toBe(200);
    expect(JSON.stringify(s.json())).toContain(`requirement:${fw}:1:R1`);
    const non = await admin.get(`/api/grc/${clinique}/sources?search=R1`);
    expect(JSON.stringify(non.json())).not.toContain(`requirement:${fw}`);
  });
  it('la couverture de l’enfant porte sur le référentiel hérité', async () => {
    const c = await admin.get(`/api/grc/${labo}/couverture`);
    expect(c.statusCode, c.body).toBe(200);
    expect(JSON.stringify(c.json())).toContain('HIER-FICTIF');
    expect(JSON.stringify((await admin.get(`/api/grc/${clinique}/couverture`)).json())).not.toContain('HIER-FICTIF');
  });
  it('désactiver localement l’emporte sur le parent et se propage plus bas', async () => {
    // « Désactiver ici » (ADR 0082) : une surcharge locale d'activation ; la copie reste celle du groupe.
    const local = await admin.put(`/api/grc/${hopital}/framework-attachments/${fw}/activation`, { enabled: false });
    expect(local.statusCode, local.body).toBe(200);
    expect((await effectifs(hopital))[0]).toMatchObject({
      inherited: true,
      overridden: true,
      enabled: false,
      originName: 'Groupe',
    });
    expect((await effectifs(labo))[0]).toMatchObject({ inherited: true, enabled: false, originName: 'Groupe' });
    const c = await admin.get(`/api/grc/${labo}/couverture`);
    expect(JSON.stringify(c.json())).not.toContain('HIER-FICTIF');
    // Le groupe reste inchangé.
    expect((await effectifs(groupe))[0]).toMatchObject({ enabled: true });
  });
  it('couper l’héritage retire les référentiels hérités', async () => {
    const r = await modifier(labo, { inheritFrameworks: false });
    expect(r.statusCode, r.body).toBe(200);
    expect(await effectifs(labo)).toEqual([]);
  });
  it('lit les mêmes référentiels effectifs en SQL et dans la logique partagée', async () => {
    const { referentielsEffectifs } = await import('@suivi/shared');
    await modifier(labo, { inheritFrameworks: true });
    const noeuds = (
      await t.svc.db.q<{ id: string; parentId: string | null; inheritFrameworks: boolean }>(
        'SELECT id,parent_id AS "parentId",inherit_frameworks AS "inheritFrameworks" FROM grc_smsis',
      )
    ).rows;
    const att = (
      await t.svc.db.q<{ origineId: string; frameworkId: string; version: number; enabled: boolean }>(
        'SELECT smsi_id AS "origineId",framework_id AS "frameworkId",version,enabled FROM grc_scope_frameworks',
      )
    ).rows;
    for (const id of [groupe, hopital, labo, clinique]) {
      const sql = (await t.svc.grc.effectiveFrameworks(id))
        .map((x) => `${x.frameworkId}|${x.origineId}|${x.enabled}`)
        .sort();
      const pur = referentielsEffectifs(noeuds, id, att)
        .map((x) => `${x.frameworkId}|${x.origineId}|${x.enabled}`)
        .sort();
      expect(sql).toEqual(pur);
    }
  });
});
