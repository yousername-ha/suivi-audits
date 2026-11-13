/* Socle de sécurité d'une étude EBIOS RM (atelier 1) : référentiels appliqués et écarts constatés. Saisie libre du nom du
   référentiel : aucune conformité n'est déduite, aucune exigence n'est copiée. */
import { Button, Group, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';

interface Ligne {
  referential: string;
  status: 'applied' | 'partial' | 'gap';
  gap: string;
  requirementRefs: string[];
}
const ETATS = [
  { value: 'applied', label: 'Appliqué' },
  { value: 'partial', label: 'Partiellement appliqué' },
  { value: 'gap', label: 'Écart' },
];

export function SocleEditeur({
  value,
  onChange,
  readonly,
}: {
  value: unknown;
  onChange: (v: Ligne[]) => void;
  readonly: boolean;
}) {
  const lignes = (Array.isArray(value) ? value : []) as Ligne[];
  const maj = (i: number, patch: Partial<Ligne>) => onChange(lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <Stack>
      <Text fw={600}>Socle de sécurité (atelier 1)</Text>
      <Text size="sm">Référentiels appliqués et écarts constatés. Ces lignes ne mesurent aucune conformité.</Text>
      {lignes.map((l, i) => (
        <fieldset key={i} disabled={readonly} className="grc-fieldset">
          <Stack>
            <TextInput
              label="Référentiel"
              maxLength={200}
              value={l.referential}
              onChange={(e) => maj(i, { referential: e.currentTarget.value })}
            />
            <Select
              label="État"
              allowDeselect={false}
              data={ETATS}
              value={l.status}
              onChange={(v) => v && maj(i, { status: v as Ligne['status'] })}
            />
            <Textarea
              label="Écart constaté"
              autosize
              minRows={2}
              maxLength={5000}
              value={l.gap}
              onChange={(e) => maj(i, { gap: e.currentTarget.value })}
            />
            {!readonly && (
              <Group>
                <Button size="xs" variant="default" onClick={() => onChange(lignes.filter((_, k) => k !== i))}>
                  Retirer cette ligne
                </Button>
              </Group>
            )}
          </Stack>
        </fieldset>
      ))}
      {!readonly && (
        <Group>
          <Button
            size="xs"
            variant="light"
            onClick={() => onChange([...lignes, { referential: '', status: 'applied', gap: '', requirementRefs: [] }])}
          >
            Ajouter un référentiel au socle
          </Button>
        </Group>
      )}
    </Stack>
  );
}
