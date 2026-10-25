/* Travaux déjà réalisés dans les modules, relus pour le périmètre affiché (024-F04, F05, INT-03). Le parcours ne recopie rien :
   il interroge les listes que les modules exposent déjà (`GET /api/grc/:smsi/objects?kind=…`, déjà filtrées par droits,
   périmètres et registres restreints) et renvoie vers la fiche d'origine par son identifiant. La clé de cache porte le
   périmètre : aucune donnée d'un périmètre précédent ne survit à un changement de périmètre, et les mises à jour en
   direct des modules (`['grc', <périmètre>, …]`) rafraîchissent aussi ces relevés. */
import { useQueries } from '@tanstack/react-query';
import { GRC_LABELS, GRC_MODULES, type GrcKind, type GrcObject } from '@suivi/shared';
import { get } from '../api';
import { useCan } from '../session';

export type EtatTravaux = 'chargement' | 'ok' | 'erreur' | 'refuse';
export interface TravauxDuType {
  kind: GrcKind;
  libelle: string;
  etat: EtatTravaux;
  /** Nombre total d'éléments non archivés du type dans le périmètre (null tant qu'il est inconnu). */
  total: number | null;
  /** Premiers éléments (les plus récemment modifiés), pour les ouvrir par leur identifiant. */
  elements: { id: string; name: string }[];
  /** Relecture en erreur : message à afficher, la saisie ailleurs n'est pas touchée. */
  erreur?: unknown;
}
interface Liste {
  items: GrcObject[];
  total: number;
}

/** Relevé des travaux existants pour une liste de types, dans un périmètre. Un type dont la personne ne peut pas lire le module
    n'est pas interrogé : son état est « refusé », jamais un zéro. */
export function useTravauxExistants(smsi: string, kinds: readonly GrcKind[]): Record<string, TravauxDuType> {
  const can = useCan();
  const distincts = [...new Set(kinds)];
  const lisibles = distincts.filter((k) => can(GRC_MODULES[k], 'lire'));
  const resultats = useQueries({
    queries: lisibles.map((kind) => ({
      queryKey: ['grc', smsi, 'parcours-iso', kind] as const,
      queryFn: () => get<Liste>(`/api/grc/${smsi}/objects?kind=${kind}`),
      staleTime: 30_000,
      retry: false,
    })),
  });
  const out: Record<string, TravauxDuType> = {};
  for (const kind of distincts) {
    const base = { kind, libelle: GRC_LABELS[kind], total: null, elements: [] as { id: string; name: string }[] };
    const i = lisibles.indexOf(kind);
    if (i < 0) {
      out[kind] = { ...base, etat: 'refuse' };
      continue;
    }
    const r = resultats[i]!;
    out[kind] = r.data
      ? {
          ...base,
          etat: 'ok',
          total: r.data.total,
          elements: r.data.items.slice(0, 8).map((o) => ({ id: o.id, name: o.name })),
        }
      : r.isError
        ? { ...base, etat: 'erreur', erreur: r.error }
        : { ...base, etat: 'chargement' };
  }
  return out;
}

/** Résumé d'une sous-action ou d'une étape : présence de travaux, jamais un niveau de conformité. */
export type PresenceTravaux = 'presents' | 'aucun' | 'chargement' | 'indisponible' | 'non-compte';
export function presence(travaux: Record<string, TravauxDuType>, kinds: readonly GrcKind[]): PresenceTravaux {
  if (!kinds.length) return 'non-compte';
  const liste = kinds.map((k) => travaux[k]).filter((t): t is TravauxDuType => !!t);
  if (liste.some((t) => t.etat === 'ok' && (t.total ?? 0) > 0)) return 'presents';
  if (liste.some((t) => t.etat === 'chargement')) return 'chargement';
  if (liste.every((t) => t.etat === 'refuse' || t.etat === 'erreur')) return 'indisponible';
  return 'aucun';
}
export const LIBELLE_PRESENCE: Record<PresenceTravaux, string> = {
  presents: 'Travaux présents',
  aucun: 'Aucun travail trouvé',
  chargement: 'Relecture en cours',
  indisponible: 'Relevé indisponible',
  'non-compte': 'Non compté ici',
};
