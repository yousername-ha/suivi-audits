/* Bibliothèque globale et lecture de couverture par périmètre : présentation seule des contrats existants. */
import { Menu, Select } from '@mantine/core';
import { ETATS_EXIGENCE, LIBELLES_ETAT } from '@suivi/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ficheCliquable } from '../fiche-cliquable';
import { LIBELLES_SOURCE } from '../grc/ReferentielsStudio';
import type { ReferentielBibliotheque as Referentiel, ReferentielCouverture } from './bibliotheque-types';

const TRACES: Record<string, string> = {
  book: 'M5 3h13a1 1 0 0 1 1 1v17H6a3 3 0 0 1 0-6h13M5 3v12M8 7h7m-7 4h5',
  library: 'M3 3h4v18H3Zm7 0h4v18h-4Zm7 2 3-1 4 16-3 1Z',
  plus: 'M12 5v14M5 12h14',
  search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chart: 'M4 20h17M7 16V8m5 8V3m5 13v-6',
  file: 'M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6M9 16h6',
  link: 'm9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  more: 'M4 12h.01M12 12h.01M20 12h.01',
  warning: 'm12 3 10 18H2ZM12 9v5m0 3h.01',
};
function Icone({ nom }: { nom: string }) {
  return (
    <svg
      className="bb-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACES[nom] ?? TRACES.file} />
    </svg>
  );
}
const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
/** Rectangle SVG, pas de style en ligne : compatible avec la CSP de l’application. */
function BarreEtats({ couverture: c }: { couverture: ReferentielCouverture }) {
  const total = ETATS_EXIGENCE.reduce((n, e) => n + c.etats[e], 0);
  let position = 0;
  return (
    <svg
      className="bb-bar"
      viewBox="0 0 1000 10"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Répartition des ${c.requirements} exigences selon leur état d’évaluation`}
    >
      {ETATS_EXIGENCE.map((etat) => {
        const x = position,
          w = total ? (c.etats[etat] / total) * 1000 : 0;
        position += w;
        return w > 0 ? (
          <rect key={etat} data-state={etat} x={x} y="0" width={Math.max(w - 2, 0)} height="10" rx="2" />
        ) : null;
      })}
    </svg>
  );
}
export interface BibliothequeStudioProps {
  catalogue: Referentiel[] | undefined;
  loading: boolean;
  smsi: string;
  perimetres: { id: string; name: string }[];
  onPerimetre: (value: string) => void;
  couverture: ReferentielCouverture[] | undefined;
  couvertureLoading: boolean;
  couvertureError: boolean;
  modifier: boolean;
  onImporter: () => void;
  onExigences: (f: Referentiel) => void;
  onCopie: (f: Referentiel) => void;
  onAjout: (f: Referentiel) => void;
  onEdition: (f: Referentiel) => void;
  onCouverture: (f: Referentiel) => void;
  outils: ReactNode;
}
export function BibliothequeStudio({
  catalogue,
  loading,
  smsi,
  perimetres,
  onPerimetre,
  couverture,
  couvertureLoading,
  couvertureError,
  modifier,
  onImporter,
  onExigences,
  onCopie,
  onAjout,
  onEdition,
  onCouverture,
  outils,
}: BibliothequeStudioProps) {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null),
    searchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (search) searchInput.current?.focus();
  }, [search]);
  const records = (catalogue ?? []).filter((f) => normalize(f.name + ' ' + f.identifier).includes(normalize(query)));
  const scopeName = perimetres.find((p) => p.id === smsi)?.name ?? 'Périmètre affiché';
  const closeSearch = () => {
    setSearch(false);
    searchButton.current?.focus();
  };
  return (
    <div className="bb-module">
      <div className="bb-introduction">
        <div>
          <span className="bb-crumb">Conformité et audits / Bibliothèque</span>
          <h1>Bibliothèque de référentiels</h1>
          <p>Vos référentiels et leur couverture, réunis dans une seule vue.</p>
        </div>
        {modifier && (
          <button type="button" className="bb-primary" onClick={onImporter}>
            <Icone nom="plus" />
            Importer un référentiel
          </button>
        )}
      </div>
      <section className="bb-workspace" aria-label="Catalogue et couverture des référentiels">
        <header className="bb-toolbar">
          <div className="bb-catalogue-title">
            <Icone nom="library" />
            <strong>Catalogue de l’organisation</strong>
            <span>{catalogue ? `${catalogue.length} référentiel(s)` : 'Catalogue non chargé'}</span>
          </div>
          <div className="bb-tools">
            {search && (
              <div className="bb-search">
                <label className="bb-sr" htmlFor="bibliotheque-query">
                  Rechercher un référentiel
                </label>
                <input
                  ref={searchInput}
                  id="bibliotheque-query"
                  type="search"
                  value={query}
                  placeholder="Nom ou identifiant…"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      closeSearch();
                    }
                  }}
                />
              </div>
            )}
            <button
              type="button"
              ref={searchButton}
              className="bb-icon-button"
              aria-label="Rechercher un référentiel"
              aria-expanded={search}
              onClick={() => setSearch(!search)}
            >
              <Icone nom="search" />
            </button>
          </div>
        </header>
        <div className="bb-scope">
          <div>
            <div className="bb-scope-title">
              <Icone nom="chart" />
              <strong>Couverture dans le périmètre</strong>
            </div>
            <p>Les états ci-dessous concernent uniquement le périmètre choisi.</p>
          </div>
          <Select
            aria-label="Périmètre de la couverture"
            data={perimetres.map((p) => ({ value: p.id, label: p.name }))}
            value={smsi}
            allowDeselect={false}
            onChange={(value) => {
              if (value) onPerimetre(value);
            }}
          />
        </div>
        {query && (
          <div className="bb-criteria">
            <span>Recherche : {query}</span>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchButton.current?.focus();
              }}
            >
              Effacer la recherche ×
            </button>
          </div>
        )}
        <div className="bb-scroll" tabIndex={0} role="region" aria-label="Référentiels et états de couverture">
          <div className="bb-records">
            {loading && (
              <p role="status" className="bb-catalogue-only">
                Chargement de la bibliothèque…
              </p>
            )}
            {!loading && !catalogue && <p className="bb-catalogue-only">La bibliothèque n’a pas pu être chargée.</p>}
            {catalogue && records.length === 0 && (
              <p className="bb-catalogue-only">
                {catalogue.length
                  ? 'Aucun référentiel ne correspond à cette recherche.'
                  : 'Aucun référentiel dans la bibliothèque.'}
              </p>
            )}
            {records.map((f, index) => {
              const c = couverture?.find((c) => c.frameworkId === f.id);
              const ouvrir = () => (c ? onCouverture(f) : onExigences(f));
              return (
                <article
                  key={f.id}
                  className="bb-record"
                  aria-label={`Référentiel de la bibliothèque ${f.name}`}
                  data-tone={index % 2 ? 'teal' : 'blue'}
                  {...ficheCliquable(ouvrir, `Afficher ${f.name}`)}
                >
                  <header className="bb-record-head">
                    <span className="bb-book" aria-hidden="true">
                      <Icone nom="book" />
                    </span>
                    <div className="bb-record-name">
                      <h2>{f.name}</h2>
                      <p>
                        <span className="bb-version">Fiche v{f.version}</span>
                        <span>{f.locked ? 'Source verrouillée' : 'Copie de l’organisation'}</span>
                        <span>·</span>
                        <span>
                          {f.derivedFrom
                            ? `Copie de ${f.derivedFrom.name}`
                            : f.source.status === 'unverified'
                              ? 'Source à vérifier'
                              : (LIBELLES_SOURCE[f.source.status] ?? f.source.status)}
                        </span>
                      </p>
                    </div>
                    <div className="bb-catalogue-stats">
                      <div>
                        <strong>{f.requirements}</strong>
                        <small>exigences au catalogue</small>
                      </div>
                      <div>
                        <strong>{f.scopes}</strong>
                        <small>
                          périmètre{f.scopes > 1 ? 's' : ''} rattaché{f.scopes > 1 ? 's' : ''}
                        </small>
                      </div>
                    </div>
                    <div className="bb-record-actions">
                      <button
                        type="button"
                        className="bb-small"
                        aria-label={`Consulter les exigences de ${f.name}`}
                        onClick={() => onExigences(f)}
                      >
                        <Icone nom="file" />
                        Exigences
                      </button>
                      {modifier && (
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <button
                              type="button"
                              className="bb-icon-button"
                              aria-label={`Autres actions pour ${f.name}`}
                            >
                              <Icone nom="more" />
                            </button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item onClick={() => onCopie(f)}>Créer une copie personnalisable</Menu.Item>
                            {!f.locked && <Menu.Item onClick={() => onAjout(f)}>Ajouter une exigence</Menu.Item>}
                            <Menu.Item onClick={() => onEdition(f)}>Importer une nouvelle édition</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </div>
                  </header>
                  <div className="bb-record-body">
                    {c ? (
                      <>
                        <div className="bb-coverage-heading">
                          <strong>État des exigences dans le périmètre</strong>
                          <span>
                            Version active v{c.version} · {c.etats.applicables} applicables ou à déterminer
                          </span>
                        </div>
                        <BarreEtats couverture={c} />
                        <div className="bb-states">
                          {ETATS_EXIGENCE.map((etat) => (
                            <div key={etat} className="bb-state" data-state={etat}>
                              <strong>{c.etats[etat]}</strong>
                              <small>{LIBELLES_ETAT[etat]}</small>
                            </div>
                          ))}
                        </div>
                        <div className="bb-coverage-bottom">
                          <div className="bb-links">
                            <Icone nom="link" />
                            <span>{c.covered} avec mesure reliée</span>
                            <span>·</span>
                            <span>{c.uncovered} sans mesure</span>
                            {c.toValidate > 0 && (
                              <>
                                <span>·</span>
                                <span>{c.toValidate} rapprochement(s) non compté(s)</span>
                              </>
                            )}
                          </div>
                          <button type="button" className="bb-small" onClick={() => onCouverture(f)}>
                            Voir la couverture
                            <Icone nom="arrow" />
                          </button>
                        </div>
                        {c.etats.obligatoiresNonConformes > 0 && (
                          <div className="bb-warning bb-warning-clauses">
                            <Icone nom="warning" />
                            {c.etats.obligatoiresNonConformes} clauses obligatoires pas encore conformes
                          </div>
                        )}
                        {c.etats.aDeterminer > 0 && (
                          <div className="bb-warning">
                            <Icone nom="warning" />
                            {c.etats.aDeterminer} applicabilités à déterminer
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="bb-catalogue-only">
                        {couvertureLoading
                          ? 'Chargement de la couverture…'
                          : couvertureError
                            ? 'Couverture indisponible : les états ne sont pas connus.'
                            : `Ce référentiel n’est pas rattaché et actif dans « ${scopeName} ».`}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {outils}
        </div>
        <footer className="bb-footer">
          <span>
            {catalogue
              ? `${records.length} référentiel(s) affiché(s) sur ${catalogue.length}`
              : 'Chargement non confirmé'}
          </span>
          <span>États d’évaluation · Aucun score de certification</span>
        </footer>
      </section>
    </div>
  );
}
