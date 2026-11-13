/* Ateliers 3 et 4 d'une étude EBIOS RM sur le catalogue (ADR 0038) : l'étude peut épingler une échelle de gravité des
   scénarios stratégiques et une échelle de vraisemblance des scénarios opérationnels. Le niveau retenu se choisit alors sur
   l'échelle publiée (version précise) ; sans épinglage, l'échelle d'origine à quatre niveaux reste proposée. */
import { Select, Text } from '@mantine/core';
import { ScaleDefinition, type ScaleLevel, type StudyConfiguration } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { useVersion } from './commun';

const CIBLES = {
  strategic_scenario: {
    slot: 'scenarioSeverityScale',
    champ: 'severityLevel',
    ancien: 'gravity',
    titre: 'Gravité du scénario',
  },
  operational_scenario: {
    slot: 'likelihoodScale',
    champ: 'likelihoodLevel',
    ancien: 'likelihood',
    titre: 'Vraisemblance du scénario',
  },
} as const;
export type KindScenario = keyof typeof CIBLES;
export const estScenario = (kind: string): kind is KindScenario => kind in CIBLES;

/** Échelle épinglée par l'étude pour ce type de scénario, avec ses niveaux ; null sans liaison. */
export function useEchelleScenario(smsi: string | undefined, kind: string, studyRef: unknown) {
  const cible = estScenario(kind) ? CIBLES[kind] : null;
  const id =
    cible && typeof studyRef === 'string' && studyRef.startsWith('object:') ? studyRef.slice('object:'.length) : null;
  const study = useQuery({
    queryKey: ['grc', smsi, 'object', id],
    queryFn: () => get<{ data: { configuration?: StudyConfiguration | null } }>(`/api/grc/${smsi}/objects/${id}`),
    enabled: !!smsi && !!id,
  });
  const version = useVersion(cible ? (study.data?.data.configuration?.[cible.slot] ?? null) : null);
  const parsed = version.data ? ScaleDefinition.safeParse(version.data.definition) : null;
  if (!cible || !parsed?.success) return null;
  return { cible, echelle: parsed.data };
}

const choix = (levels: ScaleLevel[]) => levels.map((l) => ({ value: l.id, label: l.label }));

/** Sélecteur du niveau retenu sur l'échelle épinglée. L'ancien champ à quatre niveaux n'est plus proposé (sa valeur reste). */
export function BlocEchelleScenario({
  echelle,
  data,
  onChange,
  readonly,
}: {
  echelle: NonNullable<ReturnType<typeof useEchelleScenario>>;
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readonly: boolean;
}) {
  const { cible, echelle: def } = echelle;
  const retenu = typeof data[cible.champ] === 'string' && data[cible.champ] ? (data[cible.champ] as string) : null;
  return (
    <>
      <Select
        label={`${cible.titre} (échelle « ${def.name} »)`}
        description="Échelle publiée, épinglée à une version précise par l’étude."
        clearable
        data={choix(def.levels)}
        value={retenu}
        onChange={(v) => onChange(cible.champ, v)}
        disabled={readonly}
      />
      {data[cible.ancien] != null && data[cible.ancien] !== '' && !retenu && (
        <Text size="sm" c="dimmed">
          Une valeur est déjà saisie sur l’ancienne échelle à quatre niveaux ; elle est conservée. Choisissez le niveau
          correspondant sur l’échelle publiée pour la remplacer.
        </Text>
      )}
    </>
  );
}
export const ancienChamp = (kind: KindScenario) => CIBLES[kind].ancien;
