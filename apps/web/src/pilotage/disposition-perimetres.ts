/* Graphe des périmètres (refonte Neon, lot 3) : géométrie pure, sans React ni DOM. Chaque carte a sa largeur (repliée ou
   dépliée en largeur) et sa hauteur mesurée ; chaque sous-arbre réserve la largeur de ses cartes, aucune carte ne recouvre sa
   voisine et un parent est centré sur ses enfants. Les arbres indépendants se répartissent en rangées quand une largeur
   maximale est donnée ; un écran étroit reçoit une hiérarchie verticale. Les fournisseurs extérieurs forment une colonne à
   droite de l'arbre : ils ne sont jamais des parents. */
import { arbre, type CartePerimetre, type NoeudArbre } from '@suivi/shared';

/** Carte repliée (référence PC 260 px ; 264 pour garder l'écart minimal attendu entre deux cartes voisines). */
export const LARGEUR_CARTE = 264;
/** Carte dépliée en largeur (référence PC 620 px). */
export const LARGEUR_CARTE_DEPLIEE = 620;
/** Estimation avant la première mesure ; chaque carte est ensuite mesurée (contenu, police, dépliage). */
export const HAUTEUR_CARTE = 236;
export const ECART_X = 26;
export const ECART_Y = 72;
export const LARGEUR_FOURNISSEUR = 184;
export const HAUTEUR_FOURNISSEUR = 80;
export const ECART_FOURNISSEUR = 12;
export const DECALAGE_FOURNISSEUR = 48;
/** Hiérarchie verticale : les liaisons des fournisseurs passent à droite de l'arbre, de cette distance. */
export const DEBORD_LIAISON = 10;
/** Marge intérieure du cadre du graphe, de chaque côté. */
export const MARGE_GRAPHE = 24;
/** Sous cette largeur de cadre, la hiérarchie devient verticale (téléphone, fenêtre étroite). */
export const LARGEUR_VERTICALE = 900;
const RETRAIT_VERTICAL = 16;
const ECART_VERTICAL = 24;
/** Hauteur minimale du cadre en présentation horizontale : l'ensemble y est centré. */
const HAUTEUR_CADRE_MIN = 560;

export interface Place {
  carte: CartePerimetre;
  x: number;
  y: number;
  parent: string | null;
  largeur: number;
  hauteur: number;
}

export interface OptionsDisposition {
  /** Hiérarchie verticale (écran étroit) au lieu de l'arbre horizontal. */
  vertical?: boolean;
  /** Largeur d'une carte repliée. */
  largeurCarte?: number;
  /** Largeur propre de certaines cartes (dépliées), par identifiant. */
  largeurs?: Readonly<Record<string, number>>;
  /** Au-delà, l'arbre indépendant suivant commence une nouvelle rangée. Absent : une seule rangée. */
  largeurMax?: number;
}

type Noeud = NoeudArbre<CartePerimetre>;

