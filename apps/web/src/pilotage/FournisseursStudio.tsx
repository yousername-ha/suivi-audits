/* Fournisseurs de l'organisation, registre compact « Studio » (refonte Neon, lot 5, ADR 0093) : présentation seule du
   registre réel ; requêtes, droits et écritures restent dans Fournisseurs.tsx. Vue compacte par défaut, détail à la
   demande, lignes ouvrables (même fiche que le bouton « Fiche »), états colorés. Boîte d'outils commune (7.3.0) : vues,
   recherche et filtres avancés (Situation) ; le Type se filtre sur le titre de sa colonne ; l'ajout au bout de la ligne.
   Les couleurs sont portées par des classes (neon-fournisseurs.css), jamais par un style en ligne (CSP stricte). */
import { ActionIcon, Button, Select, Table, Tooltip } from '@mantine/core';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { APropos, DataTable, retenirFocusFiche } from '@suivi/ui';
import { BoiteOutils, FiltreColonne, PastillesCriteres, type CritereActif } from '../components/BarreOutils';
import { ficheCliquable } from '../fiche-cliquable';
import {
  attentionFournisseur,
  detailCritere,
  jourFr,
  resumeCriteresLigne,
  tonCertificats,
  type ChampFournisseur,
  type Fournisseur,
  type TonFournisseur,
} from './fournisseurs-types';

const icones: Record<string, ReactNode> = {
  compact: <path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01" />,
  detail: <path d="M3 3h18v18H3zM3 9h18M9 9v12" />,
  search: <path d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6" />,
  box: <path d="m12 2 10 6v10l-10 5-10-5V8zM2 8l10 5 10-5M12 13v10M7 5l10 5" />,
  cloud: <path d="M6 18a5 5 0 1 1 0-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 0 9z" />,
  shield: <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM7 12l3 3 7-7" />,
  key: <path d="M13 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-1 4 9 9m-5-5 3-3m-6 0 3-3" />,
  fiche: <path d="M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6M9 16h6" />,
  evaluer: <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />,
  historique: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />,
  perimetres: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 17h6M17 14v6" />,
};
function Icone({ nom }: { nom: keyof typeof icones }) {
  return (
    <svg
      className="fs-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icones[nom]}
    </svg>
  );
}

/** Puce d'état colorée (bon, attention, problème, déclaré, neutre). */
export function PuceFournisseur({ children, ton = 'neutral' }: { children: ReactNode; ton?: TonFournisseur }) {
  return (
    <span className="fs-chip" data-tone={ton}>
      {children}
    </span>
  );
}

function Controles({ f }: { f: Fournisseur }) {
  const c = f.controlSummary;
  return (
    <>
      {c.enRetard > 0 && <PuceFournisseur ton="bad">{c.enRetard} en retard</PuceFournisseur>}
      {c.nonConformes > 0 && <PuceFournisseur ton="bad">{c.nonConformes} non conforme</PuceFournisseur>}
      {c.aRealiser > 0 && <PuceFournisseur ton="warn">{c.aRealiser} à réaliser</PuceFournisseur>}
      {!c.enRetard && !c.aRealiser && !c.nonConformes && c.total > 0 && (
        <PuceFournisseur ton="good">À jour</PuceFournisseur>
      )}
      {!c.total && <PuceFournisseur>Aucun contrôle</PuceFournisseur>}
      <small>Prochain : {jourFr(c.prochain)}</small>
    </>
  );
}

function Evaluation({ f }: { f: Fournisseur }) {
  const e = f.current;
  if (!e) return <PuceFournisseur>Non évalué</PuceFournisseur>;
  return (
    <>
      <span className="fs-visually-hidden">
        {e.meets} répond · {e.notMeets} ne répond pas · {e.notAssessed} non évalué
      </span>
      <span className="fs-score" aria-hidden="true">
        <span data-tone="good" title="Répond">
          ✓ {e.meets}
        </span>
        <span data-tone="bad" title="Ne répond pas">
          × {e.notMeets}
        </span>
        <span title="Non évalué">— {e.notAssessed}</span>
      </span>
      <small>
        Le {jourFr(e.evaluatedAt)} · {e.evaluator}
      </small>
      {e.nextReviewAt && <small className="fs-context">Réévaluation {jourFr(e.nextReviewAt)}</small>}
      {f.toReview && <PuceFournisseur ton="bad">À réévaluer</PuceFournisseur>}
    </>
  );
}

