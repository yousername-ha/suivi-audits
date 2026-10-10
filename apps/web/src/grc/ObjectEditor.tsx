import { Relations } from './Relations';
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
  Text,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  GRC_LABELS,
  GRC_MODULES,
  type BusinessPolicy,
  type GrcKind,
  type GrcObject,
  type RiskData,
  type RiskMethod,
} from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { ConfigurationEditor } from './ConfigurationEditor';
import type { MethodVersion } from './Risks';
type Owners = { id: string; displayName: string; username: string }[];
const initial = (kind: GrcKind, policy: BusinessPolicy, method?: MethodVersion): Record<string, unknown> =>
  kind === 'action'
    ? {
        description: '',
        status: policy.statuses[0]!.id,
        ownerId: null,
        startAt: null,
        dueAt: null,
        priority: 'normal',
        category: policy.catalogues.actionCategories[0]!.id,
        justification: '',
        reminderDays: policy.notifications.leadDays,
        dependencies: [],
      }
    : kind === 'task_series'
      ? {
          description: '',
          ownerId: null,
          category: policy.catalogues.actionCategories[0]!.id,
          priority: 'normal',
          refs: [],
          recurrence: {
            start: new Date().toISOString().slice(0, 10),
            time: '09:00',
            timezone: 'Europe/Paris',
            unit: 'month',
            interval: 1,
            until: null,
            count: null,
            reminderDays: policy.notifications.leadDays,
            active: true,
          },
        }
      : kind === 'risk'
        ? {
            description: '',
            code: '',
            ownerId: null,
            methodId: method?.methodId ?? '',
            methodVersion: method?.version ?? 1,
            domain: '',
            entity: '',
            scope: '',
            strategy: 'reduce',
            acceptanceReason: '',
            reviewAt: null,
            stages: {},
          }
        : {
            description: '',
            ownerId: null,
            status: 'draft',
            category:
              kind === 'measure'
                ? policy.catalogues.measureCategories[0]!.id
                : kind === 'evidence'
                  ? policy.catalogues.proofCategories[0]!.id
                  : kind === 'control'
                    ? policy.catalogues.controlTypes[0]!.id
                    : '',
            justification: '',
            refs: [],
            ...(kind === 'risk_source'
              ? { motive: '', resources: '', targetObjective: '' }
              : kind === 'feared_event'
                ? { consequences: '', severity: '', businessValue: '' }
                : kind === 'business_asset' || kind === 'process'
                  ? { mission: '', entity: '', scope: '', securityDomain: '' }
                  : kind === 'support_asset'
                    ? { assetType: '', location: '', securityDomain: '' }
                    : kind === 'strategic_scenario'
                      ? { attackPath: '', ecosystem: '', securityDomain: '' }
                      : kind === 'operational_scenario'
                        ? { attackSequence: '', likelihood: '', securityDomain: '' }
                        : kind === 'treatment'
                          ? { strategy: 'reduce', expectedEffect: '', verification: '', reviewAt: '' }
                          : kind === 'control'
                            ? { frequency: policy.catalogues.frequencies[0]!.id, result: '', performedAt: '' }
                            : kind === 'evidence'
                              ? { source: '', validUntil: '' }
                              : kind === 'indicator'
                                ? { value: 0, target: 0, unit: '', measuredAt: '' }
                                : kind === 'objective'
                                  ? { target: '', dueAt: '' }
                                  : kind === 'soa'
                                    ? { applicable: true, reason: '', implemented: false }
                                    : {}),
          };
