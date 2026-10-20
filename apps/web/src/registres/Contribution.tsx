/* Accès effectif à un élément d'un registre (lecture, contribution, gestion) et panneau de contribution : un contributeur
   renseigne l'avancement (statut et compte rendu) sans modifier la définition de l'élément (ADR 0043). */
import { Alert, Button, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ROLE_LABELS, type BusinessPolicy, type GrcObject, type RoleRessource } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { Droits } from './Droits';

export interface AccesElement {
  registreId: string;
  role: RoleRessource | null;
  peut: { lire: boolean; contribuer: boolean; gerer: boolean };
}

/** Accès de la personne à l'élément ; indéfini tant qu'il n'est pas connu ou pour un élément hors registre. */
export function useAccesElement(object: GrcObject | null | undefined) {
  const eligible = !!object && !!object.registreId && !object.id.startsWith('legacy:');
  return useQuery({
    queryKey: ['acces-element', object?.id, object?.version],
    queryFn: () => get<AccesElement>(`/api/registres/elements/${object!.id}/acces`),
    enabled: eligible,
    retry: false,
  }).data;
}

/** Contribution à une action : statut (selon le workflow du périmètre) et compte rendu, rien d'autre. */
function Contribuer({ smsi, object, policy }: { smsi: string; object: GrcObject; policy: BusinessPolicy }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>(
    typeof object.data.status === 'string' ? object.data.status : null,
  );
  const [justification, setJustification] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async () => {
    if (!status) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', `/api/grc/${smsi}/objects/${object.id}/contribution`, {
        body: { status, ...(justification.trim() ? { justification } : {}) },
        ifMatch: object.version,
      });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      await qc.invalidateQueries({ queryKey: ['acces-element'] });
      setJustification('');
      notifications.show({ color: 'teal', message: 'Avancement enregistré.' });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack gap="xs" role="group" aria-label="Contribuer à l’avancement">
      <Text fw={600}>Contribuer à l’avancement</Text>
      <Text size="sm">
        Vous renseignez l’avancement de cette action ; sa définition (titre, échéance, responsable…) reste inchangée.
      </Text>
      <ErrorAlert error={erreur} />
      <Select
        label="Statut"
        allowDeselect={false}
        data={policy.statuses.map((s) => ({ value: s.id, label: s.label }))}
        value={status}
        onChange={setStatus}
      />
      <Textarea
        label="Compte rendu"
        autosize
        minRows={2}
        value={justification}
        onChange={(e) => setJustification(e.currentTarget.value)}
      />
      <Button loading={envoi} disabled={!status} onClick={() => void envoyer()}>
        Enregistrer l’avancement
      </Button>
    </Stack>
  );
}

/** Panneau de l'élément : contribution pour qui peut contribuer, droits attribués pour qui gère. */
export function PanneauElement({
  smsi,
  object,
  policy,
  acces,
}: {
  smsi: string;
  object: GrcObject;
  policy: BusinessPolicy;
  acces: AccesElement;
}) {
  return (
    <Stack gap="sm">
      {acces.role && (
        <Alert>
          Votre rôle sur cet élément : <strong>{ROLE_LABELS[acces.role]}</strong>.
        </Alert>
      )}
      {object.kind === 'action' && acces.peut.contribuer && !acces.peut.gerer && (
        <Contribuer smsi={smsi} object={object} policy={policy} />
      )}
      {acces.peut.gerer && (
        <Stack gap="xs">
          <Text fw={600}>Droits sur cet élément</Text>
          <Droits type="objet" id={object.id} />
        </Stack>
      )}
    </Stack>
  );
}
