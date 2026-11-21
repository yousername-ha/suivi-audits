/* Garde-fou du module Intégrations (ADR 0076, point 5) : l'exécutant et son script isolé ne lisent pas le catalogue
   TypeScript ; leurs listes fermées (points d'accès de lecture, opérations, flux de chaque type, formes contrôlées) sont
   recopiées et ce test garantit qu'elles restent identiques au catalogue partagé. Aucune valeur reçue de l'application n'y
   est ajoutée à l'exécution. Lot N1 : seuls les types qui joignent un outil par le réseau y figurent ; un type sans réseau
   (import de fichier « nessus-fichier ») en est absent, et le test le vérifie. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ADRESSE_ALH,
  ADRESSE_IP,
  ALH_BORNES,
  CHAMPS_FRAGMENT_ALH,
  CHAMPS_SERVICE_ALH,
  CLE_API_ALH,
  CLE_MACHINE,
  CVE_ID,
  DEPOT_TENABLE,
  NOM_DOMAINE_ALH,
  PLUGIN_ID,
  PROTOCOLES_SERVICE_ALH,
  STATUTS_VERSION_ALH,
  TENABLE_BORNES,
  TYPES_FRAGMENT_SERVICE_ALH,
  TYPES_INTEGRATION,
  TYPES_INTEGRATION_RESEAU,
  USAGE_MANDATAIRE,
  VERSION_ALH,
  VERSION_TENABLE,
} from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

const lire = (f: string) => readFileSync(path.join(REPO, f), 'utf8');
const SCRIPT = lire('scripts/integration-http.py');
const EXECUTANT = lire('scripts/exploitation-worker.py');
/** Constante Python écrite en JSON sur une seule ligne (`NOM = {...}`). */
const constante = (texte: string, nom: string): unknown => {
  const m = new RegExp(`^${nom} = (\\{.*\\})$`, 'm').exec(texte);
  expect(m, nom).not.toBeNull();
  return JSON.parse(m![1]!);
};
/** Expression régulière Python `NOM = re.compile(r"...")`. */
const motif = (texte: string, nom: string): string => {
  const m = new RegExp(`^${nom} = re\\.compile\\(r"(.*)"\\)$`, 'm').exec(texte);
  expect(m, nom).not.toBeNull();
  return m![1]!;
};

