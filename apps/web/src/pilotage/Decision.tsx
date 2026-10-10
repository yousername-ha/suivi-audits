import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { GrcObject, PilotageRecord } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import type { Source } from './Fields';
export const OPERATION_LABELS: Record<PilotageRecord['operation'], string> = {
  proof_review: 'Examiner la preuve',
  control_execution: 'Enregistrer le contrôle',
  effectiveness: 'Vérifier l’efficacité',
  close: 'Clôturer le constat',
  step_validation: 'Valider les travaux de l’étape',
  approval: 'Valider la fiche',
  action_create: 'Créer une action suivie',
};
export function Decision({
  smsi,
  object,
  operation,
  step = '',
  onClose,
}: {
  smsi: string;
  object: GrcObject | null;
  operation: PilotageRecord['operation'];
  step?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient(),
    [error, setError] = useState<unknown>(null),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState('');
  const [note, setNote] = useState(''),
    [date, setDate] = useState(''),
    [result, setResult] = useState(''),
    [refs, setRefs] = useState<string[]>([]),
    [finding, setFinding] = useState(false),
    [action, setAction] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [requestId, setRequestId] = useState('');
  const sources = useQuery({
    queryKey: ['grc', smsi, 'sources', search],
    queryFn: () => get<{ items: Source[] }>(`/api/grc/${smsi}/sources?search=${encodeURIComponent(search)}`),
    enabled: !!object,
  });
  useEffect(() => {
    if (object) {
      setError(null);
      setNote('');
      setDate(new Date().toLocaleDateString('sv-SE'));
      setResult(
        operation === 'proof_review' || operation === 'approval'
          ? 'accepted'
          : operation === 'control_execution'
            ? 'pass'
            : operation === 'effectiveness'
              ? 'effective'
              : 'completed',
      );
      setRefs(
        operation === 'proof_review' && Array.isArray(object.data.documentRefs)
          ? (object.data.documentRefs as string[])
          : [],
      );
      setFinding(false);
      setAction(operation === 'action_create');
      setConfirmed(false);
      setRequestId(crypto.randomUUID());
    }
  }, [object, operation, step]);
  const values =
    operation === 'proof_review' || operation === 'approval'
      ? [
          ['accepted', 'Accepté'],
          ['rejected', 'À corriger'],
        ]
      : operation === 'control_execution'
        ? [
            ['pass', 'Réussi'],
            ['partial', 'Partiellement réussi'],
            ['fail', 'Non réussi'],
          ]
        : operation === 'effectiveness'
          ? [
              ['effective', 'Efficace'],
              ['ineffective', 'Non efficace'],
            ]
          : [['completed', 'Travaux réalisés']];
  const options = (sources.data?.items ?? []).filter(
    (s) => operation !== 'proof_review' || s.ref.startsWith('document:'),
  );
  for (const ref of refs)
    if (!options.some((s) => s.ref === ref)) options.push({ ref, name: 'Référence sélectionnée', kind: '' });
  const save = async () => {
    if (!object) return;
    setSaving(true);
    try {
      await api('POST', `/api/grc/${smsi}/pilotage/decisions`, {
        ifMatch: object.version,
        body: {
          ref: object.id.startsWith('legacy:') ? object.id : 'object:' + object.id,
          decision: {
            operation,
            step,
            requestId,
            note,
            date,
            result,
            refs,
            createFinding: finding,
            createAction: action,
            confirm: 'ENREGISTRER',
          },
        },
      });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      opened={!!object}
      onClose={onClose}
      title={OPERATION_LABELS[operation]}
      size="lg"
      closeButtonProps={{ 'aria-label': 'Fermer la décision' }}
    >
      <Stack>
        <Text fw={600}>{object?.name}</Text>
        <ErrorAlert error={error ?? sources.error} />
        <TextInput
          type="date"
          label="Date de réalisation"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
        />
        <Select
          label="Résultat"
          data={values.map(([value, label]) => ({ value: value!, label: label! }))}
          value={result}
          onChange={(v) => {
            setResult(v ?? '');
            if (v === 'pass') setFinding(false);
          }}
        />
        <Textarea
          label="Observations et justification"
          description="Indiquez ce qui a été examiné ou réalisé et pourquoi vous prenez cette décision."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <TextInput
          label="Rechercher un justificatif"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <MultiSelect
          label={
            operation === 'proof_review'
              ? 'Versions exactes des documents examinés'
              : 'Travaux réalisés et justificatifs'
          }
          searchable
          data={options.map((s) => ({ value: s.ref, label: s.name }))}
          value={refs}
          onChange={setRefs}
        />
        {operation === 'control_execution' && result !== 'pass' && (
          <Checkbox
            label="Créer un écart dans le registre existant"
            checked={finding}
            onChange={(e) => setFinding(e.currentTarget.checked)}
          />
        )}{' '}
        {['control_execution', 'effectiveness', 'approval'].includes(operation) && (
          <Checkbox
            label="Créer une action corrective suivie"
            checked={action}
            onChange={(e) => setAction(e.currentTarget.checked)}
          />
        )}
        <Alert>La décision et les versions examinées sont conservées dans l’historique.</Alert>
        <Checkbox
          label="Je confirme l’enregistrement de cette décision"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={saving} disabled={!confirmed || note.trim().length < 10} onClick={() => void save()}>
            Confirmer l’enregistrement
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
