/* Recherche et filtres des listes (refonte Verre, règle validée par le RSSI le 27/11/2026, pour toute la plateforme).
   - Moins de 8 éléments (nombre total, avant filtrage) : ni champ de recherche ni puces, sauf si une recherche ou un
     filtre est déjà actif (par l'adresse, par exemple), pour pouvoir l'effacer.
   - Filtres en puces tirées des valeurs présentes, avec leur nombre ; une puce qui ne trierait rien n'est pas affichée.
   - Recherche sans tenir compte de la casse ni des accents, avec surlignage des correspondances.
   Fonctions pures, testées sans navigateur (apps/web/test/recherche-liste.test.ts). */

/** À partir de ce nombre d'éléments, la liste reçoit son champ de recherche et ses puces de filtre. */
export const SEUIL_RECHERCHE_LISTE = 8;
/** Au-delà de ce nombre de valeurs utiles, un critère ne tient plus en puces : il passe dans « Plus de filtres ». */
export const SEUIL_PUCES = 8;

/** Champ de recherche et puces affichés : `total` inconnu (liste servie page à page par une recherche serveur), liste de
    8 éléments ou plus, ou critère déjà actif. */
export function rechercheVisible(total: number | undefined, actif: boolean): boolean {
  return total === undefined || actif || total >= SEUIL_RECHERCHE_LISTE;
}

/** Texte comparable : sans accents ni casse. */
export const normaliser = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');

/** Un des textes contient la recherche (casse et accents ignorés) ; une recherche vide garde tout. Les valeurs qui ne
    sont pas du texte sont ignorées. */
export function correspond(textes: readonly unknown[], recherche: string): boolean {
  const q = normaliser(recherche.trim());
  if (!q) return true;
  return textes.some((t) => typeof t === 'string' && normaliser(t).includes(q));
}

/** Textes d'une fiche : son nom et toutes les valeurs texte de ses données (description, besoins, notes…). */
export function textesFiche(o: { name: string; data?: Record<string, unknown> }, ...autres: unknown[]): unknown[] {
  return [o.name, ...Object.values(o.data ?? {}), ...autres];
}

export interface Segment {
  texte: string;
  trouve: boolean;
}

/** Découpe `texte` autour des correspondances de la recherche (casse et accents ignorés), pour les surligner. Le texte
    d'origine est conservé tel quel, accents compris. */
export function segmentsSurlignes(texte: string, recherche: string): Segment[] {
  const q = normaliser(recherche.trim());
  if (!q || !texte) return [{ texte, trouve: false }];
  // Correspondance entre le texte normalisé et le texte d'origine (une lettre accentuée peut changer de longueur).
  let norme = '';
  const debut: number[] = [],
    fin: number[] = [];
  let pos = 0;
  for (const c of Array.from(texte)) {
    const n = normaliser(c);
    // Accent isolé (texte déjà décomposé) : rattaché à la lettre qui le précède.
    if (!n && fin.length) fin[fin.length - 1] = pos + c.length;
    for (let k = 0; k < n.length; k++) {
      debut.push(pos);
      fin.push(pos + c.length);
    }
    norme += n;
    pos += c.length;
  }
  const out: Segment[] = [];
  let curseur = 0;
  for (let i = norme.indexOf(q); i >= 0; i = norme.indexOf(q, i + q.length)) {
    const s = debut[i]!,
      e = fin[i + q.length - 1]!;
    if (s < curseur) continue;
    if (s > curseur) out.push({ texte: texte.slice(curseur, s), trouve: false });
    out.push({ texte: texte.slice(s, e), trouve: true });
    curseur = e;
  }
  if (curseur < texte.length) out.push({ texte: texte.slice(curseur), trouve: false });
  return out.length ? out : [{ texte, trouve: false }];
}

/** Ton d'une puce : « alerte » (ambre) pour une valeur qui demande une action (échéance dépassée, revue à faire). */
export type TonPuce = 'alerte';

export interface OptionPuce {
  value: string;
  label: string;
  compte: number;
  ton?: TonPuce;
}

/** Nombre d'éléments par valeur d'un critère. Une valeur vide (null, undefined, '') n'est pas comptée ; un élément à
    plusieurs valeurs (étiquettes) compte pour chacune. `ordre` donne les valeurs connues du critère (comptées même à 0,
    pour qu'une valeur retenue par l'adresse garde son libellé) et leur ordre, les autres valeurs suivent ; sans `ordre`,
    du plus fréquent au moins fréquent, puis alphabétique. */
export function compterPuces<T>(
  items: readonly T[],
  valeurDe: (o: T) => string | readonly string[] | null | undefined,
  options: {
    libelle?: (v: string) => string;
    ordre?: readonly string[];
    ton?: (v: string) => TonPuce | undefined;
  } = {},
): OptionPuce[] {
  const comptes = new Map<string, number>((options.ordre ?? []).map((v) => [v, 0]));
  for (const o of items) {
    const v = valeurDe(o);
    for (const x of new Set(typeof v === 'string' ? [v] : (v ?? []))) {
      if (x) comptes.set(x, (comptes.get(x) ?? 0) + 1);
    }
  }
  const out = [...comptes].map(([value, compte]) => {
    const ton = options.ton?.(value);
    return { value, label: options.libelle?.(value) ?? value, compte, ...(ton ? { ton } : {}) };
  });
  const rang = (v: string) => {
    const i = options.ordre?.indexOf(v) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return out.sort((a, b) =>
    options.ordre
      ? rang(a.value) - rang(b.value) || a.label.localeCompare(b.label, 'fr')
      : b.compte - a.compte || a.label.localeCompare(b.label, 'fr'),
  );
}

/** Puces utiles d'un critère : une puce qui ne trierait rien n'est pas affichée (aucun élément, ou tous les éléments de
    la liste, ce qui arrive quand c'est la seule valeur). La puce active reste toujours affichée, pour pouvoir la retirer. */
export function pucesUtiles(options: readonly OptionPuce[], total: number, active: string | null): OptionPuce[] {
  return options.filter((o) => o.value === active || (o.compte > 0 && o.compte < total));
}
