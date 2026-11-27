/* Fournisseurs en style « Verre » (dessins validés par le RSSI le 27/11/2026) : liste compacte qui se déplie (une seule
   ligne dépliée à la fois, aria-expanded), accès au format « SSO ✓ · MFA ✕ » avec un texte accessible, résumés calculés
   sur les seuls champs rendus par l'API (évaluation, certificats, contrôles), en-tête et pied de la fiche. Données
   fictives, rendu statique sans réseau ni base. */
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FournisseursStudio, type FournisseursStudioProps } from '../src/pilotage/FournisseursStudio';
import {
  AccesFournisseur,
  ListeFournisseursVerre,
  type ListeFournisseursVerreProps,
} from '../src/pilotage/FournisseursVerre';
import type { Fournisseur } from '../src/pilotage/fournisseurs-types';
import {
  basculerDepli,
  echeanceCertificat,
  etatEvaluation,
  initiales,
  ligneControle,
  ligneEvaluee,
  ligneModificationRaci,
  moisAnnee,
  pucesFiche,
  signeAcces,
  teinteInitiales,
} from '../src/pilotage/fournisseurs-verre';

const html = (n: ReactNode) =>
  renderToStaticMarkup(
    createElement(QueryClientProvider, { client: new QueryClient() }, createElement(MantineProvider, null, n)),
  );
/** Texte lu : balises retirées, entités décodées, blancs réduits. */
const texte = (h: string) =>
  h
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, '’')
    .replace(/\s+/g, ' ');

const fournisseur = (p: Partial<Fournisseur> = {}): Fournisseur => ({
  id: 'SUP-001',
  name: 'Éditeur fictif',
  saas: true,
  rattachement: 'Direction fictive',
  contact: 'contact@exemple.invalid',
  notes: '',
  sso: 'Oui',
  mfa: 'Non',
  critical: 'Oui',
  hds: 'N/A',
  certs: [],
  controls: [],
  certificateState: ['', ''] as unknown as Fournisseur['certificateState'],
  controlSummary: { enRetard: 0, aRealiser: 0, nonConformes: 0, total: 0, prochain: null },
  current: null,
  toReview: false,
  scopes: [],
  criteria: [],
  ...p,
});
const evaluation = (p: Partial<NonNullable<Fournisseur['current']>> = {}): Fournisseur['current'] => ({
  id: 'e1',
  evaluatedAt: '2026-10-03',
  evaluator: 'Personne fictive',
  nextReviewAt: null,
  items: 3,
  meets: 3,
  notMeets: 0,
  notAssessed: 0,
  ...p,
});

describe('une seule ligne dépliée à la fois', () => {
  it('cliquer une ligne la déplie, cliquer une autre la remplace, recliquer la replie', () => {
    expect(basculerDepli(null, 'a')).toBe('a');
    expect(basculerDepli('a', 'b')).toBe('b');
    expect(basculerDepli('b', 'b')).toBeNull();
  });
});

describe('format des accès « SSO ✓ · MFA ✕ » (choix du RSSI)', () => {
  it('coche verte, croix rose, tiret sans objet ; en cours et non renseigné gardent un texte', () => {
    expect(signeAcces('Oui')).toEqual({ signe: '✓', texte: 'oui', ton: 'good' });
    expect(signeAcces('Non')).toEqual({ signe: '✕', texte: 'non', ton: 'bad' });
    expect(signeAcces('N/A')).toEqual({ signe: '—', texte: 'sans objet', ton: 'neutral' });
    expect(signeAcces('En cours')).toEqual({ signe: '…', texte: 'en cours', ton: 'warn' });
    expect(signeAcces('')).toEqual({ signe: '?', texte: 'non renseigné', ton: 'neutral' });
  });
  it('le signe est décoratif, la valeur est dite en toutes lettres', () => {
    // Rendu seul, hors du fournisseur de thème (qui ajoute ses propres règles de style au balisage).
    const h = renderToStaticMarkup(
      <AccesFournisseur
        champs={[
          ['SSO', 'Oui'],
          ['MFA', 'Non'],
          ['HDS', 'N/A'],
        ]}
      />,
    );
    expect(h).toContain('<span aria-hidden="true">✓</span><span class="fs-visually-hidden">oui</span>');
    expect(h).toContain('<span aria-hidden="true">✕</span><span class="fs-visually-hidden">non</span>');
    expect(h).toContain('<span class="fs-visually-hidden">sans objet</span>');
    expect(texte(h)).toBe('SSO ✓oui · MFA ✕non · HDS —sans objet');
  });
});

