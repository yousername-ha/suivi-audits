/* Tableau de bord de l'accueil, « Suivi de la conformité » (ADR 0069) : dalles en verre et relief, métriques colorées
   selon des seuils d'affichage, dans la disposition choisie par la personne (ADR 0078). Lecture seule ; toutes les valeurs viennent de la synthèse
   (/api/mur/synthese), filtrée selon les droits : une dalle sans donnée lisible n'est pas affichée. Le taux global est
   la moyenne simple des taux par référentiel (décision du RSSI du 28/10/2026, ADR 0069), affiché comme tel et distinct
   des taux par référentiel ; jamais une somme d'exigences de référentiels différents (ADR 0060).
   L'écran mural et le Pilotage gardent les cartes de Synthese.tsx. */
import { completerDisposition, dallesAffichees, type Disposition, type IdDalle, type Synthese } from '@suivi/shared';
import {
  Anneau,
  BarresEmpilees,
  BarresHorizontales,
  ChiffreCle,
  Dalle,
  fmtTaux,
  GrilleChiffres,
  Histogramme,
  IconeAdministration,
  JaugeArc,
  SEUILS_TAUX,
  teinteSeuil,
  type LargeurDalle,
  type Seuils,
  type TeinteSeuil,
} from '@suivi/ui';
import { Fragment, type ReactNode } from 'react';
import { fmtJour, TEINTE_ECART } from './Synthese';

/** Jours restants avant l'audit : rouge sous 30 jours, orange sous 60, vert au-delà. */
const SEUILS_JOURS: Seuils = {
  base: 'rouge',
  paliers: [
    { des: 30, teinte: 'orange' },
    { des: 60, teinte: 'vert' },
  ],
};
const JOUR_MS = 86_400_000;

/** Jours entiers entre la date de génération de la synthèse et une date AAAA-MM-JJ (négatif si elle est passée). */
export function joursAvant(date: string, reference: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const cible = Date.parse(`${date.slice(0, 10)}T12:00:00`);
  const jour = new Date(reference);
  const base = Date.parse(
    `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}T12:00:00`,
  );
  return Number.isNaN(cible) || Number.isNaN(base) ? null : Math.round((cible - base) / JOUR_MS);
}

/** Taux de conformité global : moyenne simple des taux par référentiel (exigences mises en œuvre totalement sur
    exigences applicables), chaque référentiel comptant autant. null sans référentiel applicable. */
