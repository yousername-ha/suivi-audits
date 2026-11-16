/* Registre des flux vers l'extérieur (ADR 0097) : identifiants stables, description complète de chaque module, schémas du
   changement (confirmation obligatoire) et du rapport de l'exécutant (modules inconnus et erreurs mal formées refusés). */
import { describe, expect, it } from 'vitest';
import {
  FLUX_ERREUR_MAX,
  FLUX_EXTERNES,
  FLUX_MODULES,
  FluxAppliques,
  FluxChangement,
  FluxConfirme,
  FluxSouhaites,
  fluxExterne,
  sensDuFlux,
} from '../src/index.js';

describe('registre des flux vers l’extérieur', () => {
  it('décrit les cinq modules de l’ADR, puis le connecteur Tenable, dans l’ordre des identifiants stables', () => {
    expect(FLUX_MODULES).toEqual(['assistant', 'courriel', 'acme', 'antivirus', 'mises-a-jour', 'tenable']);
    expect(FLUX_EXTERNES.map((f) => f.id)).toEqual([...FLUX_MODULES]);
  });
  it('chaque module a destinations, ports, porteur, données, réglage et pare-feu', () => {
    for (const f of FLUX_EXTERNES) {
      expect(f.libelle, f.id).not.toBe('');
      expect(f.destinations.length, f.id).toBeGreaterThan(0);
      for (const d of f.destinations) {
        expect(['sortant', 'entrant']).toContain(d.sens);
        expect(d.hote, f.id).not.toBe('');
        expect(d.ports, f.id).toMatch(/TCP/);
      }
      expect(f.porteur.services.length, f.id).toBeGreaterThan(0);
      if (f.porteur.type === 'conteneur') expect(f.porteur.profil, f.id).toBeTruthy();
      expect(f.donnees, f.id).not.toBe('');
      // Page de réglage : Configuration système, Plateforme, ou rubrique Intégrations pour les connecteurs (ADR 0076).
      expect(f.reglage.lien, f.id).toMatch(/^\/(systeme\/|plateforme\/|integrations$)/);
      expect(f.pareFeu.length, f.id).toBeGreaterThan(0);
      expect(f.siFerme, f.id).not.toBe('');
    }
  });
  it('reprend les porteurs décidés : relais de l’assistant, exécutant, passerelle, conteneurs de l’antivirus', () => {
    expect(fluxExterne('assistant').porteur).toMatchObject({ type: 'conteneur', profil: 'assistant' });
    expect(fluxExterne('assistant').porteur.services).toEqual(['assistant-relais']);
    expect(fluxExterne('antivirus').porteur).toMatchObject({ type: 'conteneur', profil: 'antivirus' });
    expect(fluxExterne('antivirus').porteur.services).toContain('freshclam');
    expect(fluxExterne('courriel').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
    expect(fluxExterne('mises-a-jour').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
    expect(fluxExterne('acme').porteur).toMatchObject({ type: 'passerelle', services: ['gateway'] });
    expect(fluxExterne('tenable').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
  });
  it('le certificat ACME sort vers l’autorité et reçoit sur 80 et 443 ; les autres modules ne font que sortir', () => {
    expect(sensDuFlux(fluxExterne('acme'))).toEqual(['sortant', 'entrant']);
    expect(fluxExterne('acme').destinations.find((d) => d.sens === 'entrant')!.ports).toContain('80 et 443');
    for (const m of FLUX_MODULES.filter((x) => x !== 'acme')) expect(sensDuFlux(fluxExterne(m))).toEqual(['sortant']);
    expect(fluxExterne('assistant').destinations[0]!.ports).toContain('443');
    // Tenable Security Center : adresse réglée, TCP 443 ; ce qui sort : les clés d'API et des requêtes de lecture.
    expect(fluxExterne('tenable').destinations).toEqual([
      expect.objectContaining({
        sens: 'sortant',
        ports: 'TCP 443 (HTTPS)',
        hote: expect.stringMatching(/Adresse réglée/),
      }),
    ]);
    expect(fluxExterne('tenable').donnees).toMatch(/clés d’API.*requêtes de lecture/);
    expect(fluxExterne('mises-a-jour').destinations.map((d) => d.hote)).toEqual(
      expect.arrayContaining(['github.com et api.github.com (publications)', 'ghcr.io (registre des images)']),
    );
  });
});

describe('geste d’activation (précision du RSSI du 15/11/2026)', () => {
  it('chaque module s’ouvre par son activation ; seuls l’antivirus et les mises à jour ont le flux pour seule activation', () => {
    for (const f of FLUX_EXTERNES) expect(f.activation.geste, f.id).not.toBe('');
    expect(FLUX_EXTERNES.filter((f) => f.activation.par === 'flux').map((f) => f.id)).toEqual([
      'antivirus',
      'mises-a-jour',
    ]);
    expect(fluxExterne('antivirus').reglage.lien).toBe('/systeme/securite');
    // Activation globale (ADR 0019) : l'assistant et le module Intégrations (connecteur Tenable) sont des modules dont la
    // désactivation referme le flux.
    expect(FLUX_EXTERNES.filter((f) => f.moduleActivation).map((f) => [f.id, f.moduleActivation])).toEqual([
      ['assistant', 'assistant'],
      ['tenable', 'integrations'],
    ]);
    expect(fluxExterne('tenable').activation.par).toBe('module');
  });
  it('la validation jointe à l’activation est un « vrai » explicite', () => {
    expect(FluxConfirme.safeParse(true).success).toBe(true);
    for (const v of [false, 'true', 1, undefined]) expect(FluxConfirme.safeParse(v).success).toBe(false);
  });
});

describe('changement d’un flux', () => {
  it('exige la confirmation explicite, dans les deux sens', () => {
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: true }).success).toBe(true);
    expect(FluxChangement.safeParse({ ouvert: false, confirmation: true }).success).toBe(true);
    expect(FluxChangement.safeParse({ ouvert: true }).success).toBe(false);
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: false }).success).toBe(false);
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: 'oui' }).success).toBe(false);
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: true, module: 'courriel' }).success).toBe(false);
  });
});

describe('protocole de l’exécutant', () => {
  it('les flux souhaités ne nomment que des modules du registre', () => {
    expect(FluxSouhaites.safeParse({ ouverts: ['assistant', 'acme'] }).success).toBe(true);
    expect(FluxSouhaites.safeParse({ ouverts: ['inconnu'] }).success).toBe(false);
  });
  it('le rapport appliqué est validé strictement', () => {
    expect(
      FluxAppliques.safeParse({ assistant: { etat: 'ouvert' }, antivirus: { etat: 'erreur', erreur: 'profil absent' } })
        .success,
    ).toBe(true);
    expect(FluxAppliques.safeParse({}).success).toBe(true);
    // Module inconnu, champ inattendu, état inconnu.
    expect(FluxAppliques.safeParse({ inconnu: { etat: 'ouvert' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'ouvert', detail: 'x' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'demarre' } }).success).toBe(false);
    // Une erreur accompagne l'état « erreur », et lui seul ; courte, sur une ligne.
    expect(FluxAppliques.safeParse({ assistant: { etat: 'erreur' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'ouvert', erreur: 'x' } }).success).toBe(false);
    expect(
      FluxAppliques.safeParse({ assistant: { etat: 'erreur', erreur: 'a'.repeat(FLUX_ERREUR_MAX + 1) } }).success,
    ).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'erreur', erreur: 'ligne 1\nligne 2' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'ferme', erreur: null } }).success).toBe(true);
  });
});