describe('résumés de la ligne et du détail', () => {
  it('initiales et teinte stables de la pastille', () => {
    expect(initiales('Éditeur fictif')).toBe('ÉF');
    expect(initiales('Prestataire de maintenance fictif')).toBe('PM');
    expect(initiales('X')).toBe('X');
    expect(teinteInitiales('SUP-001')).toBe(teinteInitiales('SUP-001'));
    for (const id of ['SUP-001', 'SUP-002', 'a', 'zz']) expect(teinteInitiales(id)).toBeGreaterThanOrEqual(0);
  });
  it('évaluation courante : décomptes oui / non / non évalué, aucune note', () => {
    expect(etatEvaluation({ current: null, toReview: false })).toEqual({ libelle: 'Non évalué', ton: 'neutral' });
    expect(etatEvaluation({ current: evaluation(), toReview: true }).libelle).toBe('À réévaluer');
    expect(etatEvaluation({ current: evaluation({ meets: 1, notMeets: 2 }), toReview: false })).toEqual({
      libelle: '2 critères non satisfaits',
      ton: 'bad',
    });
    expect(etatEvaluation({ current: evaluation({ meets: 2, notAssessed: 1 }), toReview: false }).libelle).toBe(
      'À compléter',
    );
    expect(etatEvaluation({ current: evaluation(), toReview: false })).toEqual({
      libelle: 'Critères satisfaits',
      ton: 'good',
    });
    expect(moisAnnee('2027-02-15')).toBe('02/2027');
    expect(moisAnnee(null)).toBe('–');
  });
  it('certificat : même seuil de 90 jours que le serveur', () => {
    const jour = '2026-11-27';
    expect(echeanceCertificat({ validUntil: '2026-11-01' }, jour)).toEqual({
      ton: 'bad',
      alerte: 'Expiré : demander le certificat renouvelé.',
    });
    expect(echeanceCertificat({ validUntil: '2027-01-15' }, jour)).toEqual({
      ton: 'warn',
      alerte: 'Expire dans 7 semaines : demander le renouvellement.',
    });
    expect(echeanceCertificat({ validUntil: '2026-12-02' }, jour).alerte).toBe(
      'Expire dans 5 jours : demander le renouvellement.',
    );
    expect(echeanceCertificat({ validUntil: '2027-06-30' }, jour)).toEqual({ ton: 'good', alerte: null });
    expect(echeanceCertificat({}, jour).alerte).toBe('Date de validité à saisir.');
  });
  it('contrôle périodique : état de l’outil de suivi, sinon résultat ou prochaine échéance', () => {
    const jour = '2026-11-27';
    expect(ligneControle({ t: 'Revue fictive', freq: 12 }, jour)).toEqual({
      intitule: 'Revue fictive · 12 mois',
      etat: 'À réaliser',
      ton: 'warn',
    });
    expect(ligneControle({ t: 'Revue fictive', freq: 6, last: '2026-01-10' }, jour).etat).toBe('En retard');
    expect(ligneControle({ t: 'Revue fictive', freq: 12, last: '2026-06-01', result: 'Non conforme' }, jour)).toEqual({
      intitule: 'Revue fictive · 12 mois',
      etat: 'Non conforme',
      ton: 'bad',
    });
    expect(ligneControle({ t: 'Revue fictive', freq: 12, last: '2026-06-01', result: 'Conforme' }, jour).etat).toBe(
      'Conforme',
    );
    expect(ligneControle({ t: 'Revue fictive', freq: 24, last: '2025-12-01' }, jour)).toEqual({
      intitule: 'Revue fictive · 24 mois',
      etat: 'prévu en 12/2027',
      ton: null,
    });
  });
  it('dernière évaluation et en-tête de la fiche', () => {
    expect(ligneEvaluee({ current: evaluation(), scopes: ['p1', 'p2'] })).toBe('Évaluée le 03/10/2026 · 2 périmètres');
    expect(ligneEvaluee({ current: null, scopes: [] })).toBe('Jamais évaluée · aucun périmètre');
    expect(
      pucesFiche({
        critical: 'Oui',
        hds: 'Oui',
        certificateState: ['Expire ≤ 90 j', 'mid'] as Fournisseur['certificateState'],
      }),
    ).toEqual([
      { libelle: 'Critique', ton: 'bad' },
      { libelle: 'Hébergeur HDS', ton: 'info' },
      { libelle: 'Certificat à renouveler', ton: 'warn' },
    ]);
    expect(
      pucesFiche({ critical: 'Non', hds: '', certificateState: ['Valide', 'ok'] as Fournisseur['certificateState'] }),
    ).toEqual([]);
  });
  it('pied de la fiche : auteur et date de la matrice RACI, heure de Paris', () => {
    expect(ligneModificationRaci(null)).toBeNull();
    expect(ligneModificationRaci({ misAJourPar: 'personne.fictive', misAJourLe: '2026-11-27T09:05:00.000Z' })).toBe(
      'Matrice RACI modifiée par personne.fictive le 27/11/2026 à 10:05',
    );
  });
});

