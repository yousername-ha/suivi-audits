/* Processus Studio (refonte Neon, lot 5, ADR 0093) : cartes regroupées par type du registre, pilotes et cinq catégories
   de rattachements ; liste compacte et critères par icônes. Présentation uniquement : la requête reste dans
   CartesProcessus et les écritures dans FicheCarteProcessus. Le corps d'une carte ouvre la consultation (clic, Entrée,
   Espace) ; le bouton centré déplie la finalité et les sous-processus. Les résultats défilent dans leur propre zone. */
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
import { ProcessusIcone as Icone } from './ProcessusIcone';

/** Compteurs d'une carte : une catégorie inaccessible (« — ») se distingue d'une catégorie vide (0). */
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
        const nombre = inaccessible ? null : (carte.rattaches[n]?.length ?? 0);
        return (
          <span
            key={n}
            data-filled={!!nombre}
            title={inaccessible ? `${LIBELLES_RATTACHEMENT[n]} : accès non disponible` : undefined}
          >
            {LIBELLES_RATTACHEMENT[n]} <b>{nombre === null ? '—' : nombre}</b>
          </span>
        );
      })}
    </span>
  );
}

const FILTRES_VIDES: FiltresProcessus = { recherche: '', type: '', pilote: '', rattachement: '' };

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
  const [vue, setVue] = useState<'cartes' | 'liste'>('cartes');
  const [filtres, setFiltres] = useState<FiltresProcessus>(FILTRES_VIDES);
  const [deplies, setDeplies] = useState<Record<string, boolean>>({});
  const [pause, setPause] = useState(false),
    reduit = useReducedMotion();
  const anime = !pause && !reduit;
  const indisponibles = NATURES_RATTACHEMENT.filter((n) => donnees.candidats[n] === null);
  const visibles = filtrerProcessus(donnees.processus, donnees.types, filtres, indisponibles);
  const groupes = regrouperProcessus(visibles, donnees.types);
  const typeDe = (p: CarteProcessus) => donnees.types.find((t) => t.code === p.family);
  const libelleType = (p: CarteProcessus) => typeDe(p)?.label || p.family || 'Sans type';
  // Les sous-processus d'une carte affichée sont tous présentés : les critères portent sur les cartes.
  const enfantsDe = (p: CarteProcessus) => donnees.processus.filter((x) => x.parent === p.id);
  const champ = (cle: keyof FiltresProcessus, valeur: string) => setFiltres((old) => ({ ...old, [cle]: valeur }));
  const reinitialiser = () => setFiltres(FILTRES_VIDES);
  const filtresActifs = Object.values(filtres).filter(Boolean).length;
  const codesTypes = [
    ...new Set([...donnees.types.map((t) => t.code), ...donnees.processus.map((p) => p.family).filter(Boolean)]),
  ];
  const optionsTypes = codesTypes.map((code) => {
    const t = donnees.types.find((x) => x.code === code);
    return { value: code, label: t ? t.label + (t.archived ? ' (archivé)' : '') : code };
  });
  const puces = (
    [
      { cle: 'recherche', libelle: 'Recherche : ' + filtres.recherche },
      {
        cle: 'type',
        libelle:
          filtres.type === SANS_TYPE_PROCESSUS
            ? 'Sans type'
            : (optionsTypes.find((t) => t.value === filtres.type)?.label ?? filtres.type),
      },
      { cle: 'pilote', libelle: 'Pilote : ' + filtres.pilote },
      { cle: 'rattachement', libelle: filtres.rattachement ? LIBELLES_RATTACHEMENT[filtres.rattachement] : '' },
    ] as { cle: keyof FiltresProcessus; libelle: string }[]
  ).filter((puce) => !!filtres[puce.cle]);
  const sousProcessus = (p: CarteProcessus, vus = new Set<string>()) => {
    if (vus.has(p.id)) return null;
    const deja = new Set([...vus, p.id]),
      enfants = enfantsDe(p).filter((k) => !deja.has(k.id));
    return enfants.length ? (
      <ul className="pr-children">
        {enfants.map((k) => (
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
            {sousProcessus(k, deja)}
          </li>
        ))}
      </ul>
    ) : null;
  };
  const carte = (p: CarteProcessus) => {
    const deplie = !!deplies[p.id],
      enfants = enfantsDe(p);
    const objet = enfants.length ? `les sous-processus (${enfants.length})` : 'la finalité';
    return (
      <article key={p.id} className="pr-card carte-processus" data-id={p.id}>
        <button
          type="button"
          className="pr-card-open"
          id={`processus-open-${p.id}`}
          {...ficheCliquable(() => onOpen(p.id), `Afficher ${p.name}`)}
        >
          <span className="pr-card-header">
            <span className="pr-card-glyph">
              <Icone name="cycle" />
            </span>
            <span className="pr-code">{p.id}</span>
            <span>
              {enfants.length ? `${enfants.length} sous-processus` : p.parent ? 'Sous-processus' : 'Processus'}
            </span>
          </span>
          <strong>{p.name}</strong>
          <span className="pr-pilot">
            <Icone name="user" />
            {p.owner || 'Pilote non renseigné'}
          </span>
          <CompteursProcessus carte={p} indisponibles={indisponibles} />
        </button>
        {deplie && (
          <div className="pr-inline" id={`${id}-inline-${p.id}`}>
            <p>{p.purpose || 'Finalité non renseignée'}</p>
            {p.parent && <small>Parent : {donnees.processus.find((x) => x.id === p.parent)?.name ?? p.parent}</small>}
            {enfants.length ? sousProcessus(p) : <small>Aucun sous-processus enregistré.</small>}
          </div>
        )}
        <div className="pr-card-foot">
          <button
            type="button"
            className="pr-expand"
            aria-expanded={deplie}
            aria-controls={deplie ? `${id}-inline-${p.id}` : undefined}
            aria-label={`${deplie ? 'Masquer' : 'Afficher'} ${objet} de ${p.name}`}
            onClick={() => setDeplies((old) => ({ ...old, [p.id]: !old[p.id] }))}
          >
            <span aria-hidden="true">{deplie ? '−' : '+'}</span>
          </button>
        </div>
      </article>
    );
  };
  return (
    <section
      className="processus-studio pr-module"
      data-motion={anime ? 'on' : 'off'}
      aria-label="Processus du périmètre"
    >
      <header className="pr-overview">
        <div className="pr-overview-identity">
          <span className="pr-scope-icon">
            <Icone name="tree" />
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
              {(['cartes', 'liste'] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  className="pr-tool"
                  aria-label={v === 'cartes' ? 'Vue cartes' : 'Vue liste compacte'}
                  title={v === 'cartes' ? 'Cartes' : 'Liste compacte'}
                  aria-pressed={v === vue}
                  onClick={() => setVue(v)}
                >
                  <Icone name={v === 'cartes' ? 'grid' : 'list'} />
                </button>
              ))}
            </div>
            <span className="pr-view-label">{vue === 'cartes' ? 'Vue par type' : 'Liste compacte'}</span>
          </div>
          <div className="pr-toolbar-end">
            <Popover position="bottom-end" trapFocus returnFocus>
              <Popover.Target>
                <button type="button" className="pr-tool" aria-label="Rechercher un processus" title="Rechercher">
                  <Icone name="search" />
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <TextInput
                  label="Rechercher un processus"
                  placeholder="Nom, code, pilote, finalité…"
                  value={filtres.recherche}
                  onChange={(e) => champ('recherche', e.currentTarget.value)}
                />
              </Popover.Dropdown>
            </Popover>
            <Popover position="bottom-end" trapFocus returnFocus>
              <Popover.Target>
                <button
                  type="button"
                  className="pr-tool"
                  aria-label={
                    filtresActifs ? `Filtres, ${filtresActifs} actif${filtresActifs > 1 ? 's' : ''}` : 'Filtres'
                  }
                  title="Filtres"
                >
                  <Icone name="filter" />
                  {!!filtresActifs && <b aria-hidden="true">{filtresActifs}</b>}
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
                    onChange={(v) => champ('type', v ?? '')}
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
                    onChange={(v) => champ('pilote', v ?? '')}
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
                    onChange={(v) => champ('rattachement', v ?? '')}
                    allowDeselect={false}
                  />
                  <Button variant="subtle" onClick={reinitialiser}>
                    Réinitialiser
                  </Button>
                </div>
              </Popover.Dropdown>
            </Popover>
            <button
              type="button"
              className="pr-tool"
              disabled={!!reduit}
              aria-label={anime ? 'Mettre les animations en pause' : 'Reprendre les animations'}
              title={
                reduit
                  ? 'Mouvement réduit activé sur cet appareil'
                  : anime
                    ? 'Mettre les animations en pause'
                    : 'Reprendre les animations'
              }
              onClick={() => setPause((v) => !v)}
            >
              <Icone name={anime ? 'pause' : 'play'} />
            </button>
            {modifiable && (
              <Button
                onClick={(e) => {
                  retenirFocusFiche(e.currentTarget);
                  onCreate();
                }}
              >
                <span aria-hidden="true">+&nbsp;</span>Nouveau processus
              </Button>
            )}
          </div>
        </div>
        {!!filtresActifs && (
          <div className="pr-chips">
            {puces.map((puce) => (
              <button
                type="button"
                key={puce.cle}
                aria-label={`Retirer le critère ${puce.libelle}`}
                onClick={() => champ(puce.cle, '')}
              >
                {puce.libelle} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" onClick={reinitialiser}>
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
                  : 'Créez le premier, ou dessinez-le depuis la cartographie : il apparaîtra ici.'}
              </p>
              {!!filtresActifs && (
                <Button variant="default" onClick={reinitialiser}>
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : vue === 'cartes' ? (
            <div className="pr-board">
              {groupes.map((g) => {
                const libelle = g.type?.label || g.code || 'Sans type';
                return (
                  <section className="pr-lane" data-tone={g.type?.tint ?? 'gris'} key={g.code} aria-label={libelle}>
                    <header className="pr-lane-header">
                      <Icone name="tree" />
                      <h2>
                        {libelle}
                        {g.type?.archived && ' · type archivé'}
                      </h2>
                      <span>{g.racines.length}</span>
                    </header>
                    <p className="pr-lane-description">{g.type?.description || 'Processus de ce type'}</p>
                    <div className="pr-cards">{g.racines.map(carte)}</div>
                  </section>
                );
              })}
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
                  data-tone={typeDe(p)?.tint ?? 'gris'}
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
                  <span>{libelleType(p)}</span>
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
