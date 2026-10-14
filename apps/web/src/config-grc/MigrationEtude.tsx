/* Migration explicite d'une étude vers les versions récentes de sa configuration (ADR 0038) : l'étude épingle des
   versions précises ; une version plus récente du catalogue n'est jamais appliquée seule. Aperçu d'impact, motif et
   confirmation obligatoires ; les évaluations déjà saisies ne sont pas réécrites. */
import { Alert, Button, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { GrcObject } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';

interface Apercu {
  version: number;
  upToDate: boolean;
  previewId: string;
  pins: {
    slot: 'relevanceMatrix' | 'severityMapping';
    key: string;
    from: number;
    to: number;
    changed: boolean;
    archived: boolean;
    resultsChanged: number;
    orphans: Record<string, string[]>;
    evaluations: number;
  }[];
}
const SLOT = { relevanceMatrix: 'Matrice de pertinence', severityMapping: 'Correspondance impact → gravité' } as const;
const CHAMPS: Record<string, string> = {
  resourcesLevel: 'ressources',
  motivationLevel: 'motivation',
  relevanceLevel: 'pertinence retenue',
  impactLevels: 'impacts',
  severityLevel: 'gravité retenue',
};

export function MigrationEtude({
  smsi,
  study,
  readonly,
  onDone,
}: {
  smsi: string;
  study: GrcObject;
  readonly: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['grc', smsi, 'etude-migration', study.id, study.version],
    queryFn: () => get<Apercu>(`/api/grc/${smsi}/studies/${study.id}/configuration-migration`),
  });
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [occupe, setOccupe] = useState(false);
  const apercu = q.data;
  if (!apercu || apercu.pins.length === 0 || apercu.upToDate) return <ErrorAlert error={q.error} />;
  const migrer = async () => {
    setOccupe(true);
    setErreur(null);
    try {
      await api('POST', `/api/grc/${smsi}/studies/${study.id}/configuration-migration`, {
        ifMatch: apercu.version,
        body: { previewId: apercu.previewId, reason: motif.trim(), confirm: 'MIGRER' },
      });
      notifications.show({ color: 'teal', message: 'Étude migrée vers les versions récentes de sa configuration.' });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      setOuvert(false);
      onDone();
    } catch (e) {
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  };
  return (
    <Stack>
      <Alert color="blue" title="Des versions plus récentes de la configuration existent">
        <Stack gap="xs">
          {apercu.pins
            .filter((p) => p.changed)
            .map((p) => (
              <Text key={p.slot} size="sm">
                {SLOT[p.slot]} « {p.key} » : version {p.from} → version {p.to} ({p.resultsChanged} résultat
                {p.resultsChanged > 1 ? 's' : ''} modifié{p.resultsChanged > 1 ? 's' : ''}, {p.evaluations} fiche
                {p.evaluations > 1 ? 's' : ''} concernée{p.evaluations > 1 ? 's' : ''}).
                {Object.keys(p.orphans).length > 0 &&
                  ` Niveaux choisis qui n’existent plus : ${Object.entries(p.orphans)
                    .map(([k, v]) => `${CHAMPS[k] ?? k} (${v.join(', ')})`)
                    .join(' ; ')}.`}
                {p.archived && ' Cet élément est archivé : la migration sera refusée.'}
              </Text>
            ))}
          <Text size="sm">
            L’étude reste sur ses versions actuelles tant que vous ne migrez pas ; aucune évaluation déjà saisie n’est
            modifiée.
          </Text>
          {!readonly && (
            <Group>
              <Button variant="default" onClick={() => setOuvert(true)}>
                Migrer l’étude…
              </Button>
            </Group>
          )}
        </Stack>
      </Alert>
      <Modal opened={ouvert} onClose={() => setOuvert(false)} title="Migrer l’étude" centered lockScroll={false}>
        <Stack>
          <Textarea
            label="Motif de la migration"
            description="Obligatoire (10 caractères au moins) ; conservé dans l’historique de l’étude."
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <TextInput
            label="Pour confirmer, saisissez MIGRER"
            value={confirmation}
            onChange={(e) => setConfirmation(e.currentTarget.value)}
          />
          <ErrorAlert error={erreur} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button
              loading={occupe}
              disabled={motif.trim().length < 10 || confirmation !== 'MIGRER'}
              onClick={() => void migrer()}
            >
              Migrer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
