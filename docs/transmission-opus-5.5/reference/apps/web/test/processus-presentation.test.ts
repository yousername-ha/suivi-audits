import { describe, expect, it } from 'vitest';
import type { CarteProcessus, TypeProcessusDto } from '@suivi/shared';
import {
  filtrerProcessus,
  regrouperProcessus,
  parentsPossibles,
  SANS_TYPE_PROCESSUS,
  type FiltresProcessus,
} from '../src/processus/processus-presentation';
const vide: FiltresProcessus = { recherche: '', type: '', pilote: '', rattachement: '' };
const types = [{ code: 'pilotage', label: 'Pilotage stratégique', archived: true, tint: 'vert' }] as TypeProcessusDto[];
const p = (id: string, extra: Partial<CarteProcessus> = {}): CarteProcessus => ({
  id,
  ref: 'legacy:processes:' + id,
  name: id,
  family: 'pilotage',
  owner: '',
  purpose: '',
  parent: '',
  rattaches: { objectifs: [], indicateurs: [], swots: [], risques: [], fournisseurs: [] },
  ...extra,
});
describe('présentation des processus, sans mutation des sources', () => {
  it('retrouve les titres avec accents et les libellés du registre', () => {
    const records = [p('P1', { name: 'Systèmes d’information' })];
    expect(filtrerProcessus(records, types, { ...vide, recherche: 'systemes' })).toEqual(records);
    expect(filtrerProcessus(records, types, { ...vide, recherche: 'strategique' })).toEqual(records);
  });
  it('combine pilote, type et rattachement sans toucher aux listes', () => {
    const a = p('A', {
      owner: 'Direction',
      rattaches: {
        ...p('X').rattaches,
        swots: [{ id: 'SW1', ref: 'legacy:swots:SW1', name: 'Analyse', via: 'fiche', lienId: null }],
      },
    });
    const records = [a, p('B')],
      before = structuredClone(records);
    expect(
      filtrerProcessus(records, types, { ...vide, type: 'pilotage', pilote: 'Direction', rattachement: 'swots' }),
    ).toEqual([a]);
    expect(records).toEqual(before);
  });
  it('ne révèle pas un rattachement inaccessible dans les filtres', () => {
    const a = p('A', { rattaches: { ...p('X').rattaches, risques: null } });
    expect(filtrerProcessus([a], types, { ...vide, rattachement: 'risques' })).toEqual([]);
    expect(filtrerProcessus([a], types, { ...vide, rattachement: 'objectifs' }, ['objectifs'])).toEqual([]);
  });
  it('garde un enfant trouvé sans afficher son parent hors critères', () => {
    const records = [p('P'), p('E', { parent: 'P', name: 'Admission des patients' })];
    const visibles = filtrerProcessus(records, types, { ...vide, recherche: 'admission' });
    expect(
      regrouperProcessus(visibles, types)
        .flatMap((g) => g.racines)
        .map((x) => x.id),
    ).toEqual(['E']);
  });
  it('regroupe les racines une seule fois, sans supprimer les enfants de la source', () => {
    const records = [p('P'), p('E', { parent: 'P' }), p('G', { parent: 'E' })];
    expect(
      regrouperProcessus(records, types)
        .flatMap((g) => g.racines)
        .map((x) => x.id),
    ).toEqual(['P']);
    expect(records).toHaveLength(3);
  });
  it('conserve le type archivé, inconnu et absent dans leurs groupes', () => {
    const records = [p('A'), p('B', { family: 'personnalise' }), p('C', { family: '' })];
    const groups = regrouperProcessus(records, types);
    expect(groups.map((g) => g.code)).toEqual(['pilotage', 'personnalise', '']);
    expect(groups[0]!.type?.archived).toBe(true);
    expect(filtrerProcessus(records, types, { ...vide, type: SANS_TYPE_PROCESSUS }).map((x) => x.id)).toEqual(['C']);
  });
  it('rend visible une référence parent non résolue', () => {
    expect(regrouperProcessus([p('E', { parent: 'absent' })], types)[0]!.racines[0]!.id).toBe('E');
  });
  it('exclut tous les descendants, y compris éloignés, du choix de parent', () => {
    const records = [p('P'), p('E', { parent: 'P' }), p('G', { parent: 'E' }), p('A')];
    expect(parentsPossibles(records, 'P').map((x) => x.id)).toEqual(['A']);
    expect(parentsPossibles(records, 'G').map((x) => x.id)).toEqual(['P', 'E', 'A']);
  });
});