/** Disposition de l'arbre : feuilles de gauche à droite, parent centré sur ses enfants, dimensions réelles de chaque carte. */
export function disposer(
  cartes: readonly CartePerimetre[],
  hauteurs: Readonly<Record<string, number>> = {},
  { vertical = false, largeurCarte = LARGEUR_CARTE, largeurs = {}, largeurMax }: OptionsDisposition = {},
): { places: Place[]; largeur: number; hauteur: number } {
  const racines = arbre(cartes);
  const places: Place[] = [];
  const hauteurDe = (id: string) => Math.max(1, hauteurs[id] ?? HAUTEUR_CARTE);
  const largeurDe = (id: string) => Math.max(1, largeurs[id] ?? largeurCarte);
  const resultat = () => ({
    places,
    largeur: Math.max(largeurCarte, ...places.map((p) => p.x + p.largeur)),
    hauteur: Math.max(places.length ? 0 : HAUTEUR_CARTE, ...places.map((p) => p.y + p.hauteur)),
  });

  if (vertical) {
    let y = 0;
    const poser = (noeuds: readonly Noeud[], parent: string | null) => {
      for (const n of noeuds) {
        const hauteur = hauteurDe(n.item.id);
        places.push({
          carte: n.item,
          x: Math.min(n.profondeur, 2) * RETRAIT_VERTICAL,
          y,
          parent,
          largeur: largeurDe(n.item.id),
          hauteur,
        });
        y += hauteur + ECART_VERTICAL;
        poser(n.enfants, n.item.id);
      }
    };
    poser(racines, null);
    return resultat();
  }

  // Chaque sous-arbre réserve la largeur de ses cartes, ouvertes ou repliées : aucun frère n'est recouvert.
  const etendues = new Map<string, number>();
  const largeurEnfants = (n: Noeud) =>
    n.enfants.reduce((s, e) => s + etendues.get(e.item.id)!, 0) + Math.max(0, n.enfants.length - 1) * ECART_X;
  const etendue = (n: Noeud): number => {
    n.enfants.forEach(etendue);
    const e = Math.max(largeurDe(n.item.id), largeurEnfants(n));
    etendues.set(n.item.id, e);
    return e;
  };
  racines.forEach(etendue);

  // Rangées d'arbres indépendants, bornées par la largeur disponible.
  const rangees: Noeud[][] = [];
  let courante: Noeud[] = [],
    largeurRangee = 0;
  for (const r of racines) {
    const e = etendues.get(r.item.id)!;
    if (largeurMax !== undefined && courante.length && largeurRangee + ECART_X + e > largeurMax) {
      rangees.push(courante);
      courante = [];
      largeurRangee = 0;
    }
    largeurRangee += (courante.length ? ECART_X : 0) + e;
    courante.push(r);
  }
  if (courante.length) rangees.push(courante);

  // Chaque rangée est centrée sur la plus large : l'ensemble reste centré, même réparti sur plusieurs rangées.
  const largeurDeRangee = (rangee: readonly Noeud[]) =>
    rangee.reduce((s, r) => s + etendues.get(r.item.id)!, 0) + Math.max(0, rangee.length - 1) * ECART_X;
  const largeurRangees = Math.max(0, ...rangees.map(largeurDeRangee));
  let haut = 0;
  for (const rangee of rangees) {
    // Hauteur de chaque niveau de la rangée : la plus haute de ses cartes.
    const niveaux: number[] = [];
    const relever = (n: Noeud) => {
      niveaux[n.profondeur] = Math.max(niveaux[n.profondeur] ?? 0, hauteurDe(n.item.id));
      n.enfants.forEach(relever);
    };
    rangee.forEach(relever);
    const ordonnees: number[] = [];
    for (let i = 0; i < niveaux.length; i++) ordonnees[i] = i ? ordonnees[i - 1]! + niveaux[i - 1]! + ECART_Y : haut;
    const poser = (n: Noeud, gauche: number, parent: string | null): number => {
      const largeur = largeurDe(n.item.id),
        groupe = etendues.get(n.item.id)!;
      let xEnfant = gauche + (groupe - largeurEnfants(n)) / 2;
      const centres = n.enfants.map((e) => {
        const c = poser(e, xEnfant, n.item.id);
        xEnfant += etendues.get(e.item.id)! + ECART_X;
        return c;
      });
      // Parent centré entre son premier et son dernier enfant, sans sortir de la largeur réservée à son sous-arbre.
      const centre = centres.length ? (centres[0]! + centres[centres.length - 1]!) / 2 : gauche + groupe / 2;
      const x = Math.min(Math.max(centre - largeur / 2, gauche), gauche + groupe - largeur);
      places.push({ carte: n.item, x, y: ordonnees[n.profondeur]!, parent, largeur, hauteur: hauteurDe(n.item.id) });
      return x + largeur / 2;
    };
    let gauche = (largeurRangees - largeurDeRangee(rangee)) / 2;
    for (const r of rangee) {
      poser(r, gauche, null);
      gauche += etendues.get(r.item.id)! + ECART_X;
    }
    haut = ordonnees[niveaux.length - 1]! + niveaux[niveaux.length - 1]! + ECART_Y;
  }
  return resultat();
}

/** Liaison orientée parent → enfant (coudée en arbre, en équerre dans la hiérarchie verticale). */
export function cheminLien(parent: Place, enfant: Place, vertical: boolean): string {
  if (vertical) return `M${parent.x + 8} ${parent.y + parent.hauteur} V${enfant.y + enfant.hauteur / 2} H${enfant.x}`;
  const x1 = parent.x + parent.largeur / 2,
    y1 = parent.y + parent.hauteur,
    x2 = enfant.x + enfant.largeur / 2,
    y2 = enfant.y;
  return `M${x1} ${y1} V${(y1 + y2) / 2} H${x2} V${y2}`;
}

export interface FournisseurPlace<F> {
  fournisseur: F;
  x: number;
  y: number;
}

