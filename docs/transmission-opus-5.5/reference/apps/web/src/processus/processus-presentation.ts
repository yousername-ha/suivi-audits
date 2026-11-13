import type { CarteProcessus, NatureRattachement, TypeProcessusDto } from '@suivi/shared';

export const SANS_TYPE_PROCESSUS = '__sans_type__';
export interface FiltresProcessus {
  recherche: string;
  type: string;
  pilote: string;
  rattachement: NatureRattachement | '';
}
const normaliser = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');

export function filtrerProcessus(
  processus: CarteProcessus[],
  types: TypeProcessusDto[],
  filtres: FiltresProcessus,
  indisponibles: NatureRattachement[] = [],
) {
  const recherche = normaliser(filtres.recherche.trim());
  return processus.filter(
    (p) =>
      (!filtres.type || (p.family || SANS_TYPE_PROCESSUS) === filtres.type) &&
      (!filtres.pilote || p.owner === filtres.pilote) &&
      (!filtres.rattachement ||
        (!indisponibles.includes(filtres.rattachement) && !!p.rattaches[filtres.rattachement]?.length)) &&
      (!recherche ||
        normaliser(
          [p.id, p.name, p.owner, p.purpose, p.family, types.find((t) => t.code === p.family)?.label ?? ''].join(' '),
        ).includes(recherche)),
  );
}

/** Un enfant correspondant reste visible lorsque son parent ne correspond pas au filtre. */
export function regrouperProcessus(visibles: CarteProcessus[], types: TypeProcessusDto[]) {
  const ids = new Set(visibles.map((p) => p.id));
  const racines = visibles.filter((p) => !p.parent || !ids.has(p.parent));
  const codes = [...new Set([...types.map((t) => t.code), ...racines.map((p) => p.family)])];
  return codes
    .map((code) => ({
      code,
      type: types.find((t) => t.code === code),
      racines: racines.filter((p) => p.family === code),
    }))
    .filter((g) => g.racines.length);
}

/** Exclut également les descendants éloignés du sélecteur de parent existant. */
export function parentsPossibles(processus: CarteProcessus[], id: string) {
  return processus.filter((p) => {
    const visited = new Set([p.id]);
    if (p.id === id) return false;
    let parent = p.parent;
    while (parent) {
      if (parent === id || visited.has(parent)) return false;
      visited.add(parent);
      parent = processus.find((x) => x.id === parent)?.parent ?? '';
    }
    return true;
  });
}
