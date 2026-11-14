/* Consultation d'une partie intéressée (refonte Neon, lot 5, ADR 0093) : lecture distincte de la modification. Aucune
   mutation ici : RecordEditor conserve le formulaire, les versions, If-Match et les adaptateurs de l'outil historique. */
import { Button, Group, Modal, Stack, Tabs, Text } from '@mantine/core';
import type { GrcObject } from '@suivi/shared';
import { useId, type ReactNode } from 'react';
import { ErrorAlert } from '../components/common';
import { HistoriqueEnLecture, LiensEnLecture, type RevisionFiche } from './ContextPresentation';
import type { Source } from './Fields';
import { datePartie, EtatPartie, IconePartie, revuePartie, textePartie } from './PartiesInteresseesStudio';

export function PartiePresentation({
  smsi,
  object,
  opened,
  onClose,
  onModify,
  ownerLabel,
  sources,
  history,
  historyLoading,
  error,
  archivage,
}: {
  smsi: string;
  object: GrcObject;
  opened: boolean;
  onClose: () => void;
  onModify?: () => void;
  ownerLabel: string;
  sources: Source[];
  history?: RevisionFiche[];
  historyLoading: boolean;
  error: unknown;
  /** Commande d'archivage existante (droit de suppression), conservée sous la présentation. */
  archivage?: ReactNode;
}) {
  const id = useId();
  const panneau = (cle: string, libelle: string, icone: string) => (
    <section className="pi-detail-panel" aria-labelledby={`${id}-${cle}`}>
      <h4 id={`${id}-${cle}`}>
        <IconePartie name={icone} />
        {libelle}
      </h4>
      <p>{textePartie(object.data[cle]) || 'Non renseigné'}</p>
    </section>
  );
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Partie intéressée · Consultation"
      size="xl"
      classNames={{ content: 'partie-presentation', body: 'pi-presentation-body' }}
      closeButtonProps={{ 'aria-label': 'Fermer la présentation' }}
    >
      <Stack>
        <ErrorAlert error={error} />
        <Tabs defaultValue="presentation" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="presentation">Présentation</Tabs.Tab>
            <Tabs.Tab value="links">Liens et justificatifs</Tabs.Tab>
            <Tabs.Tab value="history">Historique</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="presentation" pt="md">
            <article aria-labelledby={`${id}-titre`}>
              <header className="pi-document-heading">
                <div>
                  <h3 id={`${id}-titre`}>{object.name}</h3>
                  <p>
                    {textePartie(object.data.nature) || 'Nature à préciser'} ·{' '}
                    {textePartie(object.data.category) || 'Catégorie non renseignée'}
                  </p>
                </div>
                <EtatPartie object={object} />
              </header>
              {!!textePartie(object.data.description) && (
                <p className="pi-description">{textePartie(object.data.description)}</p>
              )}
              <div className="pi-detail-grid">
                {panneau('expectations', 'Besoins et attentes', 'network')}
                {panneau('requirements', 'Exigences pertinentes', 'check')}
                <section className="pi-detail-panel" aria-labelledby={`${id}-treatment`}>
                  <h4 id={`${id}-treatment`}>
                    <IconePartie name="list" />
                    Prise en compte
                  </h4>
                  <EtatPartie object={object} />
                  <p>{textePartie(object.data.treatment) || 'Traitement non renseigné'}</p>
                </section>
                <section className="pi-detail-panel" data-review="true" aria-labelledby={`${id}-review`}>
                  <h4 id={`${id}-review`}>
                    <IconePartie name="calendar" />
                    Suivi et responsabilité
                  </h4>
                  <dl>
                    <div>
                      <dt>Responsable</dt>
                      <dd>{ownerLabel}</dd>
                    </div>
                    <div>
                      <dt>Dernière revue</dt>
                      <dd>{datePartie(object.data.reviewedAt)}</dd>
                    </div>
                    <div>
                      <dt>Contact</dt>
                      <dd>{textePartie(object.data.contact) || 'Non renseigné'}</dd>
                    </div>
                  </dl>
                  {revuePartie(object) && (
                    <Text size="sm" mt="sm">
                      À vérifier : date absente ou de plus de 365 jours.
                    </Text>
                  )}
                </section>
              </div>
            </article>
          </Tabs.Panel>
          <Tabs.Panel value="links" pt="md">
            <LiensEnLecture smsi={smsi} object={object} opened={opened} sources={sources} />
          </Tabs.Panel>
          <Tabs.Panel value="history" pt="md">
            <HistoriqueEnLecture object={object} history={history} historyLoading={historyLoading} />
          </Tabs.Panel>
        </Tabs>
        {archivage}
        <Group justify="space-between" className="fenetre-actions">
          <Text size="xs" c="dimmed">
            Version {object.version} · {object.id.startsWith('legacy:') ? 'Source historique' : 'Registre du périmètre'}
            {!onModify && ' · Consultation seule'}
          </Text>
          <Group>
            <Button variant="default" onClick={onClose}>
              Fermer
            </Button>
            {onModify && <Button onClick={onModify}>Modifier la fiche</Button>}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
