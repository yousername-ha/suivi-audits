/* Clé de secours des sauvegardes (ADR 0077) : encodage bech32 d'age, contrôle des clés publiques, génération WebCrypto.
   Vecteur de test produit par age-keygen 1.1 (clé jetable, propre à ce test) : octets privés et clé publique attendue. */
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CleSecoursAEnregistrer,
  decoderBech32,
  empreinteCleSecours,
  encoderClePrivee,
  encoderClePublique,
  estClePubliqueAge,
  finCleSecours,
  finCleSecoursCorrespond,
  genererCleSecours,
} from '../src/cle-secours.js';

const PRIVEE_HEX = '73933801d343fb452456cfd0bb6e8401e5da7da5a0bd9b739ae914ea0bd0147a';
const PUBLIQUE = 'age17pgvufarqx5netqz2wypxnpmu68u5zfdswk4qhk8mdg9jckjuu6spgaupp';

/** Clé publique X25519 d'une clé privée, calculée par Node (indépendamment du module testé). */
function publiqueDe(privee: Uint8Array): Uint8Array {
  const der = Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), Buffer.from(privee)]);
  const x = createPublicKey(createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })).export({ format: 'jwk' }).x!;
  return Buffer.from(x, 'base64url');
}

describe('clé de secours au format age', () => {
  it('encode la clé publique comme age-keygen', () => {
    expect(encoderClePublique(publiqueDe(Buffer.from(PRIVEE_HEX, 'hex')))).toBe(PUBLIQUE);
  });
  it('encode la clé privée en majuscules, relue sans perte', () => {
    const privee = encoderClePrivee(Buffer.from(PRIVEE_HEX, 'hex'));
    expect(privee.startsWith('AGE-SECRET-KEY-1')).toBe(true);
    expect(privee).toBe(privee.toUpperCase());
    const d = decoderBech32(privee)!;
    expect(d.hrp).toBe('age-secret-key-');
    expect(Buffer.from(d.octets).toString('hex')).toBe(PRIVEE_HEX);
  });
  it('accepte une clé publique valide, refuse une somme de contrôle fausse, une casse mixte ou une clé privée', () => {
    expect(estClePubliqueAge(PUBLIQUE)).toBe(true);
    expect(estClePubliqueAge(`${PUBLIQUE.slice(0, -1)}q`)).toBe(false);
    expect(estClePubliqueAge(PUBLIQUE.toUpperCase())).toBe(false);
    expect(estClePubliqueAge(encoderClePrivee(Buffer.from(PRIVEE_HEX, 'hex')))).toBe(false);
    expect(decoderBech32(`${PUBLIQUE.slice(0, 10)}A${PUBLIQUE.slice(11)}`)).toBeNull();
    expect(CleSecoursAEnregistrer.safeParse({ publique: PUBLIQUE, coffre: true }).success).toBe(true);
    expect(CleSecoursAEnregistrer.safeParse({ publique: PUBLIQUE, coffre: false }).success).toBe(false);
  });
  it('génère une paire cohérente et un fichier lisible par age', async () => {
    const g = await genererCleSecours(new Date('2026-10-29T12:00:00.123Z'));
    expect(estClePubliqueAge(g.publique)).toBe(true);
    expect(encoderClePublique(publiqueDe(decoderBech32(g.privee)!.octets))).toBe(g.publique);
    expect(g.fichier).toBe(`# created: 2026-10-29T12:00:00Z\n# public key: ${g.publique}\n${g.privee}\n`);
    const autre = await genererCleSecours();
    expect(autre.publique).not.toBe(g.publique);
  });
  it('contrôle la fin recopiée depuis le coffre-fort, sans tenir compte de la casse ni des espaces', async () => {
    const g = await genererCleSecours();
    const fin = finCleSecours(g.privee);
    expect(fin).toHaveLength(8);
    expect(finCleSecoursCorrespond(g.privee, ` ${fin.toLowerCase().slice(0, 4)} ${fin.slice(4)} `)).toBe(true);
    expect(finCleSecoursCorrespond(g.privee, fin.slice(1))).toBe(false);
    expect(empreinteCleSecours(PUBLIQUE)).toBe('6spgaupp');
  });
});
