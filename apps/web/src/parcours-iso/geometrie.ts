/* Géométrie de l'arbre du parcours ISO / HDS (composition de la maquette v011, repère 1109 × 737) : position des cercles,
   courbes des branches, titres et placement des sous-actions sans recouvrement des libellés. Tout est calculé dans le repère
   du dessin ; l'interface ne fait que l'afficher (aucun style en ligne). */
import { RACCOURCIS_PARCOURS, sousActionsDuRaccourci, type BrancheParcours } from '@suivi/shared';

export const LARGEUR = 1109;
export const HAUTEUR = 737;
export const RAYON_NOEUD = 26;
export const RAYON_ENFANT = 19;
const CHAR_LARGEUR = 8.4;

export interface Rect {
  x: number;
  y: number;
  l: number;
  h: number;
}
export interface PointRaccourci {
  x: number;
  y: number;
  branche: BrancheParcours;
  /** Libellé en une ou deux lignes (à droite du cercle). */
  lignes: readonly string[];
}
export const POINTS: Record<string, PointRaccourci> = {
  contexte: { x: 148, y: 333, branche: 'cadrer', lignes: ['Contexte'] },
  perimetre: { x: 155, y: 238, branche: 'cadrer', lignes: ['Périmètre'] },
  gouvernance: { x: 125, y: 123, branche: 'cadrer', lignes: ['Gouvernance'] },
  applicabilite: { x: 400, y: 92, branche: 'maitriser', lignes: ['Applicabilité'] },
  risques: { x: 402, y: 185, branche: 'maitriser', lignes: ['Risques'] },
  traitement: { x: 400, y: 268, branche: 'maitriser', lignes: ['Traitement'] },
  audits: { x: 620, y: 344, branche: 'evaluer', lignes: ['Audits'] },
  revue: { x: 630, y: 242, branche: 'evaluer', lignes: ['Revue'] },
  'actions-correctives': { x: 610, y: 140, branche: 'evaluer', lignes: ['Actions', 'correctives'] },
  contrats: { x: 850, y: 355, branche: 'hds', lignes: ['Contrats'] },
  activites: { x: 873, y: 432, branche: 'hds', lignes: ['Activités'] },
};

export interface CourbeBranche {
  id: string;
  branche: BrancheParcours;
  d: string;
  /** Seule la branche HDS disparaît quand elle est masquée. */
  hds?: boolean;
}
export const RACINE = { x: 437, y: 630, rayon: 40, lignes: ['Démarrer', 'le parcours'] } as const;
export const COURBES: readonly CourbeBranche[] = [
  {
    id: 'cadrer-1',
    branche: 'cadrer',
    d: 'M437 511 C420 410 326 475 284 401 C258 347 231 377 210 321 C195 270 143 296 155 238 C176 186 114 185 130 147 C129 134 125 130 125 123',
  },
  { id: 'cadrer-2', branche: 'cadrer', d: 'M284 401 C259 352 225 365 196 372 C169 381 147 362 148 333' },
  {
    id: 'maitriser',
    branche: 'maitriser',
    d: 'M437 510 C444 438 381 439 386 393 C385 377 400 366 405 350 C467 315 389 306 400 268 C345 245 383 216 402 185 C434 140 347 162 368 120 C385 91 400 92 400 92',
  },
  {
    id: 'evaluer',
    branche: 'evaluer',
    d: 'M437 510 C453 421 518 464 552 402 C577 358 573 356 620 344 M552 402 C571 330 653 314 630 242 C616 206 565 212 592 164 C600 151 610 140 610 140',
  },
  {
    id: 'hds',
    branche: 'hds',
    hds: true,
    d: 'M437 510 C533 421 639 567 763 460 C804 426 768 380 850 355 M785 433 C809 409 848 453 873 432',
  },
  { id: 'tronc', branche: 'cadrer', d: 'M437 630 C437 588 437 553 437 511' },
];
export const FEUILLES: readonly { x: number; y: number; rot: number; echelle: number; branche: BrancheParcours }[] = [
  { x: 105, y: 157, rot: -25, echelle: 1, branche: 'cadrer' },
  { x: 300, y: 372, rot: 70, echelle: 1, branche: 'cadrer' },
  { x: 267, y: 353, rot: -30, echelle: 1, branche: 'cadrer' },
  { x: 374, y: 108, rot: 0, echelle: 1, branche: 'maitriser' },
  { x: 354, y: 246, rot: -25, echelle: 1, branche: 'maitriser' },
  { x: 371, y: 202, rot: -35, echelle: 0.7, branche: 'maitriser' },
  { x: 438, y: 316, rot: 70, echelle: 1, branche: 'maitriser' },
  { x: 395, y: 409, rot: -45, echelle: 1, branche: 'maitriser' },
  { x: 563, y: 368, rot: 25, echelle: 1, branche: 'evaluer' },
  { x: 607, y: 389, rot: 95, echelle: 1, branche: 'evaluer' },
  { x: 596, y: 221, rot: -45, echelle: 1, branche: 'evaluer' },
  { x: 603, y: 188, rot: 75, echelle: 0.8, branche: 'evaluer' },
  { x: 817, y: 369, rot: 20, echelle: 1, branche: 'hds' },
  { x: 793, y: 457, rot: 5, echelle: 1, branche: 'hds' },
];
export const TITRES_BRANCHES: Record<
  BrancheParcours,
  { x: number; y: number; nom: string; lignes: readonly string[] }
