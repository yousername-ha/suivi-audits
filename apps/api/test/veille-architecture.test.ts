/* Garde-fou de la veille des vulnérabilités (ADR 0100, points 3 à 5) : l'exécutant et son script isolé ne lisent pas le
   registre TypeScript ; la liste fermée des hôtes et des chemins, les bornes et les formes contrôlées y sont recopiées, et
   ce test garantit qu'elles restent identiques au registre partagé. Aucune adresse reçue de l'application n'y est ajoutée à
   l'exécution ; le flux du registre déclare exactement ces hôtes. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ADRESSE_CERTSANTE,
  CERTFR_ID,
  CERTSANTE_ID,
  CVE_ID,
  CVSS31_VECTEUR,
  CVSS40_VECTEUR,
  CPE_BORNES,
  fluxExterne,
  NOM_CPE,
  SLUG_CERTSANTE,
  SOURCE_DICTIONNAIRE_CPE,
  sourceVeille,
  SOURCES_VEILLE,
  SOURCES_VEILLE_DEFINITIONS,
  VEILLE_BORNES,
  VERSION_CPE,
} from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

const lire = (f: string) => readFileSync(path.join(REPO, f), 'utf8');
const SCRIPT = lire('scripts/veille-vulnerabilites.py');
const EXECUTANT = lire('scripts/exploitation-worker.py');
/** Constante Python écrite en JSON sur une seule ligne (`NOM = {...}` ou `NOM = (...)`). */
const constante = (texte: string, nom: string): unknown => {
  const m = new RegExp(`^${nom} = ([{(].*[})])$`, 'm').exec(texte);
  expect(m, nom).not.toBeNull();
  return JSON.parse(m![1]!.replace(/^\((.*)\)$/, '[$1]'));
};
const motif = (texte: string, nom: string): string => {
  const m = new RegExp(`^${nom} = re\\.compile\\(r"(.*)"\\)$`, 'm').exec(texte);
  expect(m, nom).not.toBeNull();
  return m![1]!;
};
const entier = (texte: string, nom: string): number => {
  const m = new RegExp(`^${nom} = (\\d+)$`, 'm').exec(texte);
  expect(m, nom).not.toBeNull();
  return Number(m![1]);
};

