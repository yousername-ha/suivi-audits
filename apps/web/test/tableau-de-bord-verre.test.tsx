/* Tableau de bord du style « Verre » (dessin validé, décision du RSSI du 27/11/2026) : calculs purs (cases d'actions
   bornées, grille des risques, mois des incidents, constats par nature), liens de navigation de chaque élément et rendu
   accessible (bulle reliée par aria-describedby, aucun lien en mode modification). Données fictives, rendu statique sans
   réseau ni base. */
import { MantineProvider } from '@mantine/core';
import type { Action, EtatActionTdb, GrilleRisques, Module, PlanActions, Synthese } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dallesNeon, type DonneesNeon } from '../src/components/tdb-neon';
import { ConstatsVerre, PlanActionVerre, RisquesVerre } from '../src/components/tdb-verre';
import {
  CAPACITE_ACTIONS,
  casesActions,
  constatsParNature,
  detailAction,
  lienAction,
  lienIncident,
  lienNatureConstat,
  lienReferentiel,
  lienRisque,
  moisIncidents,
  rangeesGrille,
  teinteNiveau,
  vueRisques,
} from '../src/components/tdb-verre-calculs';

const { permissions } = vi.hoisted(() => ({ permissions: new Set<string>() }));
vi.mock('../src/session', () => ({
  useCan: () => (m: Module, a: Action) => permissions.has(`${m}:${a}`),
}));
beforeEach(() => {
  permissions.clear();
  for (const p of ['ecarts:lire', 'pilotage:lire', 'audit:lire', 'incidents:lire']) permissions.add(p);
});

const P = '11111111-1111-4111-8111-111111111111';
const html = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, n)));
const decode = (h: string) => h.replace(/&amp;/g, '&');
/** Liens d'un rendu : attributs de chaque balise <a>, quel que soit leur ordre, et contenu. */
const liensDe = (h: string) =>
  [...h.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributs, contenu]) => ({
    ...Object.fromEntries([...attributs!.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!])),
    contenu: contenu!,
  })) as Record<string, string>[];

/** Groupes d'actions fictives, dans l'ordre d'urgence renvoyé par le serveur : en retard (à faire), prioritaires (en
    cours), à faire, en cours, planifiées, terminées. */
const GROUPES = {
  retard: { etat: 'a_faire', retard: true, prioritaire: false, echeance: '2026-11-20' },
  prioritaire: { etat: 'en_cours', retard: false, prioritaire: true, echeance: '2026-12-15' },
  a_faire: { etat: 'a_faire', retard: false, prioritaire: false, echeance: '2026-11-30' },
  en_cours: { etat: 'en_cours', retard: false, prioritaire: false, echeance: '2026-12-31' },
  planifiee: { etat: 'planifiee', retard: false, prioritaire: false, echeance: '2027-01-31' },
  terminee: { etat: 'terminee', retard: false, prioritaire: false, echeance: null },
} as const;
type Groupe = keyof typeof GROUPES;

/** Actions fictives : `n` par groupe ; `total` au-delà des actions détaillées (décomptes exacts du serveur). */
function plan(n: Partial<Record<Groupe, number>>, total?: number): PlanActions {
  const items = (Object.keys(GROUPES) as Groupe[]).flatMap((g) =>
    Array.from({ length: n[g] ?? 0 }, (_, i) => ({
      id: `${g}-${i}`,
      perimetre: P,
      nom: `Action fictive ${g} ${i}`,
      ...GROUPES[g],
    })),
  );
  const nb = (f: (x: PlanActions['items'][number]) => boolean) => items.filter(f).length;
  return {
    total: total ?? items.length,
    aFaire: nb((x) => x.etat === 'a_faire'),
    enCours: nb((x) => x.etat === 'en_cours'),
    planifiees: nb((x) => x.etat === 'planifiee'),
    terminees: nb((x) => x.etat === 'terminee'),
    enRetard: nb((x) => x.retard),
    prioritaires: nb((x) => x.prioritaire),
    items,
  };
}

