/* Validation d'une occurrence de tâche récurrente : OK, KO ou NA avec compte rendu et référence de preuve, journal
   immuable, réouverture motivée (migration 030). Chaque commande porte un identifiant de requête : un double clic ou un
   rejeu réseau n'enregistre rien de plus. */
import { Badge, Button, Checkbox, Group, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  fenetreOccurrence,
  RESULTAT_LABELS,
  RESULTATS_VALIDATION,
  type EtatValidation,
  type GrcObject,
  type SeriesData,
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

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

/** Fenêtre de réalisation de l'occurrence, calculée par le même moteur que le serveur (qui reste seul juge). */
function EtatFenetre({ smsi, object }: { smsi: string; object: GrcObject }) {
  const serie = useQuery({
    queryKey: ['grc', smsi, 'serie', object.data.seriesId],
    queryFn: () => get<GrcObject>(`/api/grc/${smsi}/objects/${String(object.data.seriesId)}`),
  });
  const dueAt = typeof object.data.dueAt === 'string' ? object.data.dueAt : null;
  const recurrence = (serie.data?.data as Partial<SeriesData> | undefined)?.recurrence;
  if (!recurrence?.window || !dueAt) return null;
  const f = fenetreOccurrence(recurrence, dueAt);
  const texte =
    f.etat === 'a_venir'
      ? `Fenêtre de réalisation : ouvre le ${dateFr(f.ouvreLe!)}`
      : f.etat === 'fermee'
        ? `Fenêtre de réalisation : fermée depuis le ${dateFr(f.fermeLe!)}`
        : `Fenêtre de réalisation : ouverte jusqu’au ${dateFr(f.fermeLe!)}`;
  return (
    <Badge variant="light" color={f.etat === 'ouverte' ? 'teal' : 'orange'} aria-label={texte}>
      {texte}
    </Badge>
  );
}

export function ValidationOccurrence({
  smsi,
  object,
  acces,
  onOpenObject,
}: {
  smsi: string;
  object: GrcObject;
  acces: AccesElement;
  /** Ouvre une autre fiche : sert à enchaîner sur l'occurrence suivante. */
  onOpenObject?: (o: GrcObject) => void;
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
  // Enchaînement : après un succès, ouvre l'occurrence suivante éligible (préférence de la personne, jamais imposée).
  const [enchainer, setEnchainer] = useState(() => {
    try {
      return localStorage.getItem('validation-enchainer') === '1';
    } catch {
      return false;
    }
  });
  const suivante = async () => {
    setErreur(null);
    try {
      const r = await get<{ occurrence: { actionId: string } | null }>(
        `/api/grc/${smsi}/series/${String(object.data.seriesId)}/prochaine?apres=${object.id}`,
      );
      if (!r.occurrence) {
        notifications.show({ color: 'gray', message: 'Aucune autre occurrence à traiter pour le moment.' });
        return;
      }
      onOpenObject?.(await get<GrcObject>(`/api/grc/${smsi}/objects/${r.occurrence.actionId}`));
    } catch (e) {
      setErreur(e);
    }
  };
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
      if (enchainer && chemin === '' && onOpenObject) await suivante();
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
      <EtatFenetre smsi={smsi} object={object} />
      <ErrorAlert error={erreur ?? journal.error} />
      {etat === 'validee' && onOpenObject && (
        <Button variant="default" onClick={() => void suivante()}>
          Occurrence suivante
        </Button>
      )}
      {etat !== 'validee' && acces.peut.contribuer && onOpenObject && (
        <Checkbox
          label="Passer automatiquement à l’occurrence suivante après la validation"
          checked={enchainer}
          onChange={(e) => {
            setEnchainer(e.currentTarget.checked);
            try {
              localStorage.setItem('validation-enchainer', e.currentTarget.checked ? '1' : '0');
            } catch {
              /* préférence facultative */
            }
          }}
        />
      )}
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
            description="Référence résolue par le serveur, par exemple une version de document ; facultative."
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
