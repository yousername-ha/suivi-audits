/* Jeton d'installation : génération, enregistrement (empreinte scrypt seulement) et vérification. */
import crypto from 'node:crypto';
import {
  formatSetupToken,
  normalizeSetupToken,
  SETUP_TOKEN_ALPHABET,
  SETUP_TOKEN_LEN,
  SETUP_TOKEN_TTL_MS,
  type SetupTokenStatus,
} from '@suivi/shared';
import { dummyVerify, hashPassword, verifyPassword } from './crypto.js';

export interface SetupTokenRecord {
  hash: string;
  expires: string;
  reason: string;
  usedAt?: string;
}

/** Nouveau jeton, tiré uniformément (crypto.randomInt évite le biais du modulo). */
export function generateSetupToken(): string {
  let raw = '';
  for (let i = 0; i < SETUP_TOKEN_LEN; i++) raw += SETUP_TOKEN_ALPHABET[crypto.randomInt(SETUP_TOKEN_ALPHABET.length)];
  return formatSetupToken(raw);
}

export async function makeSetupTokenRecord(tok: string, reason: string, now = Date.now()): Promise<SetupTokenRecord> {
  const n = normalizeSetupToken(tok);
  if (!n) throw new Error('jeton mal formé');
  return { hash: await hashPassword(n), expires: new Date(now + SETUP_TOKEN_TTL_MS).toISOString(), reason };
}

/** « expired » et « used » ne sont révélés qu'à qui présente le bon jeton. */
export async function checkSetupToken(input: unknown, rec: SetupTokenRecord | null | undefined, now = Date.now()): Promise<SetupTokenStatus> {
  if (!rec || !rec.hash) return 'none';
  const tok = normalizeSetupToken(input);
  if (!tok) {
    await dummyVerify('x');
    return 'invalid';
  }
  if (!(await verifyPassword(tok, rec.hash))) return 'invalid';
  if (rec.usedAt) return 'used';
  if (!(new Date(rec.expires).getTime() > now)) return 'expired';
  return 'ok';
}

export const setupTokenPending = (rec: SetupTokenRecord | null | undefined, now = Date.now()): boolean =>
  !!(rec && rec.hash && !rec.usedAt && new Date(rec.expires).getTime() > now);
