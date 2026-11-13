/** Présentation uniquement : les requêtes et mutations restent dans CartesProcessus/FicheCarteProcessus. */
import { Button, Popover, Select, TextInput } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { retenirFocusFiche } from '@suivi/ui';
import {
  LIBELLES_RATTACHEMENT,
  NATURES_RATTACHEMENT,
  type CarteProcessus,
  type NatureRattachement,
  type ProcessusCartes,
} from '@suivi/shared';
import { useId, useState } from 'react';
import { ficheCliquable } from '../fiche-cliquable';
import {
  filtrerProcessus,
  regrouperProcessus,
  SANS_TYPE_PROCESSUS,
  type FiltresProcessus,
} from './processus-presentation';
import { ProcessusIcone as Icon } from './ProcessusIcone';

export function CompteursProcessus({
  carte,
  indisponibles,
}: {
  carte: CarteProcessus;
  indisponibles: NatureRattachement[];
}) {
  return (
    <span className="pr-counts">
      {NATURES_RATTACHEMENT.map((n) => {
        const inaccessible = carte.rattaches[n] === null || indisponibles.includes(n);
        const count = inaccessible ? null : (carte.rattaches[n]?.length ?? 0);
        return (
          <span
            key={n}
            data-filled={!!count}
            title={inaccessible ? `${LIBELLES_RATTACHEMENT[n]} : accès non disponible` : undefined}
          >
            {LIBELLES_RATTACHEMENT[n]} <b>{count === null ? '—' : count}</b>
          </span>
        );
      })}
    </span>
  );
}

