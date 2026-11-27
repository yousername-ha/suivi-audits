/* Bibliothèque de référentiels, présentation « Studio » (refonte Neon, lot 4, ADR 0093 ; fusion de la couverture,
   ADR 0089) : une dalle par référentiel, identité et catalogue à gauche, couverture du périmètre affiché à droite.
   Présentation seule des contrats existants : catalogue `GET /api/library/frameworks`, résumé `GET /api/grc/:smsi/couverture`.
   Chargement, erreur et absence de rattachement ne deviennent jamais des zéros. Les couleurs sont portées par des classes
   (neon-bibliotheque.css), jamais par un style en ligne (CSP stricte). La recherche est tenue par la page
   (Bibliotheque.tsx), qui fournit la boîte d'outils commune (7.3.0) dans `barre` : le studio reste sans composant Mantine
   en tête de catalogue. */
import { Table } from '@mantine/core';
import type { ReactNode } from 'react';
import { ETATS_EXIGENCE, LIBELLES_ETAT, type FrameworkDefinition } from '@suivi/shared';
import { DataTable, ListeDefilante } from '@suivi/ui';
import { ficheCliquable } from '../fiche-cliquable';
import {
  filtrerReferentiels,
  provenance,
  segmentsEtats,
  type ReferentielBibliotheque as Referentiel,
} from './bibliotheque-types';
import type { CouvertureReferentiel } from './Couverture';

const TRACES: Record<string, string> = {
  book: 'M5 3h13a1 1 0 0 1 1 1v17H6a3 3 0 0 1 0-6h13M5 3v12M8 7h7m-7 4h5',
  library: 'M3 3h4v18H3Zm7 0h4v18h-4Zm7 2 3-1 4 16-3 1Z',
  plus: 'M12 5v14M5 12h14',
  search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chart: 'M4 20h17M7 16V8m5 8V3m5 13v-6',
  file: 'M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6M9 16h6',
  link: 'm9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  edition: 'M12 3v12m-5-5 5 5 5-5M5 21h14',
  warning: 'm12 3 10 18H2ZM12 9v5m0 3h.01',
  tools: 'M14 7a4 4 0 0 1-5 5L4 17l3 3 5-5a4 4 0 0 1 5-5l-2-2 2-2-1-1-2 2Z',
};
function Icone({ nom }: { nom: keyof typeof TRACES }) {
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
      focusable="false"
    >
      <path d={TRACES[nom]} />
    </svg>
  );
}

