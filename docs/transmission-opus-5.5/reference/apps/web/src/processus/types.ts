/* Types de processus (registre de la Plateforme) lus par les écrans qui classent un processus : fiche du Pilotage,
   création depuis la cartographie, page des processus. */
import { useQuery } from '@tanstack/react-query';
import type { TypeProcessusDto } from '@suivi/shared';
import { get } from '../api';

export const TYPES_PROCESSUS_KEY = ['types-processus'] as const;

export function useTypesProcessus() {
  return useQuery({
    queryKey: TYPES_PROCESSUS_KEY,
    queryFn: () => get<TypeProcessusDto[]>('/api/types-processus'),
    staleTime: 60_000,
  });
}

/** Options d'un sélecteur : les types actifs, plus le type courant s'il est archivé (le processus le garde). */
export function optionsTypesProcessus(types: TypeProcessusDto[] | undefined, courant?: string) {
  return (types ?? [])
    .filter((t) => !t.archived || t.code === courant)
    .map((t) => ({ value: t.code, label: t.archived ? `${t.label} (archivé)` : t.label }));
}

/** Libellé d'un type d'après le code porté par le processus (le code brut si le type est inconnu). */
export const libelleType = (types: TypeProcessusDto[] | undefined, code: string | undefined) =>
  (code && types?.find((t) => t.code === code)?.label) || code || '';
