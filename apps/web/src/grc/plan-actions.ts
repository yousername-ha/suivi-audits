/* Plan d'actions en Timeline, style « Verre » (dessin PlanTimeline validé par le RSSI le 27/11/2026, « pas de carré,
   logique, épuré, propre ») : calculs purs de la fenêtre de temps, des lignes (une par action, triées par échéance), du
   retard, des tuiles et du total. Tout vient des fiches chargées : aucune date n'est écrite ni corrigée. Le début d'une
   action est sa date de début ; à défaut, la création de sa fiche (choix par défaut accepté par le RSSI). */
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { enRetard } from './etat-action';
import { dateCourte, debutUnite, type ColonneFrise, type UniteFrise, uniteSuivante } from './Timeline';
import { numeroSemaine } from './timeline-calendrier';

const JOUR = 86_400_000;
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const jourIso = (s: unknown) => {
  if (typeof s !== 'string' || !s) return Number.NaN;
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.floor(t / JOUR) * JOUR : Number.NaN;
};

/* ---------- Fenêtre de temps ---------- */

/** Échelles du dessin : semaines, mois, trimestres. */
export const ECHELLES_PLAN = ['semaine', 'mois', 'trimestre'] as const;
export type EchellePlan = (typeof ECHELLES_PLAN)[number];
export const LIBELLES_ECHELLE_PLAN: Record<EchellePlan, string> = {
  semaine: 'Semaines',
  mois: 'Mois',
  trimestre: 'Trimestres',
};
export const estEchellePlan = (v: string): v is EchellePlan => (ECHELLES_PLAN as readonly string[]).includes(v);
/** Colonnes affichées et colonnes avant celle d'aujourd'hui (dessin : octobre à mars, aujourd'hui en novembre). */
const FENETRE: Record<EchellePlan, { colonnes: number; avant: number }> = {
  semaine: { colonnes: 12, avant: 2 },
  mois: { colonnes: 6, avant: 1 },
  trimestre: { colonnes: 6, avant: 1 },
};
const moisLong = (n: number) => new Date(n).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
const dateLongue = (n: number) => new Date(n).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const moisCourt = (n: number) => new Date(n).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });

function libelle(n: number, unite: EchellePlan, premiere: boolean): Pick<ColonneFrise, 'libelle' | 'court'> {
  const d = new Date(n),
    a = d.getUTCFullYear(),
    aa = String(a % 100).padStart(2, '0');
  if (unite === 'semaine') {
    const jm = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { libelle: `S${numeroSemaine(n)} · ${jm}`, court: `S${numeroSemaine(n)}` };
  }
  if (unite === 'trimestre') {
    const t = Math.floor(d.getUTCMonth() / 3) + 1;
    return { libelle: `T${t} ${a}`, court: `T${t} ${aa}` };
  }
  // Mois : l'année n'est écrite qu'en janvier et sur la première colonne (« janv. 27 »).
  const avecAnnee = premiere || d.getUTCMonth() === 0;
  return { libelle: avecAnnee ? `${moisCourt(n)} ${aa}` : moisCourt(n), court: moisCourt(n) };
}

export interface FenetrePlan {
  debut: number;
  fin: number;
  colonnes: ColonneFrise[];
  /** Origine des fenêtres voisines (navigation ‹ ›), au jour près. */
  precedente: number;
  suivante: number;
}
/** Fenêtre affichée : `origine` (adresse, navigation) ou, par défaut, une à deux colonnes avant aujourd'hui. Le pas de la
    navigation est la moitié de la fenêtre : la période quittée reste en partie visible. */
