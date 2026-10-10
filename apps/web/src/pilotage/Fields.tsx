import {
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
  Button,
  Text,
} from '@mantine/core';
import { PILOTAGE_FIELDS, type GrcKind, type PilotageField } from '@suivi/shared';
export interface Source {
  ref: string;
  name: string;
  kind: string;
}
export function Fields({
  kind,
  data,
  onChange,
  sources,
  readonly = false,
}: {
  kind: GrcKind;
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  sources: Source[];
  readonly?: boolean;
}) {
  const fields = PILOTAGE_FIELDS[kind] ?? [];
  const input = (f: PilotageField) => {
    const value = data[f.key];
    if (f.type === 'boolean')
      return (
        <Checkbox
          key={f.key}
          label={f.label}
          checked={Boolean(value)}
          onChange={(e) => onChange(f.key, e.currentTarget.checked)}
          disabled={readonly || (kind === 'indicator' && data.auto === true && ['value', 'measuredAt'].includes(f.key))}
        />
      );
    if (f.type === 'number')
      return (
        <NumberInput
          key={f.key}
          label={f.label}
          value={typeof value === 'number' ? value : ''}
          onChange={(v) => onChange(f.key, typeof v === 'number' ? v : null)}
          min={0}
          disabled={readonly || (kind === 'indicator' && data.auto === true && ['value', 'measuredAt'].includes(f.key))}
        />
      );
    if (f.type === 'select')
      return (
        <Select
          key={f.key}
          label={f.label}
          data={f.options ?? []}
          value={String(value ?? f.options?.[0]?.value ?? '')}
          onChange={(v) => onChange(f.key, v)}
          disabled={readonly || (kind === 'indicator' && data.auto === true && ['value', 'measuredAt'].includes(f.key))}
        />
      );
    if (f.type === 'refs')
      return (
        <MultiSelect
          key={f.key}
          label={f.label}
          searchable
          data={sources
            .filter((s) => f.key !== 'documentRefs' || s.ref.startsWith('document:'))
            .map((s) => ({ value: s.ref, label: s.name }))}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(f.key, v)}
          disabled={readonly || (kind === 'indicator' && data.auto === true && ['value', 'measuredAt'].includes(f.key))}
        />
      );
    if (f.type === 'date')
      return (
        <TextInput
          key={f.key}
          type="date"
          label={f.label}
          value={String(value ?? '').slice(0, 10)}
          onChange={(e) => onChange(f.key, e.currentTarget.value)}
          disabled={readonly || (kind === 'indicator' && data.auto === true && ['value', 'measuredAt'].includes(f.key))}
        />
      );
    return (
      <Textarea
        key={f.key}
        label={f.label}
        description={f.hint}
        rows={3}
        value={String(value ?? '')}
        onChange={(e) => onChange(f.key, e.currentTarget.value)}
        disabled={readonly}
      />
    );
  };
  const impacts = Array.isArray(data.impacts) ? (data.impacts as Record<string, unknown>[]) : [];
  return (
    <Stack>
      {fields.map(input)}
      {kind === 'bia' && (
        <Stack>
          <Text fw={600}>Impacts selon la durée d’interruption</Text>
          <Text size="sm">Décrivez les conséquences concrètes aux durées utiles à votre activité.</Text>
          {impacts.map((row, index) => (
            <fieldset key={index} disabled={readonly} className="grc-fieldset">
              <Stack>
                <NumberInput
                  label="Durée d’interruption (heures)"
                  value={Number(row.hours ?? 0)}
                  min={0}
                  onChange={(v) =>
                    onChange(
                      'impacts',
                      impacts.map((x, i) => (i === index ? { ...x, hours: Number(v) } : x)),
                    )
                  }
                />
                {[
                  ['business', 'Impact métier'],
                  ['financial', 'Impact financier'],
                  ['legal', 'Impact juridique'],
                  ['reputation', 'Impact sur la réputation'],
                ].map(([key, label]) => (
                  <Textarea
                    key={key}
                    label={label}
                    value={String(row[key!] ?? '')}
                    onChange={(e) =>
                      onChange(
                        'impacts',
                        impacts.map((x, i) => (i === index ? { ...x, [key!]: e.currentTarget.value } : x)),
                      )
                    }
                  />
                ))}
                <Button
                  variant="subtle"
                  onClick={() =>
                    onChange(
                      'impacts',
                      impacts.filter((_, i) => i !== index),
                    )
                  }
                >
                  Retirer cette durée
                </Button>
              </Stack>
            </fieldset>
          ))}
          <Group>
            <Button
              variant="light"
              disabled={readonly || impacts.length >= 30}
              onClick={() =>
                onChange('impacts', [...impacts, { hours: 24, business: '', financial: '', legal: '', reputation: '' }])
              }
            >
              Ajouter une durée d’interruption
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
