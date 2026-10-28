/* TRUST_PROXY : nombre de relais, liste d'adresses ou de CIDR, ou booléen (compatibilité). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { Agent, createTestApp, type TestApp } from './helpers.js';

const lire = (v?: string) =>
  loadConfig({ SECRETS_DIR: '/nonexistent', ...(v === undefined ? {} : { TRUST_PROXY: v }) }).trustProxy;

describe('analyse de TRUST_PROXY', () => {
  it('garde les booléens et refuse de faire confiance par défaut', () => {
    expect(lire()).toBe(false);
    expect(lire('')).toBe(false);
    for (const v of ['false', 'FALSE', 'no', 'non', '0']) expect(lire(v), v).toBe(false);
    for (const v of ['true', 'TRUE', 'yes', 'oui']) expect(lire(v), v).toBe(true);
  });

  it('lit un nombre de relais', () => {
    expect(lire('1')).toBe(1);
    expect(lire('2')).toBe(2);
    expect(lire(' 3 ')).toBe(3);
  });

  it("lit une liste d'adresses ou de CIDR", () => {
    expect(lire('10.0.0.0/8, 192.168.1.5')).toEqual(['10.0.0.0/8', '192.168.1.5']);
    expect(lire('fd00::/8,::1')).toEqual(['fd00::/8', '::1']);
  });

  it('refuse une valeur mal formée plutôt que de la deviner', () => {
    for (const v of ['abc', '-1', '1.5', '11', '10.0.0.0/33', '10.0.0/8', '10.0.0.1, ,10.0.0.2', 'fd00::/129'])
      expect(() => lire(v), v).toThrow(/TRUST_PROXY/);
  });
});

describe('adresse cliente selon TRUST_PROXY', () => {
  const apps: TestApp[] = [];
  afterAll(async () => {
    for (const x of apps) await x.close();
  });
  let ip1: string, ipTous: string, ipAucun: string;
  beforeAll(async () => {
    const adresse = async (valeur: string) => {
      const t = await createTestApp({ TRUST_PROXY: valeur });
      apps.push(t);
      await new Agent(t).req('POST', '/api/auth/login', {
        json: { username: 'inconnu', password: 'x' },
        headers: { 'x-forwarded-for': '6.6.6.6, 10.0.0.9' },
      });
      const r = await t.svc.db.one<{ ip: string }>(
        'SELECT ip::text AS ip FROM audit_log WHERE ip IS NOT NULL ORDER BY id DESC LIMIT 1',
      );
      return String(r?.ip ?? '').replace(/\/\d+$/, '');
    };
    ip1 = await adresse('1');
    ipTous = await adresse('true');
    ipAucun = await adresse('false');
  }, 60000);

  it("avec un relais, l'adresse retenue est celle ajoutée par ce relais, pas celle fournie par le client", () => {
    expect(ip1).toBe('10.0.0.9');
  });

  it('avec true, la première adresse de la liste est retenue (comportement antérieur conservé)', () => {
    expect(ipTous).toBe('6.6.6.6');
  });

  it("avec false, l'en-tête est ignoré", () => {
    expect(ipAucun).toBe('127.0.0.1');
  });
});