export function fenetrePlan(unite: EchellePlan, maintenant: number, origine?: number): FenetrePlan {
  const f = FENETRE[unite];
  let debut = debutUnite(Math.floor(maintenant / JOUR) * JOUR, unite as UniteFrise);
  if (origine !== undefined && Number.isFinite(origine)) debut = debutUnite(origine, unite as UniteFrise);
  else for (let i = 0; i < f.avant; i++) debut = precedente(debut, unite);
  const colonnes: ColonneFrise[] = [];
  let n = debut;
  for (let i = 0; i < f.colonnes; i++) {
    const s = uniteSuivante(n, unite as UniteFrise);
    colonnes.push({ debut: n, fin: s, ...libelle(n, unite, i === 0) });
    n = s;
  }
  let avant = debut,
    apres = debut;
  for (let i = 0; i < f.colonnes / 2; i++) {
    avant = precedente(avant, unite);
    apres = uniteSuivante(apres, unite as UniteFrise);
  }
  return { debut, fin: n, colonnes, precedente: avant, suivante: apres };
}
function precedente(n: number, unite: EchellePlan): number {
  if (unite === 'semaine') return n - 7 * JOUR;
  const d = new Date(n);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (unite === 'mois' ? 1 : 3), 1);
}
/** « octobre 2026 à mars 2027 » (mois et trimestres), « du 09/11/2026 au 31/01/2027 » (semaines). */
export function libelleFenetre(f: Pick<FenetrePlan, 'debut' | 'fin'>, unite: EchellePlan): string {
  const dernier = f.fin - JOUR;
  if (unite === 'semaine') return `du ${dateLongue(f.debut)} au ${dateLongue(dernier)}`;
  const a1 = new Date(f.debut).getUTCFullYear(),
    a2 = new Date(dernier).getUTCFullYear();
  return a1 === a2
    ? `${moisLong(f.debut)} à ${moisLong(dernier)} ${a2}`
    : `${moisLong(f.debut)} ${a1} à ${moisLong(dernier)} ${a2}`;
}

/* ---------- Lignes ---------- */

export const estTerminale = (o: GrcObject, policy: BusinessPolicy) =>
  !!policy.statuses.find((s) => s.id === o.data.status)?.terminal || (!!o.data.legacy && o.data.status === 'done');

export interface LignePlan {
  objet: GrcObject;
  /** Début dessiné : date de début, à défaut création de la fiche ; null s'il ne précède pas l'échéance. */
  debut: number | null;
  /** Vrai quand le début vient de la création de la fiche (pas de date de début). */
  debutCreation: boolean;
  /** Date de début postérieure à l'échéance : rien n'est corrigé, la barre n'est pas dessinée. */
  incoherente: boolean;
  echeance: number | null;
  retard: boolean;
  joursRetard: number;
  haute: boolean;
  terminee: boolean;
}

export function lignePlan(o: GrcObject, policy: BusinessPolicy, maintenant: number): LignePlan {
  const echeance = jourIso(o.data.dueAt),
    debutSaisi = jourIso(o.data.startAt),
    creation = jourIso(o.createdAt);
  const aEcheance = Number.isFinite(echeance);
  const debutCreation = !Number.isFinite(debutSaisi) && Number.isFinite(creation);
  const brut = Number.isFinite(debutSaisi) ? debutSaisi : creation;
  const incoherente = aEcheance && Number.isFinite(debutSaisi) && debutSaisi > echeance;
  const debut = Number.isFinite(brut) && (!aEcheance || brut <= echeance) ? brut : null;
  const retard = aEcheance && enRetard(o, policy, maintenant);
  const aujourdhui = Math.floor(maintenant / JOUR) * JOUR;
  return {
    objet: o,
    debut: aEcheance ? debut : null,
    debutCreation: aEcheance && debut !== null && debutCreation,
    incoherente,
    echeance: aEcheance ? echeance : null,
    retard,
    joursRetard: retard ? Math.max(1, Math.round((aujourdhui - echeance) / JOUR)) : 0,
    haute: o.data.priority === 'high' || o.data.priority === 'urgent',
    terminee: estTerminale(o, policy),
  };
}

/** Lignes du plan : actions ouvertes triées par échéance (la plus proche d'abord, puis par intitulé), celles sans
    échéance à la fin ; les actions terminées (et annulées) à part, repliées. */
export function lignesPlan(
  items: readonly GrcObject[],
  policy: BusinessPolicy,
  maintenant: number,
): { ouvertes: LignePlan[]; terminees: LignePlan[] } {
  const ordre = (a: LignePlan, b: LignePlan) =>
    (a.echeance ?? Infinity) - (b.echeance ?? Infinity) || a.objet.name.localeCompare(b.objet.name, 'fr');
  const lignes = items.map((o) => lignePlan(o, policy, maintenant)).sort(ordre);
  return { ouvertes: lignes.filter((l) => !l.terminee), terminees: lignes.filter((l) => l.terminee) };
}

