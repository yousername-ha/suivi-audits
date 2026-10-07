/* Jeton d'installation : format et normalisation (partagés entre l'API et l'interface).
   Format : 4 groupes de 5 caractères, ex. K7QM2-XH9PD-4TNRW-B8FZC.
   Alphabet de 31 symboles sans caractères ambigus (ni 0/O, ni 1/I/L) : 20 × log2(31) ≈ 99 bits d'entropie.
   La génération (aléa cryptographique) et le hachage restent côté serveur. */

export const SETUP_TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SETUP_TOKEN_GROUPS = 4;
export const SETUP_TOKEN_GROUP_LEN = 5;
export const SETUP_TOKEN_LEN = SETUP_TOKEN_GROUPS * SETUP_TOKEN_GROUP_LEN;
export const SETUP_TOKEN_BITS = Math.floor(SETUP_TOKEN_LEN * Math.log2(SETUP_TOKEN_ALPHABET.length));
export const SETUP_TOKEN_TTL_MS = 24 * 3600e3;
export const SETUP_TOKEN_PLACEHOLDER = 'XXXXX-XXXXX-XXXXX-XXXXX';

const TOKEN_RE = new RegExp(`^[${SETUP_TOKEN_ALPHABET}]{${SETUP_TOKEN_LEN}}$`);
const SEPARATORS = /[\s\-‐-―−_]/g;

/** Met en forme des caractères significatifs en XXXXX-XXXXX-XXXXX-XXXXX (tronque à 20). */
export function formatSetupToken(raw: string): string {
  return raw.slice(0, SETUP_TOKEN_LEN).replace(new RegExp(`(.{${SETUP_TOKEN_GROUP_LEN}})(?=.)`, 'g'), '$1-');
}

/** Caractères significatifs d'une saisie (majuscules, chiffres), sans séparateurs. */
export function setupTokenChars(input: string): string {
  return input
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Normalise une saisie : majuscules, sans espaces ni tirets. Renvoie null si le format est invalide. */
export function normalizeSetupToken(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 100) return null;
  const s = input.normalize('NFKC').toUpperCase().replace(SEPARATORS, '');
  return TOKEN_RE.test(s) ? s : null;
}

/** Problème de saisie détectable avant envoi (message en français), ou null. */
export function setupTokenInputProblem(input: string): string | null {
  const r = setupTokenChars(input);
  if (/[01ILO]/.test(r)) return 'Le jeton ne contient jamais les caractères 0, 1, I, L ni O. Vérifiez la saisie.';
  if (r.length !== SETUP_TOKEN_LEN) return `Le jeton comporte 20 caractères (4 groupes de 5) ; ${r.length} saisi(s).`;
  return null;
}

export type SetupTokenStatus = 'ok' | 'invalid' | 'expired' | 'used' | 'none';

export const SETUP_TOKEN_MESSAGES: Record<Exclude<SetupTokenStatus, 'ok'>, string> = {
  invalid:
    "Jeton d'installation invalide. Vérifiez la saisie ou utilisez le dernier jeton généré (les précédents sont annulés).",
  expired: "Jeton d'installation expiré (validité 24 h). Générez-en un nouveau : docker compose exec app setup-token",
  used: "Ce jeton d'installation a déjà été utilisé. Connectez-vous, ou générez-en un nouveau si aucun administrateur n'a été créé.",
  none: "Aucun jeton d'installation en cours. Générez-en un : docker compose exec app setup-token",
};

/** Commandes rappelées sur la page d'installation et dans les journaux. */
export const SETUP_TOKEN_COMMANDS = {
  generate: 'docker compose exec app setup-token',
  logs: 'docker compose logs app | grep -A3 JETON',
} as const;
