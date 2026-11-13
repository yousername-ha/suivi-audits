/* Graphe des périmètres : un arbre (parent → enfants) de cartes de synthèse. Les compteurs viennent du serveur
   (`GET /api/grc/perimetres/synthese`) : un compteur absent s'affiche « indisponible », jamais comme un zéro. La création
   passe par le même formulaire que la liste (même route, même identifiant) ; le graphe n'a pas de modèle propre. */
import { Anchor, Badge, Button, Drawer, Group, Loader, Stack, Text } from '@mantine/core';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { NeonAnneau } from '@suivi/ui';
import {
  arbre,
  LIBELLES_NIVEAU,
  type CartePerimetre,
  type Couverture,
  type CouvertureReferentiel,
  type NiveauPerimetre,
} from '@suivi/shared';

export const LARGEUR_CARTE_PERIMETRE = 260;
/** Estimation au premier rendu ; chaque dalle est ensuite mesurée, y compris après dépliage et changement de police. */
export const HAUTEUR_CARTE_PERIMETRE = 202;
export const LARGEUR_CARTE_DEPLIEE = 620;
const LARGEUR = LARGEUR_CARTE_PERIMETRE;
const HAUTEUR = HAUTEUR_CARTE_PERIMETRE;
const ECART_X = 26;
const ECART_Y = 72;
const LARGEUR_FOURNISSEUR = 176;
const HAUTEUR_FOURNISSEUR = 80;
const ECART_FOURNISSEUR = 12;
const DECALAGE_FOURNISSEUR = 40;
const MARGE_GRAPHE = 24;

/** Fournisseur extérieur : jamais un parent, seulement rattaché à un ou plusieurs périmètres. */
export interface FournisseurRattache {
  id: string;
  name: string;
  scopes: string[];
}

interface Place {
  carte: CartePerimetre;
  x: number;
  y: number;
  parent: string | null;
  hauteur: number;
  largeur: number;
}

