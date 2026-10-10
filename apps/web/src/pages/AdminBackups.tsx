/* A1a : demandes et résultats ; les opérations système restent exécutées sur le serveur. */
import { Alert, Button, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { BackupJobOut, BackupsOut, ExploitationOut } from '@suivi/shared';
import { StatusChip, type Etat } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, get, post } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, fmtOctets } from '../components/common';
import { useCan } from '../session';

const KEY = ['admin', 'sauvegardes'];
const STATUS: Record<BackupJobOut['status'], [Etat, string]> = {
  en_attente: ['attention', 'En attente'],
  en_cours: ['info', 'En cours'],
  reussie: ['succes', 'Réussie'],
  echec: ['erreur', 'Échec'],
  annulee: ['neutre', 'Annulée'],
};
export function BackupsPanel() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => get<BackupsOut>('/api/admin/sauvegardes'),
    refetchInterval: 5_000,
  });
  const exploitation = useQuery({
    queryKey: ['admin', 'exploitation'],
    queryFn: () => get<ExploitationOut>('/api/admin/exploitation'),
    refetchInterval: 5000,
  });
  const qc = useQueryClient();
  const can = useCan();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef<string | null>(null);
  const seen = useRef(new Map<string, string>());
  const initialized = useRef(false);
  useEffect(() => {
    if (!q.data) return;
    for (const j of q.data.jobs) {
      const before = seen.current.get(j.id);
      if (initialized.current && before !== j.status && ['reussie', 'echec'].includes(j.status))
        notifications.show({
          message: `Sauvegarde : ${STATUS[j.status][1]}. ${j.message}`,
          color: j.status === 'reussie' ? 'teal' : 'red',
        });
      seen.current.set(j.id, j.status);
    }
    initialized.current = true;
  }, [q.data]);
  const update = async (fn: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: KEY });
      await qc.invalidateQueries({ queryKey: ['admin', 'systeme'] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  const request = () =>
    update(async () => {
      requestId.current ??= crypto.randomUUID();
      const job = await post<BackupJobOut>('/api/admin/sauvegardes', { requestId: requestId.current });
      requestId.current = null;
      notifications.show({
        message:
          job.status === 'en_attente'
            ? 'Demande enregistrée. La sauvegarde sera exécutée sur le serveur.'
            : `Demande précédente retrouvée : ${STATUS[job.status][1]}. Vous pouvez demander une nouvelle sauvegarde.`,
        color: 'blue',
      });
    });
  const active =
    q.data?.jobs.some((j) => j.status === 'en_attente' || j.status === 'en_cours') ||
    exploitation.data?.jobs.some((j) => ['en_attente', 'en_cours', 'intervention'].includes(j.status));
  return (
    <Card withBorder>
      <Stack>
        <Title order={2} size="h4">
          Demandes de sauvegarde
        </Title>
        <Text size="sm">
          Sauvegarde complète chiffrée : base, secrets et certificats internes. Les clés et la destination restent
          configurées sur le serveur.
        </Text>
        <ErrorAlert error={error ?? q.error} />
        {q.data && !q.data.worker.available && (
          <Alert color="yellow" title="Exécutant serveur indisponible">
            Le service de sauvegarde n’a pas encore répondu. Vérifiez l’état du service de mise à jour et la
            configuration de sauvegarde sur le serveur.
          </Alert>
        )}
        {q.data?.worker.seenAt && (
          <Text size="sm" c="dimmed">
            Dernier contact de l’exécutant : {fmtDate(q.data.worker.seenAt)}
          </Text>
        )}
        {can('administration', 'administrer') && (
          <Group>
            <ConfirmButton
              color="blue"
              disabled={pending || !q.data?.worker.available || !!active}
              message="Demander une sauvegarde complète chiffrée ? Elle sera exécutée par le serveur et suivie ici."
              onConfirm={() => void request()}
            >
              Demander une sauvegarde
            </ConfirmButton>
          </Group>
        )}
        {q.data?.jobs.length === 0 && (
          <Text size="sm" c="dimmed">
            Aucune demande de sauvegarde.
          </Text>
        )}
        {!!q.data?.jobs.length && (
          <div className="table-wrap">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Demande</Table.Th>
                  <Table.Th>État</Table.Th>
                  <Table.Th>Résultat</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {q.data.jobs.map((j) => (
                  <Table.Tr key={j.id}>
                    <Table.Td>
                      <Text size="sm">{fmtDate(j.createdAt)}</Text>
                      <Text size="sm" c="dimmed">
                        {j.requestedBy}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusChip etat={STATUS[j.status][0]}>{STATUS[j.status][1]}</StatusChip>
                    </Table.Td>
                    <Table.Td>
                      {j.report ? (
                        <Stack gap="2xs">
                          <Text size="sm" className="mono">
                            {j.report.fichier}
                          </Text>
                          <Text size="sm">
                            {fmtOctets(j.report.tailleOctets)} · {j.report.dureeSecondes} s · Chiffrée · SHA-256 vérifié
                          </Text>
                          <Text size="sm" className="mono">
                            {j.report.sha256}
                          </Text>
                        </Stack>
                      ) : (
                        <Text size="sm">
                          {j.message ||
                            (j.status === 'en_attente' ? 'En attente du prochain passage de l’exécutant.' : '—')}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {j.status === 'en_attente' && can('administration', 'administrer') && (
                        <Button
                          variant="default"
                          size="xs"
                          disabled={pending}
                          onClick={() =>
                            void update(async () => {
                              await api('POST', `/api/admin/sauvegardes/${j.id}/annuler`, {
                                body: {},
                                ifMatch: j.version,
                              });
                              requestId.current = null;
                            })
                          }
                        >
                          Annuler la demande
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
        <Text size="sm" c="dimmed">
          La restauration guidée, la planification et la rétention sont accessibles ci-dessous lorsque le pilotage
          serveur est activé. Le contrôle d’empreinte ne remplace pas un test de restauration isolé.
        </Text>
      </Stack>
    </Card>
  );
}