describe('liste compacte qui se déplie', () => {
  const a = fournisseur({
    current: evaluation({ meets: 2, notMeets: 1 }),
    scopes: ['p1'],
    certs: [{ type: 'ISO 27001', validUntil: '2027-01-15', received: '2026-01-20', scope: 'Hébergement fictif' }],
    controls: [{ id: 'c1', t: 'Revue fictive', freq: 12, last: '2026-06-01', result: 'Conforme' }],
    controlSummary: { enRetard: 0, aRealiser: 0, nonConformes: 0, total: 1, prochain: '2027-06-01' },
  });
  const b = fournisseur({ id: 'SUP-002', name: 'Hébergeur fictif', sso: 'N/A', mfa: 'Oui', critical: '', hds: 'Oui' });
  const props = (p: Partial<ListeFournisseursVerreProps> = {}): ListeFournisseursVerreProps => ({
    affiches: [a, b],
    modifier: true,
    recherche: '',
    aujourdhui: '2026-11-27',
    onFiche: () => undefined,
    onEvaluer: () => undefined,
    onHistorique: () => undefined,
    onPerimetres: () => undefined,
    onRaci: () => undefined,
    cellule: (f, champ) => <span data-champ={champ}>{f[champ]}</span>,
    ...p,
  });
  it('repliée par défaut : colonnes compactes, aucun détail, chevrons nommés', () => {
    const h = html(<ListeFournisseursVerre {...props()} />);
    const entetes = [...h.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => texte(m[1]!));
    expect(entetes).toEqual([
      'Fournisseur ou application',
      'Accès',
      'Criticité',
      'Évaluation courante',
      'Prochain contrôle',
      'Déplier',
    ]);
    expect(h).not.toContain('fsv-detail');
    expect(h.match(/aria-expanded="false"/g)).toHaveLength(4);
    expect(h).toContain('aria-label="Déplier Éditeur fictif"');
    expect(h).toContain('aria-label="Déplier Hébergeur fictif"');
    expect(texte(h)).toContain('1 critère non satisfait');
    expect(texte(h)).toContain('06/2027');
  });
  it('une ligne dépliée : un seul détail, relié à son chevron, avec les commandes de la ligne', () => {
    const h = html(<ListeFournisseursVerre {...props({ ouvertInitial: 'SUP-001' })} />);
    expect(h.match(/class="[^"]*fsv-detail"/g)).toHaveLength(1);
    expect(h.match(/aria-expanded="true"/g)).toHaveLength(2);
    expect(h).toContain('aria-label="Replier Éditeur fictif"');
    expect(h).toMatch(/aria-controls="fsv-detail-0"/);
    expect(h).toContain('id="fsv-detail-0"');
    const t = texte(h);
    for (const attendu of [
      'Accès et rattachement',
      'Rattachement : Direction fictive',
      'contact@exemple.invalid',
      'ISO 27001',
      'jusqu’au 15/01/2027',
      'Expire dans 7 semaines : demander le renouvellement.',
      'Reçu le 20/01/2026 · périmètre : Hébergement fictif',
      'Revue fictive · 12 mois',
      '2 / 3',
      'critères satisfaits',
      'Évaluée le 03/10/2026 · 1 périmètre',
    ])
      expect(t, attendu).toContain(attendu);
    for (const nom of [
      'Ouvrir la fiche de Éditeur fictif',
      'Nouvelle évaluation de Éditeur fictif',
      'Qui décide quoi pour Éditeur fictif',
      'Historique des évaluations de Éditeur fictif',
      'Périmètres de rattachement de Éditeur fictif',
      'Modifier le suivi de Éditeur fictif',
    ])
      expect(h, nom).toContain(`aria-label="${nom}"`);
    // Édition directe de SSO, MFA, criticité et HDS : gardée dans le détail.
    for (const champ of ['sso', 'mfa', 'critical', 'hds']) expect(h).toContain(`data-champ="${champ}"`);
  });
  it('sans le droit de modifier : ni nouvelle évaluation ni édition directe', () => {
    const h = html(<ListeFournisseursVerre {...props({ ouvertInitial: 'SUP-001', modifier: false })} />);
    expect(h).not.toContain('Nouvelle évaluation');
    expect(h).not.toContain('Modifier le suivi');
    expect(h).toContain('aria-label="Qui décide quoi pour Éditeur fictif"');
  });
});

describe('registre en style « Verre »', () => {
  const f = fournisseur();
  const props = (p: Partial<FournisseursStudioProps> = {}): FournisseursStudioProps => ({
    tous: [f],
    affiches: [f],
    chargement: false,
    disponible: true,
    modifier: true,
    recherche: '',
    filtre: 'all',
    type: 'all',
    situations: [{ value: 'all', label: 'Tous' }],
    mfa: { oui: 11, saas: 14, pct: 79 },
    sso: { oui: 8, saas: 14, pct: 57 },
    onRecherche: () => undefined,
    onFiltre: () => undefined,
    onType: () => undefined,
    onCreer: () => undefined,
    onFiche: () => undefined,
    onEvaluer: () => undefined,
    onHistorique: () => undefined,
    onPerimetres: () => undefined,
    cellule: (x, champ) => x[champ],
    ...p,
  });
  it('tuiles en « oui / services SaaS » et liste qui se déplie à la place du tableau', () => {
    const h = html(<FournisseursStudio {...props({ verre: true })} />);
    const t = texte(h);
    expect(t).toContain('11 / 14');
    expect(t).toContain('3 sans MFA confirmée');
    expect(t).toContain('8 / 14');
    expect(t).toContain('6 sans SSO confirmé');
    expect(t).toContain('Cliquez sur une ligne pour la déplier.');
    expect(h).toContain('fsv-table');
    expect(h).not.toContain('fs-table');
    expect(h).not.toContain('Vue détaillée');
  });
  it('hors du style « Verre », le registre compact reste inchangé', () => {
    const h = html(<FournisseursStudio {...props()} />);
    expect(h).toContain('fs-table');
    expect(h).not.toContain('fsv-table');
    expect(texte(h)).toContain('79 %');
  });
});

describe('branchement sur le style d’instance', () => {
  const lire = (f: string) => readFileSync(new URL(`../src/pilotage/${f}`, import.meta.url), 'utf8');
  it('la liste, la fiche du fournisseur et la fenêtre de l’indicateur suivent le style « Verre »', () => {
    expect(lire('Fournisseurs.tsx')).toContain("verre = useMe().appearance.style === 'verre'");
    expect(lire('FichesObjectifs.tsx')).toContain("const verre = useMe().appearance.style === 'verre';");
    // Les fenêtres à onglets gardent leur défilement : pas de découpage en parties par-dessus les onglets.
    expect(lire('Fournisseurs.tsx')).toContain("'fsv-fiche-fenetre fiche-defilement'");
    expect(lire('FicheIndicateurVerre.tsx')).toContain("'objectifs-fiche indv-fenetre fiche-defilement'");
  });
});
