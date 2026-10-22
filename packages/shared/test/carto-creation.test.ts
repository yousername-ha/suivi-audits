/* Construire une carte de zéro (CARTO-15 à CARTO-19) : création et renommage dans l'état legacy, notes et cadres
   libres, placement au point visé, alignement, répartition, carte vierge. Données fictives uniquement. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CreateObjectBody,
  CreationError,
  MapLayoutSchema,
  MapSettingsSchema,
  addFree,
  alignNodes,
  blankLayout,
  buildObjects,
  canRename,
  cartoContext,
  createInLegacy,
  defaultGenerateOptions,
  distributeNodes,
  emptyLayout,
  frameAround,
  generateLayout,
  issueRef,
  nextProcessCode,
  nodesWithin,
  placeNodeAt,
  relayout,
  removeNode,
  renameInLegacy,
  selectForGeneration,
  setFree,
  syncInfo,
  withFree,
  type CreateObjectInput,
  type MapLayout,
} from '../src/carto/index.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const DONNEES = JSON.parse(readFileSync(path.join(RACINE, 'tests/fixtures/carto-donnees.json'), 'utf8')) as Record<
  string,
  unknown
>;
const NOW = '2026-10-08T10:00:00.000Z';
let u = 0;
const opts = () => ({ now: NOW, uid: () => 'fictif' + u++ });
const creer = (state: unknown, b: CreateObjectInput, existingIssues?: ReadonlySet<string>) =>
  createInLegacy(state, CreateObjectBody.parse(b), { ...opts(), existingIssues });
const objets = (data: unknown, mapIssues?: Parameters<typeof buildObjects>[1]['mapIssues']) =>
  buildObjects(data, { org: 'Organisation fictive', details: true, mapIssues });

describe('création dans la plateforme (CARTO-15)', () => {
  it('partie intéressée : champs et identifiant de l’outil historique, état reçu inchangé', () => {
    const avant = JSON.stringify(DONNEES);
    const r = creer(DONNEES, { type: 'stakeholder', name: 'Autorité de contrôle (fictive)', nature: 'Externe' });
    expect(JSON.stringify(DONNEES)).toBe(avant);
    expect(r.ref).toMatch(/^pi:PI-fictif\d+$/);
    const pi = (r.data.interested as Record<string, unknown>[]).at(-1)!;
    expect(pi).toEqual({
      id: r.ref.slice(3),
      createdAt: NOW,
      name: 'Autorité de contrôle (fictive)',
      type: 'Externe',
      cat: 'Autre',
      needs: '',
      req: '',
      addressed: '',
      how: '',
      owner: '',
      reviewed: '',
    });
    const o = objets(r.data).get(r.ref)!;
    expect(o).toMatchObject({ type: 'stakeholder', ext: true, name: 'Autorité de contrôle (fictive)' });
  });

  it('fournisseur : SUPnn suivant, contrôles par défaut (HDS compris), nom unique', () => {
    const vide = creer({}, { type: 'supplier', name: 'Hébergeur fictif', hds: true, critical: true, saas: true });
    expect(vide.ref).toBe('sup:SUP01');
    const sp = (vide.data.suppliers as Record<string, unknown>[])[0]!;
    expect(sp).toMatchObject({ hds: 'Oui', critical: 'Oui', saas: true });
    expect((sp.controls as { id: string }[]).map((c) => c.id)).toEqual(['mfa', 'sso', 'acc', 'svc', 'hds']);
    expect(objets(vide.data).get('sup:SUP01')).toMatchObject({ hds: true, crit: true, saas: true });
    const deux = creer(vide.data, { type: 'supplier', name: 'Autre fournisseur fictif' });
    expect(deux.ref).toBe('sup:SUP02');
    expect(() => creer(vide.data, { type: 'supplier', name: 'HÉBERGEUR FICTIF ' })).toThrow(CreationError);
    expect(() => creer(vide.data, { type: 'supplier', name: 'hébergeur fictif' })).toThrow('déjà');
  });

  it('application : APPnn, fournisseur choisi dans la liste', () => {
    const f = creer({}, { type: 'supplier', name: 'Éditeur fictif' });
    const a = creer(f.data, { type: 'application', name: 'Application fictive', supplier: 'éditeur fictif' });
    expect(a.ref).toBe('app:APP01');
    expect((a.data.appGaps as Record<string, unknown>[])[0]).toMatchObject({
      supplier: 'Éditeur fictif',
      status: 'À étudier',
    });
    expect(objets(a.data).get('app:APP01')).toMatchObject({ supRef: 'sup:SUP01' });
    expect(() => creer(f.data, { type: 'application', name: 'X', supplier: 'Inconnu' })).toThrow(CreationError);
  });

  it('site et système : ajoutés aux lignes du périmètre, sans doublon', () => {
    const s = creer({ scope: { sites: 'Site A fictif' } }, { type: 'site', name: 'Site B fictif' });
    expect((s.data.scope as Record<string, unknown>).sites).toBe('Site A fictif\nSite B fictif');
    expect(objets(s.data).has(s.ref)).toBe(true);
    const sy = creer(s.data, { type: 'infrastructure', name: 'Réseau fictif' });
    expect((sy.data.scope as Record<string, unknown>).systems).toBe('Réseau fictif');
    expect(objets(sy.data).get(sy.ref)).toMatchObject({ type: 'infrastructure' });
    expect(() => creer(sy.data, { type: 'site', name: 'site a fictif' })).toThrow('existe déjà');
    const tableau = creer({ scope: { sites: ['Un'] } }, { type: 'site', name: 'Deux' });
    expect((tableau.data.scope as Record<string, unknown>).sites).toEqual(['Un', 'Deux']);
  });

  it('processus et sous-processus : codes proposés, famille du parent, codes uniques', () => {
    expect(nextProcessCode(['PR1', 'pr2'])).toBe('PR3');
    expect(nextProcessCode(['PR3.1'], 'PR3')).toBe('PR3.2');
    const p = creer({}, { type: 'process', name: 'Réaliser (fictif)', family: 'Réalisation' });
    expect(p.ref).toBe('process:PR1');
    const sp = creer(p.data, { type: 'subprocess', name: 'Étape fictive', parent: 'PR1' });
    expect(sp.ref).toBe('process:PR1.1');
    const o = objets(sp.data);
    expect(o.get('process:PR1.1')).toMatchObject({ type: 'subprocess', parent: 'process:PR1', family: 'Réalisation' });
    expect(() => creer(sp.data, { type: 'process', name: 'X', code: 'pr1', family: 'Support' })).toThrow('déjà');
    expect(() => creer(sp.data, { type: 'subprocess', name: 'X', parent: 'PR9' })).toThrow('parent');
    expect(() => creer(sp.data, { type: 'subprocess', name: 'X', parent: 'PR1', code: 'PR2.1' })).toThrow(
      'commence par',
    );
  });

  it('enjeu : rangé dans les réglages de la carte, même référence qu’un enjeu dérivé, sans doublon', () => {
    const r = creer(DONNEES, { type: 'issue', name: 'Menace fictive', kind: 'ext' });
    expect(r.data).toEqual(DONNEES);
    expect(r.issue).toEqual({ label: 'Menace fictive', kind: 'ext' });
    expect(r.ref).toBe(issueRef('menace fictive '));
    expect(MapSettingsSchema.parse({ issues: [r.issue] }).issues).toHaveLength(1);
    const o = objets(DONNEES, [r.issue!]).get(r.ref)!;
    expect(o).toMatchObject({ type: 'external_issue', src: [{ k: 'map' }] });
    expect(() => creer(DONNEES, { type: 'issue', name: 'Menace fictive', kind: 'int' }, new Set([r.ref]))).toThrow(
      'existe déjà',
    );
  });

  it('validation des corps : nom obligatoire, caractères de contrôle refusés, catégorie connue', () => {
    expect(CreateObjectBody.safeParse({ type: 'site', name: '  ' }).success).toBe(false);
    expect(CreateObjectBody.safeParse({ type: 'site', name: 'a\u0007b' }).success).toBe(false);
    expect(CreateObjectBody.safeParse({ type: 'stakeholder', name: 'x', category: 'Inventée' }).success).toBe(false);
    // la famille est un type du registre de la Plateforme : sa validité est vérifiée côté API, pas ici.
    expect(CreateObjectBody.safeParse({ type: 'process', name: 'x', family: '' }).success).toBe(false);
    expect(CreateObjectBody.safeParse({ type: 'process', name: 'x', family: 'Support', code: 'a b' }).success).toBe(
      false,
    );
    expect(CreateObjectBody.parse({ type: 'stakeholder', name: 'x', category: '' })).toMatchObject({
      nature: 'Externe',
    });
  });
});

describe('renommage (CARTO-18)', () => {
  it('modifie le module d’origine ; un fournisseur renommé reste lié à ses applications', () => {
    const f = creer({}, { type: 'supplier', name: 'Ancien nom fictif' });
    const a = creer(f.data, { type: 'application', name: 'App fictive', supplier: 'Ancien nom fictif' });
    const r = renameInLegacy(a.data, 'sup:SUP01', 'Nouveau nom fictif');
    expect(r.old).toBe('Ancien nom fictif');
    expect(objets(r.data).get('app:APP01')).toMatchObject({ supRef: 'sup:SUP01' });
    expect((r.data.appGaps as Record<string, unknown>[])[0]!.supplier).toBe('Nouveau nom fictif');
    const sansApp = renameInLegacy(f.data, 'sup:SUP01', 'Autre');
    expect('appGaps' in sansApp.data).toBe(false);
  });
  it('refuse les objets repérés par leur libellé et les objets absents', () => {
    expect(canRename('process:PR1')).toBe(true);
    expect(canRename('issue:abc')).toBe(false);
    expect(() => renameInLegacy(DONNEES, 'site:abc', 'x')).toThrow(CreationError);
    expect(() => renameInLegacy(DONNEES, 'pi:inexistant', 'x')).toThrow('introuvable');
  });
});

describe('notes, cadres libres et placement (CARTO-17, CARTO-19)', () => {
  const objs = buildObjects(DONNEES, { org: 'Organisation fictive' });
  const ctx = cartoContext(objs);
  let k = 0;
  const id = () => `g${k++}`;
  const contexte = (): MapLayout => {
    const fd = defaultGenerateOptions('context', objs);
    return generateLayout(null, ctx, 'context', selectForGeneration(ctx, 'context', fd), fd, id);
  };

  it('carte vierge : SMSI dans le périmètre, ou trois bandes vides', () => {
    const c = blankLayout('context');
    expect(Object.keys(c.nodes)).toEqual(['scope', 'isms']);
    expect(MapLayoutSchema.safeParse(c).success).toBe(true);
    expect(Object.keys(blankLayout('process').nodes)).toEqual(['lane:pil', 'lane:rea', 'lane:sup']);
  });

  it('note et cadre : schéma, texte et teinte, conservés par la disposition et la génération, retirés proprement', () => {
    let l = addFree(contexte(), 'note', 'n1', 100, 100, 'À vérifier', 'orange');
    l = addFree(l, 'frame', 'f1', 0, 0, 'Hébergement HDS', 'violet');
    expect(MapLayoutSchema.parse(l).free).toEqual({
      'note:n1': { text: 'À vérifier', tint: 'orange' },
      'frame:f1': { text: 'Hébergement HDS', tint: 'violet' },
    });
    l = setFree(l, 'note:n1', { text: 'Vérifié', tint: 'vert' });
    expect(l.nodes['note:n1']!.label).toBe('Vérifié');
    const look = withFree(ctx.lookup, l.free);
    expect(look('note:n1')).toMatchObject({ type: 'note', name: 'Vérifié', tint: 'vert' });
    expect(look('frame:f1')).toMatchObject({ type: 'frame', name: 'Hébergement HDS' });
    expect(syncInfo(l, objs, 'context').miss).toEqual([]);
    expect(relayout(l, ctx, 'context').nodes['note:n1']).toEqual(l.nodes['note:n1']);
    const fd = { ...defaultGenerateOptions('context', objs), mode: 'replace' as const };
    expect(generateLayout(l, ctx, 'context', ['isms', 'scope'], fd, id).nodes['frame:f1']).toBeDefined();
    const sans = removeNode(removeNode(l, 'note:n1'), 'frame:f1');
    expect(sans.free).toBeUndefined();
    expect(sans.ignored['note:n1']).toBeUndefined();
    expect(
      MapLayoutSchema.safeParse({ ...emptyLayout(), free: { 'note:a b': { text: '', tint: 'vert' } } }).success,
    ).toBe(false);
    expect(
      MapLayoutSchema.safeParse({ ...emptyLayout(), free: { 'note:a': { text: 'x'.repeat(501), tint: 'vert' } } })
        .success,
    ).toBe(false);
  });

  it('placement au point visé sans chevauchement', () => {
    const l0 = blankLayout('context');
    const l1 = placeNodeAt(l0, 'pi:PI-001', 'context', ctx.lookup, 2000, 2000);
    const n1 = l1.nodes['pi:PI-001']!;
    expect([n1.x + n1.w / 2, n1.y + n1.h / 2]).toEqual([2000, 2000]);
    const l2 = placeNodeAt(l1, 'pi:PI-002', 'context', ctx.lookup, 2000, 2000);
    const n2 = l2.nodes['pi:PI-002']!;
    const chevauche = n2.x < n1.x + n1.w && n2.x + n2.w > n1.x && n2.y < n1.y + n1.h && n2.y + n2.h > n1.y;
    expect(chevauche).toBe(false);
    expect(Math.hypot(n2.x - n1.x, n2.y - n1.y)).toBeLessThan(400);
  });

  it('aligner, répartir, grouper dans un cadre, lasso', () => {
    let l = emptyLayout();
    l.nodes = {
      'pi:a': { x: 10, y: 0, w: 100, h: 50, label: '' },
      'pi:b': { x: 300, y: 40, w: 120, h: 50, label: '' },
      'pi:c': { x: 90, y: 200, w: 80, h: 50, label: '' },
    };
    const g = alignNodes(l, ['pi:a', 'pi:b', 'pi:c'], 'left');
    expect(Object.values(g.nodes).map((n) => n.x)).toEqual([10, 10, 10]);
    const t = alignNodes(l, ['pi:a', 'pi:b'], 'bottom');
    expect(t.nodes['pi:a']!.y + 50).toBe(t.nodes['pi:b']!.y + 50);
    const h = distributeNodes(l, ['pi:a', 'pi:b', 'pi:c'], 'h');
    expect(h.nodes['pi:a']!.x).toBe(10);
    expect(h.nodes['pi:b']!.x + 120).toBe(420);
    const gauche = h.nodes['pi:c']!.x - (10 + 100),
      droite = h.nodes['pi:b']!.x - (h.nodes['pi:c']!.x + 80);
    expect(Math.abs(gauche - droite)).toBeLessThanOrEqual(1);
    expect(distributeNodes(l, ['pi:a', 'pi:b'], 'h')).toBe(l);
    l = frameAround(l, ['pi:a', 'pi:b'], 'f9', 'Groupe', 'gris');
    const f = l.nodes['frame:f9']!;
    expect(f.x).toBeLessThan(10);
    expect(f.x + f.w).toBeGreaterThan(420);
    expect(nodesWithin(l, { x: 0, y: -10, w: 200, h: 100 })).toEqual(['pi:a']);
  });
});
