/* Module Vulnérabilités (ADR 0100, point 18 ; lot PC1) : « Vue d'ensemble », premier onglet du module, dans l'esprit d'un
   poste de commandement (V8), d'après la maquette 01-vue de docs/unification/maquettes-vulnerabilites. Niveau d'alerte de 1
   à 4, tuiles, radar « Situation tactique » (chaque point est une faille suivie réelle, placée par radar.ts), cible
   prioritaire, journal des traces existantes, tableau « Cibles par priorité » (équivalent accessible du radar) et capteurs
   (sources de veille d'un côté, connecteurs de l'autre). Sous la CSP stricte (ADR 0006) : aucun style en ligne ; positions
   par attributs SVG ; couleurs, traits et animations par les classes de packages/ui/src/neon-commandement.css (jetons de la
   charte, clair et sombre ; animations coupées par le mouvement réduit et à l'impression). Les nombres de machines et
   d'actifs sont ceux que la personne lit ; priorités et niveau sont les mêmes pour tout le monde (calculés par le serveur). */
import { Alert, Anchor, Modal, Pagination, SegmentedControl, Stack, Table, Text, VisuallyHidden } from '@mantine/core';
import {
  type AlerteVulnerabiliteDto,
  type CibleVueDto,
  type ConstatDto,
  ETAT_SUIVI_LIBELLES,
  type EtatSourceVeilleDto,
  type EtatSurfaceExterneDto,
  type EtatSynchronisationDto,
  type EtatVeilleDto,
  type FicheDeclareeDto,
  NIVEAU_ALERTE_GLOBAL_LIBELLES,
  NIVEAUX_ALERTE_GLOBAL,
  NIVEAUX_PRIORITE,
  type PageAlertesVulnerabilites,
  type ProduitSurveilleDto,
  REGLE_NIVEAU_ALERTE_GLOBAL,
  SECTEUR_RADAR_LIBELLES,
  SECTEURS_RADAR,
  type VueEnsembleDto,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import { CLE_ALERTES, lienFicheAlerte, urlAlertes } from './alertes';
import { FicheConstat, FicheDeclaree } from './FaillesDetectees';
import { FicheFaille } from './FicheFaille';
import { ANNEAUX, disposerRadar, libelleEpss, libelleTouches, RAYON, type SceneRadar, VUE } from './radar';
import { SuiviFaille } from './SuiviFaille';
import { etatSource } from './veille';
import {
  type CaseChoisie,
  CIBLES_PAR_PAGE,
  CLE_VUE,
  deuxChiffres,
  etatConnecteur,
  faitsCible,
  FILTRE_CIBLES_LIBELLES,
  FILTRES_CIBLES,
  type FiltreCibles,
  filtrerCibles,
  libelleCase,
  LIENS_TUILES,
  ligneJournal,
  ouvertureCible,
  TEINTE_NIVEAU,
  TEINTE_PRIORITE,
  totauxSecteurs,
  URL_VUE,
} from './vue-ensemble';

type Ouverte = { nature: 'constat' | 'declaree'; id: string } | { nature: 'aucune'; cible: CibleVueDto } | null;

/* ------------------------------------------------------------------ Bandeau d'alerte critique (lot V6) */
export function BandeauAlerte({ alertes, total }: { alertes: AlerteVulnerabiliteDto[]; total: number }) {
  const a = alertes[0];
  if (!a || total < 1) return null;
  return (
    <div className="pc-bandeau" role="status">
      <svg viewBox="0 0 24 24" className="pc-bandeau__icone" aria-hidden="true">
        <path d="m12 3 10 18H2Zm0 5v6m0 3v1" />
      </svg>
      <p>
        <strong>
          {total > 1
            ? `${total} failles exploitées sont présentes chez nous (alertes critiques en cours).`
            : 'Une faille exploitée est présente chez nous (alerte critique en cours).'}
        </strong>{' '}
        {a.titre}
        {a.cve ? ` (${a.cve})` : ''}
        {a.machines.lisibles || a.machines.horsLecture
          ? ` : ${a.machines.lisibles} machine${a.machines.lisibles > 1 ? 's' : ''} que vous pouvez lire${a.machines.horsLecture ? ', et d’autres hors de vos droits' : ''}.`
          : '.'}
      </p>
      <Anchor component={Link} to={lienFicheAlerte(a.id)} className="pc-bandeau__lien">
        Ouvrir la fiche de l’alerte
      </Anchor>
    </div>
  );
}

/* ------------------------------------------------------------------ Niveau d'alerte et tuiles */
export function NiveauAlerteBloc({ niveau }: { niveau: VueEnsembleDto['niveau'] }) {
  const id = useId();
  return (
    <section className={`pc-niveau pc-teinte--${TEINTE_NIVEAU[niveau.niveau]}`} aria-labelledby={id}>
      <h2 className="pc-etiquette" id={id}>
        Niveau d’alerte
      </h2>
      <p className="pc-niveau__gros">
        <b>{niveau.niveau}</b>
        <span>/ 4</span>
      </p>
      <p className="pc-niveau__libelle">{niveau.libelle}</p>
      <p className="pc-niveau__explication">{niveau.explication}</p>
      <ol className="pc-jauge" aria-label="Échelle du niveau d’alerte">
        {NIVEAUX_ALERTE_GLOBAL.map((n) => (
          <li
            key={n}
            className={`pc-jauge__cran pc-teinte--${TEINTE_NIVEAU[n]}${n <= niveau.niveau ? ' pc-jauge__cran--atteint' : ''}`}
            aria-current={n === niveau.niveau ? 'step' : undefined}
          >
            <i aria-hidden="true" />
            <span>
              {n} {NIVEAU_ALERTE_GLOBAL_LIBELLES[n]}
            </span>
          </li>
        ))}
      </ol>
      <p className="pc-niveau__regle">{REGLE_NIVEAU_ALERTE_GLOBAL}</p>
    </section>
  );
}

export function Tuiles({ tuiles }: { tuiles: VueEnsembleDto['tuiles'] }) {
  return (
    <nav className="pc-tuiles" aria-label="Chiffres clés : listes filtrées">
      <Link to={LIENS_TUILES.exploitees} className="pc-tuile pc-teinte--rouge">
        <span className="pc-etiquette">Exploitées et présentes</span>
        <b>{deuxChiffres(tuiles.exploiteesPresentes)}</b>
      </Link>
      <div className="pc-tuile pc-tuile--double pc-teinte--orange">
        <span className="pc-etiquette">À traiter (P1 et P2)</span>
        <span className="pc-tuile__liens">
          <Link to={LIENS_TUILES.p1} aria-label={`P1 : ${tuiles.aTraiter.p1}`}>
            P1 <b>{deuxChiffres(tuiles.aTraiter.p1)}</b>
          </Link>
          <Link to={LIENS_TUILES.p2} aria-label={`P2 : ${tuiles.aTraiter.p2}`}>
            P2 <b>{deuxChiffres(tuiles.aTraiter.p2)}</b>
          </Link>
        </span>
      </div>
      <Link to={LIENS_TUILES.aConfirmer} className="pc-tuile pc-teinte--violet">
        <span className="pc-etiquette">
          Produits à confirmer
          <small>
            {tuiles.aConfirmer.failles} faille{tuiles.aConfirmer.failles > 1 ? 's' : ''}, {tuiles.aConfirmer.produits}{' '}
            produit{tuiles.aConfirmer.produits > 1 ? 's' : ''}
          </small>
        </span>
        <b>{deuxChiffres(tuiles.aConfirmer.failles)}</b>
      </Link>
      <Link to={LIENS_TUILES.corrigees} className="pc-tuile pc-teinte--vert">
        <span className="pc-etiquette">Corrigées ce mois</span>
        <b>{deuxChiffres(tuiles.corrigeesCeMois)}</b>
      </Link>
    </nav>
  );
}

export function Secteurs({ vue }: { vue: VueEnsembleDto }) {
  const id = useId();
  const lignes = totauxSecteurs(vue.cases, SECTEURS_RADAR);
  const max = Math.max(1, ...lignes.map((l) => l.total));
  return (
    <section className="pc-panneau" aria-labelledby={id}>
      <h2 className="pc-etiquette pc-panneau__titre" id={id}>
        <span>Failles par secteur</span>
        <span className="pc-mono">{deuxChiffres(vue.total)}</span>
      </h2>
      <ul className="pc-secteurs">
        {lignes.map((l) => (
          <li key={l.secteur}>
            <span>{l.libelle}</span>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="pc-secteurs__barre" aria-hidden="true">
              <rect x={0} y={0} width={100} height={4} className="pc-secteurs__fond" />
              <rect x={0} y={0} width={(l.total / max) * 100} height={4} className="pc-secteurs__plein" />
            </svg>
            <b className="pc-mono">{deuxChiffres(l.total)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ Radar « Situation tactique » */
function Graduations() {
  const traits: string[] = [];
  for (let d = 0; d < 360; d += 10) {
    const a = (d * Math.PI) / 180;
    const long = d % 30 === 0 ? 9 : 5;
    const x1 = RAYON * Math.sin(a),
      y1 = -RAYON * Math.cos(a);
    const x2 = (RAYON + long) * Math.sin(a),
      y2 = -(RAYON + long) * Math.cos(a);
    traits.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return <path d={traits.join('')} className="pc-r-graduation" />;
}

export function RadarTactique({
  scene,
  total,
  onPoint,
  onGroupe,
}: {
  scene: SceneRadar;
  total: number;
  onPoint: (c: CibleVueDto) => void;
  onGroupe: (c: CaseChoisie) => void;
}) {
  const aide = useId();
  const resume = useId();
  const [actif, setActif] = useState<string | null>(null);
  const noeuds = useRef(new Map<string, SVGGElement>());
  const courant = actif && scene.ordre.includes(actif) ? actif : (scene.ordre[0] ?? null);
  const points = new Map(scene.points.map((p) => [p.cle, p]));
  const groupes = new Map(scene.groupes.map((g) => [`groupe:${g.cle}`, g]));
  const activer = (cle: string) => {
    const p = points.get(cle);
    if (p) return onPoint(p.cible);
    const g = groupes.get(cle);
    if (g) onGroupe({ secteur: g.secteur, niveau: g.niveau });
  };
  const clavier = (cle: string) => (e: KeyboardEvent<SVGGElement>) => {
    const i = scene.ordre.indexOf(cle);
    let j: number | null = null;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activer(cle);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(scene.ordre.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = scene.ordre.length - 1;
    if (j === null) return;
    e.preventDefault();
    const suivant = scene.ordre[j]!;
    setActif(suivant);
    noeuds.current.get(suivant)?.focus();
  };
  const attacher = (cle: string) => (el: SVGGElement | null) => {
    if (el) noeuds.current.set(cle, el);
    else noeuds.current.delete(cle);
  };
  const etiquettes = new Map(scene.etiquettes.map((e) => [e.cle, e]));
  return (
    <div className="pc-ecran">
      <p className="pc-ecran__tete">
        <span>
          <b>Situation tactique</b> · {total} faille{total > 1 ? 's' : ''} suivie{total > 1 ? 's' : ''}
        </span>
        <span>
          {scene.points.length} affichée{scene.points.length > 1 ? 's' : ''} une à une
        </span>
      </p>
      <VisuallyHidden component="p" id={resume}>
        Radar des failles suivies : {scene.points.length} point{scene.points.length > 1 ? 's' : ''},{' '}
        {scene.groupes.length} pastille{scene.groupes.length > 1 ? 's' : ''} de regroupement. Distance au centre :
        priorité (P1 au centre, P4 au bord) ; secteur : famille du produit surveillé rapproché.
      </VisuallyHidden>
      <VisuallyHidden component="p" id={aide}>
        Flèches : point suivant ou précédent, du plus prioritaire au moins prioritaire ; Début et Fin ; Entrée : ouvrir
        la fiche, ou la liste d’une pastille. Le tableau « Cibles par priorité » porte les mêmes failles.
      </VisuallyHidden>
      <div className="pc-radar-cadre">
        <svg
          viewBox={`${VUE.x} ${VUE.y} ${VUE.l} ${VUE.h}`}
          className="pc-radar"
          role="group"
          aria-label="Radar des failles suivies"
          aria-describedby={`${resume} ${aide}`}
        >
          <g aria-hidden="true">
            <circle r={RAYON} className="pc-r-fond" />
            <circle r={ANNEAUX.P1[1]} className="pc-r-coeur" />
            {NIVEAUX_PRIORITE.map((n) => (
              <circle
                key={n}
                r={ANNEAUX[n][1]}
                className={n === 'P4' ? 'pc-r-anneau pc-r-anneau--bord' : 'pc-r-anneau'}
              />
            ))}
            <Graduations />
            {scene.secteurs.map((s) => (
              <path key={s.secteur} d={`M0 0L${s.bord.x} ${s.bord.y}`} className="pc-r-rayon" />
            ))}
            <g className="pc-balayage">
              <circle r={RAYON} className="pc-r-invisible" />
              <path
                d={`M0 0L0 ${-RAYON}A${RAYON} ${RAYON} 0 0 1 ${(RAYON * Math.sin(0.6)).toFixed(1)} ${(-RAYON * Math.cos(0.6)).toFixed(1)}Z`}
                className="pc-balayage__secteur"
              />
              <path
                d={`M0 0L${(RAYON * Math.sin(0.6)).toFixed(1)} ${(-RAYON * Math.cos(0.6)).toFixed(1)}`}
                className="pc-balayage__trait"
              />
            </g>
            {NIVEAUX_PRIORITE.map((n) => (
              <text key={n} x={4} y={-ANNEAUX[n][1] + 11} fontSize={9} className="pc-r-anneau-nom">
                {n}
              </text>
            ))}
            {scene.secteurs.map((s) => (
              <text key={s.secteur} x={s.x} y={s.y} textAnchor={s.ancre} fontSize={11} className="pc-r-secteur">
                {s.libelle} · {s.total}
              </text>
            ))}
          </g>
          {scene.points.map((p) => (
            <g
              key={p.cle}
              ref={attacher(p.cle)}
              role="button"
              tabIndex={p.cle === courant ? 0 : -1}
              aria-label={p.nom}
              className={`pc-point pc-p--${p.niveau}`}
              onClick={() => activer(p.cle)}
              onKeyDown={clavier(p.cle)}
              onFocus={() => setActif(p.cle)}
            >
              <title>{p.nom}</title>
              {p.exploitee && <circle cx={p.x} cy={p.y} r={p.r + 3} className="pc-halo" />}
              <circle cx={p.x} cy={p.y} r={p.r} className={p.aConfirmer ? 'pc-noyau pc-noyau--vide' : 'pc-noyau'} />
              <circle cx={p.x} cy={p.y} r={Math.max(p.r + 2, 7)} className="pc-zone" />
            </g>
          ))}
          {scene.groupes.map((g) => {
            const cle = `groupe:${g.cle}`;
            const texte = `+${g.nombre}`;
            const l = Math.max(17, texte.length * 5.4 + 6);
            return (
              <g
                key={cle}
                ref={attacher(cle)}
                role="button"
                tabIndex={cle === courant ? 0 : -1}
                aria-label={g.nom}
                className={`pc-point pc-groupe pc-p--${g.niveau}`}
                onClick={() => activer(cle)}
                onKeyDown={clavier(cle)}
                onFocus={() => setActif(cle)}
              >
                <title>{g.nom}</title>
                <rect x={g.x - l / 2} y={g.y - 7.5} width={l} height={15} rx={7.5} className="pc-groupe__fond" />
                <text x={g.x} y={g.y + 3.3} textAnchor="middle" fontSize={9} className="pc-groupe__texte">
                  {texte}
                </text>
              </g>
            );
          })}
          <g aria-hidden="true">
            {scene.points
              .filter((p) => etiquettes.has(p.cle))
              .map((p) => {
                const e = etiquettes.get(p.cle)!;
                return (
                  <g key={e.cle} className={`pc-etiquette-point pc-p--${p.niveau}`}>
                    <path d={e.trait} className="pc-etiquette-point__trait" />
                    <text x={e.x} y={e.y} textAnchor={e.ancre} fontSize={11} className="pc-etiquette-point__titre">
                      {e.titre}
                    </text>
                    <text
                      x={e.x}
                      y={e.y + 11.5}
                      textAnchor={e.ancre}
                      fontSize={9.5}
                      className="pc-etiquette-point__detail"
                    >
                      {e.detail}
                    </text>
                  </g>
                );
              })}
            <path d="M-7 0h14M0 -7v14" className="pc-r-centre" />
          </g>
        </svg>
      </div>
      <ul className="pc-legende" aria-label="Légende du radar">
        {NIVEAUX_PRIORITE.map((n) => (
          <li key={n}>
            <svg viewBox="-6 -6 12 12" aria-hidden="true" className={`pc-legende__icone pc-p--${n}`}>
              <circle r={4.5} className="pc-noyau" />
            </svg>
            {n}
          </li>
        ))}
        <li>Plus près du centre : plus urgent</li>
        <li>
          <svg viewBox="-8 -8 16 16" aria-hidden="true" className="pc-legende__icone pc-p--P4">
            <circle r={7} className="pc-noyau" />
          </svg>
          Taille : machines et actifs que vous lisez
        </li>
        <li>
          <svg viewBox="-6 -6 12 12" aria-hidden="true" className="pc-legende__icone pc-p--P4">
            <circle r={4.5} className="pc-noyau pc-noyau--vide" />
          </svg>
          Cercle vide : produit à confirmer
        </li>
        <li>
          <svg viewBox="-8 -8 16 16" aria-hidden="true" className="pc-legende__icone pc-p--P1">
            <circle r={6.5} className="pc-legende__halo" />
            <circle r={3.5} className="pc-noyau" />
          </svg>
          Halo : exploitation avérée
        </li>
        <li>
          <svg viewBox="-10 -8 20 16" aria-hidden="true" className="pc-legende__icone pc-p--P3">
            <rect x={-9} y={-6} width={18} height={12} rx={6} className="pc-groupe__fond" />
          </svg>
          Pastille chiffrée : failles regroupées
        </li>
      </ul>
    </div>
  );
}

/** Radar sans aucune faille suivie : aucun point n'est inventé. */
export function RadarVide() {
  return (
    <div className="pc-ecran">
      <p className="pc-ecran__tete">
        <span>
          <b>Situation tactique</b> · aucune faille suivie
        </span>
      </p>
      <p className="pc-vide" role="status">
        Radar vide : aucune faille suivie. Les points apparaissent quand Tenable, AlgoLightHouse ou la veille rapportent
        une faille présente chez nous, ou un produit à confirmer.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Cible prioritaire et journal */
export function CiblePrioritaire({ cible, onOuvrir }: { cible: CibleVueDto | undefined; onOuvrir: () => void }) {
  const id = useId();
  if (!cible)
    return (
      <section className="pc-cible pc-teinte--vert" aria-labelledby={id}>
        <h2 className="pc-etiquette" id={id}>
          Cible prioritaire
        </h2>
        <p className="pc-cible__texte">Aucune faille suivie : rien à traiter pour le moment.</p>
      </section>
    );
  return (
    <section className={`pc-cible pc-teinte--${TEINTE_PRIORITE[cible.priorite.niveau]}`} aria-labelledby={id}>
      <h2 className="pc-etiquette" id={id}>
        Cible prioritaire · {cible.priorite.niveau}
      </h2>
      <p className="pc-cible__titre">
        <Anchor component="button" type="button" onClick={onOuvrir} className="pc-cible__bouton">
          {cible.titre}
        </Anchor>
      </p>
      <p className="pc-cible__texte">
        {[cible.cve ?? 'Constat de Tenable sans CVE', `secteur ${SECTEUR_RADAR_LIBELLES[cible.secteur]}`, cible.produit]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <dl className="pc-mesures">
        <div>
          <dt>Touchées</dt>
          <dd>{libelleTouches(cible)}</dd>
        </div>
        <div>
          <dt>Exploitée</dt>
          <dd>{cible.exploitee ? 'Oui' : 'Non'}</dd>
        </div>
        <div>
          <dt>EPSS</dt>
          <dd>{cible.epss === null ? '—' : cible.epss.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</dd>
        </div>
      </dl>
    </section>
  );
}

export function Journal({ entrees }: { entrees: VueEnsembleDto['journal'] }) {
  const id = useId();
  return (
    <section className="pc-panneau pc-journal" aria-labelledby={id}>
      <h2 className="pc-etiquette pc-panneau__titre" id={id}>
        <span>Journal de veille</span>
        <span>{entrees.length} dernières traces</span>
      </h2>
      {entrees.length ? (
        <ol>
          {entrees.map((e, i) => {
            const l = ligneJournal(e);
            return (
              <li key={`${e.nature}-${e.le}-${i}`}>
                <time dateTime={e.le} className="horodatage">
                  {l.heure}
                </time>
                <span>
                  <span className={`pc-journal__etiquette pc-teinte--${l.teinte}`}>{l.etiquette}</span> {l.texte}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="pc-cible__texte">Aucune collecte, synchronisation ni alerte pour le moment.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Cibles par priorité */
export function CiblesTable({
  cibles,
  responsables,
  onOuvrir,
}: {
  cibles: CibleVueDto[];
  responsables: Map<string, string>;
  onOuvrir: (c: CibleVueDto) => void;
}) {
  return (
    <DataTable label="Cibles par priorité">
      <Table className="pc-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Faille et produit</Table.Th>
            <Table.Th>Faits</Table.Th>
            <Table.Th>EPSS</Table.Th>
            <Table.Th>État</Table.Th>
            <Table.Th>Responsable</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cibles.map((c) => (
            <Table.Tr key={c.cle} className={`pc-ligne pc-p--${c.priorite.niveau}`}>
              <Table.Td>
                <span className="pc-prio">{c.priorite.niveau}</span>
              </Table.Td>
              <Table.Td>
                <Anchor component="button" type="button" onClick={() => onOuvrir(c)} className="pc-table__nom">
                  {c.titre}
                </Anchor>
                <Text size="xs" c="dimmed" className="pc-mono">
                  {[c.cve ?? 'Sans CVE', c.produit, `secteur ${SECTEUR_RADAR_LIBELLES[c.secteur]}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Table.Td>
              <Table.Td>
                <span className="pc-faits">
                  {faitsCible(c).map((f) => (
                    <span key={f.libelle} className={`pc-puce pc-teinte--${f.teinte}`}>
                      {f.libelle}
                    </span>
                  ))}
                  <span className="pc-puce pc-teinte--gris">{libelleTouches(c)}</span>
                </span>
              </Table.Td>
              <Table.Td className="pc-mono">
                {c.epss === null ? '—' : c.epss.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
              </Table.Td>
              <Table.Td>{c.etat ? ETAT_SUIVI_LIBELLES[c.etat] : '—'}</Table.Td>
              <Table.Td>{(c.produitId && responsables.get(c.produitId)) || '—'}</Table.Td>
            </Table.Tr>
          ))}
          {cibles.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text size="sm" c="dimmed">
                  Aucune faille suivie ne correspond.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/* ------------------------------------------------------------------ Capteurs */
const heureCourte = (iso: string | null) => (iso ? fmtDate(iso) : 'jamais');

export function Capteurs({
  veille,
  tenable,
  alh,
}: {
  veille: EtatVeilleDto | undefined;
  tenable: EtatSynchronisationDto[] | undefined;
  alh: EtatSurfaceExterneDto[] | undefined;
}) {
  const id = useId();
  const sources: EtatSourceVeilleDto[] = veille?.sources ?? [];
  const connecteurs = [
    ...(tenable ?? []).map((c) => ({ c, type: 'Tenable Security Center' })),
    ...(alh ?? []).map((c) => ({ c, type: 'AlgoLightHouse' })),
  ];
  return (
    <section className="pc-capteurs" aria-labelledby={id}>
      <div className="pc-section-titre">
        <h2 id={id}>Capteurs : sources de veille et connecteurs</h2>
        <span>Dernière collecte réussie</span>
      </div>
      <h3 className="pc-etiquette">Sources de veille</h3>
      {sources.length ? (
        <ul className="pc-capteurs__liste">
          {sources.map((s, i) => {
            const e = etatSource(s, !!veille?.flux.ouvert);
            return (
              <li key={s.source} className={`pc-capteur pc-capteur--${e.etat}`}>
                <span className="pc-capteur__num pc-mono">{deuxChiffres(i + 1)}</span>
                <strong>{s.libelle}</strong>
                <span className="pc-capteur__pied">
                  <StatusChip etat={e.etat}>{e.libelle}</StatusChip>
                  <span className="horodatage">{heureCourte(s.derniereReussite)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Text size="sm" c="dimmed">
          État des sources indisponible.
        </Text>
      )}
      <h3 className="pc-etiquette">Connecteurs</h3>
      {connecteurs.length ? (
        <ul className="pc-capteurs__liste">
          {connecteurs.map(({ c, type }, i) => {
            const e = etatConnecteur(c);
            return (
              <li key={c.integrationId} className={`pc-capteur pc-capteur--${e.etat}`}>
                <span className="pc-capteur__num pc-mono">{deuxChiffres(i + 1)}</span>
                <strong>{c.nom}</strong>
                <small>{type}</small>
                <span className="pc-capteur__pied">
                  <StatusChip etat={e.etat}>{e.libelle}</StatusChip>
                  <span className="horodatage">{heureCourte(e.reussie)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Text size="sm" c="dimmed">
          Aucun connecteur Tenable Security Center ni AlgoLightHouse : ils se configurent dans Pilotage &gt;
          Intégrations.
        </Text>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Page */
export function VueEnsemblePage() {
  const lire = useCan()('vulnerabilites', 'lire');
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState<FiltreCibles>('toutes');
  const [caseChoisie, setCaseChoisie] = useState<CaseChoisie | null>(null);
  const [page, setPage] = useState(1);
  const [ouverte, setOuverte] = useState<Ouverte>(null);
  const tableau = useRef<HTMLDivElement>(null);
  const vue = useQuery({
    queryKey: CLE_VUE,
    queryFn: () => get<VueEnsembleDto>(URL_VUE),
    enabled: lire,
    refetchInterval: 60_000,
  });
  const alertes = useQuery({
    queryKey: [...CLE_ALERTES, 'liste', 'actives', 'critique', 1],
    queryFn: () => get<PageAlertesVulnerabilites>(urlAlertes({ etat: 'actives', niveau: 'critique' })),
    enabled: lire,
    refetchInterval: 60_000,
  });
  const veille = useQuery({
    queryKey: ['vulnerabilites', 'veille', 'etat'],
    queryFn: () => get<EtatVeilleDto>('/api/vulnerabilites/veille/etat'),
    enabled: lire,
  });
  const tenable = useQuery({
    queryKey: ['vulnerabilites', 'failles', 'etat'],
    queryFn: () => get<EtatSynchronisationDto[]>('/api/vulnerabilites/synchronisation'),
    enabled: lire,
  });
  const alh = useQuery({
    queryKey: ['vulnerabilites', 'surface', 'etat'],
    queryFn: () => get<EtatSurfaceExterneDto[]>('/api/vulnerabilites/surface/etat'),
    enabled: lire,
  });
  const produits = useQuery({
    queryKey: ['vulnerabilites', 'produits', 'toutes'],
    queryFn: () => get<ProduitSurveilleDto[]>('/api/vulnerabilites/produits'),
    enabled: lire,
  });
  const fiche = useQuery({
    queryKey: ['vulnerabilites', 'failles', 'constat', ouverte?.nature === 'constat' ? ouverte.id : null],
    queryFn: () => get<ConstatDto>(`/api/vulnerabilites/constats/${(ouverte as { id: string }).id}`),
    enabled: lire && ouverte?.nature === 'constat',
  });
  const ficheDeclaree = useQuery({
    queryKey: ['vulnerabilites', 'failles', 'declaree', ouverte?.nature === 'declaree' ? ouverte.id : null],
    queryFn: () => get<FicheDeclareeDto>(`/api/vulnerabilites/declarees/${(ouverte as { id: string }).id}`),
    enabled: lire && ouverte?.nature === 'declaree',
  });
  const scene = useMemo(() => (vue.data ? disposerRadar(vue.data.cibles, vue.data.cases) : null), [vue.data]);
  const responsables = useMemo(
    () =>
      new Map(
        (produits.data ?? []).flatMap((p) => (p.responsableLibelle ? [[p.id, p.responsableLibelle] as const] : [])),
      ),
    [produits.data],
  );

  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );

  const ouvrir = (c: CibleVueDto) => {
    const o = ouvertureCible(c);
    if (!o) return setOuverte({ nature: 'aucune', cible: c });
    if (o.type === 'lien') return void navigate(o.to);
    setOuverte({ nature: o.nature, id: o.id });
  };
  const choisirCase = (c: CaseChoisie) => {
    setCaseChoisie(c);
    setFiltre('toutes');
    setPage(1);
    tableau.current?.scrollIntoView({ block: 'start' });
    tableau.current?.focus();
  };
  const v = vue.data;
  const filtrees = v ? filtrerCibles(v.cibles, filtre, caseChoisie) : [];
  const pages = Math.max(1, Math.ceil(filtrees.length / CIBLES_PAR_PAGE));
  const affichees = filtrees.slice((page - 1) * CIBLES_PAR_PAGE, page * CIBLES_PAR_PAGE);
  const totalCase =
    v && caseChoisie
      ? (v.cases.find((c) => c.secteur === caseChoisie.secteur && c.priorite === caseChoisie.niveau)?.total ?? 0)
      : 0;
  const chargesCase = v && caseChoisie ? filtrerCibles(v.cibles, 'toutes', caseChoisie).length : 0;

  return (
    <Page>
      <PageHeader
        title="Vue d’ensemble"
        description="Poste de commandement du module : niveau d’alerte, radar des failles suivies, cible prioritaire, journal et capteurs. La priorité et le niveau d’alerte sont calculés par la plateforme, les mêmes pour tout le monde ; les nombres de machines et d’actifs sont ceux que vous pouvez lire."
      />
      <ErrorAlert error={vue.error} />
      {v && scene && (
        <div className="poste">
          <p className="poste__tete">
            <span className="pc-etiquette">Situation · veille et détection</span>
            <span className="pc-etiquette">
              Calculée le <span className="horodatage">{fmtDate(v.calculeLe)}</span>
            </span>
          </p>
          {alertes.data && <BandeauAlerte alertes={alertes.data.elements} total={alertes.data.total} />}
          <div className="poste__grille">
            <div className="poste__colonne">
              <NiveauAlerteBloc niveau={v.niveau} />
              <Tuiles tuiles={v.tuiles} />
              <CiblePrioritaire cible={v.cibles[0]} onOuvrir={() => v.cibles[0] && ouvrir(v.cibles[0])} />
            </div>
            <div className="poste__colonne">
              {v.total === 0 ? (
                <RadarVide />
              ) : (
                <RadarTactique scene={scene} total={v.total} onPoint={ouvrir} onGroupe={choisirCase} />
              )}
              <div className="poste__paire">
                <Journal entrees={v.journal} />
                <Secteurs vue={v} />
              </div>
            </div>
          </div>
          <section className="pc-cibles" aria-labelledby="pc-cibles-titre">
            <div className="pc-section-titre">
              <h2 id="pc-cibles-titre">Cibles par priorité</h2>
              <SegmentedControl
                value={filtre}
                onChange={(x) => {
                  setFiltre(x as FiltreCibles);
                  setPage(1);
                }}
                data={FILTRES_CIBLES.map((f) => ({ value: f, label: FILTRE_CIBLES_LIBELLES[f] }))}
                aria-label="Filtre des cibles"
                size="xs"
              />
            </div>
            <div ref={tableau} tabIndex={-1} className="pc-cibles__zone">
              {caseChoisie && (
                <p className="pc-case" role="status">
                  Case du radar : {libelleCase(caseChoisie)}, {totalCase} faille{totalCase > 1 ? 's' : ''}
                  {totalCase > chargesCase
                    ? ` (${chargesCase} chargées ici, les autres dans la liste complète)`
                    : ''}.{' '}
                  <Anchor
                    component="button"
                    type="button"
                    onClick={() => {
                      setCaseChoisie(null);
                      setPage(1);
                    }}
                  >
                    Retirer ce filtre
                  </Anchor>
                </p>
              )}
              <CiblesTable cibles={affichees} responsables={responsables} onOuvrir={ouvrir} />
            </div>
            <div className="pc-cibles__pied">
              <Text size="sm" c="dimmed" role="status">
                {filtrees.length} faille{filtrees.length > 1 ? 's' : ''} sur {v.total} suivie{v.total > 1 ? 's' : ''}
                {v.tronquee ? ' (les plus prioritaires de chaque case du radar)' : ''}
              </Text>
              {pages > 1 && (
                <Pagination
                  total={pages}
                  value={page}
                  onChange={setPage}
                  aria-label="Pages des cibles"
                  size="sm"
                  getControlProps={(c) => ({
                    'aria-label':
                      c === 'previous'
                        ? 'Page précédente'
                        : c === 'next'
                          ? 'Page suivante'
                          : c === 'first'
                            ? 'Première page'
                            : 'Dernière page',
                  })}
                  getItemProps={(n) => ({ 'aria-label': `Page ${n}` })}
                />
              )}
              <Anchor component={Link} to={LIENS_TUILES.tout} size="sm">
                Tout voir dans « Failles détectées »
              </Anchor>
            </div>
          </section>
          <Capteurs veille={veille.data} tenable={tenable.data} alh={alh.data} />
          <p className="poste__note">
            Chaque point du radar est une faille suivie, placée par la plateforme ; seul le balayage est décoratif. La
            plateforme décide des alertes ; une personne décide du traitement.
          </p>
        </div>
      )}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouverte}
        onClose={() => setOuverte(null)}
        title={
          ouverte?.nature === 'constat'
            ? (fiche.data?.nom ?? 'Faille détectée')
            : ouverte?.nature === 'declaree'
              ? ficheDeclaree.data
                ? `${ficheDeclaree.data.cve} (faille déclarée)`
                : 'Faille déclarée'
              : 'Faille suivie'
        }
        size="xl"
        centered
        lockScroll={false}
      >
        {ouverte?.nature === 'constat' && (
          <>
            <ErrorAlert error={fiche.error} />
            {fiche.data && (
              <Stack>
                <FicheFaille nature="constat" id={fiche.data.id} />
                <FicheConstat c={fiche.data} />
                <SuiviFaille nature="constat" id={fiche.data.id} source="Tenable" />
              </Stack>
            )}
          </>
        )}
        {ouverte?.nature === 'declaree' && (
          <>
            <ErrorAlert error={ficheDeclaree.error} />
            {ficheDeclaree.data && (
              <Stack>
                <FicheFaille nature="declaree" id={ficheDeclaree.data.rapprochementId} />
                <FicheDeclaree f={ficheDeclaree.data} />
                <SuiviFaille nature="declaree" id={ficheDeclaree.data.rapprochementId} source="la veille" />
              </Stack>
            )}
          </>
        )}
        {ouverte?.nature === 'aucune' && (
          <Stack gap="xs">
            <Text size="sm">
              {ouverte.cible.priorite.niveau} · {ouverte.cible.titre}
            </Text>
            <Text size="sm">
              {libelleTouches(ouverte.cible)} · {libelleEpss(ouverte.cible.epss)}
            </Text>
            <Text size="sm" c="dimmed">
              Aucune fiche que vous puissiez lire : ce constat de Tenable sans CVE ne touche que des machines hors de
              vos droits. Sa priorité est la même pour tout le monde.
            </Text>
          </Stack>
        )}
      </Modal>
    </Page>
  );
}