const grille: GrilleRisques = {
  methode: 'Méthode fictive',
  base: 'residual',
  axe: 'Gravité',
  colonnes: ['Mineure', 'Grave'],
  lignes: ['Peu probable', 'Probable'],
  niveaux: ['Faible', 'Modéré', 'Élevé'],
  cases: [
    { colonne: 0, ligne: 0, niveau: 0, n: 0, risques: [] },
    {
      colonne: 1,
      ligne: 0,
      niveau: 1,
      n: 1,
      risques: [{ id: 'r-seul', perimetre: P, nom: 'Risque fictif seul', code: 'R1' }],
    },
    {
      colonne: 0,
      ligne: 1,
      niveau: 1,
      n: 2,
      risques: [
        { id: 'r-a', perimetre: P, nom: 'Risque fictif A', code: 'R2' },
        { id: 'r-b', perimetre: P, nom: 'Risque fictif B', code: 'R3' },
      ],
    },
    { colonne: 1, ligne: 1, niveau: 2, n: 0, risques: [] },
  ],
  places: 3,
  horsGrille: 0,
};

const synthese = (x: Partial<Synthese> = {}): Synthese => ({
  organisation: 'Organisation fictive',
  genereLe: '2026-11-27T10:00:00.000Z',
  prochainAudit: null,
  auditInterne: null,
  ecarts: {
    total: 6,
    ouverts: 5,
    enRetard: 1,
    aEcheance: 0,
    parStatut: {},
    parType: {},
    parSource: {},
  },
  echeances: [],
  plan: null,
  mesures: null,
  conformite: [
    {
      ref: 'ISO',
      libelle: 'Clauses ISO 27001',
      exigences: 10,
      applicables: 10,
      total: 8,
      partiel: 2,
      insuffisant: 0,
      nonRenseigne: 0,
    },
    {
      ref: 'A',
      libelle: 'Annexe A',
      exigences: 10,
      applicables: 9,
      total: 3,
      partiel: 3,
      insuffisant: 3,
      nonRenseigne: 0,
    },
    { ref: 'HDS', libelle: 'HDS', exigences: 5, applicables: 5, total: 0, partiel: 0, insuffisant: 0, nonRenseigne: 5 },
  ],
  ecartsOuverts: {
    ouverts: 5,
    parType: [
      { type: 'NC maj', libelle: 'NC majeure', n: 1 },
      { type: 'NC min', libelle: 'NC mineure', n: 2 },
      { type: 'PS', libelle: 'Point sensible', n: 0 },
      { type: 'PP', libelle: 'Piste de progrès', n: 0 },
      { type: 'Remarque', libelle: 'Remarque', n: 2 },
    ],
    actionsRealisees: 0,
    actionsTotal: 3,
  },
  indicateurs: { total: 4, atteints: 2, nonAtteints: 1, nonMesures: 1 },
  plans: null,
  actions: { total: 3, ouvertes: 2, enRetard: 1, terminees: 1 },
  recurrences: null,
  risques: { total: 4, sansDecision: 1, revueEchue: 1 },
  continuite: null,
  incidents: { total: 2, ouverts: 1, securiteOuverts: 1 },
  pilotage: null,
  detailRisques: { aApprecier: 1, critiques: 0, grille },
  planActions: plan({ retard: 1, a_faire: 1, terminee: 1 }),
  ...x,
});

describe('liens de navigation des éléments du tableau de bord', () => {
  it('fiches ouvertes dans leur périmètre, retour à l’accueil', () => {
    const risque = new URL(lienRisque(P, 'r1'), 'http://x');
    expect(risque.pathname).toBe('/pilotage/risques');
    expect(Object.fromEntries(risque.searchParams)).toEqual({ perimetre: P, ouvrir: 'r1', retour: '/' });
    const action = new URL(lienAction(P, 'a1'), 'http://x');
    expect(action.pathname).toBe('/pilotage/actions');
    expect(Object.fromEntries(action.searchParams)).toEqual({ perimetre: P, ouvrir: 'a1', retour: '/' });
    const incident = new URL(lienIncident(P, 'INC-2026-001'), 'http://x');
    expect(incident.pathname).toBe('/pilotage/incidents-registre');
    expect(Object.fromEntries(incident.searchParams)).toEqual({ perimetre: P, incident: 'INC-2026-001' });
    // Sans périmètre (incident historique) : le périmètre commun.
    expect(lienIncident('', 'INC-1')).toContain('perimetre=00000000-0000-4000-8000-000000000001');
  });
  it('pages filtrées : constats par nature, déclaration d’applicabilité du référentiel', () => {
    expect(lienNatureConstat('piste')).toBe('/pilotage/amelioration?nature=piste');
    expect(lienReferentiel('ISO')).toBe('/pilotage/dda-iso');
    expect(lienReferentiel('A')).toBe('/pilotage/dda-annexe-a');
    expect(lienReferentiel('HDS')).toBe('/pilotage/dda-hds');
    expect(lienReferentiel('AUTRE')).toBe('/pilotage/mesures');
  });
});

