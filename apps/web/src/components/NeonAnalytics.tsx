/* Vue analytique Neon de l'accueil (refonte Neon, vues Dashboard approuvées le 13/11/2026). Présentation seule : la
   disposition personnalisable (ADR 0078) et toutes les opérations restent accessibles. Les sources de chaque carte sont
   les API existantes, filtrées par les gardes serveur ; une carte sans donnée lisible le dit, sans valeur inventée.
   Adaptée à la version actuelle : la carte « Sauvegardes & résilience » de la référence, alimentée par le module CRRC
   retiré (ADR 0084), n'est pas reprise ; le registre des incidents est à son adresse actuelle. RETEX exclu. */
import { Button, Drawer, Group, SegmentedControl, TextInput } from '@mantine/core';
import type { Incident, Synthese } from '@suivi/shared';
import { NeonAnneau, NeonColonnes, NeonCourbes, NeonEcheances, NeonMotif, NeonRadar } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { get } from '../api';
import { ADRESSE_REGISTRE_INCIDENTS } from '../incidents/anciennes-adresses';
import { useCan } from '../session';
import { tauxGlobal } from './TableauDeBord';
import { compterMois, journalNeon, type EvenementNeon } from './neon-donnees';

function Stats({ valeurs }: { valeurs: readonly [string, number | string][] }) {
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
function Etat({ pending, erreur, vide }: { pending?: boolean; erreur?: unknown; vide?: boolean }) {
  return (
    <p className="na-etat" role={erreur ? 'alert' : undefined}>
      {pending
        ? 'Chargement…'
        : erreur
          ? 'Données indisponibles. Réessayez depuis le registre.'
          : vide
            ? 'Aucune donnée enregistrée.'
            : 'Données non disponibles avec vos droits.'}
    </p>
  );
}
interface Carte {
  id: string;
  titre: string;
  sousTitre: string;
  route: string;
  contenu: ReactNode;
}
export function NeonAnalytics({ s }: { s: Synthese }) {
  const can = useCan(),
    [recherche, setRecherche] = useState(''),
    [scope, setScope] = useState('global'),
    [detail, setDetail] = useState<string | null>(null);
  const incidents = useQuery({
    queryKey: ['incidents'],
    queryFn: () => get<{ incidents: Incident[] }>('/api/incidents'),
    enabled: can('incidents', 'lire'),
  });
  const journal = useQuery({
    queryKey: ['admin', 'audit', 'neon'],
    queryFn: () => get<EvenementNeon[]>('/api/admin/audit?limit=500'),
    enabled: can('administration', 'lire'),
  });
  const refs = (s.conformite ?? []).filter(
    (r) =>
      scope === 'global' ||
      (scope === 'hds' ? /hds/i.test(r.ref + ' ' + r.libelle) : !/hds/i.test(r.ref + ' ' + r.libelle)),
  );
  const total = refs.reduce((n, r) => n + r.total, 0),
    exigences = refs.reduce((n, r) => n + r.exigences, 0),
    global = tauxGlobal(s.conformite ? refs : null);
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
  const i = incidents.data?.incidents,
    logs = journal.data,
    courbes = journalNeon(logs ?? []);
  const cartes: Carte[] = [
    {
      id: 'hero',
      titre: 'Tableau de bord',
      sousTitre: 'Management de la sécurité et de la qualité',
      route: '/pilotage',
      contenu: (
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
        </div>
      ),
    },
    {
      id: 'conformite',
      titre: 'Conformité ISO 27001 / HDS',
      sousTitre: 'Niveaux déclarés des exigences applicables',
      route: '/pilotage/mesures',
      contenu: s.conformite ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'mesures',
      titre: 'Applicabilité & mesures',
      sousTitre: 'Répartition des évaluations par état',
      route: '/pilotage/applicabilite',
      contenu: s.conformite ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'risques',
      titre: 'Niveau de risque',
      sousTitre: 'Registre des risques · appréciations et revues',
      route: '/pilotage/risques',
      contenu: risques ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'incidents',
      titre: 'Incidents de sécurité',
      sousTitre: 'Événements enregistrés par mois',
      route: ADRESSE_REGISTRE_INCIDENTS,
      contenu: i ? (
        <>
          <NeonColonnes
            titre="Incidents par mois de détection"
            valeurs={compterMois(i.map((x) => ({ date: x.detectedAt })))}
          />
          <Stats
            valeurs={[
              ['Incidents', i.length],
              ['En cours', i.filter((x) => x.status === 'En cours').length],
              ['Clos / résolus', i.filter((x) => ['Clos', 'Résolu'].includes(x.status)).length],
            ]}
          />
        </>
      ) : (
        <Etat pending={can('incidents', 'lire') && incidents.isPending} erreur={incidents.error} />
      ),
    },
    {
      id: 'audits',
      titre: 'Audits & constats',
      sousTitre: 'Classification des constats enregistrés',
      route: '/pilotage/amelioration',
      contenu: ecarts ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'echeances',
      titre: 'Plan d’action',
      sousTitre: 'Repères d’échéance · aucune durée déduite',
      route: '/pilotage/actions',
      contenu: actions ? (
        <>
          <NeonEcheances
            lignes={s.echeances.filter((e) => e.type === 'Action').map((e) => ({ libelle: e.texte, date: e.echeance }))}
          />
          <Stats
            valeurs={[
              ['Actions', actions.total],
              ['Ouvertes', actions.ouvertes],
              ['En retard', actions.enRetard],
            ]}
          />
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'indicateurs',
      titre: 'Indicateurs & maturité',
      sousTitre: 'Niveau « Total » par référentiel, sans score certifiant',
      route: '/pilotage/indicateurs',
      contenu: ind ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'actions',
      titre: 'Plan d’action (états)',
      sousTitre: 'Un retard est un attribut, pas un statut supplémentaire',
      route: '/pilotage/actions',
      contenu: actions ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
    {
      id: 'journal',
      titre: 'Journal d’audit technique',
      sousTitre: 'Répartition chronologique des 500 derniers événements au plus',
      route: '/admin/audit',
      contenu: logs ? (
        <>
          <NeonCourbes {...courbes} />
          <Stats
            valeurs={[
              ['Événements chargés', logs.length],
              ['Types d’actions', new Set(logs.map((l) => l.action)).size],
            ]}
          />
        </>
      ) : (
        <Etat pending={can('administration', 'lire') && journal.isPending} erreur={journal.error} />
      ),
    },
    {
      id: 'synthese',
      titre: 'Vue consolidée',
      sousTitre: 'Indicateurs du système de management',
      route: '/pilotage',
      contenu: ind ? (
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
        </>
      ) : (
        <Etat />
      ),
    },
  ];
  const selection = cartes.find((c) => c.id === detail);
  const peutOuvrir: Record<string, boolean> = {
    hero: can('pilotage', 'lire'),
    conformite: can('audit', 'lire'),
    mesures: can('pilotage', 'lire'),
    risques: can('pilotage', 'lire'),
    incidents: can('incidents', 'lire'),
    audits: can('ecarts', 'lire'),
    echeances: can('ecarts', 'lire'),
    indicateurs: can('pilotage', 'lire'),
    actions: can('ecarts', 'lire'),
    journal: can('administration', 'lire'),
    synthese: can('pilotage', 'lire'),
  };
  return (
    <section className="neon-analytics" aria-label="Vue analytique Neon">
      <div className="na-entete">
        <div>
          <h2>Vue d’ensemble · Gouvernance, risque et conformité</h2>
          <p>
            {cartes.length} visualisations · données de l’application · situation au{' '}
            <span className="horodatage">{new Date(s.genereLe).toLocaleDateString('fr-FR')}</span>
          </p>
        </div>
        <Group gap="xs">
          <TextInput
            aria-label="Rechercher une carte"
            placeholder="Rechercher une carte"
            value={recherche}
            onChange={(e) => setRecherche(e.currentTarget.value)}
          />
          {can('import_export', 'lire') && (
            <Button component={Link} to="/exports" variant="filled">
              Exports
            </Button>
          )}
          <SegmentedControl
            aria-label="Référentiels affichés"
            value={scope}
            onChange={setScope}
            data={[
              { value: 'global', label: 'Global' },
              { value: 'iso', label: 'ISO' },
              { value: 'hds', label: 'HDS' },
            ]}
          />
        </Group>
      </div>
      <div className="na-grille">
        {cartes
          .filter((c) => (c.titre + ' ' + c.sousTitre).toLocaleLowerCase().includes(recherche.toLocaleLowerCase()))
          .map((c) => (
            <article key={c.id} className={`na-carte na-carte-${c.id}`} aria-labelledby={`na-${c.id}`}>
              <header>
                <div>
                  <h3 id={`na-${c.id}`}>{c.titre}</h3>
                  <p>{c.sousTitre}</p>
                </div>
                <button
                  type="button"
                  className="na-detail"
                  onClick={() => setDetail(c.id)}
                  aria-label={`Détail : ${c.titre}`}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </header>
              <div className="na-contenu">{c.contenu}</div>
            </article>
          ))}
      </div>
      <Drawer opened={!!selection} onClose={() => setDetail(null)} title={selection?.titre} position="right" size="lg">
        {selection && (
          <div className="na-detail-contenu">
            {selection.contenu}
            <Button
              component={Link}
              to={selection.route}
              onClick={() => setDetail(null)}
              disabled={!peutOuvrir[selection.id]}
            >
              Ouvrir le registre
            </Button>
          </div>
        )}
      </Drawer>
    </section>
  );
}