> = {
  cadrer: { x: 205, y: 424, nom: 'CADRER', lignes: ['Poser les fondations', 'de votre démarche'] },
  maitriser: { x: 430, y: 364, nom: 'MAÎTRISER', lignes: ['Piloter et traiter', 'vos risques'] },
  evaluer: { x: 678, y: 431, nom: 'ÉVALUER & AMÉLIORER', lignes: ['Mesurer la performance', 'et progresser'] },
  hds: {
    x: 922,
    y: 488,
    nom: 'COMPLÉMENTS HDS',
    lignes: ['Spécificités relatives', 'à l’hébergement des', 'données de santé'],
  },
};

const largeurTexte = (s: string, taille = 1) => Math.ceil(s.length * CHAR_LARGEUR * taille);

/** Rectangles occupés par les éléments fixes de l'arbre (cercle + libellé, titres de branches, racine). */
export function obstaclesFixes(hds: boolean): Rect[] {
  const out: Rect[] = [];
  for (const r of RACCOURCIS_PARCOURS) {
    const p = POINTS[r.id]!;
    if (!hds && p.branche === 'hds') continue;
    // Cercle avec sa zone d'appui, bouton « + / − » et libellé : marge de sécurité pour que rien ne se touche.
    const marge = RAYON_NOEUD + 10;
    out.push({ x: p.x - marge, y: p.y - marge, l: 2 * marge, h: 2 * marge });
    out.push({ x: p.x + 2, y: p.y + 4, l: 44, h: 44 });
    const l = Math.max(...p.lignes.map((s) => largeurTexte(s)));
    out.push({ x: p.x + RAYON_NOEUD + 4, y: p.y - 9 * p.lignes.length - 4, l: l + 12, h: 18 * p.lignes.length + 8 });
  }
  for (const b of Object.keys(TITRES_BRANCHES) as BrancheParcours[]) {
    if (!hds && b === 'hds') continue;
    const t = TITRES_BRANCHES[b];
    const l = Math.max(largeurTexte(t.nom, 1.3), ...t.lignes.map((s) => largeurTexte(s)));
    out.push({ x: t.x - l / 2, y: t.y - 18, l, h: 22 + 17 * t.lignes.length });
  }
  out.push({ x: RACINE.x - RACINE.rayon, y: RACINE.y - RACINE.rayon, l: 2 * RACINE.rayon, h: 2 * RACINE.rayon + 52 });
  return out;
}

export interface Enfant {
  id: string;
  titre: string;
  x: number;
  y: number;
  /** Côté du libellé par rapport au cercle. */
  cote: 'droite' | 'gauche';
  lignes: readonly string[];
  /** Courbe du parent au cercle de l'enfant. */
  d: string;
}
export const LARGEUR_LIBELLE_ENFANT = 150;

/** Coupe un titre en lignes d'au plus `max` caractères, sur les espaces. */
export function coupe(titre: string, max = 18): string[] {
  const lignes: string[] = [];
  let courante = '';
  for (const mot of titre.split(' ')) {
    if (courante && (courante + ' ' + mot).length > max) {
      lignes.push(courante);
      courante = mot;
    } else courante = courante ? courante + ' ' + mot : mot;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

const gonfle = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, l: r.l + 2 * m, h: r.h + 2 * m });
const recouvre = (a: Rect, b: Rect) => a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;