describe('plan d’action : une case par action, bornée', () => {
  it('toutes les actions quand elles tiennent, chacune liée à sa fiche', () => {
    const c = casesActions(
      plan({ retard: 2, prioritaire: 1, a_faire: 2, en_cours: 1, planifiee: 1, terminee: 3 }),
      null,
    )!;
    expect(c.cases).toHaveLength(10);
    expect(c.reste).toBe(0);
    expect(c.cases.map((x) => [x.etat, x.retard, x.prioritaire]).slice(0, 4)).toEqual([
      ['a_faire', true, false],
      ['a_faire', true, false],
      ['en_cours', false, true],
      ['a_faire', false, false],
    ]);
    expect(c.cases[0]!.lien).toBe(lienAction(P, 'retard-0'));
    expect([c.aFaire, c.enCours, c.planifiees, c.terminees, c.enRetard, c.prioritaires, c.total]).toEqual([
      4, 2, 1, 3, 2, 1, 10,
    ]);
  });
  it('au-delà de la capacité : les plus urgentes d’abord, puis « + N autres » sur deux emplacements', () => {
    const p = plan({ retard: 5, prioritaire: 10, a_faire: 40, terminee: 5 }, 120);
    const c = casesActions(p, null)!;
    expect(c.cases).toHaveLength(CAPACITE_ACTIONS - 2);
    expect(c.reste).toBe(120 - (CAPACITE_ACTIONS - 2));
    expect(c.cases.every((x, i) => i < 5 === x.retard)).toBe(true);
    expect(c.cases.every((x, i) => (i >= 5 && i < 15) === x.prioritaire)).toBe(true);
    expect(c.cases.some((x) => x.etat === 'terminee')).toBe(false);
    // Exactement la capacité : pas de case « autres ».
    expect(casesActions(plan({ a_faire: CAPACITE_ACTIONS }), null)!.reste).toBe(0);
  });
  it('sans détail (chiffres ouverts d’un auteur) : cases tirées des seuls décomptes, sans intitulé ni lien', () => {
    const c = casesActions(null, { total: 6, ouvertes: 4, enRetard: 1, terminees: 2 })!;
    expect(c.cases.map((x) => [x.etat, x.retard])).toEqual([
      ['a_faire', true],
      ['a_faire', false],
      ['a_faire', false],
      ['a_faire', false],
      ['terminee', false],
      ['terminee', false],
    ]);
    expect(c.cases.every((x) => x.lien === null && x.nom === null && !x.prioritaire)).toBe(true);
    // Ouvertes à faire ; en cours, planifiées et prioritaires inconnues (non inventées).
    expect([c.aFaire, c.enCours, c.planifiees, c.terminees, c.enRetard, c.prioritaires]).toEqual([
      4,
      null,
      null,
      2,
      1,
      null,
    ]);
    expect(casesActions(null, null)).toBeNull();
  });
  it('bulle : état, « en retard » et « priorité haute » s’il y a lieu, échéance', () => {
    const d = (etat: EtatActionTdb, echeance: string | null, retard = false, prioritaire = false) =>
      detailAction({ etat, echeance, retard, prioritaire });
    expect(d('a_faire', '2026-11-11', true)).toBe('À faire · en retard · échéance le 11/11/2026');
    expect(d('en_cours', '2026-11-11', true, true)).toBe(
      'En cours · en retard · priorité haute · échéance le 11/11/2026',
    );
    expect(d('planifiee', '2027-01-31T08:00:00.000Z', false, true)).toBe(
      'Planifiée · priorité haute · échéance le 31/01/2027',
    );
    expect(d('a_faire', null)).toBe('À faire · sans échéance');
    expect(d('terminee', null)).toBe('Terminée');
  });
});