export function ObjectEditor({
  smsi,
  policy,
  kind,
  object,
  opened,
  onClose,
}: {
  smsi: string;
  policy: BusinessPolicy;
  kind: GrcKind;
  object: GrcObject | null;
  opened: boolean;
  onClose: () => void;
}) {
  const can = useCan(),
    qc = useQueryClient(),
    [name, setName] = useState(''),
    [data, setData] = useState<Record<string, unknown>>({}),
    [error, setError] = useState<unknown>(null),
    [saving, setSaving] = useState(false),
    [archiveConfirm, setArchiveConfirm] = useState(false),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [legacyComment, setLegacyComment] = useState(''),
    [proof, setProof] = useState('');
  const owners = useQuery({ queryKey: ['grc', smsi, 'owners'], queryFn: () => get<Owners>(`/api/grc/${smsi}/owners`) });
  const methods = useQuery({
    queryKey: ['grc', smsi, 'methods'],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods`),
    enabled: kind === 'risk',
  });
  const scopes = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () =>
      get<{ id: string; riskMethodId: string | null; riskMethodVersion: number | null }[]>('/api/grc/smsis'),
    enabled: kind === 'risk',
  });
  const versions = useQuery({
    queryKey: ['grc', smsi, 'method-version', data.methodId],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods/${data.methodId}/history`),
    enabled: kind === 'risk' && typeof data.methodId === 'string' && data.methodId.length === 36,
  });
  const sources = useQuery({
    queryKey: ['grc', smsi, 'sources'],
    queryFn: () => get<{ items: { ref: string; name: string; kind: string }[] }>(`/api/grc/${smsi}/sources`),
    enabled: opened,
  });
  const history = useQuery({
    queryKey: ['grc', smsi, 'object-history', object?.id],
    queryFn: () =>
      get<{ version: number; reason: string; createdBy: string; createdAt: string; snapshot: unknown }[]>(
        `/api/grc/${smsi}/objects/${object!.id}/history`,
      ),
    enabled: !!object && !object.id.startsWith('legacy:') && opened,
  });
  useEffect(() => {
    if (opened) {
      setName(object?.name ?? '');
      setData(object?.data ?? initial(kind, policy));
      setError(null);
    }
  }, [opened, object, kind, policy]);
  useEffect(() => {
    if (opened && !object && kind === 'risk') {
      const s = scopes.data?.find((s) => s.id === smsi);
      if (s?.riskMethodId)
        setData((old) =>
          old.methodId ? old : { ...old, methodId: s.riskMethodId, methodVersion: s.riskMethodVersion ?? 1 },
        );
    }
  }, [opened, object, kind, scopes.data, smsi]);
  const set = (key: string, value: unknown) => setData((old) => ({ ...old, [key]: value }));
  const method =
    versions.data?.find((m) => m.version === data.methodVersion)?.definition ??
    methods.data?.find((m) => m.methodId === data.methodId && m.version === data.methodVersion)?.definition;
  const refs = sources.data?.items ?? [];
  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      if (object?.id.startsWith('legacy:')) {
        await api('POST', '/api/grc/legacy-tasks/complete', {
          ifMatch: object.version,
          body: {
            ref: object.id,
            sourceSha: object.data.sourceSha,
            date,
            comment: legacyComment,
            proof,
            confirm: 'REALISER',
          },
        });
      } else
        await api(object ? 'PUT' : 'POST', `/api/grc/${smsi}/objects${object ? '/' + object.id : ''}`, {
          ifMatch: object?.version,
          body: { kind, name, data },
        });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  const readonly = !can(object?.data.legacyRecurring ? 'pilotage' : GRC_MODULES[kind], 'modifier');
  return (
    <Modal opened={opened} onClose={onClose} title={`${object ? 'Fiche' : 'Créer'} — ${GRC_LABELS[kind]}`} size="xl">
      <Stack>
        <ErrorAlert error={error ?? owners.error ?? history.error} />
        {object?.id.startsWith('legacy:') ? (
          <>
            <Alert>
              Source historique conservée. La réalisation est enregistrée directement dans cette source, sans copie
              d’action.
            </Alert>
            <Text fw={600}>{object.name}</Text>
            <Text>Responsable : {String(object.data.ownerLabel || 'Non attribué')}</Text>
            <TextInput
              type="date"
              label="Date de réalisation"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
            />
            <Textarea
              label="Commentaire et justification"
              value={legacyComment}
              onChange={(e) => setLegacyComment(e.currentTarget.value)}
            />
            <Textarea label="Justificatif historique" value={proof} onChange={(e) => setProof(e.currentTarget.value)} />
          </>
        ) : (
          <>
            <TextInput
              label="Nom de la fiche"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              disabled={readonly}
            />
            <Textarea
              label="Description"
              value={String(data.description ?? '')}
              onChange={(e) => set('description', e.currentTarget.value)}
              minRows={3}
              disabled={readonly}
            />
            <Select
              label="Responsable"
              clearable
              data={(owners.data ?? []).map((u) => ({ value: u.id, label: u.displayName || u.username }))}
              value={typeof data.ownerId === 'string' ? data.ownerId : null}
              onChange={(v) => set('ownerId', v)}
              disabled={readonly}
            />
            {(kind === 'action' || kind === 'task_series') && (
              <>
                <Select
                  label="Catégorie d’action"
                  data={policy.catalogues.actionCategories.map((c) => ({ value: c.id, label: c.label }))}
                  value={String(data.category ?? '')}
                  onChange={(v) => set('category', v)}
                  disabled={readonly}
                />
                <Select
                  label="Priorité"
                  data={[
                    { value: 'low', label: 'Faible' },
                    { value: 'normal', label: 'Normale' },
                    { value: 'high', label: 'Haute' },
                    { value: 'urgent', label: 'Urgente' },
                  ]}
                  value={String(data.priority ?? 'normal')}
                  onChange={(v) => set('priority', v)}
                  disabled={readonly}
                />
              </>
            )}
            {kind === 'action' && (
              <>
                <Select
                  label="Modèle d’action"
                  clearable
                  data={policy.templates.map((t) => ({ value: t.id, label: t.label }))}
                  onChange={(v) => {
                    const t = policy.templates.find((t) => t.id === v);
                    if (t) setData((old) => ({ ...old, description: t.text, category: t.category }));
                  }}
                />
                <Select
                  label="État de l’action"
                  data={policy.statuses.map((s) => ({ value: s.id, label: s.label }))}
                  value={String(data.status ?? '')}
                  onChange={(v) => set('status', v)}
                  disabled={readonly}
                />
                {(['startAt', 'dueAt'] as const).map((k) => (
                  <TextInput
                    key={k}
                    type="datetime-local"
                    label={k === 'startAt' ? 'Début' : 'Échéance'}
                    value={data[k] ? String(data[k]).slice(0, 16) : ''}
                    onChange={(e) =>
                      set(k, e.currentTarget.value ? new Date(e.currentTarget.value + 'Z').toISOString() : null)
                    }
                    disabled={readonly}
                  />
                ))}
                <Text size="sm">Dates et heures en UTC ; affichage local dans les vues.</Text>
                <NumberInput
                  label="Rappel avant l’échéance (jours)"
                  min={0}
                  max={365}
                  value={Number(data.reminderDays ?? 7)}
                  onChange={(v) => set('reminderDays', Number(v))}
                  disabled={readonly}
                />
                <Textarea
                  label="Justification de clôture"
                  value={String(data.justification ?? '')}
                  onChange={(e) => set('justification', e.currentTarget.value)}
                  disabled={readonly}
                />
                <MultiSelect
                  label="Dépendances (actions)"
                  value={Array.isArray(data.dependencies) ? (data.dependencies as string[]) : []}
                  data={refs
                    .filter(
                      (r) => r.kind === 'action' && r.ref.startsWith('object:') && r.ref !== 'object:' + object?.id,
                    )
                    .map((r) => ({ value: r.ref.slice(7), label: r.name }))}
                  onChange={(v) => set('dependencies', v)}
                  disabled={readonly}
                />
              </>
            )}
            {kind === 'task_series' && data.recurrence && (
              <>
                <Text fw={600}>Récurrence et automatisation</Text>
                <ConfigurationEditor value={data.recurrence} onChange={(v) => set('recurrence', v)} path="recurrence" />
                <MultiSelect
                  label="Objets SMSI liés à chaque occurrence"
                  searchable
                  value={data.refs as string[]}
                  data={refs.map((r) => ({ value: r.ref, label: r.name + ' · ' + r.kind }))}
                  onChange={(v) => set('refs', v)}
                />
              </>
            )}
            {kind === 'risk' && (
              <>
                <Select
                  label="Méthode publiée"
                  value={typeof data.methodId === 'string' ? data.methodId : null}
                  data={(methods.data ?? []).map((m) => ({ value: m.methodId, label: m.definition.name }))}
                  onChange={(v) => {
                    const m = methods.data?.find((m) => m.methodId === v);
                    setData((old) => ({ ...old, methodId: v, methodVersion: m?.version ?? 1, stages: {} }));
                  }}
                  disabled={readonly}
                />
                <Select
                  label="Version de la méthode"
                  value={String(data.methodVersion ?? 1)}
                  data={(versions.data ?? []).map((m) => ({ value: String(m.version), label: 'Version ' + m.version }))}
                  onChange={(v) => setData((old) => ({ ...old, methodVersion: Number(v), stages: {} }))}
                  disabled={readonly}
                />
                <Text size="sm">
                  Un changement de méthode prépare de nouveaux ateliers. Les décisions précédentes restent conservées.
                </Text>
                {['code', 'domain', 'entity', 'scope'].map((k) => (
                  <TextInput
                    key={k}
                    label={{ code: 'Code', domain: 'Domaine', entity: 'Entité', scope: 'Périmètre' }[k]}
                    value={String(data[k] ?? '')}
                    onChange={(e) => set(k, e.currentTarget.value)}
                    disabled={readonly}
                  />
                ))}
                <Select
                  label="Stratégie"
                  data={(method?.strategies ?? []).map((s) => ({ value: s.kind, label: s.label }))}
                  value={String(data.strategy ?? 'reduce')}
                  onChange={(v) => set('strategy', v)}
                  disabled={readonly}
                />
                <Textarea
                  label="Justification d’acceptation"
                  value={String(data.acceptanceReason ?? '')}
                  onChange={(e) => set('acceptanceReason', e.currentTarget.value)}
                  disabled={readonly}
                />
                <TextInput
                  label="Date de réévaluation"
                  type="date"
                  value={String(data.reviewAt ?? '')}
                  onChange={(e) => set('reviewAt', e.currentTarget.value || null)}
                  disabled={readonly}
                />
                {method && (
                  <Stages
                    method={method}
                    stages={data.stages as RiskData['stages']}
                    onChange={(v) => set('stages', v)}
                    refs={refs}
                    readonly={readonly}
                  />
                )}
              </>
            )}
            {!['action', 'task_series', 'risk'].includes(kind) && (
              <fieldset disabled={readonly} className="grc-fieldset">
                <MultiSelect
                  label="Objets liés dans le référentiel SMSI"
                  searchable
                  data={refs.map((r) => ({ value: r.ref, label: r.name }))}
                  value={Array.isArray(data.refs) ? (data.refs as string[]) : []}
                  onChange={(v) => set('refs', v)}
                />
                <ConfigurationEditor
                  value={Object.fromEntries(
                    Object.entries(data).filter(([k]) => !['ownerId', 'description', 'refs'].includes(k)),
                  )}
                  onChange={(v) => setData((old) => ({ ...old, ...(v as Record<string, unknown>) }))}
                />
              </fieldset>
            )}
          </>
        )}
        {!readonly && (
          <Button loading={saving} onClick={() => void save()}>
            {object?.id.startsWith('legacy:') ? 'Confirmer la réalisation dans la source' : 'Enregistrer la fiche'}
          </Button>
        )}
        {object && (
          <Relations smsi={smsi} source={object.id.startsWith('legacy:') ? object.id : 'object:' + object.id} />
        )}
        {object && !object.id.startsWith('legacy:') && can(GRC_MODULES[kind], 'supprimer') && (
          <>
            <Button variant="subtle" onClick={() => setArchiveConfirm(true)}>
              Archiver la fiche
            </Button>
            {archiveConfirm && (
              <Alert>
                <Text>Confirmer l’archivage ? Les décisions, preuves et historiques sont conservés.</Text>
                <Button
                  onClick={async () => {
                    try {
                      await api('DELETE', `/api/grc/${smsi}/objects/${object.id}`, { ifMatch: object.version });
                      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                      onClose();
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  Confirmer l’archivage
                </Button>
                <Button variant="subtle" onClick={() => setArchiveConfirm(false)}>
                  Annuler
                </Button>
              </Alert>
            )}
          </>
        )}
        {history.data && (
          <>
            <Text fw={600}>Historique de la fiche</Text>
            {history.data.map((h) => (
              <Text key={h.version}>
                Version {h.version} · {h.createdBy} · {h.reason}
              </Text>
            ))}
          </>
        )}
      </Stack>
    </Modal>
  );
}
function Stages({
  method,
  stages,
  onChange,
  refs,
  readonly,
}: {
  method: RiskMethod;
  stages: RiskData['stages'];
  onChange: (s: RiskData['stages']) => void;
  refs: { ref: string; name: string }[];
  readonly: boolean;
}) {
  return (
    <Stack>
      {method.stages.map((step) => {
        const current = stages[step.id] ?? { status: 'draft' as const, values: {}, comment: '' };
        const update = (key: string, value: unknown) =>
          onChange({ ...stages, [step.id]: { ...current, values: { ...current.values, [key]: value as string } } });
        return (
          <Stack key={step.id}>
            <Text fw={600}>{step.label}</Text>
            <Text size="sm">{step.description}</Text>
            {method.fields
              .filter((f) => f.stage === step.id)
              .map((f) => {
                const v = current.values[f.id];
                return f.type === 'choice' ? (
                  <Select
                    key={f.id}
                    label={f.label}
                    required={f.required}
                    data={f.options.map((o) => ({ value: o.id, label: o.label }))}
                    value={typeof v === 'string' ? v : null}
                    onChange={(value) => update(f.id, value ?? '')}
                    disabled={readonly}
                  />
                ) : f.type === 'number' ? (
                  <NumberInput
                    key={f.id}
                    label={f.label}
                    value={typeof v === 'number' ? v : ''}
                    onChange={(value) => update(f.id, Number(value))}
                    disabled={readonly}
                  />
                ) : f.type === 'boolean' ? (
                  <Checkbox
                    key={f.id}
                    label={f.label}
                    checked={v === true}
                    onChange={(e) => update(f.id, e.currentTarget.checked)}
                    disabled={readonly}
                  />
                ) : f.type === 'references' ? (
                  <MultiSelect
                    key={f.id}
                    label={f.label}
                    searchable
                    value={Array.isArray(v) ? v : []}
                    data={refs.map((r) => ({ value: r.ref, label: r.name }))}
                    onChange={(values) => update(f.id, values)}
                    disabled={readonly}
                  />
                ) : f.type === 'longtext' ? (
                  <Textarea
                    key={f.id}
                    label={f.label}
                    required={f.required}
                    value={String(v ?? '')}
                    onChange={(e) => update(f.id, e.currentTarget.value)}
                    disabled={readonly}
                  />
                ) : (
                  <TextInput
                    key={f.id}
                    type={f.type === 'date' ? 'date' : 'text'}
                    label={f.label}
                    value={String(v ?? '')}
                    onChange={(e) => update(f.id, e.currentTarget.value)}
                    disabled={readonly}
                  />
                );
              })}
            <Textarea
              label={'Commentaire — ' + step.label}
              value={current.comment}
              onChange={(e) => onChange({ ...stages, [step.id]: { ...current, comment: e.currentTarget.value } })}
              disabled={readonly}
            />
            <Select
              label={'Validation — ' + step.label}
              value={current.status}
              data={[
                { value: 'draft', label: 'Brouillon' },
                { value: 'reviewed', label: 'Revue' },
                { value: 'validated', label: 'Validée' },
              ]}
              onChange={(v) => onChange({ ...stages, [step.id]: { ...current, status: v as typeof current.status } })}
              disabled={readonly}
            />
          </Stack>
        );
      })}
    </Stack>
  );
}
