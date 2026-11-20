/* Tableau de bord de l'accueil, unique depuis l'ADR 0108 : les dalles « Suivi de la conformité » (ADR 0069) et les
   cartes de la vue analytique Neon (ADR 0093) forment un seul catalogue, rendu dans le cadre et le style graphique de la
   vue analytique. La disposition choisie par la personne (ADR 0078) place, dimensionne et règle chaque dalle ; sans
   disposition enregistrée, c'est celle de la vue analytique. Lecture seule ; toutes les valeurs viennent de la synthèse
   (/api/mur/synthese) et des API existantes, filtrées selon les droits : une dalle sans donnée lisible n'est pas
   affichée. Le taux global est la moyenne simple des taux par référentiel (décision du RSSI du 28/10/2026, ADR 0069),
   affiché comme tel et distinct des taux par référentiel ; jamais une somme d'exigences de référentiels différents
   (ADR 0060). L'écran mural et le Pilotage gardent les cartes de Synthese.tsx. */
import { ActionIcon, Button, Drawer, Group, SegmentedControl, Table, TextInput, Tooltip } from '@mantine/core';
import {
  cleDalle,
  completerDisposition,
  dallesAffichees,
  dispositionStandard,
  hauteurDalle,
  visualisationDalle,
  type ChiffresPublics,
  type Disposition,
  type Incident,
  type IdDalle,
  type ReglagesDalle,
  type Synthese,
} from '@suivi/shared';
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
  type TeinteGraphique,
  type TeinteSeuil,
} from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { get } from '../api';
import { useCan } from '../session';
import type { EvenementNeon } from './neon-donnees';
import { fmtJour, TEINTE_ECART } from './Synthese';
import { agregerIncidents, dallesNeon, type DonneesNeon } from './tdb-neon';
import type { DalleTableauDeBord, RenduDalle } from './tdb-types';

export type { DalleTableauDeBord } from './tdb-types';

/** Jours restants avant l'audit : rouge sous 30 jours, orange sous 60, vert au-delà. */
const SEUILS_JOURS: Seuils = {
  base: 'rouge',
  paliers: [
    { des: 30, teinte: 'orange' },
    { des: 60, teinte: 'vert' },
  ],
};
const JOUR_MS = 86_400_000;

/** Seuils d'une dalle (lot 2c) : rouge en dessous du seuil orange, orange puis vert à partir de leurs seuils ; sans
    réglage, les seuils standard. */
export const seuilsRegles = (r: { orange: number; vert: number } | undefined, standard: Seuils): Seuils =>
  r
    ? {
        base: 'rouge',
        paliers: [
          { des: r.orange, teinte: 'orange' },
          { des: r.vert, teinte: 'vert' },
        ],
      }
    : standard;

/** Teintes successives d'une répartition sans teinte métier (anneau, histogramme). */
const TEINTES_REPARTITION: readonly TeinteGraphique[] = ['bleu', 'violet', 'vert', 'orange', 'gris', 'rouge'];

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

/** Carte phare : le prochain audit, avec son compte à rebours, puis le taux de conformité global (moyenne des
    référentiels). */