describe('grille des risques', () => {
  it('vraisemblance décroissante de haut en bas, gravité croissante de gauche à droite', () => {
    const r = rangeesGrille(grille);
    expect(r.map((rangee) => rangee.map((c) => `${c.colonne}${c.ligne}`))).toEqual([
      ['01', '11'],
      ['00', '10'],
    ]);
  });
  it('teintes de chaleur selon le rang du niveau dans l’échelle de la méthode', () => {
    expect([0, 1, 2].map((n) => teinteNiveau(n, 3))).toEqual([0, 1, 3]);
    expect([0, 1, 2, 3].map((n) => teinteNiveau(n, 4))).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3, 4].map((n) => teinteNiveau(n, 5))).toEqual([0, 1, 1, 2, 3]);
    expect([0, 1].map((n) => teinteNiveau(n, 2))).toEqual([0, 3]);
    expect(teinteNiveau(null, 3)).toBe('neutre');
  });
});

describe('incidents : douze mois', () => {
  const liste = [
    { id: 'INC-1', title: 'Incident fictif 1', smsi: P, detectedAt: '2026-11-02T08:00' },
    { id: 'INC-2', title: 'Incident fictif 2', smsi: P, detectedAt: '2026-11-20T08:00' },
    { id: 'INC-3', title: 'Incident fictif 3', smsi: P, detectedAt: '2025-12-01T08:00' },
    { id: 'INC-4', title: 'Incident trop ancien', smsi: P, detectedAt: '2025-11-30T08:00' },
  ];
  it('finissent au mois de la synthèse, avec les incidents de chaque mois', () => {
    const m = moisIncidents('2026-11-27T10:00:00.000Z', { liste });
    expect(m).toHaveLength(12);
    expect(m[0]!.cle).toBe('2025-12');
    expect(m[0]!.court).toBe('déc.');
    expect(m[11]!.long).toBe('novembre 2026');
    expect(m[11]!.incidents!.map((i) => i.id)).toEqual(['INC-1', 'INC-2']);
    expect(m.reduce((s, x) => s + x.n, 0)).toBe(3);
  });
  it('depuis les seuls décomptes par mois : nombres sans liste', () => {
    const m = moisIncidents('2026-01-15', { parMois: [{ libelle: '2026-01', valeur: 4 }] });
    expect(m[0]!.cle).toBe('2025-02');
    expect(m[11]).toMatchObject({ cle: '2026-01', n: 4, incidents: null });
  });
});

describe('constats par nature', () => {
  it('regroupe les types d’écarts ouverts de la synthèse', () => {
    expect(constatsParNature(synthese().ecartsOuverts)).toEqual({
      majeure: 1,
      mineure: 2,
      point_sensible: 0,
      observation: 2,
      piste: 0,
    });
    expect(constatsParNature(null)).toBeNull();
  });
  it('points sensibles à part ; observations = remarques seules', () => {
    const eo = synthese().ecartsOuverts!;
    const avecPs = { ...eo, parType: eo.parType.map((t) => (t.type === 'PS' ? { ...t, n: 3 } : t)) };
    expect(constatsParNature(avecPs)).toMatchObject({ point_sensible: 3, observation: 2 });
    expect(Object.keys(constatsParNature(avecPs)!)).toEqual([
      'majeure',
      'mineure',
      'point_sensible',
      'observation',
      'piste',
    ]);
  });
});

