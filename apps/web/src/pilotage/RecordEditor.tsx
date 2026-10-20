import {
  Alert,
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tabs,
} from '@mantine/core';
import {
  GRC_LABELS,
  GRC_MODULES,
  PILOTAGE_FIELDS,
  PILOTAGE_SCHEMAS,
  type BusinessPolicy,
  type GrcKind,
  type GrcObject,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { Fields, type Source } from './Fields';
import { Relations } from '../grc/Relations';
import { MigrationEtude } from '../config-grc/MigrationEtude';
import { SelecteurResponsable, useResponsables } from '../components/selecteurs';
export function RecordEditor({
  smsi,
  kind,
  object,
  opened,
  onClose,
  policy,
  initial,
}: {
  smsi: string;
  kind: GrcKind;
  object: GrcObject | null;
  opened: boolean;
  onClose: () => void;
  policy: BusinessPolicy;
  /** Valeurs initiales d'une création (par exemple l'étude EBIOS RM de rattachement). */
  initial?: Record<string, unknown>;
}) {
  const can = useCan(),
    qc = useQueryClient();
  const [name, setName] = useState(''),
    [data, setData] = useState<Record<string, unknown>>({}),
    [search, setSearch] = useState(''),
    [error, setError] = useState<unknown>(null),
    [saving, setSaving] = useState(false);
  const sources = useQuery({
    queryKey: ['grc', smsi, 'sources', search],
    queryFn: () => get<{ items: Source[] }>(`/api/grc/${smsi}/sources?search=${encodeURIComponent(search)}`),
    enabled: opened,
  });
  const owners = useResponsables(smsi, opened);
  const history = useQuery({
    queryKey: ['grc', smsi, 'history', object?.id],
    queryFn: () =>
      get<{ version: number; reason: string; createdAt: string; createdBy: string }[]>(
        `/api/grc/${smsi}/objects/${object!.id}/history`,
      ),
    enabled: opened && !!object && !object.id.startsWith('legacy:'),
  });
  const readonly = !can(GRC_MODULES[kind], 'modifier') || object?.data.status === 'closed';
  useEffect(() => {
    if (opened) {
      setName(object?.name ?? (typeof initial?.name === 'string' ? initial.name : ''));
      const d: Record<string, unknown> = object
        ? { ...object.data }
        : kind in PILOTAGE_SCHEMAS
          ? PILOTAGE_SCHEMAS[kind as keyof typeof PILOTAGE_SCHEMAS].parse({})
          : { description: '', ownerId: null, refs: [] };
      if (!object)
        for (const f of PILOTAGE_FIELDS[kind] ?? [])
          if (d[f.key] === undefined)
            d[f.key] =
              f.type === 'boolean'
                ? false
                : f.type === 'number'
                  ? 0
                  : f.type === 'select'
                    ? (f.options?.[0]?.value ?? '')
                    : f.type === 'refs' || f.type === 'multi'
                      ? []
                      : f.type === 'ref' || f.type === 'niveau'
                        ? null
                        : '';
      if (!object && initial) Object.assign(d, initial);
      delete d.name;
      if (kind === 'evidence' && ['validated', 'rejected'].includes(String(d.status))) d.status = 'draft';
      if (['bia', 'continuity_plan', 'management_review'].includes(kind) && d.status === 'validated')
        d.status = 'draft';
      if (kind === 'nonconformity' && d.status !== 'closed') {
        d.effectiveness = 'pending';
        d.effectivenessNote = '';
        d.closureNote = '';
        d.closedAt = '';
      }
      if (kind === 'control' && !d.frequency) d.frequency = policy.catalogues.frequencies[0]!.id;
      if (['control', 'evidence', 'measure'].includes(kind) && !d.category)
        d.category = (
          kind === 'control'
            ? policy.catalogues.controlTypes
            : kind === 'evidence'
              ? policy.catalogues.proofCategories
              : policy.catalogues.measureCategories
        )[0]!.id;
      setData(d);
      setError(null);
    }
  }, [opened, object, kind, policy, initial]);
  const set = (key: string, value: unknown) => setData((old) => ({ ...old, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const clean = { ...data };
      delete clean.sourceSha;
      delete clean.legacy;
      delete clean.ownerLabel;
      if (object?.id.startsWith('legacy:')) {
        const [, key, ...ids] = object.id.split(':');
        await api('PUT', `/api/grc/${smsi}/pilotage/legacy/${key}/${encodeURIComponent(ids.join(':'))}`, {
          ifMatch: object.version,
          body: { name, data: clean, sourceSha: object.data.sourceSha },
        });
      } else if (!object && kind === 'nonconformity')
        await api('POST', `/api/grc/${smsi}/pilotage/findings`, { body: { name, data: clean } });
      else
        await api(object ? 'PUT' : 'POST', `/api/grc/${smsi}/objects${object ? '/' + object.id : ''}`, {
          ifMatch: object?.version,
          body: { kind, name, data: clean },
        });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  const refs = Array.isArray(data.refs) ? (data.refs as string[]) : [];
  const options = [...(sources.data?.items ?? [])];
  for (const ref of refs)
    if (!options.some((s) => s.ref === ref)) options.push({ ref, name: 'Référence déjà liée', kind: '' });
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${object ? 'Fiche' : 'Ajouter'} — ${GRC_LABELS[kind]}`}
      size="lg"
      closeButtonProps={{ 'aria-label': 'Fermer la fiche' }}
    >
      <Stack>
        <ErrorAlert error={error ?? sources.error ?? owners.error} />
        {object && ['validated', 'effectiveness'].includes(String(object.data.status)) && !readonly && (
          <Alert>
            Une modification demande une nouvelle vérification. Les décisions précédentes restent conservées.
          </Alert>
        )}
        {readonly && <Text>Cette fiche est consultable en lecture seule.</Text>}
        <Tabs defaultValue="details" keepMounted>
          <Tabs.List>
            <Tabs.Tab value="details">Informations</Tabs.Tab>
            <Tabs.Tab value="links">Liens et justificatifs</Tabs.Tab>
            {object && <Tabs.Tab value="history">Historique</Tabs.Tab>}
          </Tabs.List>
          <Tabs.Panel value="details" pt="md">
            <Stack>
              <TextInput
                label="Intitulé"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={readonly}
              />
              <Textarea
                label="Description"
                value={String(data.description ?? '')}
                onChange={(e) => set('description', e.currentTarget.value)}
                disabled={readonly}
              />
              <SelecteurResponsable
                smsi={smsi}
                value={typeof data.ownerId === 'string' ? data.ownerId : null}
                onChange={(v) => set('ownerId', v)}
                disabled={readonly}
              />
              <Fields kind={kind} data={data} onChange={set} sources={options} readonly={readonly} smsi={smsi} />
              {kind === 'risk_study' && object && !object.id.startsWith('legacy:') && (
                <MigrationEtude smsi={smsi} study={object} readonly={readonly} onDone={onClose} />
              )}
              {['control', 'evidence', 'measure'].includes(kind) && (
                <Select
                  label={
                    kind === 'control'
                      ? 'Type de contrôle'
                      : kind === 'evidence'
                        ? 'Catégorie de preuve'
                        : 'Catégorie de mesure'
                  }
                  data={(kind === 'control'
                    ? policy.catalogues.controlTypes
                    : kind === 'evidence'
                      ? policy.catalogues.proofCategories
                      : policy.catalogues.measureCategories
                  ).map((c) => ({ value: c.id, label: c.label }))}
                  value={String(data.category ?? '')}
                  onChange={(v) => set('category', v)}
                  disabled={readonly}
                />
              )}
              {kind === 'control' && (
                <Select
                  label="Fréquence"
                  data={policy.catalogues.frequencies.map((f) => ({ value: f.id, label: f.label }))}
                  value={String(data.frequency ?? '')}
                  onChange={(v) => set('frequency', v)}
                  disabled={readonly}
                />
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="links" pt="md">
            <Stack>
              <Text>Reliez les référentiels, exigences, processus, actifs, risques ou documents déjà présents.</Text>
              <TextInput
                label="Rechercher une référence"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              <MultiSelect
                label="Éléments liés"
                searchable
                data={options.map((s) => ({ value: s.ref, label: s.name }))}
                value={refs}
                onChange={(v) => set('refs', v)}
                disabled={readonly}
              />
              {object && (
                <Relations smsi={smsi} source={object.id.startsWith('legacy:') ? object.id : 'object:' + object.id} />
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="history" pt="md">
            <Stack>
              <ErrorAlert error={history.error} />
              {object?.id.startsWith('legacy:') && (
                <Text>
                  La fiche reste dans la source historique. Les réalisations et validations sont consultables depuis le
                  registre.
                </Text>
              )}
              {history.data?.map((h) => (
                <Text key={h.version}>
                  Version {h.version} · {new Date(h.createdAt).toLocaleString('fr-FR')} · {h.createdBy} · {h.reason}
                </Text>
              ))}
            </Stack>
          </Tabs.Panel>
        </Tabs>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          {!readonly && (
            <Button loading={saving} disabled={!name.trim()} onClick={() => void save()}>
              Enregistrer
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