function ContenuPhare({
  s,
  global,
  reglages,
}: {
  s: Synthese;
  global: ReturnType<typeof tauxGlobal>;
  reglages?: ReglagesDalle;
}) {
  const seuilsJours = seuilsRegles(reglages?.seuilsJours, SEUILS_JOURS);
  const seuilsTaux = seuilsRegles(reglages?.seuils, SEUILS_TAUX);
  const audit = s.prochainAudit;
  const jours = audit ? joursAvant(audit.date, s.genereLe) : null;
  return (
    <>
      <span className="tdb-phare-symbole" aria-hidden="true">
        <IconeAdministration />
      </span>
      <div className="tdb-phare-bloc">
        <p className="tdb-phare-titre">Prochain audit</p>
        {audit ? (
          <>
            <p className="tdb-phare-valeur chiffres">
              {fmtJour(audit.date)}
              {jours != null && (
                // Compte à rebours : change chaque jour, masqué comme les dates dans les captures de référence.
                <span className={`tdb-puce horodatage tdb-p-${jours >= 0 ? teinteSeuil(seuilsJours, jours) : 'gris'}`}>
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
          <p className="tdb-phare-titre">Taux de conformité global</p>
          <p className="tdb-phare-valeur chiffres">
            {fmtTaux(global.pourcent)}
            <span className={`tdb-puce tdb-p-${teinteSeuil(seuilsTaux, global.pourcent)}`}>
              Moyenne des référentiels
            </span>
          </p>
          <p className="tdb-phare-detail">
            {`Moyenne simple des taux de ${pluriel(global.referentiels, 'référentiel', 'référentiels')} · chaque référentiel compte autant`}
          </p>
          <p className="tdb-phare-legende">Déclaration interne, non certifiée</p>
        </div>
      )}
    </>
  );
}

/** Répartition d'éléments par catégorie, dans la visualisation choisie (barres horizontales par défaut). */
function VueRepartition({
  titre,
  lignes,
  visualisation,
  teinte = 'bleu',
  centre,
  sousCentre,
}: {
  titre: string;
  lignes: readonly { libelle: string; valeur: number; teinte?: TeinteGraphique }[];
  visualisation: string | null;
  teinte?: TeinteSeuil;
  centre?: string;
  sousCentre?: string;
}) {
  const total = lignes.reduce((x, l) => x + l.valeur, 0);
  const teinteDe = (l: (typeof lignes)[number], i: number) =>
    l.teinte ?? TEINTES_REPARTITION[i % TEINTES_REPARTITION.length]!;
  if (visualisation === 'anneau')
    return (
      <Anneau
        titre={titre}
        parts={lignes.map((l, i) => ({ libelle: l.libelle, valeur: l.valeur, teinte: teinteDe(l, i) }))}
        centre={centre ?? String(total)}
        sousCentre={sousCentre ?? 'au total'}
      />
    );
  if (visualisation === 'histogramme')
    return (
      <Histogramme
        titre={titre}
        categories={lignes.map((l) => ({ libelle: l.libelle, valeurs: { n: l.valeur } }))}
        series={[{ cle: 'n', libelle: 'Nombre', teinte: teinte === 'bleu' || teinte === 'vert' ? teinte : 'bleu' }]}
      />
    );
  return (
    <BarresHorizontales
      titre={titre}
      lignes={lignes.map((l) => ({ libelle: l.libelle, valeur: l.valeur, max: total, texte: String(l.valeur) }))}
      teinte={teinte}
    />
  );
}

/** Répartition d'une dalle d'écarts : catégories triées, de la plus fréquente à la plus rare. */
function Repartition({
  titre,
  valeurs,
  visualisation,
}: {
  titre: string;
  valeurs: Record<string, number>;
  visualisation: string | null;
}) {
  const lignes = Object.entries(valeurs).sort((a, b) => b[1] - a[1]);
  return (
    <VueRepartition
      titre={titre}
      lignes={lignes.map(([libelle, valeur]) => ({ libelle, valeur }))}
      visualisation={visualisation}
    />
  );
}
const totalDe = (valeurs: Record<string, number>) => Object.values(valeurs).reduce((s, n) => s + n, 0);

/** Tableau de valeurs d'une dalle (visualisation « Tableau », lot 2c) : en-têtes de colonnes, une ligne par catégorie. */
function TableauDalle({
  titre,
  colonnes,
  lignes,
}: {
  titre: string;
  colonnes: readonly string[];
  lignes: readonly { cle: string; cellules: readonly ReactNode[] }[];
}) {
  return (
    <div className="table-wrap">
      <Table className="tdb-tableau" aria-label={titre}>
        <Table.Thead>
          <Table.Tr>
            {colonnes.map((c, i) => (
              <Table.Th key={c} scope="col" className={i ? 'tdb-tableau-nombre' : undefined}>
                {c}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lignes.map((l) => (
            <Table.Tr key={l.cle}>
              {l.cellules.map((c, i) =>
                i ? (
                  <Table.Td key={i} className="tdb-tableau-nombre chiffres">
                    {c}
                  </Table.Td>
                ) : (
                  <Table.Th key={i} scope="row">
                    {c}
                  </Table.Th>
                ),
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

/** Taux d'une jauge ou d'un chiffre clé (indicateurs, actions des écarts) selon la visualisation et les seuils. */
function TauxDalle({
  libelle,
  valeur,
  max,
  detail,
  reglages,
  id,
}: {
  libelle: string;
  valeur: number;
  max: number;
  detail: string;
  reglages?: ReglagesDalle;
  id: IdDalle;
}) {
  const seuils = seuilsRegles(reglages?.seuils, SEUILS_TAUX);
  if (visualisationDalle(id, reglages) === 'chiffre') {
    const p = Math.min(100, (valeur * 100) / max);
    return (
      <ChiffreCle
        valeur={fmtTaux(p)}
        teinte={teinteSeuil(seuils, p)}
        detail={detail}
        legende={reglages?.cible !== undefined ? `Cible : ${fmtTaux(reglages.cible)}` : undefined}
      />
    );
  }
  return (
    <JaugeArc libelle={libelle} valeur={valeur} max={max} seuils={seuils} cible={reglages?.cible} detail={detail} />
  );
}

function Echeances({ s }: { s: Synthese }) {
  return s.echeances.length ? (
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
  );
}

/** Dalle classique au cadre commun du tableau de bord (titre, sous-titre, commande de détail, largeur, hauteur). */
function cadre(p: RenduDalle, titre: string, sousTitre: string | undefined, contenu: ReactNode, className?: string) {
  return (
    <Dalle
      titre={titre}
      sousTitre={sousTitre}
      largeur={p.largeur}
      hauteur={p.hauteur}
      action={p.action}
      className={className}
    >
      {contenu}
    </Dalle>
  );
}

/** Données des cartes de la vue analytique qui ne viennent pas de la synthèse : aucune, sans requête (tests, écran sans
    droits). */
const SANS_DONNEES_NEON: DonneesNeon = {
  incidents: { lisible: false, pending: false, error: null },
  journal: { lisible: false, pending: false, error: null },
  portee: 'global',
};

/** Dalles disponibles pour cette synthèse et ces droits : celles du tableau personnalisable (ADR 0069, lot 1), puis les
    cartes de la vue analytique (ADR 0108). */
export function dallesTableauDeBord(s: Synthese, donnees: DonneesNeon = SANS_DONNEES_NEON): DalleTableauDeBord[] {
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
  const titrePhare = global ? 'Prochain audit et taux de conformité global' : 'Prochain audit';
  const dalles: (DalleTableauDeBord | false | null | undefined)[] = [
    {
      id: 'phare',
      titre: titrePhare,
      description: 'Date du prochain audit, compte à rebours et taux de conformité global',
      groupe: 'Pilotage',
      largeur: 6,
      route: '/pilotage/audits',
      droit: ['plan_audit', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          titrePhare,
          'Audit de certification · moyenne des référentiels',
          <ContenuPhare s={s} global={global} reglages={p.reglages} />,
          'tdb-phare',
        ),
    },
    e && {
      id: 'ecarts',
      titre: 'Écarts',
      description: 'Écarts ouverts, en retard, à échéance proche et au total',
      groupe: 'Écarts et actions',
      largeur: 3,
      route: '/pilotage/amelioration',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Écarts',
          'Écarts · tous périmètres lisibles',
          <GrilleChiffres
            chiffres={[
              { valeur: e.ouverts, libelle: 'ouverts' },
              { valeur: e.enRetard, libelle: 'en retard', teinte: e.enRetard ? 'rouge' : 'vert' },
              { valeur: e.aEcheance, libelle: 'à échéance proche', teinte: e.aEcheance ? 'orange' : 'vert' },
              { valeur: e.total, libelle: 'au total' },
            ]}
          />,
        ),
    },
    a && {
      id: 'actions-retard',
      titre: 'Actions en retard',
      description: 'Nombre d’actions en retard sur les actions ouvertes',
      groupe: 'Écarts et actions',
      largeur: 3,
      route: '/pilotage/actions',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Actions en retard',
          'Actions · tous périmètres lisibles',
          <ChiffreCle
            valeur={String(a.enRetard)}
            teinte={a.enRetard ? 'rouge' : 'vert'}
            detail={`sur ${pluriel(a.ouvertes, 'action ouverte', 'actions ouvertes')}`}
            legende={pluriel(a.terminees, 'action terminée', 'actions terminées')}
          />,
        ),
    },
    refs.length > 0 && {
      id: 'conformite-referentiels',
      titre: 'Taux de conformité par référentiel',
      description: 'Taux de chaque référentiel, en barres ou en tableau, avec seuils et cible',
      groupe: 'Conformité',
      largeur: 6,
      route: '/pilotage/mesures',
      droit: ['audit', 'lire'],
      rendu: (p) => {
        const rg = p.reglages;
        const seuils = seuilsRegles(rg?.seuils, SEUILS_TAUX);
        // Une cible réglée remplace le trait du taux global (moyenne des référentiels).
        const cible = rg?.cible ?? global?.pourcent;
        return cadre(
          p,
          'Taux de conformité par référentiel',
          'Exigences applicables mises en œuvre totalement, référentiel par référentiel',
          <>
            {visualisationDalle('conformite-referentiels', rg) === 'tableau' ? (
              <TableauDalle
                titre="Taux de conformité par référentiel"
                colonnes={['Référentiel', 'Mises en œuvre', 'Applicables', 'Taux']}
                lignes={refs.map((x) => {
                  const pc = (x.total * 100) / x.applicables;
                  return {
                    cle: x.libelle,
                    cellules: [
                      x.libelle,
                      x.total,
                      x.applicables,
                      <span key="t" className={`tdb-puce tdb-p-${teinteSeuil(seuils, pc)}`}>
                        {fmtTaux(pc)}
                      </span>,
                    ],
                  };
                })}
              />
            ) : (
              <BarresHorizontales
                titre="Taux de conformité par référentiel"
                lignes={refs.map((x) => ({ libelle: x.libelle, valeur: x.total, max: x.applicables }))}
                seuils={seuils}
                cible={cible}
              />
            )}
            {rg?.cible !== undefined ? (
              <Note>{`Cible : ${fmtTaux(rg.cible)}${global ? ` · taux global, moyenne des référentiels : ${fmtTaux(global.pourcent)}` : ''}.`}</Note>
            ) : (
              global && (
                <Note>{`Trait violet : taux global, moyenne des référentiels (${fmtTaux(global.pourcent)}).`}</Note>
              )
            )}
            <Note>{AVERTISSEMENT}</Note>
          </>,
        );
      },
    },
    i &&
      i.total > 0 && {
        id: 'indicateurs',
        titre: 'Indicateurs atteints',
        description: 'Part des indicateurs atteints, en jauge ou en chiffre clé',
        groupe: 'Pilotage',
        largeur: largeurJauge,
        route: '/pilotage/indicateurs',
        droit: ['pilotage', 'lire'],
        rendu: (p) =>
          cadre(
            p,
            'Indicateurs atteints',
            'Objectifs et indicateurs',
            <TauxDalle
              id="indicateurs"
              libelle="Indicateurs atteints"
              valeur={i.atteints}
              max={i.total}
              detail={`${i.atteints}/${i.total} atteints · ${i.nonAtteints} non atteints · ${i.nonMesures} non mesurés`}
              reglages={p.reglages}
            />,
          ),
      },
    eo &&
      eo.actionsTotal > 0 && {
        id: 'actions-ecarts',
        titre: 'Actions des écarts réalisées',
        description: 'Part des actions des écarts réalisées, en jauge ou en chiffre clé',
        groupe: 'Écarts et actions',
        largeur: largeurJauge,
        route: '/pilotage/amelioration',
        droit: ['ecarts', 'lire'],
        rendu: (p) =>
          cadre(
            p,
            'Actions des écarts réalisées',
            'Écarts · plans d’action',
            <TauxDalle
              id="actions-ecarts"
              libelle="Actions des écarts réalisées"
              valeur={eo.actionsRealisees}
              max={eo.actionsTotal}
              detail={`${eo.actionsRealisees}/${eo.actionsTotal} actions réalisées`}
              reglages={p.reglages}
            />,
          ),
      },
    refs.length > 0 && {
      id: 'mise-en-oeuvre',
      titre: 'Niveau de mise en œuvre des exigences',
      description: 'Total, partiel, insuffisant et non renseigné, par référentiel',
      groupe: 'Conformité',
      largeur: 6,
      route: '/pilotage/applicabilite',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Niveau de mise en œuvre des exigences',
          'Applicabilité · par référentiel',
          visualisationDalle('mise-en-oeuvre', p.reglages) === 'tableau' ? (
            <TableauDalle
              titre="Niveau de mise en œuvre des exigences applicables, par référentiel"
              colonnes={['Référentiel', 'Total', 'Partiel', 'Insuffisant', 'Non renseigné']}
              lignes={refs.map((x) => ({
                cle: x.libelle,
                cellules: [x.libelle, x.total, x.partiel, x.insuffisant, x.nonRenseigne],
              }))}
            />
          ) : (
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
          ),
        ),
    },
    eo && {
      id: 'ecarts-type',
      titre: 'Écarts ouverts par type',
      description: 'Écarts ouverts par type, en anneau, barres ou histogramme',
      groupe: 'Écarts et actions',
      largeur: 6,
      route: '/pilotage/amelioration',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Écarts ouverts par type',
          'Écarts · classification',
          <VueRepartition
            titre="Écarts ouverts par type"
            lignes={eo.parType
              .filter((t) => t.n || t.type)
              .map((t) => ({ libelle: t.libelle, valeur: t.n, teinte: TEINTE_ECART[t.type] ?? 'gris' }))}
            visualisation={visualisationDalle('ecarts-type', p.reglages)}
            centre={String(eo.ouverts)}
            sousCentre="ouverts"
          />,
        ),
    },
    {
      id: 'echeances',
      titre: 'Prochaines échéances',
      description: 'Écarts et actions à traiter, par date d’échéance',
      groupe: 'Écarts et actions',
      largeur: 6,
      route: '/pilotage/actions',
      droit: ['ecarts', 'lire'],
      rendu: (p) => cadre(p, 'Prochaines échéances', 'Écarts et actions à traiter', <Echeances s={s} />),
    },
    (r || c || s.incidents) && {
      id: 'risques-continuite',
      titre: 'Risques et continuité',
      description: 'Risques, appréciations, revues, plans de continuité et incidents ouverts',
      groupe: 'Risques et incidents',
      largeur: 3,
      route: '/pilotage/risques',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Risques et continuité',
          'Risques · continuité d’activité',
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
            {c && <ChiffreCle valeur={String(c.plans)} detail="plans de continuité et de reprise" />}
            {s.incidents && (
              <ChiffreCle
                valeur={String(s.incidents.ouverts)}
                teinte={s.incidents.securiteOuverts ? 'orange' : 'vert'}
                detail="incidents ouverts"
              />
            )}
          </div>,
        ),
    },
    s.recurrences && {
      id: 'recurrences',
      titre: 'Tâches récurrentes en retard',
      description: 'Occurrences en retard des revues et contrôles récurrents',
      groupe: 'Pilotage',
      largeur: 3,
      route: '/pilotage/recurrences',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Tâches récurrentes en retard',
          'Tâches récurrentes · revues, contrôles',
          <ChiffreCle
            valeur={String(s.recurrences!.occurrencesEnRetard)}
            teinte={s.recurrences!.occurrencesEnRetard ? 'rouge' : 'vert'}
            detail={`sur ${pluriel(s.recurrences!.occurrencesOuvertes, 'occurrence ouverte', 'occurrences ouvertes')}`}
            legende={pluriel(s.recurrences!.series, 'série active', 'séries actives')}
          />,
        ),
    },
    s.plans && {
      id: 'plans',
      titre: `Plans du SMSI ${s.plans.annee}`,
      description: 'Actions des plans de l’année par type et par état, en histogramme',
      groupe: 'Pilotage',
      largeur: 4,
      route: '/pilotage/plans-calendrier',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          `Plans du SMSI ${s.plans!.annee}`,
          'Actions des plans par type et par état',
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
          />,
        ),
    },
    mesures && {
      id: 'mesures',
      titre: 'Mesures suivies',
      description: 'Mesures suivies par référentiel, en barres, anneau ou histogramme',
      groupe: 'Conformité',
      largeur: 4,
      route: '/pilotage/mesures',
      droit: ['pilotage', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Mesures suivies',
          `${pluriel(s.mesures!.total, 'mesure', 'mesures')} · applicabilité par référentiel`,
          <VueRepartition
            titre="Mesures suivies par référentiel"
            lignes={Object.entries(mesures)
              .sort((x, y) => y[1] - x[1])
              .map(([libelle, valeur]) => ({ libelle, valeur }))}
            visualisation={visualisationDalle('mesures', p.reglages)}
            teinte="vert"
          />,
        ),
    },
    s.plan && {
      id: 'plan-audit',
      titre: 'Plan d’audit',
      description: 'Journées du plan d’audit et nombre de créneaux',
      groupe: 'Conformité',
      largeur: 4,
      route: '/pilotage/audit-planning',
      droit: ['plan_audit', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Plan d’audit',
          `Statut : ${s.plan!.statut || 'non renseigné'}`,
          s.plan!.jours.length ? (
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
          ),
        ),
    },
    e && {
      id: 'ecarts-statut',
      titre: 'Écarts par statut',
      description: 'Écarts par statut, en barres, anneau ou histogramme',
      groupe: 'Écarts et actions',
      largeur: 4,
      route: '/pilotage/amelioration',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Écarts par statut',
          pluriel(totalDe(e.parStatut), 'élément', 'éléments'),
          <Repartition
            titre="Écarts par statut"
            valeurs={e.parStatut}
            visualisation={visualisationDalle('ecarts-statut', p.reglages)}
          />,
        ),
    },
    e && {
      id: 'ecarts-classification',
      titre: 'Écarts par classification',
      description: 'Écarts par classification, en barres, anneau ou histogramme',
      groupe: 'Écarts et actions',
      largeur: 4,
      route: '/pilotage/amelioration',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Écarts par classification',
          pluriel(totalDe(e.parType), 'élément', 'éléments'),
          <Repartition
            titre="Écarts par classification"
            valeurs={e.parType}
            visualisation={visualisationDalle('ecarts-classification', p.reglages)}
          />,
        ),
    },
    e && {
      id: 'ecarts-source',
      titre: 'Écarts par audit à l’origine',
      description: 'Écarts par audit à l’origine, en barres, anneau ou histogramme',
      groupe: 'Écarts et actions',
      largeur: 4,
      route: '/pilotage/amelioration',
      droit: ['ecarts', 'lire'],
      rendu: (p) =>
        cadre(
          p,
          'Écarts par audit à l’origine',
          pluriel(totalDe(e.parSource), 'élément', 'éléments'),
          <Repartition
            titre="Écarts par audit à l’origine"
            valeurs={e.parSource}
            visualisation={visualisationDalle('ecarts-source', p.reglages)}
          />,
        ),
    },
  ];
  return [...dalles.filter((x): x is DalleTableauDeBord => !!x), ...dallesNeon(s, donnees, tauxGlobal)];
}

/** Données des cartes de la vue analytique chargées hors de la synthèse (incidents, journal d'audit), selon les droits,
    et dalles disponibles pour la personne. Avec les chiffres ouverts d'un auteur (ADR 0109), les incidents sont les
    siens, agrégés par le serveur ; le journal reste toujours celui que la personne a le droit de lire. */
export function useDallesTableauDeBord(
  s: Synthese,
  portee = 'global',
  ouverts: ChiffresPublics | null = null,
): DalleTableauDeBord[] {
  const can = useCan();
  const lireIncidents = can('incidents', 'lire') && !ouverts;
  const lireJournal = can('administration', 'lire');
  const incidents = useQuery({
    queryKey: ['incidents'],
    queryFn: () => get<{ incidents: Incident[] }>('/api/incidents'),
    enabled: lireIncidents,
  });
  const journal = useQuery({
    queryKey: ['admin', 'audit', 'neon'],
    queryFn: () => get<EvenementNeon[]>('/api/admin/audit?limit=500'),
    enabled: lireJournal,
  });
  const agregats = ouverts?.incidents
    ? {
        total: ouverts.incidents.total,
        enCours: ouverts.incidents.enCours,
        clos: ouverts.incidents.clos,
        parMois: ouverts.incidents.parMois.map((m) => ({ libelle: m.mois, valeur: m.n })),
      }
    : incidents.data
      ? agregerIncidents(incidents.data.incidents)
      : undefined;
  return dallesTableauDeBord(s, {
    incidents: {
      lisible: lireIncidents || !!ouverts?.incidents,
      data: agregats,
      pending: lireIncidents && incidents.isPending,
      error: incidents.error,
    },
    journal: { lisible: lireJournal, data: journal.data, pending: journal.isPending, error: journal.error },
    portee,
  });
}

/** Synthèse d'un tableau aux chiffres ouverts (ADR 0109) : les nombres de l'auteur (liste blanche reçue du serveur) ; les
    listes nommées (échéances, journées du plan d'audit, intitulé du prochain audit) restent celles de la personne qui
    regarde, ou vides sans droit. */
export function syntheseOuverte(c: ChiffresPublics, propre: Synthese | undefined, organisation: string): Synthese {
  return {
    organisation: propre?.organisation ?? organisation,
    genereLe: c.genereLe,
    prochainAudit: c.prochainAudit
      ? {
          date: c.prochainAudit.date,
          annee: propre?.prochainAudit?.date === c.prochainAudit.date ? propre.prochainAudit.annee : null,
          libelle: propre?.prochainAudit?.date === c.prochainAudit.date ? propre.prochainAudit.libelle : '',
        }
      : null,
    auditInterne: c.auditInterne,
    ecarts: c.ecarts,
    echeances: propre?.echeances ?? [],
    plan: propre?.plan ?? null,
    mesures: c.mesures,
    conformite: c.conformite,
    ecartsOuverts: c.ecartsOuverts,
    indicateurs: c.indicateurs,
    plans: c.plans,
    actions: c.actions,
    recurrences: c.recurrences,
    risques: c.risques,
    continuite: c.continuite,
    incidents: c.incidents
      ? { total: c.incidents.total, ouverts: c.incidents.ouverts, securiteOuverts: c.incidents.securiteOuverts }
      : null,
    pilotage: null,
  };
}

/** Dalle placée : sa définition, sa clé (copies comprises), sa largeur, sa hauteur et ses réglages. */
export interface DallePlacee {
  dalle: DalleTableauDeBord;
  cle: string;
  largeur: LargeurDalle;
  hauteur: number;
  reglages?: ReglagesDalle;
}

/** Dalles affichées : selon la disposition enregistrée (ADR 0078), sinon selon la disposition standard, celle de la vue
    analytique (ADR 0108). */
export function dallesDisposees(dalles: DalleTableauDeBord[], disposition: Disposition | null): DallePlacee[] {
  const parId = new Map(dalles.map((x) => [x.id, x]));
  const complete = disposition
    ? completerDisposition(
        disposition,
        Object.fromEntries(dalles.map((x) => [x.id, x.largeur])) as Partial<Record<IdDalle, LargeurDalle>>,
      )
    : dispositionStandard();
  return dallesAffichees(complete, new Set(parId.keys())).map((x) => ({
    dalle: parId.get(x.id)!,
    cle: cleDalle(x),
    largeur: x.largeur,
    hauteur: hauteurDalle(x),
    reglages: x.reglages,
  }));
}

function IconeLoupe() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.4 10.4 14 14" />
    </svg>
  );
}
function IconeExport() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M8 10V2M4.8 5.2 8 2l3.2 3.2" />
      <path d="M2.5 9.5v3a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </svg>
  );
}

