/* Calculs purs des dalles du tableau de bord en style « Verre » (dessin validé, décision du RSSI du 27/11/2026) : liens
   vers les fiches et pages filtrées, cases d'actions bornées, rangées de la grille des risques, mois des incidents,
   constats par nature. Aucune valeur inventée : un élément sans donnée n'est pas dessiné. */
import {
  LIBELLES_ETAT_ACTION_TDB,
  NATURES_CONSTAT,
  type EtatActionTdb,
  type GrilleRisques,
  type NatureConstat,
  type PlanActions,
  type Synthese,
} from '@suivi/shared';
import { ADRESSE_REGISTRE_INCIDENTS } from '../incidents/anciennes-adresses';

/** Périmètre commun (fiches sans périmètre). */
const SOCLE = '00000000-0000-4000-8000-000000000001';

/* ---------------------------------------------------------------- Liens */

/** Fiche d'une rubrique du Pilotage, ouverte dans son périmètre (`?perimetre=`, `?ouvrir=`), retour à l'accueil. */
export function lienFichePilotage(section: string, perimetre: string, id: string): string {
  const q = new URLSearchParams({ perimetre: perimetre || SOCLE, ouvrir: id, retour: '/' });
  return `/pilotage/${section}?${q}`;
}
export const lienRisque = (perimetre: string, id: string) => lienFichePilotage('risques', perimetre, id);
export const lienAction = (perimetre: string, id: string) => lienFichePilotage('actions', perimetre, id);
/** Fiche d'un incident dans le registre de son périmètre (`?incident=`). */
export function lienIncident(perimetre: string, id: string): string {
  const q = new URLSearchParams({ perimetre: perimetre || SOCLE, incident: id });
  return `${ADRESSE_REGISTRE_INCIDENTS}?${q}`;
}
/** Registre des constats filtré sur une nature (filtre d'adresse `nature` du registre). */
export const lienNatureConstat = (nature: NatureConstat) => `/pilotage/amelioration?nature=${nature}`;
/** Déclaration d'applicabilité du référentiel (rubrique dédiée du Pilotage), sinon la page des mesures. */
const PAGES_REFERENTIEL: Record<string, string> = {
  ISO: '/pilotage/dda-iso',
  A: '/pilotage/dda-annexe-a',
  HDS: '/pilotage/dda-hds',
};
export const lienReferentiel = (ref: string) => PAGES_REFERENTIEL[ref] ?? '/pilotage/mesures';
export const PAGE_ACTIONS = '/pilotage/actions';
export const PAGE_RISQUES = '/pilotage/risques';
export const PAGE_APPLICABILITE = '/pilotage/applicabilite';

/** Libellé court d'un référentiel de la DdA (« A » : « Annexe A »). */
export const libelleReferentiel = (ref: string, libelle: string) =>
  ref === 'A' ? 'Annexe A' : ref === 'ISO' || ref === 'HDS' ? ref : libelle || ref;

/* ---------------------------------------------------------------- Plan d'action : une case par action */

/** Nombre de cases d'actions dessinées au plus (neuf colonnes sur cinq rangées dans le dessin). */
export const CAPACITE_ACTIONS = 45;

export interface CaseAction {
  cle: string;
  etat: EtatActionTdb;
  /** Intitulé et lien de la fiche ; absents quand seul le décompte est connu (chiffres ouverts d'un auteur). */
  nom: string | null;
  echeance: string | null;
  lien: string | null;
}
export interface CasesActions {
  cases: CaseAction[];
  /** Actions non dessinées (case « + N autres ») ; 0 quand tout tient. */
  reste: number;
  enRetard: number;
  ceMois: number;
  ouvertes: number;
  closes: number;
  total: number;
}

/** Cases du plan d'action : une par action, les plus urgentes d'abord (en retard, à échéance ce mois-ci, autres
    ouvertes, closes). Au-delà de la capacité, les deux derniers emplacements deviennent « + N autres ». Sans détail (chiffres ouverts),
    les cases viennent des seuls décomptes de la synthèse, sans intitulé ni lien. */
export function casesActions(
  plan: PlanActions | null | undefined,
  actions: Synthese['actions'],
  capacite = CAPACITE_ACTIONS,
): CasesActions | null {
  let liste: CaseAction[];
  let compte: Omit<CasesActions, 'cases' | 'reste'>;
  if (plan) {
    liste = plan.items.map((a) => ({
      cle: a.id,
      etat: a.etat,
      nom: a.nom,
      echeance: a.echeance,
      lien: lienAction(a.perimetre, a.id),
    }));
    compte = {
      enRetard: plan.enRetard,
      ceMois: plan.ceMois,
      ouvertes: plan.enRetard + plan.ceMois + plan.autresOuvertes,
      closes: plan.closes,
      total: plan.total,
    };
  } else if (actions) {
    const autres = Math.max(0, actions.ouvertes - actions.enRetard);
    const etats: EtatActionTdb[] = [
      ...Array<EtatActionTdb>(actions.enRetard).fill('retard'),
      ...Array<EtatActionTdb>(autres).fill('ouverte'),
      ...Array<EtatActionTdb>(actions.terminees).fill('close'),
    ].slice(0, capacite);
    liste = etats.map((etat, i) => ({ cle: `${etat}-${i}`, etat, nom: null, echeance: null, lien: null }));
    compte = {
      enRetard: actions.enRetard,
      ceMois: 0,
      ouvertes: actions.ouvertes,
      closes: actions.terminees,
      total: actions.total,
    };
  } else return null;
  if (compte.total <= capacite && liste.length >= compte.total) return { ...compte, cases: liste, reste: 0 };
  // La case « + N autres » occupe deux emplacements : la grille garde sa taille (cinq rangées de neuf dans le dessin).
  const gardees = liste.slice(0, Math.max(0, capacite - 2));
  return { ...compte, cases: gardees, reste: compte.total - gardees.length };
}

