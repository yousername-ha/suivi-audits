/* Fournisseurs, registre compact Studio (refonte Neon, lot 5, ADR 0093) : teintes des valeurs de suivi, filtres de l'outil
   de suivi, repères d'attention, et rendu du registre avec les en-têtes, textes et noms accessibles des parcours
   existants (colonnes, « 1 répond », « 2 rattaché(s) », boutons Fiche, Évaluer, Historique, Périmètres). */
import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FournisseursStudio, type FournisseursStudioProps } from '../src/pilotage/FournisseursStudio';
import {
  attentionFournisseur,
  detailCritere,
  ecartRattachements,
  filtrerFournisseurs,
  filtrerParNom,
  jourFr,
  libelleReponse,
  resumeCriteresLigne,
  tonCertificats,
  tonChamp,
  tonReponse,
  type CritereRattache,
  type Fournisseur,
} from '../src/pilotage/fournisseurs-types';

const fournisseur = (p: Partial<Fournisseur> = {}): Fournisseur => ({
  id: 'SUP-001',
  name: 'Éditeur fictif',
  saas: true,
  rattachement: '',
  contact: '',
  notes: 'Note fictive',
  sso: 'Oui',
  mfa: 'Non',
  critical: 'Oui',
  hds: 'Oui',
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

describe('teintes des valeurs de suivi', () => {
  it('SSO et MFA : Oui vert, Non rouge, En cours ambre, non renseigné et N/A neutres', () => {
    expect(['Oui', 'Non', 'En cours', '', 'N/A'].map((v) => tonChamp('mfa', v))).toEqual([
      'good',
      'bad',
      'warn',
      'neutral',
      'neutral',
    ]);
  });
  it('criticité Oui en attention, HDS déclaré en bleu : jamais présentés comme un succès', () => {
    expect(tonChamp('critical', 'Oui')).toBe('warn');
    expect(tonChamp('critical', 'Non')).toBe('neutral');
    expect(tonChamp('hds', 'Oui')).toBe('info');
    expect(tonChamp('hds', 'Non')).toBe('neutral');
  });
  it('reprend le niveau des certificats calculé par le serveur', () => {
    expect(['ok', 'mid', 'bad', ''].map(tonCertificats)).toEqual(['good', 'warn', 'bad', 'neutral']);
    expect(jourFr('2027-01-15')).toBe('15/01/2027');
    expect(jourFr(null)).toBe('–');
  });
});

describe('filtres du registre', () => {
  const liste = [
    fournisseur(),
    fournisseur({ id: 'SUP-002', name: 'Hebergeur fictif', saas: false, mfa: 'Oui', critical: '' }),
    fournisseur({
      id: 'SUP-003',
      name: 'Messagerie fictive',
      mfa: 'Oui',
      critical: 'Non',
      controlSummary: { enRetard: 1, aRealiser: 0, nonConformes: 0, total: 1, prochain: '2026-01-01' },
    }),
  ];
  const ids = (l: Fournisseur[]) => l.map((f) => f.id);
  it('garde les situations de l’outil de suivi', () => {
    expect(ids(filtrerFournisseurs(liste, 'all', 'all', ''))).toEqual(['SUP-001', 'SUP-002', 'SUP-003']);
    expect(ids(filtrerFournisseurs(liste, 'nomfa', 'all', ''))).toEqual(['SUP-001']);
    expect(ids(filtrerFournisseurs(liste, 'ctl', 'all', ''))).toEqual(['SUP-003']);
    expect(ids(filtrerFournisseurs(liste, 'crit', 'all', ''))).toEqual(['SUP-001']);
    expect(ids(filtrerFournisseurs(liste, 'all', 'autre', ''))).toEqual(['SUP-002']);
    expect(ids(filtrerFournisseurs(liste, 'all', 'saas', ''))).toEqual(['SUP-001', 'SUP-003']);
  });
  it('cherche par nom sans tenir compte des accents ni de la casse', () => {
    expect(ids(filtrerFournisseurs(liste, 'all', 'all', 'hébergeur'))).toEqual(['SUP-002']);
    expect(ids(filtrerFournisseurs(liste, 'all', 'all', ' EDITEUR '))).toEqual(['SUP-001']);
  });
  it('cherche aussi dans l’identifiant, le rattachement, le contact et les notes (refonte Verre, 27/11/2026)', () => {
    const fiches = [
      fournisseur({ notes: 'Contrat de maintenance fictif' }),
      fournisseur({ id: 'SUP-002', name: 'Hebergeur fictif', rattachement: 'Direction fictive', contact: 'Équipe B' }),
    ];
    expect(ids(filtrerFournisseurs(fiches, 'all', 'all', 'MAINTENANCE'))).toEqual(['SUP-001']);
    expect(ids(filtrerFournisseurs(fiches, 'all', 'all', 'direction'))).toEqual(['SUP-002']);
    expect(ids(filtrerFournisseurs(fiches, 'all', 'all', 'equipe b'))).toEqual(['SUP-002']);
    expect(ids(filtrerFournisseurs(fiches, 'all', 'all', 'sup-002'))).toEqual(['SUP-002']);
  });
  it('signale une ligne à examiner (contrôle, certificat, réévaluation)', () => {
    expect(attentionFournisseur(liste[0]!)).toBe(false);
    expect(attentionFournisseur(liste[2]!)).toBe(true);
    expect(attentionFournisseur(fournisseur({ toReview: true }))).toBe(true);
  });
});

describe('registre compact', () => {
  const evalue = fournisseur({
    current: {
      id: 'e1',
      evaluatedAt: '2026-10-01',
      evaluator: 'Personne fictive',
      nextReviewAt: '2027-10-01',
      items: 1,
      meets: 1,
      notMeets: 0,
      notAssessed: 0,
    },
    scopes: ['p1', 'p2'],
  });
  const props = (p: Partial<FournisseursStudioProps> = {}): FournisseursStudioProps => ({
    tous: [evalue],
    affiches: [evalue],
    chargement: false,
    disponible: true,
    modifier: true,
    recherche: '',
    filtre: 'all',
    type: 'all',
    situations: [{ value: 'all', label: 'Tous' }],
    mfa: { oui: 0, saas: 1, pct: 0 },
    sso: { oui: 1, saas: 1, pct: 100 },
    onRecherche: () => undefined,
    onFiltre: () => undefined,
    onType: () => undefined,
    onCreer: () => undefined,
    onFiche: () => undefined,
    onEvaluer: () => undefined,
    onHistorique: () => undefined,
    onPerimetres: () => undefined,
    cellule: (f, champ) => f[champ],
    ...p,
  });
  const rendu = (p: Partial<FournisseursStudioProps> = {}) =>
    renderToStaticMarkup(createElement(MantineProvider, null, createElement(FournisseursStudio, props(p))));
  it('garde les colonnes de l’outil de suivi dans les en-têtes', () => {
    const html = rendu();
    const entetes = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ' '));
    for (const colonne of [
      'Fournisseur ou application',
      'Type',
      'SSO',
      'MFA',
      'Critique',
      'Hébergeur HDS',
      'Certificats',
      'Contrôles',
      'Prochain',
    ])
      expect(
        entetes.some((t) => t.includes(colonne)),
        colonne,
      ).toBe(true);
  });
  it('donne le résultat de l’évaluation et les rattachements en texte, sans score global', () => {
    const html = rendu();
    expect(html).toContain('1 répond · 0 ne répond pas · 0 non évalué');
    expect(html).toContain('2 rattaché(s)');
    expect(html).toContain('SaaS avec MFA');
    // Le nom du fournisseur n'est écrit qu'une fois dans la ligne (recherche par texte des parcours).
    expect(html.split('Éditeur fictif<').length - 1).toBe(1);
  });
  it('garde les commandes de ligne et leurs noms accessibles, Évaluer réservé à la modification', () => {
    const html = rendu();
    for (const nom of [
      'Fiche du fournisseur Éditeur fictif',
      'Évaluer le fournisseur Éditeur fictif',
      'Historique des évaluations de Éditeur fictif',
      'Périmètres de rattachement de Éditeur fictif',
    ])
      expect(html).toContain(`aria-label="${nom}"`);
    expect(html).toContain('data-fiche-ouvrable="true"');
    expect(html).toContain('Ajouter un fournisseur');
    const lecteur = rendu({ modifier: false });
    expect(lecteur).not.toContain('Évaluer le fournisseur');
    expect(lecteur).not.toContain('Ajouter un fournisseur');
  });
  it('n’affiche pas de zéros quand les données ne sont pas disponibles', () => {
    const html = rendu({ tous: [], affiches: [], disponible: false, chargement: true });
    expect(html).toContain('—');
    expect(html).toContain('Chargement des fournisseurs…');
    expect(html).not.toContain('>0 %<');
    expect(rendu({ mfa: { oui: 0, saas: 0, pct: 0 } })).not.toContain('>0 %<');
    expect(rendu({ tous: [evalue], affiches: [] })).toContain('Aucun fournisseur ne correspond aux filtres.');
  });
  it('signale la non-évaluation par le libellé existant', () => {
    expect(rendu({ tous: [fournisseur()], affiches: [fournisseur()] })).toContain('Non évalué');
  });
});