/** Critères rattachés (ADR 0098) : résumé compact sur la ligne, détail de chaque critère au survol ; la fiche du fournisseur,
    ouverte d'un clic sur la ligne, en donne le détail complet (aussi au clavier). */
function CriteresLigne({ f }: { f: Fournisseur }) {
  const r = resumeCriteresLigne(f.criteria);
  if (!f.criteria.length) return <small>{r.texte}</small>;
  return (
    <Tooltip
      label={f.criteria.map((k) => (
        <span key={k.id} className="fs-tooltip-ligne">
          {detailCritere(k)}
        </span>
      ))}
      multiline
      w="var(--suivi-champ-m)"
      withArrow
      openDelay={300}
    >
      <span className="fs-chip" data-tone={r.ton}>
        {r.texte}
      </span>
    </Tooltip>
  );
}

/** Bouton d'action d'une ligne : nom accessible complet, info-bulle courte ; le focus revient au bouton à la fermeture. */
function Action({
  libelle,
  info,
  icone,
  onClick,
}: {
  libelle: string;
  info: string;
  icone: keyof typeof icones;
  onClick: () => void;
}) {
  return (
    <Tooltip label={info} withArrow openDelay={300}>
      <ActionIcon
        variant="default"
        className="fs-action"
        aria-label={libelle}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          retenirFocusFiche(e.currentTarget);
          onClick();
        }}
      >
        <Icone nom={icone} />
      </ActionIcon>
    </Tooltip>
  );
}

export interface FournisseursStudioProps {
  tous: Fournisseur[];
  affiches: Fournisseur[];
  chargement: boolean;
  disponible: boolean;
  modifier: boolean;
  recherche: string;
  filtre: string;
  type: string;
  situations: { value: string; label: string }[];
  mfa: { oui: number; saas: number; pct: number };
  sso: { oui: number; saas: number; pct: number };
  onRecherche: (valeur: string) => void;
  onFiltre: (valeur: string) => void;
  onType: (valeur: string) => void;
  onCreer: () => void;
  onFiche: (f: Fournisseur) => void;
  onEvaluer: (f: Fournisseur) => void;
  onHistorique: (f: Fournisseur) => void;
  onPerimetres: (f: Fournisseur) => void;
  cellule: (f: Fournisseur, champ: ChampFournisseur) => ReactNode;
}

const TYPES = [
  { value: 'all', label: 'Tous les types' },
  { value: 'saas', label: 'Services SaaS' },
  { value: 'autre', label: 'Hors SaaS' },
];