describe('architecture : connecteurs du module Intégrations', () => {
  it('la liste fermée des points d’accès du script est celle du catalogue partagé', () => {
    expect(constante(SCRIPT, 'POINTS_ACCES')).toEqual(
      Object.fromEntries(TYPES_INTEGRATION_RESEAU.map((t) => [t.id, t.pointsAcces.map((p) => [p.methode, p.chemin])])),
    );
    // Lot N1 : un type sans réseau n'a aucun point d'accès et n'est connu ni du script ni de l'exécutant.
    for (const t of TYPES_INTEGRATION.filter((x) => x.flux === null)) {
      expect(t.pointsAcces).toEqual([]);
      expect(SCRIPT).not.toContain(`"${t.id}"`);
      expect(EXECUTANT).not.toContain(`"${t.id}"`);
    }
    // Lecture seule : aucune méthode d'écriture métier n'y figure (POST n'est admis que pour l'analyse de Tenable).
    for (const t of TYPES_INTEGRATION)
      for (const p of t.pointsAcces) {
        expect(['GET', 'POST']).toContain(p.methode);
        if (p.methode === 'POST') expect(p.chemin).toBe('/rest/analysis');
      }
  });

  it('paramètres de requête admis : liste fermée identique au catalogue, valeurs entières seulement', () => {
    expect(constante(SCRIPT, 'PARAMETRES_ACCES')).toEqual(
      Object.fromEntries(
        TYPES_INTEGRATION_RESEAU.map((t) => [
          t.id,
          Object.fromEntries(
            t.pointsAcces.filter((p) => p.parametres).map((p) => [`${p.methode} ${p.chemin}`, [...p.parametres!]]),
          ),
        ]),
      ),
    );
  });

  it('synchronisation : bornes du script et de l’exécutant identiques à celles du module Vulnérabilités', () => {
    expect(constante(SCRIPT, 'BORNES_SYNCHRO')).toEqual(TENABLE_BORNES);
    expect(
      constante(`INTEGRATION_LOT = {"v": ${/^INTEGRATION_LOT = (\d+)$/m.exec(EXECUTANT)![1]}}`, 'INTEGRATION_LOT'),
    ).toEqual({
      v: TENABLE_BORNES.lot,
    });
    expect(Number(/^INTEGRATION_LOTS_MAX = (\d+)$/m.exec(EXECUTANT)![1])).toBe(TENABLE_BORNES.lots);
    // Le délai de l'exécutant couvre la durée maximale du script et une dernière requête.
    expect(Number(/^SYNCHRO_DELAI = (\d+)$/m.exec(EXECUTANT)![1])).toBeGreaterThanOrEqual(
      TENABLE_BORNES.dureeSecondes + 60,
    );
    // Formes contrôlées recopiées : identiques à celles de l'API.
    expect(motif(SCRIPT, 'PLUGIN_ID')).toBe(PLUGIN_ID.source);
    expect(motif(SCRIPT, 'CVE_ID')).toBe(CVE_ID.source);
    expect(motif(SCRIPT, 'ADRESSE_IP')).toBe(ADRESSE_IP.source);
    // Lot V4d : identifiant d'un dépôt, et du dépôt rien d'autre que son identifiant et son nom.
    expect(motif(SCRIPT, 'DEPOT_TENABLE')).toBe(DEPOT_TENABLE.source);
    expect(/^CHAMPS_DEPOT = \(([^)]*)\)$/m.exec(SCRIPT)![1]).toBe('"id", "name"');
    // Les champs lus de Tenable sont une liste fermée qui ne contient ni le texte détaillé ni l'adresse matérielle.
    const champs = /^CHAMPS_ANALYSE = \(([^)]*)\)$/ms.exec(SCRIPT)![1]!;
    for (const interdit of ['pluginText', 'macAddress', 'description', 'vulnUUID'])
      expect(champs).not.toContain(`"${interdit}"`);
    expect(CLE_MACHINE.test('uuid:00000000-0000-4000-8000-0000000000aa')).toBe(true);
  });

  it('opérations et flux de chaque type : script et exécutant identiques au catalogue', () => {
    const operations = Object.fromEntries(TYPES_INTEGRATION_RESEAU.map((t) => [t.id, [...t.operations]]));
    expect(constante(SCRIPT, 'OPERATIONS')).toEqual(operations);
    expect(constante(EXECUTANT, 'INTEGRATIONS_OPERATIONS')).toEqual(operations);
    expect(constante(EXECUTANT, 'INTEGRATIONS_FLUX')).toEqual(
      Object.fromEntries(TYPES_INTEGRATION_RESEAU.map((t) => [t.id, t.flux])),
    );
  });

  it('formes contrôlées identiques : version de Tenable, clés d’API', () => {
    expect(motif(SCRIPT, 'VERSION_TENABLE')).toBe(VERSION_TENABLE.source);
    expect(motif(EXECUTANT, 'INTEGRATION_VERSION')).toBe(VERSION_TENABLE.source);
    const tenable = TYPES_INTEGRATION.find((t) => t.id === 'tenable')!;
    for (const s of tenable.secrets) expect(motif(SCRIPT, 'CLE_API')).toBe(s.motif.source);
  });

  it('AlgoLightHouse : bornes, adresse de l’éditeur, clé, version et domaines identiques au paquet partagé', () => {
    expect(constante(SCRIPT, 'BORNES_ALH')).toEqual(ALH_BORNES);
    expect(ALH_BORNES.lot).toBe(TENABLE_BORNES.lot);
    expect(ALH_BORNES.lots).toBe(TENABLE_BORNES.lots);
    expect(Number(/^SYNCHRO_DELAI = (\d+)$/m.exec(EXECUTANT)![1])).toBeGreaterThanOrEqual(
      ALH_BORNES.dureeSecondes + 60,
    );
    expect(motif(SCRIPT, 'ADRESSE_ALH')).toBe(ADRESSE_ALH.source);
    expect(motif(SCRIPT, 'CLE_API_ALH')).toBe(CLE_API_ALH.source);
    expect(motif(SCRIPT, 'VERSION_ALH')).toBe(VERSION_ALH.source);
    expect(motif(SCRIPT, 'NOM_DOMAINE_ALH')).toBe(NOM_DOMAINE_ALH.source);
    const alh = TYPES_INTEGRATION.find((t) => t.id === 'algolighthouse')!;
    expect(alh.secrets.map((s) => s.motif.source)).toEqual([CLE_API_ALH.source]);
    expect(ADRESSE_ALH.test('https://espace-fictif.algolighthouse.fr')).toBe(true);
    for (const refusee of [
      'https://algolighthouse.fr',
      'https://espace.algolighthouse.fr:8443',
      'https://espace.algolighthouse.fr.exemple.invalid',
      'https://espace.algolighthouse.fr/api',
      'http://espace.algolighthouse.fr',
    ])
      expect(ADRESSE_ALH.test(refusee), refusee).toBe(false);
  });

  it('AlgoLightHouse en lecture seule : GET seulement, version 1 de l’API, jamais commentaires, statut, contacts ni recherche', () => {
    const alh = TYPES_INTEGRATION.find((t) => t.id === 'algolighthouse')!;
    expect(alh.pointsAcces.map((p) => p.methode)).toEqual(alh.pointsAcces.map(() => 'GET'));
    for (const p of alh.pointsAcces) {
      expect(p.chemin).toMatch(/^\/api\/v1\//);
      expect(p.chemin).not.toMatch(/comments|status|contacts|search|keywords/);
      expect(p.parametres).toBeUndefined();
    }
    // Dans le script, chaque appel du connecteur est une lecture (GET), sans corps.
    const section = SCRIPT.slice(
      SCRIPT.indexOf('# ------------------------------------------------------------------ AlgoLightHouse'),
    );
    const appels = [...section.matchAll(/requete\("([A-Z]+)"/g)].map((m) => m[1]);
    expect(appels.length).toBeGreaterThanOrEqual(4);
    expect(new Set(appels)).toEqual(new Set(['GET']));
    expect(section).not.toMatch(/requete\("GET", [^)]*corps|requete\([^)]*parametres=/);
    // Liste blanche des champs : ni description HTML, ni pièces jointes, ni commentaires, ni données sensibles. Lot ALH2
    // (décision A) : les défauts (`defects`) ne sont lus que dans le détail, et leur description (texte, balises retirées)
    // seulement par les listes des défauts et des résolutions. Lot ALH6 : `json_data` d'un fragment est lu, par la seule
    // liste des fragments, et réduit aux champs de service (jamais la bannière, l'état brut ni le nom d'un sous-domaine).
    const listes = new Map(
      [...SCRIPT.matchAll(/^(CHAMPS_[A-Z_]+_ALH) = \(([^)]*)\)$/gms)].map((m) => [m[1]!, m[2]!] as const),
    );
    const champs = [...listes.values()].join(' ');
    expect(champs).toContain('"title"');
    for (const interdit of [
      'note',
      'data',
      'uploads',
      'comments',
      'sensitive_data',
      'has_sensitive_data',
      'banner',
      'state',
      'subdomain',
      'email',
      'leak_type',
      'repo',
      'bucket',
      'path',
      'url',
      'latest_version',
    ])
      expect(champs, interdit).not.toContain(`"${interdit}"`);
    const avec = (champ: string) => [...listes].filter(([, v]) => v.includes(`"${champ}"`)).map(([k]) => k);
    expect(avec('json_data')).toEqual(['CHAMPS_FRAGMENT_ALH']);
    /** Tuple Python `NOM = ("a", "b")`, sur une ou plusieurs lignes. */
    const tuple = (nom: string) => {
      const m = new RegExp(`^${nom} = \\(([^)]*)\\)$`, 'm').exec(SCRIPT);
      expect(m, nom).not.toBeNull();
      return [...m![1]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    };
    expect(tuple('CHAMPS_FRAGMENT_ALH')).toEqual([...CHAMPS_FRAGMENT_ALH]);
    expect(tuple('CHAMPS_SERVICE_ALH')).toEqual([...CHAMPS_SERVICE_ALH]);
    expect(tuple('TYPES_FRAGMENT_SERVICE_ALH')).toEqual([...TYPES_FRAGMENT_SERVICE_ALH]);
    expect(tuple('PROTOCOLES_ALH')).toEqual([...PROTOCOLES_SERVICE_ALH]);
    expect(tuple('STATUTS_VERSION_ALH')).toEqual([...STATUTS_VERSION_ALH]);
    expect(avec('defects')).toEqual(['CHAMPS_DETAIL_ALH']);
    expect(avec('description').sort()).toEqual(['CHAMPS_DEFAUT_ALH', 'CHAMPS_RESOLUTION_ALH']);
    expect(listes.get('CHAMPS_DEFAUT_ALH')).toBe('"name", "description", "resolutions"');
    expect(listes.get('CHAMPS_RESOLUTION_ALH')).toBe('"name", "description", "ease_of_execution", "security_gain"');
  });

  it('mandataire : seuls les types dont le flux l’utilise le reçoivent ; tunnel CONNECT, aucune option qui coupe la vérification', () => {
    const utilisent = TYPES_INTEGRATION_RESEAU.filter((t) => USAGE_MANDATAIRE[t.flux!] === 'utilise').map((t) => t.id);
    expect(utilisent).toEqual(['algolighthouse']);
    expect(
      constante(`TYPES_MANDATAIRE = {"v": ${/^TYPES_MANDATAIRE = (\[.*\])$/m.exec(SCRIPT)![1]}}`, 'TYPES_MANDATAIRE'),
    ).toEqual({
      v: utilisent,
    });
    expect(
      /^INTEGRATIONS_MANDATAIRE = \(([^)]*)\)$/m.exec(EXECUTANT)![1]!.replace(/[\s"]/g, '').split(',').filter(Boolean),
    ).toEqual(utilisent);
    expect(USAGE_MANDATAIRE.tenable).toBe('direct');
    expect(SCRIPT.match(/"CONNECT /g)).toHaveLength(1);
    expect(SCRIPT.match(/Proxy-Authorization: Basic/g)).toHaveLength(1);
    expect(SCRIPT).not.toMatch(/CERT_NONE|check_hostname = False|_create_unverified_context|set_tunnel/);
    const champs = (texte: string) => /^MANDATAIRE_CHAMPS = (\(.*\))$/m.exec(texte)![1];
    expect(champs(SCRIPT)).toBe(champs(EXECUTANT));
  });

  it('le script n’utilise que la bibliothèque standard et ne suit aucune redirection', () => {
    const imports = [...SCRIPT.matchAll(/^(?:import|from) ([a-z0-9_.]+)/gm)].map((m) => m[1]!.split('.')[0]);
    expect(imports.sort()).toEqual([
      'base64',
      'datetime',
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
    ]);
    expect(SCRIPT).not.toMatch(/urllib|HTTPRedirectHandler|subprocess|os\.environ/);
  });
});