/** Rectangle d'un enfant : cercle et libellé du côté choisi. */
function rectEnfant(x: number, y: number, cote: 'droite' | 'gauche', lignes: readonly string[]): Rect {
  const l = Math.max(...lignes.map((s) => largeurTexte(s, 1.05)));
  const total = RAYON_ENFANT + 8 + l;
  return {
    x: cote === 'droite' ? x - RAYON_ENFANT : x - total,
    y: y - Math.max(RAYON_ENFANT, 9 * lignes.length),
    l: total,
    h: 2 * Math.max(RAYON_ENFANT, 9 * lignes.length),
  };
}

/** Place les sous-actions d'un raccourci en colonne de part ou d'autre du cercle parent, dans l'espace libre : chaque
    candidat est écarté s'il recouvre un cercle, un libellé, un titre ou sort du dessin ; le plus proche l'emporte. */
export function placerEnfants(raccourciId: string, hds: boolean): Enfant[] {
  const r = RACCOURCIS_PARCOURS.find((x) => x.id === raccourciId);
  const parent = POINTS[raccourciId];
  if (!r || !parent) return [];
  const sous = sousActionsDuRaccourci(r);
  const fixes = obstaclesFixes(hds).filter(
    // Le cercle et le libellé du parent restent des obstacles : seules les sous-actions s'écartent.
    () => true,
  );
  const pas = 58;
  let meilleur: { enfants: Enfant[]; cout: number } | null = null;
  // Deux dispositions : en colonne (sous-actions l'une sous l'autre) ou en ligne (côte à côte, pour les cercles proches d'un bord).
  for (const disposition of ['colonne', 'ligne'] as const)
    for (const cote of ['droite', 'gauche'] as const)
      for (let dx = 60; dx <= 360; dx += 30)
        for (let dy0 = -280; dy0 <= 280; dy0 += 10) {
          const lots = sous.map((s) => ({ s, lignes: coupe(s.titre) }));
          const largeur = Math.max(...lots.map((l) => rectEnfant(0, 0, cote, l.lignes).l)) + 14;
          const items = lots.map((l, i) => ({
            ...l,
            x:
              disposition === 'colonne'
                ? parent.x + (cote === 'droite' ? dx : -dx)
                : parent.x + (cote === 'droite' ? dx + i * largeur : -dx - i * largeur),
            y: disposition === 'colonne' ? parent.y + dy0 + i * pas : parent.y + dy0,
          }));
          const rects = items.map((it) => rectEnfant(it.x, it.y, cote, it.lignes));
          const dedans = rects.every(
            (q) => q.x >= 6 && q.x + q.l <= LARGEUR - 6 && q.y >= 6 && q.y + q.h <= HAUTEUR - 6,
          );
          if (!dedans) continue;
          // Marge autour de chaque sous-action : la largeur réelle des textes varie avec la police et le zoom.
          if (rects.some((q) => fixes.some((f) => recouvre(gonfle(q, 10), f)))) continue;
          if (disposition === 'ligne' && rects.some((q, i) => rects.some((o, j) => j > i && recouvre(gonfle(q, 4), o))))
            continue;
          const cout = dx + Math.abs(dy0) * 0.8 + (disposition === 'ligne' ? 40 : 0);
          if (meilleur && cout >= meilleur.cout) continue;
          const enfants = items.map((it): Enfant => {
            const mx = (parent.x + it.x) / 2;
            return {
              id: it.s.id,
              titre: it.s.titre,
              x: it.x,
              y: it.y,
              cote,
              lignes: it.lignes,
              d: `M${parent.x} ${parent.y} C${mx} ${parent.y}, ${mx} ${it.y}, ${it.x} ${it.y}`,
            };
          });
          meilleur = { enfants, cout };
        }
  return meilleur?.enfants ?? [];
}
export const rectDeEnfant = (e: Enfant) => rectEnfant(e.x, e.y, e.cote, e.lignes);
export const rectsFixes = obstaclesFixes;
export { recouvre };

/** Zone d'appui d'un cercle de l'arbre : le cercle et son libellé forment un seul bouton, sans trou entre les deux. */
export function zoneNoeud(id: string): Rect {
  const p = POINTS[id]!;
  const l = Math.max(...p.lignes.map((s) => largeurTexte(s)));
  const haut = Math.max(RAYON_NOEUD + 8, 9 * p.lignes.length + 4);
  return { x: p.x - RAYON_NOEUD - 8, y: p.y - haut, l: 2 * RAYON_NOEUD + 8 + 8 + l + 8, h: 2 * haut };
}
