/* Hiérarchie des périmètres de management : arbre parent/enfant sans cycle et héritage explicite des référentiels. Un
   périmètre est une organisation ou un fournisseur, rien d'autre (amendement de l'ADR 0039, 01/11/2026) : une organisation
   A peut avoir pour enfants les organisations B et C et le fournisseur F ; un fournisseur n'a pour enfants que des
   fournisseurs (ses sous-traitants). Fonctions pures, partagées par l'API (contrôle avant écriture) et l'interface
   (arbre, sélecteur de parent). La base impose les mêmes règles par un déclencheur (migration 022). */

export const TYPES_PERIMETRE = ['organisation', 'fournisseur'] as const;
export type TypePerimetre = (typeof TYPES_PERIMETRE)[number];
export const LIBELLES_TYPE_PERIMETRE: Record<TypePerimetre, string> = {
  organisation: 'Organisation',
  fournisseur: 'Fournisseur',
};
/** Libellé du type d'un périmètre ; une valeur inconnue (donnée antérieure non migrée) s'affiche telle quelle. */
export const libelleTypePerimetre = (type: string): string =>
  (LIBELLES_TYPE_PERIMETRE as Record<string, string>)[type] ?? type;

/** Un parent de type `typeParent` peut-il recevoir un enfant de type `typeEnfant` ? Sous un fournisseur, seulement des
    fournisseurs ; sous une organisation, tout. */
export const parentPermis = (typeEnfant: TypePerimetre, typeParent: TypePerimetre): boolean =>
  typeParent === 'organisation' || typeEnfant === 'fournisseur';

export type RefusType = 'organisation-sous-fournisseur' | 'fournisseur-avec-organisations';
/** Vérifie le type d'un périmètre `id` (vide à la création) rattaché à `parentId` : `null` si la combinaison est permise. */
export function refusType(
  noeuds: readonly { id: string; parentId: string | null; type: TypePerimetre }[],
  id: string,
  type: TypePerimetre,
  parentId: string | null,
): RefusType | null {
  const parent = parentId ? noeuds.find((n) => n.id === parentId) : undefined;
  if (parent && !parentPermis(type, parent.type)) return 'organisation-sous-fournisseur';
  if (
    type === 'fournisseur' &&
    id &&
    noeuds.some((n) => n.parentId === id && n.id !== id && !parentPermis(n.type, 'fournisseur'))
  )
    return 'fournisseur-avec-organisations';
  return null;
}
export const MESSAGES_REFUS_TYPE: Record<RefusType, string> = {
  'organisation-sous-fournisseur':
    'Une organisation ne peut pas être rattachée à un fournisseur : seul un fournisseur peut l’être.',
  'fournisseur-avec-organisations':
    'Ce périmètre a des organisations enfants : il ne peut pas devenir un fournisseur. Rattachez-les d’abord ailleurs.',
};

export interface NoeudPerimetre {
  id: string;
  parentId: string | null;
  inheritFrameworks: boolean;
}

/** Profondeur maximale acceptée (garde-fou contre une saisie absurde, sans lien avec une règle normative). */
export const PROFONDEUR_MAX_PERIMETRES = 8;

const index = (noeuds: readonly NoeudPerimetre[]) => new Map(noeuds.map((n) => [n.id, n]));

/** Ancêtres d'un nœud, du parent direct vers la racine. S'arrête si une boucle est rencontrée (données corrompues). */
export function ancetres(noeuds: readonly NoeudPerimetre[], id: string): string[] {
  const par = index(noeuds),
    vus = new Set<string>([id]),
    out: string[] = [];
  let courant = par.get(id)?.parentId ?? null;
  while (courant && !vus.has(courant)) {
    out.push(courant);
    vus.add(courant);
    courant = par.get(courant)?.parentId ?? null;
  }
  return out;
}

/** Descendants (tous niveaux) d'un nœud ; avec `heritiersSeulement`, uniquement la chaîne qui hérite des référentiels. */
export function descendants(noeuds: readonly NoeudPerimetre[], id: string, heritiersSeulement = false): string[] {
  const out: string[] = [],
    vus = new Set<string>([id]);
  let front = [id];
  while (front.length) {
    const suivants: string[] = [];
    for (const n of noeuds)
      if (n.parentId && front.includes(n.parentId) && !vus.has(n.id) && (!heritiersSeulement || n.inheritFrameworks)) {
        vus.add(n.id);
        out.push(n.id);
        suivants.push(n.id);
      }
    front = suivants;
  }
  return out;
}

