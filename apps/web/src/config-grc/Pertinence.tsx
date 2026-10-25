/* Atelier 2 d'une étude EBIOS RM sur le catalogue de configuration (ADR 0038) : la fiche d'étude épingle une matrice de
   pertinence ; la fiche d'un couple source de risque / objectif visé choisit ses niveaux sur les échelles de cette matrice
   et reçoit la pertinence PROPOSÉE. La pertinence retenue reste décidée et justifiée par l'analyste. */
import { Alert, Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import { evaluateMatrix, MatrixDefinition, type CfgRef, type ScaleLevel, type StudyConfiguration } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { SelecteurElement, useVersion } from './commun';

/** Matrice de pertinence épinglée par l'étude d'un couple, avec les niveaux de ses trois échelles ; null sans liaison. */
export function usePertinence(smsi: string | undefined, studyRef: unknown) {
  const id = typeof studyRef === 'string' && studyRef.startsWith('object:') ? studyRef.slice('object:'.length) : null;
  const study = useQuery({
    queryKey: ['grc', smsi, 'object', id],
    queryFn: () => get<{ data: { configuration?: StudyConfiguration | null } }>(`/api/grc/${smsi}/objects/${id}`),
    enabled: !!smsi && !!id,
  });
  const ref = study.data?.data.configuration?.relevanceMatrix ?? null;
  const matrix = useVersion(ref);
  const parsed = matrix.data ? MatrixDefinition.safeParse(matrix.data.definition) : null;
  const def = parsed?.success ? parsed.data : null;
  const rows = useVersion(def?.rows.scale);
  const columns = useVersion(def?.columns.scale);
  const result = useVersion(def?.result.scale);
  const levels = (d?: { definition: Record<string, unknown> }) =>
    (d?.definition.levels as ScaleLevel[] | undefined) ?? [];
  if (!def || !rows.data || !columns.data || !result.data) return null;
  return { def, rows: levels(rows.data), columns: levels(columns.data), result: levels(result.data) };
}

/** Section « Configuration de l'étude » de la fiche d'étude : éléments du catalogue épinglés à une version précise. */
export function ConfigurationEtude({
  value,
  onChange,
  readonly,
}: {
  value: unknown;
  onChange: (v: StudyConfiguration | null) => void;
  readonly: boolean;
}) {
  const conf = (value as Partial<StudyConfiguration> | null | undefined) ?? {};
  const relevanceMatrix = conf.relevanceMatrix ?? null;
  const severityMapping = conf.severityMapping ?? null;
  const scenarioSeverityScale = conf.scenarioSeverityScale ?? null;
  const likelihoodScale = conf.likelihoodScale ?? null;
  const maj = (patch: Partial<StudyConfiguration>) => {
    const next = { relevanceMatrix, severityMapping, scenarioSeverityScale, likelihoodScale, ...patch };
    onChange(
      next.relevanceMatrix || next.severityMapping || next.scenarioSeverityScale || next.likelihoodScale ? next : null,
    );
  };
  return (
    <Stack>
      <Text fw={600}>Configuration de l’étude</Text>
      <SelecteurElement
        label="Correspondance impact → gravité (atelier 1)"
        description="Échelle de départ : impacts ; échelle d’arrivée : gravité. Épinglée à une version précise."
        kind="mapping"
        family="ebios_rm"
        disabled={readonly}
        value={severityMapping}
        onChange={(r: CfgRef | null) => maj({ severityMapping: r })}
      />
      <SelecteurElement
        label="Matrice de pertinence des couples source de risque / objectif visé (atelier 2)"
        description="Épinglée à une version précise : modifier la matrice plus tard ne change pas cette étude. Les modèles sont à adopter dans Paramètres → Configuration GRC → Modèles."
        kind="matrix"
        family="ebios_rm"
        disabled={readonly}
        value={relevanceMatrix}
        onChange={(r: CfgRef | null) => maj({ relevanceMatrix: r })}
      />
      <SelecteurElement
        label="Échelle de gravité des scénarios stratégiques (atelier 3)"
        description="Facultative. Sans échelle épinglée, les scénarios gardent l’échelle d’origine à quatre niveaux."
        kind="scale"
        family="ebios_rm"
        disabled={readonly}
        value={scenarioSeverityScale}
        onChange={(r: CfgRef | null) => maj({ scenarioSeverityScale: r })}
      />
      <SelecteurElement
        label="Échelle de vraisemblance des scénarios opérationnels (atelier 4)"
        description="Facultative. Épinglée à une version précise : la modifier plus tard ne change pas cette étude."
        kind="scale"
        family="ebios_rm"
        disabled={readonly}
        value={likelihoodScale}
        onChange={(r: CfgRef | null) => maj({ likelihoodScale: r })}
      />
    </Stack>
  );
}

const choix = (levels: ScaleLevel[]) => levels.map((l) => ({ value: l.id, label: l.label }));

/** Bloc « Pertinence » de la fiche d'un couple : niveaux, proposition de la matrice, pertinence retenue. */
export function BlocPertinence({
  pertinence,
  data,
  onChange,
  readonly,
}: {
  pertinence: NonNullable<ReturnType<typeof usePertinence>>;
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readonly: boolean;
}) {
  const { def, rows, columns, result } = pertinence;
  const text = (k: string) => (typeof data[k] === 'string' && data[k] ? (data[k] as string) : null);
  const proposee = evaluateMatrix(def, text('resourcesLevel'), text('motivationLevel'))?.result ?? null;
  const proposition = result.find((l) => l.id === proposee);
  const retenue = result.find((l) => l.id === text('relevanceLevel'));
  const decrit = (levels: ScaleLevel[], id: string | null) => levels.find((l) => l.id === id)?.description || null;
  return (
    <Stack>
      <Text fw={600}>Pertinence du couple</Text>
      <Select
        label={def.rows.label || 'Ressources'}
        description={decrit(rows, text('resourcesLevel')) ?? undefined}
        clearable
        data={choix(rows)}
        value={text('resourcesLevel')}
        onChange={(v) => onChange('resourcesLevel', v)}
        disabled={readonly}
      />
      <Select
        label={def.columns.label || 'Motivation'}
        description={decrit(columns, text('motivationLevel')) ?? undefined}
        clearable
        data={choix(columns)}
        value={text('motivationLevel')}
        onChange={(v) => onChange('motivationLevel', v)}
        disabled={readonly}
      />
      <Group gap="xs" role="status" aria-live="polite">
        <Text size="sm">Pertinence proposée par la matrice :</Text>
        {proposition ? (
          <Badge variant="light">{proposition.label}</Badge>
        ) : (
          <Text size="sm">à renseigner (deux niveaux requis)</Text>
        )}
        {proposition && !readonly && text('relevanceLevel') !== proposition.id && (
          <Button size="compact-sm" variant="default" onClick={() => onChange('relevanceLevel', proposition.id)}>
            Retenir la proposition
          </Button>
        )}
      </Group>
      <Select
        label="Pertinence retenue"
        description="Décision de l’analyste : la matrice ne fait que proposer."
        clearable
        data={choix(result)}
        value={text('relevanceLevel')}
        onChange={(v) => onChange('relevanceLevel', v)}
        disabled={readonly}
      />
      {retenue && proposition && retenue.id !== proposition.id && (
        <Alert color="orange" title="Choix différent de la proposition">
          Justifiez ce choix dans le champ « Justification du choix ».
        </Alert>
      )}
      {retenue?.effect === 'excluded' && (
        <Alert color="gray">Ce niveau écarte le couple de la suite de l’étude ; il n’est pas supprimé.</Alert>
      )}
    </Stack>
  );
}
