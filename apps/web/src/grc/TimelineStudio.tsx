/* Timeline Studio : rendu de la vue Timeline des actions et des tâches récurrentes (refonte Neon, lot 6, ADR 0093 ;
   refonte des frises décidée par le RSSI le 20/11/2026 sur maquette). Les objets, états, résultats, droits et éditions
   restent ceux des API métier ; la présentation ne crée ni ne corrige aucune date. Contrats conservés de la Timeline
   précédente : région « Timeline des actions » défilant dans les deux sens, colonne d'intitulés fixe
   (`.grc-timeline__etiquettes`), un guide par action placée (visible au survol de la ligne), période affichée, légende,
   mentions « ! En retard » et jours de fond (`data-fond`, `timeline-fond`).
   Plan d'actions : colonnes Action, Resp., Échéance et État à gauche, frise à droite ; groupes repliables (priorité,
   responsable, état ou aucun) ; échelle Semaines, Mois, Trimestres ou Année ; terminées et annulées masquées par défaut.
   - Ligne (intitulé, fond de la ligne) : fiche complète, comme la commande existante.
   - Repère (barre, losange ou carré d'occurrence) : petite fenêtre de résultat (ValidationRapide).
   Les teintes disent l'état ; le retard a son propre repère (contour rouge et texte), distinct de l'état et du résultat. */
import { ActionIcon, Alert, Button, Group, Text } from '@mantine/core';
import { useElementSize, useMergedRef } from '@mantine/hooks';
import { avancementTaches, type BusinessPolicy, type GrcObject } from '@suivi/shared';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFiltreUrl } from '../components/filtre-url';
import { ficheCliquable } from '../fiche-cliquable';
import {
  commandeRepere,
  descriptionRepere,
  enRetard,
  estOccurrence,
  infobulleRepere,
  infobulleTache,
  tonStatut,
  tonTache,
} from './etat-action';
import type { FamilleFond, JourFond } from './jours-de-fond';
import {
  calculerFrise,
  compterParColonne,
  CRITERES_GROUPE,
  dateCourte,
  estCritereGroupe,
  estUniteFrise,
  grouperActions,
  periodeFrise,
  placerActions,
  reperesTaches,
  RAISON_DATE_LABELS,
  sansResponsable,
  tachesDe,
  UNITES_FRISE,
  type RepereTache,
  type CritereGroupe,
  type UniteFrise,
} from './Timeline';
import {
  Bascule,
  CarreOccurrence,
  DefsVerre,
  ElementLegende,
  etatCarre,
  InfobulleRepere,
  ListeHors,
  PastilleEtat,
  PastilleResponsable,
  PeriodeAffichee,
  PiedTemps,
  RegleTemps,
  Segmente,
  largeurTexte,
  TAILLE_LIBELLE,
  TexteMasque,
  useInfobulle,
  toucheRepere,
  usePolicesChargees,
  tronquer,
  type OuvrirResultat,
} from './TimelineCommun';
import { FriseOccurrences } from './TimelineOccurrences';

const JOUR = 86_400_000;
/** Géométrie (pixels du dessin, reportés dans la colonne d'intitulés par le CSSOM) : ligne d'action, en-tête de groupe,
    règle, pied, hauteur des barres et demi-côté du losange. */
const LIGNE = 40;
const GROUPE = 36;
const ENTETE = 46;
const PIED = 38;
const BARRE = 26;
const LOSANGE = 7;
/** Ligne d'une action dont des tâches sont datées (ADR 0111) : le tube garde sa place, le fil des tâches passe dessous. */
const LIGNE_TACHES = 58;
const Y_TACHES = 46;
const DEMI_TACHE = 3.4;
/** Largeur minimale d'une colonne de temps : au-delà de la place disponible, la frise défile dans sa région. */
const MIN_COLONNE: Record<UniteFrise, number> = { semaine: 72, mois: 104, trimestre: 132, annee: 176 };
const SANS_DATE = 'sans-date';
/** Légende lue par les lecteurs d'écran : sens des repères, que les pastilles dessinées ne disent pas. */
const LEGENDE_LUE =
  'Tube : du début à l’échéance, de la couleur de l’état. Sans date de début, il part de la création de la fiche. ' +
  'Occurrence : carré orange à horloge en attente de résultat, puis carré vert coché (OK), losange rouge barré (KO) ' +
  'ou carré gris (NA), triangle rouge si elle est en retard. ' +
  '! En retard : tube ou losange cerclé de rouge, en plus de l’état.';
const LEGENDE_LOSANGE = ' Losange : action qui n’a qu’une échéance, dont la fiche a été créée après cette échéance.';
const jourDe = (iso: unknown) =>
  typeof iso === 'string' && iso ? Math.floor(new Date(iso).getTime() / JOUR) * JOUR : Number.NaN;
const fr = (jour: number) => new Date(jour).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Jours de fond de la période, écrits en toutes lettres (le dessin n'est qu'un repère). */
function JoursDeFond({ jours }: { jours: { jour: number; label: string; famille: string }[] }) {
  if (!jours.length) return null;
  return (
    <Text size="xs" data-testid="timeline-fond" className="timeline-fond">
      Jours de fond dans la période ({jours.length}) :{' '}
      {jours.map((j) => `${fr(j.jour)} ${j.label} (${j.famille === 'feries' ? 'férié' : 'fermeture'})`).join(' · ')}. Le
      fond est un repère : il ne change aucune échéance.
    </Text>
  );
}