export type RefusParent = 'inconnu' | 'soi-meme' | 'cycle' | 'profondeur';

/** Vérifie qu'on peut rattacher `id` à `parentId` (null : racine). Renvoie `null` si le rattachement est valide. */
export function refusRattachement(
  noeuds: readonly NoeudPerimetre[],
  id: string,
  parentId: string | null,
): RefusParent | null {
  if (parentId === null) return null;
  if (parentId === id) return 'soi-meme';
  if (!noeuds.some((n) => n.id === parentId)) return 'inconnu';
  if (descendants(noeuds, id).includes(parentId)) return 'cycle';
  // Profondeur du parent + 1 (le nœud) + hauteur de son sous-arbre.
  const parNoeud = index(noeuds);
  const hauteur = (n: string): number => {
    const enfants = noeuds.filter((x) => x.parentId === n && x.id !== id).map((x) => x.id);
    return enfants.length ? 1 + Math.max(...enfants.map(hauteur)) : 0;
  };
  const sousArbre = noeuds.some((x) => x.parentId === id) ? hauteur(id) : 0;
  const niveau = ancetres(noeuds, parentId).length + 2 + sousArbre;
  return niveau > PROFONDEUR_MAX_PERIMETRES || !parNoeud.has(parentId) ? 'profondeur' : null;
}
export const MESSAGES_REFUS: Record<RefusParent, string> = {
  inconnu: 'Le périmètre parent est introuvable.',
  'soi-meme': 'Un périmètre ne peut pas être son propre parent.',
  cycle: 'Ce rattachement créerait une boucle : le parent choisi dépend déjà de ce périmètre.',
  profondeur: `La hiérarchie est limitée à ${PROFONDEUR_MAX_PERIMETRES} niveaux.`,
};

export interface RattachementReferentiel {
  frameworkId: string;
  version: number;
  enabled: boolean;
  /** Périmètre porteur du rattachement. */
  origineId: string;
}
export interface ReferentielEffectif extends RattachementReferentiel {
  heritage: boolean;
}

/** Référentiels effectifs d'un périmètre : les siens, plus ceux de ses ancêtres tant que la chaîne `inheritFrameworks`
    n'est pas interrompue. Un rattachement du périmètre (actif ou non) l'emporte sur celui d'un ancêtre pour le même
    référentiel : désactiver un référentiel hérité se fait donc en le rattachant localement, désactivé. */
export function referentielsEffectifs(
  noeuds: readonly NoeudPerimetre[],
  id: string,
  rattachements: readonly RattachementReferentiel[],
): ReferentielEffectif[] {
  const par = index(noeuds),
    chaine: string[] = [id];
  let courant = par.get(id);
  while (courant?.inheritFrameworks && courant.parentId && !chaine.includes(courant.parentId)) {
    chaine.push(courant.parentId);
    courant = par.get(courant.parentId);
  }
  const retenus = new Map<string, ReferentielEffectif>();
  for (const origine of chaine)
    for (const r of rattachements)
      if (r.origineId === origine && !retenus.has(r.frameworkId))
        retenus.set(r.frameworkId, { ...r, heritage: origine !== id });
  return [...retenus.values()];
}

export interface NoeudArbre<T> {
  item: T;
  profondeur: number;
  enfants: NoeudArbre<T>[];
}
/** Arbre d'affichage : les éléments dont le parent est absent de la liste (non accessible) deviennent des racines. */
export function arbre<T extends { id: string; parentId: string | null; name: string }>(
  items: readonly T[],
): NoeudArbre<T>[] {
  const ids = new Set(items.map((i) => i.id)),
    parNom = (a: T, b: T) => a.name.localeCompare(b.name, 'fr'),
    construire = (parent: string | null, profondeur: number, vus: Set<string>): NoeudArbre<T>[] =>
      items
        .filter((i) => (parent === null ? i.parentId === null || !ids.has(i.parentId) : i.parentId === parent))
        .filter((i) => !vus.has(i.id))
        .sort(parNom)
        .map((item) => {
          const v = new Set(vus).add(item.id);
          return { item, profondeur, enfants: construire(item.id, profondeur + 1, v) };
        });
  return construire(null, 0, new Set());
}
/** Parcours à plat de l'arbre (ordre d'affichage). */
export function aplatir<T>(noeuds: readonly NoeudArbre<T>[]): { item: T; profondeur: number }[] {
  return noeuds.flatMap((n) => [{ item: n.item, profondeur: n.profondeur }, ...aplatir(n.enfants)]);
}
