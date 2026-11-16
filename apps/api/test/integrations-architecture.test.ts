/* Garde-fou du module Intégrations (ADR 0076, point 5) : l'exécutant et son script isolé ne lisent pas le catalogue
   TypeScript ; leurs listes fermées (points d'accès de lecture, opérations, flux de chaque type, formes contrôlées) sont
   recopiées et ce test garantit qu'elles restent identiques au catalogue partagé. Aucune valeur reçue de l'application n'y
   est ajoutée à l'exécution. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TYPES_INTEGRATION, VERSION_TENABLE } from '@suivi/shared';
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
      Object.fromEntries(TYPES_INTEGRATION.map((t) => [t.id, t.pointsAcces.map((p) => [p.methode, p.chemin])])),
    );
    // Lecture seule : aucune méthode d'écriture métier n'y figure (POST n'est admis que pour l'analyse de Tenable).
    for (const t of TYPES_INTEGRATION)
      for (const p of t.pointsAcces) {
        expect(['GET', 'POST']).toContain(p.methode);
        if (p.methode === 'POST') expect(p.chemin).toBe('/rest/analysis');
      }
  });

  it('opérations et flux de chaque type : script et exécutant identiques au catalogue', () => {
    const operations = Object.fromEntries(TYPES_INTEGRATION.map((t) => [t.id, [...t.operations]]));
    expect(constante(SCRIPT, 'OPERATIONS')).toEqual(operations);
    expect(constante(EXECUTANT, 'INTEGRATIONS_OPERATIONS')).toEqual(operations);
    expect(constante(EXECUTANT, 'INTEGRATIONS_FLUX')).toEqual(
      Object.fromEntries(TYPES_INTEGRATION.map((t) => [t.id, t.flux])),
    );
  });

  it('formes contrôlées identiques : version de Tenable, clés d’API', () => {
    expect(motif(SCRIPT, 'VERSION_TENABLE')).toBe(VERSION_TENABLE.source);
    expect(motif(EXECUTANT, 'INTEGRATION_VERSION')).toBe(VERSION_TENABLE.source);
    const tenable = TYPES_INTEGRATION.find((t) => t.id === 'tenable')!;
    for (const s of tenable.secrets) expect(motif(SCRIPT, 'CLE_API')).toBe(s.motif.source);
  });

  it('le script n’utilise que la bibliothèque standard et ne suit aucune redirection', () => {
    const imports = [...SCRIPT.matchAll(/^(?:import|from) ([a-z_.]+)/gm)].map((m) => m[1]!.split('.')[0]);
    expect(imports.sort()).toEqual(['http', 'json', 're', 'socket', 'ssl', 'sys']);
    expect(SCRIPT).not.toMatch(/urllib|HTTPRedirectHandler|subprocess|os\.environ/);
  });
});
