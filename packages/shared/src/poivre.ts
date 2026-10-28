/* Poivre des mots de passe (ADR 0072) : règles de solidité, génération et schémas d'échange.
   Les règles s'exécutent côté serveur (autorité) et dans l'interface (affichage en direct) : une seule écriture, sans dépendance.
   Le poivre en texte n'est jamais stocké ni journalisé ; seule la clé qu'on en dérive est scellée côté serveur. */
import { z } from 'zod';

export const POIVRE_LONGUEUR_MIN = 32;
export const POIVRE_LONGUEUR_MAX = 256;
export const POIVRE_ENTROPIE_MIN = 128;
/** Poivre généré : 32 octets aléatoires en base32, soit 52 caractères (affichés par groupes de 4). */
export const POIVRE_GENERE_LONGUEUR = 52;
export const POIVRE_FIN_LONGUEUR = 8;

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const FORME_GENEREE = /^[A-Z2-7]{52}$/;

/** Forme canonique : c'est elle qui est dérivée. Un poivre généré, recopié avec des espaces ou des tirets entre groupes ou en
    minuscules, retrouve sa forme d'origine ; tout autre texte est normalisé (NFKC) et débarrassé des blancs de bord. */
export function canoniquePoivre(texte: string): string {
  const t = texte.normalize('NFKC').trim();
  const sansSeparateurs = t.replace(/[ -]/g, '').toUpperCase();
  return FORME_GENEREE.test(sansSeparateurs) ? sansSeparateurs : t;
}
export const estPoivreGenere = (canonique: string) => FORME_GENEREE.test(canonique);

/** Affichage d'un poivre généré : groupes de 4 séparés par un tiret. */
export const formaterPoivreGenere = (canonique: string) => canonique.replace(/(.{4})(?=.)/g, '$1-');

