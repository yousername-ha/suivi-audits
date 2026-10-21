/* Action issue d'un traitement de risque (dossier 002) : le nom et l'échéance se saisissent, le plan d'actions d'accueil se
   choisit parmi ceux que l'on gère pour ce périmètre (à défaut, le plan par défaut). Le risque résiduel reste inchangé :
   l'action est liée au traitement, elle ne recalcule aucune décision. */
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { GrcObject } from '@suivi/shared';
import { api } from '../api';
import { ErrorAlert } from '../components/common';
import { SelecteurRegistre } from '../registres/SelecteurRegistre';

export function ActionDeTraitement({
  smsi,
  traitement,
  opened,
  onClose,
  onCree,
}: {
  smsi: string;
  traitement: GrcObject;
  opened: boolean;
  onClose: () => void;
  onCree: (action: GrcObject) => void;
}) {
  const qc = useQueryClient();
  const [nom, setNom] = useState('Mettre en œuvre : ' + traitement.name),
    [echeance, setEcheance] = useState(''),
    [registre, setRegistre] = useState<string | null>(null),
    [envoi, setEnvoi] = useState(false),
    [erreur, setErreur] = useState<unknown>(null);
  const creer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const action = await api<GrcObject>('POST', `/api/grc/${smsi}/treatments/${traitement.id}/action`, {
        body: {
          name: nom.trim(),
          dueAt: echeance ? new Date(`${echeance}T12:00:00Z`).toISOString() : null,
          ownerId: traitement.data.ownerId ?? null,
          registreId: registre,
        },
      });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      onCree(action);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal centered opened={opened} onClose={onClose} title="Générer une action de traitement">
      <Stack>
        <Text size="sm">
          L’action est liée à « {traitement.name} ». Le risque résiduel et les décisions déjà prises ne changent pas.
        </Text>
        <ErrorAlert error={erreur} />
        <TextInput
          label="Nom de l’action"
          required
          maxLength={200}
          value={nom}
          onChange={(e) => setNom(e.currentTarget.value)}
        />
        <TextInput
          label="Échéance (facultative)"
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.currentTarget.value)}
        />
        <SelecteurRegistre smsi={smsi} kind="action" data={{}} object={null} value={registre} onChange={setRegistre} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={envoi} disabled={!nom.trim()} onClick={() => void creer()}>
            Générer l’action
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
