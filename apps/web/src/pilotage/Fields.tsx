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
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { BlocPertinence, ConfigurationEtude, usePertinence } from '../config-grc/Pertinence';
export interface Source {
  ref: string;
  name: string;
  kind: string;
}
/** Référence typée (lot U3) : seules les cibles autorisées sont proposées, recherchées côté serveur. */
export function ChampLien({
  smsi,
  f,
  value,
  onChange,
  readonly,
}: {
  smsi: string;
  f: PilotageField;
  value: unknown;
  onChange: (v: unknown) => void;
  readonly: boolean;
}) {
  const [search, setSearch] = useState('');
  const cibles = (f.cibles ?? []).join(',');
  const q = useQuery({
    queryKey: ['grc', smsi, 'sources', 'cibles', cibles, search],
    queryFn: () =>
      get<{ items: Source[] }>(
        `/api/grc/${smsi}/sources?search=${encodeURIComponent(search)}&cibles=${encodeURIComponent(cibles)}`,
      ),
    enabled: !readonly && !!cibles,
  });
  const choisis =
    f.type === 'ref'
      ? typeof value === 'string' && value
        ? [value]
        : []
      : Array.isArray(value)
        ? (value as string[])
        : [];
  const options = (q.data?.items ?? []).map((s) => ({ value: s.ref, label: s.name }));
  for (const r of choisis)
    if (!options.some((o) => o.value === r)) options.push({ value: r, label: 'Référence déjà liée' });
  if (f.type === 'ref')
    return (
      <Select
        label={f.label}
        description={f.hint}
        searchable
        clearable
        data={options}
        value={choisis[0] ?? null}
        onSearchChange={setSearch}
        onChange={(v) => onChange(v ?? null)}
        disabled={readonly}
      />
    );
  return (
    <MultiSelect
      label={f.label}
      description={f.hint}
      searchable
      data={options}
      value={choisis}
      onSearchChange={setSearch}
      onChange={(v) => onChange(v)}
      disabled={readonly}
    />
  );
}

/** Audit combiné (ISO 9001:2015, 9.2) : référentiels audités ensemble. Deux référentiels ou plus font un audit combiné ;
    l'audit se rattache à ceux de la bibliothèque rattachés au périmètre, sans en copier les exigences. */
function ReferentielsAudites({
  smsi,
  value,
  onChange,
  readonly,
}: {
  smsi: string;
  value: unknown;
  onChange: (v: string[]) => void;
  readonly: boolean;
}) {
  const q = useQuery({
    queryKey: ['grc', smsi, 'attachments'],
    queryFn: () =>
      get<{ frameworkId: string; name: string; enabled: boolean }[]>(`/api/grc/${smsi}/framework-attachments`),
    retry: false,
  });
  const choisis = Array.isArray(value) ? (value as string[]) : [];
  const options = (q.data ?? []).map((r) => ({ value: r.name, label: r.name }));
  for (const n of choisis) if (!options.some((o) => o.value === n)) options.push({ value: n, label: n });
  return (
    <Stack gap="2xs">
      <MultiSelect
        label="Référentiels audités"
        description="Un audit portant sur deux référentiels ou plus est un audit combiné : il se prépare, se mène et se rapporte une seule fois."
        searchable
        data={options}
        value={choisis}
        onChange={onChange}
        disabled={readonly}
      />
      <Text size="sm">
        {choisis.length > 1
          ? `Audit combiné : ${choisis.join(' + ')}.`
          : choisis.length === 1
            ? 'Audit sur un seul référentiel.'
            : 'Aucun référentiel indiqué.'}
      </Text>
    </Stack>
  );
}

export function Fields({
  kind,
  data,
  onChange,
  sources,
  readonly = false,
  smsi,
}: {
  kind: GrcKind;
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  sources: Source[];
  readonly?: boolean;
  smsi?: string;
}) {
  const pertinence = usePertinence(kind === 'sr_ov' ? smsi : undefined, data.studyRef);
  // Avec une matrice épinglée par l'étude, motivation et ressources se choisissent sur ses échelles : les anciens champs
  // à quatre niveaux ne sont plus proposés (leurs valeurs déjà saisies restent conservées).
  const fields = (PILOTAGE_FIELDS[kind] ?? []).filter(
    (f) => !(pertinence && kind === 'sr_ov' && ['motivation', 'resources'].includes(f.key)),
  );
  const input = (f: PilotageField) => {
    const value = data[f.key];
    if ((f.type === 'ref' || f.type === 'refs') && f.cibles && smsi)
      return (
        <ChampLien
          key={f.key}
          smsi={smsi}
          f={f}
          value={value}
          onChange={(v) => onChange(f.key, v)}
          readonly={readonly}
        />
      );
    if (f.type === 'niveau')
      return (
        <Select
          key={f.key}
          label={f.label}
          description={f.hint}
          clearable
          data={(f.echelle ?? []).map((l, i) => ({
            value: String(i + 1),
            label: `${i + 1} — ${l.replace(/^\d+ — /, '')}`,
          }))}
          value={typeof value === 'number' ? String(value) : null}
          onChange={(v) => onChange(f.key, v ? Number(v) : null)}
          disabled={readonly}
        />
      );
    if (f.type === 'multi')
      return (
        <MultiSelect
          key={f.key}
          label={f.label}
          data={f.options ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(f.key, v)}
          disabled={readonly}
        />
      );
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
      {kind === 'risk_study' && (
        <ConfigurationEtude
          value={data.configuration}
          onChange={(v) => onChange('configuration', v)}
          readonly={readonly}
        />
      )}
      {pertinence && <BlocPertinence pertinence={pertinence} data={data} onChange={onChange} readonly={readonly} />}
      {kind === 'audit' && smsi && (
        <ReferentielsAudites
          smsi={smsi}
          value={data.auditedFrameworks}
          onChange={(v) => onChange('auditedFrameworks', v)}
          readonly={readonly}
        />
      )}
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
