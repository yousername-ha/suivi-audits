/* Validation d'une occurrence de tâche récurrente : OK, KO ou NA avec compte rendu et référence de preuve, journal
   immuable, réouverture motivée (migration 030). Chaque commande porte un identifiant de requête : un double clic ou un
   rejeu réseau n'enregistre rien de plus. */
import { Badge, Button, Group, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  RESULTAT_LABELS,
  RESULTATS_VALIDATION,
  type EtatValidation,
  type GrcObject,
  type ValidationDto,
} from '@suivi/shared';
import { DataTable } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import type { AccesElement } from './Contribution';

const ETAT_LABELS: Record<EtatValidation, string> = {
  ouverte: 'À valider',
  validee: 'Validée',
  rouverte: 'Rouverte, à valider',
};
const RESULTAT_OPTIONS = RESULTATS_VALIDATION.map((r) => ({ value: r, label: RESULTAT_LABELS[r] }));

export function ValidationOccurrence({
  smsi,
  object,
  acces,
}: {
  smsi: string;
  object: GrcObject;
  acces: AccesElement;
}) {
  const qc = useQueryClient();
  const cle = ['validations', object.id];
  const journal = useQuery({
    queryKey: cle,
    queryFn: () =>
      get<{ etat: EtatValidation; items: ValidationDto[] }>(`/api/grc/${smsi}/objects/${object.id}/validations`),
  });
  const [resultat, setResultat] = useState<string | null>('ok');
  const [commentaire, setCommentaire] = useState('');
  const [preuve, setPreuve] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  // Un identifiant par intention : il ne change qu'après un succès, pour qu'un rejeu ne duplique rien.
  const requete = useRef(crypto.randomUUID());
  const etat = journal.data?.etat ?? 'ouverte';
  const justifie = resultat === 'ok' || commentaire.trim().length >= 10;
  const envoyer = async (chemin: string, body: Record<string, unknown>, message: string) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', `/api/grc/${smsi}/objects/${object.id}/validations${chemin}`, { body });
      requete.current = crypto.randomUUID();
      setCommentaire('');
      setPreuve('');
      setMotif('');
      await qc.invalidateQueries({ queryKey: cle });
      notifications.show({ color: 'teal', message });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack gap="xs" role="group" aria-label="Validation de l’occurrence">
      <Group gap="xs">
        <Text fw={600}>Validation de l’occurrence</Text>
        <Badge variant="light" color={etat === 'validee' ? 'teal' : 'gray'}>
          {ETAT_LABELS[etat]}
        </Badge>
      </Group>
      <ErrorAlert error={erreur ?? journal.error} />
      {etat !== 'validee' && acces.peut.contribuer && (
        <Stack gap="xs">
          <Select
            label="Résultat"
            allowDeselect={false}
            data={RESULTAT_OPTIONS}
            value={resultat}
            onChange={setResultat}
          />
          <Textarea
            label="Compte rendu"
            description={resultat === 'ok' ? 'Facultatif.' : '10 caractères au moins pour un KO ou un NA.'}
            autosize
            minRows={2}
            value={commentaire}
            onChange={(e) => setCommentaire(e.currentTarget.value)}
          />
          <TextInput
            label="Référence de preuve"
            description="Par exemple document:<identifiant> ; facultative."
            value={preuve}
            onChange={(e) => setPreuve(e.currentTarget.value)}
          />
          <Button
            loading={envoi}
            disabled={!resultat || !justifie}
            onClick={() =>
              void envoyer(
                '',
                { requestId: requete.current, result: resultat, comment: commentaire, proofRef: preuve },
                'Validation enregistrée.',
              )
            }
          >
            Enregistrer la validation
          </Button>
        </Stack>
      )}
      {etat === 'validee' && acces.peut.gerer && (
        <Stack gap="xs">
          <Textarea
            label="Motif de la réouverture"
            description="10 caractères au moins ; inscrit au journal, la validation d’origine est conservée."
            autosize
            minRows={2}
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
          />
          <Button
            variant="default"
            loading={envoi}
            disabled={motif.trim().length < 10}
            onClick={() =>
              void envoyer('/reouverture', { requestId: requete.current, reason: motif }, 'Occurrence rouverte.')
            }
          >
            Rouvrir l’occurrence
          </Button>
        </Stack>
      )}
      {journal.data && journal.data.items.length > 0 && (
        <DataTable label="Journal de validation, défilement horizontal possible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>N°</Table.Th>
                <Table.Th>Événement</Table.Th>
                <Table.Th>Compte rendu</Table.Th>
                <Table.Th>Preuve</Table.Th>
                <Table.Th>Par</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {journal.data.items.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.seq}</Table.Td>
                  <Table.Td>{l.result ? RESULTAT_LABELS[l.result] : 'Réouverture'}</Table.Td>
                  <Table.Td>{l.comment || '—'}</Table.Td>
                  <Table.Td>{l.proofRef || '—'}</Table.Td>
                  <Table.Td>
                    {l.createdBy}, {fmtDate(l.createdAt)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}
