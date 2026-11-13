import { Button, Group, Modal, Text } from '@mantine/core';
import {
  LIBELLES_RATTACHEMENT,
  NATURES_RATTACHEMENT,
  type CarteProcessus,
  type NatureRattachement,
  type ProcessusCartes,
} from '@suivi/shared';
import { useState } from 'react';
import { Link } from 'react-router';

/** Consultation : aucune commande de mutation ni champ modifiable dans cette fenêtre. */
export function ProcessusPresentation({
  carte,
  donnees,
  onClose,
  onModify,
}: {
  carte: CarteProcessus;
  donnees: ProcessusCartes;
  onClose: () => void;
  onModify?: () => void;
}) {
  const [nature, setNature] = useState<NatureRattachement>('objectifs');
  const type = donnees.types.find((t) => t.code === carte.family);
  const parent = donnees.processus.find((p) => p.id === carte.parent);
  const kids = donnees.processus.filter((p) => p.parent === carte.id);
  const inaccessible = (n: NatureRattachement) => carte.rattaches[n] === null || donnees.candidats[n] === null;
  const liste = inaccessible(nature) ? null : carte.rattaches[nature];
  return (
    <Modal
      opened
      onClose={onClose}
      size="xl"
      title="Processus · Consultation"
      classNames={{ content: 'processus-studio pr-presentation' }}
      closeButtonProps={{ 'aria-label': 'Fermer la présentation' }}
    >
      <header className="pr-detail-head">
        <div>
          <span className="pr-kicker">Fiche processus · {carte.id}</span>
          <h3>{carte.name}</h3>
          <p>
            {type?.label || carte.family || 'Sans type'}
            {type?.archived && ' · type archivé'}
          </p>
        </div>
      </header>
      <div className="pr-detail-body">
        <section className="pr-detail-identity" aria-label="Identité et finalité">
          <h4>Finalité du processus</h4>
          <p>{carte.purpose || 'Finalité non renseignée'}</p>
          <dl>
            <div>
              <dt>Pilote</dt>
              <dd>{carte.owner || 'Non renseigné'}</dd>
            </div>
            <div>
              <dt>Rattachement hiérarchique</dt>
              <dd>{parent?.name || carte.parent || 'Processus de premier niveau'}</dd>
            </div>
            <div>
              <dt>Sous-processus</dt>
              <dd>{kids.length ? kids.map((k) => k.name).join(' · ') : 'Aucun enregistré'}</dd>
            </div>
          </dl>
        </section>
        <section className="pr-detail-relations" aria-label="Éléments rattachés">
          <h4>Éléments rattachés</h4>
          <div className="pr-relation-tabs" role="group" aria-label="Nature des rattachements">
            {NATURES_RATTACHEMENT.map((n) => (
              <button type="button" key={n} aria-pressed={n === nature} onClick={() => setNature(n)}>
                {LIBELLES_RATTACHEMENT[n]} {inaccessible(n) ? '—' : (carte.rattaches[n]?.length ?? 0)}
              </button>
            ))}
          </div>
          {liste === null ? (
            <p className="pr-rel-empty">Accès à cette catégorie non disponible.</p>
          ) : liste.length ? (
            liste.map((r) => (
              <article className="pr-related" key={r.ref}>
                <strong>{r.name}</strong>
                <small>
                  {r.id} ·{' '}
                  {r.via === 'objectif'
                    ? 'Depuis un objectif'
                    : r.via === 'fiche'
                      ? 'Depuis la fiche d’origine'
                      : 'Lien transverse'}
                  {r.via !== 'lien' && ' · gestion dans sa source'}
                </small>
              </article>
            ))
          ) : (
            <p className="pr-rel-empty">Aucun élément rattaché dans cette catégorie.</p>
          )}
        </section>
      </div>
      <footer className="pr-detail-footer">
        <Button component={Link} to="/pilotage/processus" variant="subtle">
          Objectifs par processus
        </Button>
        <Group>
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          {onModify && <Button onClick={onModify}>Modifier le processus</Button>}
        </Group>
      </footer>
      <Text size="xs" c="dimmed" mt="sm">
        Les rattachements restent dans leurs fiches d’origine.
      </Text>
    </Modal>
  );
}