/** Bouton de détail d'une dalle (flèche oblique), comme sur les cartes de la vue analytique. */
export function BoutonDetail({ titre, onClick }: { titre: string; onClick: () => void }) {
  return (
    <button type="button" className="na-detail" onClick={onClick} aria-label={`Détail : ${titre}`}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

/** Tableau de bord de l'accueil en lecture : en-tête de la vue analytique (recherche, exports, référentiels), grille des
    dalles dans la disposition affichée, détail d'une dalle dans un panneau latéral. */
export function TableauDeBordConformite({
  s,
  disposition = null,
  ouverts = null,
  outils = null,
}: {
  s: Synthese;
  disposition?: Disposition | null;
  /** Chiffres ouverts de l'auteur du tableau affiché (ADR 0109) ; `s` est alors leur synthèse (`syntheseOuverte`). */
  ouverts?: ChiffresPublics | null;
  /** Commandes placées en tête de la barre d'outils (« + » des tableaux de bord). */
  outils?: ReactNode;
}) {
  const can = useCan();
  const [recherche, setRecherche] = useState('');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [portee, setPortee] = useState('global');
  const [detail, setDetail] = useState<string | null>(null);
  const placees = dallesDisposees(useDallesTableauDeBord(s, portee, ouverts), disposition);
  const filtre = recherche.trim().toLocaleLowerCase();
  const visibles = filtre
    ? placees.filter((x) => `${x.dalle.titre} ${x.dalle.description}`.toLocaleLowerCase().includes(filtre))
    : placees;
  const selection = placees.find((x) => x.cle === detail);
  return (
    <div className="tdb">
      <div className="na-entete">
        <div>
          <h2>Vue d’ensemble · Gouvernance, risque et conformité</h2>
          <p>
            {placees.length} visualisations · données de l’application · situation au{' '}
            <span className="horodatage">{new Date(s.genereLe).toLocaleDateString('fr-FR')}</span>
          </p>
        </div>
        <Group gap="xs" className="tdb-outils">
          {outils}
          {rechercheOuverte || recherche ? (
            <TextInput
              aria-label="Rechercher une dalle"
              placeholder="Rechercher une dalle"
              className="tdb-recherche"
              autoFocus={rechercheOuverte}
              leftSection={<IconeLoupe />}
              value={recherche}
              onChange={(e) => setRecherche(e.currentTarget.value)}
              onBlur={() => setRechercheOuverte(false)}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                setRecherche('');
                setRechercheOuverte(false);
              }}
            />
          ) : (
            <Tooltip label="Rechercher une dalle" withArrow>
              <ActionIcon
                variant="default"
                size="lg"
                className="tdb-outil"
                aria-label="Rechercher une dalle"
                onClick={() => setRechercheOuverte(true)}
              >
                <IconeLoupe />
              </ActionIcon>
            </Tooltip>
          )}
          {can('import_export', 'lire') && (
            <Tooltip label="Exports" withArrow>
              <ActionIcon
                component={Link}
                to="/exports"
                variant="filled"
                size="lg"
                className="tdb-outil"
                aria-label="Exports"
              >
                <IconeExport />
              </ActionIcon>
            </Tooltip>
          )}
          <SegmentedControl
            aria-label="Référentiels affichés"
            value={portee}
            onChange={setPortee}
            data={[
              { value: 'global', label: 'Global' },
              { value: 'iso', label: 'ISO' },
              { value: 'hds', label: 'HDS' },
            ]}
          />
        </Group>
      </div>
      <div className="grille-cartes tdb-grille">
        {visibles.map((x) => (
          <Fragment key={x.cle}>
            {x.dalle.rendu({
              largeur: x.largeur,
              hauteur: x.hauteur,
              reglages: x.reglages,
              action: <BoutonDetail titre={x.dalle.titre} onClick={() => setDetail(x.cle)} />,
            })}
          </Fragment>
        ))}
      </div>
      {filtre && visibles.length === 0 && <p className="graph-vide">Aucune dalle ne correspond à cette recherche.</p>}
      <Drawer
        opened={!!selection}
        onClose={() => setDetail(null)}
        title={selection?.dalle.titre}
        position="right"
        size="lg"
      >
        {selection && (
          <div className="na-detail-contenu">
            {selection.dalle.rendu({ largeur: 12, reglages: selection.reglages })}
            <Button
              component={Link}
              to={selection.dalle.route}
              onClick={() => setDetail(null)}
              disabled={!can(...selection.dalle.droit)}
            >
              Ouvrir le registre
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
