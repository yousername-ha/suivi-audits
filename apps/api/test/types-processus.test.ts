/* Registre des types de processus : types de départ, création, modification, ordre, archivage, suppression d'un type
   inutilisé, contrôle du type d'un processus (fiche du Pilotage et création depuis la cartographie). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TypeProcessusDto } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent, idCommercial: string;
const racine = `/api/grc/${DEFAULT_SMSI}/pilotage/objectifs`;
const liste = async (a = admin) => (await a.get('/api/types-processus')).json() as TypeProcessusDto[];

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'tp_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'tp_lecteur', 'ro'));
});
afterAll(() => t.close());

describe('registre des types de processus', () => {
  it('propose les trois types historiques, lisibles par toute personne connectée', async () => {
    const l = await liste(lecteur);
    expect(l.map((x) => [x.code, x.label, x.archived])).toEqual([
      ['Management', 'Pilotage', false],
      ['Réalisation', 'Réalisation', false],
      ['Support', 'Support', false],
    ]);
    expect((await new Agent(t).get('/api/types-processus')).statusCode).toBe(401);
  });

  it('réserve l’écriture à l’administration', async () => {
    expect((await lecteur.post('/api/types-processus', { label: 'Métier' })).statusCode).toBe(403);
    const id = (await liste())[0]!.id;
    expect((await lecteur.put(`/api/types-processus/${id}`, { label: 'X' })).statusCode).toBe(403);
    expect((await lecteur.del(`/api/types-processus/${id}`)).statusCode).toBe(403);
  });

  it('crée un type : code déduit du libellé, doublon refusé, rang en fin de liste', async () => {
    const r = await admin.post('/api/types-processus', {
      label: 'Métier',
      description: 'Cœur de métier',
      tint: 'orange',
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ code: 'Metier', label: 'Métier', tint: 'orange', rank: 4, usage: 0 });
    expect((await admin.post('/api/types-processus', { label: 'métier' })).statusCode).toBe(409);
    expect((await admin.post('/api/types-processus', { label: '  ' })).statusCode).toBe(422);
    expect((await admin.post('/api/types-processus', { label: 'Autre', tint: 'rose' })).statusCode).toBe(422);
  });

  it('modifie libellé, description et teinte sans toucher au code', async () => {
    const m = (await liste()).find((x) => x.code === 'Metier')!;
    const r = await admin.put(`/api/types-processus/${m.id}`, { label: 'Métier / opérationnel', tint: 'rouge' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ code: 'Metier', label: 'Métier / opérationnel', tint: 'rouge' });
    expect((await admin.put(`/api/types-processus/${m.id}`, {})).statusCode).toBe(422);
    expect((await admin.put(`/api/types-processus/${m.id}`, { code: 'X' })).statusCode).toBe(422);
  });

  it('un processus ne porte qu’un type actif du registre', async () => {
    const ko = await admin.post(`${racine}/processes`, { name: 'Sans type valide', family: 'Inconnu' });
    expect(ko.statusCode, ko.body).toBe(422);
    const ok = await admin.post(`${racine}/processes`, { name: 'Commercial', family: 'Metier' });
    expect(ok.statusCode, ok.body).toBe(200);
    idCommercial = ok.json().id;
    const vide = await admin.post(`${racine}/processes`, { name: 'Sans type' });
    expect(vide.statusCode, vide.body).toBe(200);
    const m = (await liste()).find((x) => x.code === 'Metier')!;
    expect(m.usage).toBe(1);
  });

  it('un type utilisé s’archive mais ne se supprime pas ; archivé, il n’est plus proposé mais le processus le garde', async () => {
    const m = (await liste()).find((x) => x.code === 'Metier')!;
    const suppr = await admin.del(`/api/types-processus/${m.id}`);
    expect(suppr.statusCode, suppr.body).toBe(409);
    const arch = await admin.put(`/api/types-processus/${m.id}`, { archived: true });
    expect(arch.json()).toMatchObject({ archived: true, usage: 1 });
    expect((await liste()).at(-1)!.code).toBe('Metier');
    const neuf = await admin.post(`${racine}/processes`, { name: 'Autre commercial', family: 'Metier' });
    expect(neuf.statusCode, neuf.body).toBe(422);
    // Le processus qui portait déjà ce type reste modifiable, tant qu'il le garde.
    const garde = await admin.patch(`${racine}/processes/${idCommercial}`, {
      name: 'Commercial renommé',
      family: 'Metier',
    });
    expect(garde.statusCode, garde.body).toBe(200);
    const change = await admin.patch(`${racine}/processes/${idCommercial}`, { family: 'Inconnu' });
    expect(change.statusCode, change.body).toBe(422);
  });

  it('refuse la création d’un processus depuis la cartographie avec un type inconnu ou archivé', async () => {
    const ko = await admin.post('/api/carto/objects', { type: 'process', name: 'Carto inconnu', family: 'Inconnu' });
    expect(ko.statusCode, ko.body).toBe(422);
    const archive = await admin.post('/api/carto/objects', {
      type: 'process',
      name: 'Carto archivé',
      family: 'Metier',
    });
    expect(archive.statusCode, archive.body).toBe(422);
    const ok = await admin.post('/api/carto/objects', {
      type: 'process',
      name: 'Carto réalisation',
      family: 'Réalisation',
    });
    expect(ok.statusCode, ok.body).toBe(201);
  });

  it('réordonne les types (liste complète exigée) et supprime un type inutilisé, avec trace', async () => {
    const avant = await liste();
    const ids = avant.map((x) => x.id).reverse();
    const r = await admin.put('/api/types-processus/ordre', { ids });
    expect(r.statusCode, r.body).toBe(200);
    expect((await liste()).filter((x) => !x.archived).map((x) => x.code)).toEqual([
      'Support',
      'Réalisation',
      'Management',
    ]);
    expect((await admin.put('/api/types-processus/ordre', { ids: ids.slice(1) })).statusCode).toBe(422);
    const neuf = (await admin.post('/api/types-processus', { label: 'Éphémère' })).json() as TypeProcessusDto;
    expect((await admin.del(`/api/types-processus/${neuf.id}`)).statusCode).toBe(204);
    const audit = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE 'admin.type_processus_%' ORDER BY id",
    );
    expect(new Set(audit.rows.map((x) => x.action))).toEqual(
      new Set([
        'admin.type_processus_created',
        'admin.type_processus_updated',
        'admin.type_processus_ordered',
        'admin.type_processus_deleted',
      ]),
    );
  });

  it('libellés en double (casse ignorée), restauration bloquée, identifiant inconnu, archivés listés en dernier', async () => {
    const a = (await admin.post('/api/types-processus', { label: 'Pilotage stratégique' })).json() as TypeProcessusDto;
    const b = (await admin.post('/api/types-processus', { label: 'Achats' })).json() as TypeProcessusDto;
    // Renommer vers le libellé d'un autre type actif, casse ignorée : refusé ; renommer vers son propre libellé : accepté.
    expect((await admin.put(`/api/types-processus/${b.id}`, { label: 'PILOTAGE STRATÉGIQUE' })).statusCode).toBe(409);
    expect((await admin.put(`/api/types-processus/${a.id}`, { label: 'pilotage stratégique' })).statusCode).toBe(200);
    // Archiver b, créer un type actif qui reprend son libellé : b ne peut plus être restauré sans être renommé.
    expect((await admin.put(`/api/types-processus/${b.id}`, { archived: true })).statusCode).toBe(200);
    const c = (await admin.post('/api/types-processus', { label: 'achats' })).json() as TypeProcessusDto;
    const restauration = await admin.put(`/api/types-processus/${b.id}`, { archived: false });
    expect(restauration.statusCode).toBe(409);
    expect(restauration.json().error).toMatch(/renommez avant de restaurer/);
    const renomme = await admin.put(`/api/types-processus/${b.id}`, { archived: false, label: 'Achats publics' });
    expect(renomme.statusCode, renomme.body).toBe(200);
    expect(renomme.json()).toMatchObject({ archived: false, label: 'Achats publics', code: b.code, usage: 0 });
    // Identifiant inconnu : 404 en modification comme en suppression.
    const inconnu = '00000000-0000-4000-8000-00000000abcd';
    expect((await admin.put(`/api/types-processus/${inconnu}`, { label: 'X' })).statusCode).toBe(404);
    expect((await admin.del(`/api/types-processus/${inconnu}`)).statusCode).toBe(404);
    // Ordre : actifs par rang puis archivés à la fin.
    expect((await admin.put(`/api/types-processus/${c.id}`, { archived: true })).statusCode).toBe(200);
    const l = await liste();
    const premierArchive = l.findIndex((x) => x.archived);
    expect(premierArchive).toBeGreaterThan(0);
    expect(l.slice(premierArchive).every((x) => x.archived)).toBe(true);
    const actifs = l.filter((x) => !x.archived).map((x) => x.rank);
    expect(actifs).toEqual([...actifs].sort((x, y) => x - y));
  });
});
