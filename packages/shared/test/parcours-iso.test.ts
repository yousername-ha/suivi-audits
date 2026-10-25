/* Catalogue du parcours guidé ISO 27001 / HDS (dossier 024, v011) : contenu stable et cohérent. */
import { describe, expect, it } from 'vitest';
import {
  BRANCHES_PARCOURS,
  ETAPES_PARCOURS,
  RACCOURCIS_PARCOURS,
  SOURCE_ETAPE,
  SOURCES_PARCOURS,
  etapeParcours,
  etapesAffichees,
  etapesSansRaccourci,
  sousActionParcours,
  sousActionsDuRaccourci,
} from '../src/parcours-iso.js';

const sousActions = ETAPES_PARCOURS.flatMap((e) => e.sousActions);

describe('parcours ISO 27001 / HDS : catalogue', () => {
  it('16 étapes, 26 sous-actions, 5 étapes HDS, 11 raccourcis graphiques', () => {
    expect(ETAPES_PARCOURS).toHaveLength(16);
    expect(sousActions).toHaveLength(26);
    expect(ETAPES_PARCOURS.filter((e) => e.branche === 'hds')).toHaveLength(5);
    expect(RACCOURCIS_PARCOURS).toHaveLength(11);
  });

  it('identifiants uniques et stables ; dépendances connues, sans cycle', () => {
    const ids = [...ETAPES_PARCOURS.map((e) => e.id), ...sousActions.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ETAPES_PARCOURS.map((e) => e.id)).toEqual([
      'context',
      'govern',
      'support',
      'risk',
      'objectives',
      'treatment',
      'operate',
      'audit',
      'measure',
      'review',
      'improve',
      'hds-scope',
      'hds-smsi',
      'hds-contract',
      'hds-sovereignty',
      'hds-cert',
    ]);
    const vus = new Set<string>();
    const visite = (id: string, pile: string[]) => {
      expect(pile, `cycle ${[...pile, id].join(' → ')}`).not.toContain(id);
      if (vus.has(id)) return;
      for (const d of etapeParcours(id)!.dependances) {
        expect(etapeParcours(d), `${id} dépend de ${d}`).toBeDefined();
        visite(d, [...pile, id]);
      }
      vus.add(id);
    };
    for (const e of ETAPES_PARCOURS) visite(e.id, []);
  });

  it('chaque sous-action prépare un repère de son étape et désigne un module ; les branches sont connues', () => {
    for (const e of ETAPES_PARCOURS) {
      expect(BRANCHES_PARCOURS).toContain(e.branche);
      expect(SOURCE_ETAPE[e.source]).toMatch(/^https:\/\//);
      expect(e.sousActions.length).toBeGreaterThan(0);
      for (const s of e.sousActions) {
        expect(s.id.startsWith(e.id + '-')).toBe(true);
        expect(s.repere).toBeLessThan(e.reperes.length);
        expect(s.attendu.length).toBeGreaterThan(20);
        expect('rubrique' in s.vers ? s.vers.rubrique : s.vers.chemin).toBeTruthy();
      }
    }
  });

  it('les raccourcis désignent des sous-actions existantes de leur étape, sans en dupliquer', () => {
    for (const r of RACCOURCIS_PARCOURS) {
      const e = etapeParcours(r.etape)!;
      expect(e, r.id).toBeDefined();
      for (const id of r.sousActions ?? []) expect(e.sousActions.map((s) => s.id)).toContain(id);
      expect(sousActionsDuRaccourci(r).length).toBeGreaterThan(0);
    }
    const parEtape = new Map<string, string[]>();
    for (const r of RACCOURCIS_PARCOURS)
      parEtape.set(r.etape, [...(parEtape.get(r.etape) ?? []), ...sousActionsDuRaccourci(r).map((s) => s.id)]);
    for (const [etape, liste] of parEtape) expect(new Set(liste).size, etape).toBe(liste.length);
  });

  it('masquer HDS ne retire que les étapes HDS ; les étapes sans raccourci restent accessibles', () => {
    expect(etapesAffichees(true)).toHaveLength(16);
    expect(etapesAffichees(false).map((e) => e.branche)).not.toContain('hds');
    expect(etapesAffichees(false)).toHaveLength(11);
    const sansRaccourci = etapesSansRaccourci(true).map((e) => e.id);
    expect(sansRaccourci).toEqual([
      'support',
      'objectives',
      'operate',
      'measure',
      'hds-smsi',
      'hds-sovereignty',
      'hds-cert',
    ]);
    expect(etapesSansRaccourci(false).map((e) => e.id)).toEqual(['support', 'objectives', 'operate', 'measure']);
    expect(sousActionParcours('risk-2')?.etape.id).toBe('risk');
  });

  it('sources : références officielles uniquement, avec leur limite', () => {
    expect(SOURCES_PARCOURS.map((s) => s.id)).toContain('ISO-03-LIMITE');
    for (const s of SOURCES_PARCOURS) {
      expect(s.url).toMatch(/^https:\/\/(www\.iso\.org|committee\.iso\.org|esante\.gouv\.fr)\//);
      expect(s.limite.length).toBeGreaterThan(20);
    }
  });

  it('aucun attendu ne revendique une conformité ou une certification obtenue', () => {
    const texte = ETAPES_PARCOURS.flatMap((e) => [
      e.titre,
      ...e.sousActions.flatMap((s) => [s.attendu, s.livrable]),
    ]).join(' ');
    expect(texte).not.toMatch(/\b(est conforme|sont conformes|certifié|certification obtenue)\b/i);
  });
});