/** Disposition en arbre : les feuilles se suivent de gauche à droite, chaque parent est centré sur ses enfants. */
export function disposer(
  cartes: readonly CartePerimetre[],
  hauteurs: Readonly<Record<string, number>> = {},
  {
    vertical = false,
    largeurCarte = LARGEUR,
    largeurMax,
    largeurs = {},
  }: {
    vertical?: boolean;
    largeurCarte?: number;
    largeurMax?: number;
    largeurs?: Readonly<Record<string, number>>;
  } = {},
) {
  const racines = arbre(cartes.map((c) => ({ ...c, id: c.id, parentId: c.parentId, name: c.name })));
  const places: Place[] = [];
  const hauteurDe = (id: string) => Math.max(1, hauteurs[id] ?? HAUTEUR);
  const largeurDe = (id: string) => Math.max(1, largeurs[id] ?? largeurCarte);
  if (vertical) {
    let y = 0;
    const poser = (noeuds: typeof racines, parent: string | null) => {
      for (const noeud of noeuds) {
        const hauteur = hauteurDe(noeud.item.id);
        places.push({
          carte: noeud.item,
          x: Math.min(noeud.profondeur, 2) * 16,
          y,
          parent,
          hauteur,
          largeur: largeurDe(noeud.item.id),
        });
        y += hauteur + 24;
        poser(noeud.enfants, noeud.item.id);
      }
    };
    poser(racines, null);
    return {
      places,
      largeur: Math.max(largeurCarte, ...places.map((p) => p.x + p.largeur)),
      hauteur: places.length ? y - 24 : HAUTEUR,
    };
  }
  const niveaux: number[] = [];
  const relever = (noeuds: typeof racines) => {
    for (const n of noeuds) {
      niveaux[n.profondeur] = Math.max(niveaux[n.profondeur] ?? 0, hauteurDe(n.item.id));
      relever(n.enfants);
    }
  };
  relever(racines);
  const ordonnees: number[] = [];
  for (let niveau = 0; niveau < niveaux.length; niveau++)
    ordonnees[niveau] = niveau ? ordonnees[niveau - 1]! + niveaux[niveau - 1]! + ECART_Y : 0;
  // Chaque sous-arbre réserve la largeur de ses cartes, ouvertes ou repliées. Aucun frère n'est recouvert.
  type Noeud = (typeof racines)[number];
  const etendues = new Map<string, number>();
  const etendue = (noeud: Noeud): number => {
    const enfants = noeud.enfants.map(etendue);
    const largeurEnfants =
      enfants.reduce((somme, largeur) => somme + largeur, 0) + Math.max(0, enfants.length - 1) * ECART_X;
    const largeur = Math.max(largeurDe(noeud.item.id), largeurEnfants);
    etendues.set(noeud.item.id, largeur);
    return largeur;
  };
  racines.forEach(etendue);
  const poser = (noeud: Noeud, gauche: number, decalageY: number, parent: string | null) => {
    const largeur = largeurDe(noeud.item.id),
      largeurGroupe = etendues.get(noeud.item.id)!;
    places.push({
      carte: noeud.item,
      x: gauche + (largeurGroupe - largeur) / 2,
      y: ordonnees[noeud.profondeur]! + decalageY,
      parent,
      hauteur: hauteurDe(noeud.item.id),
      largeur,
    });
    const largeurEnfants =
      noeud.enfants.reduce((somme, enfant) => somme + etendues.get(enfant.item.id)!, 0) +
      Math.max(0, noeud.enfants.length - 1) * ECART_X;
    let xEnfant = gauche + (largeurGroupe - largeurEnfants) / 2;
    for (const enfant of noeud.enfants) {
      poser(enfant, xEnfant, decalageY, noeud.item.id);
      xEnfant += etendues.get(enfant.item.id)! + ECART_X;
    }
  };
  // Plusieurs arbres indépendants restent répartis en rangées.
  let x = 0,
    y = 0,
    hauteurRangee = 0;
  for (const racine of racines) {
    const largeurGroupe = etendues.get(racine.item.id)!;
    if (largeurMax && x > 0 && x + largeurGroupe > largeurMax) {
      y += hauteurRangee + ECART_Y;
      x = 0;
      hauteurRangee = 0;
    }
    const debut = places.length;
    poser(racine, x, y, null);
    hauteurRangee = Math.max(hauteurRangee, ...places.slice(debut).map((p) => p.y + p.hauteur - y));
    x += largeurGroupe + ECART_X;
  }
  return {
    places,
    largeur: Math.max(largeurCarte, ...places.map((p) => p.x + p.largeur)),
    hauteur: Math.max(HAUTEUR, ...places.map((p) => p.y + p.hauteur)),
  };
}

const n = (v: number) => v.toLocaleString('fr-FR');
const retard = (c: { ouverts: number; enRetard: number }) => `${n(c.ouverts)} ouverte(s) · ${n(c.enRetard)} en retard`;
/** Page de pilotage du périmètre d'une carte : le périmètre est repris de l'adresse, la liste est celle du module. */
const vers = (section: string, id: string, filtre = '') => `/pilotage/${section}?perimetre=${id}${filtre}`;

