/* Module Vulnérabilités (ADR 0100, point 18 ; lot PC1) : mise en page du radar « Situation tactique » de la Vue d'ensemble.
   Fonctions pures et déterministes, testées hors navigateur (apps/web/test/vulnerabilites-radar.test.ts).
   - Chaque point est une faille suivie réelle, rendue par la route de lecture ; aucun point décoratif.
   - Distance au centre : la priorité (P1 au centre, P4 au bord), sur quatre anneaux nommés.
   - Angle : le secteur (famille du produit surveillé rapproché, sinon « Non classé »), sept secteurs égaux.
   - Taille : nombre de machines et d'actifs exposés que la personne lit (jamais un total global).
   - Placement : dans chaque case (secteur × anneau), des emplacements fixes, séparés d'au moins deux rayons maximaux. Les
     failles sont prises de la plus prioritaire à la moins prioritaire ; chacune occupe l'emplacement désigné par une
     empreinte de sa clé (sonde linéaire en cas de collision) : même faille, même place d'un chargement à l'autre tant que
     sa case ne change pas. Au-delà de la capacité de la case, les failles en trop sont regroupées en une pastille chiffrée
     (les plus prioritaires restent individuelles), qui compte aussi celles que la route n'a pas rendues.
   - Étiquettes : seulement pour les quelques points les plus prioritaires, sans chevauchement (sinon l'étiquette est omise ;
     le point garde son nom accessible).
   Unités : celles de la viewBox (centre en 0,0) ; aucune longueur CSS. */
import {
  type CaseRadarDto,
  type CibleVueDto,
  comparerCibles,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  SECTEUR_RADAR_LIBELLES,
  SECTEURS_RADAR,
  type SecteurRadar,
} from '@suivi/shared';

/** Rayon extérieur du radar et bandes des anneaux (P1 au centre). */
export const RAYON = 230;
export const ANNEAUX: Record<NiveauPriorite, readonly [number, number]> = {
  P1: [0, 70],
  P2: [70, 130],
  P3: [130, 182],
  P4: [182, 230],
};
/** Rayon d'un point : de POINT_MIN (aucune machine lisible) à POINT_MAX. Deux emplacements sont séparés d'au moins ESPACE. */
export const POINT_MIN = 3.5;
export const POINT_MAX = 7.5;
export const ESPACE = 2 * POINT_MAX + 2;
/** Marge d'un emplacement au bord d'un secteur ou d'un anneau. */
const MARGE = POINT_MAX + 1;
/** Nombre d'étiquettes au plus, et abscisse de leur marge (hors du disque et des noms de secteurs proches). */
export const ETIQUETTES_MAX = 6;
export const MARGE_ETIQUETTES = 262;
/** Fenêtre de la scène (viewBox) : le radar, les noms des secteurs et les étiquettes y tiennent. */
export const VUE = { x: -400, y: -285, l: 800, h: 570 } as const;
/** Tailles de police des étiquettes (unités de la viewBox) et largeur moyenne d'un caractère. */
export const POLICE = { titre: 11, detail: 9.5, secteur: 11, rapport: 0.58 } as const;

const ANGLE = (2 * Math.PI) / SECTEURS_RADAR.length;
export const angleSecteur = (s: SecteurRadar) => SECTEURS_RADAR.indexOf(s) * ANGLE;
/** Point du plan à l'angle `a` (0 en haut, sens des aiguilles d'une montre) et au rayon `r`. */
export const polaire = (a: number, r: number) => ({ x: r * Math.sin(a), y: -r * Math.cos(a) });
const arrondi = (v: number) => Math.round(v * 10) / 10;

/** Emplacements d'une case, du centre vers le bord puis dans le sens des aiguilles d'une montre ; `rang` : numéro du
    sous-anneau (0 : le plus proche du centre). */
