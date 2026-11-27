/* Fournisseurs de l'organisation, liste compacte qui se déplie (style « Verre », dessin validé dans son principe par le
   RSSI le 27/11/2026 : « vue compacte de base et quand je clique dessus ça ouvre vers le bas avec plus d'éléments »).
   Colonnes compactes : fournisseur, accès (« SSO ✓ · MFA ✓ »), criticité et HDS, évaluation courante, prochain contrôle.
   Un clic sur la ligne, ou sur son chevron (aria-expanded), la déplie vers le bas ; une seule ligne dépliée à la fois.
   Le détail reprend les champs déjà rendus par l'API (accès et rattachement, certificats, contrôles périodiques, dernière
   évaluation) et toutes les commandes de la ligne compacte (fiche, évaluation, historique, périmètres, matrice RACI) ;
   l'édition directe de SSO, MFA, criticité et HDS y reste, avec le même droit. Présentation seule : requêtes d'écriture
   et droits restent dans Fournisseurs.tsx. Couleurs portées par des classes (verre.css), jamais par un style en ligne. */
import { ActionIcon, Button, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState, type MouseEvent, type ReactNode } from 'react';
import { DataTable, retenirFocusFiche } from '@suivi/ui';
import { get } from '../api';
import { Surligne } from '../components/BarreOutils';
import { ficheCliquable } from '../fiche-cliquable';
import {
  attentionFournisseur,
  jourFr,
  resumeCriteresLigne,
  type ChampFournisseur,
  type Fournisseur,
  type TonFournisseur,
} from './fournisseurs-types';
import {
  basculerDepli,
  echeanceCertificat,
  etatEvaluation,
  initiales,
  ligneControle,
  ligneEvaluee,
  moisAnnee,
  signeAcces,
  teinteInitiales,
} from './fournisseurs-verre';

function Puce({ children, ton = 'neutral' }: { children: ReactNode; ton?: TonFournisseur }) {
  return (
    <span className="fsv-puce" data-tone={ton}>
      {children}
    </span>
  );
}

