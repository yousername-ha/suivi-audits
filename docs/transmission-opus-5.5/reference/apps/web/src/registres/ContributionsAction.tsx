/* Commentaires et preuves d'une action (migration 036) : un collaborateur (rôle de contributeur) commente et joint une preuve
   qu'il peut lire, sans modifier l'action. Journal immuable ; chaque commande porte un identifiant de requête, renouvelé
   seulement après un succès, pour qu'un double clic ou un rejeu réseau n'enregistre rien de plus. */
import { Badge, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ContributionElementDto, GrcObject } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import type { AccesElement } from './Contribution';
import { SelecteurPreuve } from './Validation';

export function ContributionsAction({ smsi, object, acces }: { smsi: string; object: GrcObject; acces: AccesElement }) {
  const qc = useQueryClient();
  const cle = ['grc', smsi, 'contributions', object.id];
  const journal = useQuery({
    queryKey: cle,
    queryFn: () => get<{ items: ContributionElementDto[] }>(`/api/grc/${smsi}/objects/${object.id}/contributions`),
  });
  const [commentaire, setCommentaire] = useState('');
  const [preuve, setPreuve] = useState('');
  const [note, setNote] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const requete = useRef(crypto.randomUUID());
  const envoyer = async (chemin: 'commentaire' | 'preuve', body: Record<string, unknown>, message: string) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', `/api/grc/${smsi}/objects/${object.id}/contributions/${chemin}`, {
        body: { requestId: requete.current, ...body },
      });
      requete.current = crypto.randomUUID();
      setCommentaire('');
      setPreuve('');
      setNote('');
      await qc.invalidateQueries({ queryKey: cle });
      notifications.show({ color: 'teal', message });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const items = journal.data?.items ?? [];
  return (
    <Stack gap="xs" role="region" aria-label="Commentaires et preuves">
      <Text fw={600}>Commentaires et preuves</Text>
      <ErrorAlert error={erreur ?? journal.error} />
      {journal.data && !items.length && (
        <Text size="sm" c="dimmed">
          Aucun commentaire ni preuve pour l’instant.
        </Text>
      )}
      {items.map((c) => (
        <Stack key={c.id} gap="xs" role="group" aria-label={`Contribution ${c.seq}`}>
          <Group gap="xs">
            <Badge variant="light" color={c.kind === 'preuve' ? 'violet' : 'blue'}>
              {c.kind === 'preuve' ? 'Preuve' : 'Commentaire'}
            </Badge>
            <Text size="xs" c="dimmed">
              {c.createdBy} · {fmtDate(c.createdAt)}
            </Text>
          </Group>
          {c.proofRef && <Text size="sm">{c.proofName ?? `${c.proofRef} (non consultable)`}</Text>}
          {c.comment && <Text size="sm">{c.comment}</Text>}
        </Stack>
      ))}
      {acces.peut.contribuer && (
        <Stack gap="xs">
          <Textarea
            label="Commentaire"
            autosize
            minRows={2}
            maxLength={5000}
            value={commentaire}
            onChange={(e) => setCommentaire(e.currentTarget.value)}
          />
          <Group>
            <Button
              variant="default"
              loading={envoi}
              disabled={!commentaire.trim()}
              onClick={() => void envoyer('commentaire', { comment: commentaire }, 'Commentaire ajouté.')}
            >
              Ajouter le commentaire
            </Button>
          </Group>
          <SelecteurPreuve smsi={smsi} value={preuve} onChange={setPreuve} />
          <Textarea
            label="Note sur la preuve"
            description="Facultative."
            autosize
            minRows={1}
            maxLength={5000}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Group>
            <Button
              variant="default"
              loading={envoi}
              disabled={!preuve}
              onClick={() => void envoyer('preuve', { proofRef: preuve, comment: note }, 'Preuve jointe.')}
            >
              Joindre la preuve
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
