/* Graphe des périmètres : un arbre (parent → enfants) de cartes de synthèse. Les compteurs viennent du serveur
   (`GET /api/grc/perimetres/synthese`) : un compteur absent s'affiche « indisponible », jamais comme un zéro. La création
   passe par le même formulaire que la liste (même route, même identifiant) ; le graphe n'a pas de modèle propre.
   Présentation « graphe compact centré » (refonte Neon, lot 3) : cartes repliées au chargement, dépliées en largeur une à
   une par la commande centrée en bas, positions et liaisons recalculées sur les dimensions réelles des cartes, ensemble
   centré. Repliée, une carte garde ses commandes et ses alertes essentielles ; le détail complet reste à un clic. */
import { ActionIcon, Anchor, Badge, Button, Drawer, Group, Loader, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { NeonAnneau } from '@suivi/ui';
import { libelleTypePerimetre, type CartePerimetre, type Couverture, type CouvertureReferentiel } from '@suivi/shared';
import {
  cadrer,
  cheminFournisseur,
  cheminLien,
  disposer,
  HAUTEUR_FOURNISSEUR,
  LARGEUR_CARTE,
  LARGEUR_CARTE_DEPLIEE,
  LARGEUR_FOURNISSEUR,
  LARGEUR_VERTICALE,
  DEBORD_LIAISON,
  DECALAGE_FOURNISSEUR,
  MARGE_GRAPHE,
  partEnRetard,
  placerFournisseurs,
  pourcentageCouverture,
  type Place,
} from './disposition-perimetres';

export { disposer } from './disposition-perimetres';

/** Fiche du registre des fournisseurs : affichée « Fournisseur extérieur » à côté de l'arbre, sauf si un périmètre de type
    fournisseur la relie (elle est alors représentée par ce périmètre). */
export interface FournisseurRattache {
  id: string;
  name: string;
  scopes: string[];
  /** « Oui » : fournisseur critique (case de la fiche du registre). */
  critical?: string;
}

const n = (v: number) => v.toLocaleString('fr-FR');
const retard = (c: { ouverts: number; enRetard: number }) => `${n(c.ouverts)} ouverte(s) · ${n(c.enRetard)} en retard`;
/** Page de pilotage du périmètre d'une carte : le périmètre est repris de l'adresse, la liste est celle du module. */
const vers = (section: string, id: string, filtre = '') => `/pilotage/${section}?perimetre=${id}${filtre}`;
const INDISPONIBLE = 'indisponible';

interface LigneCompteur {
  libelle: string;
  valeur: ReactNode;
  alerte: boolean;
  detail?: ReactNode;
  /** Valeur mise en avant dans la carte dépliée, sans remplacer le libellé ni le lien du compteur. */
  chiffre?: number;
  sousTitre?: string;
  jauge?: { ouverts: number; enRetard: number };
}
const CLASSES = [
  ['majeure', 'Majeurs', 'red'],
  ['mineure', 'Mineurs', 'orange'],
  ['point_sensible', 'Sensibles', 'violet'],
] as const;

/** Une ligne par référentiel (et version) : testées ou validées sur applicables, avec sa provenance (carte seule : rattaché ici
    ou hérité de tel parent) ou le nombre de périmètres comptés (total avec sous-périmètres). */
function ligneReferentiel(f: CouvertureReferentiel, agrege: boolean): string {
  const base = `${f.nom} v${f.version} : ${n(f.testees)} testées ou validées / ${n(f.applicables)} applicables`;
  const aDeterminer = f.aDeterminer ? ` · ${n(f.aDeterminer)} à déterminer` : '';
  if (agrege) return `${base}${aDeterminer} · ${n(f.perimetres)} périmètre(s)`;
  if (f.provenance === 'herite')
    return `${base}${aDeterminer} · hérité ${f.origine ? `de ${f.origine}` : 'd’un périmètre parent non accessible'}`;
  return `${base}${aDeterminer} · rattaché ici`;
}
function detailCouverture(c: Couverture): ReactNode {
  const agrege = c.perimetres > 1;
  return (
    <Stack gap="2xs" role="group" aria-label="Couverture par référentiel">
      {agrege && (
        <Text size="xs">
          Somme sur {n(c.perimetres)} périmètre(s) : une exigence compte une fois par périmètre où elle est évaluée
          {c.nonLus ? ` · ${n(c.nonLus)} périmètre(s) non lisible(s), exclu(s)` : ''}
        </Text>
      )}
      {c.parReferentiel.map((f) => (
        <Text key={`${f.referentielId}:${f.version}`} size="xs">
          {ligneReferentiel(f, agrege)}
        </Text>
      ))}
    </Stack>
  );
}

/** Navigation de carte : aspect neutre, flèche et focus visibles plutôt qu'un lien violet souligné. */
function LienCompteur({ to, children, libelle }: { to: string; children: ReactNode; libelle?: string }) {
  return (
    <Anchor component={Link} to={to} underline="never" className="perimetre-lien" aria-label={libelle}>
      <span>{children}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </Anchor>
  );
}

/** Badges des écarts ouverts par classification ; liens vers la liste filtrée du même périmètre. */
function ClassesEcarts({
  ecarts,
  id,
  liens = true,
}: {
  ecarts: NonNullable<CartePerimetre['compteurs']['ecarts']>;
  id: string;
  liens?: boolean;
}) {
  return (
    <Group
      gap="2xs"
      wrap="wrap"
      role="group"
      aria-label="Écarts ouverts par classification"
      className="perimetre-classes"
    >
      {CLASSES.map(([cle, libelle, couleur]) =>
        liens ? (
          <Badge
            key={cle}
            component={Link}
            to={vers('amelioration', id, `&classif=${cle}`)}
            size="xs"
            variant="light"
            color={couleur}
          >
            {libelle} {n(ecarts.parClassification[cle])}
          </Badge>
        ) : (
          <Badge key={cle} size="xs" variant="light" color={couleur}>
            {libelle} {n(ecarts.parClassification[cle])}
          </Badge>
        ),
      )}
      {ecarts.parClassification.non_classe > 0 && (
        <Badge size="xs" variant="outline" color="gray">
          Non classés {n(ecarts.parClassification.non_classe)}
        </Badge>
      )}
    </Group>
  );
}

/** Lignes de compteurs d'une carte ; `null` : indisponible (droit manquant ou donnée non mesurable). Un compteur est un lien
    vers la liste du module, dans le même périmètre : les chiffres d'une carte se retrouvent à l'identique dans la liste.
    `court` : libellé visible abrégé (carte dépliée), la formule complète restant le nom accessible du lien. */
function lignesCompteurs(c: CartePerimetre['compteurs'], id: string, liens = true, court = false): LigneCompteur[] {
  const lien = (section: string, texte: string, abrege?: string) =>
    liens ? (
      <LienCompteur to={vers(section, id)} libelle={court && abrege ? texte : undefined}>
        {court && abrege ? abrege : texte}
      </LienCompteur>
    ) : (
      texte
    );
  return [
    {
      libelle: 'Actions',
      chiffre: c.actions?.ouverts,
      sousTitre: 'ouvertes',
      jauge: c.actions ?? undefined,
      valeur: c.actions ? lien('actions', retard(c.actions), `${n(c.actions.enRetard)} en retard`) : INDISPONIBLE,
      alerte: !!c.actions && c.actions.enRetard > 0,
    },
    {
      libelle: 'Tâches récurrentes',
      chiffre: c.recurrentes?.occurrences.ouverts,
      sousTitre: 'occurrences ouvertes',
      jauge: c.recurrentes?.occurrences,
      valeur: c.recurrentes
        ? lien(
            'recurrences',
            `${n(c.recurrentes.series)} série(s) · ${retard(c.recurrentes.occurrences)}`,
            `${n(c.recurrentes.series)} série(s) · ${n(c.recurrentes.occurrences.enRetard)} en retard`,
          )
        : INDISPONIBLE,
      alerte: !!c.recurrentes && c.recurrentes.occurrences.enRetard > 0,
    },
    {
      libelle: 'Écarts ouverts',
      chiffre: c.ecarts?.ouverts,
      sousTitre: 'non clos',
      jauge: c.ecarts ?? undefined,
      valeur: c.ecarts ? lien('amelioration', retard(c.ecarts), `${n(c.ecarts.enRetard)} en retard`) : INDISPONIBLE,
      alerte: !!c.ecarts && c.ecarts.enRetard > 0,
      detail: c.ecarts && <ClassesEcarts ecarts={c.ecarts} id={id} liens={liens} />,
    },
    {
      libelle: 'Continuité',
      chiffre: c.continuite?.plans,
      sousTitre: 'plan(s)',
      valeur: c.continuite ? lien('continuite', `${n(c.continuite.plans)} plan(s) de continuité`) : INDISPONIBLE,
      alerte: false,
    },
    {
      libelle: 'Couverture',
      valeur: c.couverture
        ? lien(
            'couverture',
            `${n(c.couverture.testees)} testées ou validées / ${n(c.couverture.applicables)} applicables${
              c.couverture.aDeterminer ? ` · ${n(c.couverture.aDeterminer)} à déterminer (à revoir)` : ''
            }${
              c.couverture.obligatoiresNonConformes
                ? ` · ${n(c.couverture.obligatoiresNonConformes)} clause(s) obligatoire(s) pas encore conforme(s)`
                : ''
            }`,
          )
        : INDISPONIBLE,
      alerte: !!c.couverture && (c.couverture.aDeterminer > 0 || c.couverture.obligatoiresNonConformes > 0),
      detail: c.couverture && detailCouverture(c.couverture),
    },
  ];
}

/** Part des éléments ouverts en retard. Un dénominateur nul garde une piste vide, jamais un taux inventé. */
function JaugeRetard({ ouverts, enRetard }: { ouverts: number; enRetard: number }) {
  return (
    <svg
      className="perimetre-retard"
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${n(enRetard)} en retard parmi ${n(ouverts)} ouverts`}
    >
      <rect width="100" height="4" rx="2" className="perimetre-retard-piste" />
      <rect width={partEnRetard({ ouverts, enRetard })} height="4" rx="2" className="perimetre-retard-valeur" />
    </svg>
  );
}

/** Pictogramme d'alerte (triangle), décoratif : le texte voisin porte l'information. */
function Vigilance() {
  return (
    <svg className="perimetre-icone" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.3 4.6a2 2 0 0 1 3.4 0l8 13.9a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3ZM12 9v5m0 3h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CouvertureCarte({
  couverture,
  id,
  compacte = false,
}: {
  couverture: Couverture | null;
  id: string;
  compacte?: boolean;
}) {
  if (!couverture)
    return (
      <section className="perimetre-couverture perimetre-couverture--vide" aria-label="Couverture indisponible">
        {!compacte && (
          <span className="perimetre-anneau-vide" aria-hidden="true">
            —
          </span>
        )}
        <div>
          <strong>Couverture</strong>
          <p>{INDISPONIBLE}</p>
          <small>Aucun référentiel effectif ou droit de lecture absent.</small>
        </div>
      </section>
    );
  return (
    <section className="perimetre-couverture" aria-label="Couverture des exigences du périmètre">
      {!compacte && (
        <NeonAnneau
          titre="Exigences testées ou validées"
          valeur={couverture.testees}
          total={couverture.applicables}
          detail="couverture"
        />
      )}
      <div>
        <strong>Couverture des exigences</strong>
        <LienCompteur to={vers('couverture', id)}>
          {n(couverture.testees)} testées ou validées / {n(couverture.applicables)} applicables
        </LienCompteur>
        <p>
          {n(couverture.referentiels)} référentiel(s) · {n(couverture.exigences)} exigence(s)
        </p>
        <small>Évaluation renseignée, pas un taux de conformité.</small>
        {(couverture.aDeterminer > 0 || couverture.obligatoiresNonConformes > 0) && (
          <p className="graphe-alerte">
            {n(couverture.aDeterminer)} à déterminer · {n(couverture.obligatoiresNonConformes)} clause(s) obligatoire(s)
            à traiter
          </p>
        )}
      </div>
    </section>
  );
}

/** Résumé visible même replié : couverture, actions et écarts ouverts ; les valeurs absentes ne deviennent jamais des zéros. */
function ResumeCarte({ carte }: { carte: CartePerimetre }) {
  const { couverture, actions, ecarts } = carte.compteurs;
  const pourcentage = pourcentageCouverture(couverture);
  const absent = (libelle: string) => (
    <span className="perimetre-resume-valeur" title={`${libelle} : ${INDISPONIBLE}`}>
      <b>—</b> <small>{INDISPONIBLE}</small>
    </span>
  );
  const point = (enRetard: number) =>
    enRetard > 0 && <span className="perimetre-point-retard" role="img" aria-label={`${n(enRetard)} en retard`} />;
  const compteur = (section: string, libelle: string, c: { ouverts: number; enRetard: number }) => (
    <LienCompteur to={vers(section, carte.id)} libelle={`${libelle} : ${retard(c)}`}>
      <b>{n(c.ouverts)}</b> <small>ouverte(s) · {n(c.enRetard)} en retard</small>
    </LienCompteur>
  );
  return (
    <dl className="perimetre-resume">
      <div className="perimetre-resume-couverture" data-indisponible={!couverture || undefined}>
        <dt>Couverture</dt>
        <dd>
          {couverture ? (
            <LienCompteur
              to={vers('couverture', carte.id)}
              libelle={`Couverture : ${n(couverture.testees)} testées ou validées / ${n(couverture.applicables)} applicables`}
            >
              <b>
                {pourcentage === null ? '—' : n(pourcentage)}
                {pourcentage !== null && <small> %</small>}
              </b>{' '}
              <small>
                {n(couverture.testees)} / {n(couverture.applicables)} testées
              </small>
            </LienCompteur>
          ) : (
            absent('Couverture')
          )}
        </dd>
      </div>
      <div data-alerte={(actions?.enRetard ?? 0) > 0 || undefined}>
        <dt>Actions {actions && point(actions.enRetard)}</dt>
        <dd>{actions ? compteur('actions', 'Actions', actions) : absent('Actions')}</dd>
      </div>
      <div data-alerte={(ecarts?.enRetard ?? 0) > 0 || undefined}>
        <dt>Écarts {ecarts && point(ecarts.enRetard)}</dt>
        <dd>{ecarts ? compteur('amelioration', 'Écarts', ecarts) : absent('Écarts')}</dd>
      </div>
    </dl>
  );
}

/** Carte dépliée : trois zones de lecture, alimentées par les mêmes compteurs et liens que le panneau Détail. */
function DetailsCarte({ carte }: { carte: CartePerimetre }) {
  const lignes = lignesCompteurs(carte.compteurs, carte.id, true, true);
  const compteur = (libelle: string) => {
    const l = lignes.find((ligne) => ligne.libelle === libelle)!;
    return (
      <div
        className="perimetre-indicateur"
        data-compteur={l.libelle}
        data-alerte={l.alerte || undefined}
        key={l.libelle}
      >
        <dt>{l.libelle}</dt>
        {l.chiffre !== undefined && (
          <dd className="perimetre-chiffre">
            <b>{n(l.chiffre)}</b>
            <small>{l.sousTitre}</small>
          </dd>
        )}
        <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
        {l.jauge && (
          <dd className="perimetre-jauge">
            <JaugeRetard {...l.jauge} />
          </dd>
        )}
        {l.detail && <dd className="graphe-detail">{l.detail}</dd>}
      </div>
    );
  };
  return (
    <div className="perimetre-details-colonnes">
      <section className="perimetre-detail-colonne perimetre-detail-couverture" aria-label="Couverture">
        <CouvertureCarte couverture={carte.compteurs.couverture} id={carte.id} compacte />
      </section>
      <section className="perimetre-detail-colonne" aria-label="Activité et continuité">
        <h3>Activité et continuité</h3>
        <dl className="graphe-compteurs perimetre-indicateurs">
          {compteur('Tâches récurrentes')}
          {compteur('Continuité')}
        </dl>
      </section>
      <section className="perimetre-detail-colonne" aria-label="Écarts et actions">
        <h3>Écarts et actions</h3>
        <dl className="graphe-compteurs perimetre-indicateurs">
          {compteur('Écarts ouverts')}
          {compteur('Actions')}
        </dl>
      </section>
    </div>
  );
}

/** Total du périmètre avec ses sous-périmètres, chaque élément une seule fois (jamais la somme des cartes). */
function SousTotal({ carte }: { carte: CartePerimetre }) {
  return (
    <div
      className="graphe-ensemble"
      role="group"
      aria-label={`Total de ${carte.name} avec ses sous-périmètres, chaque élément une seule fois`}
    >
      <details className="perimetre-sous-total">
        <summary>
          Total avec {n(carte.sousPerimetres)} sous-périmètre(s)
          <span>Sans doublon · voir les compteurs</span>
        </summary>
        <dl className="graphe-compteurs">
          {lignesCompteurs(carte.total, carte.id, false).map((l) => (
            <div key={l.libelle}>
              <dt>{l.libelle}</dt>
              <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
              {l.libelle === 'Couverture' && l.detail && <dd className="graphe-detail">{l.detail}</dd>}
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

/** Commandes d'une carte, avec les mêmes noms accessibles que la liste : pictogrammes dans la carte repliée, libellés dans
    la carte dépliée. Chaque commande n'existe qu'une fois par carte. */
function CommandesCarte({
  carte,
  libelles,
  onDetail,
  onModifier,
  onCreerEnfant,
}: {
  carte: CartePerimetre;
  libelles: boolean;
  onDetail: () => void;
  onModifier?: (id: string) => void;
  onCreerEnfant?: (parentId: string) => void;
}) {
  const commandes = [
    { cle: 'detail', texte: 'Détail', nom: `Détail des compteurs de ${carte.name}`, action: onDetail, trace: DETAIL },
    ...(onModifier
      ? [
          {
            cle: 'modifier',
            texte: 'Modifier',
            nom: `Modifier le périmètre ${carte.name}`,
            action: () => onModifier(carte.id),
            trace: MODIFIER,
          },
        ]
      : []),
    ...(onCreerEnfant
      ? [
          {
            cle: 'enfant',
            texte: 'Ajouter un enfant',
            nom: `Ajouter un périmètre enfant à ${carte.name}`,
            action: () => onCreerEnfant(carte.id),
            trace: ENFANT,
          },
        ]
      : []),
  ];
  if (libelles)
    return (
      <Group gap="2xs" wrap="wrap" className="perimetre-actions">
        {commandes.map((c) => (
          <Button
            key={c.cle}
            size="compact-xs"
            variant={c.cle === 'detail' ? 'light' : 'default'}
            aria-label={c.nom}
            onClick={c.action}
          >
            {c.texte}
          </Button>
        ))}
      </Group>
    );
  return (
    <Group gap="2xs" wrap="nowrap" className="perimetre-commandes">
      {commandes.map((c) => (
        <ActionIcon key={c.cle} size="sm" variant="default" aria-label={c.nom} title={c.texte} onClick={c.action}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={c.trace} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </ActionIcon>
      ))}
    </Group>
  );
}
const DETAIL = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9.5v.01';
const MODIFIER = 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4';
const ENFANT = 'M7 4v6a3 3 0 0 0 3 3h4m-3-3 3 3-3 3M18 17v-4m-2 2h4';

export function CartesPerimetres({
  cartes,
  total,
  affiche,
  onChoisir,
  onCreerEnfant,
  onModifier,
  fournisseurs,
  chargement,
}: {
  cartes: readonly CartePerimetre[];
  /** Total sans doublon sur l'ensemble des périmètres accessibles (jamais la somme des cartes). */
  total?: CartePerimetre['compteurs'];
  affiche: string;
  onChoisir: (id: string) => void;
  /** Absent : la personne ne peut pas créer de périmètre. */
  onCreerEnfant?: (parentId: string) => void;
  /** Absent : la personne ne peut pas modifier de périmètre. Même formulaire que la liste. */
  onModifier?: (id: string) => void;
  /** Absent : la personne ne peut pas lire les fournisseurs (la colonne n'est pas affichée). */
  fournisseurs?: readonly FournisseurRattache[];
  chargement?: boolean;
}) {
  const identifiant = useId();
  const [detail, setDetail] = useState<string | null>(null);
  const [depliees, setDepliees] = useState<ReadonlySet<string>>(() => new Set());
  const [hauteurs, setHauteurs] = useState<Record<string, number>>({});
  const [largeurZone, setLargeurZone] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const [arret, setArret] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const zone = useRef<HTMLDivElement>(null);
  const glissement = useRef<{ x: number; y: number; origine: { x: number; y: number } } | null>(null);
  const noeuds = useRef(new Map<string, HTMLDivElement>());
  const observateur = useRef<ResizeObserver | null>(null);

  /** Hauteur réelle des cartes (contenu, police, dépliage) : la disposition suit, sans défilement interne. */
  const relever = useCallback((elements: Iterable<Element>) => {
    setHauteurs((avant) => {
      let apres = avant;
      for (const element of elements) {
        const id = (element as HTMLElement).dataset.perimetreId;
        const h = Math.ceil((element as HTMLElement).offsetHeight);
        if (!id || h <= 0 || h === avant[id]) continue;
        if (apres === avant) apres = { ...avant };
        apres[id] = h;
      }
      return apres;
    });
  }, []);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entrees) => relever(entrees.map((e) => e.target)));
    observateur.current = observer;
    noeuds.current.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      observateur.current = null;
    };
  }, [relever]);
  // Mesure après chaque rendu, avant l'affichage : une carte dépliée ou un texte long repositionne aussitôt ses voisines.
  useLayoutEffect(() => relever(noeuds.current.values()));
  const sansCarte = !cartes.length;
  useLayoutEffect(() => {
    const element = zone.current;
    if (!element) return;
    setLargeurZone(Math.floor(element.clientWidth));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entree]) => {
      if (!entree) return;
      setLargeurZone(Math.floor(entree.contentRect.width));
      setDecalage({ x: 0, y: 0 });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [chargement, sansCarte]);
  const enregistrer = (id: string, element: HTMLDivElement | null) => {
    const ancien = noeuds.current.get(id);
    if (ancien && ancien !== element) observateur.current?.unobserve(ancien);
    if (element) {
      noeuds.current.set(id, element);
      observateur.current?.observe(element);
    } else noeuds.current.delete(id);
  };
  // Carte qui vient d'être dépliée ou repliée : ramenée dans la partie visible de la zone si celle-ci défile.
  const aMontrer = useRef<string | null>(null);
  useEffect(() => {
    const id = aMontrer.current,
      cadre = zone.current,
      carte = id ? noeuds.current.get(id) : undefined;
    if (!cadre || !carte) return;
    aMontrer.current = null;
    const z = cadre.getBoundingClientRect(),
      c = carte.getBoundingClientRect();
    if (c.left < z.left) cadre.scrollLeft += c.left - z.left - 8;
    else if (c.right > z.right) cadre.scrollLeft += Math.min(c.right - z.right + 8, c.left - z.left - 8);
  });
  const basculer = (id: string) => {
    setDepliees((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
    setDecalage({ x: 0, y: 0 });
    aMontrer.current = id;
  };

  const vertical = largeurZone > 0 && largeurZone < LARGEUR_VERTICALE;
  const largeurCarte = vertical ? Math.max(200, Math.min(LARGEUR_CARTE, largeurZone - 80)) : LARGEUR_CARTE;
  const largeurDepliee = vertical
    ? Math.max(200, Math.min(LARGEUR_CARTE_DEPLIEE, largeurZone - 80))
    : LARGEUR_CARTE_DEPLIEE;
  // Fournisseurs reliés à un périmètre de type fournisseur : représentés par ce périmètre, pas en colonne extérieure.
  const relies = new Set(cartes.map((c) => c.supplierId).filter((id): id is string => !!id));
  const affichables = (fournisseurs ?? []).filter(
    (f) => !relies.has(f.id) && f.scopes.some((id) => cartes.some((c) => c.id === id)),
  );
  const {
    places,
    largeur: largeurArbre,
    hauteur: hauteurArbre,
  } = disposer(cartes, hauteurs, {
    vertical,
    largeurCarte,
    largeurs: Object.fromEntries(cartes.filter((c) => depliees.has(c.id)).map((c) => [c.id, largeurDepliee])),
    largeurMax:
      largeurZone > 0
        ? Math.max(
            largeurCarte,
            largeurZone - MARGE_GRAPHE * 2 - (affichables.length ? LARGEUR_FOURNISSEUR + DECALAGE_FOURNISSEUR : 0),
          )
        : undefined,
  });
  if (chargement) return <Loader size="sm" aria-label="Chargement du graphe des périmètres" />;
  if (!places.length) return <Text>Aucun périmètre accessible.</Text>;

  const fiche = (id: string | null) => (id ? (fournisseurs ?? []).find((f) => f.id === id) : undefined);
  const parId = new Map(places.map((p) => [p.carte.id, p]));
  const {
    placees: placesFournisseurs,
    colonneX,
    bas: basFournisseurs,
  } = placerFournisseurs(affichables, places, { vertical, largeurArbre, hauteurArbre });
  // En hiérarchie verticale, les liaisons des fournisseurs passent à droite de l'arbre : le dessin entier est centré.
  const largeur = placesFournisseurs.length
    ? Math.max(largeurArbre + (vertical ? DEBORD_LIAISON : 0), colonneX + LARGEUR_FOURNISSEUR)
    : largeurArbre;
  const hauteur = Math.max(hauteurArbre, basFournisseurs);
  const { echelle, ajustee, largeurCadre, hauteurCadre, origineX, origineY } = cadrer({
    largeurZone,
    largeur,
    hauteur,
    zoom,
    vertical,
    decalage,
  });
  const deplacer = (x: number, y: number) => setDecalage((avant) => ({ x: avant.x + x, y: avant.y + y }));
  const centrer = () => setDecalage({ x: 0, y: 0 });
  const ajuster = () => {
    setZoom(ajustee);
    centrer();
  };
  const initiale = () => {
    setZoom(null);
    centrer();
  };
  const detailCarte = cartes.find((c) => c.id === detail);
  const liens = places.filter((p) => p.parent && parId.has(p.parent));

  return (
    <>
      <section className="perimetres-graphe-compact" aria-label="Présentation graphique des périmètres">
        {total && (
          <section className="graphe-total" aria-label="Total sans doublon sur tous les périmètres accessibles">
            <div className="perimetres-synthese-titre">
              <strong>Synthèse globale</strong>
              <small>
                Chaque élément n’est compté qu’une fois : un registre partagé entre plusieurs périmètres figure dans
                chacune de leurs cartes, mais une seule fois ici.
              </small>
            </div>
            <dl>
              {lignesCompteurs(total, affiche, false)
                .filter((l) => l.libelle !== 'Couverture')
                .map((l) => (
                  <div key={l.libelle}>
                    <dt>{l.libelle}</dt>
                    <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}
        <section className="perimetres-graphe-panneau" aria-label="Vue graphe des périmètres">
          <div className="perimetres-graphe-barre">
            <div className="perimetres-graphe-titre">
              <strong>{n(places.length)} périmètre(s) dans le graphe</strong>
              <small>
                {n(liens.length)} lien(s) hiérarchique(s)
                {placesFournisseurs.length > 0 && ` · ${n(placesFournisseurs.length)} fournisseur(s) extérieur(s)`}
              </small>
            </div>
            <Group gap="2xs" className="perimetres-graphe-commandes">
              <Button size="compact-xs" variant="default" aria-pressed={arret} onClick={() => setArret((a) => !a)}>
                {arret ? 'Reprendre le flux' : 'Mettre le flux en pause'}
              </Button>
              <Button
                size="compact-xs"
                variant="default"
                disabled={!cartes.some((c) => depliees.has(c.id))}
                onClick={() => {
                  setDepliees(new Set());
                  centrer();
                }}
              >
                Tout replier
              </Button>
              <Button size="compact-xs" variant="light" onClick={centrer}>
                Centrer
              </Button>
            </Group>
          </div>
          <div
            ref={zone}
            className="perimetres-graphe-zone"
            role="region"
            aria-label="Graphe des périmètres"
            aria-describedby={`${identifiant}-aide`}
            tabIndex={0}
            onPointerDown={(e) => {
              if (
                e.pointerType === 'touch' ||
                e.button !== 0 ||
                (e.target as Element).closest('[data-perimetre-id],.graphe-fournisseur')
              )
                return;
              glissement.current = { x: e.clientX, y: e.clientY, origine: decalage };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const depart = glissement.current;
              if (depart)
                setDecalage({ x: depart.origine.x + e.clientX - depart.x, y: depart.origine.y + e.clientY - depart.y });
            }}
            onPointerUp={() => {
              glissement.current = null;
            }}
            onPointerCancel={() => {
              glissement.current = null;
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              const fleches: Record<string, [number, number]> = {
                ArrowLeft: [40, 0],
                ArrowRight: [-40, 0],
                ArrowUp: [0, 40],
                ArrowDown: [0, -40],
              };
              if (fleches[e.key]) {
                e.preventDefault();
                deplacer(...fleches[e.key]!);
              }
              if (e.key === 'Home') {
                e.preventDefault();
                initiale();
              }
            }}
            onFocusCapture={(e) => {
              // Une commande atteinte au clavier hors du cadre y est ramenée.
              if (e.target === e.currentTarget) return;
              const cadre = e.currentTarget.getBoundingClientRect(),
                cible = e.target.getBoundingClientRect();
              const x =
                cible.left < cadre.left + 8
                  ? cadre.left + 8 - cible.left
                  : cible.right > cadre.right - 8
                    ? cadre.right - 8 - cible.right
                    : 0;
              const y =
                cible.top < cadre.top + 8
                  ? cadre.top + 8 - cible.top
                  : cible.bottom > cadre.bottom - 8
                    ? cadre.bottom - 8 - cible.bottom
                    : 0;
              if (x || y) deplacer(x, y);
            }}
          >
            <svg
              className="graphe-perimetres"
              width={largeurCadre}
              height={hauteurCadre}
              viewBox={`0 0 ${largeurCadre} ${hauteurCadre}`}
              role="group"
              aria-label="Périmètres et leurs compteurs de synthèse"
            >
              <defs>
                <marker
                  id="graphe-fleche"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path className="graphe-fleche" d="M0 0 L10 5 L0 10 z" />
                </marker>
              </defs>
              <g transform={`translate(${origineX} ${origineY}) scale(${echelle})`}>
                {liens.map((p) => (
                  <path
                    key={p.carte.id}
                    className={arret ? 'graphe-lien' : 'graphe-lien graphe-lien--flux'}
                    d={cheminLien(parId.get(p.parent!)!, p, vertical)}
                    fill="none"
                    markerEnd="url(#graphe-fleche)"
                    aria-hidden="true"
                  />
                ))}
                {placesFournisseurs.flatMap(({ fournisseur: f, x, y }) =>
                  f.scopes
                    .map((id) => parId.get(id))
                    .filter((p): p is Place => !!p)
                    .map((p) => (
                      <path
                        key={`${f.id}-${p.carte.id}`}
                        className="graphe-lien-fournisseur"
                        d={cheminFournisseur(p, { x, y }, { vertical, largeurArbre })}
                        fill="none"
                        aria-hidden="true"
                      />
                    )),
                )}
                {placesFournisseurs.map(({ fournisseur: f, x, y }) => (
                  <foreignObject key={f.id} x={x} y={y} width={LARGEUR_FOURNISSEUR} height={HAUTEUR_FOURNISSEUR}>
                    <div className="graphe-carte graphe-fournisseur" role="group" aria-label={`Fournisseur ${f.name}`}>
                      <Text size="xs" className="graphe-fournisseur-type">
                        Fournisseur extérieur
                      </Text>
                      <Anchor component={Link} to="/pilotage/fournisseurs" size="sm" fw={600} title={f.name}>
                        {f.name}
                      </Anchor>
                    </div>
                  </foreignObject>
                ))}
                {places.map(({ carte, x, y, hauteur: hauteurCarte, largeur: largeurDalle }) => {
                  const deplie = depliees.has(carte.id);
                  const lie = fiche(carte.supplierId);
                  const couverture = carte.compteurs.couverture;
                  const vigilance =
                    !!couverture && (couverture.aDeterminer > 0 || couverture.obligatoiresNonConformes > 0);
                  return (
                    <foreignObject
                      key={carte.id}
                      x={x}
                      y={y}
                      width={largeurDalle}
                      height={hauteurCarte}
                      overflow="visible"
                    >
                      <div
                        ref={(element) => enregistrer(carte.id, element)}
                        data-perimetre-id={carte.id}
                        data-deplie={deplie}
                        data-actif={carte.id === affiche || undefined}
                        className={
                          carte.entityKind === 'fournisseur'
                            ? 'graphe-carte perimetre-dalle graphe-carte--fournisseur'
                            : 'graphe-carte perimetre-dalle'
                        }
                        role="group"
                        aria-label={`Périmètre ${carte.name}`}
                      >
                        <header className="perimetre-entete">
                          <Text size="xs" className="perimetre-sur-titre">
                            {libelleTypePerimetre(carte.entityKind)}
                            {lie ? ` · fiche ${lie.name}` : ''}
                          </Text>
                          {lie?.critical === 'Oui' && (
                            <Badge size="xs" color="red" variant="light">
                              Critique
                            </Badge>
                          )}
                          {carte.id === affiche && (
                            <Badge size="xs" variant="light">
                              Affiché
                            </Badge>
                          )}
                        </header>
                        <div className="perimetre-principal">
                          <Text className="perimetre-titre">{carte.name}</Text>
                          <ResumeCarte carte={carte} />
                        </div>
                        {!deplie && carte.compteurs.ecarts && carte.compteurs.ecarts.ouverts > 0 && (
                          <ClassesEcarts ecarts={carte.compteurs.ecarts} id={carte.id} />
                        )}
                        <div id={`${identifiant}-${carte.id}`} hidden={!deplie}>
                          {deplie && (
                            <div className="perimetre-corps" role="region" aria-label={`Indicateurs de ${carte.name}`}>
                              <DetailsCarte carte={carte} />
                            </div>
                          )}
                        </div>
                        {carte.sousPerimetres > 0 && <SousTotal carte={carte} />}
                        {vigilance && (
                          <p className="perimetre-vigilance">
                            <Vigilance />
                            <span>
                              {n(couverture.obligatoiresNonConformes)} clause(s) obligatoire(s) à traiter
                              {couverture.aDeterminer > 0 && ` · ${n(couverture.aDeterminer)} à déterminer`}
                            </span>
                          </p>
                        )}
                        {deplie && (
                          <CommandesCarte
                            carte={carte}
                            libelles
                            onDetail={() => setDetail(carte.id)}
                            onModifier={onModifier}
                            onCreerEnfant={onCreerEnfant}
                          />
                        )}
                        <footer className="perimetre-pied">
                          <div className="perimetre-pied-gauche">
                            {deplie ? (
                              <small>
                                {carte.sousPerimetres > 0
                                  ? `${n(carte.sousPerimetres)} sous-périmètre(s)`
                                  : 'Données propres au périmètre'}
                              </small>
                            ) : (
                              <CommandesCarte
                                carte={carte}
                                libelles={false}
                                onDetail={() => setDetail(carte.id)}
                                onModifier={onModifier}
                                onCreerEnfant={onCreerEnfant}
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            className="perimetre-deplier"
                            aria-label={`${deplie ? 'Replier' : 'Déplier'} la carte ${carte.name}`}
                            aria-expanded={deplie}
                            aria-controls={`${identifiant}-${carte.id}`}
                            onClick={() => basculer(carte.id)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d={deplie ? 'M5 12h14' : 'M5 12h14 M12 5v14'}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              />
                            </svg>
                          </button>
                          <div className="perimetre-pied-droite">
                            {carte.id === affiche ? (
                              <small>Périmètre affiché</small>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Afficher le périmètre ${carte.name} dans le Pilotage`}
                                onClick={() => onChoisir(carte.id)}
                              >
                                Afficher <span aria-hidden="true">→</span>
                              </button>
                            )}
                          </div>
                        </footer>
                      </div>
                    </foreignObject>
                  );
                })}
              </g>
            </svg>
          </div>
          <div className="perimetres-graphe-legende">
            <span>
              <i aria-hidden="true" />
              Lien parent / enfant
            </span>
            {placesFournisseurs.length > 0 && (
              <span>
                <i className="exterieur" aria-hidden="true" />
                Fournisseur extérieur
              </span>
            )}
            <span>＋ en bas de carte : déplier en largeur</span>
            <Group gap="2xs" className="perimetres-graphe-zoom">
              <Button
                size="compact-xs"
                variant="subtle"
                aria-label="Réduire le graphe"
                onClick={() => {
                  setZoom(Math.max(0.1, echelle / 1.25));
                  centrer();
                }}
              >
                −
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                aria-label="Afficher le graphe à taille réelle"
                onClick={() => {
                  setZoom(1);
                  centrer();
                }}
              >
                {n(Math.round(echelle * 100))} %
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                aria-label="Agrandir le graphe"
                onClick={() => {
                  setZoom(Math.min(2, echelle * 1.25));
                  centrer();
                }}
              >
                +
              </Button>
              <Button size="compact-xs" variant="subtle" onClick={ajuster}>
                Ajuster
              </Button>
            </Group>
          </div>
        </section>
        <Text id={`${identifiant}-aide`} size="xs" className="perimetres-graphe-aide">
          Couverture : exigences testées ou validées parmi les applicables, sans score de certification.
          <br />
          Déplacer le graphe sur le fond libre, ou avec les flèches du clavier lorsque le graphe est sélectionné. La
          touche Début rétablit la vue initiale, à taille réelle. « Ajuster » fait tenir tout le graphe dans la largeur.
        </Text>
      </section>
      <Drawer
        opened={!!detailCarte}
        onClose={() => setDetail(null)}
        title={detailCarte?.name}
        position="right"
        size="lg"
        classNames={{ content: 'perimetre-detail-panneau' }}
        closeButtonProps={{ 'aria-label': 'Fermer le panneau Détail' }}
      >
        {detailCarte && (
          <Stack>
            <Text size="sm" c="dimmed">
              Données propres au périmètre · accès aux registres filtrés sur ce périmètre
            </Text>
            <CouvertureCarte couverture={detailCarte.compteurs.couverture} id={detailCarte.id} />
            <dl className="graphe-compteurs perimetre-detail-compteurs">
              {lignesCompteurs(detailCarte.compteurs, detailCarte.id).map((l) => (
                <div key={l.libelle}>
                  <dt>{l.libelle}</dt>
                  <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
                  {l.detail && <dd className="graphe-detail">{l.detail}</dd>}
                </div>
              ))}
            </dl>
            {detailCarte.sousPerimetres > 0 && (
              <section aria-label={`Total de ${detailCarte.name} avec ses sous-périmètres`}>
                <Text fw={600}>Total avec {n(detailCarte.sousPerimetres)} sous-périmètre(s)</Text>
                <dl className="graphe-compteurs perimetre-detail-compteurs">
                  {lignesCompteurs(detailCarte.total, detailCarte.id, false).map((l) => (
                    <div key={l.libelle}>
                      <dt>{l.libelle}</dt>
                      <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
                      {l.detail && <dd className="graphe-detail">{l.detail}</dd>}
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </Stack>
        )}
      </Drawer>
    </>
  );
}
