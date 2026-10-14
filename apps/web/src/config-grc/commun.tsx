/* Types, requêtes et petits composants communs de la configuration GRC (ADR 0038). Les mêmes éléments sont lus et écrits
   depuis Paramètres → Configuration GRC et Gestion des risques → Configuration des analyses : un seul stockage, une seule API. */
import { Select } from '@mantine/core';
import type { CfgFamily, CfgKind, CfgRef, CfgScope, CfgState, ScaleDiff } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';

export interface ElementListe {
  id: string;
  kind: CfgKind;
  key: string;
  scope: CfgScope;
  smsiId: string | null;
  state: CfgState;
  currentVersion: number | null;
  version: number;
  name: string;
  category: string;
  appliesTo: 'all' | CfgFamily[];
  usages: number;
  derivedCount: number;
  derivedFrom: { id: string; version: number } | null;
  origin: Record<string, unknown>;
  updatedAt: string;
}
export interface ElementDetail extends ElementListe {
  draft: Record<string, unknown> | null;
  definition: Record<string, unknown> | null;
  versions: { version: number; reason: string; createdBy: string; createdAt: string }[];
}
export interface Simulation {
  valid: boolean;
  errors: string[];
  changed: boolean;
  currentVersion: number | null;
  nextVersion: number;
  previewId: string;
  impact: { pinnedConsumers: number; scaleDiff: ScaleDiff | null; note: string };
}
export interface Usage {
  itemVersion: number;
  consumerKind: 'cfg_version' | 'method_version' | 'analysis';
  consumerId: string;
  consumerVersion: number;
  createdBy: string;
  createdAt: string;
  label: string | null;
}
export interface ModeleListe {
  id: string;
  label: string;
  description: string;
  note: string;
  items: { ref: string; kind: CfgKind; key: string }[];
}
export type Definition = Record<string, unknown>;

export const USAGE_LABELS: Record<Usage['consumerKind'], string> = {
  cfg_version: 'Élément de configuration',
  method_version: 'Méthode d’analyse',
  analysis: 'Analyse',
};

export const useElements = (kind?: CfgKind, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ ...(kind ? { kind } : {}), ...extra });
  return useQuery({
    queryKey: ['config-grc', 'liste', params.toString()],
    queryFn: () => get<ElementListe[]>(`/api/config-grc/items?${params}`),
  });
};
export const useElement = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['config-grc', 'element', id],
    queryFn: () => get<ElementDetail>(`/api/config-grc/items/${id}`),
    enabled: !!id,
  });
export const useVersion = (ref: CfgRef | null | undefined) =>
  useQuery({
    queryKey: ['config-grc', 'version', ref?.item, ref?.version],
    queryFn: () => get<{ definition: Definition }>(`/api/config-grc/items/${ref!.item}/versions/${ref!.version}`),
    enabled: !!ref,
    // Une version publiée est immuable : inutile de la relire.
    staleTime: Infinity,
  });

/** Identifiant technique proposé à partir d'un libellé : minuscules sans accents, unique parmi ceux déjà pris. */
export function cleDepuis(libelle: string, pris: Iterable<string>, prefixe = 'n') {
  const used = new Set(pris);
  const base =
    libelle
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || prefixe;
  const start = /^[a-z]/.test(base) ? base : `${prefixe}_${base}`;
  let k = start;
  for (let i = 2; used.has(k); i++) k = `${start}_${i}`;
  return k;
}

/** Sélecteur d'échelle (ou d'un autre type d'élément) du catalogue, épinglé à une version publiée précise. */
export function SelecteurElement({
  label,
  kind = 'scale',
  value,
  onChange,
  family,
  disabled,
  description,
}: {
  label: string;
  kind?: CfgKind;
  value: CfgRef | null;
  onChange: (v: CfgRef | null) => void;
  family?: CfgFamily;
  disabled?: boolean;
  description?: string;
}) {
  const list = useElements(kind, family ? { family } : {});
  const detail = useElement(value?.item);
  const options = (list.data ?? [])
    .filter((e) => e.currentVersion && (e.state !== 'archived' || e.id === value?.item))
    .map((e) => ({ value: e.id, label: `${e.name} (${e.key})` }));
  return (
    <div className="selecteur-element">
      <Select
        label={label}
        description={description}
        placeholder={options.length ? 'Choisir dans le catalogue' : 'Aucun élément publié dans le catalogue'}
        nothingFoundMessage="Aucun élément publié"
        searchable
        clearable
        disabled={disabled}
        data={options}
        value={value?.item ?? null}
        onChange={(id) => {
          const e = list.data?.find((x) => x.id === id);
          onChange(id && e?.currentVersion ? { item: id, version: e.currentVersion } : null);
        }}
      />
      {value && (
        <Select
          label="Version épinglée"
          description="Une version publiée ne change jamais."
          disabled={disabled || !detail.data}
          allowDeselect={false}
          data={(detail.data?.versions ?? [{ version: value.version }]).map((v) => ({
            value: String(v.version),
            label: `Version ${v.version}${v.version === detail.data?.currentVersion ? ' (courante)' : ''}`,
          }))}
          value={String(value.version)}
          onChange={(v) => v && onChange({ item: value.item, version: Number(v) })}
        />
      )}
    </div>
  );
}
