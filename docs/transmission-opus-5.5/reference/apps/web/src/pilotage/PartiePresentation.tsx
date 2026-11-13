import { Button, Group, Modal, Stack, Tabs, Text } from '@mantine/core';
import { libelleRelation, type GrcObject } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import type { Source } from './Fields';
import { datePartie, EtatPartie, IconePartie, revuePartie, textePartie } from './PartiesInteresseesStudio';

/** Consultation sans mutation. RecordEditor conserve l'édition, les versions et les adaptateurs historiques. */
export function PartiePresentation({
  object,
  opened,
  onClose,
  onModify,
  ownerLabel,
  sources,
  history,
  historyLoading,
  error,
}: {
  object: GrcObject;
  opened: boolean;
  onClose: () => void;
  onModify?: () => void;
  ownerLabel: string;
  sources: Source[];
  history?: { version: number; reason: string; createdAt: string; createdBy: string }[];
  historyLoading: boolean;
  error: unknown;
}) {
  const id = useId(),
    source = object.id.startsWith('legacy:') ? object.id : 'object:' + object.id;
  const links = useQuery({
    queryKey: ['grc', object.smsiId, 'links', source],
    queryFn: () =>
      get<{ id: string; type: string; sens?: string; note: string; other: { name: string; archived?: boolean } }[]>(
        `/api/grc/${object.smsiId}/links?ref=${encodeURIComponent(source)}`,
      ),
    enabled: opened,
  });
  const refs = Array.isArray(object.data.refs)
    ? object.data.refs.filter((r): r is string => typeof r === 'string')
    : [];
  const panel = (key: string, label: string, icon: string) => (
    <section className="pi-detail-panel" aria-labelledby={`${id}-${key}`}>
      <h4 id={`${id}-${key}`}>
        <IconePartie name={icon} />
        {label}
      </h4>
      <p>{textePartie(object.data[key]) || 'Non renseigné'}</p>
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
        <ErrorAlert error={error ?? links.error} />
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
                {panel('expectations', 'Besoins et attentes', 'network')}
                {panel('requirements', 'Exigences pertinentes', 'check')}
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
            <Stack>
              <Text fw={600}>Références de la fiche</Text>
              {refs.length ? (
                <ul>
                  {refs.map((ref) => (
                    <li key={ref}>{sources.find((s) => s.ref === ref)?.name ?? ref}</li>
                  ))}
                </ul>
              ) : (
                <Text>Aucune référence renseignée.</Text>
              )}
              <Text fw={600}>Relations et justificatifs</Text>
              {links.isPending ? (
                <Text role="status">Chargement des relations…</Text>
              ) : links.data?.length ? (
                <ul>
                  {links.data.map((link) => (
                    <li key={link.id}>
                      <strong>{libelleRelation(link.type, link.sens !== 'entrant')}</strong> · {link.other.name}
                      {link.other.archived && ' (archivé)'}
                      {link.note && <p>{link.note}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                !links.error && <Text>Aucune relation renseignée.</Text>
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="history" pt="md">
            <Stack>
              {object.id.startsWith('legacy:') ? (
                <Text>
                  La fiche reste dans la source historique. Les réalisations et validations sont consultables depuis le
                  registre détaillé.
                </Text>
              ) : historyLoading ? (
                <Text role="status">Chargement de l’historique…</Text>
              ) : history?.length ? (
                history.map((h) => (
                  <Text key={h.version}>
                    Version {h.version} · {datePartie(h.createdAt)} · {h.createdBy} · {h.reason}
                  </Text>
                ))
              ) : (
                <Text>Aucune révision disponible.</Text>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Version {object.version} · {object.id.startsWith('legacy:') ? 'Source historique' : 'Registre du périmètre'}
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
