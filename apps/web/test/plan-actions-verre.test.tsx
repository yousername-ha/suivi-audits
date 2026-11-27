/* Plan d'actions en Timeline, style « Verre » (dessin PlanTimeline validé par le RSSI le 27/11/2026, « pas de carré,
   logique, épuré, propre ») : tri par échéance, retard, début par défaut (création de la fiche), actions sans échéance,
   repli des actions terminées, tuiles, fenêtre de temps et totaux. Données fictives, rendu statique. */
import { MantineProvider } from '@mantine/core';
import { businessDefaults, type GrcObject } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fenetrePlan,
  libelleFenetre,
  libelleTotalPlan,
  lignePlan,
  lignesPlan,
  sousTitre,
  totauxPlan,
  tuilesPlan,
} from '../src/grc/plan-actions';
import { BarreAction, PlanActionsVerre, TotalPlan } from '../src/grc/PlanActionsVerre';

const policy = businessDefaults();
const MAINTENANT = Date.parse('2026-11-27T10:00:00Z');
const html = (n: ReactNode, adresse = '/pilotage/actions') =>
  renderToStaticMarkup(
    createElement(MantineProvider, null, createElement(MemoryRouter, { initialEntries: [adresse] }, n)),
  )
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&');
let k = 0;
const action = (
  name: string,
  status: string,
  dueAt: string | null,
  extra: { startAt?: string; createdAt?: string; priority?: string; updatedAt?: string } = {},
) =>
  ({
    id: `a${++k}`,
    name,
    kind: 'action',
    createdAt: extra.createdAt ?? '2026-10-01T09:00:00Z',
    updatedAt: extra.updatedAt ?? '2026-10-15T09:00:00Z',
    registreId: null,
    data: {
      status,
      dueAt,
      startAt: extra.startAt ?? null,
      priority: extra.priority ?? 'normal',
      ownerId: null,
    },
  }) as unknown as GrcObject;

const actions = [
  action('Action fictive C', 'todo', '2026-12-26T09:00:00Z', { startAt: '2026-11-21T09:00:00Z', priority: 'urgent' }),
  action('Action fictive sans échéance', 'todo', null),
  action('Action fictive A en retard', 'progress', '2026-11-11T09:00:00Z', { startAt: '2026-10-20T09:00:00Z' }),
  action('Action fictive B', 'blocked', '2026-11-29T09:00:00Z', { createdAt: '2026-11-02T09:00:00Z' }),
  action('Action fictive terminée', 'done', '2026-10-01T09:00:00Z', { updatedAt: '2026-10-02T09:00:00Z' }),
  action('Action fictive annulée', 'cancelled', '2026-09-01T09:00:00Z'),
];

describe('lignes du plan', () => {
  it('ouvertes triées par échéance, celles sans échéance à la fin ; terminées et annulées à part', () => {
    const { ouvertes, terminees } = lignesPlan(actions, policy, MAINTENANT);
    expect(ouvertes.map((l) => l.objet.name)).toEqual([
      'Action fictive A en retard',
      'Action fictive B',
      'Action fictive C',
      'Action fictive sans échéance',
    ]);
    expect(terminees.map((l) => l.objet.name)).toEqual(['Action fictive annulée', 'Action fictive terminée']);
  });

  it('retard : échéance passée, état non terminal ; nombre de jours écrit', () => {
    const a = lignePlan(actions[2]!, policy, MAINTENANT);
    expect([a.retard, a.joursRetard]).toEqual([true, 16]);
    expect(sousTitre(a, 2026)).toBe('en retard de 16 j');
    // Une action terminée n'est jamais en retard.
    expect(lignePlan(actions[4]!, policy, MAINTENANT).retard).toBe(false);
  });

  it('début : date de début, à défaut création de la fiche ; jamais après l’échéance', () => {
    const b = lignePlan(actions[3]!, policy, MAINTENANT);
    expect([b.debut, b.debutCreation]).toEqual([Date.UTC(2026, 10, 2), true]);
    const c = lignePlan(actions[0]!, policy, MAINTENANT);
    expect([c.debut, c.debutCreation, c.haute]).toEqual([Date.UTC(2026, 10, 21), false, true]);
    const tardive = lignePlan(
      action('Création fictive tardive', 'todo', '2026-11-01T09:00:00Z', { createdAt: '2026-11-20T09:00:00Z' }),
      policy,
      MAINTENANT,
    );
    expect([tardive.debut, tardive.incoherente]).toEqual([null, false]);
    const inversee = lignePlan(
      action('Dates fictives inversées', 'todo', '2026-11-01T09:00:00Z', { startAt: '2026-11-20T09:00:00Z' }),
      policy,
      MAINTENANT,
    );
    expect([inversee.debut, inversee.incoherente]).toEqual([null, true]);
  });

  it('sans échéance : ni début ni barre, mention « sans échéance »', () => {
    const l = lignePlan(actions[1]!, policy, MAINTENANT);
    expect([l.echeance, l.debut]).toEqual([null, null]);
    expect(sousTitre(l, 2026)).toBe('sans échéance');
    expect(html(<svg>{<BarreAction l={l} x={(n) => n} largeur={500} aujourdhui={MAINTENANT} couleur="" />}</svg>)).toBe(
      html(<svg />),
    );
  });
});

