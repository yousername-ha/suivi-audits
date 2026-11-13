import { Button, Group, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import type { GrcObject } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { type AccesElement } from '../registres/Contribution';
import { SelecteurPreuve, ValidationOccurrence } from '../registres/Validation';
import { useCan } from '../session';

/** Commande de réalisation depuis le repère de la Timeline ; la définition de la tâche reste dans sa fiche. */
export function ValidationRapide({
  object,
  opened,
  onClose,
  onOpen,
}: {
  object: GrcObject;
  opened: boolean;
  onClose: () => void;
  onOpen: (object: GrcObject) => void;
}) {
  const historique = object.id.startsWith('legacy:');
  const acces = useQuery({
    queryKey: ['acces-element', object.id, object.version],
    queryFn: () => get<AccesElement>(`/api/registres/elements/${object.id}/acces`),
    enabled: !historique,
    retry: false,
  });
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="md"
      title="Résultat de réalisation"
      closeButtonProps={{ 'aria-label': 'Fermer le résultat de réalisation' }}
    >
      <Stack gap="sm">
        <Text fw={600} lineClamp={2} title={object.name}>
          {object.name}
        </Text>
        <ErrorAlert error={acces.error} />
        {historique ? (
          <ValidationHistorique object={object} onEnregistre={onClose} />
        ) : acces.data ? (
          <ValidationOccurrence
            smsi={object.smsiId}
            object={object}
            acces={acces.data}
            compact
            onEnregistre={onClose}
          />
        ) : acces.isPending ? (
          <Text role="status">Chargement des droits…</Text>
        ) : null}
        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              onClose();
              onOpen(object);
            }}
          >
            Fiche complète ↗
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ValidationHistorique({ object, onEnregistre }: { object: GrcObject; onEnregistre: () => void }) {
  const can = useCan(),
    qc = useQueryClient();
  const [resultat, setResultat] = useState<string | null>('ok');
  const [commentaire, setCommentaire] = useState('');
  const [preuve, setPreuve] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }));
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', '/api/grc/legacy-tasks/complete', {
        ifMatch: object.version,
        body: {
          ref: object.id,
          sourceSha: object.data.sourceSha,
          date,
          comment: commentaire,
          proof: preuve,
          result: resultat,
          confirm: 'REALISER',
        },
      });
      await qc.invalidateQueries({ queryKey: ['grc', object.smsiId] });
      onEnregistre();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  if (!can('pilotage', 'modifier')) return <Text>Cette tâche est consultable en lecture seule.</Text>;
  return (
    <Stack gap="xs">
      <ErrorAlert error={erreur} />
      <Select
        label="Résultat"
        allowDeselect={false}
        data={[
          { value: 'ok', label: 'OK' },
          { value: 'ko', label: 'KO' },
        ]}
        value={resultat}
        onChange={setResultat}
      />
      <TextInput
        label="Date de réalisation"
        type="date"
        value={date}
        onChange={(e) => setDate(e.currentTarget.value)}
      />
      <Textarea
        label="Commentaire"
        description="10 caractères au moins, conservés dans l’historique."
        autosize
        minRows={2}
        maxLength={5000}
        value={commentaire}
        onChange={(e) => setCommentaire(e.currentTarget.value)}
      />
      <SelecteurPreuve smsi={object.smsiId} value={preuve} onChange={setPreuve} />
      <Button
        loading={envoi}
        disabled={!resultat || !date || commentaire.trim().length < 10}
        onClick={() => void envoyer()}
      >
        Enregistrer le résultat
      </Button>
    </Stack>
  );
}