export function tauxGlobal(c: Synthese['conformite']) {
  const taux = (c ?? []).filter((r) => r.applicables > 0).map((r) => (r.total * 100) / r.applicables);
  return taux.length ? { pourcent: taux.reduce((s, t) => s + t, 0) / taux.length, referentiels: taux.length } : null;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const AVERTISSEMENT = 'Déclaration interne : ce n’est ni un taux de conformité certifié ni le résultat d’un audit.';

function Note({ children }: { children: ReactNode }) {
  return <p className="tdb-chiffre-legende">{children}</p>;
}

/** Compte à rebours affiché à côté de la date de l'audit. */
export const libelleJours = (jours: number) =>
  jours > 0 ? `dans ${jours}\u202fj` : jours === 0 ? 'aujourd’hui' : 'passé';

/** Carte phare, au style de l'ancienne carte « Prochain audit » : le prochain audit en haut, avec son compte à
    rebours, puis le taux de conformité global (moyenne des référentiels). Toujours affichée, comme l'ancienne carte. */
function CartePhare({
  s,
  global,
  largeur,
}: {
  s: Synthese;
  global: ReturnType<typeof tauxGlobal>;
  largeur: LargeurDalle;
}) {
  const audit = s.prochainAudit;
  const jours = audit ? joursAvant(audit.date, s.genereLe) : null;
  return (
    <section
      className={`tdb-dalle tdb-l${largeur} tdb-phare`}
      aria-label={global ? 'Prochain audit et taux de conformité global' : 'Prochain audit'}
    >
      <span className="tdb-phare-symbole" aria-hidden="true">
        <IconeAdministration />
      </span>
      <div className="tdb-phare-bloc">
        <h2 className="tdb-phare-titre">Prochain audit</h2>
        {audit ? (
          <>
            <p className="tdb-phare-valeur chiffres">
              {fmtJour(audit.date)}
              {jours != null && (
                // Compte à rebours : change chaque jour, masqué comme les dates dans les captures de référence.
                <span className={`tdb-puce horodatage tdb-p-${jours >= 0 ? teinteSeuil(SEUILS_JOURS, jours) : 'gris'}`}>
                  {libelleJours(jours)}
                </span>
              )}
            </p>
            <p className="tdb-phare-detail">
              {[audit.annee, audit.libelle].filter(Boolean).join(' — ') || 'Date à confirmer'}
            </p>
            {s.auditInterne && <p className="tdb-phare-detail">Audit interne : {fmtJour(s.auditInterne)}</p>}
          </>
        ) : (
          <p className="tdb-phare-detail">Non planifié ou non visible avec vos droits.</p>
        )}
      </div>
      {global && (
        <div className="tdb-phare-bloc tdb-phare-taux">
          <h2 className="tdb-phare-titre">Taux de conformité global</h2>
          <p className="tdb-phare-valeur chiffres">
            {fmtTaux(global.pourcent)}
            <span className={`tdb-puce tdb-p-${teinteSeuil(SEUILS_TAUX, global.pourcent)}`}>
              Moyenne des référentiels
            </span>
          </p>
          <p className="tdb-phare-detail">
            {`Moyenne simple des taux de ${pluriel(global.referentiels, 'référentiel', 'référentiels')} · chaque référentiel compte autant`}
          </p>
          <p className="tdb-phare-legende">Déclaration interne, non certifiée</p>
        </div>
      )}
    </section>
  );
}

function Repartition({
  titre,
  valeurs,
  largeur,
}: {
  titre: string;
  valeurs: Record<string, number>;
  largeur: LargeurDalle;
}) {
  const lignes = Object.entries(valeurs).sort((a, b) => b[1] - a[1]);
  const total = lignes.reduce((s, [, n]) => s + n, 0);
  return (
    <Dalle titre={titre} sousTitre={pluriel(total, 'élément', 'éléments')} largeur={largeur}>
      <BarresHorizontales
        titre={titre}
        lignes={lignes.map(([libelle, n]) => ({ libelle, valeur: n, max: total, texte: String(n) }))}
        teinte="bleu"
      />
    </Dalle>
  );
}

function Echeances({ s, largeur }: { s: Synthese; largeur: LargeurDalle }) {
  return (
    <Dalle titre="Prochaines échéances" sousTitre="Écarts et actions à traiter" largeur={largeur}>
      {s.echeances.length ? (
        <ul className="tdb-echeances">
          {s.echeances.map((e) => {
            const teinte: TeinteSeuil = e.enRetard ? 'rouge' : 'gris';
            return (
              <li key={e.id + e.echeance} className="tdb-echeance">
                <span className={`tdb-pastille tdb-b-${teinte}`} aria-hidden="true" />
                <span className="tdb-echeance-objet">
                  <span>
                    <b>{e.type}</b> · {e.texte || e.id}
                  </span>
                  <span className="tdb-echeance-meta">{[e.pilote, e.perimetre].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`tdb-puce tdb-p-${teinte} chiffres`}>
                  {e.enRetard ? `En retard · ${fmtJour(e.echeance)}` : fmtJour(e.echeance)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="graph-vide">Aucune échéance dans la période.</p>
      )}
    </Dalle>
  );
}

/** Une dalle du catalogue (ADR 0078) : titre (poignée et annonces du mode modification), largeur standard du lot 1 et
    rendu à une largeur donnée. N'existe que si la synthèse lisible par la personne contient ses données. */
export interface DalleTableauDeBord {
  id: IdDalle;
  titre: string;
  largeur: LargeurDalle;
  rendu: (largeur: LargeurDalle) => ReactNode;
}

/** Dalles disponibles pour cette synthèse, dans l'ordre et aux largeurs standard (ADR 0069, lot 1). */
export function dallesTableauDeBord(s: Synthese): DalleTableauDeBord[] {
  const refs = (s.conformite ?? []).filter((r) => r.applicables > 0);
  const global = tauxGlobal(s.conformite);
  const e = s.ecarts;
  const a = s.actions;
  const i = s.indicateurs;
  const eo = s.ecartsOuverts;
  const r = s.risques;
  const c = s.continuite;
  // Les deux jauges partagent la moitié de la rangée ; seule, une jauge la prend entière (pas de trou dans la grille).
  const largeurJauge: LargeurDalle = i && i.total > 0 && eo && eo.actionsTotal > 0 ? 3 : 6;
  const mesures =
    s.mesures &&
    Object.fromEntries(
      Object.entries(s.mesures.parReferentiel).map(([k, n]) => [
        k === 'A' ? 'ISO 27001, Annexe A' : k === 'ISO' ? 'ISO 27001, clauses' : k || 'Autre',
        n,
      ]),
    );
  const dalles: (DalleTableauDeBord | false | null | undefined)[] = [
    {
      id: 'phare',
      titre: global ? 'Prochain audit et taux de conformité global' : 'Prochain audit',
      largeur: 6,
      rendu: (l) => <CartePhare s={s} global={global} largeur={l} />,
    },
    e && {
      id: 'ecarts',
      titre: 'Écarts',
      largeur: 3,
      rendu: (l) => (
        <Dalle titre="Écarts" sousTitre="Écarts · tous périmètres lisibles" largeur={l}>
          <GrilleChiffres
            chiffres={[
              { valeur: e.ouverts, libelle: 'ouverts' },
              { valeur: e.enRetard, libelle: 'en retard', teinte: e.enRetard ? 'rouge' : 'vert' },
              { valeur: e.aEcheance, libelle: 'à échéance proche', teinte: e.aEcheance ? 'orange' : 'vert' },
              { valeur: e.total, libelle: 'au total' },
            ]}
          />
        </Dalle>
      ),
    },
    a && {
      id: 'actions-retard',
      titre: 'Actions en retard',
      largeur: 3,
      rendu: (l) => (
        <Dalle titre="Actions en retard" sousTitre="Actions · tous périmètres lisibles" largeur={l}>
          <ChiffreCle
            valeur={String(a.enRetard)}
            teinte={a.enRetard ? 'rouge' : 'vert'}
            detail={`sur ${pluriel(a.ouvertes, 'action ouverte', 'actions ouvertes')}`}
            legende={pluriel(a.terminees, 'action terminée', 'actions terminées')}
          />
        </Dalle>
      ),
    },
    refs.length > 0 && {
      id: 'conformite-referentiels',
      titre: 'Taux de conformité par référentiel',
      largeur: 6,
      rendu: (l) => (
        <Dalle
          titre="Taux de conformité par référentiel"
          sousTitre="Exigences applicables mises en œuvre totalement, référentiel par référentiel"
          largeur={l}
        >
          <BarresHorizontales
            titre="Taux de conformité par référentiel"
            lignes={refs.map((x) => ({ libelle: x.libelle, valeur: x.total, max: x.applicables }))}
            seuils={SEUILS_TAUX}
            cible={global?.pourcent}
          />
          {global && (
            <Note>{`Trait violet : taux global, moyenne des référentiels (${fmtTaux(global.pourcent)}).`}</Note>
          )}
          <Note>{AVERTISSEMENT}</Note>
        </Dalle>
      ),
    },
    i &&
      i.total > 0 && {
        id: 'indicateurs',
        titre: 'Indicateurs atteints',
        largeur: largeurJauge,
        rendu: (l) => (
          <Dalle titre="Indicateurs atteints" sousTitre="Objectifs et indicateurs" largeur={l}>
            <JaugeArc
              libelle="Indicateurs atteints"
              valeur={i.atteints}
              max={i.total}
              detail={`${i.atteints}/${i.total} atteints · ${i.nonAtteints} non atteints · ${i.nonMesures} non mesurés`}
            />
          </Dalle>
        ),
      },
    eo &&
      eo.actionsTotal > 0 && {
        id: 'actions-ecarts',
        titre: 'Actions des écarts réalisées',
        largeur: largeurJauge,
        rendu: (l) => (
          <Dalle titre="Actions des écarts réalisées" sousTitre="Écarts · plans d’action" largeur={l}>
            <JaugeArc
              libelle="Actions des écarts réalisées"
              valeur={eo.actionsRealisees}
              max={eo.actionsTotal}
              detail={`${eo.actionsRealisees}/${eo.actionsTotal} actions réalisées`}
            />
          </Dalle>
        ),
      },
    refs.length > 0 && {
      id: 'mise-en-oeuvre',
      titre: 'Niveau de mise en œuvre des exigences',
      largeur: 6,
      rendu: (l) => (
        <Dalle titre="Niveau de mise en œuvre des exigences" sousTitre="Applicabilité · par référentiel" largeur={l}>
          <BarresEmpilees
            titre="Niveau de mise en œuvre des exigences applicables, par référentiel"
            series={[
              { cle: 't', libelle: 'Total', teinte: 'vert' },
              { cle: 'p', libelle: 'Partiel', teinte: 'orange' },
              { cle: 'i', libelle: 'Insuffisant', teinte: 'rouge' },
              { cle: 'n', libelle: 'Non renseigné', teinte: 'gris' },
            ]}
            lignes={refs.map((x) => ({
              libelle: x.libelle,
              valeurs: { t: x.total, p: x.partiel, i: x.insuffisant, n: x.nonRenseigne },
            }))}
            part="t"
            libellePart="part mise en œuvre totalement"
          />
        </Dalle>
      ),
    },
    eo && {
      id: 'ecarts-type',
      titre: 'Écarts ouverts par type',
      largeur: 6,
      rendu: (l) => (
        <Dalle titre="Écarts ouverts par type" sousTitre="Écarts · classification" largeur={l}>
          <Anneau
            titre="Écarts ouverts par type"
            parts={eo.parType
              .filter((t) => t.n || t.type)
              .map((t) => ({ libelle: t.libelle, valeur: t.n, teinte: TEINTE_ECART[t.type] ?? 'gris' }))}
            centre={String(eo.ouverts)}
            sousCentre="ouverts"
          />
        </Dalle>
      ),
    },
    { id: 'echeances', titre: 'Prochaines échéances', largeur: 6, rendu: (l) => <Echeances s={s} largeur={l} /> },
    (r || c) && {
      id: 'risques-continuite',
      titre: 'Risques et continuité',
      largeur: 3,
      rendu: (l) => (
        <Dalle titre="Risques et continuité" sousTitre="Risques · continuité d’activité" largeur={l}>
          <div className="tdb-chiffres">
            {r && <ChiffreCle valeur={String(r.total)} detail="risques" />}
            {r && (
              <ChiffreCle
                valeur={String(r.sansDecision)}
                teinte={r.sansDecision ? 'orange' : 'vert'}
                detail="sans appréciation validée"
              />
            )}
            {r && (
              <ChiffreCle
                valeur={String(r.revueEchue)}
                teinte={r.revueEchue ? 'orange' : 'vert'}
                detail="revues échues"
              />
            )}
            {c && <ChiffreCle valeur={String(c.bia)} detail="analyses d’impact (BIA)" />}
            {c && <ChiffreCle valeur={String(c.pcra)} detail="plans de continuité et de reprise" />}
          </div>
        </Dalle>
      ),
    },
    s.recurrences && {
      id: 'recurrences',
      titre: 'Tâches récurrentes en retard',
      largeur: 3,
      rendu: (l) => (
        <Dalle titre="Tâches récurrentes en retard" sousTitre="Tâches récurrentes · revues, contrôles" largeur={l}>
          <ChiffreCle
            valeur={String(s.recurrences!.occurrencesEnRetard)}
            teinte={s.recurrences!.occurrencesEnRetard ? 'rouge' : 'vert'}
            detail={`sur ${pluriel(s.recurrences!.occurrencesOuvertes, 'occurrence ouverte', 'occurrences ouvertes')}`}
            legende={pluriel(s.recurrences!.series, 'série active', 'séries actives')}
          />
        </Dalle>
      ),
    },
    s.plans && {
      id: 'plans',
      titre: `Plans du SMSI ${s.plans.annee}`,
      largeur: 4,
      rendu: (l) => (
        <Dalle titre={`Plans du SMSI ${s.plans!.annee}`} sousTitre="Actions des plans par type et par état" largeur={l}>
          <Histogramme
            titre={`Actions des plans ${s.plans!.annee} par type et par état`}
            categories={s.plans!.types.map((t) => ({
              libelle: t.libelle,
              valeurs: { r: t.realises, v: t.aVenir, l: t.enRetard },
            }))}
            series={[
              { cle: 'r', libelle: 'Réalisé', teinte: 'vert' },
              { cle: 'v', libelle: 'À venir', teinte: 'bleu' },
              { cle: 'l', libelle: 'En retard', teinte: 'rouge' },
            ]}
            vide={`Aucune action planifiée en ${s.plans!.annee}.`}
          />
        </Dalle>
      ),
    },
    mesures && {
      id: 'mesures',
      titre: 'Mesures suivies',
      largeur: 4,
      rendu: (l) => (
        <Dalle titre={`Mesures suivies (${s.mesures!.total})`} sousTitre="Applicabilité · par référentiel" largeur={l}>
          <BarresHorizontales
            titre="Mesures suivies par référentiel"
            lignes={Object.entries(mesures)
              .sort((x, y) => y[1] - x[1])
              .map(([libelle, n]) => ({ libelle, valeur: n, max: s.mesures!.total, texte: String(n) }))}
            teinte="vert"
          />
        </Dalle>
      ),
    },
    s.plan && {
      id: 'plan-audit',
      titre: 'Plan d’audit',
      largeur: 4,
      rendu: (l) => (
        <Dalle titre="Plan d’audit" sousTitre={`Statut : ${s.plan!.statut || 'non renseigné'}`} largeur={l}>
          {s.plan!.jours.length ? (
            <ul className="tdb-echeances">
              {s.plan!.jours.map((j) => (
                <li key={j.label + j.date} className="tdb-echeance">
                  <span className="tdb-pastille tdb-b-violet" aria-hidden="true" />
                  <span className="tdb-echeance-objet">
                    <span>{j.label || 'Journée'}</span>
                    <span className="tdb-echeance-meta">{pluriel(j.creneaux, 'créneau', 'créneaux')}</span>
                  </span>
                  <span className="tdb-puce tdb-p-violet chiffres">{fmtJour(j.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="graph-vide">Aucune journée planifiée.</p>
          )}
        </Dalle>
      ),
    },
    e && {
      id: 'ecarts-statut',
      titre: 'Écarts par statut',
      largeur: 4,
      rendu: (l) => <Repartition titre="Écarts par statut" valeurs={e.parStatut} largeur={l} />,
    },
    e && {
      id: 'ecarts-classification',
      titre: 'Écarts par classification',
      largeur: 4,
      rendu: (l) => <Repartition titre="Écarts par classification" valeurs={e.parType} largeur={l} />,
    },
    e && {
      id: 'ecarts-source',
      titre: 'Écarts par audit à l’origine',
      largeur: 4,
      rendu: (l) => <Repartition titre="Écarts par audit à l’origine" valeurs={e.parSource} largeur={l} />,
    },
  ];
  return dalles.filter((x): x is DalleTableauDeBord => !!x);
}

/** Dalles affichées : selon la disposition enregistrée (ADR 0078), sinon dans l'ordre et aux largeurs standard. */
export function dallesDisposees(dalles: DalleTableauDeBord[], disposition: Disposition | null) {
  if (!disposition) return dalles.map((x) => ({ dalle: x, largeur: x.largeur }));
  const parId = new Map(dalles.map((x) => [x.id, x]));
  const complete = completerDisposition(
    disposition,
    Object.fromEntries(dalles.map((x) => [x.id, x.largeur])) as Partial<Record<IdDalle, LargeurDalle>>,
  );
  return dallesAffichees(complete, new Set(parId.keys())).map((x) => ({ dalle: parId.get(x.id)!, largeur: x.largeur }));
}

export function TableauDeBordConformite({ s, disposition = null }: { s: Synthese; disposition?: Disposition | null }) {
  return (
    <div className="tdb">
      <div className="grille-cartes tdb-grille">
        {dallesDisposees(dallesTableauDeBord(s), disposition).map(({ dalle, largeur }) => (
          <Fragment key={dalle.id}>{dalle.rendu(largeur)}</Fragment>
        ))}
      </div>
    </div>
  );
}
