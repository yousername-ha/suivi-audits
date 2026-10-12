/* B1 : prévisualisation obligatoire, configuration protégée et données conservées. */
import { Alert, Badge, Button, Card, Checkbox, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import {
  MODULE_LABELS,
  type Module,
  type ModuleDefinition,
  type ModuleIntent,
  type ModulePlan,
  type ModuleState,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { useCan, useRefreshMe } from '../session';

type Registry = ModuleState & { registry: ModuleDefinition[] };
type Preview = ModulePlan & { version: number; previewId: string };
type History = {
  id: number;
  created_at: string;
  username: string;
  details: { before: ModuleState; after: ModuleState };
};
export function ModulesPanel() {
  const can = useCan();
  const writable = can('administration', 'administrer');
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const q = useQuery({ queryKey: ['admin', 'modules'], queryFn: () => get<Registry>('/api/modules') });
  const history = useQuery({
    queryKey: ['admin', 'modules', 'history'],
    queryFn: () => get<History[]>('/api/admin/modules/history'),
  });
  const [changes, setChanges] = useState<ModuleIntent['changes']>([]);
  const [cascade, setCascade] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const resetPreview = () => {
    setPreview(null);
    setConfirmation('');
    setError(null);
  };
  const intent = { changes, cascade };
  const simulate = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api<Preview>('POST', '/api/admin/modules/preview', { body: intent }));
      setConfirmation('');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await api('PUT', '/api/admin/modules', {
        ifMatch: preview.version,
        body: { intent, previewId: preview.previewId, confirm: confirmation },
      });
      setChanges([]);
      resetPreview();
      await refreshMe();
      await qc.invalidateQueries();
    } catch (e) {
      setError(e);
      setPreview(null);
      setConfirmation('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card withBorder>
      <Stack>
        <Title order={2} size="h4">
          Activation des modules
        </Title>
        <Text size="sm">
          La désactivation masque les menus et bloque les API du module. Ses données enregistrées et sa configuration
          sont conservées pour la réactivation.
        </Text>
        <Alert color="blue">
          Authentification, comptes, droits, journal de sécurité, sauvegardes et TLS restent opérationnels.
          Administration et paramètres sont protégés.
        </Alert>
        <ErrorAlert error={q.error || history.error || error} />
        <div className="table-wrap" role="region" aria-label="Modules" tabIndex={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Module</Table.Th>
                <Table.Th>Activation souhaitée</Table.Th>
                <Table.Th>Dépendances</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data?.registry.map((m) => {
                const enabled = changes.find((c) => c.id === m.id)?.enabled ?? !q.data!.disabled.includes(m.id);
                return (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      {m.label}
                      {m.protected && <Badge ml="xs">Socle protégé</Badge>}
                    </Table.Td>
                    <Table.Td>
                      <Checkbox
                        aria-label={`Activer ${m.label}`}
                        checked={enabled}
                        disabled={!writable || m.protected || busy}
                        onChange={(e) => {
                          resetPreview();
                          const enabled = e.currentTarget.checked;
                          setChanges((v) => [
                            ...v.filter((c) => c.id !== m.id),
                            ...(enabled === !q.data!.disabled.includes(m.id) ? [] : [{ id: m.id, enabled }]),
                          ]);
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        Obligatoires : {m.required.map((id) => MODULE_LABELS[id]).join(', ') || 'aucune'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Facultatives : {m.optional.map((id) => MODULE_LABELS[id]).join(', ') || 'aucune'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
        {writable && (
          <>
            <Checkbox
              label="Inclure les dépendances dans la prévisualisation (cascade contrôlée)"
              checked={cascade}
              disabled={busy}
              onChange={(e) => {
                setCascade(e.currentTarget.checked);
                resetPreview();
              }}
            />
            <Group>
              <Button variant="light" disabled={!changes.length || busy} onClick={() => void simulate()}>
                Prévisualiser les conséquences
              </Button>
              <Button
                variant="subtle"
                disabled={busy || !changes.length}
                onClick={() => {
                  setChanges([]);
                  resetPreview();
                }}
              >
                Annuler les changements
              </Button>
            </Group>
          </>
        )}
        {preview && (
          <Stack>
            <Title order={3} size="h5">
              Conséquences à confirmer
            </Title>
            <Alert color="yellow">
              Enregistrez les modifications en cours dans les écrans ouverts avant de confirmer. Les écrans actualisent
              leurs données et leurs droits ; l’ancienne interface se recharge.
            </Alert>
            {preview.changes.map((c) => (
              <Text key={c.id} size="sm">
                {c.enabled ? 'Activation' : 'Désactivation'} : {MODULE_LABELS[c.id]}
                {c.automatic ? ' (dépendance incluse)' : ''}
              </Text>
            ))}
            {preview.warnings.map((warning) => (
              <Alert key={warning} color="yellow">
                {warning}
              </Alert>
            ))}
            {preview.blockers.map((blocker) => (
              <Alert key={blocker} color="red">
                {blocker}
              </Alert>
            ))}
            {preview.version !== q.data?.version && (
              <Alert color="red">La configuration a changé. Relancez la prévisualisation.</Alert>
            )}
            <TextInput
              label="Saisissez VALIDER pour confirmer ces conséquences"
              value={confirmation}
              onChange={(e) => setConfirmation(e.currentTarget.value)}
              disabled={busy || preview.blockers.length > 0}
            />
            <Button
              disabled={
                busy ||
                confirmation !== 'VALIDER' ||
                !preview.changes.length ||
                !!preview.blockers.length ||
                preview.version !== q.data?.version
              }
              onClick={() => void apply()}
            >
              Appliquer la configuration
            </Button>
          </Stack>
        )}
        <Title order={3} size="h5">
          Historique des activations
        </Title>
        {!history.data?.length && (
          <Text size="sm" c="dimmed">
            Aucun changement enregistré.
          </Text>
        )}
        {history.data?.map((h) => (
          <Text key={h.id} size="sm">
            {fmtDate(h.created_at)} — {h.username} — version {h.details.after.version} — modules désactivés :{' '}
            {h.details.after.disabled.map((id: Module) => MODULE_LABELS[id]).join(', ') || 'aucun'}
          </Text>
        ))}
      </Stack>
    </Card>
  );
}
