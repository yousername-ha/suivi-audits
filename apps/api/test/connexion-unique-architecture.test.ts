/* Garde-fous d'architecture de la connexion unique SAML (ADR 0114) : listes fermées de l'exécutant et du script isolé
   recopiées du paquet partagé ; exception d'origine limitée à la seule adresse de retour ; « aucun XML hors SAML » dans l'API
   (aucune autre analyse XML que celle du dossier connexion-unique, par @node-saml/node-saml). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { HOTE_METADONNEES_ENTRA, SSO_BORNES, SSO_TYPES } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { allRoutes } from '../src/app.js';
import { URL_ACS_SAML } from '../src/http/route.js';
import { REPO } from './helpers.js';

const lire = (f: string) => readFileSync(path.join(REPO, f), 'utf8');
const tuple = (texte: string, nom: string) => {
  const m = new RegExp(`^${nom} = \\(([^)]*)\\)$`, 'm').exec(texte);
  if (!m) throw new Error(`${nom} introuvable`);
  return [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};
const chaine = (texte: string, nom: string) => new RegExp(`^${nom} = "([^"]+)"$`, 'm').exec(texte)?.[1];

describe('connexion unique : architecture', () => {
  it('l’exécutant et le script recopient les types, l’hôte d’Entra ID et la borne des métadonnées', () => {
    const worker = lire('scripts/exploitation-worker.py');
    expect(tuple(worker, 'SSO_TYPES')).toEqual([...SSO_TYPES]);
    expect(chaine(worker, 'SSO_HOTE_ENTRA')).toBe(HOTE_METADONNEES_ENTRA);
    expect(chaine(worker, 'SSO_FLUX')).toBe('sso-saml');
    expect(worker).toMatch(/^FLUX_PORTES = \(.*"sso-saml".*\)$/m);
    const script = lire('scripts/sso-metadonnees.py');
    expect(tuple(script, 'TYPES')).toEqual([...SSO_TYPES]);
    expect(chaine(script, 'HOTE_ENTRA')).toBe(HOTE_METADONNEES_ENTRA);
    expect(/^REPONSE_MAX = 1024 \* 1024$/m.test(script)).toBe(true);
    expect(SSO_BORNES.metadonnees).toBe(1024 * 1024);
  });

  it('seule l’adresse de retour SAML échappe au contrôle d’origine', () => {
    const exceptions = allRoutes().filter((r) => r.origineExterne);
    expect(exceptions.map((r) => `${String(r.method)} ${r.url}`)).toEqual([`POST ${URL_ACS_SAML}`]);
    expect(exceptions[0]).toMatchObject({ access: 'public', csrf: false });
  });

  it('aucun XML hors SAML : l’API n’analyse aucun autre XML', () => {
    const racine = path.join(REPO, 'apps/api/src');
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (p.endsWith('.ts')) fichiers.push(p);
      }
    };
    parcourir(racine);
    const XML = /@xmldom\/|xml2js|fast-xml-parser|sax['"]|DOMParser|node-saml\/lib\/xml|from '@node-saml\/node-saml'/;
    const hors = fichiers
      .filter((f) => XML.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(racine, f))
      .filter((f) => !f.startsWith('connexion-unique/'));
    expect(hors).toEqual([]);
  });
});