/** Sous-titre d'une ligne, après l'origine : retard, échéance ou absence d'échéance. */
export function sousTitre(l: LignePlan, annee: number): string {
  if (l.echeance === null) return 'sans échéance';
  if (l.retard) return `en retard de ${l.joursRetard} j`;
  return `échéance ${dateCourte(l.echeance, annee)}`;
}

/* ---------- Tuiles et total ---------- */

export interface TuilePlan {
  cle: string;
  titre: string;
  valeur: string;
  detail: string;
  ton: 'neutre' | 'orange' | 'rouge' | 'vert';
}
/** Quatre tuiles : actions ouvertes (dont chaque état ouvert autre que le premier), en retard, à échéance ce mois (non
    échues), terminées dans l'année (d'après la dernière mise à jour de la fiche : l'API ne date pas la clôture). */
export function tuilesPlan(items: readonly GrcObject[], policy: BusinessPolicy, maintenant: number): TuilePlan[] {
  const ouvertes = items.filter((o) => !estTerminale(o, policy));
  const premier = policy.statuses.find((s) => !s.terminal)?.id;
  const parEtat = policy.statuses
    .filter((s) => !s.terminal && s.id !== premier)
    .map((s) => [s.label.toLowerCase(), ouvertes.filter((o) => o.data.status === s.id).length] as const)
    .filter(([, n]) => n > 0)
    .map(([l, n]) => `${n} ${l}`);
  const retards = ouvertes.filter((o) => enRetard(o, policy, maintenant)).length;
  const d = new Date(maintenant),
    aujourdhui = Math.floor(maintenant / JOUR) * JOUR,
    finMois = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
    annee = d.getUTCFullYear();
  const ceMois = ouvertes.filter((o) => {
    const e = jourIso(o.data.dueAt);
    return Number.isFinite(e) && e >= aujourdhui && e < finMois;
  }).length;
  const terminees = items.filter(
    (o) =>
      estTerminale(o, policy) &&
      o.data.status !== 'cancelled' &&
      typeof o.updatedAt === 'string' &&
      new Date(o.updatedAt).getUTCFullYear() === annee,
  ).length;
  return [
    {
      cle: 'ouvertes',
      titre: 'Actions ouvertes',
      valeur: String(ouvertes.length),
      detail: parEtat.length ? `dont ${parEtat.join(', ')}` : 'aucune en cours',
      ton: 'neutre',
    },
    {
      cle: 'retard',
      titre: 'En retard',
      valeur: String(retards),
      detail: 'échéance dépassée, non terminée',
      ton: retards ? 'rouge' : 'neutre',
    },
    {
      cle: 'mois',
      titre: 'À échéance ce mois',
      valeur: String(ceMois),
      detail: `d’ici au ${dateCourte(finMois - JOUR, annee)}`,
      ton: ceMois ? 'orange' : 'neutre',
    },
    {
      cle: 'terminees',
      titre: `Terminées en ${annee}`,
      valeur: String(terminees),
      detail: 'd’après la dernière mise à jour de la fiche',
      ton: terminees ? 'vert' : 'neutre',
    },
  ];
}

/** Échéances des lignes montrées par colonne, et parmi elles les actions en retard. */
export function totauxPlan(
  colonnes: readonly { debut: number; fin: number }[],
  lignes: readonly LignePlan[],
): { echeances: number; retards: number }[] {
  return colonnes.map((c) => {
    const dedans = lignes.filter((l) => l.echeance !== null && l.echeance >= c.debut && l.echeance < c.fin);
    return { echeances: dedans.length, retards: dedans.filter((l) => l.retard).length };
  });
}
/** « 10 actions ouvertes · 1 en retard ». */
export function libelleTotalPlan(ouvertes: readonly LignePlan[]): string {
  const r = ouvertes.filter((l) => l.retard).length;
  return [pluriel(ouvertes.length, 'action ouverte', 'actions ouvertes'), ...(r ? [`${r} en retard`] : [])].join(' · ');
}