export function emplacements(secteur: SecteurRadar, niveau: NiveauPriorite): { x: number; y: number; rang: number }[] {
  const [r0, r1] = ANNEAUX[niveau];
  const a0 = angleSecteur(secteur);
  const out: { x: number; y: number; rang: number }[] = [];
  let rang = 0;
  for (let r = Math.max(r0 + MARGE, 22); r <= r1 - MARGE; r += ESPACE, rang++) {
    const utile = ANGLE * r - 2 * MARGE;
    const n = Math.max(1, Math.floor(utile / ESPACE) + 1);
    const pas = n > 1 ? utile / (n - 1) : 0;
    for (let j = 0; j < n; j++) {
      const a = n > 1 ? a0 + (MARGE + j * pas) / r : a0 + ANGLE / 2;
      const p = polaire(a, r);
      out.push({ x: arrondi(p.x), y: arrondi(p.y), rang });
    }
  }
  return out;
}

/** Débordement d'une case : la pastille prend l'emplacement du milieu du sous-anneau extérieur ; ses deux voisins sur ce
    sous-anneau restent libres (place de la pastille, plus large qu'un point). Rend l'indice de la pastille et les indices
    laissés aux points individuels. */
export function placesDebordement(places: readonly { rang: number }[]): { pastille: number; libres: number[] } {
  const dernier = places[places.length - 1]!.rang;
  const exterieur = places
    .map((p, i) => [p, i] as const)
    .filter(([p]) => p.rang === dernier)
    .map(([, i]) => i);
  const pastille = exterieur[Math.floor((exterieur.length - 1) / 2)]!;
  const pris = new Set([pastille, pastille - 1, pastille + 1].filter((i) => exterieur.includes(i)));
  return { pastille, libres: places.map((_, i) => i).filter((i) => !pris.has(i)) };
}

