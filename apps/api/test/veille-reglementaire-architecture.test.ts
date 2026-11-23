/* Garde-fou de la veille réglementaire (ADR 0110) : le script isolé ne lit pas le registre TypeScript ; la liste fermée des
   hôtes et des chemins, les sources dont le résumé est gardé, les sources filtrées par mots-clés, l'hôte des liens du
   Journal officiel et les bornes y sont recopiés, et ce test garantit qu'ils restent identiques au registre partagé et aux
   migrations 098 et 104 (lot VR-2, qui recrée les listes fermées). Le flux du registre déclare exactement ces hôtes. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  fluxExterne,
  SOURCES_FILTREES_MOTS_CLES,
  SOURCES_REGLEMENTAIRES,
  SOURCES_REGLEMENTAIRES_COLLECTEES,
  SOURCES_REGLEMENTAIRES_DEFINITIONS,
  SOURCES_REGLEMENTAIRES_JOINTES,
  FREQUENCES_VEILLE_REGLEMENTAIRE,
  sourceReglementaire,
  VEILLE_REGLEMENTAIRE_BORNES,
} from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

const lire = (f: string) => readFileSync(path.join(REPO, f), 'utf8');
const SCRIPT = lire('scripts/veille-vulnerabilites.py');
const MIGRATION = lire('apps/api/migrations/098_veille_reglementaire.sql');
// Lot VR-2 : listes fermées recréées (sources, liens, mots-clés) ; la migration 098 reste inchangée.
const MIGRATION_VR2 = lire('apps/api/migrations/104_veille_reglementaire_cert_sante_jo.sql');
const constante = (nom: string): unknown => {
  const m = new RegExp(`^${nom} = ([{[].*[}\\]])$`, 'm').exec(SCRIPT);
  expect(m, nom).not.toBeNull();
  return JSON.parse(m![1]!);
};

describe('architecture : veille réglementaire', () => {
  it('la liste fermée des hôtes et des chemins du script est celle du registre partagé', () => {
    expect(constante('SOURCES_REGLEMENTAIRES')).toEqual(
      Object.fromEntries(
        SOURCES_REGLEMENTAIRES_JOINTES.map((s) => [
          s.id,
          { hote: s.hote, chemins: [s.chemin, ...(s.cheminsSuivants ?? [])] },
        ]),
      ),
    );
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.id)).toEqual([...SOURCES_REGLEMENTAIRES_COLLECTEES]);
    for (const s of SOURCES_REGLEMENTAIRES_JOINTES) expect(s.hote).toMatch(/^[a-z0-9.-]+\.(fr|eu)$/);
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.hote)).toEqual([
      'www.cnil.fr',
      'www.edpb.europa.eu',
      'eur-lex.europa.eu',
      'cyber.gouv.fr',
      'cyberveille.esante.gouv.fr',
      'echanges.dila.gouv.fr',
    ]);
    // Seul le Journal officiel lit d'autres chemins (ses archives) ; l'hôte de ses liens est recopié dans le script.
    expect(SOURCES_REGLEMENTAIRES_JOINTES.filter((s) => s.cheminsSuivants).map((s) => s.id)).toEqual(['legifrance']);
    expect(constante('HOTES_LIENS_REGLEMENTAIRES')).toEqual(
      Object.fromEntries(SOURCES_REGLEMENTAIRES_JOINTES.filter((s) => s.hoteLiens).map((s) => [s.id, s.hoteLiens])),
    );
    expect(constante('FILTREES_REGLEMENTAIRES')).toEqual([...SOURCES_FILTREES_MOTS_CLES]);
    // API Légifrance (PISTE) : non réalisée dans le lot VR-2 ; aucun de ses hôtes n'est joint.
    expect(SCRIPT).not.toContain('piste.gouv.fr');
    expect(fluxExterne('veille-reglementaire').pareFeu.join(' ')).not.toContain('piste.gouv.fr');
  });

  it('ANSSI et CERT Santé : jamais de résumé, ni dans le registre, ni dans le script, ni dans la base ; ANS sans collecteur', () => {
    const avecResume = SOURCES_REGLEMENTAIRES_DEFINITIONS.filter((s) => s.resume).map((s) => s.id);
    expect(avecResume).toEqual(['cnil', 'cepd', 'eur-lex']);
    expect(constante('RESUME_REGLEMENTAIRE')).toEqual(avecResume);
    expect(MIGRATION).toContain("resume IS NULL OR (source IN ('cnil', 'cepd', 'eur-lex')");
    // La description n'est lue que pour les sources de RESUME_REGLEMENTAIRE.
    expect(SCRIPT).toContain('if source in RESUME_REGLEMENTAIRE else None');
    // ANS (constat du 20/11/2026 : l'adresse ne rend pas de flux) : ni hôte, ni chemin, ni flux à ouvrir.
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.id)).not.toContain('ans');
    // Le site de l'ANS n'est pas une destination (le CERT Santé, sur un autre hôte, l'est depuis le lot VR-2).
    const hotes = fluxExterne('veille-reglementaire').destinations.map((d) => d.hote.split(' ')[0]);
    for (const interdit of ['esante.gouv.fr', 'www.esante.gouv.fr']) {
      expect(hotes).not.toContain(interdit);
      expect(fluxExterne('veille-reglementaire').pareFeu.join(' ')).not.toMatch(
        new RegExp(`(^|[ ,])${interdit.replace(/\./g, '\\.')}([ ,.]|$)`),
      );
    }
    expect(MIGRATION).not.toContain('esante');
    expect(MIGRATION_VR2).not.toMatch(/source = 'ans' AND lien/);
    expect(MIGRATION_VR2).toContain("CHECK (NOT activee OR source <> 'ans')");
    // La migration 104 ne recrée pas la règle du résumé : celle de la migration 098 reste en vigueur.
    expect(MIGRATION_VR2).not.toMatch(/publications_check\b|resume/);
  });

  it('bornes identiques dans le script ; liste des sources et des fréquences figée par la migration', () => {
    expect(constante('BORNES_REGLEMENTAIRES')).toEqual({ ...VEILLE_REGLEMENTAIRE_BORNES });
    expect(MIGRATION_VR2).toContain(`source IN (${SOURCES_REGLEMENTAIRES.map((s) => `'${s}'`).join(', ')})`);
    expect(MIGRATION_VR2).toContain(`source IN (${SOURCES_REGLEMENTAIRES_COLLECTEES.map((s) => `'${s}'`).join(', ')})`);
    expect(MIGRATION).toContain(`frequence_heures IN (${FREQUENCES_VEILLE_REGLEMENTAIRE.join(', ')})`);
    // Filtres par mots-clés : nombre de mots-clés borné de la même façon en base, sources filtrées, domaines du script.
    expect(MIGRATION_VR2).toContain(
      `jsonb_array_length(mots_cles) BETWEEN 1 AND ${VEILLE_REGLEMENTAIRE_BORNES.motsCles}`,
    );
    expect(MIGRATION_VR2).toContain(
      `source IN (${SOURCES_FILTREES_MOTS_CLES.map((s) => `'${s}'`).join(', ')}) AND jsonb_typeof(mots_cles)`,
    );
    expect(SCRIPT).toMatch(/^DOMAINES_REGLEMENTAIRES = \("securite", "donnees-personnelles"\)$/m);
    const echappe = (h: string) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const s of SOURCES_REGLEMENTAIRES_JOINTES)
      if (s.formeLien)
        // Lien de forme exacte (Journal officiel) : la base exige l'hôte des liens et l'identifiant du texte.
        expect(MIGRATION_VR2).toContain(
          `(source = '${s.id}' AND lien ~ '^https://${echappe(s.hoteLiens!)}/jorf/id/JORFTEXT[0-9]{12}$')`,
        );
      else expect(MIGRATION_VR2).toContain(`(source = '${s.id}' AND lien ~ '^https://${echappe(s.hote)}/')`);
    expect(sourceReglementaire('legifrance').formeLien!.source).toBe(
      '^https:\\/\\/www\\.legifrance\\.gouv\\.fr\\/jorf\\/id\\/JORFTEXT\\d{12}$',
    );
    expect(SCRIPT).toContain('JORF_LIEN = "https://www.legifrance.gouv.fr/jorf/id/"');
    expect(SCRIPT).toContain('ID_JORFTEXT = re.compile(r"^JORFTEXT\\d{12}$")');
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