describe('niveau de risque : grille choisie dans le rail', () => {
  const seconde: GrilleRisques = {
    ...grille,
    methode: 'Matrice fictive',
    niveaux: ['Faible', 'Élevé'],
    cases: [
      { colonne: 0, ligne: 0, niveau: 0, n: 0, risques: [] },
      { colonne: 1, ligne: 0, niveau: 1, n: 2, risques: [] },
      { colonne: 0, ligne: 1, niveau: 1, n: 1, risques: [] },
      { colonne: 1, ligne: 1, niveau: 1, n: 1, risques: [] },
    ],
    places: 4,
    horsGrille: 1,
  };
  const detail = { aApprecier: 1, critiques: 0, grille, grilles: [grille, seconde] };
  it('par défaut la première ; un choix change la grille, le chiffre clé et les critiques', () => {
    expect(vueRisques(detail, 9, 0)).toMatchObject({
      choisie: 0,
      grille,
      valeur: 3,
      etiquette: 'risques · Méthode fictive',
      critiques: 0,
    });
    expect(vueRisques(detail, 9, 1)).toMatchObject({
      choisie: 1,
      grille: seconde,
      valeur: 4,
      etiquette: 'risques · Matrice fictive',
      critiques: 4,
    });
    // Choix hors des grilles présentes : borné.
    expect(vueRisques(detail, 9, 5).choisie).toBe(1);
  });
  it('synthèse sans `grilles` : sa seule grille ; sans grille : tous les risques, critiques de la synthèse', () => {
    expect(vueRisques({ aApprecier: 0, critiques: 0, grille }, 9, 1)).toMatchObject({ choisie: 0, grille, valeur: 3 });
    expect(vueRisques({ aApprecier: 2, critiques: null, grille: null, grilles: [] }, 1, 0)).toMatchObject({
      grille: null,
      valeur: 1,
      etiquette: 'risque',
      critiques: null,
    });
    expect(vueRisques(null, 4, 0)).toMatchObject({ grilles: [], valeur: 4, etiquette: 'risques', critiques: null });
  });
});

