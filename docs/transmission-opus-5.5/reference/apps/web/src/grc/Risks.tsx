import { Alert, Button, Card, Modal, Select, Stack, Textarea, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type GrcObject, type MethodRating, type RiskMethod, type RiskRatings } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
export interface MethodVersion {
  id: string;
  methodId: string;
  version: number;
  definition: RiskMethod;
  reason: string;
  createdBy: string;
  createdAt: string;
}
function Rating({
  method,
  value,
  onChange,
  title,
}: {
  method: RiskMethod;
  value: MethodRating;
  onChange: (r: MethodRating) => void;
  title: string;
}) {
  return (
    <Card withBorder>
      <Stack>
        <Text fw={600}>{title}</Text>
        {method.dimensions.map((d) => (
          <Select
            key={d.id}
            label={d.label}
            value={value.dimensions[d.id] ?? null}
            data={d.levels.map((l) => ({ value: l.id, label: l.label }))}
            onChange={(v) => v && onChange({ ...value, dimensions: { ...value.dimensions, [d.id]: v } })}
          />
        ))}
        <Select
          label="Vraisemblance"
          value={value.likelihood}
          data={method.likelihood.map((l) => ({ value: l.id, label: l.label }))}
          onChange={(v) => v && onChange({ ...value, likelihood: v })}
        />
        {method.calculation.kind === 'judgement' && (
          <Select
            label="Niveau de risque — jugement documenté"
            value={value.level}
            data={method.levels.map((l) => ({ value: l.id, label: l.label }))}
            onChange={(v) => onChange({ ...value, level: v })}
          />
        )}
        {method.calculation.kind === 'lookup' &&
          method.calculation.inputs
            .filter((k) => k !== 'likelihood' && !method.dimensions.some((d) => d.id === k))
            .map((k) => {
              const f = method.fields.find((f) => f.id === k);
              return (
                <Select
                  key={k}
                  label={f?.label ?? k}
                  value={value.inputs[k] ?? null}
                  data={(f?.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
                  onChange={(v) => v && onChange({ ...value, inputs: { ...value.inputs, [k]: v } })}
                />
              );
            })}
        <Text size="sm">
          {method.calculation.kind === 'matrix'
            ? `Matrice publiée : ${method.dimensions.find((d) => method.calculation.kind === 'matrix' && d.id === method.calculation.dimension)?.label}. Les autres impacts restent documentés.`
            : method.calculation.kind === 'judgement'
              ? 'Le niveau est choisi explicitement ; aucun score artificiel.'
              : 'Règles spécifiques à cette version méthodologique.'}
        </Text>
      </Stack>
    </Card>
  );
}
export function RiskEvaluation({ smsi, risk, onClose }: { smsi: string; risk: GrcObject | null; onClose: () => void }) {
  const can = useCan(),
    qc = useQueryClient();
  const methods = useQuery({
    queryKey: ['grc', smsi, 'methods'],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods`),
  });
  const history = useQuery({
    queryKey: ['grc', smsi, 'evaluations', risk?.id],
    queryFn: () => get<Record<string, unknown>[]>(`/api/grc/${smsi}/risks/${risk!.id}/evaluations`),
    enabled: !!risk,
  });
  const specific = useQuery({
    queryKey: ['grc', smsi, 'method-version', risk?.data.methodId, risk?.data.methodVersion],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods/${risk!.data.methodId}/history`),
    enabled: !!risk,
  });
  const method =
    specific.data?.find((m) => m.version === risk?.data.methodVersion)?.definition ??
    methods.data?.find((m) => m.methodId === risk?.data.methodId && m.version === risk?.data.methodVersion)?.definition;
  const [ratings, setRatings] = useState<RiskRatings | null>(null),
    [rationale, setRationale] = useState(''),
    [decision, setDecision] = useState('draft'),
    [preview, setPreview] = useState<{
      previewId: string;
      version: number;
      result: {
        gross: { label: string; acceptability: string; score: number | null };
        residual: { label: string; acceptability: string; score: number | null };
      };
    } | null>(null),
    [error, setError] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const current =
    ratings ??
    (method
      ? (() => {
          const r: MethodRating = {
            dimensions: Object.fromEntries(method.dimensions.map((d) => [d.id, d.levels[0]!.id])),
            likelihood: method.likelihood[0]!.id,
            level: method.levels[0]!.id,
            inputs: {},
          };
          return { gross: structuredClone(r), residual: structuredClone(r) };
        })()
      : null);
  const run = async (save = false) => {
    setBusy(true);
    try {
      setError(null);
      if (!risk) return;
      const body = { ratings: current, rationale, decision };
      if (save && preview) {
        await api('POST', `/api/grc/${smsi}/risks/${risk.id}/evaluate`, {
          ifMatch: preview.version,
          body: { ...body, previewId: preview.previewId, requestId: crypto.randomUUID(), confirm: 'ENREGISTRER' },
        });
        await qc.invalidateQueries({ queryKey: ['grc', smsi] });
        setPreview(null);
        setConfirm(false);
      } else setPreview(await api('POST', `/api/grc/${smsi}/risks/${risk.id}/preview`, { body }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={!!risk} onClose={onClose} title={`Appréciation — ${risk?.name ?? ''}`} size="xl">
      <Stack>
        <ErrorAlert error={error ?? history.error ?? specific.error} />
        {method && current && (
          <>
            <Text>
              {method.name} · version {String(risk?.data.methodVersion)}
            </Text>
            <Alert>
              Une action achevée ne modifie pas le résiduel. Chaque appréciation conserve ses critères et sa décision.
            </Alert>
            <Rating
              method={method}
              value={current.gross}
              title="Risque brut"
              onChange={(gross) => {
                setRatings({ ...current, gross });
                setPreview(null);
              }}
            />
            <Rating
              method={method}
              value={current.residual}
              title="Risque résiduel"
              onChange={(residual) => {
                setRatings({ ...current, residual });
                setPreview(null);
              }}
            />
            <Textarea
              label="Justification de l’appréciation"
              value={rationale}
              minRows={3}
              onChange={(e) => {
                setRationale(e.currentTarget.value);
                setPreview(null);
              }}
            />
            <Select
              label="Décision"
              value={decision}
              onChange={(v) => {
                setDecision(v ?? 'draft');
                setPreview(null);
              }}
              data={[
                { value: 'draft', label: 'Proposition documentée' },
                ...(can('pilotage', 'administrer') ? [{ value: 'approved', label: 'Approbation humaine' }] : []),
              ]}
            />
            {can('pilotage', 'modifier') && (
              <Button loading={busy} onClick={() => void run()}>
                Simuler l’appréciation
              </Button>
            )}
            {preview && (
              <Card withBorder>
                <Text>
                  Brut : {preview.result.gross.label} · {preview.result.gross.acceptability}
                </Text>
                <Text>
                  Résiduel : {preview.result.residual.label} · {preview.result.residual.acceptability}
                </Text>
                <Button onClick={() => setConfirm(true)}>Enregistrer cette décision</Button>
              </Card>
            )}
            {confirm && (
              <Alert>
                <Text>Confirmez l’enregistrement immuable de ces critères et de cette justification.</Text>
                <Button loading={busy} onClick={() => void run(true)}>
                  Confirmer l’enregistrement
                </Button>
                <Button variant="subtle" onClick={() => setConfirm(false)}>
                  Annuler
                </Button>
              </Alert>
            )}
          </>
        )}
        <Text fw={600}>Décisions conservées</Text>
        {history.data?.map((e) => (
          <Card withBorder key={String(e.id)}>
            <Text>
              Révision {String(e.revision)} · {String(e.created_by)} ·{' '}
              {new Date(String(e.created_at)).toLocaleString('fr-FR')}
            </Text>
            <Text>{String(e.rationale)}</Text>
            <Text>{JSON.stringify(e.result)}</Text>
            <Text size="sm">
              Méthode conservée : {String((e.method as RiskMethod).name)} · {String(e.decision)}
            </Text>
          </Card>
        ))}
      </Stack>
    </Modal>
  );
}