interface LigneCompteur {
  libelle: string;
  valeur: ReactNode;
  alerte: boolean;
  /** Section de Pilotage qui liste ces éléments (même périmètre) ; absent : ligne de texte. */
  section?: string;
  detail?: ReactNode;
  /** Valeur mise en avant, sans remplacer le libellé ni le lien du compteur. */
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

/** Navigation de dalle : aspect neutre, flèche et focus visibles plutôt qu'un lien violet souligné. */
function LienCompteur({ to, children, libelle }: { to: string; children: ReactNode; libelle?: string }) {
  return (
    <Anchor component={Link} to={to} c="inherit" underline="never" className="perimetre-lien" aria-label={libelle}>
      <span>{children}</span>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </Anchor>
  );
}

/** Lignes de compteurs d'une carte ; `null` : indisponible (droit manquant ou donnée non mesurable). Un compteur est un lien
    vers la liste du module, dans le même périmètre : les chiffres d'une carte se retrouvent à l'identique dans la liste. */
function lignesCompteurs(c: CartePerimetre['compteurs'], id: string, liens = true, compact = false): LigneCompteur[] {
  const indisponible = 'indisponible';
  const lien = (section: string, texte: ReactNode, court?: string) =>
    liens ? (
      <LienCompteur to={vers(section, id)} libelle={compact && typeof texte === 'string' ? texte : undefined}>
        {compact && court ? court : texte}
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
      valeur: c.actions ? lien('actions', retard(c.actions), `${n(c.actions.enRetard)} en retard`) : indisponible,
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
        : indisponible,
      alerte: !!c.recurrentes && c.recurrentes.occurrences.enRetard > 0,
    },
    {
      libelle: 'Écarts ouverts',
      chiffre: c.ecarts?.ouverts,
      sousTitre: 'non clos',
      jauge: c.ecarts ?? undefined,
      valeur: c.ecarts ? lien('amelioration', retard(c.ecarts), `${n(c.ecarts.enRetard)} en retard`) : indisponible,
      alerte: !!c.ecarts && c.ecarts.enRetard > 0,
      detail: c.ecarts && (
        <Group gap="2xs" wrap="wrap" role="group" aria-label="Écarts ouverts par classification">
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
                {libelle} {n(c.ecarts!.parClassification[cle])}
              </Badge>
            ) : (
              <Badge key={cle} size="xs" variant="light" color={couleur}>
                {libelle} {n(c.ecarts!.parClassification[cle])}
              </Badge>
            ),
          )}
          {c.ecarts.parClassification.non_classe > 0 && (
            <Badge size="xs" variant="outline" color="gray">
              Non classés {n(c.ecarts.parClassification.non_classe)}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      libelle: 'Continuité',
      valeur: c.continuite ? (
        <>
          {lien('bia', `${n(c.continuite.bia)} BIA`)} · {lien('continuite', `${n(c.continuite.pcra)} PCRA`)}
        </>
      ) : (
        indisponible
      ),
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
        : indisponible,
      alerte: !!c.couverture && (c.couverture.aDeterminer > 0 || c.couverture.obligatoiresNonConformes > 0),
      detail: c.couverture && detailCouverture(c.couverture),
    },
  ];
}

