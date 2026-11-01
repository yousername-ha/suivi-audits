import { Button, Group, Modal, Stack, Tabs, Text } from '@mantine/core';
import { GRC_LABELS, libelleRelation, PILOTAGE_FIELDS, type GrcKind, type GrcObject } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import type { Source } from './Fields';
import { lignesInterfaces } from './liste-interfaces';

type Revision = { version: number; reason: string; createdAt: string; createdBy: string };
type Relation = {
  id: string;
  type: string;
  note: string;
  sens?: 'sortant' | 'entrant';
  other: { ref: string; name: string; kind: string; archived?: boolean };
};

const PICTOGRAMMES: Record<string, ReactNode> = {
  organisation: (
    <>
      <path d="M4 21V7l8-4 8 4v14M8 21v-5h8v5" />
      <path className="contexte-icone-fenetres" d="M8 9h1m6 0h1M8 12h1m6 0h1" />
    </>
  ),
  scope: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      <rect className="contexte-icone-cible" x="7" y="7" width="10" height="10" rx="2" />
    </>
  ),
  interfaces: (
    <>
      <circle className="contexte-icone-noeud contexte-icone-noeud--a" cx="5" cy="12" r="2.5" />
      <circle className="contexte-icone-noeud contexte-icone-noeud--b" cx="18" cy="5" r="2.5" />
      <circle className="contexte-icone-noeud contexte-icone-noeud--c" cx="18" cy="19" r="2.5" />
      <path d="M7.5 12H11V5h4.5M11 12v7h4.5" />
    </>
  ),
  issues: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path className="contexte-icone-boussole" d="m16 8-3 5-5 3 3-5z" />
    </>
  ),
  exclusions: (
    <>
      <path d="M11 4H4v16h16v-7" />
      <path className="contexte-icone-sortie" d="M14 4h6v6M20 4l-9 9" />
      <path d="M8 8v8h8" />
    </>
  ),
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
      data-cadre="biseau"
      classNames={{ root: 'contexte-fenetre', content: 'contexte-presentation', body: 'contexte-presentation-corps' }}
      closeButtonProps={{ 'aria-label': 'Fermer la présentation' }}
    >
      <Stack>
        <div className="contexte-cadre" aria-hidden="true">
          {['haut-gauche', 'haut-droite', 'bas-droite', 'bas-gauche'].map((coin) => (
            <span key={coin} className={`contexte-cadre-coin contexte-cadre-coin--${coin}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
                <path className="contexte-cadre-diagonale" d="M0 24 24 0" />
              </svg>
            </span>
          ))}
        </div>
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
                  const rawValue = object.data[field.key];
                  const value = typeof rawValue === 'string' ? rawValue : '';
                  const filled = !!value.trim();
                  return (
                    <section
                      key={field.key}
                      className="contexte-section"
                      data-champ={field.key}
                      aria-labelledby={`${id}-${field.key}`}
                    >
                      <h4 id={`${id}-${field.key}`}>
                        <span className="contexte-pictogramme" aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            focusable="false"
                          >
                            {PICTOGRAMMES[field.key]}
                          </svg>
                        </span>
                        <span className="contexte-section-titre">{field.label}</span>
                        <span className="contexte-section-numero" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </h4>
                      {['issues', 'interfaces'].includes(field.key) && filled ? (
                        <ul className="contexte-puces">
                          {(field.key === 'interfaces'
                            ? lignesInterfaces(value)
                            : value.split(/\r?\n/).filter((line) => line.trim())
                          ).map((line, lineIndex) => (
                            <li key={lineIndex}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className={filled ? 'contexte-texte' : 'contexte-vide'}>
                          {filled ? value : 'Non renseigné'}
                        </p>
                      )}
                      {field.key === 'organisation' && (
                        <>
                          <dl className="contexte-responsable">
                            <dt>Responsable</dt>
                            <dd>{ownerLabel}</dd>
                          </dl>
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
