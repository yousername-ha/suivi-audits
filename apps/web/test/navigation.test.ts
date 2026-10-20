/* Menu à sept familles : aucune rubrique du Pilotage perdue ni doublée, droits et adresses d'origine conservés. */
import type { Action, Module } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { FAMILLES, famillesVisibles, localiser } from '../src/navigation';
import { PILOTAGE_NAV } from '../src/pilotage-navigation';

const tout = () => true;
const rubriques = FAMILLES.flatMap((f) => f.destinations.flatMap((d) => d.rubriques));

describe('navigation', () => {
  it('range les sept familles dans l’ordre validé', () => {
    expect(FAMILLES.map((f) => f.label)).toEqual([
      'Pilotage',
      'Organisation',
      'Risques',
      'Conformité et audits',
      'Actions',
      'Résilience',
      'Documents',
    ]);
  });
  it('reprend chaque rubrique du Pilotage une seule fois, avec son module', () => {
    const attendu: { id: string; module: string }[] = PILOTAGE_NAV.flatMap((g) => [...g.items]);
    const trouvees = rubriques.filter((r) => r.to.startsWith('/pilotage/'));
    expect(trouvees.map((r) => r.id).sort()).toEqual(attendu.map((i) => i.id).sort());
    for (const i of attendu) expect(trouvees.find((r) => r.id === i.id)?.module).toBe(i.module);
  });
  it('n’a aucune adresse ni aucun identifiant en double', () => {
    expect(new Set(rubriques.map((r) => r.to)).size).toBe(rubriques.length);
    expect(new Set(rubriques.map((r) => r.id)).size).toBe(rubriques.length);
    const destinations = FAMILLES.flatMap((f) => f.destinations.map((d) => d.id));
    expect(new Set(destinations).size).toBe(destinations.length);
  });
  it('conserve les pages hors Pilotage et leur droit', () => {
    const par = Object.fromEntries(rubriques.map((r) => [r.to, r]));
    expect(par['/documents']).toMatchObject({ module: 'documents' });
    expect(par['/cartographie']).toMatchObject({ module: 'cartographie' });
    expect(par['/ia/evaluations']).toMatchObject({ module: 'ia' });
    expect(par['/exports']).toMatchObject({ module: 'import_export', action: 'exporter' });
  });
  it('masque ce qui n’est pas lisible : destination et famille disparaissent', () => {
    const seulement = (m: Module) => (module: Module, a: Action) => module === m && a === 'lire';
    const doc = famillesVisibles(seulement('documents'));
    // « Registres et droits » est ouvert à toute personne connectée : l'accès réel est décidé par l'API.
    expect(doc.map((f) => f.famille.id)).toEqual(['conformite', 'actions', 'documents']);
    expect(doc.find((f) => f.famille.id === 'documents')?.destinations.map((d) => d.id)).toEqual(['documents']);
    expect(famillesVisibles(() => false).map((f) => f.famille.id)).toEqual(['actions']);
    expect(famillesVisibles(tout)).toHaveLength(7);
  });
  it('conserve le droit de module de chaque rubrique du menu hors registres', () => {
    for (const r of rubriques.filter((x) => x.id !== 'registres')) expect(r.module).toBeDefined();
  });
  it('la cartographie des risques demande aussi la lecture du Pilotage', () => {
    const sansPilotage = (m: Module) => m === 'cartographie';
    const risques = famillesVisibles((m) => sansPilotage(m)).find((f) => f.famille.id === 'risques');
    expect(risques).toBeUndefined();
  });
  it('localise une adresse, y compris la racine /pilotage et les sous-adresses', () => {
    expect(localiser('/pilotage')?.rubrique.id).toBe('synthese');
    expect(localiser('/pilotage/risques')?.famille.id).toBe('risques');
    expect(localiser('/documents/abc')?.destination.id).toBe('documents');
    expect(localiser('/cartographie/risques')?.famille.id).toBe('organisation');
    expect(localiser('/account')).toBeUndefined();
  });
});
