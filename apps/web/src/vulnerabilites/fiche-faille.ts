/* Fiche illustrée d'une faille (ADR 0100, point 19 ; lot PC4) : fonctions pures de l'interface (adresse de la route, dates,
   coupe des libellés, mise en page du schéma SVG). Le décodage du vecteur, sa traduction, la règle des sources et les étapes
   du schéma viennent du paquet partagé (fiche-faille-vulnerabilites.ts) ; ici, seulement des positions en unités de la
   viewBox (attributs SVG, aucun style en ligne, ADR 0006). */
import type { EtapeSchema, IconeMetrique, NatureFicheFaille, SchemaVecteur } from '@suivi/shared';

export const urlFicheFaille = (nature: NatureFicheFaille, id: string) =>
  `/api/vulnerabilites/fiches/${encodeURIComponent(nature)}/${encodeURIComponent(id)}`;

/** Date du jour « AAAA-MM-JJ » (ou instant ISO) en « JJ/MM/AAAA », sans fuseau (dates publiées par les sources). */
export function fmtJour(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Coupe un libellé en lignes d'au plus `max` caractères, aux espaces ; au-delà de `lignes`, la dernière finit par « … ».
    Le texte entier reste dans l'équivalent texte sous le schéma. */
export function couperLignes(texte: string, max: number, lignes: number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= max) courante = essai;
    else {
      if (courante) out.push(courante);
      courante = mot.length > max ? `${mot.slice(0, max - 1)}…` : mot;
    }
  }
  if (courante) out.push(courante);
  if (out.length <= lignes) return out;
  const garde = out.slice(0, lignes);
  const derniere = garde[lignes - 1]!;
  garde[lignes - 1] = derniere.length >= max ? `${derniere.slice(0, max - 1)}…` : `${derniere}…`;
  return garde;
}

/** Une boîte du schéma, ses lignes de texte et ses rangées (prérequis, effets). */
export interface BoiteSchema {
  cle: 'origine' | 'prerequis' | 'composant' | 'effets';
  titre: string;
  /** Titre coupé en lignes (capitales), et hauteur de la tête de la boîte. */
  titres: string[];
  tete: number;
  x: number;
  y: number;
  l: number;
  h: number;
  /** Lignes principales (libellé coupé) et de détail. */
  lignes: string[];
  details: string[];
  rangees: (EtapeSchema & { y: number })[];
  force: EtapeSchema['force'];
  /** Pictogramme de l'origine ou du composant (les rangées portent le leur). */
  icone: IconeMetrique | null;
}
export interface FlecheSchema {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface MiseEnPageSchema {
  largeur: number;
  hauteur: number;
  boites: BoiteSchema[];
  fleches: FlecheSchema[];
  /** Rangées des effets sur deux lignes (nom, puis niveau), dans la mise en page large où les colonnes sont étroites. */
  effetsSurDeuxLignes: boolean;
  /** Coordonnées des textes, prêtes à dessiner. */
  rangee: number;
  rangeeEffet: number;
}

const TITRES = {
  origine: 'D’où vient l’attaque',
  prerequis: 'Ce qu’il faut à l’attaquant',
  composant: 'Composant touché',
  effets: 'Ce qui est atteint',
} as const;
/** Hauteur d'une rangée (prérequis, effets), d'une ligne de libellé et d'une ligne de détail, en unités de la viewBox. */
export const RANGEE = 34;
/** Rangée d'un effet sur deux lignes (mise en page large). */
export const RANGEE_EFFET = 42;
/** Ligne de libellé, de détail et de titre ; place du pictogramme. */
export const LIGNE = 19;
export const DETAIL = 15;
export const TITRE = 14;
export const PICTO = 44;

function boite(
  cle: BoiteSchema['cle'],
  s: SchemaVecteur,
  x: number,
  y: number,
  l: number,
  coupe: { libelle: number; detail: number },
  rangeeEffet = RANGEE,
): BoiteSchema {
  // Titre en capitales espacées : environ 8 unités par caractère ; deux lignes au plus dans une colonne étroite.
  const titres = couperLignes(TITRES[cle].toUpperCase(), Math.floor((l - 20) / 8), 2);
  const tete = 12 + titres.length * TITRE + 8;
  if (cle === 'prerequis' || cle === 'effets') {
    const liste = cle === 'prerequis' ? s.prerequis : s.effets;
    const r = cle === 'effets' ? rangeeEffet : RANGEE;
    return {
      cle,
      titre: TITRES[cle],
      titres,
      tete,
      x,
      y,
      l,
      h: tete + liste.length * r + 8,
      lignes: [],
      details: [],
      rangees: liste.map((x2, i) => ({ ...x2, y: y + tete + i * r })),
      force: liste.some((r) => r.force === 'fort') ? 'fort' : 'moyen',
      icone: null,
    };
  }
  const e = cle === 'origine' ? s.origine : s.composant;
  const lignes = couperLignes(e.libelle, coupe.libelle, 3);
  const details = couperLignes(e.detail, coupe.detail, cle === 'composant' ? 5 : 1);
  return {
    cle,
    titre: TITRES[cle],
    titres,
    tete,
    x,
    y,
    l,
    // Tête, pictogramme (30 et sa marge), libellé, détail, marge.
    h: tete + PICTO + lignes.length * LIGNE + details.length * DETAIL + 12,
    lignes,
    details,
    rangees: [],
    force: e.force,
    icone: e.icone,
  };
}

/** Mise en page large : quatre colonnes reliées par des flèches (de gauche à droite). */
export function schemaLarge(s: SchemaVecteur): MiseEnPageSchema {
  const L = 790;
  const col = { origine: [0, 120], prerequis: [148, 268], composant: [444, 170], effets: [642, 148] } as const;
  const boites = (['origine', 'prerequis', 'composant', 'effets'] as const).map((c) =>
    boite(c, s, col[c][0], 0, col[c][1], { libelle: c === 'origine' ? 12 : 18, detail: 25 }, RANGEE_EFFET),
  );
  const hauteur = Math.max(...boites.map((b) => b.h));
  // Boîtes centrées verticalement.
  for (const b of boites) {
    const d = Math.round((hauteur - b.h) / 2);
    b.y += d;
    for (const r of b.rangees) r.y += d;
  }
  const milieu = Math.round(hauteur / 2);
  const fleches = boites.slice(0, -1).map((b, i) => ({
    x1: b.x + b.l + 6,
    y1: milieu,
    x2: boites[i + 1]!.x - 8,
    y2: milieu,
  }));
  return { largeur: L, hauteur, boites, fleches, effetsSurDeuxLignes: true, rangee: RANGEE, rangeeEffet: RANGEE_EFFET };
}

/** Mise en page étroite (téléphone) : les quatre étapes l'une sous l'autre, reliées par des flèches vers le bas. */
export function schemaEtroit(s: SchemaVecteur): MiseEnPageSchema {
  const L = 340;
  const boites: BoiteSchema[] = [];
  const fleches: FlecheSchema[] = [];
  let y = 0;
  for (const c of ['origine', 'prerequis', 'composant', 'effets'] as const) {
    const b = boite(c, s, 0, y, L, { libelle: 32, detail: 40 });
    if (boites.length) fleches.push({ x1: L / 2, y1: y - 30, x2: L / 2, y2: y - 6 });
    boites.push(b);
    y += b.h + 36;
  }
  return {
    largeur: L,
    hauteur: y - 36,
    boites,
    fleches,
    effetsSurDeuxLignes: false,
    rangee: RANGEE,
    rangeeEffet: RANGEE,
  };
}