describe('critères rattachés (ADR 0098)', () => {
  const critere = (
    id: string,
    meets: boolean | null | undefined,
    p: Partial<CritereRattache> = {},
  ): CritereRattache => ({
    id,
    label: `Critère fictif ${id}`,
    archived: false,
    answer: meets === undefined ? null : { meets, evaluatedAt: '2026-10-01', evaluationId: 'e1' },
    ...p,
  });
  it('donne la dernière réponse : Oui, Non, Non évalué (jamais évalué ou sans réponse)', () => {
    expect([true, false, null, undefined].map((m) => libelleReponse(critere('k', m)))).toEqual([
      'Oui',
      'Non',
      'Non évalué',
      'Non évalué',
    ]);
    expect([true, false, null, undefined].map((m) => tonReponse(critere('k', m)))).toEqual([
      'good',
      'bad',
      'neutral',
      'neutral',
    ]);
    expect(detailCritere(critere('k1', true))).toBe('Critère fictif k1 : Oui le 01/10/2026');
    expect(detailCritere(critere('k2', undefined, { archived: true }))).toBe('Critère fictif k2 (retiré) : Non évalué');
  });
  it('résume la ligne sans score : remplis sur le total, non et non évalués', () => {
    expect(resumeCriteresLigne([])).toEqual({ texte: 'Aucun critère rattaché', ton: 'neutral' });
    expect(
      resumeCriteresLigne([
        critere('a', true),
        critere('b', true),
        critere('c', true),
        critere('d', false),
        critere('e', undefined),
      ]),
    ).toEqual({ texte: '3/5 critères remplis · 1 non · 1 non évalué', ton: 'bad' });
    expect(resumeCriteresLigne([critere('a', true)])).toEqual({ texte: '1/1 critère rempli', ton: 'good' });
    expect(resumeCriteresLigne([critere('a', null), critere('b', undefined)])).toEqual({
      texte: '0/2 critères remplis · 2 non évalués',
      ton: 'neutral',
    });
  });
  it('sélection en masse : recherche par nom et écart à enregistrer', () => {
    const liste = [fournisseur(), fournisseur({ id: 'SUP-002', name: 'Hébergeur fictif' })];
    expect(filtrerParNom(liste, ' hebergeur ').map((f) => f.id)).toEqual(['SUP-002']);
    expect(filtrerParNom(liste, '')).toHaveLength(2);
    expect(ecartRattachements(new Set(['SUP-001', 'SUP-003']), new Set(['SUP-003', 'SUP-002']))).toEqual({
      attach: ['SUP-002'],
      detach: ['SUP-001'],
    });
    expect(ecartRattachements(new Set(['SUP-001']), new Set(['SUP-001']))).toEqual({ attach: [], detach: [] });
  });
  it('montre le résumé sur la ligne du registre, et « Aucun critère rattaché » sinon', () => {
    const rendreAvec = (f: Fournisseur) =>
      renderToStaticMarkup(
        createElement(
          MantineProvider,
          null,
          createElement(FournisseursStudio, {
            tous: [f],
            affiches: [f],
            chargement: false,
            disponible: true,
            modifier: false,
            recherche: '',
            filtre: 'all',
            type: 'all',
            situations: [{ value: 'all', label: 'Tous' }],
            mfa: { oui: 0, saas: 1, pct: 0 },
            sso: { oui: 1, saas: 1, pct: 100 },
            onRecherche: () => undefined,
            onFiltre: () => undefined,
            onType: () => undefined,
            onCreer: () => undefined,
            onFiche: () => undefined,
            onEvaluer: () => undefined,
            onHistorique: () => undefined,
            onPerimetres: () => undefined,
            cellule: (x, champ) => x[champ],
          }),
        ),
      );
    const html = rendreAvec(
      fournisseur({ criteria: [critere('a', true), critere('b', false), critere('c', undefined)] }),
    );
    expect(html).toContain('1/3 critères remplis · 1 non · 1 non évalué');
    expect(html).toContain('Critères rattachés');
    expect(rendreAvec(fournisseur())).toContain('Aucun critère rattaché');
  });
});