function base32(octets: Uint8Array): string {
  let bits = 0,
    val = 0,
    out = '';
  for (const b of octets) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

/** Nouveau poivre aléatoire (cryptographique, navigateur ou Node ≥ 19). Les tirages qui échoueraient aux règles de répétition
    ou de suite (probabilité d'environ 0,2 %) sont écartés, pour que tout poivre proposé soit accepté par le serveur. */
export function genererPoivre(
  aleatoire: (n: number) => Uint8Array = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
): string {
  for (;;) {
    const p = base32(aleatoire(32)).slice(0, POIVRE_GENERE_LONGUEUR);
    if (problemesPoivre(p, { mode: 'genere' }).length === 0) return p;
  }
}

const CLAVIERS = ['azertyuiop', 'qsdfghjklm', 'wxcvbn', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const RANGEES = [...CLAVIERS, ...CLAVIERS.map((r) => [...r].reverse().join(''))];

/** Plus longue série de caractères identiques consécutifs. */
function plusLongueRepetition(s: string): number {
  let max = 0,
    cur = 0,
    prev = '';
  for (const c of s) {
    cur = c === prev ? cur + 1 : 1;
    prev = c;
    if (cur > max) max = cur;
  }
  return max;
}

/** Vrai si le texte contient une suite de plus de 4 caractères consécutifs : codes qui se suivent (abcde, 54321) ou rangée de
    clavier (azerty, qwerty), sans tenir compte de la casse. */
export function contientSuite(s: string): boolean {
  const t = [...s.toLowerCase()];
  let montant = 1,
    descendant = 1;
  for (let i = 1; i < t.length; i++) {
    const d = t[i]!.codePointAt(0)! - t[i - 1]!.codePointAt(0)!;
    montant = d === 1 ? montant + 1 : 1;
    descendant = d === -1 ? descendant + 1 : 1;
    if (montant > 4 || descendant > 4) return true;
  }
  const bas = s.toLowerCase();
  for (const r of RANGEES) for (let i = 0; i + 5 <= r.length; i++) if (bas.includes(r.slice(i, i + 5))) return true;
  return false;
}

const MINUSCULES = /\p{Ll}/u;
const MAJUSCULES = /\p{Lu}/u;
const CHIFFRES = /\p{Nd}/u;

/** Taille de l'alphabet effectivement utilisé : minuscules 26, majuscules 26, chiffres 10, autres caractères 33. */
function tailleAlphabet(s: string): number {
  return (
    (MINUSCULES.test(s) ? 26 : 0) +
    (MAJUSCULES.test(s) ? 26 : 0) +
    (CHIFFRES.test(s) ? 10 : 0) +
    ([...s].some((c) => !/[\p{L}\p{Nd}]/u.test(c)) ? 33 : 0)
  );
}
/** Estimation prudente : longueur × log2(taille de l'alphabet effectivement utilisé). */
export function entropiePoivre(s: string): number {
  const a = tailleAlphabet(s);
  return a > 1 ? [...s].length * Math.log2(a) : 0;
}

const classes = (s: string) =>
  [MINUSCULES, MAJUSCULES, CHIFFRES].filter((r) => r.test(s)).length +
  ([...s].some((c) => !/[\p{L}\p{Nd}]/u.test(c)) ? 1 : 0);

/** Phrase de passe : au moins 6 mots séparés par des espaces. */
const motsDe = (s: string) => s.split(/\s+/).filter(Boolean);

export interface ContextePoivre {
  mode: 'genere' | 'saisi';
  /** Textes que le poivre ne doit pas contenir (nom de l'application, de l'organisation, identifiants de comptes). */
  interdits?: string[];
  /** Poivre actuel, pour refuser un poivre identique (changement). */
  ancien?: string;
}

/** Problèmes d'un poivre, un message par critère (liste vide : accepté). Le poivre est d'abord ramené à sa forme canonique. */
export function problemesPoivre(texte: string, ctx: ContextePoivre): string[] {
  const s = canoniquePoivre(texte);
  const p: string[] = [];
  const n = [...s].length;
  if (ctx.mode === 'genere') {
    if (!estPoivreGenere(s)) p.push('un poivre généré compte exactement 52 caractères en base32 (A à Z, 2 à 7)');
    else if (new Set(s).size < 16) p.push('un poivre généré doit comporter au moins 16 caractères différents');
  } else {
    if (n < POIVRE_LONGUEUR_MIN) p.push(`au moins ${POIVRE_LONGUEUR_MIN} caractères`);
    if (n > POIVRE_LONGUEUR_MAX) p.push(`${POIVRE_LONGUEUR_MAX} caractères au maximum`);
    const phrase = motsDe(s).length >= 6 && n >= 40;
    if (!phrase && classes(s) < 3)
      p.push(
        'au moins 3 types de caractères parmi minuscules, majuscules, chiffres et symboles, ou une phrase d’au moins 6 mots (40 caractères au minimum)',
      );
    if (n >= 1 && entropiePoivre(s) < POIVRE_ENTROPIE_MIN)
      p.push(`entropie estimée inférieure à ${POIVRE_ENTROPIE_MIN} bits : allonger ou varier les caractères`);
  }
  if (plusLongueRepetition(s) > 3) p.push('pas plus de 3 caractères identiques à la suite');
  if (contientSuite(s)) p.push('pas de suite de plus de 4 caractères consécutifs (abcde, 12345, azerty, qwerty…)');
  const bas = s.toLowerCase();
  for (const t of ctx.interdits ?? []) {
    const m = t.normalize('NFKC').trim().toLowerCase();
    if (m.length >= 3 && bas.includes(m)) {
      p.push('ne doit contenir ni le nom de l’application ou de l’organisation, ni un identifiant de compte');
      break;
    }
  }
  if (ctx.ancien !== undefined && canoniquePoivre(ctx.ancien) === s) p.push('doit être différent de l’ancien poivre');
  return p;
}

/** Les 8 derniers caractères de la forme canonique : preuve que le poivre a été recopié au coffre-fort. */
export const finPoivre = (texte: string) => [...canoniquePoivre(texte)].slice(-POIVRE_FIN_LONGUEUR).join('');
/** La saisie de contrôle correspond-elle ? Insensible à la casse et aux séparateurs pour un poivre généré (base32). */
export function finCorrespond(texte: string, saisie: string): boolean {
  const c = canoniquePoivre(texte);
  const attendu = finPoivre(c);
  const s = saisie.normalize('NFKC').trim();
  return estPoivreGenere(c) ? s.replace(/[ -]/g, '').toUpperCase() === attendu : s === attendu;
}

/* ---------------------------------------------------------------- Échanges API */
export const PoivreMode = z.enum(['genere', 'saisi']);
/** Engagement de sauvegarde au coffre-fort : case cochée et nouvelle saisie des 8 derniers caractères. */
export const PoivreEngagement = z.object({ coffre: z.literal(true), fin: z.string().max(40) });
/** Poivre à enregistrer (installation, définition, changement). */
export const PoivreAEnregistrer = z.object({
  mode: PoivreMode,
  valeur: z.string().min(1).max(400),
  engagement: PoivreEngagement,
});
export type PoivreAEnregistrer = z.infer<typeof PoivreAEnregistrer>;
const Code = z.string().regex(/^\d{6}$/, 'Code à 6 chiffres.');
export const PoivreDefinirBody = z.object({ poivre: PoivreAEnregistrer, code: Code });
export const PoivreChangerBody = z.object({
  poivre: PoivreAEnregistrer,
  ancienPoivre: z.string().min(1).max(400),
  code: Code,
});
export const PoivreEtat = z.object({
  defini: z.boolean(),
  idCle: z.string().nullable(),
  definiLe: z.string().nullable(),
  definiPar: z.string().nullable(),
  /** Empreintes de mot de passe déjà chiffrées par le poivre, et nombre total de comptes. */
  empreintesPoivrees: z.number().int(),
  comptes: z.number().int(),
});
export type PoivreEtat = z.infer<typeof PoivreEtat>;