/** « SSO ✓ · MFA ✕ · HDS — » : signe coloré, valeur dite en toutes lettres aux lecteurs d'écran. */
export function AccesFournisseur({ champs }: { champs: readonly (readonly [string, string])[] }) {
  return (
    <span className="fsv-acces">
      {champs.map(([nom, valeur], i) => {
        const s = signeAcces(valeur);
        return (
          <Fragment key={nom}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            <span className="fsv-acces__champ">
              {nom}{' '}
              <span className="fsv-signe" data-tone={s.ton}>
                <span aria-hidden="true">{s.signe}</span>
                <span className="fs-visually-hidden">{s.texte}</span>
              </span>
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}

function Chevron() {
  return (
    <svg
      className="fsv-chevron__icone"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

interface Historique {
  id: string;
  conclusion: string;
}
/** Conclusion de l'évaluation courante : lue dans l'historique existant (même cache que la fenêtre « Historique »). */
function Conclusion({ f }: { f: Fournisseur }) {
  const q = useQuery({
    queryKey: ['suppliers', f.id, 'evaluations'],
    queryFn: () => get<Historique[]>(`/api/suppliers/${encodeURIComponent(f.id)}/evaluations`),
    enabled: !!f.current,
  });
  if (!f.current || !q.data) return null;
  const c = q.data.find((e) => e.id === f.current!.id)?.conclusion ?? q.data[0]?.conclusion ?? '';
  return <p className="fsv-texte">{c || 'Aucune conclusion rédigée.'}</p>;
}

export interface ListeFournisseursVerreProps {
  affiches: Fournisseur[];
  modifier: boolean;
  recherche: string;
  /** Date du jour (AAAA-MM-JJ), pour l'échéance des certificats et des contrôles. */
  aujourdhui: string;
  /** Ligne dépliée au premier affichage (tests) ; aucune par défaut. */
  ouvertInitial?: string | null;
  onFiche: (f: Fournisseur) => void;
  onEvaluer: (f: Fournisseur) => void;
  onHistorique: (f: Fournisseur) => void;
  onPerimetres: (f: Fournisseur) => void;
  onRaci: (f: Fournisseur) => void;
  cellule: (f: Fournisseur, champ: ChampFournisseur) => ReactNode;
}

const LIBELLES_EDITION: [ChampFournisseur, string][] = [
  ['sso', 'SSO'],
  ['mfa', 'MFA'],
  ['critical', 'Critique'],
  ['hds', 'HDS'],
];

function Detail({ f, p, id }: { f: Fournisseur; p: ListeFournisseursVerreProps; id: string }) {
  const commande = (libelle: string, nom: string, action: () => void) => (
    <Button
      variant="default"
      className="fsv-commande"
      aria-label={`${libelle} ${nom}`}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        retenirFocusFiche(e.currentTarget);
        action();
      }}
    >
      {libelle}
    </Button>
  );
  const criteres = resumeCriteresLigne(f.criteria);
  return (
    <Table.Tr id={id} className="fsv-detail">
      <Table.Td colSpan={6}>
        <section className="fsv-detail__corps" aria-label={`Détail de ${f.name}`}>
          <div className="fsv-detail__blocs">
            <div className="fsv-bloc">
              <h3 className="fsv-etiquette">Accès et rattachement</h3>
              <AccesFournisseur
                champs={[
                  ['SSO', f.sso],
                  ['MFA', f.mfa],
                  ['HDS', f.hds],
                ]}
              />
              <p className="fsv-texte">{f.saas ? 'Service SaaS' : 'Hors SaaS'}</p>
              <p className="fsv-texte">
                {f.rattachement ? `Rattachement : ${f.rattachement}` : 'Rattachement non renseigné'}
              </p>
              {f.contact && <p className="fsv-texte fsv-texte--fort">{f.contact}</p>}
              {p.modifier && (
                <div className="fsv-edition" role="group" aria-label={`Modifier le suivi de ${f.name}`}>
                  {LIBELLES_EDITION.map(([champ, libelle]) => (
                    <span className="fsv-edition__champ" key={champ}>
                      <span aria-hidden="true">{libelle}</span>
                      {p.cellule(f, champ)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="fsv-bloc">
              <h3 className="fsv-etiquette">Certificats</h3>
              {!f.certs.length && (
                <p className="fsv-texte">
                  {f.hds === 'Oui' || f.critical === 'Oui'
                    ? 'Certificat attendu (fournisseur critique ou hébergeur HDS).'
                    : 'Aucun certificat enregistré.'}
                </p>
              )}
              {f.certs.map((c, i) => {
                const e = echeanceCertificat(c, p.aujourdhui);
                return (
                  <div className="fsv-certificat" key={i}>
                    <p className="fsv-ligne-puce">
                      <Puce ton={e.ton}>{c.type}</Puce>
                      <span>{c.validUntil ? `jusqu’au ${jourFr(c.validUntil)}` : 'validité non renseignée'}</span>
                    </p>
                    {e.alerte && (
                      <p className="fsv-alerte" data-tone={e.ton}>
                        {e.alerte}
                      </p>
                    )}
                    {(c.received || c.scope) && (
                      <p className="fsv-texte fsv-texte--discret">
                        {[c.received && `Reçu le ${jourFr(c.received)}`, c.scope && `périmètre : ${c.scope}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="fsv-bloc">
              <h3 className="fsv-etiquette">Contrôles périodiques</h3>
              {!f.controls.length && <p className="fsv-texte">Aucun contrôle.</p>}
              {f.controls.length > 0 && (
                <ul className="fsv-controles">
                  {f.controls.map((c, i) => {
                    const l = ligneControle(c, p.aujourdhui);
                    return (
                      <li key={c.id ?? i}>
                        <span>{l.intitule}</span>
                        {l.ton ? <Puce ton={l.ton}>{l.etat}</Puce> : <span className="fsv-prevu">{l.etat}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="fsv-bloc">
              <h3 className="fsv-etiquette">Dernière évaluation</h3>
              {f.current ? (
                <p className="fsv-score">
                  <span className="fsv-score__chiffre">
                    {f.current.meets} / {f.current.items}
                  </span>
                  <span>critère{f.current.items > 1 ? 's satisfaits' : ' satisfait'}</span>
                </p>
              ) : (
                <p className="fsv-texte">Aucune évaluation enregistrée.</p>
              )}
              <Conclusion f={f} />
              <p className="fsv-texte fsv-texte--discret">{ligneEvaluee(f)}</p>
            </div>
          </div>
          <div className="fsv-detail__commandes">
            {commande('Ouvrir la fiche', `de ${f.name}`, () => p.onFiche(f))}
            {p.modifier && commande('Nouvelle évaluation', `de ${f.name}`, () => p.onEvaluer(f))}
            {commande('Qui décide quoi', `pour ${f.name}`, () => p.onRaci(f))}
            {commande('Historique des évaluations', `de ${f.name}`, () => p.onHistorique(f))}
            {commande('Périmètres de rattachement', `de ${f.name}`, () => p.onPerimetres(f))}
            <span className="fsv-detail__note">
              <Puce ton={criteres.ton}>{criteres.texte}</Puce>
            </span>
          </div>
        </section>
      </Table.Td>
    </Table.Tr>
  );
}

export function ListeFournisseursVerre(p: ListeFournisseursVerreProps) {
  const [ouvert, setOuvert] = useState<string | null>(p.ouvertInitial ?? null);
  const basculer = (id: string) => setOuvert((o) => basculerDepli(o, id));
  return (
    <DataTable label="Fournisseurs et applications, défilement horizontal possible">
      <Table className="fsv-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Fournisseur ou application</Table.Th>
            <Table.Th scope="col">Accès</Table.Th>
            <Table.Th scope="col">Criticité</Table.Th>
            <Table.Th scope="col">Évaluation courante</Table.Th>
            <Table.Th scope="col">Prochain contrôle</Table.Th>
            <Table.Th scope="col" className="fsv-col-chevron">
              <span className="fs-visually-hidden">Déplier</span>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {p.affiches.map((f, rang) => {
            const deplie = ouvert === f.id;
            const idDetail = `fsv-detail-${rang}`;
            const evaluation = etatEvaluation(f);
            const c = f.controlSummary;
            return (
              <Fragment key={f.id}>
                <Table.Tr
                  className="fsv-ligne"
                  data-attention={attentionFournisseur(f)}
                  aria-expanded={deplie}
                  {...ficheCliquable(() => basculer(f.id), `${deplie ? 'Replier' : 'Déplier'} ${f.name}`)}
                  tabIndex={-1}
                >
                  <Table.Td>
                    <div className="fsv-identite">
                      <span className="fsv-initiales" data-teinte={teinteInitiales(f.id)} aria-hidden="true">
                        {initiales(f.name)}
                      </span>
                      <div>
                        <strong className="fsv-nom">
                          <Surligne texte={f.name} recherche={p.recherche} />
                        </strong>
                        <small className="fsv-sous">
                          {f.saas ? 'Service SaaS' : 'Hors SaaS'}
                          {f.rattachement && (
                            <>
                              {' · '}
                              <Surligne texte={f.rattachement} recherche={p.recherche} />
                            </>
                          )}
                        </small>
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <AccesFournisseur
                      champs={[
                        ['SSO', f.sso],
                        ['MFA', f.mfa],
                      ]}
                    />
                  </Table.Td>
                  <Table.Td>
                    <span className="fsv-puces">
                      {f.critical === 'Oui' ? (
                        <Puce ton="bad">Critique</Puce>
                      ) : f.critical === 'Non' ? (
                        <Puce>Non critique</Puce>
                      ) : (
                        <span className="fsv-vide">
                          <span aria-hidden="true">—</span>
                          <span className="fs-visually-hidden">criticité non renseignée</span>
                        </span>
                      )}
                      {f.hds === 'Oui' && <Puce ton="info">HDS</Puce>}
                    </span>
                  </Table.Td>
                  <Table.Td>
                    <Puce ton={evaluation.ton}>{evaluation.libelle}</Puce>
                  </Table.Td>
                  <Table.Td>
                    <span className="fsv-prochain">{moisAnnee(c.prochain)}</span>
                    {c.enRetard > 0 && <small className="fsv-retard">{c.enRetard} en retard</small>}
                  </Table.Td>
                  <Table.Td className="fsv-col-chevron">
                    <ActionIcon
                      variant="default"
                      className="fsv-chevron"
                      aria-expanded={deplie}
                      aria-controls={deplie ? idDetail : undefined}
                      aria-label={`${deplie ? 'Replier' : 'Déplier'} ${f.name}`}
                      onClick={() => basculer(f.id)}
                    >
                      <Chevron />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
                {deplie && <Detail f={f} p={p} id={idDetail} />}
              </Fragment>
            );
          })}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}
