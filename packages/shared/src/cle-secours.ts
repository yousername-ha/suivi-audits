/* Clé de secours des sauvegardes (ADR 0071, ADR 0077) : paire X25519 au format age, générée dans le navigateur de la personne
   qui installe. La clé privée (AGE-SECRET-KEY-1…) ne quitte jamais le navigateur : elle est téléchargée et rangée au
   coffre-fort ; seule la clé publique (age1…) est envoyée au serveur, qui chiffre chaque sauvegarde pour elle.
   Encodage bech32 (BIP 173), celui d'age : une seule écriture, sans dépendance, testée contre age-keygen. */
import { z } from 'zod';

const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATEURS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
/** Préfixes age : clé publique en minuscules, clé privée en majuscules (le contrôle se calcule en minuscules). */
const HRP_PUBLIQUE = 'age';
const HRP_PRIVEE = 'age-secret-key-';
/** Nombre de caractères de la clé privée à recopier depuis le coffre-fort pour prouver qu'elle y est rangée. */
export const CLE_SECOURS_FIN_LONGUEUR = 8;

function polymod(valeurs: number[]): number {
  let chk = 1;
  for (const v of valeurs) {
    const haut = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((haut >>> i) & 1) chk ^= GENERATEURS[i]!;
  }
  return chk;
}
const etendre = (hrp: string) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >>> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];

function regrouper(donnees: Iterable<number>, de: number, vers: number, completer: boolean): number[] | null {
  let acc = 0,
    bits = 0;
  const out: number[] = [];
  const max = (1 << vers) - 1;
  for (const v of donnees) {
    if (v < 0 || v >> de) return null;
    acc = (acc << de) | v;
    bits += de;
    while (bits >= vers) {
      bits -= vers;
      out.push((acc >>> bits) & max);
    }
  }
  if (completer) {
    if (bits) out.push((acc << (vers - bits)) & max);
  } else if (bits >= de || (acc << (vers - bits)) & max) return null;
  return out;
}

function encoder(hrp: string, octets: Uint8Array): string {
  const donnees = regrouper(octets, 8, 5, true)!;
  const mod = polymod([...etendre(hrp), ...donnees, 0, 0, 0, 0, 0, 0]) ^ 1;
  const controle = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...donnees, ...controle].map((v) => ALPHABET[v]).join('')}`;
}

/** Décode une chaîne bech32 (casse homogène) : préfixe et octets, ou null si elle est mal formée ou si son contrôle est faux. */
export function decoderBech32(texte: string): { hrp: string; octets: Uint8Array } | null {
  if (texte !== texte.toLowerCase() && texte !== texte.toUpperCase()) return null;
  const s = texte.toLowerCase();
  const sep = s.lastIndexOf('1');
  if (sep < 1 || sep + 7 > s.length) return null;
  const hrp = s.slice(0, sep);
  const valeurs: number[] = [];
  for (const c of s.slice(sep + 1)) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    valeurs.push(v);
  }
  if (polymod([...etendre(hrp), ...valeurs]) !== 1) return null;
  const octets = regrouper(valeurs.slice(0, -6), 5, 8, false);
  return octets ? { hrp, octets: Uint8Array.from(octets) } : null;
}

/** Clé publique age (age1…, 62 caractères) à partir des 32 octets X25519. */
export const encoderClePublique = (octets: Uint8Array) => encoder(HRP_PUBLIQUE, octets);
/** Clé privée age (AGE-SECRET-KEY-1…) à partir des 32 octets X25519. */
export const encoderClePrivee = (octets: Uint8Array) => encoder(HRP_PRIVEE, octets).toUpperCase();

/** Vrai pour une clé publique age valide : préfixe, longueur, alphabet et somme de contrôle. */
export function estClePubliqueAge(texte: string): boolean {
  if (!/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(texte)) return false;
  const d = decoderBech32(texte);
  return !!d && d.hrp === HRP_PUBLIQUE && d.octets.length === 32;
}

/** Empreinte courte d'une clé publique, pour la reconnaître sans la recopier : ses 8 derniers caractères. */
export const empreinteCleSecours = (publique: string) => publique.slice(-8);

const deBase64Url = (s: string) =>
  Uint8Array.from(
    atob(
      s
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(s.length / 4) * 4, '='),
    ),
    (c) => c.charCodeAt(0),
  );

export interface CleSecoursGeneree {
  /** Clé privée, à ranger au coffre-fort ; jamais envoyée au serveur. */
  privee: string;
  publique: string;
  /** Contenu du fichier téléchargé, au format d'age-keygen (lisible par age -d -i). */
  fichier: string;
}

/** Nouvelle paire X25519 générée par WebCrypto (navigateur, ou Node ≥ 20) : aucune dépendance, aucun envoi réseau. */
export async function genererCleSecours(maintenant = new Date()): Promise<CleSecoursGeneree> {
  // generateKey renvoie une paire pour X25519 ; le type de la bibliothèque DOM l'annonce plus large.
  const paire = (await globalThis.crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])) as unknown as {
    privateKey: CryptoKey;
  };
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', paire.privateKey);
  if (!jwk.d || !jwk.x) throw new Error('Clé X25519 non exportable par ce navigateur.');
  const privee = encoderClePrivee(deBase64Url(jwk.d));
  const publique = encoderClePublique(deBase64Url(jwk.x));
  const fichier = `# created: ${maintenant.toISOString().replace(/\.\d{3}Z$/, 'Z')}\n# public key: ${publique}\n${privee}\n`;
  return { privee, publique, fichier };
}

/** Les 8 derniers caractères de la clé privée : preuve qu'elle a été rangée au coffre-fort (contrôle dans le navigateur). */
export const finCleSecours = (privee: string) => privee.slice(-CLE_SECOURS_FIN_LONGUEUR);
export const finCleSecoursCorrespond = (privee: string, saisie: string) =>
  saisie.replace(/\s/g, '').toUpperCase() === finCleSecours(privee);

/* ---------------------------------------------------------------- Échanges API */
export const ClePubliqueAge = z
  .string()
  .refine(estClePubliqueAge, 'Clé publique age attendue (age1…, 62 caractères). Ne jamais envoyer la clé privée.');
/** Clé de secours à enregistrer : la clé publique seule, et l'engagement de l'avoir rangée au coffre-fort. */
export const CleSecoursAEnregistrer = z.object({ publique: ClePubliqueAge, coffre: z.literal(true) });
export type CleSecoursAEnregistrer = z.infer<typeof CleSecoursAEnregistrer>;
export const CleSecoursDefinirBody = z.object({
  cleSecours: CleSecoursAEnregistrer,
  code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres.'),
});
export const CleSecoursEtat = z.object({
  /** Clé enregistrée par l'application (null si aucune). */
  publique: z.string().nullable(),
  definiLe: z.string().nullable(),
  definiPar: z.string().nullable(),
  /** Clés publiques effectivement lues par l'exécutant des sauvegardes (fichier du serveur), et date de ce constat. */
  serveur: z.array(z.string()),
  vuLe: z.string().nullable(),
  /** Sauvegardes possibles : clé du serveur et au moins une clé de secours en place. */
  sauvegardesPossibles: z.boolean(),
});
export type CleSecoursEtat = z.infer<typeof CleSecoursEtat>;
