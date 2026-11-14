/* Petite fenêtre ouverte depuis un repère de la Timeline (refonte Neon, lot 6) : aperçu de la fiche et saisie de son
   résultat, sans quitter la Timeline. Elle n'utilise que les routes existantes :
   - occurrence d'une série : résultat OK, KO ou NA, compte rendu, preuve et réouverture motivée (ValidationOccurrence,
     journal immuable, identifiant de requête, fenêtre de réalisation et droits vérifiés par le serveur) ;
   - action hors série : l'API n'a pas de résultat OK/KO ; la fenêtre propose les commentaires et preuves de l'action
     (journal immuable) et renvoie à la fiche complète pour son avancement.
   Une décision enregistrée ne s'écrase jamais : le serveur refuse une seconde validation, seule la réouverture motivée
   la reprend, et le journal garde toutes les décisions. La définition de la fiche reste dans sa fiche complète. */
import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import type { AccesElement } from '../registres/Contribution';
import { ContributionsAction } from '../registres/ContributionsAction';
import { ValidationOccurrence } from '../registres/Validation';
import { enRetard, estOccurrence } from './etat-action';
import { EtatTache, ResultatTache } from './TimelineCommun';

/** Vues des tâches à rafraîchir après un résultat : la couleur du repère suit la dernière décision. */
const VUES_TACHES = new Set(['tasks', 'tasks-all', 'task-dashboard']);

export function ValidationRapide({
  smsi,
  object,
  policy,
  responsable,
  opened,
  onClose,
  onOpen,
}: {
  smsi: string;
  object: GrcObject;
  policy: BusinessPolicy;
  responsable: string;
  opened: boolean;
  onClose: () => void;
  /** Ouvre la fiche complète (même ouverture que la ligne). */
  onOpen: (o: GrcObject) => void;
}) {
  const qc = useQueryClient();
  const occurrence = estOccurrence(object);
  // Même requête et même clé que la fiche complète (useAccesElement) : les droits viennent du serveur.
  const acces = useQuery({
    queryKey: ['acces-element', object.id, object.version],
    queryFn: () => get<AccesElement>(`/api/registres/elements/${object.id}/acces`),
    enabled: !!object.registreId && !object.id.startsWith('legacy:'),
    retry: false,
  });
  const rafraichir = () =>
    void qc.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'grc' && q.queryKey[1] === smsi && VUES_TACHES.has(String(q.queryKey[2])),
    });
  const echeance =
    typeof object.data.dueAt === 'string' && object.data.dueAt
      ? new Date(object.data.dueAt).toLocaleDateString('fr-FR')
      : 'Sans échéance';
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="md"
      title={occurrence ? 'Résultat de réalisation' : 'Suivi de réalisation'}
      closeButtonProps={{ 'aria-label': 'Fermer la petite fenêtre de résultat' }}
      classNames={{ content: 'validation-rapide' }}
    >
      <Stack gap="sm">
        <Text fw={600} lineClamp={2} title={object.name} className="validation-rapide__titre">
          {object.name}
        </Text>
        <Group gap="xs" className="validation-rapide__etat">
          <EtatTache objet={object} policy={policy} anime={false} />
          <ResultatTache objet={object} />
          {enRetard(object, policy) && (
            <Badge variant="light" color="red">
              ! En retard
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          Échéance : {echeance} · Responsable : {responsable}
        </Text>
        <ErrorAlert error={acces.error} />
        {!object.registreId ? (
          <Text size="sm">
            Cette fiche n’est rattachée à aucun registre : son suivi se fait dans la fiche complète.
          </Text>
        ) : acces.isPending ? (
          <Text size="sm" role="status">
            Chargement des droits…
          </Text>
        ) : acces.data && occurrence ? (
          <ValidationOccurrence smsi={smsi} object={object} acces={acces.data} onEnregistre={rafraichir} />
        ) : acces.data ? (
          <>
            <Text size="sm" c="dimmed">
              Le résultat OK, KO ou NA concerne les occurrences de tâches récurrentes. L’avancement de cette action (son
              état) se renseigne dans sa fiche complète ; ses commentaires et preuves se joignent ici.
            </Text>
            {acces.data.peut.lire && <ContributionsAction smsi={smsi} object={object} acces={acces.data} />}
          </>
        ) : null}
        <Group justify="space-between" className="fenetre-actions">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="light"
            onClick={() => {
              onClose();
              onOpen(object);
            }}
          >
            Fiche complète
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
