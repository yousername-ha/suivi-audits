/* Éditeur de méthode : épinglage des échelles et de la matrice du catalogue (ADR 0038). Facultatif : une méthode sans
   épinglage garde ses niveaux et son calcul intégrés. À la publication, le serveur résout les éléments choisis et fige une
   copie dans la version publiée ; modifier le catalogue plus tard ne change pas une version déjà publiée. */
import { Alert, Select, Stack, Text } from '@mantine/core';
import type { CfgFamily, CfgRef, MethodBindings } from '@suivi/shared';
import { SelecteurElement } from './commun';

interface MethodeEditee {
  family: CfgFamily;
  dimensions: { id: string; label: string }[];
  bindings?: MethodBindings;
  [key: string]: unknown;
}

/** Retire l'épinglage vide pour que la définition reste identique à celle d'une méthode non épinglée. */
const normaliser = (m: MethodeEditee, b: MethodBindings): MethodeEditee => {
  const { bindings: _ancien, ...reste } = m;
  void _ancien;
  const vide = !Object.keys(b.dimensions).length && !b.likelihood && !b.levels && !b.matrix;
  return (vide ? reste : { ...reste, bindings: b }) as MethodeEditee;
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
    </Stack>
  );
}
