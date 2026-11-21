/* Garde-fou de la veille réglementaire (ADR 0110) : le script isolé ne lit pas le registre TypeScript ; la liste fermée des
   hôtes et des chemins, les sources dont le résumé est gardé et les bornes y sont recopiées, et ce test garantit qu'elles
   restent identiques au registre partagé et à la migration 098. Le flux du registre déclare exactement ces hôtes. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  fluxExterne,
  SOURCES_REGLEMENTAIRES,
  SOURCES_REGLEMENTAIRES_COLLECTEES,
  SOURCES_REGLEMENTAIRES_DEFINITIONS,
  SOURCES_REGLEMENTAIRES_JOINTES,
  FREQUENCES_VEILLE_REGLEMENTAIRE,
  VEILLE_REGLEMENTAIRE_BORNES,
} from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

const lire = (f: string) => readFileSync(path.join(REPO, f), 'utf8');
const SCRIPT = lire('scripts/veille-vulnerabilites.py');
const MIGRATION = lire('apps/api/migrations/098_veille_reglementaire.sql');
const constante = (nom: string): unknown => {
  const m = new RegExp(`^${nom} = ([{[].*[}\\]])$`, 'm').exec(SCRIPT);
  expect(m, nom).not.toBeNull();
  return JSON.parse(m![1]!);
};

describe('architecture : veille réglementaire', () => {
  it('la liste fermée des hôtes et des chemins du script est celle du registre partagé', () => {
    expect(constante('SOURCES_REGLEMENTAIRES')).toEqual(
      Object.fromEntries(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => [s.id, { hote: s.hote, chemins: [s.chemin] }])),
    );
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.id)).toEqual([...SOURCES_REGLEMENTAIRES_COLLECTEES]);
    for (const s of SOURCES_REGLEMENTAIRES_JOINTES) expect(s.hote).toMatch(/^[a-z0-9.-]+\.(fr|eu)$/);
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.hote)).toEqual([
      'www.cnil.fr',
      'www.edpb.europa.eu',
      'eur-lex.europa.eu',
      'cyber.gouv.fr',
    ]);
  });

  it('ANSSI : jamais de résumé, ni dans le registre, ni dans le script, ni dans la base ; ANS sans collecteur', () => {
    const avecResume = SOURCES_REGLEMENTAIRES_DEFINITIONS.filter((s) => s.resume).map((s) => s.id);
    expect(avecResume).toEqual(['cnil', 'cepd', 'eur-lex']);
    expect(constante('RESUME_REGLEMENTAIRE')).toEqual(avecResume);
    expect(MIGRATION).toContain("resume IS NULL OR (source IN ('cnil', 'cepd', 'eur-lex')");
    // La description n'est lue que pour les sources de RESUME_REGLEMENTAIRE.
    expect(SCRIPT).toContain('if source in RESUME_REGLEMENTAIRE else None');
    // ANS (constat du 20/11/2026 : l'adresse ne rend pas de flux) : ni hôte, ni chemin, ni flux à ouvrir.
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.id)).not.toContain('ans');
    expect(fluxExterne('veille-reglementaire').pareFeu.join(' ')).not.toContain('esante.gouv.fr');
    expect(MIGRATION).not.toContain('esante');
  });

  it('bornes identiques dans le script ; liste des sources et des fréquences figée par la migration', () => {
    expect(constante('BORNES_REGLEMENTAIRES')).toEqual({ ...VEILLE_REGLEMENTAIRE_BORNES });
    expect(MIGRATION).toContain(`source IN (${SOURCES_REGLEMENTAIRES.map((s) => `'${s}'`).join(', ')})`);
    expect(MIGRATION).toContain(`source IN (${SOURCES_REGLEMENTAIRES_COLLECTEES.map((s) => `'${s}'`).join(', ')})`);
    expect(MIGRATION).toContain(`frequence_heures IN (${FREQUENCES_VEILLE_REGLEMENTAIRE.join(', ')})`);
    // Filtre d'EUR-Lex : nombre de mots-clés borné de la même façon en base, et domaines du script.
    expect(MIGRATION).toContain(`jsonb_array_length(mots_cles) BETWEEN 1 AND ${VEILLE_REGLEMENTAIRE_BORNES.motsCles}`);
    expect(SCRIPT).toMatch(/^DOMAINES_REGLEMENTAIRES = \("securite", "donnees-personnelles"\)$/m);
    for (const s of SOURCES_REGLEMENTAIRES_JOINTES)
      expect(MIGRATION).toContain(`(source = '${s.id}' AND lien ~ '^https://${s.hote.replace(/\./g, '\\.')}/')`);
  });

  it('le flux « veille-reglementaire » déclare exactement ces hôtes, en TCP 443, porté par l’exécutant', () => {
    const f = fluxExterne('veille-reglementaire');
    expect(f.destinations.map((d) => d.hote.split(' ')[0])).toEqual(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.hote));
    for (const d of f.destinations) expect(d).toMatchObject({ sens: 'sortant', ports: 'TCP 443 (HTTPS)' });
    expect(f.porteur.services).toEqual(['updater']);
    expect(f.moduleActivation).toBe('veille_reglementaire');
    expect(f.activation.par).toBe('flux');
    for (const s of SOURCES_REGLEMENTAIRES_JOINTES) expect(f.pareFeu.join(' ')).toContain(s.hote);
  });

  it('l’exécutant connaît la même file, le même flux et les mêmes sources', () => {
    const EXECUTANT = lire('scripts/exploitation-worker.py');
    const m = /^VEILLE_REGLEMENTAIRE_SOURCES = \(([^)]*)\)$/m.exec(EXECUTANT);
    expect(m).not.toBeNull();
    expect([...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1])).toEqual([...SOURCES_REGLEMENTAIRES_COLLECTEES]);
    expect(/^VEILLE_REGLEMENTAIRE_FLUX = "([a-z-]+)"$/m.exec(EXECUTANT)?.[1]).toBe('veille-reglementaire');
    expect(EXECUTANT).toMatch(
      /^VEILLE_FILES = \(\("veille", VEILLE_FLUX, VEILLE_SOURCES\), \("veille-reglementaire", /m,
    );
  });

  it('le script reste sans dépendance nouvelle, en GET seulement, sans redirection ni vérification coupée', () => {
    // Les gardes du test de la veille des vulnérabilités valent pour tout le script ; rappel des plus importantes.
    expect(SCRIPT).not.toMatch(/urllib|HTTPRedirectHandler|subprocess|os\.environ|getenv/);
    expect(SCRIPT).not.toMatch(/CERT_NONE|check_hostname = False|_create_unverified_context/);
    expect(SCRIPT).not.toMatch(/XMLParser\(|resolve_entities|lxml|minidom/);
  });
});
