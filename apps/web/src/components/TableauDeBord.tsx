/* Tableau de bord par défaut de l'accueil, « Suivi de la conformité » (ADR 0066, lot 1) : dalles en verre et relief,
   métriques colorées selon des seuils d'affichage. Lecture seule ; toutes les valeurs viennent de la synthèse
   (/api/mur/synthese), filtrée selon les droits : une dalle sans donnée lisible n'est pas affichée. Aucun taux tous
   référentiels confondus (ADR 0060) : la mise en œuvre est donnée référentiel par référentiel.
   L'écran mural et le Pilotage gardent les cartes de Synthese.tsx. */
import type { Synthese } from '@suivi/shared';
import {
  Anneau,
  BarresEmpilees,
  BarresHorizontales,
  ChiffreCle,
  Dalle,
  Histogramme,
  JaugeArc,
  SEUILS_TAUX,
  teinteSeuil,
  type Seuils,
  type TeinteSeuil,
} from '@suivi/ui';
import type { ReactNode } from 'react';
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

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const AVERTISSEMENT = 'Déclaration interne : ce n’est ni un taux de conformité certifié ni le résultat d’un audit.';

function Note({ children }: { children: ReactNode }) {
  return <p className="tdb-chiffre-legende">{children}</p>;
}

function Repartition({ titre, valeurs }: { titre: string; valeurs: Record<string, number> }) {
  const lignes = Object.entries(valeurs).sort((a, b) => b[1] - a[1]);
  const total = lignes.reduce((s, [, n]) => s + n, 0);
  return (
    <Dalle titre={titre} sousTitre={pluriel(total, 'élément', 'éléments')} largeur={4}>
      <BarresHorizontales
        titre={titre}
        lignes={lignes.map(([libelle, n]) => ({ libelle, valeur: n, max: total, texte: String(n) }))}
        teinte="bleu"
      />
    </Dalle>
  );
}