describe('rendu des dalles cliquables', () => {
  const p = { id: 'niveau-risque' as const, largeur: 3 as const, interactif: true };

  it('grille des risques : nombre dans chaque case occupée, lien vers le risque seul, choix pour plusieurs', () => {
    const h = decode(html(createElement(RisquesVerre, { p, s: synthese() })));
    // Case d'un seul risque : lien vers sa fiche, bulle reliée.
    const lien = liensDe(h).find((l) => l.contenu === '1');
    expect(lien?.href).toBe(lienRisque(P, 'r-seul'));
    expect(h).toContain(`id="${lien?.['aria-describedby']}" role="tooltip"`);
    // Case de deux risques : bouton qui ouvre le choix, bulle qui les nomme.
    expect(h).toMatch(/<button type="button" class="tdbv-cible [^"]*"[^>]*aria-label="2 risques · niveau modéré/);
    expect(h).toContain('R2 · Risque fictif A');
    // Cases vides : sans chiffre ni lien ; axes et rangée du bas.
    expect(h.match(/class="tdbv-case tdbv-chaleur-[^"]*"><\/span>/g)).toHaveLength(2);
    expect(h).toContain('Gravité →');
    expect(h).toContain('Vraisemblance ↑');
    for (const t of ['Critiques', 'À apprécier', 'Revues échues']) expect(h).toContain(`<dt>${t}</dt>`);
  });

  it('mode modification de la disposition : aucun lien, aucun bouton, aucune bulle', () => {
    const h = html(createElement(RisquesVerre, { p: { ...p, interactif: false }, s: synthese() }));
    expect(h).not.toMatch(/<a |<button|role="tooltip"/);
    expect(h).toContain('>1</span>');
  });

  it('sans grille (chiffres ouverts d’un auteur) : la dalle le dit, sans grille inventée', () => {
    const h = html(createElement(RisquesVerre, { p, s: synthese({ detailRisques: null }) }));
    expect(h).toContain('Grille des risques indisponible pour ce tableau.');
    expect(h).not.toContain('tdbv-case');
  });

  it('plan d’action : chaque case mène à la fiche de son action, avec sa bulle', () => {
    const h = decode(html(createElement(PlanActionVerre, { p: { ...p, id: 'plan-action' }, s: synthese() })));
    const liens = liensDe(h);
    expect(liens.map((l) => l.href)).toEqual(['retard-0', 'a_faire-0', 'terminee-0'].map((id) => lienAction(P, id)));
    for (const l of liens) expect(h).toContain(`id="${l['aria-describedby']}" role="tooltip"`);
    expect(h).toContain('Action fictive retard 0');
  });

  it('plan d’action : couleur de l’état, case rouge en retard, contour or prioritaire, nom accessible complet', () => {
    const s = synthese({
      planActions: plan({ retard: 1, prioritaire: 1, a_faire: 1, en_cours: 1, planifiee: 1, terminee: 1 }),
    });
    // Une action à la fois en retard et prioritaire : rouge et contour or.
    s.planActions!.items[0]!.prioritaire = true;
    s.planActions!.prioritaires = 2;
    const h = decode(html(createElement(PlanActionVerre, { p: { ...p, id: 'plan-action' }, s })));
    const classes = [...h.matchAll(/class="tdbv-cible (tdbv-carre[^"]*)"/g)].map((m) => m[1]);
    expect(classes).toEqual([
      'tdbv-carre tdbv-action--afaire tdbv-action--retard tdbv-action--prioritaire',
      'tdbv-carre tdbv-action--encours tdbv-action--prioritaire',
      'tdbv-carre tdbv-action--afaire',
      'tdbv-carre tdbv-action--encours',
      'tdbv-carre tdbv-action--planifiee',
      'tdbv-carre tdbv-action--terminee',
    ]);
    expect(h).toContain(
      'aria-label="Action Action fictive retard 0 (À faire · en retard · priorité haute · échéance le 20/11/2026) : ouvrir sa fiche"',
    );
    expect(h).toContain('Planifiée · échéance le 31/01/2027');
    // Chiffre clé : nombre d’actions, sans « en retard ».
    expect(h).toMatch(/<span class="tdbv-gros chiffres">6<\/span><span class="tdbv-etiq">actions<\/span>/);
    // Légende sur trois lignes de deux colonnes, dans l’ordre du dessin.
    const legende = [...h.matchAll(/<dt>([^<]*)<\/dt><dd class="chiffres ([^"]*)">([^<]*)<\/dd>/g)].map((m) => [
      m[1],
      m[2],
      m[3],
    ]);
    expect(legende).toEqual([
      ['À faire', 'tdbv-t-bleu', '2'],
      ['En cours', 'tdbv-t-violet', '2'],
      ['Planifiées', 'tdbv-t-gris', '1'],
      ['Terminées', 'tdbv-t-vert', '1'],
      ['En retard', 'tdbv-t-retard', '1'],
      ['Prioritaires', 'tdbv-t-or', '2'],
    ]);
  });

  it('plan d’action sans détail (chiffres ouverts) : décomptes inconnus affichés « — », jamais inventés', () => {
    const h = html(
      createElement(PlanActionVerre, { p: { ...p, id: 'plan-action' }, s: synthese({ planActions: undefined }) }),
    );
    expect(h).toContain('<dt>En cours</dt><dd class="chiffres tdbv-t-violet">—</dd>');
    expect(h).toContain('<dt>Prioritaires</dt><dd class="chiffres tdbv-t-or">—</dd>');
    expect(h).toContain('<dt>À faire</dt><dd class="chiffres tdbv-t-bleu">2</dd>');
    expect(h).not.toContain('<a ');
  });

  it('niveau de risque, une seule méthode : pas de rail, chiffre clé des risques placés et nom de la méthode', () => {
    const h = html(createElement(RisquesVerre, { p, s: synthese() }));
    expect(h).not.toContain('tdbv-rail');
    expect(h).toContain(
      '<span class="tdbv-gros chiffres">3</span><span class="tdbv-etiq" title="risques · Méthode fictive">risques · Méthode fictive</span>',
    );
  });

  it('niveau de risque, deux méthodes : rail des méthodes, la plus utilisée choisie par défaut', () => {
    const seconde: GrilleRisques = {
      ...grille,
      methode: 'Matrice fictive au nom particulièrement long pour la dalle',
      cases: grille.cases.map((c) =>
        c.colonne === 1 && c.ligne === 1 ? { ...c, n: 1, risques: [] } : { ...c, n: 0, risques: [] },
      ),
      places: 1,
    };
    const s = synthese({ detailRisques: { aApprecier: 1, critiques: 0, grille, grilles: [grille, seconde] } });
    const h = decode(html(createElement(RisquesVerre, { p, s })));
    expect(h).toContain('<div class="tdbv-rail" role="group" aria-label="Méthode d’appréciation">');
    const boutons = [
      ...h.matchAll(
        /<button type="button" class="tdbv-rail-bouton([^"]*)" aria-pressed="(\w+)" aria-label="([^"]*)" title="\3">/g,
      ),
    ];
    expect(boutons.map((b) => [b[1], b[2], b[3]])).toEqual([
      [' actif', 'true', 'Méthode fictive : 3 risques placés'],
      ['', 'false', 'Matrice fictive au nom particulièrement long pour la dalle : 1 risque placé'],
    ]);
    expect(h).toContain(
      '<span class="tdbv-rail-nom">Méthode fictive</span><span class="tdbv-rail-n chiffres">3</span>',
    );
    // Mode modification : rail sans commande.
    const fige = html(createElement(RisquesVerre, { p: { ...p, interactif: false }, s }));
    expect(fige).toContain('tdbv-rail');
    expect(fige).not.toContain('<button');
  });

  it('constats : cinq barres, points sensibles à part, légende sur trois lignes de deux colonnes', () => {
    const s = synthese();
    s.ecartsOuverts!.parType = s.ecartsOuverts!.parType.map((t) => (t.type === 'PS' ? { ...t, n: 4 } : t));
    const h = decode(html(createElement(ConstatsVerre, { p: { ...p, id: 'constats' }, s })));
    expect(h).toContain('tdbv-colonnes tdbv-colonnes--5');
    expect(liensDe(h).map((l) => l.href)).toContain('/pilotage/amelioration?nature=point_sensible');
    expect(h).toContain(
      'aria-label="4 points sensibles, parmi les constats ouverts : voir les constats de cette nature"',
    );
    expect(h).toMatch(/class="tdbv-barre tdbv-s-violet"/);
    const legende = [...h.matchAll(/<dt>([^<]*)<\/dt><dd class="chiffres tdbv-t-(\w+)">([^<]*)<\/dd>/g)].map((m) => [
      m[1],
      m[2],
      m[3],
    ]);
    expect(legende).toEqual([
      ['Majeures', 'rouge', '1'],
      ['Points sensibles', 'violet', '4'],
      ['Mineures', 'ambre', '2'],
      ['Observations', 'bleu', '2'],
      ['Pistes', 'sarcelle', '0'],
    ]);
  });

  it('constats : chaque barre non vide mène aux constats de sa nature', () => {
    const h = decode(html(createElement(ConstatsVerre, { p: { ...p, id: 'constats' }, s: synthese() })));
    const liens = liensDe(h).map((l) => l.href);
    expect(liens).toEqual(['majeure', 'mineure', 'observation'].map((n) => lienNatureConstat(n as 'majeure')));
    permissions.delete('ecarts:lire');
    expect(html(createElement(ConstatsVerre, { p: { ...p, id: 'constats' }, s: synthese() }))).not.toContain('<a ');
  });
});