/** Barre des états des exigences : un rectangle SVG par état non vide, nom accessible détaillé. */
function BarreEtats({ couverture: c }: { couverture: CouvertureReferentiel }) {
  const segments = segmentsEtats(c.etats);
  if (!segments.length) return null;
  return (
    <svg
      className="bb-bar"
      viewBox="0 0 1000 10"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Répartition des ${c.requirements} exigences : ${ETATS_EXIGENCE.map((e) => `${c.etats[e]} ${LIBELLES_ETAT[e].toLowerCase()}`).join(', ')}`}
    >
      {segments.map((s) => (
        <rect key={s.etat} data-state={s.etat} x={s.x} y="0" width={s.largeur} height="10" rx="2" />
      ))}
    </svg>
  );
}

/** Exigences d'une version du référentiel, en lignes compactes : code, intitulé, domaine. */
export function ExigencesEnLignes({ definition }: { definition: FrameworkDefinition }) {
  const domaines = new Map(definition.domains.map((d) => [d.id, d.label]));
  return (
    <div className="bb-exigences">
      <DataTable label={`Exigences de ${definition.name}`}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col" className="bb-code-col">
                Code
              </Table.Th>
              <Table.Th scope="col">Intitulé de l’exigence</Table.Th>
              <Table.Th scope="col" className="bb-domaine-col">
                Domaine
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {definition.requirements.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <span className="bb-code">{r.id}</span>
                </Table.Td>
                <Table.Td>{r.title}</Table.Td>
                <Table.Td>
                  <span className="bb-domaine">{domaines.get(r.domain) ?? r.domain}</span>
                </Table.Td>
              </Table.Tr>
            ))}
            {!definition.requirements.length && (
              <Table.Tr>
                <Table.Td colSpan={3}>Aucune exigence dans cette version.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </div>
  );
}

export interface BibliothequeStudioProps {
  catalogue: Referentiel[] | undefined;
  chargement: boolean;
  smsi?: string;
  couverture: CouvertureReferentiel[] | undefined;
  couvertureChargement: boolean;
  couvertureErreur: boolean;
  modifier: boolean;
  onImporter: () => void;
  onExigences: (f: Referentiel) => void;
  onEdition: (f: Referentiel) => void;
  onCouverture: (c: CouvertureReferentiel) => void;
  outils: ReactNode;
  /** Recherche par nom ou identifiant, tenue par la page. */
  recherche?: string;
  /** Barre de recherche du catalogue, placée en tête du catalogue. */
  barre?: ReactNode;
}

export function BibliothequeStudio({
  catalogue,
  chargement,
  smsi,
  couverture,
  couvertureChargement,
  couvertureErreur,
  modifier,
  onImporter,
  onExigences,
  onEdition,
  onCouverture,
  outils,
  recherche = '',
  barre,
}: BibliothequeStudioProps) {
  const affiches = filtrerReferentiels(catalogue ?? [], recherche);
  return (
    <div className="bb-module">
      <div className="bb-introduction">
        <div>
          <span className="bb-crumb">Conformité et audits / Bibliothèque</span>
          <p>
            La bibliothèque contient les référentiels de l’organisation, importés une seule fois. Elle est figée :
            chaque édition publiée est immuable et ne se personnalise pas. Attribuer un référentiel à un périmètre (page
            Périmètres) en crée une copie propre à ce périmètre, que vous adaptez librement ; une fois appliquée, la
            copie est suivie en conformité. Aucun texte normatif n’est fourni : importez les exigences dont vous détenez
            les droits.
          </p>
        </div>
        {modifier && (
          <button type="button" className="bb-primary" onClick={onImporter}>
            <Icone nom="plus" />
            Importer un référentiel
          </button>
        )}
      </div>
      <section className="bb-workspace" aria-label="Catalogue et couverture des référentiels">
        <header className="bb-catalogue-entete">
          <div className="bb-catalogue-title">
            <Icone nom="library" />
            <h2>Catalogue de l’organisation</h2>
            <span>{catalogue ? `${catalogue.length} référentiel(s) dans la bibliothèque` : 'Chargement…'}</span>
          </div>
          {barre}
        </header>
        {smsi && (
          <div className="bb-scope">
            <div className="bb-scope-title">
              <Icone nom="chart" />
              <strong>Couverture dans le périmètre affiché</strong>
            </div>
            <p>
              Les états ci-dessous concernent uniquement ce périmètre. Ils aident à piloter ; ils ne constituent ni un
              taux de conformité ni une preuve de conformité.
            </p>
          </div>
        )}
        <ListeDefilante className="bb-scroll" label="Référentiels et états de couverture">
          <div className="bb-records">
            {chargement && (
              <p role="status" className="bb-catalogue-only">
                Chargement de la bibliothèque…
              </p>
            )}
            {!chargement && !catalogue && <p className="bb-catalogue-only">La bibliothèque n’a pas pu être chargée.</p>}
            {catalogue && !affiches.length && (
              <p className="bb-catalogue-only">
                {catalogue.length
                  ? 'Aucun référentiel ne correspond à cette recherche.'
                  : 'Aucun référentiel dans la bibliothèque.'}
              </p>
            )}
            {affiches.map((f, index) => {
              const c = couverture?.find((x) => x.identifier === f.identifier) ?? null;
              const ouvrir = () => (smsi && c ? onCouverture(c) : onExigences(f));
              return (
                <article
                  key={f.id}
                  className="bb-record"
                  aria-label={`Référentiel ${f.name}`}
                  data-tone={index % 2 ? 'teal' : 'blue'}
                  data-couverture={smsi ? 'oui' : 'non'}
                  {...ficheCliquable(ouvrir, `Afficher ${f.name}`)}
                >
                  <header className="bb-record-head">
                    <span className="bb-book" aria-hidden="true">
                      <Icone nom="book" />
                    </span>
                    <div className="bb-record-name">
                      <h3>{f.name}</h3>
                      <p>
                        <span className="bb-version">
                          {f.identifier} · version {f.version}
                        </span>
                        <span className="bb-fige">Figé</span>
                        <span>{provenance(f)}</span>
                      </p>
                    </div>
                    <div className="bb-catalogue-stats">
                      <div>
                        <strong>{f.requirements}</strong>
                        <small>exigences au catalogue</small>
                      </div>
                      <div>
                        <strong>{f.scopes}</strong>
                        <small>{f.scopes > 1 ? 'périmètres rattachés' : 'périmètre rattaché'}</small>
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
                        <button
                          type="button"
                          className="bb-small"
                          aria-label={`Importer une nouvelle édition de ${f.name}`}
                          onClick={() => onEdition(f)}
                        >
                          <Icone nom="edition" />
                          Nouvelle édition
                        </button>
                      )}
                    </div>
                  </header>
                  {smsi && (
                    <div className="bb-record-body">
                      {c ? (
                        <>
                          <div className="bb-coverage-heading">
                            <strong>État des exigences dans le périmètre</strong>
                            <span>
                              Version active v{c.version} · {c.etats.applicables} applicable(s) ou à déterminer
                            </span>
                          </div>
                          <BarreEtats couverture={c} />
                          <dl className="bb-states">
                            {ETATS_EXIGENCE.map((etat) => (
                              <div key={etat} className="bb-state" data-state={etat}>
                                <dt>{LIBELLES_ETAT[etat]}</dt>
                                <dd>{c.etats[etat]}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="bb-coverage-bottom">
                            <p className="bb-links">
                              <Icone nom="link" />
                              <span>{c.covered} avec mesure reliée</span>
                              <span aria-hidden="true">·</span>
                              <span>{c.uncovered} sans mesure reliée</span>
                            </p>
                            <button
                              type="button"
                              className="bb-small"
                              aria-label={`Voir la couverture de ${f.name}`}
                              onClick={() => onCouverture(c)}
                            >
                              Voir la couverture
                              <Icone nom="arrow" />
                            </button>
                          </div>
                          {c.etats.obligatoiresNonConformes > 0 && (
                            <p className="bb-warning bb-warning-clauses" role="note">
                              <Icone nom="warning" />
                              <span>
                                <strong>
                                  {c.etats.obligatoiresNonConformes} clause(s) obligatoire(s) (4 à 10) pas encore
                                  conforme(s).
                                </strong>{' '}
                                Une clause est conforme quand sa mise en œuvre est complète et son test d’efficacité
                                conforme ; elle ne peut pas être exclue.
                              </span>
                            </p>
                          )}
                          {c.etats.aDeterminer > 0 && (
                            <p className="bb-warning" role="note">
                              <Icone nom="warning" />
                              <span>
                                <strong>{c.etats.aDeterminer} exigence(s) à déterminer :</strong> leur applicabilité n’a
                                pas encore été tranchée. À revoir : chaque exigence doit être déclarée applicable ou
                                exclue (avec justification).
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="bb-catalogue-only">
                          {couvertureChargement
                            ? 'Chargement de la couverture…'
                            : couvertureErreur || !couverture
                              ? 'Couverture indisponible : les états ne sont pas connus.'
                              : 'Non appliqué dans ce périmètre : aucune couverture à afficher. Attribuez ce référentiel au périmètre (page Périmètres, bouton « Référentiels ») puis appliquez sa copie.'}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {outils}
        </ListeDefilante>
        <footer className="bb-footer">
          <span>
            {catalogue
              ? `${affiches.length} référentiel(s) affiché(s) sur ${catalogue.length}`
              : 'Chargement non confirmé'}
          </span>
          <span>États d’évaluation · Aucun score de certification</span>
        </footer>
      </section>
    </div>
  );
}
