import { Anchor, Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { UpdateState } from '@suivi/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, get } from '../api';
import { ErrorAlert } from './common';
import { useCan, useMe } from '../session';

function useUpdateState() {
  return useQuery({ queryKey: ['updates'], queryFn: () => get<UpdateState>('/api/updates'), refetchInterval: 15000 });
}
function available(s?: UpdateState) {
  if (!s?.available || !/^\d+\.\d+\.\d+$/.test(s.installed)) return false;
  const a = s.installed.split('.').map(Number),
    b = s.available.split('.').map(Number);
  const i = a.findIndex((v, index) => v !== b[index]);
  return i >= 0 && a[i]! < b[i]!;
}
function useUpdateAdmin() {
  const me = useMe();
  const can = useCan();
  return !!me.user?.roles.includes('Administrateur') && can('administration', 'administrer');
}
export function UpdateNotice() {
  const q = useUpdateState();
  const admin = useUpdateAdmin();
  if (!available(q.data)) return <div data-native-updates hidden />;
  return (
    <div className="update-notice" data-native-updates role="status">
      <span>
        Mise à jour disponible : <b>{q.data!.available}</b> · Version installée : {q.data!.installed}
      </span>
      {q.data?.notes && (
        <Anchor size="xs" href={q.data.notes} target="_blank" rel="noreferrer">
          Nouveautés
        </Anchor>
      )}
      {admin && (
        <Anchor size="xs" component={Link} to="/systeme/mises-a-jour">
          Mettre à jour
        </Anchor>
      )}
    </div>
  );
}
export function UpdatesPanel() {
  const q = useUpdateState();
  const admin = useUpdateAdmin();
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const id = useRef<string | null>(null);
  const s = q.data;
  const busy = pending || !!queued || !!s?.maintenance || s?.status === 'queued' || s?.status === 'running';
  useEffect(() => {
    if (queued && s?.id === queued && ['success', 'failed', 'rolled_back', 'intervention'].includes(s.status)) {
      setQueued(null);
      id.current = null;
      setConfirm('');
    }
  }, [queued, s?.id, s?.status]);
  async function check() {
    setPending(true);
    setError(null);
    try {
      await api('POST', '/api/admin/updates/check');
      await q.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  async function install() {
    if (!s?.available) return;
    id.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      const response = await api<{ id: string }>('POST', '/api/admin/updates/install', {
        body: { requestId: id.current, version: s.available, confirm },
      });
      setQueued(response.id);
      await q.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <Card withBorder id="updates">
      <Stack>
        <Title order={2} size="h4">
          Mise à jour de l’application
        </Title>
        <ErrorAlert error={error || q.error} />
        <Text size="sm">
          Version installée : {s?.installed ?? '…'}.{' '}
          {available(s)
            ? `Nouvelle version : ${s?.available}.`
            : s?.checkedAt && !s.checkError
              ? 'Aucune nouvelle version détectée.'
              : 'Disponibilité à vérifier.'}
        </Text>
        {s?.notes && (
          <Anchor href={s.notes} target="_blank" rel="noreferrer">
            Consulter les nouveautés
          </Anchor>
        )}
        {s?.checkError && (
          <Text size="sm">GitHub est temporairement indisponible. La dernière information connue est conservée.</Text>
        )}
        {s?.checkedAt && (
          <Text size="xs" c="dimmed">
            Dernière vérification : {new Date(s.checkedAt).toLocaleString()}.
          </Text>
        )}
        {s?.message && (
          <Text size="sm" role="status">
            {s.message}
          </Text>
        )}
        {queued && (
          <Text size="sm">
            Demande enregistrée. La page de maintenance s’ouvrira automatiquement après préparation.
          </Text>
        )}
        {!s?.ready && <Text size="sm">Le service de mise à jour n’est pas disponible actuellement.</Text>}
        {admin && (
          <>
            <Group>
              <Button variant="default" disabled={busy || !s?.ready || s?.checking} onClick={() => void check()}>
                Vérifier les mises à jour
              </Button>
            </Group>
            {available(s) && (
              <>
                <Text size="sm">
                  Enregistrez vos modifications en cours. Le serveur créera une sauvegarde chiffrée, vérifiera la
                  publication et le redémarrage. Tous les utilisateurs verront la page de maintenance pendant
                  l’installation ; un retour sécurisé sera tenté en cas d’échec.
                </Text>
                <TextInput
                  label="Taper METTRE À JOUR pour confirmer"
                  value={confirm}
                  disabled={busy}
                  onChange={(e) => setConfirm(e.currentTarget.value)}
                />
                <Group>
                  <Button
                    disabled={busy || !s?.ready || confirm !== 'METTRE À JOUR'}
                    loading={pending}
                    onClick={() => void install()}
                  >
                    Installer la version {s?.available}
                  </Button>
                </Group>
              </>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
