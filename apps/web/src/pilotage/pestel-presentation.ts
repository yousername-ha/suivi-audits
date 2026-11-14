/* PESTEL Studio (refonte Neon, lot 5) : adaptation de lecture de la vue renvoyée par l'API PESTEL existante. Les facteurs
   sont ceux de la nomenclature du périmètre (politique métier), dans leur ordre : aucune liste n'est imposée à la donnée.
   Les six teintes ne servent qu'à la présentation ; un facteur propre à l'organisme reçoit une teinte par rang. */
import type { EnjeuPestel, FacteurPestel, VuePestel } from '@suivi/shared';

export const TEINTES_PESTEL = [
  'politique',
  'economique',
  'social',
  'technologique',
  'environnemental',
  'legal',
] as const;
export type TeintePestel = (typeof TEINTES_PESTEL)[number];
/** Libellés voisins reconnus pour la teinte et le pictogramme (présentation seulement). */
const SYNONYMES: Record<string, TeintePestel> = {
  juridique: 'legal',
  reglementaire: 'legal',
  ecologique: 'environnemental',
  environnement: 'environnemental',
  technique: 'technologique',
  technologie: 'technologique',
  societal: 'social',
  economie: 'economique',
};
/** Au-delà de six facteurs, ou avec un libellé long, la constellation devient une grille dans la même charte. */
export const FACTEURS_EN_CERCLE = 6;
export const LIBELLE_COURT = 20;

export const normaliserPestel = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const teinteConnue = (v: string): TeintePestel | undefined => {
  const n = normaliserPestel(v);
  return TEINTES_PESTEL.find((t) => t === n) ?? SYNONYMES[n];
};

export interface GroupePestel {
  facteur: FacteurPestel;
  enjeux: EnjeuPestel[];
  teinte: TeintePestel;
  /** Pictogramme du facteur usuel, sinon pictogramme générique. */
  icone: TeintePestel | 'globe';
  lettre: string;
  connue: boolean;
}

/** Facteurs de la nomenclature, dans son ordre, avec leurs enjeux externes classés. */
export function groupesPestel(vue: VuePestel): GroupePestel[] {
  return vue.facteurs.map((facteur, rang) => {
    const connue = teinteConnue(facteur.id) ?? teinteConnue(facteur.label);
    return {
      facteur,
      enjeux: vue.parFacteur.find((g) => g.facteur.id === facteur.id)?.enjeux ?? [],
      teinte: connue ?? TEINTES_PESTEL[rang % TEINTES_PESTEL.length]!,
      icone: connue ?? 'globe',
      lettre: Array.from(facteur.label.trim())[0]?.toUpperCase() ?? '•',
      connue: !!connue,
    };
  });
}

/** Facteur affiché : celui de l'adresse s'il existe encore, sinon le premier qui a des enjeux, sinon le premier. */
export function facteurAffiche(groupes: readonly GroupePestel[], demande: string | null) {
  return groupes.find((g) => g.facteur.id === demande) ?? groupes.find((g) => g.enjeux.length) ?? groupes[0];
}

export const constellationDense = (groupes: readonly GroupePestel[]) =>
  groupes.length > FACTEURS_EN_CERCLE || groupes.some((g) => g.facteur.label.length > LIBELLE_COURT);

const NOMBRES = ['', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six'];
export function titrePerspectives(n: number) {
  return n
    ? `Une vue d’ensemble, ${NOMBRES[n] ?? n} perspective${n > 1 ? 's' : ''}`
    : 'Une vue d’ensemble des enjeux externes';
}

/** Tous les enjeux externes : classés (dans l'ordre des facteurs), puis non classés. Les internes restent à part. */
export const enjeuxExternes = (vue: VuePestel) => [...vue.parFacteur.flatMap((g) => g.enjeux), ...vue.nonClasses];

/** Recherche du registre : intitulé, description, référence et nom des processus, facteur (« Non classé » compris). */
export function filtrerEnjeux(
  enjeux: readonly EnjeuPestel[],
  recherche: string,
  facteurs: readonly FacteurPestel[],
  processus: ReadonlyMap<string, string>,
) {
  const filtre = normaliserPestel(recherche);
  if (!filtre) return [...enjeux];
  return enjeux.filter((e) =>
    normaliserPestel(
      [
        e.label,
        e.description,
        e.ref,
        ...e.processus,
        ...e.processus.map((p) => processus.get(p) ?? ''),
        facteurs.find((f) => f.id === e.facteur)?.label ?? 'Non classé',
      ].join(' '),
    ).includes(filtre),
  );
}

/** Processus d'un enjeu : nom lu dans les cartes des processus ; une référence non résolue reste affichée telle quelle. */
export function processusEnjeu(enjeu: EnjeuPestel, noms: ReadonlyMap<string, string>) {
  return enjeu.processus.map((code) => {
    const nom = noms.get(code);
    return { code, nom: nom ?? code, resolu: nom !== undefined && nom !== code };
  });
}