describe('cartes du style « Verre » seulement quand le style de l’instance est « Verre »', () => {
  const donnees = (verre: boolean): DonneesNeon => ({
    incidents: { lisible: true, pending: false, error: null, data: { total: 0, enCours: 0, clos: 0, parMois: [] } },
    journal: { lisible: false, pending: false, error: null },
    portee: 'global',
    verre,
  });
  const VERRE = ['conformite', 'applicabilite', 'niveau-risque', 'incidents', 'constats', 'plan-action', 'maturite'];
  const rendre = (verre: boolean, id: string) => {
    const d = dallesNeon(synthese(), donnees(verre), () => ({ pourcent: 50 })).find((x) => x.id === id)!;
    return html(d.rendu({ id: d.id, largeur: 3, interactif: true }));
  };
  it('style « Verre » : les sept cartes au dessin validé', () => {
    for (const id of VERRE) expect(rendre(true, id), id).toContain('class="tdb-dalle tdb-l3 tdb-neon tdbv tdbv--');
    expect(rendre(true, 'bandeau')).not.toContain('tdbv');
  });
  it('autres styles : cartes inchangées, sans classe ni lien du dessin', () => {
    for (const id of VERRE) {
      const h = rendre(false, id);
      expect(h, id).not.toContain('tdbv');
      expect(h, id).not.toContain('role="tooltip"');
    }
  });
});
