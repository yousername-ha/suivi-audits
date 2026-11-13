import { Button, Card, Select, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
export function Members({ smsi }: { smsi: string }) {
  const qc = useQueryClient(),
    [userId, setUserId] = useState(''),
    [write, setWrite] = useState('read'),
    [error, setError] = useState<unknown>(null);
  const members = useQuery({
    queryKey: ['grc', smsi, 'members'],
    queryFn: () =>
      get<{ userId: string; username: string; displayName: string; write: boolean }[]>(`/api/grc/${smsi}/members`),
  });
  const users = useQuery({
    queryKey: ['grc', 'accounts'],
    queryFn: () => get<{ id: string; username: string; displayName?: string }[]>(`/api/grc/${smsi}/member-candidates`),
  });
  return (
    <Stack>
      <ErrorAlert error={error ?? members.error ?? users.error} />
      <Select
        label="Compte à ajouter"
        searchable
        value={userId || null}
        onChange={(v) => setUserId(v ?? '')}
        data={(users.data ?? []).map((u) => ({ value: u.id, label: u.displayName || u.username }))}
      />
      <Select
        label="Accès au périmètre"
        value={write}
        onChange={(v) => setWrite(v ?? 'read')}
        data={[
          { value: 'read', label: 'Lecture seule' },
          { value: 'write', label: 'Lecture et écriture selon les droits métier' },
        ]}
      />
      <Button
        onClick={async () => {
          try {
            await api('PUT', `/api/grc/${smsi}/members`, { body: { userId, write: write === 'write' } });
            await qc.invalidateQueries({ queryKey: ['grc', smsi] });
          } catch (e) {
            setError(e);
          }
        }}
      >
        Attribuer l’accès
      </Button>
      {members.data?.map((m) => (
        <Card withBorder key={m.userId}>
          <Text>
            {m.displayName || m.username} · {m.write ? 'Écriture' : 'Lecture'}
          </Text>
          <Button
            variant="subtle"
            onClick={async () => {
              try {
                await api('DELETE', `/api/grc/${smsi}/members/${m.userId}`);
                await qc.invalidateQueries({ queryKey: ['grc', smsi] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            Révoquer l’accès
          </Button>
        </Card>
      ))}
    </Stack>
  );
}
