/* Sélecteurs partagés (ADR 0038) : une seule source pour les personnes responsables et pour les périmètres, au lieu de
   copies locales de la même requête. Mêmes clés de requête que les écrans existants : le cache est commun et le temps réel
   continue de les rafraîchir. */
import { Select } from '@mantine/core';
import type { ResponsableRef, ResponsablesProposables } from '@suivi/shared';
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

/** Personnes, groupes et fonctions pouvant être désignés responsables dans un périmètre. */
export const useProposables = (smsi: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ['grc', smsi, 'responsables'],
    queryFn: () => get<ResponsablesProposables>(`/api/grc/${smsi}/responsables`),
    enabled: enabled && !!smsi,
  });

/** Désignation portée par une fiche : une personne (`ownerId`) ou un groupe/une fonction (`responsable`). */
export function designation(data: Record<string, unknown>): ResponsableRef | null {
  const r = data.responsable as ResponsableRef | null | undefined;
  if (r && typeof r === 'object') return r;
  return typeof data.ownerId === 'string' ? { type: 'utilisateur', id: data.ownerId } : null;
}

/** Libellé d'une désignation (repli sur l'étiquette historique ou « Non attribué »). */
export function libelleDesignation(data: Record<string, unknown>, p: ResponsablesProposables | undefined): string {
  const d = designation(data);
  if (!d) return String(data.ownerLabel || 'Non attribué');
  const liste = d.type === 'utilisateur' ? p?.utilisateurs : d.type === 'groupe' ? p?.groupes : p?.fonctions;
  const trouve = liste?.find((x) => x.id === d.id);
  if (!trouve) return d.type === 'utilisateur' ? String(data.ownerLabel || 'Non attribué') : 'Responsable archivé';
  const nom = 'name' in trouve ? trouve.name : trouve.displayName || trouve.username;
  return d.type === 'utilisateur' ? nom : `${d.type === 'groupe' ? 'Groupe' : 'Fonction'} ${nom}`;
}

/** Sélecteur unique : la valeur est `type:id` ; une personne reste portée par `ownerId`, le reste par `responsable`. */
export function SelecteurResponsableTypé({
  smsi,
  data,
  onChange,
  disabled,
  label = 'Responsable',
}: {
  smsi: string;
  data: Record<string, unknown>;
  onChange: (patch: { ownerId: string | null; responsable: ResponsableRef | null }) => void;
  disabled?: boolean;
  label?: string;
}) {
  const q = useProposables(smsi);
  const p = q.data;
  const d = designation(data);
  return (
    <Select
      label={label}
      searchable
      clearable
      data={[
        {
          group: 'Personnes',
          items: (p?.utilisateurs ?? []).map((u) => ({ value: `utilisateur:${u.id}`, label: libelleResponsable(u) })),
        },
        {
          group: 'Groupes',
          items: (p?.groupes ?? []).map((g) => ({ value: `groupe:${g.id}`, label: `${g.name} (${g.membres})` })),
        },
        {
          group: 'Fonctions',
          items: (p?.fonctions ?? []).map((f) => ({ value: `fonction:${f.id}`, label: `${f.name} (${f.membres})` })),
        },
      ].filter((g) => g.items.length)}
      value={d ? `${d.type}:${d.id}` : null}
      onChange={(v) => {
        if (!v) return onChange({ ownerId: null, responsable: null });
        const [type, id] = v.split(':') as [ResponsableRef['type'], string];
        onChange(
          type === 'utilisateur' ? { ownerId: id, responsable: null } : { ownerId: null, responsable: { type, id } },
        );
      }}
      disabled={disabled}
    />
  );
}