/** Intitulé d'une action : ouvre la fiche complète (clic, Entrée, Espace), comme la commande existante. Son nom
    accessible est l'intitulé exact ; l'état, le résultat, le retard, la période et le responsable sont dans sa
    description. */
function IntituleAction({
  objet,
  policy,
  maintenant,
  annee,
  responsable,
  haute = false,
  survol,
  onSurvol,
  onOpen,
}: {
  objet: GrcObject;
  policy: BusinessPolicy;
  maintenant: number;
  annee: number;
  responsable: string;
  /** Ligne plus haute : des tâches datées passent sous le tube (ADR 0111). */
  haute?: boolean;
  survol: boolean;
  onSurvol: (id: string | null) => void;
  onOpen: (o: GrcObject) => void;
}) {
  const retard = enRetard(objet, policy, maintenant);
  const echeance = jourDe(objet.data.dueAt);
  const date = (iso: string) => fr(jourDe(iso));
  const classes = [
    'grc-timeline__ligne',
    'frise-cols',
    haute && 'grc-timeline__ligne--taches',
    survol && 'frise-survol',
  ];
  return (
    <div
      {...ficheCliquable(() => onOpen(objet), `Afficher ${objet.name}`)}
      role="button"
      className={classes.filter(Boolean).join(' ')}
      aria-label={objet.name}
      aria-description={`${descriptionRepere(objet, policy, maintenant, date)}, responsable : ${responsable} ; ouvre la fiche`}
      title={objet.name}
      data-ton={tonTache(objet, policy)}
      onMouseEnter={() => onSurvol(objet.id)}
      onMouseLeave={() => onSurvol(null)}
      onFocus={() => onSurvol(objet.id)}
      onBlur={() => onSurvol(null)}
    >
      <span className="grc-timeline__nom">{objet.name}</span>
      <span className="frise-col-resp">
        <PastilleResponsable libelle={responsable} vide={sansResponsable(objet)} />
      </span>
      <span className={retard ? 'frise-col-echeance frise-date frise-date--retard' : 'frise-col-echeance frise-date'}>
        {Number.isFinite(echeance) ? dateCourte(echeance, annee) : '—'}
      </span>
      <span className="frise-col-etat">
        <PastilleEtat objet={objet} policy={policy} />
      </span>
      {retard && <TexteMasque>! En retard</TexteMasque>}
    </div>
  );
}

type Rang =
  | {
      type: 'groupe';
      cle: string;
      libelle: string;
      nombre: number;
      ouvert: boolean;
      de?: number;
      a?: number;
      y: number;
      h: number;
    }
  | {
      type: 'action';
      cle: string;
      objet: GrcObject;
      de?: number;
      a?: number;
      creation?: number | null;
      y: number;
      h: number;
    };

/** Sous le tube (ADR 0111) : un fil fin et un petit losange par tâche datée, à son échéance (vide : à faire, vert :
    faite, rouge : en retard), nettement sous le tube, jamais dedans. Infobulle au survol (intitulé, responsable,
    échéance, état) ; décoratif pour les lecteurs d'écran, qui lisent l'avancement dans le nom du repère et les tâches
    dans la fiche. */
function SousTube({
  reperes,
  debut,
  fin,
  y,
  x,
  largeur,
  maintenant,
  bulle,
  responsableDe,
}: {
  reperes: RepereTache[];
  debut: number;
  fin: number;
  y: number;
  x: (n: number) => number;
  largeur: number;
  maintenant: number;
  bulle: ReturnType<typeof useInfobulle>;
  responsableDe: (responsable: unknown) => string | null;
}) {
  const xs = reperes.map((r) => Math.max(6, Math.min(largeur - 6, x(r.jour + JOUR / 2))));
  const x1 = Math.max(0, Math.min(debut, ...xs)),
    x2 = Math.min(largeur, Math.max(fin, ...xs));
  return (
    <g className="frise-taches" aria-hidden="true">
      <line className="frise-taches__fil" x1={x1} x2={x2} y1={y} y2={y} />
      {reperes.map((r, i) => (
        <g
          key={r.tache.id}
          className={`frise-tache frise-tache--${r.etat}`}
          {...bulle.surRepere(() => infobulleTache(r.tache, responsableDe(r.tache.responsable), maintenant))}
        >
          <circle className="frise-tache__zone" cx={xs[i]} cy={y} r="8" />
          <rect
            className="frise-tache__losange"
            x={xs[i]! - DEMI_TACHE}
            y={y - DEMI_TACHE}
            width={DEMI_TACHE * 2}
            height={DEMI_TACHE * 2}
            rx="1"
            transform={`rotate(45 ${xs[i]} ${y})`}
          />
        </g>
      ))}
    </g>
  );
}

/** Repère d'une action sur sa ligne : tube du début à l'échéance (titre dedans s'il tient, sinon à droite) ; pour une
    action qui n'a qu'une échéance, tube depuis la création de sa fiche (décision du RSSI, proposition B), ou losange si la
    création suit l'échéance ; carré pour une occurrence de série. Un clic ou Entrée ouvre la petite fenêtre. */
