/* Cartes de la vue analytique Neon (refonte Neon, vues Dashboard approuvées le 13/11/2026), devenues des dalles du
   tableau de bord unique (ADR 0108) : elles forment sa disposition standard et s'ajoutent, se déplacent et se
   redimensionnent comme les autres. Les sources de chaque carte sont les API existantes, filtrées par les gardes
   serveur ; une carte sans donnée lisible n'est pas proposée, et une donnée en cours de chargement le dit, sans valeur
   inventée. La carte « Sauvegardes & résilience » de la référence, alimentée par le module CRRC retiré (ADR 0084), n'est
   pas reprise. RETEX exclu. */
import type { Incident, Synthese } from '@suivi/shared';
import { Dalle, NeonAnneau, NeonColonnes, NeonCourbes, NeonEcheances, NeonMotif, NeonRadar } from '@suivi/ui';
import type { ReactNode } from 'react';
import { ADRESSE_REGISTRE_INCIDENTS } from '../incidents/anciennes-adresses';
import { compterMois, journalNeon, type EvenementNeon } from './neon-donnees';
import type { DalleTableauDeBord, RenduDalle } from './tdb-types';

export function Stats({ valeurs }: { valeurs: readonly [string, number | string][] }) {
  return (
    <dl className="na-stats">
      {valeurs.map(([nom, valeur]) => (
        <div key={nom}>
          <dt>{nom}</dt>
          <dd>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}
function Liste({ valeurs }: { valeurs: readonly { libelle: string; valeur: number }[] }) {
  return (
    <ul className="na-legende">
      {valeurs.map((v, i) => (
        <li key={v.libelle}>
          <span className={`na-puce neon-serie-${i % 6}`} aria-hidden="true" />
          <span>{v.libelle}</span>
          <b>{v.valeur}</b>
        </li>
      ))}
    </ul>
  );
}
function Barres({ valeurs }: { valeurs: readonly { libelle: string; valeur: number }[] }) {
  const max = Math.max(1, ...valeurs.map((v) => v.valeur));
  return (
    <ul className="na-barres">
      {valeurs.map((v, i) => (
        <li key={v.libelle}>
          <span>{v.libelle}</span>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="8" rx="2" className="na-rail" />
            <rect width={(v.valeur / max) * 100} height="8" rx="2" className={`na-remplissage neon-serie-${i % 6}`} />
          </svg>
          <b>{v.valeur}</b>
        </li>
      ))}
    </ul>
  );
}
function Etat({ pending, erreur }: { pending?: boolean; erreur?: unknown }) {
  return (
    <p className="na-etat" role={erreur ? 'alert' : undefined}>
      {pending ? 'Chargement…' : erreur ? 'Données indisponibles. Réessayez depuis le registre.' : 'Aucune donnée.'}
    </p>
  );
}

/** Incidents agrégés pour la carte : compteurs et nombre par mois de détection. */
export interface IncidentsAgreges {
  total: number;
  enCours: number;
  clos: number;
  parMois: { libelle: string; valeur: number }[];
}
/** Agrégats de la carte « Incidents » à partir du registre lisible par la personne. */
export function agregerIncidents(i: readonly Incident[]): IncidentsAgreges {
  return {
    total: i.length,
    enCours: i.filter((x) => x.status === 'En cours').length,
    clos: i.filter((x) => ['Clos', 'Résolu'].includes(x.status)).length,
    parMois: compterMois(i.map((x) => ({ date: x.detectedAt }))),
  };
}

/** Données des cartes qui ne viennent pas de la synthèse (incidents, journal), chargées selon les droits ou reçues avec
    les chiffres ouverts d'un auteur (incidents seulement : le journal n'est jamais ouvert, ADR 0109). */
export interface DonneesNeon {
  incidents: { lisible: boolean; data?: IncidentsAgreges; pending: boolean; error: unknown };
  journal: { lisible: boolean; data?: EvenementNeon[]; pending: boolean; error: unknown };
  /** Référentiels affichés par les cartes de conformité : tous, ISO seuls ou HDS seul. */
  portee: string;
}

/** Cartes Neon disponibles pour cette synthèse et ces droits, dans l'ordre de la vue analytique. */
export function dallesNeon(
  s: Synthese,
  donnees: DonneesNeon,
  moyenne: (c: Synthese['conformite']) => { pourcent: number } | null,
): DalleTableauDeBord[] {
  const refs = (s.conformite ?? []).filter(
    (r) =>
      donnees.portee === 'global' ||
      (donnees.portee === 'hds' ? /hds/i.test(r.ref + ' ' + r.libelle) : !/hds/i.test(r.ref + ' ' + r.libelle)),
  );
  const total = refs.reduce((n, r) => n + r.total, 0),
    exigences = refs.reduce((n, r) => n + r.exigences, 0),
    global = moyenne(s.conformite ? refs : null);
  const ind = s.indicateurs,
    actions = s.actions,
    risques = s.risques,
    ecarts = s.ecarts;
  const niveaux = [
    { libelle: 'Total', valeur: total },
    { libelle: 'Partiel', valeur: refs.reduce((n, r) => n + r.partiel, 0) },
    { libelle: 'Insuffisant', valeur: refs.reduce((n, r) => n + r.insuffisant, 0) },
    { libelle: 'Non renseigné', valeur: refs.reduce((n, r) => n + r.nonRenseigne, 0) },
    { libelle: 'Non applicable', valeur: refs.reduce((n, r) => n + Math.max(0, r.exigences - r.applicables), 0) },
  ];
  const i = donnees.incidents.data,
    logs = donnees.journal.data;
  /** Carte au cadre commun des dalles, contenu et pied de la vue analytique. */
  const carte = (p: RenduDalle, titre: string, sousTitre: string, contenu: ReactNode, className?: string) => (
    <Dalle
      titre={titre}
      sousTitre={sousTitre}
      largeur={p.largeur}
      hauteur={p.hauteur}
      action={p.action}
      className={`tdb-neon${className ? ` ${className}` : ''}`}
    >
      {contenu}
    </Dalle>
  );
  const dalles: (DalleTableauDeBord | false | null | undefined)[] = [
    {
      id: 'bandeau',
      titre: 'Bandeau ISO 27001 / HDS',
      description: 'Titre du tableau de bord, mesures, risques et constats',
      groupe: 'Pilotage',
      largeur: 3,
      route: '/pilotage',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Bandeau ISO 27001 / HDS',
          'Management de la sécurité de l’information',
          <div className="na-hero">
            <NeonMotif type="vagues" />
            <span className="na-surtitre">PILOTAGE · {s.organisation}</span>
            <div className="na-hero-titre">
              <span>TABLEAU DE BORD</span>
              <strong>ISO 27001 / HDS</strong>
              <small>Management de la sécurité de l’information</small>
            </div>
            <Stats
              valeurs={[
                ['Mesures', s.mesures?.total ?? '—'],
                ['Risques', risques?.total ?? '—'],
                ['Constats', ecarts?.total ?? '—'],
              ]}
            />
          </div>,
          'tdb-bandeau',
        ),
    },
    s.conformite && {
      id: 'conformite',
      titre: 'Conformité ISO 27001 / HDS',
      description: 'Niveaux déclarés des exigences applicables, par référentiel',
      groupe: 'Conformité',
      largeur: 3,
      route: '/pilotage/mesures',
      droit: ['audit', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Conformité ISO 27001 / HDS',
          'Niveaux déclarés des exigences applicables',
          <>
            <div className="na-conformite">
              {refs.map((r) => (
                <div key={r.ref}>
                  <div className="na-ligne">
                    <b>{r.ref}</b>
                    <span>
                      {r.total} totalement / {r.applicables} applicables
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 100 5"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`${r.libelle} : ${r.total} total, ${r.partiel} partiel, ${r.insuffisant} insuffisant, ${r.nonRenseigne} non renseigné`}
                  >
                    <rect width="100" height="5" rx="1" className="na-rail" />
                    {[r.total, r.partiel, r.insuffisant, r.nonRenseigne].map((v, k, arr) => (
                      <rect
                        key={k}
                        x={(arr.slice(0, k).reduce((a, b) => a + b, 0) / Math.max(1, r.applicables)) * 100}
                        width={(v / Math.max(1, r.applicables)) * 100}
                        height="5"
                        className={`na-niveau-${k}`}
                      />
                    ))}
                  </svg>
                </div>
              ))}
            </div>
            <Stats
              valeurs={[
                ['Applicables', refs.reduce((n, r) => n + r.applicables, 0)],
                ['Niveau total', total],
                ['Moyenne des référentiels', global ? `${Math.round(global.pourcent)} %` : '—'],
              ]}
            />
            <p className="na-note">
              Moyenne simple des référentiels, non certifiante.{' '}
              {s.prochainAudit?.date && `Prochain audit : ${s.prochainAudit.date}`}
            </p>
          </>,
        ),
    },
    s.conformite && {
      id: 'applicabilite',
      titre: 'Applicabilité & mesures',
      description: 'Exigences par niveau de mise en œuvre, en anneau',
      groupe: 'Conformité',
      largeur: 3,
      route: '/pilotage/applicabilite',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Applicabilité & mesures',
          'Répartition des évaluations par état',
          <>
            <div className="na-duo">
              <NeonAnneau
                titre="Exigences au niveau Total"
                valeur={total}
                total={exigences}
                centre={String(exigences)}
                detail="exigences"
              />
              <Liste valeurs={niveaux} />
            </div>
            <Stats valeurs={refs.map((r) => [r.ref, r.exigences])} />
          </>,
        ),
    },
    risques && {
      id: 'niveau-risque',
      titre: 'Niveau de risque',
      description: 'Risques enregistrés, appréciations à valider, revues échues',
      groupe: 'Risques et incidents',
      largeur: 3,
      route: '/pilotage/risques',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Niveau de risque',
          'Registre des risques · appréciations et revues',
          <>
            <div className="na-duo">
              <NeonMotif type="risques" />
              <div className="na-compteur">
                <strong>{risques.total}</strong>
                <span>risques enregistrés</span>
                <small>Motif décoratif</small>
              </div>
            </div>
            <Stats
              valeurs={[
                ['Sans appréciation validée', risques.sansDecision],
                ['Revues échues', risques.revueEchue],
              ]}
            />
          </>,
        ),
    },
    donnees.incidents.lisible && {
      id: 'incidents',
      titre: 'Incidents de sécurité',
      description: 'Incidents par mois de détection, en cours et clos',
      groupe: 'Risques et incidents',
      largeur: 3,
      route: ADRESSE_REGISTRE_INCIDENTS,
      droit: ['incidents', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Incidents de sécurité',
          'Événements enregistrés par mois',
          i ? (
            <>
              <NeonColonnes titre="Incidents par mois de détection" valeurs={i.parMois} />
              <Stats
                valeurs={[
                  ['Incidents', i.total],
                  ['En cours', i.enCours],
                  ['Clos / résolus', i.clos],
                ]}
              />
            </>
          ) : (
            <Etat pending={donnees.incidents.pending} erreur={donnees.incidents.error} />
          ),
        ),
    },
    ecarts && {
      id: 'constats',
      titre: 'Audits & constats',
      description: 'Constats par type, ouverts et en retard',
      groupe: 'Écarts et actions',
      largeur: 3,
      route: '/pilotage/amelioration',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Audits & constats',
          'Classification des constats enregistrés',
          <>
            <NeonColonnes
              titre="Constats par type"
              valeurs={Object.entries(ecarts.parType).map(([libelle, valeur]) => ({ libelle, valeur }))}
            />
            <Stats
              valeurs={[
                ['Total', ecarts.total],
                ['Ouverts', ecarts.ouverts],
                ['En retard', ecarts.enRetard],
              ]}
            />
          </>,
        ),
    },
    actions && {
      id: 'plan-action',
      titre: 'Plan d’action',
      description: 'Échéances des actions sur une frise',
      groupe: 'Écarts et actions',
      largeur: 3,
      route: '/pilotage/actions',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Plan d’action',
          'Repères d’échéance · aucune durée déduite',
          <>
            <NeonEcheances
              lignes={s.echeances
                .filter((e) => e.type === 'Action')
                .map((e) => ({ libelle: e.texte, date: e.echeance }))}
            />
            <Stats
              valeurs={[
                ['Actions', actions.total],
                ['Ouvertes', actions.ouvertes],
                ['En retard', actions.enRetard],
              ]}
            />
          </>,
        ),
    },
    ind && {
      id: 'maturite',
      titre: 'Indicateurs & maturité',
      description: 'Indicateurs atteints et niveau « Total » par référentiel, en radar',
      groupe: 'Pilotage',
      largeur: 3,
      route: '/pilotage/indicateurs',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Indicateurs & maturité',
          'Niveau « Total » par référentiel, sans score certifiant',
          <>
            <div className="na-duo">
              <Stats
                valeurs={[
                  ['Indicateurs atteints', `${ind.atteints} / ${ind.total}`],
                  ['Non atteints', ind.nonAtteints],
                  ['Non mesurés', ind.nonMesures],
                ]}
              />
              <NeonRadar
                titre="Niveau Total par référentiel"
                axes={refs.map((r) => ({
                  libelle: r.ref,
                  valeur: r.applicables ? (r.total / r.applicables) * 100 : null,
                }))}
              />
            </div>
            <p className="na-note">
              {refs
                .map(
                  (r) =>
                    `${r.ref} : ${r.applicables ? Math.round((r.total / r.applicables) * 100) + ' %' : 'non applicable'}`,
                )
                .join(' · ')}
            </p>
          </>,
        ),
    },
    actions && {
      id: 'actions-etats',
      titre: 'Plan d’action (états)',
      description: 'Actions ouvertes, terminées et en retard, en barres',
      groupe: 'Écarts et actions',
      largeur: 3,
      route: '/pilotage/actions',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Plan d’action (états)',
          'Un retard est un attribut, pas un statut supplémentaire',
          <>
            <Barres
              valeurs={[
                { libelle: 'Ouvertes', valeur: actions.ouvertes },
                { libelle: 'Terminées', valeur: actions.terminees },
                { libelle: 'En retard', valeur: actions.enRetard },
              ]}
            />
            <Stats
              valeurs={[
                ['Total', actions.total],
                ['Tâches récurrentes', s.recurrences?.series ?? '—'],
              ]}
            />
          </>,
        ),
    },
    donnees.journal.lisible && {
      id: 'journal',
      titre: 'Journal d’audit technique',
      description: 'Répartition des derniers événements du journal, en courbes',
      groupe: 'Pilotage',
      largeur: 3,
      route: '/admin/audit',
      droit: ['administration', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Journal d’audit technique',
          'Répartition chronologique des 500 derniers événements au plus',
          logs ? (
            <>
              <NeonCourbes {...journalNeon(logs)} />
              <Stats
                valeurs={[
                  ['Événements chargés', logs.length],
                  ['Types d’actions', new Set(logs.map((l) => l.action)).size],
                ]}
              />
            </>
          ) : (
            <Etat pending={donnees.journal.pending} erreur={donnees.journal.error} />
          ),
        ),
    },
    ind && {
      id: 'vue-consolidee',
      titre: 'Vue consolidée',
      description: 'Objectifs atteints en anneau, mesures, risques et constats',
      groupe: 'Pilotage',
      largeur: 3,
      route: '/pilotage',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        carte(
          p,
          'Vue consolidée',
          'Indicateurs du système de management',
          <>
            <div className="na-duo">
              <Barres
                valeurs={[
                  { libelle: 'Atteints', valeur: ind.atteints },
                  { libelle: 'Non atteints', valeur: ind.nonAtteints },
                  { libelle: 'Non mesurés', valeur: ind.nonMesures },
                ]}
              />
              <NeonAnneau
                titre="Objectifs atteints"
                valeur={ind.atteints}
                total={ind.total}
                detail="objectifs atteints"
              />
            </div>
            <Stats
              valeurs={[
                ['Mesures', s.mesures?.total ?? '—'],
                ['Risques', risques?.total ?? '—'],
                ['Constats', ecarts?.total ?? '—'],
              ]}
            />
          </>,
        ),
    },
  ];
  return dalles.filter((x): x is DalleTableauDeBord => !!x);
}