/** Colonne des fournisseurs extérieurs, chacun à hauteur du premier périmètre qui le porte, sans chevauchement. */
export function placerFournisseurs<F extends { scopes: readonly string[] }>(
  fournisseurs: readonly F[],
  places: readonly Place[],
  { vertical, largeurArbre, hauteurArbre }: { vertical: boolean; largeurArbre: number; hauteurArbre: number },
): { placees: FournisseurPlace<F>[]; colonneX: number; bas: number } {
  const colonneX = vertical ? Math.max(0, largeurArbre - LARGEUR_FOURNISSEUR) : largeurArbre + DECALAGE_FOURNISSEUR;
  let bas = 0;
  const placees = fournisseurs.flatMap((fournisseur) => {
    const cible = places.find((p) => fournisseur.scopes.includes(p.carte.id));
    if (!cible) return [];
    const y = vertical
      ? Math.max(hauteurArbre + 32, bas)
      : Math.max(0, bas, cible.y + cible.hauteur / 2 - HAUTEUR_FOURNISSEUR / 2);
    bas = y + HAUTEUR_FOURNISSEUR + ECART_FOURNISSEUR;
    return [{ fournisseur, x: colonneX, y }];
  });
  return { placees, colonneX, bas: placees.length ? bas - ECART_FOURNISSEUR : 0 };
}

/** Liaison d'un fournisseur extérieur : elle part du bord de la carte et contourne la rangée par le haut. */
export function cheminFournisseur(
  p: Place,
  f: { x: number; y: number },
  { vertical, largeurArbre }: { vertical: boolean; largeurArbre: number },
): string {
  const yF = f.y + HAUTEUR_FOURNISSEUR / 2;
  if (vertical)
    return `M${p.x + p.largeur} ${p.y + p.hauteur / 2} H${largeurArbre + DEBORD_LIAISON} V${yF} H${f.x + LARGEUR_FOURNISSEUR}`;
  return `M${p.x + p.largeur} ${p.y + p.hauteur / 2} H${p.x + p.largeur + 13} V${p.y - 22} H${f.x - 20} V${yF} H${f.x}`;
}

/** Cadrage du graphe dans sa zone. Par défaut, taille réelle : le gabarit s'adapte à la fenêtre (rangées, hiérarchie
    verticale, cartes dépliées une à une) sans réduction globale ; un graphe plus large que la zone y défile
    horizontalement. `ajustee` : échelle qui fait tenir le graphe dans la largeur (commande « Ajuster », jamais au-delà de
    la taille réelle). Le dessin est centré dans le cadre. */
export function cadrer({
  largeurZone,
  largeur,
  hauteur,
  zoom,
  vertical,
  decalage = { x: 0, y: 0 },
}: {
  largeurZone: number;
  largeur: number;
  hauteur: number;
  zoom: number | null;
  vertical: boolean;
  decalage?: { x: number; y: number };
}) {
  const largeurUtile = largeurZone || largeur + MARGE_GRAPHE * 2;
  const ajustee = Math.min(1, Math.max(0.1, (largeurUtile - MARGE_GRAPHE * 2) / Math.max(1, largeur)));
  const echelle = zoom ?? 1;
  // Un graphe qui tient dans la zone y est centré (ses marges se resserrent au besoin) ; sinon la zone défile.
  const largeurCadre = largeur * echelle <= largeurUtile ? largeurUtile : largeur * echelle + MARGE_GRAPHE * 2;
  const hauteurCadre = Math.max(vertical ? 0 : HAUTEUR_CADRE_MIN, hauteur * echelle + MARGE_GRAPHE * 2);
  return {
    echelle,
    ajustee,
    largeurCadre,
    hauteurCadre,
    origineX: (largeurCadre - largeur * echelle) / 2 + decalage.x,
    origineY: (hauteurCadre - hauteur * echelle) / 2 + decalage.y,
  };
}

/** Part des exigences applicables testées ou validées, en pour cent ; null sans exigence applicable (jamais 0 % fictif). */
export function pourcentageCouverture(c: { testees: number; applicables: number } | null): number | null {
  if (!c || c.applicables <= 0) return null;
  return Math.round(Math.min(1, Math.max(0, c.testees / c.applicables)) * 100);
}

/** Part des éléments ouverts en retard, en pour cent de la jauge ; piste vide pour un dénominateur nul. */
export function partEnRetard({ ouverts, enRetard }: { ouverts: number; enRetard: number }): number {
  return ouverts > 0 ? Math.min(100, (Math.max(0, enRetard) / ouverts) * 100) : 0;
}
