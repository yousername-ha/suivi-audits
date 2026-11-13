/* Sélecteur d'une extrémité de correspondance (référentiel, version, exigence de la bibliothèque), partagé par les critères
   des fournisseurs. Extrait de la page « Correspondances de la bibliothèque », retirée (ADR 0089). */
import { Select, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { FrameworkDefinition } from '@suivi/shared';
import { get } from '../api';

interface Referentiel {
  id: string;
  name: string;
  version: number;
}
interface Extremite {
  frameworkId: string;
  version: string;
  requirementId: string;
}

export function ExtremiteChamps({
  titre,
  valeur,
  referentiels,
  onChange,
}: {
  titre: string;
  valeur: Extremite;
  referentiels: Referentiel[];
  onChange: (v: Extremite) => void;
}) {
  const fw = referentiels.find((r) => r.id === valeur.frameworkId);
  const exigences = useQuery({
    queryKey: ['library', 'frameworks', valeur.frameworkId, valeur.version],
    queryFn: () =>
      get<{ definition: FrameworkDefinition }>(
        `/api/library/frameworks/${valeur.frameworkId}/versions/${valeur.version}`,
      ),
    enabled: !!valeur.frameworkId && !!valeur.version,
  });
  return (
    <Stack gap="xs">
      <Text fw={600}>{titre}</Text>
      <Select
        label={`Référentiel (${titre.toLowerCase()})`}
        data={referentiels.map((r) => ({ value: r.id, label: r.name }))}
        value={valeur.frameworkId || null}
        onChange={(v) =>
          onChange({
            frameworkId: v ?? '',
            version: v ? String(referentiels.find((r) => r.id === v)!.version) : '',
            requirementId: '',
          })
        }
      />
      {fw && (
        <Select
          label={`Version (${titre.toLowerCase()})`}
          allowDeselect={false}
          data={Array.from({ length: fw.version }, (_, i) => ({
            value: String(fw.version - i),
            label: `Version ${fw.version - i}`,
          }))}
          value={valeur.version}
          onChange={(v) => onChange({ ...valeur, version: v ?? '', requirementId: '' })}
        />
      )}
      <Select
        label={`Exigence (${titre.toLowerCase()})`}
        searchable
        limit={50}
        nothingFoundMessage="Aucune exigence"
        data={(exigences.data?.definition.requirements ?? []).map((r) => ({
          value: r.id,
          label: `${r.id} · ${r.title}`,
        }))}
        value={valeur.requirementId || null}
        onChange={(v) => onChange({ ...valeur, requirementId: v ?? '' })}
        disabled={!exigences.data}
      />
    </Stack>
  );
}
