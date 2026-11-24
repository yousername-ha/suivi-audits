/* Matrice RACI des fournisseurs (ADR 0113) : modèle de départ, bornes et forme du contrat, règle « exactement un A, au
   moins un R » (contrôlée sans bloquer). Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  MatriceRaciBody,
  RACI_ACTEUR_FOURNISSEUR,
  RACI_BORNES,
  RACI_LETTRES_LIBELLES,
  activitesARevoirRaci,
  controleRaci,
  libelleControleRaci,
  matriceRaciModele,
  nettoyerLibelleRaci,
} from '../src/index.js';

const base = () => matriceRaciModele();
const erreurs = (v: unknown) => {
  const r = MatriceRaciBody.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('modèle de départ', () => {
  it('propose les sept activités et les trois fonctions de la décision du RSSI, sans aucune lettre', () => {
    const m = base();
    expect(m.activites.map((a) => a.libelle)).toEqual([
      'Application des correctifs de sécurité',
      'Sauvegardes et restauration',
      'Gestion des accès et des comptes',
      'Surveillance et supervision',
      'Gestion des incidents de sécurité',
      'Gestion des changements',
      'Réversibilité et fin de contrat',
    ]);
    expect(m.acteurs.map((a) => a.libelle)).toEqual(['RSSI', 'DSI', 'Référent métier']);
    expect(m.cases).toEqual([]);
    expect(MatriceRaciBody.parse(m)).toEqual(m);
  });
  it('rend une copie : modifier la matrice créée ne change pas le modèle', () => {
    const m = base();
    m.activites[0]!.libelle = 'Renommée';
    m.acteurs.pop();
    expect(base().activites[0]!.libelle).toBe('Application des correctifs de sécurité');
    expect(base().acteurs).toHaveLength(3);
  });
  it('donne la légende de la maquette', () => {
    expect(RACI_LETTRES_LIBELLES).toEqual({
      R: 'Réalise',
      A: 'Approuve, rend des comptes (un seul par activité)',
      C: 'Consulté avant',
      I: 'Informé après',
    });
  });
});

describe('forme et bornes du contrat', () => {
  it('nettoie les libellés (caractères de contrôle, espaces) et refuse un libellé vide ou trop long', () => {
    expect(nettoyerLibelleRaci('  Gestion\u0000des\taccès \u0085 ')).toBe('Gestion des accès');
    const m = base();
    m.activites[0]!.libelle = ' Sauvegardes\n   fictives ';
    expect(MatriceRaciBody.parse(m).activites[0]!.libelle).toBe('Sauvegardes fictives');
    m.activites[0]!.libelle = ' \u0007 ';
    expect(erreurs(m)).toContain('Libellé vide.');
    m.activites[0]!.libelle = 'x'.repeat(RACI_BORNES.libelle + 1);
    expect(erreurs(m)).toContain(`Libellé limité à ${RACI_BORNES.libelle} caractères.`);
    m.activites[0]!.libelle = 'x'.repeat(RACI_BORNES.libelle);
    expect(erreurs(m)).toEqual([]);
  });
  it('borne les activités à 60 et les acteurs à 15 (en plus du fournisseur)', () => {
    const activites = Array.from({ length: 61 }, (_, i) => ({ id: `a-${i}`, libelle: `Activité ${i}` }));
    const acteurs = Array.from({ length: 16 }, (_, i) => ({ id: `f-${i}`, libelle: `Fonction ${i}` }));
    expect(erreurs({ activites, acteurs: [], cases: [] })).toHaveLength(1);
    expect(erreurs({ activites: activites.slice(0, 60), acteurs: acteurs.slice(0, 15), cases: [] })).toEqual([]);
    expect(erreurs({ activites: [], acteurs, cases: [] })).toHaveLength(1);
  });
  it('refuse un champ inconnu, un identifiant mal formé ou dupliqué, et l’identifiant réservé du fournisseur', () => {
    expect(erreurs({ ...base(), extra: 1 })).not.toEqual([]);
    expect(erreurs({ ...base(), activites: [{ id: 'A B', libelle: 'x' }] })).not.toEqual([]);
    expect(erreurs({ ...base(), activites: [{ id: 'x', libelle: 'x', note: 'n' }] })).not.toEqual([]);
    expect(
      erreurs({
        ...base(),
        activites: [
          { id: 'x', libelle: 'Un' },
          { id: 'x', libelle: 'Deux' },
        ],
      }),
    ).toContain('Identifiants d’activités dupliqués.');
    expect(erreurs({ ...base(), acteurs: [{ id: RACI_ACTEUR_FOURNISSEUR, libelle: 'Fournisseur' }] })).toContain(
      'Identifiant réservé à la colonne du fournisseur.',
    );
  });
  it('n’accepte qu’une lettre R, A, C ou I par case, sur une activité et un acteur de la matrice', () => {
    const m = base();
    const ok = { activite: 'correctifs', acteur: RACI_ACTEUR_FOURNISSEUR, lettre: 'R' };
    expect(erreurs({ ...m, cases: [ok, { activite: 'correctifs', acteur: 'rssi', lettre: 'A' }] })).toEqual([]);
    expect(erreurs({ ...m, cases: [{ ...ok, lettre: 'X' }] })).not.toEqual([]);
    expect(erreurs({ ...m, cases: [{ ...ok, lettre: 'RA' }] })).not.toEqual([]);
    expect(erreurs({ ...m, cases: [ok, { ...ok, lettre: 'A' }] })).toContain('Une case ne porte qu’une seule lettre.');
    expect(erreurs({ ...m, cases: [{ ...ok, activite: 'inconnue' }] })).toContain('Activité inconnue de la matrice.');
    expect(erreurs({ ...m, cases: [{ ...ok, acteur: 'inconnu' }] })).toContain('Acteur inconnu de la matrice.');
  });
});

describe('règle : exactement un A et au moins un R par activité', () => {
  const m = {
    activites: [
      { id: 'ok', libelle: 'Conforme fictive' },
      { id: 'sans-a', libelle: 'Sans A' },
      { id: 'deux-a', libelle: 'Deux A' },
      { id: 'sans-r', libelle: 'Sans R' },
      { id: 'vide', libelle: 'Vide' },
    ],
    acteurs: [
      { id: 'rssi', libelle: 'RSSI' },
      { id: 'dsi', libelle: 'DSI' },
    ],
    cases: [
      { activite: 'ok', acteur: 'fournisseur', lettre: 'R' as const },
      { activite: 'ok', acteur: 'rssi', lettre: 'A' as const },
      { activite: 'ok', acteur: 'dsi', lettre: 'R' as const },
      { activite: 'sans-a', acteur: 'fournisseur', lettre: 'R' as const },
      { activite: 'deux-a', acteur: 'fournisseur', lettre: 'R' as const },
      { activite: 'deux-a', acteur: 'rssi', lettre: 'A' as const },
      { activite: 'deux-a', acteur: 'dsi', lettre: 'A' as const },
      { activite: 'sans-r', acteur: 'rssi', lettre: 'A' as const },
      { activite: 'sans-r', acteur: 'dsi', lettre: 'C' as const },
      // Case d'un acteur absent de la matrice : ignorée.
      { activite: 'vide', acteur: 'retire', lettre: 'A' as const },
    ],
  };
  it('contrôle chaque activité dans l’ordre et nomme les écarts', () => {
    const c = controleRaci(m);
    expect(c.map((x) => [x.activite, x.a, x.r, x.ecarts])).toEqual([
      ['ok', 1, 2, []],
      ['sans-a', 0, 1, ['aucun_a']],
      ['deux-a', 2, 1, ['plusieurs_a']],
      ['sans-r', 1, 0, ['aucun_r']],
      ['vide', 0, 0, ['aucun_a', 'aucun_r']],
    ]);
    expect(c.map(libelleControleRaci)).toEqual(['Conforme', 'Aucun A', 'Plusieurs A', 'Aucun R', 'Aucun A, Aucun R']);
    expect(activitesARevoirRaci(c).map((x) => x.libelle)).toEqual(['Sans A', 'Deux A', 'Sans R', 'Vide']);
  });
  it('n’empêche pas l’enregistrement : une matrice qui ne respecte pas la règle reste valide', () => {
    // Sans la case de l'acteur retiré (refusée par le contrat), la matrice s'enregistre malgré quatre activités à revoir.
    const valide = { ...m, cases: m.cases.filter((k) => k.acteur !== 'retire') };
    expect(MatriceRaciBody.safeParse(valide).success).toBe(true);
    expect(activitesARevoirRaci(controleRaci(valide))).toHaveLength(4);
    expect(activitesARevoirRaci(controleRaci(base()))).toHaveLength(7);
  });
});