/** Bulle d'une case d'action : état et échéance. */
export function detailAction(c: Pick<CaseAction, 'etat' | 'echeance'>): string {
  const etat = LIBELLES_ETAT_ACTION_TDB[c.etat];
  if (!c.echeance) return c.etat === 'close' ? etat : `${etat} · sans échéance`;
  const date = c.echeance.split('-').reverse().join('/');
  return `${etat} · échéance ${c.etat === 'retard' ? 'dépassée, ' : ''}le ${date}`;
}

/* ---------------------------------------------------------------- Grille des risques */

/** Quatre teintes de chaleur (vert, ambre, rose, rouge) ; le niveau le plus faible est vert, le plus fort rouge. */
export function teinteNiveau(niveau: number | null, niveaux: number): 'neutre' | 0 | 1 | 2 | 3 {
  if (niveau === null || niveaux <= 0) return 'neutre';
  if (niveaux === 1 || niveau >= niveaux - 1) return 3;
  if (niveau <= 0) return 0;
  return niveaux === 3 ? 1 : (Math.min(2, 1 + Math.floor(((niveau - 1) * 2) / (niveaux - 2))) as 1 | 2);
}

/** Rangées de la grille dans l'ordre d'affichage : vraisemblance décroissante de haut en bas, gravité croissante de
    gauche à droite. */
export function rangeesGrille(g: GrilleRisques): GrilleRisques['cases'][] {
  return [...g.lignes.keys()]
    .reverse()
    .map((ligne) => g.cases.filter((c) => c.ligne === ligne).sort((a, b) => a.colonne - b.colonne));
}

/* ---------------------------------------------------------------- Incidents : douze mois */

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export interface IncidentMois {
  id: string;
  titre: string;
  perimetre: string;
}
export interface MoisIncidents {
  cle: string;
  court: string;
  long: string;
  n: number;
  /** Incidents du mois ; null quand seul le décompte est connu (chiffres ouverts d'un auteur). */
  incidents: IncidentMois[] | null;
}

/** Les douze mois qui finissent au mois de `reference` (AAAA-MM-JJ…), avec le nombre d'incidents détectés chacun et, si
    la liste est connue, ces incidents. */
export function moisIncidents(
  reference: string,
  source:
    | { liste: readonly { id: string; title: string; smsi: string; detectedAt: string }[] }
    | { parMois: readonly { libelle: string; valeur: number }[] },
): MoisIncidents[] {
  const annee = Number(reference.slice(0, 4)),
    mois = Number(reference.slice(5, 7)) - 1;
  const cles = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(annee, mois - 11 + i, 1));
    return { cle: d.toISOString().slice(0, 7), m: d.getUTCMonth(), a: d.getUTCFullYear() };
  });
  return cles.map(({ cle, m, a }) => {
    const base = { cle, court: MOIS_COURTS[m]!, long: `${MOIS_LONGS[m]} ${a}` };
    if ('liste' in source) {
      const incidents = source.liste
        .filter((i) => i.detectedAt.slice(0, 7) === cle)
        .sort((x, y) => x.detectedAt.localeCompare(y.detectedAt))
        .map((i) => ({ id: i.id, titre: i.title || i.id, perimetre: i.smsi }));
      return { ...base, n: incidents.length, incidents };
    }
    return { ...base, n: source.parMois.find((p) => p.libelle === cle)?.valeur ?? 0, incidents: null };
  });
}

/* ---------------------------------------------------------------- Constats par nature */

/** Constats ouverts par nature, à partir des types d'écarts ouverts de la synthèse (mêmes regroupements que le filtre
    « nature » du registre). */
export function constatsParNature(eo: Synthese['ecartsOuverts']): Record<NatureConstat, number> | null {
  if (!eo) return null;
  const n = (type: string) => eo.parType.find((t) => t.type === type)?.n ?? 0;
  const r: Record<NatureConstat, number> = {
    majeure: n('NC maj'),
    mineure: n('NC min'),
    observation: n('PS') + n('Remarque'),
    piste: n('PP'),
  };
  return Object.fromEntries(NATURES_CONSTAT.map((k) => [k, r[k]])) as Record<NatureConstat, number>;
}

/** Pluriel simple d'un nombre et d'un nom (« 1 risque », « 3 risques »). */
export const pluriel = (n: number, un: string, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;
