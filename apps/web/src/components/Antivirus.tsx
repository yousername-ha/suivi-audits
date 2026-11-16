/* Analyse antivirus des fichiers déposés (ADR 0097, précision du RSSI du 15/11/2026) : l'activer, c'est ouvrir le flux
   « antivirus » (mise à jour des signatures par freshclam), après validation explicite ; la désactiver le referme. Tant
   qu'elle est désactivée, un fichier déposé est accepté « non analysé ». */
import { Alert, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { FluxExternesOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { useCan } from '../session';
import { ConfirmButton, ErrorAlert } from './common';
import { CLE_FLUX_EXTERNES } from './FluxExternes';
import { useValidationFlux } from './ValidationFlux';

export function AntivirusPanel() {
  const can = useCan();
  const ecriture = can('administration', 'administrer');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE_FLUX_EXTERNES, queryFn: () => get<FluxExternesOut>('/api/admin/flux-externes') });
  const flux = useValidationFlux();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const etat = q.data?.modules.find((m) => m.module === 'antivirus');
  const basculer = async (ouvert: boolean) => {
    if (ouvert && !(await flux.valider('antivirus'))) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api('PUT', '/api/admin/flux-externes/antivirus', { body: { ouvert, confirmation: true } });
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <Title order={2} size="h4">
            Analyse antivirus des fichiers déposés
          </Title>
          {etat && (
            <Badge variant="light" color={etat.ouvert ? 'green' : 'gray'}>
              {etat.ouvert ? 'Activée' : 'Désactivée'}
            </Badge>
          )}
        </Group>
        <ErrorAlert error={erreur || q.error} />
        <Text size="sm">
          Activée, chaque fichier déposé est analysé par ClamAV (conteneur « clamav », réseau interne), dont les
          signatures se mettent à jour depuis Internet (conteneur « freshclam »). Un fichier infecté est refusé ; si
          l’antivirus ne répond pas, le dépôt est refusé (réglage CLAMAV_REQUIRED du serveur, actif par défaut).
          Désactivée, un fichier déposé est accepté et marqué « non analysé ».
        </Text>
        {etat && !etat.ouvert && (
          <Alert color="orange" role="status" title="Fichiers déposés non analysés">
            L’analyse antivirus est désactivée : l’activer ouvre le flux de mise à jour des signatures, après
            validation.
          </Alert>
        )}
        {ecriture && etat && (
          <Group>
            {etat.ouvert ? (
              <ConfirmButton
                variant="default"
                disabled={envoi}
                message="Désactiver l’analyse antivirus ? Les fichiers déposés seront acceptés sans analyse et le flux de mise à jour des signatures est refermé."
                onConfirm={() => void basculer(false)}
              >
                Désactiver l’analyse antivirus
              </ConfirmButton>
            ) : (
              <Button loading={envoi} onClick={() => void basculer(true)}>
                Activer l’analyse antivirus
              </Button>
            )}
            {flux.fenetre}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
