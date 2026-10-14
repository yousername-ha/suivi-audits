/* Sélecteurs partagés (ADR 0038) : une seule source pour les personnes responsables et pour les périmètres, au lieu de
   copies locales de la même requête. Mêmes clés de requête que les écrans existants : le cache est commun et le temps réel
   continue de les rafraîchir. */
import { Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';

export interface Responsable {
  id: string;
  displayName: string;
  username: string;
}
export const libelleResponsable = (r: Pick<Responsable, 'displayName' | 'username'>) => r.displayName || r.username;

/** Personnes pouvant être désignées responsables dans un périmètre. */
export const useResponsables = (smsi: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ['grc', smsi, 'owners'],
    queryFn: () => get<Responsable[]>(`/api/grc/${smsi}/owners`),
    enabled: enabled && !!smsi,
  });

export function SelecteurResponsable({
  smsi,
  value,
  onChange,
  disabled,
  label = 'Responsable',
  sansRecherche,
}: {
  smsi: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  label?: string;
  /** Désactive la recherche dans la liste (listes courtes ou filtres). */
  sansRecherche?: boolean;
}) {
  const q = useResponsables(smsi);
  return (
    <Select
      label={label}
      searchable={!sansRecherche}
      clearable
      data={(q.data ?? []).map((o) => ({ value: o.id, label: libelleResponsable(o) }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export interface Perimetre {
  id: string;
  name: string;
}
/** Périmètres visibles de la personne connectée. */
export const usePerimetres = (enabled = true) =>
  useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<Perimetre[]>('/api/grc/smsis'),
    enabled,
  });

export function SelecteurPerimetre({
  value,
  onChange,
  disabled,
  label = 'Périmètre',
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const q = usePerimetres();
  return (
    <Select
      label={label}
      data={(q.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