function Echeances({ s }: { s: Synthese }) {
  return (
    <Dalle titre="Prochaines échéances" sousTitre="Écarts et actions à traiter" largeur={8}>
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

export function TableauDeBordConformite({ s }: { s: Synthese }) {
  const refs = (s.conformite ?? []).filter((r) => r.applicables > 0);
  const e = s.ecarts;
  const a = s.actions;
  const jours = s.prochainAudit ? joursAvant(s.prochainAudit.date, s.genereLe) : null;
  const i = s.indicateurs;
  const eo = s.ecartsOuverts;
  const r = s.risques;
  const c = s.continuite;
  const mesures =
    s.mesures &&
    Object.fromEntries(
      Object.entries(s.mesures.parReferentiel).map(([k, n]) => [
        k === 'A' ? 'ISO 27001, Annexe A' : k === 'ISO' ? 'ISO 27001, clauses' : k || 'Autre',
        n,
      ]),
    );
  return (
    <div className="tdb">
      <div className="grille-cartes tdb-grille">
        {s.recurrences && (
          <Dalle titre="Tâches récurrentes en retard" sousTitre="Tâches récurrentes · revues, contrôles" largeur={3}>
            <ChiffreCle
              valeur={String(s.recurrences.occurrencesEnRetard)}
              teinte={s.recurrences.occurrencesEnRetard ? 'rouge' : 'vert'}
              detail={`sur ${pluriel(s.recurrences.occurrencesOuvertes, 'occurrence ouverte', 'occurrences ouvertes')}`}
              legende={pluriel(s.recurrences.series, 'série active', 'séries actives')}
            />
          </Dalle>
        )}
        {e && (
          <Dalle titre="Écarts ouverts" sousTitre="Écarts · tous périmètres lisibles" largeur={3}>
            <ChiffreCle
              valeur={String(e.ouverts)}
              teinte={e.enRetard ? 'rouge' : e.aEcheance ? 'orange' : 'vert'}
              detail={`${e.enRetard} en retard · ${e.aEcheance} à échéance proche`}
              legende={`${e.total} au total`}
            />
          </Dalle>
        )}
        {a && (
          <Dalle titre="Actions en retard" sousTitre="Actions · tous périmètres lisibles" largeur={3}>
            <ChiffreCle
              valeur={String(a.enRetard)}
              teinte={a.enRetard ? 'rouge' : 'vert'}
              detail={`sur ${pluriel(a.ouvertes, 'action ouverte', 'actions ouvertes')}`}
              legende={pluriel(a.terminees, 'action terminée', 'actions terminées')}
            />
          </Dalle>
        )}
        <Dalle titre="Prochain audit" sousTitre="Audits" largeur={3}>
          {s.prochainAudit ? (
            <ChiffreCle
              valeur={jours == null ? fmtJour(s.prochainAudit.date) : jours >= 0 ? `${jours}\u202fj` : 'Passé'}
              teinte={jours == null || jours < 0 ? undefined : teinteSeuil(SEUILS_JOURS, jours)}
              detail={
                [fmtJour(s.prochainAudit.date), s.prochainAudit.libelle].filter(Boolean).join(' · ') ||
                'Date à confirmer'
              }
              legende={s.auditInterne ? `Audit interne : ${fmtJour(s.auditInterne)}` : undefined}
            />
          ) : (
            <ChiffreCle valeur="—" detail="Non planifié ou non visible avec vos droits." />
          )}
        </Dalle>

        {refs.length > 0 && (
          <Dalle
            titre="Conformité par référentiel"
            sousTitre="Exigences applicables mises en œuvre totalement"
            largeur={6}
          >
            <BarresHorizontales
              titre="Conformité par référentiel"
              lignes={refs.map((x) => ({ libelle: x.libelle, valeur: x.total, max: x.applicables }))}
              seuils={SEUILS_TAUX}
            />
            <Note>{AVERTISSEMENT}</Note>
          </Dalle>
        )}
        {i && i.total > 0 && (
          <Dalle titre="Indicateurs atteints" sousTitre="Objectifs et indicateurs" largeur={3}>
            <JaugeArc
              libelle="Indicateurs atteints"
              valeur={i.atteints}
              max={i.total}
              detail={`${i.atteints}/${i.total} atteints · ${i.nonAtteints} non atteints · ${i.nonMesures} non mesurés`}
            />
          </Dalle>
        )}
        {eo && eo.actionsTotal > 0 && (
          <Dalle titre="Actions des écarts réalisées" sousTitre="Écarts · plans d’action" largeur={3}>
            <JaugeArc
              libelle="Actions des écarts réalisées"
              valeur={eo.actionsRealisees}
              max={eo.actionsTotal}
              detail={`${eo.actionsRealisees}/${eo.actionsTotal} actions réalisées`}
            />
          </Dalle>
        )}

        {refs.length > 0 && (
          <Dalle titre="Niveau de mise en œuvre des exigences" sousTitre="Applicabilité · par référentiel" largeur={6}>
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
        )}
        {eo && (
          <Dalle titre="Écarts ouverts par type" sousTitre="Écarts · classification" largeur={6}>
            <Anneau
              titre="Écarts ouverts par type"
              parts={eo.parType
                .filter((t) => t.n || t.type)
                .map((t) => ({ libelle: t.libelle, valeur: t.n, teinte: TEINTE_ECART[t.type] ?? 'gris' }))}
              centre={String(eo.ouverts)}
              sousCentre="ouverts"
            />
          </Dalle>
        )}

        <Echeances s={s} />
        {(r || c) && (
          <Dalle titre="Risques et continuité" sousTitre="Risques · continuité d’activité" largeur={4}>
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
        )}

        {s.plans && (
          <Dalle
            titre={`Plans du SMSI ${s.plans.annee}`}
            sousTitre="Actions des plans par type et par état"
            largeur={4}
          >
            <Histogramme
              titre={`Actions des plans ${s.plans.annee} par type et par état`}
              categories={s.plans.types.map((t) => ({
                libelle: t.libelle,
                valeurs: { r: t.realises, v: t.aVenir, l: t.enRetard },
              }))}
              series={[
                { cle: 'r', libelle: 'Réalisé', teinte: 'vert' },
                { cle: 'v', libelle: 'À venir', teinte: 'bleu' },
                { cle: 'l', libelle: 'En retard', teinte: 'rouge' },
              ]}
              vide={`Aucune action planifiée en ${s.plans.annee}.`}
            />
          </Dalle>
        )}
        {mesures && (
          <Dalle
            titre={`Mesures suivies (${s.mesures!.total})`}
            sousTitre="Applicabilité · par référentiel"
            largeur={4}
          >
            <BarresHorizontales
              titre="Mesures suivies par référentiel"
              lignes={Object.entries(mesures)
                .sort((x, y) => y[1] - x[1])
                .map(([libelle, n]) => ({ libelle, valeur: n, max: s.mesures!.total, texte: String(n) }))}
              teinte="vert"
            />
          </Dalle>
        )}

        {s.plan && (
          <Dalle titre="Plan d’audit" sousTitre={`Statut : ${s.plan.statut || 'non renseigné'}`} largeur={4}>
            {s.plan.jours.length ? (
              <ul className="tdb-echeances">
                {s.plan.jours.map((j) => (
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
        )}

        {e && <Repartition titre="Écarts par statut" valeurs={e.parStatut} />}
        {e && <Repartition titre="Écarts par classification" valeurs={e.parType} />}
        {e && <Repartition titre="Écarts par audit à l’origine" valeurs={e.parSource} />}
      </div>
    </div>
  );
}