function RepereAction({
  objet,
  de,
  a,
  creation,
  y,
  x,
  largeur,
  annee,
  policy,
  maintenant,
  survol,
  onResultat,
  bulle,
  onSurvol,
  responsableDe,
}: {
  objet: GrcObject;
  de: number;
  a: number;
  /** Jour de création servant de début (action qui n'a qu'une échéance), ou null. */
  creation: number | null;
  /** Libellé du responsable d'une tâche (affichage seulement). */
  responsableDe: (responsable: unknown) => string | null;
  y: number;
  x: (n: number) => number;
  largeur: number;
  annee: number;
  policy: BusinessPolicy;
  maintenant: number;
  survol: boolean;
  onResultat: OuvrirResultat;
  /** Infobulle partagée de la frise (survol et focus). */
  bulle: ReturnType<typeof useInfobulle>;
  /** Ligne teintée au focus clavier du repère. */
  onSurvol: (id: string | null) => void;
}) {
  const cy = y + LIGNE / 2;
  const retard = enRetard(objet, policy, maintenant);
  const ton = tonTache(objet, policy);
  const date = (iso: string) => fr(jourDe(iso));
  const occurrence = estOccurrence(objet);
  const ouvrir = (el: SVGElement) => {
    bulle.fermer();
    onResultat(objet, el);
  };
  const seuleEcheance =
    creation === null && !Number.isFinite(jourDe(objet.data.startAt)) && Number.isFinite(jourDe(objet.data.dueAt));
  // Tube sans date de début : l'infobulle et le nom accessible disent d'où il part (rien de plus à l'écran).
  const depuis = creation !== null ? `, depuis la création le ${fr(creation)} (pas de date de début)` : '';
  // Tâches de l'action (ADR 0111) : avancement dans le tube, repères des tâches datées sous le tube.
  const taches = occurrence ? [] : tachesDe(objet);
  const avancement = avancementTaches(taches);
  const reperes = reperesTaches(taches, maintenant);
  const ditTaches = avancement ? `, tâches : ${avancement.faites} sur ${avancement.total} faites` : '';
  let forme: ReactNode, debutForme: number, finForme: number, dehors: string;
  if (occurrence || seuleEcheance) {
    // Au milieu du jour d'échéance ; un repère du premier ou du dernier jour reste entier au bord de la frise.
    const cx = Math.max(LOSANGE + 6, Math.min(largeur - LOSANGE - 6, x(a + JOUR / 2)));
    debutForme = cx - 11;
    finForme = cx + 11;
    dehors = occurrence ? objet.name : `Échéance ${dateCourte(a, annee)}`;
    forme = occurrence ? (
      <CarreOccurrence cx={cx} cy={cy} etat={etatCarre(objet, maintenant, retard)} />
    ) : (
      <g transform={`rotate(45 ${cx} ${cy})`}>
        {retard && (
          <rect
            className="grc-timeline__contour-retard"
            x={cx - LOSANGE - 4}
            y={cy - LOSANGE - 4}
            width={LOSANGE * 2 + 8}
            height={LOSANGE * 2 + 8}
            rx="3"
          />
        )}
        <rect
          className="frise-losange"
          x={cx - LOSANGE}
          y={cy - LOSANGE}
          width={LOSANGE * 2}
          height={LOSANGE * 2}
          rx="2"
        />
      </g>
    );
  } else {
    // Tube du début à l'échéance (jour d'échéance compris), sur toutes les colonnes qu'il traverse : bouts arrondis
    // (rayon complet) et liseré plein qui épouse le bout gauche.
    const gauche = Math.max(0, x(de)),
      largeurBarre = Math.max(6, Math.min(largeur, x(a + JOUR)) - gauche),
      r = Math.min(BARRE / 2, largeurBarre / 2),
      liseret = Math.min(6, r),
      haut = cy - BARRE / 2;
    const dy = r - Math.sqrt(r * r - (r - liseret) * (r - liseret));
    // Avancement « n/N · p % » au bout du tube quand il y a la place (sinon dans l'infobulle seulement).
    const texteAvancement = avancement ? `${avancement.faites}/${avancement.total} · ${avancement.pourcentage} %` : '';
    const largeurAvancement = texteAvancement ? largeurTexte(texteAvancement, TAILLE_LIBELLE, 700) + 10 : 0;
    // Titre dans le tube quand il y tient (au moins seize caractères lisibles), sinon à droite du tube. Le titre passe
    // avant l'avancement : celui-ci ne s'écrit au bout du tube que s'il reste la place, sinon il est dans l'infobulle.
    const retrait = Math.max(liseret + 7, r);
    const lisible = (texte: string) => texte.replace(/…$/, '').length >= Math.min(objet.name.length, 16);
    const place = largeurBarre - retrait - r + 2;
    const seul = tronquer(objet.name, place, TAILLE_LIBELLE, 600);
    const avecAvancement = texteAvancement ? tronquer(objet.name, place - largeurAvancement, TAILLE_LIBELLE, 600) : '';
    const titre = lisible(seul) ? (texteAvancement && lisible(avecAvancement) ? avecAvancement : seul) : '';
    const avancementDedans =
      !!texteAvancement && (titre ? titre === avecAvancement : largeurBarre >= largeurAvancement + 2 * r + 8);
    debutForme = gauche;
    finForme = gauche + largeurBarre;
    dehors = titre ? '' : objet.name;
    const clip = `frise-tube-${objet.id}`;
    forme = (
      <>
        {retard && (
          <rect
            className="grc-timeline__contour-retard"
            x={gauche - 2.5}
            y={haut - 2.5}
            width={largeurBarre + 5}
            height={BARRE + 5}
            rx={r + 2.5}
          />
        )}
        <rect className="grc-timeline__barre" x={gauche} y={haut} width={largeurBarre} height={BARRE} rx={r} />
        {avancement && avancement.faites > 0 && (
          <>
            <defs>
              <clipPath id={clip}>
                <rect x={gauche} y={haut} width={largeurBarre} height={BARRE} rx={r} />
              </clipPath>
            </defs>
            <rect
              className="frise-avancement"
              x={gauche}
              y={haut}
              width={(largeurBarre * avancement.faites) / avancement.total}
              height={BARRE}
              clipPath={`url(#${clip})`}
            />
          </>
        )}
        <path
          className="frise-liseret"
          d={`M${gauche + liseret} ${haut + dy}A${r} ${r} 0 0 0 ${gauche} ${haut + r}V${haut + BARRE - r}A${r} ${r} 0 0 0 ${gauche + liseret} ${haut + BARRE - dy}Z`}
        />
        {titre && (
          <text className="frise-repere__titre" x={gauche + retrait} y={cy + 4}>
            {titre}
          </text>
        )}
        {avancementDedans && (
          <text
            className="frise-repere__avancement"
            x={gauche + largeurBarre - Math.max(r * 0.7, 8)}
            y={cy + 4}
            textAnchor="end"
          >
            {texteAvancement}
          </text>
        )}
      </>
    );
  }
  // Libellé hors de la barre : à droite s'il y a la place, sinon à gauche ; décoratif (l'intitulé est dans la colonne).
  let libelle: ReactNode = null;
  if (dehors) {
    const placeDroite = largeur - finForme - 12,
      placeGauche = debutForme - 12;
    const aDroite = placeDroite >= 72 || placeDroite >= placeGauche;
    const texte = tronquer(dehors, aDroite ? placeDroite : placeGauche, TAILLE_LIBELLE);
    if (texte)
      libelle = (
        <text
          className="frise-dehors"
          x={aDroite ? finForme + 8 : debutForme - 8}
          y={cy + 4}
          textAnchor={aDroite ? 'start' : 'end'}
          aria-hidden="true"
        >
          {texte}
        </text>
      );
  }
  return (
    <g
      className={survol ? 'grc-timeline__rangee frise-survol' : 'grc-timeline__rangee'}
      data-ton={ton}
      onFocus={() => onSurvol(objet.id)}
      onBlur={() => onSurvol(null)}
    >
      <line
        x1="0"
        x2={Math.max(0, debutForme - 4)}
        y1={cy}
        y2={cy}
        className="grc-timeline__guide"
        aria-hidden="true"
      />
      <g
        role="button"
        tabIndex={0}
        className="grc-timeline__repere"
        data-ton={ton}
        data-retard={retard ? '' : undefined}
        aria-haspopup="dialog"
        aria-label={`${commandeRepere(objet)} : ${descriptionRepere(objet, policy, maintenant, date)}${depuis}${ditTaches}`}
        onClick={(e) => ouvrir(e.currentTarget)}
        onKeyDown={toucheRepere(ouvrir)}
        {...bulle.surRepere(() => infobulleRepere(objet, policy, maintenant, { creation, carre: occurrence }))}
      >
        {forme}
      </g>
      {libelle}
      {reperes.length > 0 && (
        <SousTube
          reperes={reperes}
          debut={debutForme}
          fin={finForme}
          y={y + Y_TACHES}
          x={x}
          largeur={largeur}
          maintenant={maintenant}
          bulle={bulle}
          responsableDe={responsableDe}
        />
      )}
    </g>
  );
}