/** Part des éléments ouverts en retard. Un dénominateur nul garde une piste vide, jamais un taux inventé. */
function JaugeRetard({ ouverts, enRetard }: { ouverts: number; enRetard: number }) {
  const largeur = ouverts > 0 ? Math.min(100, (Math.max(0, enRetard) / ouverts) * 100) : 0;
  return (
    <svg
      className="perimetre-retard"
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${n(enRetard)} en retard parmi ${n(ouverts)} ouverts`}
    >
      <rect width="100" height="4" rx="2" className="perimetre-retard-piste" />
      <rect width={largeur} height="4" rx="2" className="perimetre-retard-valeur" />
    </svg>
  );
}

function CouvertureCarte({
  couverture,
  id,
  compact = false,
}: {
  couverture: Couverture | null;
  id: string;
  compact?: boolean;
}) {
  if (!couverture)
    return (
      <section className="perimetre-couverture perimetre-couverture--vide" aria-label="Couverture indisponible">
        {!compact && (
          <span className="perimetre-anneau-vide" aria-hidden="true">
            —
          </span>
        )}
        <div>
          <strong>Couverture</strong>
          <p>indisponible</p>
          <small>Aucun référentiel effectif ou droit de lecture absent.</small>
        </div>
      </section>
    );
  return (
    <section className="perimetre-couverture" aria-label="Couverture des exigences du périmètre">
      {!compact && (
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
          {n(couverture.referentiels)} référentiel(s) · {n(couverture.exigences)} exigences
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

/** Résumé visible même replié : les valeurs absentes ne deviennent jamais des zéros. */
function ResumeCarte({ carte }: { carte: CartePerimetre }) {
  const { couverture, actions, ecarts } = carte.compteurs;
  const pourcentage =
    couverture && couverture.applicables > 0
      ? Math.round(Math.min(1, Math.max(0, couverture.testees / couverture.applicables)) * 100)
      : null;
  const point = (retard: number) =>
    retard > 0 && (
      <span
        className="perimetre-point-retard"
        role="img"
        aria-label={`${n(retard)} en retard`}
        title={`${n(retard)} en retard`}
      />
    );
  return (
    <dl className="perimetre-resume">
      <div className="perimetre-resume-couverture">
        <dt>{couverture ? 'Couverture' : 'indisponible'}</dt>
        <dd>
          {pourcentage === null ? (
            '—'
          ) : (
            <LienCompteur
              to={vers('couverture', carte.id)}
              libelle={`${n(couverture!.testees)} testées ou validées / ${n(couverture!.applicables)} applicables`}
            >
              {n(pourcentage)}
              <small>%</small>
            </LienCompteur>
          )}
        </dd>
      </div>
      <div>
        <dt>Actions {actions && point(actions.enRetard)}</dt>
        <dd>
          {actions ? (
            <LienCompteur to={vers('actions', carte.id)} libelle={`Actions : ${retard(actions)}`}>
              {n(actions.ouverts)}
            </LienCompteur>
          ) : (
            <span title="Actions indisponibles">—</span>
          )}
        </dd>
      </div>
      <div>
        <dt>Écarts ouverts {ecarts && point(ecarts.enRetard)}</dt>
        <dd>
          {ecarts ? (
            <LienCompteur to={vers('amelioration', carte.id)} libelle={`Écarts : ${retard(ecarts)}`}>
              {n(ecarts.ouverts)}
            </LienCompteur>
          ) : (
            <span title="Écarts indisponibles">—</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

/** Trois zones de lecture, alimentées par les mêmes compteurs et liens que le panneau Détail. */
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
      <section className="perimetre-detail-colonne perimetre-detail-couverture">
        <CouvertureCarte couverture={carte.compteurs.couverture} id={carte.id} compact />
      </section>
      <section className="perimetre-detail-colonne">
        <h3>Activité et continuité</h3>
        <dl className="graphe-compteurs perimetre-indicateurs">
          {compteur('Tâches récurrentes')}
          {compteur('Continuité')}
        </dl>
      </section>
      <section className="perimetre-detail-colonne">
        <h3>Écarts et actions</h3>
        <dl className="graphe-compteurs perimetre-indicateurs">
          {compteur('Écarts ouverts')}
          {compteur('Actions')}
        </dl>
      </section>
    </div>
  );
}

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
  /** Total fourni par le serveur, sans doublon (jamais la somme des cartes). */
  total?: CartePerimetre['compteurs'];
  affiche: string;
  onChoisir: (id: string) => void;
  onCreerEnfant?: (parentId: string) => void;
  onModifier?: (id: string) => void;
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
  const zone = useRef<HTMLDivElement>(null);
  const glissement = useRef<{ x: number; y: number; origine: { x: number; y: number } } | null>(null);
  const noeuds = useRef(new Map<string, HTMLDivElement>());
  const observateur = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setHauteurs((precedentes) => {
        let suivantes = precedentes;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.perimetreId;
          if (!id) continue;
          const h = Math.ceil(entry.borderBoxSize[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight);
          if (h > 0 && h !== precedentes[id]) {
            if (suivantes === precedentes) suivantes = { ...precedentes };
            suivantes[id] = h;
          }
        }
        return suivantes;
      });
    });
    observateur.current = observer;
    noeuds.current.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      observateur.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    const element = zone.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setLargeurZone(Math.round(entry.contentRect.width));
      setDecalage({ x: 0, y: 0 });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [chargement, cartes.length]);
  const enregistrer = (id: string, element: HTMLDivElement | null) => {
    const ancien = noeuds.current.get(id);
    if (ancien) observateur.current?.unobserve(ancien);
    if (element) {
      noeuds.current.set(id, element);
      observateur.current?.observe(element);
    } else noeuds.current.delete(id);
  };
  const basculer = (id: string) => {
    setDepliees((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
    setDecalage({ x: 0, y: 0 });
  };
  const detailCarte = cartes.find((c) => c.id === detail);
  const [arret, setArret] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const vertical = largeurZone > 0 && largeurZone < 900;
  const largeurCarte = vertical ? Math.max(200, Math.min(LARGEUR, largeurZone - 80)) : LARGEUR;
  const {
    places,
    largeur: largeurArbre,
    hauteur: hauteurArbre,
  } = disposer(cartes, hauteurs, {
    vertical,
    largeurCarte,
    largeurs: Object.fromEntries(
      cartes
        .filter((c) => depliees.has(c.id))
        .map((c) => [
          c.id,
          vertical ? Math.max(200, Math.min(LARGEUR_CARTE_DEPLIEE, largeurZone - 80)) : LARGEUR_CARTE_DEPLIEE,
        ]),
    ),
    largeurMax:
      largeurZone > 0
        ? Math.max(
            LARGEUR,
            largeurZone - MARGE_GRAPHE * 2 - (fournisseurs?.length ? LARGEUR_FOURNISSEUR + DECALAGE_FOURNISSEUR : 0),
          )
        : undefined,
  });
  if (chargement) return <Loader size="sm" aria-label="Chargement du graphe des périmètres" />;
  if (!places.length) return <Text>Aucun périmètre accessible.</Text>;
  const affichables = (fournisseurs ?? []).filter((f) => f.scopes.some((id) => places.some((p) => p.carte.id === id)));
  let basFournisseur = 0;
  const colonneX = vertical ? Math.max(0, largeurArbre - LARGEUR_FOURNISSEUR) : largeurArbre + DECALAGE_FOURNISSEUR;
  const placesFournisseurs = affichables.map((f) => {
    const cible = places.find((p) => f.scopes.includes(p.carte.id))!;
    const y = vertical
      ? Math.max(hauteurArbre + 32, basFournisseur)
      : Math.max(0, basFournisseur, cible.y + cible.hauteur / 2 - HAUTEUR_FOURNISSEUR / 2);
    basFournisseur = y + HAUTEUR_FOURNISSEUR + ECART_FOURNISSEUR;
    return { fournisseur: f, x: colonneX, y };
  });
  const largeur = affichables.length ? Math.max(largeurArbre, colonneX + LARGEUR_FOURNISSEUR) : largeurArbre;
  const hauteur = Math.max(hauteurArbre, basFournisseur - ECART_FOURNISSEUR);
  const largeurCadre = largeurZone || largeur + MARGE_GRAPHE * 2;
  const echelleAjustee = Math.min(1, (largeurCadre - MARGE_GRAPHE * 2) / largeur);
  const echelle = zoom ?? echelleAjustee;
  const hauteurCadre = Math.max(vertical ? 0 : 560, hauteur * echelle + MARGE_GRAPHE * 2);
  const origineX = (largeurCadre - largeur * echelle) / 2 + decalage.x;
  const origineY = (hauteurCadre - hauteur * echelle) / 2 + decalage.y;
  const deplacer = (x: number, y: number) => setDecalage((avant) => ({ x: avant.x + x, y: avant.y + y }));
  const centrer = () => setDecalage({ x: 0, y: 0 });
  const ajuster = () => {
    setZoom(null);
    centrer();
  };
  return (
    <>
      <section className="perimetres-graphe-compact" aria-label="Présentation graphique des périmètres">
        {total && (
          <section className="graphe-total" aria-label="Total sans doublon sur tous les périmètres accessibles">
            <div className="perimetres-synthese-titre">
              <strong>Synthèse globale</strong>
              <small>Chaque élément est compté une seule fois</small>
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
              <strong>{n(cartes.length)} périmètre(s) accessible(s)</strong>
              <small>
                {n(places.filter((p) => p.parent).length)} lien(s) hiérarchique(s)
                {affichables.length > 0 && ` · ${n(affichables.length)} fournisseur(s) extérieur(s)`}
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
                ajuster();
              }
            }}
            onFocusCapture={(e) => {
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
              width="100%"
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
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path className="graphe-fleche" d="M0 0 L10 5 L0 10 z" />
                </marker>
              </defs>
              <g transform={`translate(${origineX} ${origineY}) scale(${echelle})`}>
                {places
                  .filter((p) => p.parent)
                  .map((p) => {
                    const parent = places.find((q) => q.carte.id === p.parent)!;
                    const x1 = parent.x + parent.largeur / 2,
                      y1 = parent.y + parent.hauteur,
                      x2 = p.x + p.largeur / 2,
                      y2 = p.y;
                    return (
                      <path
                        key={p.carte.id}
                        className={arret ? 'graphe-lien' : 'graphe-lien graphe-lien--flux'}
                        d={
                          vertical
                            ? `M${parent.x + 8} ${y1} V${p.y + p.hauteur / 2} H${p.x}`
                            : `M${x1} ${y1} V${(y1 + y2) / 2} H${x2} V${y2}`
                        }
                        fill="none"
                        markerEnd="url(#graphe-fleche)"
                        aria-hidden="true"
                      />
                    );
                  })}
                {placesFournisseurs.flatMap(({ fournisseur: f, x, y }) =>
                  f.scopes
                    .map((id) => places.find((p) => p.carte.id === id))
                    .filter((p): p is Place => !!p)
                    .map((p) => (
                      <path
                        key={`${f.id}-${p.carte.id}`}
                        className="graphe-lien-fournisseur"
                        d={
                          vertical
                            ? `M${p.x + p.largeur} ${p.y + p.hauteur / 2} H${largeurArbre + 10} V${y + HAUTEUR_FOURNISSEUR / 2} H${x + LARGEUR_FOURNISSEUR}`
                            : `M${p.x + p.largeur} ${p.y + p.hauteur / 2} H${p.x + p.largeur + 13} V${p.y - 22} H${x - 20} V${y + HAUTEUR_FOURNISSEUR / 2} H${x}`
                        }
                        fill="none"
                        aria-hidden="true"
                      />
                    )),
                )}
                {placesFournisseurs.map(({ fournisseur: f, x, y }) => (
                  <foreignObject key={f.id} x={x} y={y} width={LARGEUR_FOURNISSEUR} height={HAUTEUR_FOURNISSEUR}>
                    <div className="graphe-carte graphe-fournisseur" role="group" aria-label={`Fournisseur ${f.name}`}>
                      <Text size="xs" c="dimmed">
                        Fournisseur extérieur
                      </Text>
                      <Anchor
                        component={Link}
                        to="/pilotage/fournisseurs"
                        size="sm"
                        fw={600}
                        lineClamp={1}
                        title={f.name}
                      >
                        {f.name}
                      </Anchor>
                    </div>
                  </foreignObject>
                ))}
                {places.map(({ carte, x, y, hauteur: hauteurCarte, largeur: largeurDalle }) => (
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
                      data-deplie={depliees.has(carte.id)}
                      className="graphe-carte perimetre-dalle"
                      data-actif={carte.id === affiche || undefined}
                      role="group"
                      aria-label={`Périmètre ${carte.name}`}
                    >
                      <header className="perimetre-entete">
                        <Text size="xs" className="perimetre-sur-titre">
                          {LIBELLES_NIVEAU[carte.entityKind as NiveauPerimetre] ?? carte.entityKind}
                          {carte.nature ? ` · ${carte.nature}` : ''}
                        </Text>
                        {carte.id === affiche && (
                          <Badge size="xs" variant="light">
                            Affiché
                          </Badge>
                        )}
                      </header>
                      <div className="perimetre-principal">
                        <Text fw={650} title={carte.name} className="perimetre-titre">
                          {carte.name}
                        </Text>
                        <ResumeCarte carte={carte} />
                      </div>
                      <div id={`${identifiant}-${carte.id}`} hidden={!depliees.has(carte.id)}>
                        {depliees.has(carte.id) && (
                          <>
                            <div className="perimetre-corps" role="region" aria-label={`Indicateurs de ${carte.name}`}>
                              <DetailsCarte carte={carte} />
                              {carte.sousPerimetres > 0 && (
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
                                          {l.libelle === 'Couverture' && l.detail && (
                                            <dd className="graphe-detail">{l.detail}</dd>
                                          )}
                                        </div>
                                      ))}
                                    </dl>
                                  </details>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <footer className="perimetre-pied">
                        <div className="perimetre-pied-gauche">
                          <span>
                            {carte.compteurs.couverture &&
                            (carte.compteurs.couverture.aDeterminer > 0 ||
                              carte.compteurs.couverture.obligatoiresNonConformes > 0) ? (
                              <span className="perimetre-vigilance">
                                ⚠ {n(carte.compteurs.couverture.obligatoiresNonConformes)} clauses à traiter
                                {carte.compteurs.couverture.aDeterminer > 0 &&
                                  ` · ${n(carte.compteurs.couverture.aDeterminer)} à déterminer`}
                              </span>
                            ) : carte.sousPerimetres > 0 ? (
                              `${n(carte.sousPerimetres)} sous-périmètre(s)`
                            ) : (
                              'Données propres au périmètre'
                            )}
                          </span>
                          {depliees.has(carte.id) && (
                            <Group gap="2xs" wrap="wrap" className="perimetre-actions">
                              <Button
                                size="compact-xs"
                                variant="light"
                                aria-label={`Détail des compteurs de ${carte.name}`}
                                onClick={() => setDetail(carte.id)}
                              >
                                Détail
                              </Button>
                              {onModifier && (
                                <Button
                                  size="compact-xs"
                                  variant="default"
                                  aria-label={`Modifier le périmètre ${carte.name}`}
                                  onClick={() => onModifier(carte.id)}
                                >
                                  Modifier
                                </Button>
                              )}
                              {onCreerEnfant && (
                                <Button
                                  size="compact-xs"
                                  variant="default"
                                  aria-label={`Ajouter un périmètre enfant à ${carte.name}`}
                                  onClick={() => onCreerEnfant(carte.id)}
                                >
                                  Ajouter un enfant
                                </Button>
                              )}
                            </Group>
                          )}
                        </div>
                        <button
                          type="button"
                          className="perimetre-deplier"
                          aria-label={`${depliees.has(carte.id) ? 'Replier' : 'Déplier'} la carte ${carte.name}`}
                          aria-expanded={depliees.has(carte.id)}
                          aria-controls={`${identifiant}-${carte.id}`}
                          onClick={() => basculer(carte.id)}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                            <path
                              d={depliees.has(carte.id) ? 'M5 12h14' : 'M5 12h14 M12 5v14'}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
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
                ))}
              </g>
            </svg>
          </div>
          <div className="perimetres-graphe-legende">
            <span>
              <i aria-hidden="true" />
              Lien parent / enfant
            </span>
            {affichables.length > 0 && (
              <span>
                <i className="exterieur" aria-hidden="true" />
                Fournisseur extérieur
              </span>
            )}
            <span>＋ en bas · Déplier en largeur</span>
            <Group gap="2xs">
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
          touche Début rétablit la vue ajustée.
        </Text>
      </section>
      <Drawer
        opened={!!detailCarte}
        onClose={() => setDetail(null)}
        title={detailCarte?.name}
        position="right"
        size="lg"
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
                  <dd>{l.valeur}</dd>
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
                      <dd>{l.valeur}</dd>
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
