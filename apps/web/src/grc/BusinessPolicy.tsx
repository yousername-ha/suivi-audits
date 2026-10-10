import { Alert, Button, Card, Stack, Textarea, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { BusinessPolicy } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { ConfigurationEditor } from './ConfigurationEditor';
import { useCan } from '../session';
export function BusinessPolicyPanel({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    [draft, setDraft] = useState<unknown>(null),
    [reason, setReason] = useState(''),
    [preview, setPreview] = useState<{ previewId: string; version: number } | null>(null),
    [error, setError] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false);
  const current = useQuery({
    queryKey: ['grc', 'business-policy'],
    queryFn: () => get<{ version: number; definition: BusinessPolicy }>('/api/admin/business-policy'),
  });
  const history = useQuery({
    queryKey: ['grc', 'business-policy-history'],
    queryFn: () => get<{ version: number; reason: string; createdBy: string }[]>('/api/admin/business-policy/history'),
  });
  const simulate = async () => {
    try {
      setError(null);
      setPreview(
        await api('POST', '/api/admin/business-policy/preview', {
          body: { definition: draft ?? current.data?.definition },
        }),
      );
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Stack>
      <Alert>
        Nomenclatures, workflow, modèles, tableaux de bord, notifications et affichage sont publiés ensemble. Un SMSI
        conserve sa version jusqu’à adoption explicite d’une nouvelle politique compatible.
      </Alert>
      <ErrorAlert error={error ?? current.error ?? history.error} />
      {current.data && (
        <>
          <Text>Politique globale : version {current.data.version}</Text>
          {can('administration', 'administrer') && (
            <>
              <ConfigurationEditor
                value={draft ?? current.data.definition}
                onChange={(v) => {
                  setDraft(v);
                  setPreview(null);
                }}
              />
              <Textarea
                label="Motif de publication métier"
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
              <Button onClick={() => void simulate()}>Simuler la politique métier</Button>
              {preview && <Button onClick={() => setConfirm(true)}>Publier la politique métier</Button>}
              {confirm && (
                <Alert>
                  <Text>Confirmer cette publication versionnée ?</Text>
                  <Button
                    onClick={async () => {
                      try {
                        await api('PUT', '/api/admin/business-policy', {
                          ifMatch: preview!.version,
                          body: {
                            definition: draft ?? current.data.definition,
                            previewId: preview!.previewId,
                            reason,
                            confirm: 'PUBLIER',
                          },
                        });
                        setPreview(null);
                        setDraft(null);
                        setConfirm(false);
                        await qc.invalidateQueries({ queryKey: ['grc'] });
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Confirmer la publication métier
                  </Button>
                </Alert>
              )}
            </>
          )}
          {can('pilotage', 'administrer') && (
            <Button
              variant="light"
              onClick={async () => {
                try {
                  const scope = await get<{ id: string; version: number }[]>(`/api/grc/smsis`);
                  await api('PUT', `/api/grc/${smsi}/policy`, {
                    ifMatch: scope.find((s) => s.id === smsi)?.version,
                    body: { version: current.data.version, confirm: 'ADOPTER' },
                  });
                  await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Adopter la politique globale pour ce SMSI
            </Button>
          )}
        </>
      )}
      {history.data?.map((h) => (
        <Card withBorder key={h.version}>
          <Text>
            Version {h.version} · {h.createdBy}
          </Text>
          <Text>{h.reason}</Text>
        </Card>
      ))}
    </Stack>
  );
}