function FriseActions({
  items,
  policy,
  onOpen,
  onResultat,
  ownerOf,
  fond,
  fondActif,
  onFond,
  closes,
}: {
  items: GrcObject[];
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onResultat: OuvrirResultat;
  ownerOf: (o: GrcObject) => string;
  fond: readonly JourFond[];
  fondActif: Readonly<Record<FamilleFond, boolean>>;
  onFond: (famille: FamilleFond, actif: boolean) => void;
  closes: boolean;
}) {
  // Choix conservés dans l'adresse, comme les autres filtres de la page. Les actions closes suivent par défaut le filtre
  // « Afficher les actions closes » de la page (masquées par défaut).
  const [groupe, setGroupe] = useFiltreUrl('tgroupe', 'priorite'),
    [pas, setPas] = useFiltreUrl('tpas', 'mois'),
    [terminees, setTerminees] = useFiltreUrl('tterminees', closes ? '1' : '0'),
    [annulees, setAnnulees] = useFiltreUrl('tannulees', closes ? '1' : '0');
  const critere: CritereGroupe = estCritereGroupe(groupe) ? groupe : 'priorite';
  const unite: UniteFrise = estUniteFrise(pas) ? pas : 'mois';
  usePolicesChargees();
  const bulle = useInfobulle();
  const [replies, setReplies] = useState<ReadonlySet<string>>(() => new Set([SANS_DATE]));
  const [survol, setSurvol] = useState<string | null>(null);
  const idGroupe = useId();
  const region = useRef<HTMLDivElement>(null);
  const mesure = useElementSize<HTMLDivElement>();
  const gauche = useElementSize<HTMLDivElement>();
  const refRegion = useMergedRef(region, mesure.ref);
  // Une seule source pour la hauteur des lignes : le dessin et la colonne d'intitulés (CSSOM, autorisé par la CSP).
  useLayoutEffect(() => {
    const el = region.current;
    if (!el) return;
    el.style.setProperty('--grc-timeline-rang', `${LIGNE}px`);
    el.style.setProperty('--grc-timeline-entete', `${ENTETE}px`);
    el.style.setProperty('--frise-groupe', `${GROUPE}px`);
    el.style.setProperty('--frise-pied', `${PIED}px`);
    el.style.setProperty('--frise-ligne-taches', `${LIGNE_TACHES}px`);
  }, []);

  const maintenant = Date.now();
  const annee = new Date(maintenant).getUTCFullYear();
  const estAnnulee = (o: GrcObject) => o.data.status === 'cancelled';
  const estTerminee = (o: GrcObject) =>
    !estAnnulee(o) &&
    (!!policy.statuses.find((s) => s.id === o.data.status)?.terminal || (!!o.data.legacy && o.data.status === 'done'));
  const montrees = items.filter((o) => !(estAnnulee(o) && annulees !== '1') && !(estTerminee(o) && terminees !== '1'));
  // Les dates incohérentes restent toujours listées, même pour une action masquée ; elles ne sont jamais corrigées.
  const incoherentes = calculerFrise(items, maintenant).incoherentes;
  const nonListees = new Set(incoherentes.map((i) => i.objet.id));
  const masquees = items.filter((o) => !montrees.includes(o) && !nonListees.has(o.id));
  const nbTerminees = masquees.filter(estTerminee).length,
    nbAnnulees = masquees.filter(estAnnulee).length;
  const frise = calculerFrise(montrees, maintenant);
  // Début dessiné de chaque action : une action hors série qui n'a qu'une échéance part de la création de sa fiche.
  const dessinees = placerActions(frise.placees);
  const p = periodeFrise(
    frise,
    unite,
    dessinees.filter((d) => d.creation !== null).map((d) => d.de),
  );

  // Échelle : la frise remplit la place disponible, avec une largeur minimale par colonne au-delà de laquelle elle défile.
  const joursPeriode = (p.fin - p.debut) / JOUR;
  const dispo = Math.max(240, (mesure.width || 960) - (gauche.width || 0) - 2);
  const parJour = Math.max(MIN_COLONNE[unite] / UNITES_FRISE[unite].jours, dispo / joursPeriode);
  const largeur = Math.max(1, Math.floor(joursPeriode * parJour));
  const x = (n: number) => ((n - p.debut) / JOUR) * parJour;

  // Lignes : groupes (en-tête repliable) puis actions ; « Sans date à placer » en dernier, replié par défaut.
  // Tâches (ADR 0111) : action hors série dont au moins une tâche est datée ; libellé d'un responsable de tâche.
  const aTachesDatees = (o: GrcObject) => !estOccurrence(o) && reperesTaches(tachesDe(o), maintenant).length > 0;
  const responsableDe = (r: unknown) => (r ? ownerOf({ data: { responsable: r } } as unknown as GrcObject) : null);
  const tachesDessinees = dessinees.some((d) => aTachesDatees(d.objet));
  type Ligne = { objet: GrcObject; de?: number; a?: number; creation?: number | null };
  const groupes = grouperActions(dessinees, critere, { objet: (l) => l.objet, policy, responsable: ownerOf });
  const blocs = [
    ...groupes.map((g) => ({
      cle: `${critere}:${g.cle}`,
      libelle: g.libelle,
      entete: critere !== 'aucun',
      lignes: g.lignes as Ligne[],
    })),
    ...(frise.sansDate.length
      ? [
          {
            cle: SANS_DATE,
            libelle: 'Sans date à placer',
            entete: true,
            lignes: frise.sansDate.map((objet): Ligne => ({ objet })),
          },
        ]
      : []),
  ];
  const rangs: Rang[] = [];
  let y = 0;
  for (const b of blocs) {
    const ouvert = !b.entete || !replies.has(b.cle);
    if (b.entete) {
      const datees = b.lignes.filter((l) => l.de !== undefined && l.a !== undefined);
      rangs.push({
        type: 'groupe',
        cle: b.cle,
        libelle: b.libelle,
        nombre: b.lignes.length,
        ouvert,
        de: datees.length ? Math.min(...datees.map((l) => l.de!)) : undefined,
        a: datees.length ? Math.max(...datees.map((l) => l.a!)) : undefined,
        y,
        h: GROUPE,
      });
      y += GROUPE;
    }
    if (ouvert)
      for (const l of b.lignes) {
        // Une action dessinée dont des tâches sont datées prend une ligne plus haute : le fil des tâches passe sous le tube.
        const h = l.de !== undefined && aTachesDatees(l.objet) ? LIGNE_TACHES : LIGNE;
        rangs.push({
          type: 'action',
          cle: l.objet.id,
          objet: l.objet,
          de: l.de,
          a: l.a,
          creation: l.creation ?? null,
          y,
          h,
        });
        y += h;
      }
  }
  const hauteurCorps = Math.max(y, LIGNE);
  const clesGroupes = blocs.filter((b) => b.entete).map((b) => b.cle);
  const toutReplie = clesGroupes.length > 0 && clesGroupes.every((c) => replies.has(c));
  const basculerGroupe = (cle: string) =>
    setReplies((avant) => {
      const apres = new Set(avant);
      if (apres.has(cle)) apres.delete(cle);
      else apres.add(cle);
      return apres;
    });

  const comptes = compterParColonne(
    p.colonnes,
    frise.placees.map((pl) => jourDe(pl.objet.data.dueAt)),
  );
  const fondVisible = fond
    .map((j) => ({ ...j, jour: Date.parse(j.date + 'T00:00:00Z') }))
    .filter((j) => Number.isFinite(j.jour) && j.jour >= p.debut && j.jour < p.fin);
  const xAuj = x(maintenant);
  const occurrences = frise.placees.some((pl) => estOccurrence(pl.objet));
  // « Échéance seule » n'entre dans la légende que si au moins un losange est dessiné.
  const losanges = dessinees.some(
    (d) =>
      !estOccurrence(d.objet) &&
      d.creation === null &&
      !Number.isFinite(jourDe(d.objet.data.startAt)) &&
      Number.isFinite(jourDe(d.objet.data.dueAt)),
  );

  // Navigation : la frise défile dans sa région (période précédente ou suivante, retour à aujourd'hui).
  const visibleFrise = () => Math.max(120, (region.current?.clientWidth ?? 0) - (gauche.width || 0));
  const defiler = (gaucheCible: number) => {
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    region.current?.scrollTo({ left: Math.max(0, gaucheCible), behavior: reduit ? 'auto' : 'smooth' });
  };
  const versAujourdhui = () => defiler(xAuj - visibleFrise() / 3);
  // La frise s'ouvre sur aujourd'hui : à l'ouverture, au changement d'échelle et quand la période change (arrivée des
  // fiches), la ligne « Aujourd'hui » est amenée au premier tiers de la partie visible si elle n'y est pas. Une fois les
  // deux largeurs mesurées seulement : avant, l'échelle n'est pas la bonne.
  const place = useRef('');
  const placement = `${unite}:${p.debut}:${p.fin}`;
  useLayoutEffect(() => {
    const el = region.current;
    if (!el || !mesure.width || !gauche.width || place.current === placement) return;
    place.current = placement;
    const visible = el.clientWidth - gauche.width;
    if (xAuj < el.scrollLeft + 24 || xAuj > el.scrollLeft + visible - 24)
      el.scrollLeft = Math.max(0, xAuj - visible / 3);
  });

  const legendeEtats = policy.statuses.filter((s) =>
    s.id === 'cancelled' ? annulees === '1' : s.terminal ? terminees === '1' : true,
  );
  const noteMasquees = [
    nbTerminees ? pluriel(nbTerminees, 'terminée', 'terminées') : '',
    nbAnnulees ? pluriel(nbAnnulees, 'annulée', 'annulées') : '',
  ]
    .filter(Boolean)
    .join(' et ');

  return (
    <section className="timeline-studio frise" data-mode="actions">
      <DefsVerre />
      <InfobulleRepere infobulle={bulle.infobulle} />
      <div className="frise-barre">
        <span className="frise-barre__titre">Planning</span>
        <PeriodeAffichee debut={fr(p.debut)} fin={fr(p.fin - JOUR)} />
        <span className="frise-choix">
          <label htmlFor={idGroupe}>Regrouper par</label>
          <select id={idGroupe} value={critere} onChange={(e) => setGroupe(e.currentTarget.value)}>
            {(Object.keys(CRITERES_GROUPE) as CritereGroupe[]).map((k) => (
              <option key={k} value={k}>
                {CRITERES_GROUPE[k]}
              </option>
            ))}
          </select>
        </span>
        <span className="frise-espace" />
        <Segmente
          label="Échelle de la Timeline"
          options={(Object.keys(UNITES_FRISE) as UniteFrise[]).map((k) => ({
            value: k,
            label: UNITES_FRISE[k].libelle,
          }))}
          valeur={unite}
          onChange={setPas}
        />
        <Group gap="xs" role="group" aria-label="Navigation dans la période" className="frise-navigation">
          <ActionIcon
            variant="default"
            aria-label="Période précédente"
            onClick={() => defiler((region.current?.scrollLeft ?? 0) - visibleFrise() * 0.8)}
          >
            <span aria-hidden="true">‹</span>
          </ActionIcon>
          <Button variant="default" size="compact-sm" onClick={versAujourdhui}>
            Aujourd’hui
          </Button>
          <ActionIcon
            variant="default"
            aria-label="Période suivante"
            onClick={() => defiler((region.current?.scrollLeft ?? 0) + visibleFrise() * 0.8)}
          >
            <span aria-hidden="true">›</span>
          </ActionIcon>
        </Group>
        {clesGroupes.length > 0 && (
          <Button
            variant="default"
            size="compact-sm"
            onClick={() => setReplies(toutReplie ? new Set() : new Set(clesGroupes))}
          >
            {toutReplie ? 'Tout déplier' : 'Tout replier'}
          </Button>
        )}
      </div>
      <div className="frise-legende">
        <div
          className="timeline-legende frise-legende__items"
          role="group"
          aria-label="Légende : état de l’action, couleur et forme des repères"
        >
          {legendeEtats.map((s) => (
            <ElementLegende key={s.id} forme="carre" ton={tonStatut(policy, s.id)}>
              {s.label}
            </ElementLegende>
          ))}
          <ElementLegende forme="retard">En retard</ElementLegende>
          {losanges && <ElementLegende forme="losange">Échéance seule</ElementLegende>}
          {tachesDessinees && (
            <>
              <ElementLegende forme="tache-afaire">Tâche à faire</ElementLegende>
              <ElementLegende forme="tache-faite">Tâche faite</ElementLegende>
              <ElementLegende forme="tache-retard">Tâche en retard</ElementLegende>
            </>
          )}
          {occurrences && <ElementLegende icone="attendu">Occurrence</ElementLegende>}
          <TexteMasque>{LEGENDE_LUE + (losanges ? LEGENDE_LOSANGE : '')}</TexteMasque>
        </div>
        <div className="frise-legende__droite">
          {noteMasquees && (
            <span className="frise-legende__note">
              {noteMasquees} {nbTerminees + nbAnnulees > 1 ? 'masquées' : 'masquée'}
            </span>
          )}
          <div className="frise-bascules" role="group" aria-label="Affichage de la frise">
            <Bascule libelle="Terminées" coche={terminees === '1'} onChange={(v) => setTerminees(v ? '1' : '0')} />
            <Bascule libelle="Annulées" coche={annulees === '1'} onChange={(v) => setAnnulees(v ? '1' : '0')} />
            <Bascule
              libelle="Jours fériés"
              complement="en fond"
              coche={fondActif.feries}
              onChange={(v) => onFond('feries', v)}
            />
            <Bascule
              libelle="Autres calendriers"
              complement="en fond"
              coche={fondActif.autres}
              onChange={(v) => onFond('autres', v)}
            />
          </div>
        </div>
      </div>
      {(frise.tronquee || incoherentes.length > 0) && (
        <div className="frise-notes">
          {frise.tronquee && (
            <Alert color="orange" role="status">
              La période est limitée à deux ans pour rester lisible : les échéances plus lointaines ne sont pas
              dessinées
              {frise.horsPeriode.length
                ? ` (${frise.horsPeriode.length} action(s) hors période, listées ci-dessous)`
                : ''}
              .
            </Alert>
          )}
          {incoherentes.length > 0 && (
            <Alert color="red" role="alert" title="Dates à corriger : ces actions ne peuvent pas être placées">
              {incoherentes.map(({ objet, raison }) => (
                <Group key={objet.id} gap="xs">
                  <Text size="sm">
                    {objet.name} : {RAISON_DATE_LABELS[raison]}.
                  </Text>
                  <Button variant="subtle" size="compact-sm" onClick={() => onOpen(objet)}>
                    Corriger les dates
                  </Button>
                </Group>
              ))}
            </Alert>
          )}
        </div>
      )}
      <div
        ref={refRegion}
        className="grc-timeline frise-grille"
        role="region"
        tabIndex={0}
        aria-label="Timeline des actions, défilement possible dans les deux sens"
      >
        <div ref={gauche.ref} className="grc-timeline__etiquettes" role="group" aria-label="Intitulés des actions">
          <div className="grc-timeline__entete frise-cols">
            <span>Action</span>
            <span className="frise-col-resp">Resp.</span>
            <span className="frise-col-echeance">Échéance</span>
            <span className="frise-col-etat">État</span>
          </div>
          {rangs.map((r) =>
            r.type === 'groupe' ? (
              <button
                key={r.cle}
                type="button"
                className={survol === r.cle ? 'frise-groupe frise-survol' : 'frise-groupe'}
                aria-expanded={r.ouvert}
                onClick={() => basculerGroupe(r.cle)}
                onMouseEnter={() => setSurvol(r.cle)}
                onMouseLeave={() => setSurvol(null)}
                onFocus={() => setSurvol(r.cle)}
                onBlur={() => setSurvol(null)}
              >
                <span className="frise-groupe__fleche" aria-hidden="true">
                  {r.ouvert ? '▾' : '▸'}
                </span>
                <span className="frise-groupe__nom">{r.libelle}</span>
                <span className="frise-groupe__compte">{pluriel(r.nombre, 'action', 'actions')}</span>
              </button>
            ) : (
              <IntituleAction
                key={r.cle}
                objet={r.objet}
                policy={policy}
                maintenant={maintenant}
                annee={annee}
                responsable={ownerOf(r.objet)}
                haute={r.h === LIGNE_TACHES}
                survol={survol === r.cle}
                onSurvol={setSurvol}
                onOpen={onOpen}
              />
            ),
          )}
          {!rangs.length && <div className="frise-vide">Aucune action à dessiner avec ces filtres.</div>}
          <div className="frise-pied">{UNITES_FRISE[unite].pied}</div>
        </div>
        <div className="frise-temps">
          <div className="frise-temps__regle">
            <RegleTemps colonnes={p.colonnes} x={x} largeur={largeur} hauteur={ENTETE} aujourdhui={maintenant} />
          </div>
          <svg
            className="grc-timeline__frise"
            role="group"
            aria-label="Repères du début à l’échéance de chaque action"
            width={largeur}
            height={hauteurCorps}
            // Survol de toute la ligne : la rangée sous la souris (repère, libellé ou fond) se teinte avec son intitulé.
            onMouseMove={(e) => {
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
              const cle = rangs.find((r) => y >= r.y && y < r.y + r.h)?.cle ?? null;
              if (cle !== survol) setSurvol(cle);
            }}
            onMouseLeave={() => setSurvol(null)}
          >
            <g aria-hidden="true">
              {rangs.map((r) =>
                r.type === 'groupe' ? (
                  <rect
                    key={r.cle}
                    className={survol === r.cle ? 'frise-fond-groupe frise-survol' : 'frise-fond-groupe'}
                    x="0"
                    y={r.y}
                    width={largeur}
                    height={r.h}
                    onClick={() => basculerGroupe(r.cle)}
                  />
                ) : (
                  <rect
                    key={r.cle}
                    className={survol === r.cle ? 'grc-timeline__fond-ligne frise-survol' : 'grc-timeline__fond-ligne'}
                    x="0"
                    y={r.y}
                    width={largeur}
                    height={r.h}
                    onClick={() => onOpen(r.objet)}
                  />
                ),
              )}
              {rangs.map((r) => (
                <line
                  key={r.cle}
                  className="frise-separateur"
                  x1="0"
                  x2={largeur}
                  y1={r.y + r.h - 0.5}
                  y2={r.y + r.h - 0.5}
                />
              ))}
              {fondVisible.map((j) => (
                <rect
                  key={j.date + j.calendrier}
                  x={x(j.jour)}
                  y="0"
                  width={Math.max(2, parJour)}
                  height={hauteurCorps}
                  className={`grc-timeline__fond grc-timeline__fond--${j.famille}`}
                  data-fond={j.famille}
                >
                  <title>{`${fr(j.jour)} — ${j.label}`}</title>
                </rect>
              ))}
              {p.colonnes.map((c) => (
                <line key={c.debut} className="frise-trait" x1={x(c.debut)} x2={x(c.debut)} y1="0" y2={hauteurCorps} />
              ))}
              {rangs.map((r) =>
                r.type === 'groupe' && r.de !== undefined && r.a !== undefined ? (
                  <rect
                    key={r.cle}
                    className="frise-resume"
                    x={Math.max(0, x(r.de))}
                    y={r.y + r.h / 2 - 3}
                    width={Math.max(6, Math.min(largeur, x(r.a + JOUR)) - Math.max(0, x(r.de)))}
                    height="6"
                    rx="3"
                  />
                ) : null,
              )}
            </g>
            {rangs.map((r) =>
              r.type === 'action' && r.de !== undefined && r.a !== undefined ? (
                <RepereAction
                  key={r.cle}
                  objet={r.objet}
                  de={r.de}
                  a={r.a}
                  creation={r.creation ?? null}
                  y={r.y}
                  x={x}
                  largeur={largeur}
                  annee={annee}
                  policy={policy}
                  maintenant={maintenant}
                  survol={survol === r.cle}
                  onResultat={onResultat}
                  bulle={bulle}
                  onSurvol={setSurvol}
                  responsableDe={responsableDe}
                />
              ) : null,
            )}
            {xAuj >= 0 && xAuj <= largeur && (
              <line
                className="grc-timeline__aujourdhui"
                x1={xAuj}
                x2={xAuj}
                y1="0"
                y2={hauteurCorps}
                aria-hidden="true"
              />
            )}
          </svg>
          <div className="frise-temps__pied">
            <PiedTemps
              titre={UNITES_FRISE[unite].pied}
              colonnes={p.colonnes}
              comptes={comptes}
              x={x}
              largeur={largeur}
              hauteur={PIED}
            />
          </div>
        </div>
      </div>
      <div className="frise-notes">
        <ListeHors
          titre={`Hors de la période affichée (${frise.horsPeriode.length})`}
          objets={frise.horsPeriode}
          onOpen={onOpen}
        />
        <JoursDeFond jours={fondVisible} />
      </div>
    </section>
  );
}