describe('fenêtre, tuiles et totaux', () => {
  it('fenêtre : six mois dont un avant aujourd’hui ; douze semaines ; navigation d’une demi-fenêtre', () => {
    const m = fenetrePlan('mois', MAINTENANT);
    expect(m.colonnes.map((c) => c.libelle)).toEqual(['oct. 26', 'nov.', 'déc.', 'janv. 27', 'févr.', 'mars']);
    expect(libelleFenetre(m, 'mois')).toBe('octobre 2026 à mars 2027');
    expect(new Date(m.suivante).toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(new Date(m.precedente).toISOString().slice(0, 10)).toBe('2026-07-01');
    const s = fenetrePlan('semaine', MAINTENANT);
    expect(s.colonnes).toHaveLength(12);
    expect(libelleFenetre(s, 'semaine')).toBe('du 09/11/2026 au 31/01/2027');
    expect(fenetrePlan('trimestre', MAINTENANT).colonnes.map((c) => c.libelle)).toEqual([
      'T3 2026',
      'T4 2026',
      'T1 2027',
      'T2 2027',
      'T3 2027',
      'T4 2027',
    ]);
    expect(fenetrePlan('mois', MAINTENANT, Date.UTC(2027, 0, 15)).colonnes[0]!.libelle).toBe('janv. 27');
  });

  it('tuiles : ouvertes (dont états), en retard, à échéance ce mois, terminées dans l’année', () => {
    expect(tuilesPlan(actions, policy, MAINTENANT).map((t) => [t.titre, t.valeur, t.detail])).toEqual([
      ['Actions ouvertes', '4', 'dont 1 en cours, 1 bloquée'],
      ['En retard', '1', 'échéance dépassée, non terminée'],
      ['À échéance ce mois', '1', 'd’ici au 30/11'],
      ['Terminées en 2026', '1', 'd’après la dernière mise à jour de la fiche'],
    ]);
  });

  it('total : échéances par période, retards, récapitulatif ; nom accessible complet', () => {
    const f = fenetrePlan('mois', MAINTENANT);
    const { ouvertes } = lignesPlan(actions, policy, MAINTENANT);
    const t = totauxPlan(f.colonnes, ouvertes);
    expect(t.map((x) => [x.echeances, x.retards])).toEqual([
      [0, 0],
      [2, 1],
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(libelleTotalPlan(ouvertes)).toBe('4 actions ouvertes · 1 en retard');
    const x = (n: number) => ((n - f.debut) / (f.fin - f.debut)) * 900;
    const h = html(<TotalPlan colonnes={f.colonnes} totaux={t} x={x} largeur={900} courante={1} />);
    expect(h).toContain('aria-label="Échéances par période : oct. 26, 0 · nov., 2 dont 1 en retard · déc., 1');
    expect(h).toContain('pa-total__nb pa-total__nb--courant');
    expect(h).toContain('pa-total__retard');
  });
});

describe('rendu de la Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MAINTENANT);
  });
  afterEach(() => vi.useRealTimers());
  const rendu = (adresse?: string) =>
    html(
      <PlanActionsVerre
        items={actions}
        policy={policy}
        onOpen={() => undefined}
        ownerOf={() => 'Non attribué'}
        closes={false}
        origineDe={() => null}
      />,
      adresse,
    );

  it('aucun carré : barres, filets, anneaux et ronds ; retard en pointillé jusqu’à aujourd’hui', () => {
    const h = rendu();
    // Seule la gélule du mois courant, dans la règle, est un rectangle (arrondi en pilule) ; aucun repère n'en est un.
    expect(h.match(/<rect[^>]*>/g)?.every((r) => r.includes('frise-regle__gelule'))).toBe(true);
    expect(h).toContain('pa-echeance pa-echeance--retard');
    expect(h).toContain('class="pa-depassement"');
    expect(h).toContain('class="pa-ecoule"');
    expect(h).toContain('class="pa-priorite"');
    // Dessin par attributs SVG : aucun attribut style dans la frise (les commandes Mantine de la barre gardent les leurs).
    expect(h.slice(h.indexOf('class="pa-grille"'))).not.toMatch(/style=/);
  });

  it('une ligne par action ouverte, nom et description accessibles ; origine non devinée', () => {
    const h = rendu();
    expect(h.match(/class="pa-rang"/g)).toHaveLength(4);
    expect(h).toContain('aria-label="Action fictive A en retard"');
    expect(h).toMatch(
      /aria-description="En cours ; origine non renseignée ; échéance le 11\/11\/2026, en retard de 16 jours/,
    );
    expect(h).toContain('début le 02/11/2026 (création de la fiche)');
    expect(h).toContain('origine non renseignée</span> · <span class="pa-quand">sans échéance</span>');
  });

  it('actions terminées repliées derrière leur lien, dépliées par l’adresse', () => {
    const replie = rendu();
    expect(replie).toMatch(/aria-expanded="false"[^>]*>.*Actions terminées \(2\)/);
    expect(replie).not.toContain('Action fictive terminée');
    const deplie = rendu('/pilotage/actions?tterminees=1');
    expect(deplie).toMatch(/aria-expanded="true"/);
    expect(deplie).toContain('aria-label="Action fictive terminée"');
    expect(deplie.match(/data-terminee=""/g)).toHaveLength(2);
  });
});
