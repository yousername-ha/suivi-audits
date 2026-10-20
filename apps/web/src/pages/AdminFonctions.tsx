/* Fonctions de l'organisation (ADR 0043 §responsables) : annuaire des titulaires, désignables comme responsables
   d'actions et de tâches au même titre qu'une personne ou un groupe. */
import { Alert, Button, Card, Group, Modal, MultiSelect, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { FonctionDto } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert } from '../components/common';
import { useCan } from '../session';

const useFonctions = () =>
  useQuery({ queryKey: ['admin', 'fonctions'], queryFn: () => get<FonctionDto[]>('/api/admin/fonctions') });
const useUtilisateurs = () =>
  useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => get<{ id: string; display_name: string; username: string }[]>('/api/admin/users'),
  });

export function FonctionsPanel() {
  const can = useCan();
  const qc = useQueryClient();
  const q = useFonctions();
  const [edit, setEdit] = useState<{ fonction: FonctionDto | null } | null>(null);
  const admin = can('administration', 'administrer');
  const rafraichir = () => qc.invalidateQueries({ queryKey: ['admin', 'fonctions'] });
  return (
    <Stack>
      {admin && (
        <Group>
          <Button onClick={() => setEdit({ fonction: null })}>Nouvelle fonction</Button>
        </Group>
      )}
      <ErrorAlert error={q.error} />
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Fonctions" tabIndex={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fonction</Table.Th>
                <Table.Th>Titulaires</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? [])
                .filter((f) => !f.archived)
                .map((f) => (
                  <Table.Tr key={f.id}>
                    <Table.Td>
                      <Text fw={600}>{f.name}</Text>
                      {f.description && (
                        <Text size="xs" c="dimmed">
                          {f.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {f.members.length ? f.members.map((m) => m.displayName || m.username).join(', ') : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {admin && (
                        <Group gap="2xs" wrap="nowrap">
                          <Button size="compact-sm" variant="default" onClick={() => setEdit({ fonction: f })}>
                            Modifier
                          </Button>
                          <ConfirmButton
                            size="compact-sm"
                            variant="light"
                            message={`Archiver la fonction « ${f.name} » ? Les fiches qui la désignent restent lisibles.`}
                            onConfirm={async () => {
                              try {
                                await api('DELETE', `/api/admin/fonctions/${f.id}`);
                                notifications.show({ color: 'teal', message: 'Fonction archivée.' });
                                await rafraichir();
                              } catch (e) {
                                notifications.show({ color: 'red', message: errorMessage(e) });
                              }
                            }}
                          >
                            Archiver
                          </ConfirmButton>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              {q.data && !q.data.some((f) => !f.archived) && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text size="sm" c="dimmed">
                      Aucune fonction. Une fonction (par exemple « Responsable qualité ») regroupe ses titulaires et
                      peut être désignée responsable d’une action ou d’une tâche.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Modal
        opened={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.fonction ? `Modifier la fonction ${edit.fonction.name}` : 'Nouvelle fonction'}
        size="lg"
        centered
      >
        {edit && (
          <FonctionEditor
            fonction={edit.fonction}
            onDone={async () => {
              setEdit(null);
              await rafraichir();
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

function FonctionEditor({ fonction, onDone }: { fonction: FonctionDto | null; onDone: () => void }) {
  const users = useUtilisateurs();
  const [f, setF] = useState({
    name: fonction?.name ?? '',
    description: fonction?.description ?? '',
    members: fonction?.members.map((m) => m.id) ?? [],
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Stack>
      {err && (
        <Alert color="red" role="alert">
          {err}
        </Alert>
      )}
      <TextInput label="Nom" required value={f.name} onChange={(e) => setF({ ...f, name: e.currentTarget.value })} />
      <Textarea
        label="Description"
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.currentTarget.value })}
        autosize
        minRows={2}
      />
      <MultiSelect
        label="Titulaires"
        data={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.display_name} (${u.username})` }))}
        value={f.members}
        onChange={(v) => setF({ ...f, members: v })}
        searchable
      />
      <Group justify="flex-end">
        <Button
          onClick={async () => {
            setErr(null);
            try {
              if (fonction) await api('PUT', `/api/admin/fonctions/${fonction.id}`, { body: f });
              else await api('POST', '/api/admin/fonctions', { body: f });
              notifications.show({ color: 'teal', message: fonction ? 'Fonction modifiée.' : 'Fonction créée.' });
              onDone();
            } catch (e) {
              setErr(errorMessage(e));
            }
          }}
        >
          {fonction ? 'Enregistrer' : 'Créer'}
        </Button>
      </Group>
    </Stack>
  );
}
