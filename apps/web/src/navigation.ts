/* Navigation de l'application : sept familles (ordre validé le 19/10/2026) -> destinations -> rubriques.
   Chaque rubrique garde son adresse et son droit de lecture d'origine : réorganiser le menu ne crée aucune adresse
   et n'ouvre aucun accès. Les rubriques du Pilotage sont décrites dans pilotage-navigation.ts (libellé et module) ;
   ce fichier ne fait que les regrouper. Le test navigation.test.ts vérifie qu'aucune rubrique n'est perdue ni doublée. */
import type { Action, Module } from '@suivi/shared';
import { PILOTAGE_NAV } from './pilotage-navigation';

export type FamilleId = 'pilotage' | 'organisation' | 'risques' | 'conformite' | 'actions' | 'resilience' | 'documents';

export interface Rubrique {
  /** Identifiant du Pilotage (`/pilotage/<id>`) ou, hors Pilotage, chemin sans barre initiale. */
  id: string;
  label: string;
  to: string;
  /** Droit de lecture du module ; absent : la rubrique est ouverte à toute personne connectée (l'API contrôle l'accès à
      chaque ressource, par exemple les registres attribués par droit). */
  module?: Module;
  action: Action;
  /** Second droit exigé (la cartographie des risques demande aussi la lecture du Pilotage). */
  aussi?: [Module, Action];
  /** Préfixe d'adresse qui désigne la rubrique (pages à sous-adresses) ; sinon l'adresse exacte. */
  prefixe?: boolean;
  /** Adresses supplémentaires qui désignent la même rubrique. */
  alias?: string[];
}
export interface Destination {
  id: string;
  label: string;
  rubriques: Rubrique[];
}
export interface Famille {
  id: FamilleId;
  label: string;
  destinations: Destination[];
}

const pilotage = new Map(PILOTAGE_NAV.flatMap((g) => g.items.map((i) => [i.id, i] as const)));
/** Rubrique du Pilotage décrite dans pilotage-navigation.ts. */
const p = (id: string): Rubrique => {
  const i = pilotage.get(id);
  if (!i) throw new Error(`Rubrique du Pilotage inconnue : ${id}`);
  return {
    id,
    label: i.label,
    to: '/pilotage/' + id,
    module: i.module,
    action: 'lire',
    ...(id === 'carte' ? { aussi: ['pilotage', 'lire'] as [Module, Action] } : {}),
    ...(id === 'synthese' ? { alias: ['/pilotage'] } : {}),
  };
};
const page = (
  id: string,
  label: string,
  to: string,
  module: Module,
  action: Action = 'lire',
  prefixe = false,
): Rubrique => ({ id, label, to, module, action, prefixe });
const dest = (id: string, label: string, rubriques: Rubrique[]): Destination => ({ id, label, rubriques });