export function FournisseursStudio(p: FournisseursStudioProps) {
  const [densite, setDensite] = useState<'compact' | 'detail'>('compact');
  const criteres: CritereActif[] = [
    ...(p.recherche.trim()
      ? [{ cle: 'fq', libelle: 'Recherche', valeur: p.recherche.trim(), retirer: () => p.onRecherche('') }]
      : []),
    ...(p.filtre !== 'all'
      ? [
          {
            cle: 'fsit',
            libelle: 'Situation',
            valeur: p.situations.find((x) => x.value === p.filtre)?.label ?? p.filtre,
            retirer: () => p.onFiltre('all'),
          },
        ]
      : []),
    ...(p.type !== 'all'
      ? [
          {
            cle: 'ftype',
            libelle: 'Type',
            valeur: TYPES.find((x) => x.value === p.type)?.label ?? p.type,
            retirer: () => p.onType('all'),
          },
        ]
      : []),
  ];
  const effacer = () => {
    p.onRecherche('');
    p.onFiltre('all');
    p.onType('all');
  };
  const pourcentage = (s: { saas: number; pct: number }) => (p.disponible && s.saas ? `${s.pct} %` : '—');
  const indicateurs = [
    {
      libelle: 'Répertoire',
      valeur: p.disponible ? String(p.tous.length) : '—',
      detail: 'fournisseurs dans l’organisation',
      icone: 'box',
      ton: 'cyan',
    },
    {
      libelle: 'Services SaaS',
      valeur: p.disponible ? String(p.mfa.saas) : '—',
      detail: 'services déclarés',
      icone: 'cloud',
      ton: 'bleu',
    },
    {
      libelle: 'SaaS avec MFA',
      valeur: pourcentage(p.mfa),
      detail: `${p.mfa.oui} / ${p.mfa.saas} services SaaS`,
      icone: 'shield',
      ton: 'vert',
    },
    {
      libelle: 'SaaS avec SSO',
      valeur: pourcentage(p.sso),
      detail: `${p.sso.oui} / ${p.sso.saas} services SaaS`,
      icone: 'key',
      ton: 'bleu',
    },
  ] as const;
  return (
    <section className="fournisseurs-studio" aria-label="Registre des fournisseurs">
      <APropos>
        Les fournisseurs et leurs évaluations appartiennent à l’organisation, pas à un périmètre : un fournisseur évalué
        l’est de la même façon dans tous les périmètres où il est rattaché. Les critères sont définis par vos soins ;
        aucune grille ni aucun seuil n’est fourni. La fiche d’un fournisseur regroupe ses informations de suivi (MFA,
        SSO, criticité, hébergeur HDS), ses certificats et ses contrôles périodiques.
      </APropos>
      <div className="fs-summary" role="group" aria-label="Indicateurs des services SaaS">
        {indicateurs.map((s) => (
          <div className="fs-stat" data-tone={s.ton} key={s.libelle}>
            <small>{s.libelle}</small>
            <strong>{s.valeur}</strong>
            <span>{p.disponible ? s.detail : p.chargement ? 'Chargement…' : 'Données indisponibles'}</span>
            <Icone nom={s.icone} />
          </div>
        ))}
      </div>
      <div className="fs-workspace">
        {/* Boîte d'outils commune (7.3.0) : densité, recherche par nom, filtres avancés (Situation, qui couvre plusieurs
            colonnes) ; le Type se filtre sur le titre de sa colonne. Ajout au bout de la ligne. */}
        <BoiteOutils
          label="Outils des fournisseurs"
          vues={[
            { value: 'compact', label: 'Vue compacte', icone: <Icone nom="compact" /> },
            { value: 'detail', label: 'Vue détaillée', icone: <Icone nom="detail" /> },
          ]}
          vue={densite}
          onVue={(v) => setDensite(v === 'detail' ? 'detail' : 'compact')}
          recherche={{
            label: 'Rechercher un fournisseur',
            value: p.recherche,
            onChange: p.onRecherche,
            placeholder: 'Nom du fournisseur…',
          }}
          filtres={{
            actifs: p.filtre !== 'all' ? 1 : 0,
            onReinitialiser: () => p.onFiltre('all'),
            contenu: (
              <Select
                label="Situation"
                allowDeselect={false}
                data={p.situations}
                value={p.filtre}
                onChange={(v) => p.onFiltre(v ?? 'all')}
                comboboxProps={{ withinPortal: false }}
              />
            ),
          }}
          ajout={
            p.modifier && (
              <Button className="fs-ajouter" onClick={p.onCreer}>
                Ajouter un fournisseur
              </Button>
            )
          }
        />
        <PastillesCriteres criteres={criteres} onToutEffacer={effacer} />
        <p className="fs-caption">
          {p.disponible
            ? `${p.affiches.length} fournisseur${p.affiches.length > 1 ? 's' : ''}`
            : p.chargement
              ? 'Chargement des fournisseurs…'
              : 'Fournisseurs indisponibles'}
          {' · '}Évaluations communes à tous les périmètres · Les critères sont définis par l’organisation ; aucun seuil
          ni score global n’est ajouté.
          {p.disponible && ` · ${p.tous.filter((f) => f.mfa !== 'Oui').length} sans MFA confirmée`}
        </p>
        <DataTable label="Fournisseurs et applications, défilement horizontal possible">
          <Table className="fs-table" data-density={densite}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">
                  Fournisseur ou application{' '}
                  <span className="fs-th-sub">
                    <FiltreColonne
                      libelle="Type"
                      valeur={p.type === 'all' ? null : p.type}
                      options={TYPES.filter((t) => t.value !== 'all')}
                      onChange={(v) => p.onType(v ?? 'all')}
                    />
                  </span>
                </Table.Th>
                <Table.Th scope="col">
                  Accès <span className="fs-th-sub">SSO · MFA</span>
                </Table.Th>
                <Table.Th scope="col">
                  Critique <span className="fs-th-sub">Hébergeur HDS</span>
                </Table.Th>
                <Table.Th scope="col">Certificats</Table.Th>
                <Table.Th scope="col">
                  Contrôles <span className="fs-th-sub">Prochain</span>
                </Table.Th>
                <Table.Th scope="col">
                  Évaluation courante <span className="fs-th-sub">Critères rattachés · Périmètres</span>
                </Table.Th>
                <Table.Th scope="col" className="col-actions">
                  <span className="fs-visually-hidden">Actions</span>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {p.affiches.map((f) => (
                <Table.Tr
                  key={f.id}
                  className="fs-row"
                  data-attention={attentionFournisseur(f)}
                  {...ficheCliquable(() => p.onFiche(f), `Afficher la fiche de ${f.name}`)}
                >
                  <Table.Td>
                    <div className="fs-identity">
                      <span className="fs-glyph" aria-hidden="true">
                        <Icone nom={f.saas ? 'cloud' : 'box'} />
                      </span>
                      <div>
                        <strong>{f.name}</strong>
                        <small>
                          {f.saas ? 'SaaS' : 'Hors SaaS'} · {f.rattachement || f.id}
                        </small>
                        <small className="fs-context">{f.notes || 'Aucune note renseignée'}</small>
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="fs-cell">
                      <span className="fs-pair">
                        <span aria-hidden="true">SSO</span>
                        {p.cellule(f, 'sso')}
                      </span>
                      <span className="fs-pair">
                        <span aria-hidden="true">MFA</span>
                        {p.cellule(f, 'mfa')}
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="fs-cell">
                      <span className="fs-pair">
                        <span aria-hidden="true">Crit.</span>
                        {p.cellule(f, 'critical')}
                      </span>
                      <span className="fs-pair">
                        <span aria-hidden="true">HDS</span>
                        {p.cellule(f, 'hds')}
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="fs-cell">
                      {f.certificateState[0] ? (
                        <PuceFournisseur ton={tonCertificats(f.certificateState[1])}>
                          {f.certificateState[0]}
                        </PuceFournisseur>
                      ) : (
                        <PuceFournisseur>–</PuceFournisseur>
                      )}
                      <small>
                        {f.certs.length} certificat{f.certs.length > 1 ? 's' : ''}
                      </small>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="fs-cell">
                      <Controles f={f} />
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="fs-cell">
                      <Evaluation f={f} />
                      <CriteresLigne f={f} />
                      <small>{f.scopes.length ? `${f.scopes.length} rattaché(s)` : 'Aucun périmètre'}</small>
                    </div>
                  </Table.Td>
                  <Table.Td className="col-actions">
                    <div className="fs-actions">
                      <Action
                        libelle={`Fiche du fournisseur ${f.name}`}
                        info="Fiche"
                        icone="fiche"
                        onClick={() => p.onFiche(f)}
                      />
                      {p.modifier && (
                        <Action
                          libelle={`Évaluer le fournisseur ${f.name}`}
                          info="Évaluer"
                          icone="evaluer"
                          onClick={() => p.onEvaluer(f)}
                        />
                      )}
                      <Action
                        libelle={`Historique des évaluations de ${f.name}`}
                        info="Historique des évaluations"
                        icone="historique"
                        onClick={() => p.onHistorique(f)}
                      />
                      <Action
                        libelle={`Périmètres de rattachement de ${f.name}`}
                        info="Périmètres de rattachement"
                        icone="perimetres"
                        onClick={() => p.onPerimetres(f)}
                      />
                    </div>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
        {!p.affiches.length && (
          <p className="fs-empty">
            {p.chargement
              ? 'Chargement des fournisseurs…'
              : !p.disponible
                ? 'Les fournisseurs ne sont pas disponibles.'
                : p.tous.length
                  ? 'Aucun fournisseur ne correspond aux filtres.'
                  : 'Aucun fournisseur dans le registre.'}
          </p>
        )}
      </div>
    </section>
  );
}
