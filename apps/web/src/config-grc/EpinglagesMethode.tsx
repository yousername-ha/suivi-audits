/* Éditeur de méthode : épinglage des échelles et de la matrice du catalogue (ADR 0038). Facultatif : une méthode sans
   épinglage garde ses niveaux et son calcul intégrés. À la publication, le serveur résout les éléments choisis et fige une
   copie dans la version publiée ; modifier le catalogue plus tard ne change pas une version déjà publiée. */
import { ActionIcon, Alert, Button, Checkbox, Group, MultiSelect, Select, Stack, Text, TextInput } from '@mantine/core';
import { GRC_KINDS, GRC_LABELS, type CfgFamily, type CfgRef, type GrcKind, type MethodBindings } from '@suivi/shared';
import { cleDepuis, SelecteurElement } from './commun';

interface MethodeEditee {
  family: CfgFamily;
  dimensions: { id: string; label: string }[];
  stages?: { id: string; label: string }[];
  bindings?: MethodBindings;
  objects?: GrcKind[];
  deliverables?: { id: string; label: string; stage: string; required: boolean }[];
  [key: string]: unknown;
}

/** Retire l'épinglage vide pour que la définition reste identique à celle d'une méthode non épinglée. */
const normaliser = (m: MethodeEditee, b: MethodBindings): MethodeEditee => {
  const { bindings: _ancien, ...reste } = m;
  void _ancien;
  const vide = !Object.keys(b.dimensions).length && !b.likelihood && !b.levels && !b.matrix;
  return (vide ? reste : { ...reste, bindings: b }) as MethodeEditee;
};

/** Champ facultatif : retiré de la définition quand il est vide, pour qu'une méthode sans objets ni livrables reste inchangée. */
const optionnel = <K extends 'objects' | 'deliverables'>(
  m: MethodeEditee,
  cle: K,
  v: MethodeEditee[K],
): MethodeEditee => {
  const { [cle]: _ancien, ...reste } = m;
  void _ancien;
  return (v && v.length ? { ...reste, [cle]: v } : reste) as MethodeEditee;
};
export function EpinglagesMethode({
  value,
  onChange,
}: {
  value: MethodeEditee;
  onChange: (next: MethodeEditee) => void;
}) {
  const b: MethodBindings = value.bindings ?? { dimensions: {} };
  const maj = (patch: Partial<MethodBindings>) => onChange(normaliser(value, { ...b, ...patch }));
  const dimension = (id: string, ref: CfgRef | null) => {
    const dimensions = { ...b.dimensions };
    if (ref) dimensions[id] = ref;
    else delete dimensions[id];
    maj({ dimensions });
  };
  return (
    <Stack>
      <Text fw={600}>Éléments du catalogue (facultatif)</Text>
      <Text size="sm" c="dimmed">
        Épingler une échelle ou une matrice remplace, à la publication, les niveaux et le calcul intégrés par ceux du
        catalogue (copie figée, version précise). Sans épinglage, la méthode garde ses valeurs intégrées.
      </Text>
      {value.dimensions.map((d) => (
        <SelecteurElement
          key={d.id}
          label={`Échelle de la dimension « ${d.label} »`}
          family={value.family}
          value={b.dimensions[d.id] ?? null}
          onChange={(r) => dimension(d.id, r)}
        />
      ))}
      <SelecteurElement
        label="Échelle de vraisemblance"
        family={value.family}
        value={b.likelihood ?? null}
        onChange={(r) => maj({ likelihood: r ?? undefined })}
      />
      <SelecteurElement
        label="Échelle des niveaux de risque"
        description="Chaque niveau doit porter une couleur et une acceptabilité."
        family={value.family}
        value={b.levels ?? null}
        onChange={(r) => maj({ levels: r ?? undefined })}
      />
      <SelecteurElement
        label="Matrice de calcul"
        description="Lignes : la dimension choisie ci-dessous ; colonnes : la vraisemblance ; résultat : les niveaux de risque."
        kind="matrix"
        family={value.family}
        value={b.matrix?.ref ?? null}
        onChange={(r) =>
          maj({ matrix: r ? { ref: r, dimension: b.matrix?.dimension ?? value.dimensions[0]!.id } : undefined })
        }
      />
      {b.matrix && (
        <Select
          label="Dimension en lignes de la matrice"
          allowDeselect={false}
          data={value.dimensions.map((d) => ({ value: d.id, label: d.label }))}
          value={b.matrix.dimension}
          onChange={(v) => v && maj({ matrix: { ref: b.matrix!.ref, dimension: v } })}
        />
      )}
      {b.matrix && (!b.likelihood || !b.levels || !b.dimensions[b.matrix.dimension]) && (
        <Alert color="orange">
          Une matrice exige aussi l’échelle de sa dimension, la vraisemblance et les niveaux de risque épinglés ; ses
          axes doivent correspondre à ces échelles.
        </Alert>
      )}
      <Text fw={600}>Objets et livrables (facultatif)</Text>
      <MultiSelect
        label="Types d’objets mobilisés par la méthode"
        description="Indicatif : aucun type n’est imposé."
        searchable
        data={GRC_KINDS.map((k) => ({ value: k, label: GRC_LABELS[k] }))}
        value={value.objects ?? []}
        onChange={(v) => onChange(optionnel(value, 'objects', v.length ? (v as GrcKind[]) : undefined))}
      />
      {(value.deliverables ?? []).map((d, i) => (
        <Group key={d.id} align="end" wrap="nowrap">
          <TextInput
            label={`Livrable ${i + 1}`}
            value={d.label}
            onChange={(e) =>
              onChange(
                optionnel(
                  value,
                  'deliverables',
                  (value.deliverables ?? []).map((x, k) => (k === i ? { ...x, label: e.currentTarget.value } : x)),
                ),
              )
            }
          />
          <Select
            label="Étape"
            allowDeselect={false}
            data={(value.stages ?? []).map((st) => ({ value: st.id, label: st.label }))}
            value={d.stage}
            onChange={(v) =>
              v &&
              onChange(
                optionnel(
                  value,
                  'deliverables',
                  (value.deliverables ?? []).map((x, k) => (k === i ? { ...x, stage: v } : x)),
                ),
              )
            }
          />
          <Checkbox
            label="Obligatoire"
            checked={d.required}
            onChange={(e) =>
              onChange(
                optionnel(
                  value,
                  'deliverables',
                  (value.deliverables ?? []).map((x, k) => (k === i ? { ...x, required: e.currentTarget.checked } : x)),
                ),
              )
            }
          />
          <ActionIcon
            variant="default"
            aria-label={`Retirer le livrable ${d.label || i + 1}`}
            onClick={() =>
              onChange(
                optionnel(
                  value,
                  'deliverables',
                  (value.deliverables ?? []).filter((_, k) => k !== i),
                ),
              )
            }
          >
            ×
          </ActionIcon>
        </Group>
      ))}
      <Group>
        <Button
          variant="default"
          disabled={!value.stages?.length || (value.deliverables?.length ?? 0) >= 100}
          onClick={() =>
            onChange(
              optionnel(value, 'deliverables', [
                ...(value.deliverables ?? []),
                {
                  id: cleDepuis(
                    '',
                    (value.deliverables ?? []).map((x) => x.id),
                    'livrable',
                  ),
                  label: '',
                  stage: value.stages![0]!.id,
                  required: false,
                },
              ]),
            )
          }
        >
          Ajouter un livrable
        </Button>
      </Group>
    </Stack>
  );
}