export function TimelineStudio({
  items,
  series = [],
  occurrences = false,
  policy,
  onOpen,
  onResultat,
  ownerOf,
  fond = [],
  fondActif = { feries: false, autres: false },
  onFond = () => undefined,
  closes = false,
}: {
  items: GrcObject[];
  /** Séries récurrentes lisibles (Timeline des occurrences). */
  series?: GrcObject[];
  /** Vrai sur la page Tâches récurrentes : Timeline adaptée à la périodicité, regroupée par série. */
  occurrences?: boolean;
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onResultat: OuvrirResultat;
  ownerOf: (o: GrcObject) => string;
  /** Jours de fond (fériés, fermetures) : repères derrière les barres, sans effet sur les actions. */
  fond?: readonly JourFond[];
  /** Familles de jours de fond affichées, et leur bascule (placée dans la légende de la frise). */
  fondActif?: Readonly<Record<FamilleFond, boolean>>;
  onFond?: (famille: FamilleFond, actif: boolean) => void;
  /** Filtre « Afficher les actions closes » de la page : valeur par défaut des bascules Terminées et Annulées. */
  closes?: boolean;
}) {
  return occurrences ? (
    <FriseOccurrences
      items={items}
      series={series}
      policy={policy}
      onOpen={onOpen}
      onResultat={onResultat}
      ownerOf={ownerOf}
      fond={fond}
      fondActif={fondActif}
      onFond={onFond}
    />
  ) : (
    <FriseActions
      items={items}
      policy={policy}
      onOpen={onOpen}
      onResultat={onResultat}
      ownerOf={ownerOf}
      fond={fond}
      fondActif={fondActif}
      onFond={onFond}
      closes={closes}
    />
  );
}