export function ProcessusStudio({
  donnees,
  scopeName,
  modifiable,
  onOpen,
  onCreate,
}: {
  donnees: ProcessusCartes;
  scopeName: string;
  modifiable: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const id = useId();
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [filtres, setFiltres] = useState<FiltresProcessus>({ recherche: '', type: '', pilote: '', rattachement: '' });
  const [deplies, setDeplies] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState(false),
    reduced = useReducedMotion();
  const moving = !paused && !reduced;
  const indisponibles = NATURES_RATTACHEMENT.filter((n) => donnees.candidats[n] === null);
  const visibles = filtrerProcessus(donnees.processus, donnees.types, filtres, indisponibles);
  const groupes = regrouperProcessus(visibles, donnees.types);
  const typeDe = (p: CarteProcessus) => donnees.types.find((t) => t.code === p.family);
  const typeLabel = (p: CarteProcessus) => typeDe(p)?.label || p.family || 'Sans type';
  const enfantsDe = (p: CarteProcessus) => visibles.filter((x) => x.parent === p.id);
  const champs = (key: keyof FiltresProcessus, value: string) => setFiltres((old) => ({ ...old, [key]: value }));
  const reset = () => setFiltres({ recherche: '', type: '', pilote: '', rattachement: '' });
  const filtresActifs = Object.values(filtres).filter(Boolean).length;
  const tousTypes = [
    ...new Set([...donnees.types.map((t) => t.code), ...donnees.processus.map((p) => p.family).filter(Boolean)]),
  ];
  const optionsTypes = tousTypes.map((code) => {
    const t = donnees.types.find((t) => t.code === code);
    return { value: code, label: t ? t.label + (t.archived ? ' (archivé)' : '') : code };
  });
  const chips: { key: keyof FiltresProcessus; label: string }[] = [
    { key: 'recherche', label: 'Recherche : ' + filtres.recherche },
    {
      key: 'type',
      label:
        filtres.type === SANS_TYPE_PROCESSUS
          ? 'Sans type'
          : (optionsTypes.find((t) => t.value === filtres.type)?.label ?? filtres.type),
    },
    { key: 'pilote', label: 'Pilote : ' + filtres.pilote },
    { key: 'rattachement', label: filtres.rattachement ? LIBELLES_RATTACHEMENT[filtres.rattachement] : '' },
  ].filter((chip) => !!filtres[chip.key as keyof FiltresProcessus]) as { key: keyof FiltresProcessus; label: string }[];
  const sousProcessus = (p: CarteProcessus, visited = new Set<string>()) => {
    if (visited.has(p.id)) return null;
    const seen = new Set([...visited, p.id]),
      kids = enfantsDe(p).filter((k) => !seen.has(k.id));
    return kids.length ? (
      <ul className="pr-children">
        {kids.map((k) => (
          <li key={k.id}>
            <button
              type="button"
              className="pr-child"
              id={`processus-open-${k.id}`}
              {...ficheCliquable(() => onOpen(k.id), `Afficher ${k.name}`)}
            >
              <span>{k.id}</span>
              {k.name}
            </button>
            {sousProcessus(k, seen)}
          </li>
        ))}
      </ul>
    ) : null;
  };
  const carte = (p: CarteProcessus) => {
    const expanded = !!deplies[p.id],
      kids = donnees.processus.filter((x) => x.parent === p.id);
    return (
      <article key={p.id} className="pr-card" data-id={p.id}>
        <button
          type="button"
          className="pr-card-open"
          id={`processus-open-${p.id}`}
          {...ficheCliquable(() => onOpen(p.id), `Afficher ${p.name}`)}
        >
          <span className="pr-card-header">
            <span className="pr-card-glyph">
              <Icon name="cycle" />
            </span>
            <span className="pr-code">{p.id}</span>
            <span>{kids.length ? `${kids.length} sous-processus` : p.parent ? 'Sous-processus' : 'Processus'}</span>
          </span>
          <strong>{p.name}</strong>
          <span className="pr-pilot">
            <Icon name="user" />
            {p.owner || 'Pilote non renseigné'}
          </span>
          <CompteursProcessus carte={p} indisponibles={indisponibles} />
        </button>
        {expanded && (
          <div className="pr-inline" id={`${id}-inline-${p.id}`}>
            <p>{p.purpose || 'Finalité non renseignée'}</p>
            {p.parent && <small>Parent : {donnees.processus.find((x) => x.id === p.parent)?.name ?? p.parent}</small>}
            {kids.length ? sousProcessus(p) : <small>Aucun sous-processus enregistré.</small>}
          </div>
        )}
        <div className="pr-card-foot">
          <button
            type="button"
            className="pr-expand"
            aria-expanded={expanded}
            aria-controls={expanded ? `${id}-inline-${p.id}` : undefined}
            aria-label={`${expanded ? 'Replier' : 'Déplier'} ${p.name}`}
            onClick={() => setDeplies((old) => ({ ...old, [p.id]: !old[p.id] }))}
          >
            {expanded ? '−' : '+'}
          </button>
        </div>
      </article>
    );
  };
  return (
    <section
      className="processus-studio pr-module"
      data-motion={moving ? 'on' : 'off'}
      aria-label="Processus du périmètre"
    >
      <header className="pr-overview">
        <div className="pr-overview-identity">
          <span className="pr-scope-icon">
            <Icon name="tree" />
          </span>
          <div>
            <span className="pr-kicker">Périmètre affiché</span>
            <strong>{scopeName}</strong>
          </div>
        </div>
        <div className="pr-summary">
          <span>
            <b>{donnees.processus.length}</b> processus
          </span>
          <span>
            <b>{new Set(donnees.processus.map((p) => p.family).filter(Boolean)).size}</b> types utilisés
          </span>
          <span>
            <b>{donnees.processus.filter((p) => p.owner).length}</b> pilotes renseignés
          </span>
        </div>
        <span className="pr-overview-orbit" aria-hidden="true" />
      </header>
      <div className="pr-workspace">
        <div className="pr-toolbar">
          <div className="pr-view-cluster">
            <div className="pr-views" role="group" aria-label="Vues des processus">
              {(['cards', 'list'] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  className="pr-tool"
                  aria-label={v === 'cards' ? 'Vue cartes' : 'Vue liste compacte'}
                  title={v === 'cards' ? 'Cartes' : 'Liste compacte'}
                  aria-pressed={v === view}
                  onClick={() => setView(v)}
                >
                  <Icon name={v === 'cards' ? 'grid' : 'list'} />
                </button>
              ))}
            </div>
            <span className="pr-view-label">{view === 'cards' ? 'Vue par type' : 'Liste compacte'}</span>
          </div>
          <div className="pr-toolbar-end">
            <Popover position="bottom-end" trapFocus returnFocus>
              <Popover.Target>
                <button type="button" className="pr-tool" aria-label="Rechercher un processus" title="Rechercher">
                  <Icon name="search" />
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <TextInput
                  label="Rechercher un processus"
                  placeholder="Nom, code, pilote, finalité…"
                  value={filtres.recherche}
                  onChange={(e) => champs('recherche', e.currentTarget.value)}
                />
              </Popover.Dropdown>
            </Popover>
            <Popover position="bottom-end" trapFocus returnFocus>
              <Popover.Target>
                <button
                  type="button"
                  className="pr-tool"
                  aria-label={filtresActifs ? `Filtres, ${filtresActifs} actifs` : 'Filtres'}
                  title="Filtres"
                >
                  <Icon name="filter" />
                  {!!filtresActifs && <b>{filtresActifs}</b>}
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="pr-filter-fields">
                  <Select
                    label="Type de processus"
                    data={[
                      { value: '', label: 'Tous les types' },
                      ...optionsTypes,
                      { value: SANS_TYPE_PROCESSUS, label: 'Sans type' },
                    ]}
                    value={filtres.type}
                    onChange={(v) => champs('type', v ?? '')}
                    allowDeselect={false}
                  />
                  <Select
                    label="Pilote"
                    data={[
                      { value: '', label: 'Tous les pilotes' },
                      ...[...new Set(donnees.processus.map((p) => p.owner).filter(Boolean))]
                        .sort()
                        .map((value) => ({ value, label: value })),
                    ]}
                    value={filtres.pilote}
                    onChange={(v) => champs('pilote', v ?? '')}
                    allowDeselect={false}
                  />
                  <Select
                    label="Rattachement présent"
                    data={[
                      { value: '', label: 'Tous' },
                      ...NATURES_RATTACHEMENT.filter((n) => !indisponibles.includes(n)).map((value) => ({
                        value,
                        label: LIBELLES_RATTACHEMENT[value],
                      })),
                    ]}
                    value={filtres.rattachement}
                    onChange={(v) => champs('rattachement', v ?? '')}
                    allowDeselect={false}
                  />
                  <Button variant="subtle" onClick={reset}>
                    Réinitialiser
                  </Button>
                </div>
              </Popover.Dropdown>
            </Popover>
            <button
              type="button"
              className="pr-tool"
              disabled={!!reduced}
              aria-label={moving ? 'Pause animations' : 'Reprendre les animations'}
              title={
                reduced
                  ? 'Mouvement réduit activé sur cet appareil'
                  : moving
                    ? 'Pause animations'
                    : 'Reprendre les animations'
              }
              onClick={() => setPaused((v) => !v)}
            >
              <Icon name={moving ? 'pause' : 'play'} />
            </button>
            {modifiable && (
              <Button
                onClick={(e) => {
                  retenirFocusFiche(e.currentTarget);
                  onCreate();
                }}
              >
                + Nouveau processus
              </Button>
            )}
          </div>
        </div>
        {!!filtresActifs && (
          <div className="pr-chips">
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.key}
                aria-label={`Retirer ${chip.label}`}
                onClick={() => champs(chip.key, '')}
              >
                {chip.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" onClick={reset}>
              Tout effacer
            </button>
          </div>
        )}
        <div className="pr-content" role="region" tabIndex={0} aria-label="Processus affichés">
          {!visibles.length ? (
            <div className="pr-empty">
              <h2>{filtresActifs ? 'Aucun processus dans cette vue' : 'Aucun processus pour l’instant'}</h2>
              <p>
                {filtresActifs
                  ? 'Adaptez les critères pour retrouver les activités du périmètre.'
                  : 'Créez le premier, ou dessinez-le depuis la cartographie.'}
              </p>
              {!!filtresActifs && (
                <Button variant="default" onClick={reset}>
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : view === 'cards' ? (
            <div className="pr-board">
              {groupes.map((g, groupIndex) => (
                <section
                  className="pr-lane"
                  data-tone={g.type?.tint ?? 'bleu'}
                  key={g.code}
                  aria-labelledby={`${id}-type-${groupIndex}`}
                >
                  <header className="pr-lane-header">
                    <Icon name="tree" />
                    <h2 id={`${id}-type-${groupIndex}`}>
                      {g.type?.label || g.code || 'Sans type'}
                      {g.type?.archived && ' · archivé'}
                    </h2>
                    <span>{g.racines.length}</span>
                  </header>
                  <p className="pr-lane-description">{g.type?.description || 'Processus de ce type'}</p>
                  <div className="pr-cards">{g.racines.map(carte)}</div>
                </section>
              ))}
            </div>
          ) : (
            <div className="pr-list">
              <div className="pr-list-head" aria-hidden="true">
                <span>Processus</span>
                <span>Type</span>
                <span>Pilote</span>
                <span>Rattachements</span>
                <span />
              </div>
              {visibles.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="pr-row"
                  data-id={p.id}
                  data-tone={typeDe(p)?.tint ?? 'bleu'}
                  id={`processus-open-${p.id}`}
                  {...ficheCliquable(() => onOpen(p.id), `Afficher ${p.name}`)}
                >
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.id}
                      {p.parent && ' · sous-processus'}
                    </small>
                  </span>
                  <span>{typeLabel(p)}</span>
                  <span>{p.owner || 'Non renseigné'}</span>
                  <CompteursProcessus carte={p} indisponibles={indisponibles} />
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <footer className="pr-footer">
          <span role="status">
            {visibles.length} processus affiché{visibles.length > 1 ? 's' : ''} sur {donnees.processus.length}
          </span>
          <span>Les rattachements restent dans leurs fiches d’origine.</span>
        </footer>
      </div>
    </section>
  );
}
