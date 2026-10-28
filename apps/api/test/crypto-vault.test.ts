/* Coffre AES-256-GCM : aller-retour, données associées et refus de tout contenu altéré ou d'étiquette tronquée. */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Vault } from '../src/security/crypto.js';

const vault = new Vault(randomBytes(32).toString('base64'));
const clair = Buffer.from('contenu confidentiel');

describe('Vault (AES-256-GCM)', () => {
  it('déchiffre ce qu’il a chiffré, avec les mêmes données associées', () => {
    const e = vault.encrypt(clair, 'document:1');
    expect(e.tag).toHaveLength(16);
    expect(vault.decrypt(e, 'document:1')).toEqual(clair);
    expect(vault.openSmall(vault.sealSmall(clair, 'totp:1'), 'totp:1')).toEqual(clair);
  });

  it('refuse d’autres données associées ou un contenu modifié', () => {
    const e = vault.encrypt(clair, 'document:1');
    expect(() => vault.decrypt(e, 'document:2')).toThrow();
    const altere = Buffer.from(e.content);
    altere[0] = (altere[0] as number) ^ 1;
    expect(() => vault.decrypt({ ...e, content: altere }, 'document:1')).toThrow();
  });

  it('refuse une étiquette d’authentification tronquée', () => {
    const e = vault.encrypt(clair, 'document:1');
    for (const n of [4, 8, 12, 15])
      expect(() => vault.decrypt({ ...e, tag: e.tag.subarray(0, n) }, 'document:1')).toThrow();
    const scelle = vault.sealSmall(clair, 'totp:1');
    // Format iv|étiquette|contenu : retirer 4 octets d'étiquette décale le contenu, qui doit être refusé.
    expect(() => vault.openSmall(Buffer.concat([scelle.subarray(0, 24), scelle.subarray(28)]), 'totp:1')).toThrow();
  });

  it('refuse un contenu chiffré par une autre clé', () => {
    const autre = new Vault(randomBytes(32).toString('base64'));
    expect(() => vault.decrypt(autre.encrypt(clair), '')).toThrow(/Clé de chiffrement différente/);
  });
});
