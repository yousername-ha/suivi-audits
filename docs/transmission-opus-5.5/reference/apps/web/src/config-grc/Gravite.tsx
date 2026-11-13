/* Atelier 1 d'une étude EBIOS RM sur le catalogue (ADR 0038) : l'étude épingle une correspondance impact → gravité ; la fiche
   d'un événement redouté relève ses impacts sur l'échelle d'impact et reçoit la gravité PROPOSÉE (agrégation définie par la
   correspondance). La gravité retenue reste décidée par l'analyste. */
import { ActionIcon, Alert, Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import {
  aggregateMapped,
  MappingDefinition,
  ScaleDefinition,
  type ScaleLevel,
  type StudyConfiguration,
} from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { useVersion } from './commun';

interface Impact {
  category: string | null;
  level: string;
}

/** Correspondance impact → gravité épinglée par l'étude d'un événement redouté, avec ses deux échelles ; null sans liaison. */
export function useGravite(smsi: string | undefined, studyRef: unknown) {
  const id = typeof studyRef === 'string' && studyRef.startsWith('object:') ? studyRef.slice('object:'.length) : null;
  const study = useQuery({
    queryKey: ['grc', smsi, 'object', id],
    queryFn: () => get<{ data: { configuration?: StudyConfiguration | null } }>(`/api/grc/${smsi}/objects/${id}`),
    enabled: !!smsi && !!id,
  });
  const mapping = useVersion(study.data?.data.configuration?.severityMapping ?? null);
  const parsed = mapping.data ? MappingDefinition.safeParse(mapping.data.definition) : null;
  const def = parsed?.success ? parsed.data : null;
  const from = useVersion(def?.from);
  const to = useVersion(def?.to);
  const fromScale = from.data ? ScaleDefinition.safeParse(from.data.definition) : null;
  const toScale = to.data ? ScaleDefinition.safeParse(to.data.definition) : null;
  if (!def || !fromScale?.success || !toScale?.success) return null;
  return { def, from: fromScale.data, to: toScale.data };
}

const choix = (levels: ScaleLevel[]) => levels.map((l) => ({ value: l.id, label: l.label }));

/** Bloc « Gravité » de la fiche d'un événement redouté. */
export function BlocGravite({
  gravite,
  data,
  onChange,
  readonly,
}: {
  gravite: NonNullable<ReturnType<typeof useGravite>>;
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readonly: boolean;
}) {
  const { def, from, to } = gravite;
  const impacts = (Array.isArray(data.impactLevels) ? data.impactLevels : []) as Impact[];
  const set = (next: Impact[]) => onChange('impactLevels', next);
  const proposeeId = aggregateMapped(
    def,
    to,
    impacts.map((i) => i.level),
  );
  const proposee = to.levels.find((l) => l.id === proposeeId);
  const retenueId = typeof data.severityLevel === 'string' && data.severityLevel ? data.severityLevel : null;
  const retenue = to.levels.find((l) => l.id === retenueId);
  return (
    <Stack>
      <Text fw={600}>Gravité de l’événement redouté</Text>
      <Text size="sm" c="dimmed">
        Relevez les impacts sur l’échelle « {from.name} » ; la gravité proposée est celle que la correspondance «{' '}
        {def.name} » déduit de ces impacts.
      </Text>
      {impacts.map((impact, i) => (
        <Group key={i} align="end" wrap="nowrap">
          {from.dimensions.length > 0 && (
            <Select
              label={`Catégorie d’impact ${i + 1}`}
              clearable
              data={from.dimensions.map((d) => ({ value: d.id, label: d.label }))}
              value={impact.category}
              onChange={(v) => set(impacts.map((x, k) => (k === i ? { ...x, category: v } : x)))}
              disabled={readonly}
            />
          )}
          <Select
            label={`Niveau d’impact ${i + 1}`}
            data={choix(from.levels)}
            value={impact.level}
            onChange={(v) => v && set(impacts.map((x, k) => (k === i ? { ...x, level: v } : x)))}
            allowDeselect={false}
            disabled={readonly}
          />
          <ActionIcon
            variant="default"
            aria-label={`Retirer l’impact ${i + 1}`}
            disabled={readonly}
            onClick={() => set(impacts.filter((_, k) => k !== i))}
          >
            ×
          </ActionIcon>
        </Group>
      ))}
      {!readonly && (
        <Group>
          <Button
            variant="default"
            disabled={impacts.length >= 50}
            onClick={() => set([...impacts, { category: null, level: from.levels[0]!.id }])}
          >
            Ajouter un impact
          </Button>
        </Group>
      )}
      <Group gap="xs" role="status" aria-live="polite">
        <Text size="sm">Gravité proposée :</Text>
        {proposee ? (
          <Badge variant="light">{proposee.label}</Badge>
        ) : (
          <Text size="sm">à renseigner (au moins un impact)</Text>
        )}
        {proposee && !readonly && retenueId !== proposee.id && (
          <Button size="compact-sm" variant="default" onClick={() => onChange('severityLevel', proposee.id)}>
            Retenir la proposition
          </Button>
        )}
      </Group>
      <Select
        label="Gravité retenue"
        description="Décision de l’analyste : la correspondance ne fait que proposer."
        clearable
        data={choix(to.levels)}
        value={retenueId}
        onChange={(v) => onChange('severityLevel', v)}
        disabled={readonly}
      />
      {retenue && proposee && retenue.id !== proposee.id && (
        <Alert color="orange" title="Choix différent de la proposition">
          Expliquez ce choix dans la description des conséquences.
        </Alert>
      )}
    </Stack>
  );
}
