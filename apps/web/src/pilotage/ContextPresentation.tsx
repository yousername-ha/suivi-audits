import { Button, Group, Modal, Stack, Tabs, Text } from '@mantine/core';
import { GRC_LABELS, libelleRelation, PILOTAGE_FIELDS, type GrcKind, type GrcObject } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import type { Source } from './Fields';

type Revision = { version: number; reason: string; createdAt: string; createdBy: string };
type Relation = {
  id: string;
  type: string;
  note: string;
  sens?: 'sortant' | 'entrant';
  other: { ref: string; name: string; kind: string; archived?: boolean };
};

/** Présentation du contexte enregistré : aucune commande de mutation dans les onglets de consultation. */
export function ContextPresentation({
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
  history?: Revision[];
  historyLoading: boolean;
  error: unknown;
}) {
  const [fullScreen, setFullScreen] = useState(false);
  const id = useId();
  const source = object.id.startsWith('legacy:') ? object.id : 'object:' + object.id;
  const links = useQuery({
    queryKey: ['grc', object.smsiId, 'links', source],
    queryFn: () => get<Relation[]>(`/api/grc/${object.smsiId}/links?ref=${encodeURIComponent(source)}`),
    enabled: opened,
  });
  const refs = Array.isArray(object.data.refs)
    ? object.data.refs.filter((r): r is string => typeof r === 'string')
    : [];
  const description = typeof object.data.description === 'string' ? object.data.description : '';
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Périmètre et contexte"
      size="xl"
      fullScreen={fullScreen}
      classNames={{ root: 'contexte-fenetre', content: 'contexte-presentation', body: 'contexte-presentation-corps' }}
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
          <Tabs.Panel value="presentation" pt="lg">
            <article className="contexte-document" aria-labelledby={`${id}-titre`}>
              <header className="contexte-entete">
                <div className="contexte-couverture">
                  <span className="contexte-repere">Dossier de contexte</span>
                  <h3 id={`${id}-titre`}>{object.name}</h3>
                  {description.trim() && <p className="contexte-description">{description}</p>}
                </div>
                <dl className="contexte-meta">
                  <div>
                    <dt>Dernière mise à jour</dt>
                    <dd>{fmtDate(object.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{object.version}</dd>
                  </div>
                </dl>
              </header>
              <div className="contexte-sections">
                {(PILOTAGE_FIELDS.context ?? []).map((field, index) => {
                  const value = object.data[field.key];
                  const filled = typeof value === 'string' && value.trim();
                  return (
                    <section
                      key={field.key}
                      className="contexte-section"
                      data-champ={field.key}
                      aria-labelledby={`${id}-${field.key}`}
                    >
                      <h4 id={`${id}-${field.key}`}>
                        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <span>{field.label}</span>
                      </h4>
                      <p className={filled ? 'contexte-texte' : 'contexte-vide'}>{filled ? value : 'Non renseigné'}</p>
                      {field.key === 'organisation' && (
                        <>
                          <dl className="contexte-responsable">
                            <dt>Responsable</dt>
                            <dd>{ownerLabel}</dd>
                          </dl>
                          <div className="contexte-sommaire" aria-hidden="true">
                            <span>Dans ce dossier</span>
                            <ol>
                              {(PILOTAGE_FIELDS.context ?? []).slice(1).map((entry, position) => (
                                <li key={entry.key}>
                                  <span>{String(position + 2).padStart(2, '0')}</span>
                                  {entry.label}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </>
                      )}
                    </section>
                  );
                })}
              </div>
            </article>
          </Tabs.Panel>
          <Tabs.Panel value="links" pt="lg">
            <Stack>
              <Text fw={600}>Références de la fiche</Text>
              {refs.length ? (
                <ul className="contexte-references">
                  {refs.map((ref) => (
                    <li key={ref}>{sources.find((s) => s.ref === ref)?.name ?? 'Référence liée (nom indisponible)'}</li>
                  ))}
                </ul>
              ) : (
                <Text c="dimmed" size="sm">
                  Aucune référence renseignée.
                </Text>
              )}
              <Text fw={600}>Relations et justificatifs</Text>
              {links.isPending ? (
                <Text role="status">Chargement des relations…</Text>
              ) : links.data?.length ? (
                <ul className="contexte-references">
                  {links.data.map((link) => (
                    <li key={link.id}>
                      <strong>{libelleRelation(link.type, link.sens !== 'entrant')}</strong> · {link.other.name}
                      {' · '}
                      {GRC_LABELS[link.other.kind as GrcKind] ?? 'Donnée existante'}
                      {link.other.archived && ' (archivé)'}
                      {link.note && <p className="contexte-texte">{link.note}</p>}
                    </li>
                  ))}
                </ul>
              ) : !links.error ? (
                <Text c="dimmed" size="sm">
                  Aucune relation renseignée.
                </Text>
              ) : null}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="history" pt="lg">
            {object.id.startsWith('legacy:') ? (
              <Text>
                La fiche reste dans la source historique. Ses réalisations et validations sont consultables depuis le
                registre.
              </Text>
            ) : historyLoading ? (
              <Text role="status">Chargement de l’historique…</Text>
            ) : history?.length ? (
              <ol className="contexte-historique">
                {history.map((revision) => (
                  <li key={revision.version}>
                    <strong>Version {revision.version}</strong>
                    <span>
                      {fmtDate(revision.createdAt)} · {revision.createdBy}
                    </span>
                    {revision.reason && <p className="contexte-texte">{revision.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <Text c="dimmed" size="sm">
                Aucune révision disponible.
              </Text>
            )}
          </Tabs.Panel>
        </Tabs>
        <Group justify="space-between" className="fenetre-actions contexte-actions">
          <Button variant="default" onClick={() => setFullScreen((value) => !value)}>
            {fullScreen ? 'Réduire' : 'Agrandir'}
          </Button>
          <Group>
            <Button variant="default" onClick={onClose}>
              Fermer
            </Button>
            {onModify && <Button onClick={onModify}>Modifier</Button>}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