export const FAMILLES: Famille[] = [
  {
    id: 'pilotage',
    label: 'Pilotage',
    destinations: [
      dest('synthese', 'Synthèse et périmètres', [p('synthese'), p('parcours'), p('perimetres')]),
      dest('objectifs', 'Objectifs et indicateurs', [p('processus'), p('objectifs'), p('indicateurs')]),
      dest('revues', 'Revues de direction', [p('revues')]),
      dest('rappels', 'Rappels et configuration', [p('rappels'), p('configuration')]),
    ],
  },
  {
    id: 'organisation',
    label: 'Organisation',
    destinations: [
      dest('contexte', 'Contexte de l’organisation', [p('contexte'), p('parties'), p('swot'), p('pestel')]),
      dest('responsabilites', 'Rôles et responsabilités', [p('responsabilites')]),
      dest('cartographie', 'Cartographie du SMSI', [
        page('cartographie', 'Cartographie du SMSI', '/cartographie', 'cartographie', 'lire', true),
      ]),
      dest('fournisseurs', 'Fournisseurs', [
        p('fournisseurs'),
        p('criteres-fournisseurs'),
        p('fournisseurs-perimetre'),
        p('evaluations-clausier'),
      ]),
      dest('revues-acces', 'Revues des accès', [p('revues-acces')]),
      dest('plans', 'Plans annuels', [
        p('plans-calendrier'),
        p('plans-planning'),
        p('plans-formation'),
        p('plans-sensibilisation'),
      ]),
      dest('budget', 'Budget', [p('investissements')]),
    ],
  },
  {
    id: 'risques',
    label: 'Risques',
    destinations: [
      dest('risques', 'Gestion des risques', [
        p('risques'),
        p('opportunites'),
        p('etudes'),
        p('carte'),
        p('traitements'),
        p('scenarios'),
        p('configuration-analyses'),
      ]),
    ],
  },
  {
    id: 'conformite',
    label: 'Conformité et audits',
    destinations: [
      dest('referentiels', 'Référentiels et exigences', [
        p('referentiels'),
        p('bibliotheque'),
        p('correspondances'),
        p('rapprochements'),
        p('couverture'),
        p('gap-applications'),
        p('correspondances-bibliotheque'),
      ]),
      dest('applicabilite', 'Applicabilité et mesures', [
        p('dda-iso'),
        p('dda-annexe-a'),
        p('dda-hds'),
        p('applicabilite'),
        p('mesures'),
      ]),
      dest('ia', 'Intelligence artificielle', [
        p('conformite-ia'),
        page('ia-evaluations', 'Évaluations IA', '/ia/evaluations', 'ia'),
      ]),
      dest('audits', 'Gestion de l’audit', [
        p('audit-pronostic'),
        p('audit-couverture'),
        p('audit-deroule'),
        p('audit-planning'),
        p('audit-participants'),
        p('audits'),
      ]),
      dest('preuves', 'Preuves et contrôles', [p('preuves'), p('controles')]),
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    destinations: [
      dest('amelioration', 'Amélioration continue', [p('amelioration')]),
      dest('plan-actions', 'Plan d’actions', [p('actions')]),
      dest('recurrences', 'Tâches récurrentes', [p('recurrences')]),
      dest('registres', 'Registres et droits', [
        { id: 'registres', label: 'Registres et droits', to: '/registres', action: 'lire', prefixe: true },
      ]),
    ],
  },
  {
    id: 'resilience',
    label: 'Résilience',
    destinations: [
      dest('continuite', 'Continuité d’activité', [p('bia'), p('continuite'), p('exercices')]),
      dest('incidents', 'Incidents et crise', [
        p('incidents-registre'),
        p('incidents-qualifier'),
        p('crise-cellule'),
        p('crise-contacts'),
        p('crise-scenarios'),
      ]),
      dest('sauvegardes', 'Sauvegardes (CRRC)', [
        p('crrc-ensemble'),
        p('crrc-etablissements'),
        p('crrc-offres'),
        p('crrc-tableau'),
        p('crrc-ressources'),
        p('crrc-restaurations'),
        p('crrc-alertes'),
        p('crrc-rapports'),
      ]),
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    destinations: [
      dest('documents', 'Documents et liens', [
        page('documents', 'Documents et liens', '/documents', 'documents', 'lire', true),
      ]),
      dest('echanges', 'Imports et exports', [
        p('imports'),
        page('exports', 'Exports Excel', '/exports', 'import_export', 'exporter'),
      ]),
    ],
  },
];

type Can = (module: Module, action: Action) => boolean;

export const rubriqueVisible = (r: Rubrique, can: Can) =>
  (!r.module || can(r.module, r.action)) && (!r.aussi || can(r.aussi[0], r.aussi[1]));

/** Rubriques affichables d'une destination, dans l'ordre du menu. */
export const rubriquesVisibles = (d: Destination, can: Can) => d.rubriques.filter((r) => rubriqueVisible(r, can));

/** Menu réduit à ce que la personne peut lire : une destination ou une famille sans rubrique lisible disparaît. */
export function famillesVisibles(can: Can): { famille: Famille; destinations: (Destination & { to: string })[] }[] {
  return FAMILLES.flatMap((famille) => {
    const destinations = famille.destinations.flatMap((d) => {
      const visibles = rubriquesVisibles(d, can);
      return visibles.length ? [{ ...d, rubriques: visibles, to: visibles[0]!.to }] : [];
    });
    return destinations.length ? [{ famille, destinations }] : [];
  });
}

const correspond = (r: Rubrique, chemin: string) => {
  const adresses = [r.to, ...(r.alias ?? [])];
  return adresses.some((a) => (r.prefixe ? chemin === a || chemin.startsWith(a + '/') : chemin === a));
};

/** Famille, destination et rubrique désignées par une adresse (indéfini hors menu : compte, aide, paramètres…). */
export function localiser(chemin: string) {
  for (const famille of FAMILLES)
    for (const destination of famille.destinations) {
      const rubrique = destination.rubriques.find((r) => correspond(r, chemin));
      if (rubrique) return { famille, destination, rubrique };
    }
  return undefined;
}