/** Empreinte stable d'une clé (FNV-1a 32 bits). */
export function empreinte(cle: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < cle.length; i++) {
    h ^= cle.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Rayon d'un point selon les machines et actifs que la personne lit. */
export function rayonPoint(c: Pick<CibleVueDto, 'machines' | 'actifs'>): number {
  const n = c.machines.lisibles + c.actifs.lisibles;
  return n <= 0 ? POINT_MIN : Math.min(POINT_MAX, arrondi(POINT_MIN + 1.4 * Math.log2(1 + n)));
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
export const libelleEpss = (v: number | null) =>
  v === null ? 'EPSS non publié' : `EPSS ${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`;
/** Nombre lisible, sans total global : « 3 machines », « 1 machine, et d'autres hors de vos droits ». */
export function libelleTouches(c: Pick<CibleVueDto, 'machines' | 'actifs'>): string {
  const morceaux: string[] = [];
  if (c.machines.lisibles || c.machines.horsLecture)
    morceaux.push(
      `${pluriel(c.machines.lisibles, 'machine', 'machines')}${c.machines.horsLecture ? ' lisibles, et d’autres hors de vos droits' : ''}`,
    );
  if (c.actifs.lisibles || c.actifs.horsLecture)
    morceaux.push(
      `${pluriel(c.actifs.lisibles, 'actif exposé', 'actifs exposés')}${c.actifs.horsLecture ? ' lisibles, et d’autres hors de vos droits' : ''}`,
    );
  return morceaux.length ? morceaux.join(', ') : 'aucune machine ni aucun actif que vous puissiez lire';
}

/** Nom accessible d'un point : priorité, faille, secteur, faits, nombres lisibles, EPSS. */
export function nomPoint(c: CibleVueDto): string {
  return [
    c.priorite.niveau,
    c.cve ?? 'constat de Tenable sans CVE',
    c.titre,
    `secteur ${SECTEUR_RADAR_LIBELLES[c.secteur]}`,
    c.exploitee ? 'exploitation avérée' : null,
    c.aConfirmer ? 'produit à confirmer' : null,
    libelleTouches(c),
    libelleEpss(c.epss),
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface PointRadar {
  cle: string;
  x: number;
  y: number;
  r: number;
  niveau: NiveauPriorite;
  exploitee: boolean;
  aConfirmer: boolean;
  nom: string;
  cible: CibleVueDto;
}
export interface GroupeRadar {
  cle: string;
  secteur: SecteurRadar;
  niveau: NiveauPriorite;
  x: number;
  y: number;
  /** Failles regroupées (rendues ou non par la route). */
  nombre: number;
  nom: string;
}
export interface EtiquetteRadar {
  cle: string;
  ancre: 'start' | 'end';
  x: number;
  y: number;
  titre: string;
  detail: string;
  /** Trait du point vers l'étiquette. */
  trait: string;
  boite: { x: number; y: number; l: number; h: number };
}
export interface SecteurScene {
  secteur: SecteurRadar;
  libelle: string;
  x: number;
  y: number;
  ancre: 'start' | 'middle' | 'end';
  /** Rayon de séparation (début du secteur). */
  bord: { x: number; y: number };
  total: number;
}
export interface SceneRadar {
  points: PointRadar[];
  groupes: GroupeRadar[];
  etiquettes: EtiquetteRadar[];
  secteurs: SecteurScene[];
  /** Ordre de parcours au clavier : points et pastilles, du plus prioritaire au moins prioritaire. */
  ordre: string[];
}

const tronque = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const recouvre = (a: EtiquetteRadar['boite'], b: EtiquetteRadar['boite']) =>
  a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;

/** Étiquette d'un point : nom court (produit, sinon CVE) et ligne de détail. */
export function texteEtiquette(c: CibleVueDto): { titre: string; detail: string } {
  const titre = tronque(c.produit ?? c.cve ?? c.titre, 18);
  const n = c.machines.lisibles + c.actifs.lisibles;
  const touches = c.aConfirmer ? 'à confirmer' : `${n} lisible${n > 1 ? 's' : ''}`;
  return { titre, detail: `${touches} · ${libelleEpss(c.epss)}` };
}

/** Scène complète du radar. `cases` : totaux de chaque case rendus par la route (pour compter ce qui n'est pas rendu). */
export function disposerRadar(
  cibles: readonly CibleVueDto[],
  cases: readonly CaseRadarDto[],
  etiquettesMax = ETIQUETTES_MAX,
): SceneRadar {
  const triees = [...cibles].sort(comparerCibles);
  const parCase = new Map<string, CibleVueDto[]>();
  for (const c of triees) {
    const k = `${c.secteur}|${c.priorite.niveau}`;
    const l = parCase.get(k);
    if (l) l.push(c);
    else parCase.set(k, [c]);
  }
  const totalCase = new Map(cases.map((c) => [`${c.secteur}|${c.priorite}`, c.total]));
  const points: PointRadar[] = [];
  const groupes: GroupeRadar[] = [];
  for (const secteur of SECTEURS_RADAR)
    for (const niveau of NIVEAUX_PRIORITE) {
      const k = `${secteur}|${niveau}`;
      const liste = parCase.get(k) ?? [];
      const total = Math.max(totalCase.get(k) ?? 0, liste.length);
      if (!total) continue;
      const places = emplacements(secteur, niveau);
      const deborde = total > places.length;
      const debord = deborde ? placesDebordement(places) : null;
      const libres = debord ? debord.libres.map((i) => places[i]!) : places;
      const pris = new Set<number>();
      const individuels = liste.slice(0, libres.length);
      for (const c of individuels) {
        let i = empreinte(c.cle) % libres.length;
        while (pris.has(i)) i = (i + 1) % libres.length;
        pris.add(i);
        points.push({
          cle: c.cle,
          x: libres[i]!.x,
          y: libres[i]!.y,
          r: rayonPoint(c),
          niveau,
          exploitee: c.exploitee,
          aConfirmer: c.aConfirmer,
          nom: nomPoint(c),
          cible: c,
        });
      }
      if (debord) {
        const p = places[debord.pastille]!;
        const nombre = total - individuels.length;
        groupes.push({
          cle: k,
          secteur,
          niveau,
          x: p.x,
          y: p.y,
          nombre,
          nom: `${pluriel(nombre, 'autre faille', 'autres failles')} en ${niveau}, secteur ${SECTEUR_RADAR_LIBELLES[secteur]} : afficher la liste`,
        });
      }
    }
  const secteurs: SecteurScene[] = SECTEURS_RADAR.map((s) => {
    const milieu = angleSecteur(s) + ANGLE / 2;
    const p = polaire(milieu, RAYON + 18);
    const sin = Math.sin(milieu);
    return {
      secteur: s,
      libelle: SECTEUR_RADAR_LIBELLES[s],
      x: arrondi(p.x),
      y: arrondi(p.y + (Math.cos(milieu) < -0.5 ? 10 : 0)),
      ancre: Math.abs(sin) < 0.35 ? 'middle' : sin > 0 ? 'start' : 'end',
      bord: (() => {
        const b = polaire(angleSecteur(s), RAYON);
        return { x: arrondi(b.x), y: arrondi(b.y) };
      })(),
      total: cases.filter((c) => c.secteur === s).reduce((n, c) => n + c.total, 0),
    };
  });
  // Étiquettes : les points les plus prioritaires, en marge du radar (à droite ou à gauche selon le côté du point), reliées
  // au point par un trait ; jamais sur le disque, sans chevauchement entre elles ni sortie de la scène.
  const etiquettes: EtiquetteRadar[] = [];
  // Noms des secteurs : obstacles pour les étiquettes (largeur estimée comme celle des étiquettes).
  const obstacles = secteurs.map((x) => {
    const l = `${x.libelle} · ${x.total}`.length * POLICE.secteur * POLICE.rapport * 1.4;
    const gauche = x.ancre === 'start' ? x.x : x.ancre === 'end' ? x.x - l : x.x - l / 2;
    return { x: gauche - 4, y: x.y - POLICE.secteur - 3, l: l + 8, h: POLICE.secteur + 9 };
  });
  const parRang = [...points].sort((a, b) => comparerCibles(a.cible, b.cible));
  const h = POLICE.titre + POLICE.detail + 7;
  for (const p of parRang) {
    if (etiquettes.length >= etiquettesMax) break;
    const { titre, detail } = texteEtiquette(p.cible);
    const l = Math.max(titre.length * POLICE.titre, detail.length * POLICE.detail) * POLICE.rapport;
    const droite = p.x >= 0;
    const x = droite ? MARGE_ETIQUETTES : -MARGE_ETIQUETTES;
    for (const dy of [0, -h, h, -2 * h, 2 * h, -3 * h, 3 * h, -4 * h, 4 * h]) {
      const y = arrondi(Math.max(VUE.y + POLICE.titre + 2, Math.min(VUE.y + VUE.h - h, p.y + dy)));
      const boite = { x: droite ? x : x - l, y: y - POLICE.titre, l, h };
      const dehors =
        boite.x < VUE.x || boite.x + boite.l > VUE.x + VUE.l || boite.y < VUE.y || boite.y + h > VUE.y + VUE.h;
      if (dehors || etiquettes.some((e) => recouvre(e.boite, boite)) || obstacles.some((o) => recouvre(o, boite)))
        continue;
      const bord = droite ? p.x + p.r : p.x - p.r;
      etiquettes.push({
        cle: p.cle,
        ancre: droite ? 'start' : 'end',
        x,
        y,
        titre,
        detail,
        trait: `M${arrondi(bord)} ${p.y}L${arrondi(droite ? x - 6 : x + 6)} ${arrondi(y - 3)}`,
        boite,
      });
      break;
    }
  }
  // Ordre clavier : par priorité, puis secteur, points puis pastille de la case.
  const ordre: string[] = [];
  for (const niveau of NIVEAUX_PRIORITE)
    for (const secteur of SECTEURS_RADAR) {
      for (const p of parRang) if (p.niveau === niveau && p.cible.secteur === secteur) ordre.push(p.cle);
      for (const g of groupes) if (g.niveau === niveau && g.secteur === secteur) ordre.push(`groupe:${g.cle}`);
    }
  return { points, groupes, etiquettes, secteurs, ordre };
}
