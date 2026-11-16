/* Module Vulnérabilités (ADR 0100, point 8, V21 ; lot V4a) : comparaison de versions sûre, position dans une plage,
   normalisation des noms, identifiant CPE, classement d'un rapprochement et transitions (rejet non reproposé, confirmation
   remise en jeu). Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  classerRapprochement,
  comparerVersions,
  composantesCpe,
  cpeDepuisIdentite,
  CPE_23,
  DecisionRapprochement,
  type EtatRapprochement,
  identiteCpe,
  MOTIF_PROPOSITION_LIBELLES,
  MOTIFS_PROPOSITION,
  normaliserNom,
  type PlageVersions,
  positionDansPlage,
  positionSurPlages,
  segmentsVersion,
  STATUT_RAPPROCHEMENT_LIBELLES,
  STATUTS_RAPPROCHEMENT,
  SuggestionsCpeQuery,
  transitionRapprochement,
} from '../src/index.js';

const plage = (p: Partial<PlageVersions> = {}): PlageVersions => ({
  version: null,
  debutInclus: null,
  debutExclus: null,
  finInclus: null,
  finExclus: null,
  ...p,
});

describe('comparaison de versions sûre', () => {
  it('segments numériques séparés par des points, préfixe « v » toléré', () => {
    expect(segmentsVersion('10.1.2')).toEqual([10, 1, 2]);
    expect(segmentsVersion('v2.4')).toEqual([2, 4]);
    expect(segmentsVersion('V3')).toEqual([3]);
    expect(segmentsVersion('1.02')).toEqual([1, 2]);
  });

  it('toute autre forme est refusée (lettres, suffixes, dates, jokers, espaces, vide, trop long)', () => {
    for (const v of [
      '',
      ' ',
      '1.2.3-rc1',
      '1.2.3rc1',
      '1.2.3a',
      '2024-05-01',
      '1.2.*',
      '*',
      '-',
      '1..2',
      '.1',
      '1.',
      'vv1',
      'v',
      ' 1.2',
      '1.2 ',
      '1,2',
      '1.2.3.4.5.6.7.8.9.10.11',
      '1234567890',
      'x1.2',
      '１.２',
    ])
      expect(segmentsVersion(v), JSON.stringify(v)).toBeNull();
  });

  it('ordre numérique segment par segment, segments manquants à zéro', () => {
    expect(comparerVersions('10.1.2', '10.1.10')).toBe(-1);
    expect(comparerVersions('10.10', '10.9.9')).toBe(1);
    expect(comparerVersions('1.2', '1.2.0')).toBe(0);
    expect(comparerVersions('1.2.0.0', '1.2')).toBe(0);
    expect(comparerVersions('v1.2', '1.2')).toBe(0);
    expect(comparerVersions('1.02', '1.2')).toBe(0);
    expect(comparerVersions('2', '10')).toBe(-1);
    expect(comparerVersions('999999999.1', '999999999.0')).toBe(1);
  });

  it('une version non comparable rend null, jamais un ordre deviné', () => {
    expect(comparerVersions('1.2.3-rc1', '1.2.3')).toBeNull();
    expect(comparerVersions('1.2.3', '1.2.3-rc1')).toBeNull();
    expect(comparerVersions('2024-05-01', '2024-06-01')).toBeNull();
    expect(comparerVersions('*', '1')).toBeNull();
  });
});

describe('position dans une plage', () => {
  it('version exacte : égalité', () => {
    expect(positionDansPlage('2.0', plage({ version: '2.0.0' }))).toEqual({ resultat: 'dans' });
    expect(positionDansPlage('2.1', plage({ version: '2.0' }))).toEqual({ resultat: 'hors' });
    expect(positionDansPlage('2.0', plage({ version: '2.0-beta' }))).toEqual({
      resultat: 'incertain',
      motif: 'non_comparable',
    });
  });

  it('bornes incluses et exclues, de chaque côté, seules ou ensemble', () => {
    const p = plage({ debutInclus: '10.0', finExclus: '10.1.5' });
    expect(positionDansPlage('10.0', p).resultat).toBe('dans');
    expect(positionDansPlage('10.1.4', p).resultat).toBe('dans');
    expect(positionDansPlage('10.1.5', p).resultat).toBe('hors');
    expect(positionDansPlage('9.9', p).resultat).toBe('hors');
    const q = plage({ debutExclus: '1.0', finInclus: '2.0' });
    expect(positionDansPlage('1.0', q).resultat).toBe('hors');
    expect(positionDansPlage('1.0.1', q).resultat).toBe('dans');
    expect(positionDansPlage('2.0', q).resultat).toBe('dans');
    expect(positionDansPlage('2.0.1', q).resultat).toBe('hors');
    // Une seule borne publiée : plage ouverte d'un côté, mais bornée.
    expect(positionDansPlage('3.9', plage({ finExclus: '4.0' })).resultat).toBe('dans');
    expect(positionDansPlage('4.0', plage({ debutInclus: '4.0' })).resultat).toBe('dans');
    expect(positionDansPlage('3.9', plage({ debutInclus: '4.0' })).resultat).toBe('hors');
  });

  it('aucune plage (« * » sans borne), borne ou version non comparable, forme mêlée : incertain', () => {
    expect(positionDansPlage('1.0', plage())).toEqual({ resultat: 'incertain', motif: 'sans_plage' });
    expect(positionDansPlage('1.0', plage({ finExclus: '1.5-rc1' }))).toEqual({
      resultat: 'incertain',
      motif: 'non_comparable',
    });
    expect(positionDansPlage('1.0b', plage({ finExclus: '2.0' }))).toEqual({
      resultat: 'incertain',
      motif: 'non_comparable',
    });
    // Une borne non comparable rend incertain même si une autre borne exclut déjà la version.
    expect(positionDansPlage('0.5', plage({ debutInclus: '1.0', finExclus: 'beta' }))).toEqual({
      resultat: 'incertain',
      motif: 'non_comparable',
    });
    expect(positionDansPlage('1.0', plage({ version: '1.0', finExclus: '2.0' }))).toEqual({
      resultat: 'incertain',
      motif: 'non_comparable',
    });
  });

  it('plusieurs plages : dans l’une suffit, une incertaine empêche « hors », aucune plage : incertain', () => {
    const a = plage({ debutInclus: '1.0', finExclus: '1.5' });
    const b = plage({ debutInclus: '2.0', finExclus: '2.3' });
    expect(positionSurPlages('2.1', [a, b])).toEqual({ resultat: 'dans' });
    expect(positionSurPlages('1.7', [a, b])).toEqual({ resultat: 'hors' });
    expect(positionSurPlages('1.7', [a, plage({ finExclus: 'x' })])).toEqual({
      resultat: 'incertain',
      motif: 'non_comparable',
    });
    expect(positionSurPlages('1.7', [a, plage()])).toEqual({ resultat: 'incertain', motif: 'sans_plage' });
    expect(positionSurPlages('1.2', [a, plage({ finExclus: 'x' })])).toEqual({ resultat: 'dans' });
    expect(positionSurPlages('1.2', [])).toEqual({ resultat: 'incertain', motif: 'sans_plage' });
  });
});

describe('noms et identifiant CPE', () => {
  it('normalisation : minuscules, accents retirés, séparateurs réduits à « _ »', () => {
    expect(normaliserNom('Éditeur  Fictif')).toBe('editeur_fictif');
    expect(normaliserNom('HTTP Server')).toBe('http_server');
    expect(normaliserNom(' Gestionnaire-Fictif ')).toBe('gestionnaire_fictif');
    expect(normaliserNom("Teclib'")).toBe('teclib');
    expect(normaliserNom('http_server')).toBe('http_server');
    expect(normaliserNom('---')).toBe('');
  });

  it('composantes lues avec leurs échappements ; identité : partie, éditeur, produit en minuscules', () => {
    expect(composantesCpe('cpe:2.3:a:editeur:produit\\:fictif:1.0:*:*:*:*:*:*:*').slice(0, 6)).toEqual([
      'cpe',
      '2.3',
      'a',
      'editeur',
      'produit:fictif',
      '1.0',
    ]);
    expect(identiteCpe('cpe:2.3:o:Editeur_Fictif:Systeme_Fictif:10:*:*:*:*:*:*:*')).toEqual({
      partie: 'o',
      editeur: 'editeur_fictif',
      produit: 'systeme_fictif',
    });
    expect(identiteCpe(null)).toBeNull();
    expect(identiteCpe('cpe:2.3:*:editeur:produit:*:*:*:*:*:*:*:*')).toBeNull();
    expect(identiteCpe('cpe:2.3:a:*:produit:*:*:*:*:*:*:*:*')).toBeNull();
    expect(identiteCpe('cpe:2.3:a:editeur:-:*:*:*:*:*:*:*:*')).toBeNull();
    expect(identiteCpe('cpe:/a:editeur:produit')).toBeNull();
  });

  it('identifiant composé à partir d’un couple : version en « * », caractères spéciaux échappés, forme CPE 2.3', () => {
    const cpe = cpeDepuisIdentite({ partie: 'a', editeur: 'editeur_fictif', produit: 'produit:fictif!' });
    expect(cpe).toBe('cpe:2.3:a:editeur_fictif:produit\\:fictif\\!:*:*:*:*:*:*:*:*');
    expect(CPE_23.test(cpe)).toBe(true);
    expect(identiteCpe(cpe)).toEqual({ partie: 'a', editeur: 'editeur_fictif', produit: 'produit:fictif!' });
  });
});

describe('classement d’un rapprochement (règle du point 8)', () => {
  const dans = [plage({ finExclus: '10.1.5' })];
  const hors = [plage({ finExclus: '9.0' })];
  it('par identifiant : d’office si dans la plage, écartée si hors', () => {
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: true, plages: dans, tronque: false }),
    ).toEqual({ calcul: 'office' });
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: true, plages: hors, tronque: false }),
    ).toEqual({ calcul: 'ecartee' });
  });

  it('proposée : aucune plage, version non comparable, liste tronquée (jamais écartée)', () => {
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: true, plages: [plage()], tronque: false }),
    ).toEqual({ calcul: 'proposee', motif: 'sans_plage', versionDansPlage: 'inconnu' });
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: true, plages: [], tronque: false }),
    ).toEqual({
      calcul: 'proposee',
      motif: 'sans_plage',
      versionDansPlage: 'inconnu',
    });
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2-rc1', parIdentifiant: true, plages: dans, tronque: false }),
    ).toEqual({ calcul: 'proposee', motif: 'non_comparable', versionDansPlage: 'inconnu' });
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: true, plages: hors, tronque: true }),
    ).toEqual({ calcul: 'proposee', motif: 'donnees_tronquees', versionDansPlage: 'non' });
    // Liste tronquée mais version dans une plage gardée : rattachée d'office.
    expect(
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: true, plages: dans, tronque: true }),
    ).toEqual({ calcul: 'office' });
  });

  it('par nom seulement : toujours proposée, avec la position de la version', () => {
    const nom = (plages: PlageVersions[]) =>
      classerRapprochement({ versionDeclaree: '10.1.2', parIdentifiant: false, plages, tronque: false });
    expect(nom(dans)).toEqual({ calcul: 'proposee', motif: 'nom_seulement', versionDansPlage: 'oui' });
    expect(nom(hors)).toEqual({ calcul: 'proposee', motif: 'nom_seulement', versionDansPlage: 'non' });
    expect(nom([plage()])).toEqual({ calcul: 'proposee', motif: 'nom_seulement', versionDansPlage: 'inconnu' });
  });

  it('libellés : un par motif et par statut ; décision et recherche contrôlées', () => {
    expect(Object.keys(MOTIF_PROPOSITION_LIBELLES)).toEqual([...MOTIFS_PROPOSITION]);
    expect(MOTIF_PROPOSITION_LIBELLES.nom_seulement).toBe('Nom seulement');
    expect(MOTIF_PROPOSITION_LIBELLES.sans_plage).toBe('Aucune plage publiée');
    expect(MOTIF_PROPOSITION_LIBELLES.non_comparable).toBe('Version non comparable');
    expect(Object.keys(STATUT_RAPPROCHEMENT_LIBELLES)).toEqual([...STATUTS_RAPPROCHEMENT]);
    expect(DecisionRapprochement.parse({ decision: 'rejeter' })).toEqual({ decision: 'rejeter', note: '' });
    expect(DecisionRapprochement.safeParse({ decision: 'rejeter', note: 'a\u0007b' }).success).toBe(false);
    expect(DecisionRapprochement.safeParse({ decision: 'oublier' }).success).toBe(false);
    expect(DecisionRapprochement.safeParse({ decision: 'confirmer', note: 'x'.repeat(1001) }).success).toBe(false);
    expect(SuggestionsCpeQuery.safeParse({ nom: 'g' }).success).toBe(false);
    expect(SuggestionsCpeQuery.safeParse({ nom: 'gl', autre: 1 }).success).toBe(false);
  });
});

describe('transitions au recalcul', () => {
  const actuel = { empreinteProduit: 'p1', empreinteCve: 'c1', versionProduit: '10.1.2' };
  const etat = (statut: EtatRapprochement['statut'], extra: Partial<EtatRapprochement> = {}): EtatRapprochement => ({
    statut,
    empreinteProduit: 'p1',
    empreinteCve: 'c1',
    versionDecidee: null,
    ...extra,
  });
  const proposee = { calcul: 'proposee', motif: 'sans_plage', versionDansPlage: 'inconnu' } as const;

  it('création au statut calculé ; rien si aucune correspondance', () => {
    expect(transitionRapprochement(null, { calcul: 'office' }, actuel)).toEqual({
      statut: 'rattachee',
      garderDecision: false,
    });
    expect(transitionRapprochement(null, { calcul: 'ecartee' }, actuel)?.statut).toBe('ecartee');
    expect(transitionRapprochement(null, proposee, actuel)?.statut).toBe('proposee');
    expect(transitionRapprochement(null, null, actuel)).toBeNull();
  });

  it('rejet gardé à données égales, reproposé si le produit ou la CVE change', () => {
    expect(transitionRapprochement(etat('rejetee'), proposee, actuel)).toEqual({
      statut: 'rejetee',
      garderDecision: true,
    });
    expect(transitionRapprochement(etat('rejetee'), null, actuel)?.statut).toBe('rejetee');
    expect(transitionRapprochement(etat('rejetee'), proposee, { ...actuel, empreinteCve: 'c2' })).toEqual({
      statut: 'proposee',
      garderDecision: false,
    });
    expect(
      transitionRapprochement(etat('rejetee'), { calcul: 'office' }, { ...actuel, empreinteProduit: 'p2' }),
    ).toEqual({ statut: 'rattachee', garderDecision: false });
  });

  it('confirmation gardée tant que la version décidée est celle du produit, même si la CVE change', () => {
    const c = etat('confirmee', { versionDecidee: '10.1.2' });
    expect(transitionRapprochement(c, proposee, { ...actuel, empreinteCve: 'c9' })).toEqual({
      statut: 'confirmee',
      garderDecision: true,
    });
    expect(transitionRapprochement(c, proposee, { ...actuel, versionProduit: '10.1.3' })).toEqual({
      statut: 'proposee',
      garderDecision: false,
    });
    expect(transitionRapprochement(c, { calcul: 'ecartee' }, { ...actuel, versionProduit: '10.1.3' })?.statut).toBe(
      'ecartee',
    );
  });

  it('statuts calculés suivis ; correspondance disparue : retirée ; rejouable à l’identique', () => {
    expect(transitionRapprochement(etat('proposee'), { calcul: 'office' }, actuel)?.statut).toBe('rattachee');
    expect(transitionRapprochement(etat('rattachee'), null, actuel)?.statut).toBe('retiree');
    expect(transitionRapprochement(etat('retiree'), proposee, actuel)?.statut).toBe('proposee');
    const a = transitionRapprochement(etat('ecartee'), proposee, actuel);
    expect(transitionRapprochement(etat('ecartee'), proposee, actuel)).toEqual(a);
  });
});
