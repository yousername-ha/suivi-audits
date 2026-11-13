import { Button, Group, NumberInput, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FrameworkDefinition, GrcObject, MappingData } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
type Ref = MappingData['source'];
const empty: Ref = { frameworkId: '', version: 1, requirementId: '' };
function RequirementPicker({
  smsi,
  label,
  value,
  onChange,
}: {
  smsi: string;
  label: string;
  value: Ref;
  onChange: (v: Ref) => void;
}) {
  const frameworks = useQuery({
    queryKey: ['grc', smsi, 'framework-choices'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=framework`),
  });
  const history = useQuery({
    queryKey: ['grc', smsi, 'framework-history', value.frameworkId],
    queryFn: () =>
      get<{ version: number; definition: FrameworkDefinition }[]>(
        `/api/grc/${smsi}/frameworks/${value.frameworkId}/history`,
      ),
    enabled: !!value.frameworkId,
  });
  const version = history.data?.find((h) => h.version === value.version);
  return (
    <Stack>
      <TextInput
        label={label}
        value={
          value.requirementId
            ? `${version?.definition.name ?? ''} · ${value.requirementId}`
            : 'Choisir une exigence publiée'
        }
        readOnly
      />
      <Select
        label={`Référentiel ${label.toLowerCase()}`}
        searchable
        data={(frameworks.data?.items ?? []).map((f) => ({ value: f.id, label: f.name }))}
        value={value.frameworkId || null}
        onChange={(id) => onChange({ ...empty, frameworkId: id ?? '' })}
      />
      <Select
        label={`Version ${label.toLowerCase()}`}
        data={(history.data ?? []).map((h) => ({ value: String(h.version), label: `Version ${h.version}` }))}
        value={String(value.version)}
        onChange={(v) => onChange({ ...value, version: Number(v ?? 1), requirementId: '' })}
      />
      <Select
        label={`Exigence ${label.toLowerCase()}`}
        searchable
        data={(version?.definition.requirements ?? []).map((r) => ({ value: r.id, label: r.id + ' · ' + r.title }))}
        value={value.requirementId || null}
        onChange={(v) => onChange({ ...value, requirementId: v ?? '' })}
      />
      <ErrorAlert error={frameworks.error ?? history.error} />
    </Stack>
  );
}
export function MappingForm({ smsi, object, onSaved }: { smsi: string; object?: GrcObject; onSaved?: () => void }) {
  const initial = object?.data as MappingData | undefined;
  const qc = useQueryClient(),
    [source, setSource] = useState(initial?.source ?? empty),
    [target, setTarget] = useState(initial?.target ?? empty),
    [type, setType] = useState<MappingData['type']>(initial?.type ?? 'related'),
    [coverage, setCoverage] = useState(initial?.coverage ?? 0),
    [justification, setJustification] = useState(initial?.justification ?? ''),
    [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? ''),
    [origin, setOrigin] = useState<'human' | 'ai'>(initial?.origin ?? 'human'),
    [error, setError] = useState<unknown>(null),
    [saving, setSaving] = useState(false);
  return (
    <Stack>
      <Group grow align="flex-start">
        <RequirementPicker smsi={smsi} label="Source" value={source} onChange={setSource} />
        <RequirementPicker smsi={smsi} label="Cible" value={target} onChange={setTarget} />
      </Group>
      <Select
        label="Nature de la correspondance"
        value={type}
        onChange={(v) => setType(v as MappingData['type'])}
        data={[
          { value: 'identical', label: 'Identique' },
          { value: 'equivalent', label: 'Équivalente' },
          { value: 'partial', label: 'Partielle' },
          { value: 'complementary', label: 'Complémentaire' },
          { value: 'related', label: 'Liée' },
          { value: 'none', label: 'Aucune' },
        ]}
      />
      <NumberInput
        label="Couverture justifiée (%)"
        min={0}
        max={100}
        value={coverage}
        onChange={(v) => setCoverage(Number(v))}
      />
      <Select
        label="Origine de la proposition"
        value={origin}
        onChange={(v) => setOrigin(v === 'ai' ? 'ai' : 'human')}
        data={[
          { value: 'human', label: 'Analyse humaine' },
          { value: 'ai', label: 'Proposition issue d’une IA, à revoir' },
        ]}
      />
      <Textarea
        label="Justification de la correspondance"
        value={justification}
        onChange={(e) => setJustification(e.currentTarget.value)}
      />
      <TextInput
        label="Source officielle ou organisationnelle"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.currentTarget.value)}
      />
      <ErrorAlert error={error} />
      <Button
        loading={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await api(object ? 'PUT' : 'POST', `/api/grc/${smsi}/objects${object ? '/' + object.id : ''}`, {
              ifMatch: object?.version,
              body: {
                kind: 'mapping',
                name: source.requirementId + ' → ' + target.requirementId,
                data: {
                  source,
                  target,
                  type,
                  coverage,
                  justification,
                  sourceUrl,
                  origin,
                  status: 'proposed',
                  reviewNote: '',
                },
              },
            });
            await qc.invalidateQueries({ queryKey: ['grc', smsi] });
            setJustification('');
            onSaved?.();
          } catch (e) {
            setError(e);
          } finally {
            setSaving(false);
          }
        }}
      >
        {object ? 'Enregistrer et soumettre à nouveau à revue' : 'Enregistrer la proposition'}
      </Button>
    </Stack>
  );
}
