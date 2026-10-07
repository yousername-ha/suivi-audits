'use strict';
/* Jeton d'installation : format, normalisation et vérification (sans accès à la base, testable seul).
   Format : 4 groupes de 5 caractères, ex. K7QM2-XH9PD-4TNRW-B8FZC.
   Alphabet de 31 symboles sans caractères ambigus (ni 0/O, ni 1/I/L) : 20 × log2(31) ≈ 99 bits d'entropie.
   Seule l'empreinte scrypt du jeton normalisé est conservée. */
const crypto = require('node:crypto');
const sec = require('./security');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_LEN = 5;
const LEN = GROUPS * GROUP_LEN;
const TTL_MS = 24 * 3600e3;
const TOKEN_RE = new RegExp(`^[${ALPHABET}]{${LEN}}$`);
const BITS = Math.floor(LEN * Math.log2(ALPHABET.length));

/** Met en forme 20 caractères en XXXXX-XXXXX-XXXXX-XXXXX. */
function format(raw) { return raw.match(new RegExp(`.{1,${GROUP_LEN}}`, 'g')).join('-'); }

/** Nouveau jeton, tiré uniformément (crypto.randomInt évite le biais du modulo). */
function generate() {
  let raw = '';
  for (let i = 0; i < LEN; i++) raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return format(raw);
}

/** Normalise une saisie : majuscules, sans espaces ni tirets. Renvoie null si le format est invalide. */
function normalize(input) {
  if (typeof input !== 'string' || input.length > 100) return null;
  const s = input.normalize('NFKC').toUpperCase().replace(/[\s\-‐-―−_]/g, '');
  return TOKEN_RE.test(s) ? s : null;
}

/** Enregistrement à stocker pour un jeton (aucune donnée permettant de le retrouver). */
async function makeRecord(token, reason, now = Date.now()) {
  return { hash: await sec.hashPassword(normalize(token)), expires: new Date(now + TTL_MS).toISOString(), reason };
}

/** Vérifie une saisie contre l'enregistrement stocké.
    Résultat : 'ok' | 'invalid' (format, jeton inconnu ou remplacé) | 'expired' | 'used' | 'none' (aucun jeton émis).
    « expired » et « used » ne sont renvoyés que si le jeton saisi est le bon. */
async function check(input, record, now = Date.now()) {
  if (!record || !record.hash) return 'none';
  const tok = normalize(input);
  if (!tok) { await sec.dummyVerify('x'); return 'invalid'; }
  if (!(await sec.verifyPassword(tok, record.hash))) return 'invalid';
  if (record.usedAt) return 'used';
  if (!(new Date(record.expires).getTime() > now)) return 'expired';
  return 'ok';
}

/** Un jeton est en attente s'il n'a pas été utilisé et n'a pas expiré. */
function pending(record, now = Date.now()) {
  return !!(record && record.hash && !record.usedAt && new Date(record.expires).getTime() > now);
}

const MESSAGES = {
  invalid: "Jeton d'installation invalide. Vérifiez la saisie ou utilisez le dernier jeton généré (les précédents sont annulés).",
  expired: "Jeton d'installation expiré (validité 24 h). Générez-en un nouveau : docker compose exec app setup-token",
  used: "Ce jeton d'installation a déjà été utilisé. Connectez-vous, ou générez-en un nouveau si aucun administrateur n'a été créé.",
  none: "Aucun jeton d'installation en cours. Générez-en un : docker compose exec app setup-token",
};

module.exports = { ALPHABET, LEN, BITS, TTL_MS, format, generate, normalize, makeRecord, check, pending, MESSAGES };