describe('architecture : veille des vulnérabilités', () => {
  it('la liste fermée des hôtes et des chemins du script est celle du registre partagé', () => {
    expect(constante(SCRIPT, 'SOURCES')).toEqual(
      Object.fromEntries(SOURCES_VEILLE_DEFINITIONS.map((s) => [s.id, { hote: s.hote, chemins: [...s.chemins] }])),
    );
    // HTTPS sur des noms publics seulement ; aucun hôte historique qui redirige (www.cert.ssi.gouv.fr).
    for (const s of SOURCES_VEILLE_DEFINITIONS) {
      expect(s.hote).toMatch(/^[a-z0-9.-]+\.(gov|org|fr)$/);
      expect(s.hote).not.toContain('ssi.gouv.fr');
    }
  });

  it('le flux « veille-vulnerabilites » déclare exactement ces hôtes, en TCP 443, porté par l’exécutant', () => {
    const f = fluxExterne('veille-vulnerabilites');
    expect(f.destinations.map((d) => d.hote.split(' ')[0])).toEqual(SOURCES_VEILLE_DEFINITIONS.map((s) => s.hote));
    for (const d of f.destinations) expect(d).toMatchObject({ sens: 'sortant', ports: 'TCP 443 (HTTPS)' });
    expect(f.porteur.services).toEqual(['updater']);
    expect(f.moduleActivation).toBe('vulnerabilites');
    for (const s of SOURCES_VEILLE_DEFINITIONS) expect(f.pareFeu.join(' ')).toContain(s.hote);
  });

  it('bornes et formes contrôlées identiques dans le script', () => {
    expect(constante(SCRIPT, 'BORNES')).toEqual({ ...VEILLE_BORNES });
    for (const [nom, re] of [
      ['CVE_ID', CVE_ID],
      ['CERTFR_ID', CERTFR_ID],
      ['CERTSANTE_ID', CERTSANTE_ID],
      ['ADRESSE_CERTSANTE', ADRESSE_CERTSANTE],
      ['SLUG_CERTSANTE', SLUG_CERTSANTE],
      ['CVSS31_VECTEUR', CVSS31_VECTEUR],
      ['CVSS40_VECTEUR', CVSS40_VECTEUR],
      ['NOM_CPE', NOM_CPE],
      ['VERSION_CPE', VERSION_CPE],
    ] as const)
      expect(motif(SCRIPT, nom), nom).toBe(re.source);
  });

  it('l’exécutant connaît les mêmes sources, le même flux et les mêmes bornes de lots', () => {
    expect(constante(EXECUTANT, 'VEILLE_SOURCES')).toEqual([...SOURCES_VEILLE]);
    expect(/^VEILLE_FLUX = "([a-z-]+)"$/m.exec(EXECUTANT)?.[1]).toBe('veille-vulnerabilites');
    expect(entier(EXECUTANT, 'VEILLE_LOT')).toBe(VEILLE_BORNES.lot);
    expect(entier(EXECUTANT, 'VEILLE_LOTS_MAX')).toBe(VEILLE_BORNES.lots);
  });

  it('dictionnaire CPE (lot CPE-1) : même hôte que NVD, un seul chemin, mêmes bornes dans le script et l’exécutant', () => {
    expect(constante(SCRIPT, 'SOURCES_CPE')).toEqual({
      [SOURCE_DICTIONNAIRE_CPE.id]: {
        hote: SOURCE_DICTIONNAIRE_CPE.hote,
        chemins: [...SOURCE_DICTIONNAIRE_CPE.chemins],
      },
    });
    // Aucune destination nouvelle : l'hôte est celui de la veille NVD, déjà déclaré par le flux.
    expect(SOURCE_DICTIONNAIRE_CPE.hote).toBe(sourceVeille('nvd').hote);
    expect(fluxExterne('veille-vulnerabilites').pareFeu.join(' ')).toContain(SOURCE_DICTIONNAIRE_CPE.hote);
    expect(constante(SCRIPT, 'BORNES_CPE')).toEqual({
      parPage: CPE_BORNES.parPage,
      pagesParPassage: CPE_BORNES.pagesParPassage,
      versions: CPE_BORNES.versions,
      intitule: CPE_BORNES.intitule,
    });
    expect(/^CPE_FLUX = VEILLE_FLUX$/m.test(EXECUTANT)).toBe(true);
    expect(entier(EXECUTANT, 'CPE_LOT')).toBe(CPE_BORNES.lot);
    expect(entier(EXECUTANT, 'CPE_LOTS_MAX')).toBe(CPE_BORNES.lotsMax);
    expect(entier(EXECUTANT, 'CPE_VERSIONS_MAX')).toBe(CPE_BORNES.versions);
    // Débit des demandes de versions tenu par l'exécutant seul ; le script n'attend jamais pour le dictionnaire.
    expect(/^CPE_PAUSE = 6\.5$/m.test(EXECUTANT)).toBe(true);
    expect(SCRIPT).not.toMatch(/CPE_PAUSE/);
    expect(CPE_BORNES.pagesParPassage).toBe(1);
    expect(/^MODES_COURTS = \("cpe-versions",\)$/m.test(EXECUTANT)).toBe(true);
  });

  it('le script n’utilise que la bibliothèque standard, ne lit qu’en GET et ne suit aucune redirection', () => {
    const imports = [...SCRIPT.matchAll(/^(?:import|from) ([a-z0-9_.]+)/gm)].map((m) => m[1]!.split('.')[0]);
    expect([...new Set(imports)].sort()).toEqual([
      'base64',
      'datetime',
      'email',
      // Lot CPE-1 : tri des versions (cmp_to_key), bibliothèque standard.
      'functools',
      'hashlib',
      'html',
      'http',
      'ipaddress',
      'json',
      're',
      'socket',
      'ssl',
      'sys',
      'time',
      'unicodedata',
      'xml',
    ]);
    expect(SCRIPT).not.toMatch(/urllib|HTTPRedirectHandler|subprocess|os\.environ|getenv/);
    expect([...SCRIPT.matchAll(/\.request\("([A-Z]+)"/g)].map((m) => m[1])).toEqual(['GET']);
  });

  it('mandataire de l’établissement (ADR 0101) : tunnel CONNECT seulement, aucune option qui coupe la vérification', () => {
    // CONNECT n'est écrit qu'une fois, dans la demande au mandataire ; l'authentification simple aussi.
    expect(SCRIPT.match(/"CONNECT /g)).toHaveLength(1);
    expect(SCRIPT.match(/Proxy-Authorization: Basic/g)).toHaveLength(1);
    expect(SCRIPT).not.toMatch(/CERT_NONE|check_hostname = False|_create_unverified_context|set_tunnel/);
    expect(constante(SCRIPT, 'MANDATAIRE_CHAMPS')).toEqual(constante(EXECUTANT, 'MANDATAIRE_CHAMPS'));
  });

  it('le connecteur interne n’emprunte jamais le mandataire : refusé par son script, jamais transmis par l’exécutant', () => {
    const INTEGRATION = lire('scripts/integration-http.py');
    // Seuls les connecteurs sur Internet (AlgoLightHouse, lot ALH1) l'admettent ; tout autre type le refuse avant tout appel.
    expect(INTEGRATION).toMatch(/^TYPES_MANDATAIRE = \["algolighthouse"\]$/m);
    expect(INTEGRATION).toContain('if mandataire is not None and type_ not in TYPES_MANDATAIRE:');
    // L'exécution d'un connecteur reçoit une demande composée champ par champ ; le mandataire n'y est ajouté que pour un
    // connecteur sur Internet.
    const corps = /def integration\(self, voulus\):([\s\S]*?)\n {4}def /.exec(EXECUTANT)![1]!;
    expect(corps).toContain(
      'demande = {"type": type_, "operation": operation, "configuration": job["configuration"], "secrets": job["secrets"]}',
    );
    expect(corps).toContain('if type_ in INTEGRATIONS_MANDATAIRE and "mandataire" in job:');
    expect(EXECUTANT).toMatch(/^INTEGRATIONS_MANDATAIRE = \("algolighthouse",\)$/m);
  });
});
