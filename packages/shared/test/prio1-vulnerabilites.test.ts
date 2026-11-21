/* Module Vulnérabilités (ADR 0100, lot PRIO-1 ; décisions du RSSI des 19 et 20/11/2026) : fin de support (un cran de plus,
   P1 reste P1, fait visible), rançongiciels (fait visible, niveau inchangé), kit d'exploitation selon Tenable (rangé avec
   « exploitable », jamais exploitation avérée), alerte critique gardée sous exception (marque sans notification), mot
   « zero-day » réservé, quatre réglages des fréquences. Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  calculerPriorite,
  deciderAlerte,
  ElementConstatTenable,
  empreinteAlerte,
  estZeroDay,
  type FaitsAlerte,
  type FaitsFaille,
  faitsDepuisSources,
  FREQUENCES_VEILLE,
  JOURNAUX_CONSERVATION_JOURS,
  kitsDepuisTexte,
  KitsExploitation,
  kitsRanges,
  libelleFaitPriorite,
  libelleKits,
  libelleMarqueExploitation,
  majorerPriorite,
  prioriteRancongiciel,
  monterDUnCran,
  niveauAlerte,
  PERIODES_AVANT_RETARD,
  PLANCHER_NVD_HEURES,
  type Priorite,
  REGLE_ZERO_DAY,
  SOURCE_EXPLOITABLE_LIBELLES,
  SOURCES_EXPLOITABLE,
  sourceEnRetard,
  type SourcesFailleDto,
} from '../src/index.js';

const faits = (f: Partial<FaitsFaille> = {}): FaitsFaille => ({
  exploitation: [],
  presence: 'detectee',
  gravite: 'moyenne',
  epss: null,
  exploitable: [],
  ...f,
});
const FDS = { fait: 'fin_de_support' } as const;

describe('lot PRIO-1 : fin de support, un cran de plus', () => {
  it('P3 → P2, P2 → P1, P4 → P3, avec le fait « fin de support » à la fin', () => {
    expect(calculerPriorite(faits({ gravite: 'elevee', finDeSupport: true }))).toEqual({
      niveau: 'P2',
      faits: [{ fait: 'presence', presence: 'detectee' }, { fait: 'gravite', gravite: 'elevee' }, FDS],
    });
    expect(calculerPriorite(faits({ gravite: 'critique', finDeSupport: true }))).toEqual({
      niveau: 'P1',
      faits: [{ fait: 'presence', presence: 'detectee' }, { fait: 'gravite', gravite: 'critique' }, FDS],
    });
    expect(calculerPriorite(faits({ gravite: 'faible', presence: 'declaree', finDeSupport: true })).niveau).toBe('P3');
  });

  it('P1 reste P1, et le fait reste visible', () => {
    expect(calculerPriorite(faits({ exploitation: ['kev'], finDeSupport: true }))).toEqual({
      niveau: 'P1',
      faits: [{ fait: 'exploitation', sources: ['kev'] }, { fait: 'presence', presence: 'detectee' }, FDS],
    });
  });

  it('sans fin de support, la priorité est exactement celle de la grille', () => {
    for (const gravite of ['critique', 'elevee', 'moyenne', 'faible'] as const)
      for (const exploitation of [[], ['kev']] as const)
        expect(calculerPriorite(faits({ gravite, exploitation: [...exploitation], finDeSupport: false }))).toEqual(
          calculerPriorite(faits({ gravite, exploitation: [...exploitation] })),
        );
  });

  it('jamais pour une faille absente ou un produit à confirmer (aucune machine où elle est présente)', () => {
    expect(calculerPriorite(faits({ presence: 'absente', gravite: 'critique', finDeSupport: true })).niveau).toBe('P4');
    const aConfirmer = calculerPriorite(faits({ presence: 'a_confirmer', exploitation: ['kev'], finDeSupport: true }));
    expect(aConfirmer.niveau).toBe('P2');
    expect(aConfirmer.faits).not.toContainEqual(FDS);
  });

  it('libellé du fait et cran partagé avec la majoration du lot ALH5', () => {
    expect(libelleFaitPriorite(FDS)).toBe(
      'Machine en fin de support (système ou produit plus maintenu par l’éditeur) : un cran de plus',
    );
    expect(['P1', 'P2', 'P3', 'P4'].map((n) => monterDUnCran(n as 'P1'))).toEqual(['P1', 'P1', 'P2', 'P3']);
    const p3: Priorite = { niveau: 'P3', faits: [] };
    expect(majorerPriorite(p3, true).niveau).toBe('P2');
  });

  it('point c : fin de support et machine interne vulnérable ne se cumulent pas (un cran au plus), deux faits affichés', () => {
    const fds = calculerPriorite(faits({ gravite: 'elevee', presence: 'exposee', finDeSupport: true }));
    expect(fds.niveau).toBe('P2');
    const deux = majorerPriorite(fds, true);
    expect(deux.niveau).toBe('P2');
    expect(deux.faits.map((f) => f.fait)).toEqual([
      'presence',
      'gravite',
      'fin_de_support',
      'machine_interne_vulnerable',
    ]);
    // Sans fin de support, la majoration seule donne bien son cran ; sans liaison, rien ne change.
    const seule = majorerPriorite(calculerPriorite(faits({ gravite: 'elevee', presence: 'exposee' })), true);
    expect(seule.niveau).toBe('P2');
    expect(seule.faits.map((f) => f.fait)).toEqual(['presence', 'gravite', 'machine_interne_vulnerable']);
    expect(majorerPriorite(fds, false)).toBe(fds);
  });
});

describe('lot PRIO-1 : rançongiciels, ordre à priorité égale', () => {
  it('prioriteRancongiciel lit le fait de la priorité', () => {
    expect(prioriteRancongiciel(calculerPriorite(faits({ exploitation: ['kev'], rancongiciel: true })))).toBe(true);
    expect(prioriteRancongiciel(calculerPriorite(faits({ exploitation: ['kev'] })))).toBe(false);
  });
});

describe('lot PRIO-1 : rançongiciels (catalogue KEV), fait visible sans effet sur le niveau', () => {
  it('le fait suit celui de l’exploitation, le niveau ne change pas', () => {
    const sans = calculerPriorite(faits({ exploitation: ['kev'] }));
    const avec = calculerPriorite(faits({ exploitation: ['kev'], rancongiciel: true }));
    expect(avec.niveau).toBe(sans.niveau);
    expect(avec.faits).toEqual([
      { fait: 'exploitation', sources: ['kev'] },
      { fait: 'rancongiciel' },
      { fait: 'presence', presence: 'detectee' },
    ]);
    expect(libelleFaitPriorite({ fait: 'rancongiciel' })).toBe('Utilisée par des rançongiciels (catalogue KEV)');
  });

  it('une faille absente du parc garde P4, avec le fait cité', () => {
    const p = calculerPriorite(faits({ presence: 'absente', exploitation: ['kev'], rancongiciel: true }));
    expect(p.niveau).toBe('P4');
    expect(p.faits).toContainEqual({ fait: 'rancongiciel' });
  });

  it('tiré des sources : absent quand le catalogue ne le dit pas', () => {
    const s: SourcesFailleDto = {
      exploitation: [{ source: 'kev', le: '2026-11-01T00:00:00.000Z' }],
      exploitable: [],
      valeurs: { gravites: [], cvss: [], epss: [] },
      certSante: null,
    };
    expect(faitsDepuisSources(s)).not.toHaveProperty('rancongiciel');
    expect(faitsDepuisSources({ ...s, rancongiciel: true }).rancongiciel).toBe(true);
  });
});

describe('lot PRIO-1 : kit d’exploitation disponible (Tenable), rangé avec « exploitable »', () => {
  it('source « exploitable » de plus, jamais une exploitation avérée', () => {
    expect(SOURCES_EXPLOITABLE).toEqual(['tenable', 'cert-sante', 'alh', 'tenable-kit']);
    expect(SOURCE_EXPLOITABLE_LIBELLES['tenable-kit']).toBe('kit d’exploitation disponible (Tenable)');
    // Élevée et présente avec un kit : P2 (règle « exploitable »), pas P1.
    expect(calculerPriorite(faits({ gravite: 'elevee', exploitable: ['tenable-kit'] }))).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'gravite', gravite: 'elevee' },
        { fait: 'exploit_disponible', sources: ['tenable-kit'] },
      ],
    });
    expect(calculerPriorite(faits({ gravite: 'critique', exploitable: ['tenable-kit'] })).niveau).toBe('P2');
  });

  it('compte pour la règle des alertes P2 exposées sur Internet ; sans exposition, aucune alerte', () => {
    expect(niveauAlerte({ priorite: 'P2', exploitable: true, exposee: true })).toBe('simple');
    expect(niveauAlerte({ priorite: 'P2', exploitable: true, exposee: false })).toBeNull();
    expect(niveauAlerte({ priorite: 'P3', exploitable: true, exposee: true })).toBeNull();
  });

  it('Security Center : la chaîne `exploitFrameworks` (pas une liste), trois noms seulement', () => {
    expect(kitsDepuisTexte('CANVAS (EXEMPLE), Metasploit (exploit/exemple/fictif)')).toEqual(['metasploit', 'canvas']);
    expect(kitsDepuisTexte('Core Impact')).toEqual(['core_impact']);
    expect(kitsDepuisTexte('core')).toEqual([]);
    expect(kitsDepuisTexte('Exploit-DB')).toEqual([]);
    expect(kitsDepuisTexte('')).toEqual([]);
    expect(kitsDepuisTexte(null)).toEqual([]);
    expect(libelleKits(['metasploit', 'core_impact', 'canvas'])).toBe('Metasploit, Core Impact, CANVAS');
    expect(kitsRanges(['canvas', 'inconnu', 'metasploit'])).toEqual(['metasploit', 'canvas']);
  });

  it('schéma : liste fermée, sans doublon ; facultative dans un constat reçu', () => {
    expect(KitsExploitation.safeParse(['metasploit', 'canvas']).success).toBe(true);
    expect(KitsExploitation.safeParse(['autre']).success).toBe(false);
    expect(KitsExploitation.safeParse(['canvas', 'canvas']).success).toBe(false);
    const constat = {
      type: 'constat',
      plugin: '990001',
      nom: 'Contrôle fictif',
      gravite: 'elevee',
      famille: null,
      synopsis: null,
      correctif: null,
      cvss3Vecteur: null,
      cvss3Score: null,
      vpr: null,
      epss: null,
      exploitable: true,
      exploitLibelle: null,
      failleLe: null,
      correctifLe: null,
      finSupportLe: null,
      voirAussi: null,
      cves: [],
      cvesTronquees: false,
    };
    expect(ElementConstatTenable.safeParse(constat).success).toBe(true);
    expect(ElementConstatTenable.safeParse({ ...constat, kitsExploitation: ['metasploit'] }).success).toBe(true);
    expect(ElementConstatTenable.safeParse({ ...constat, kitsExploitation: ['inconnu'] }).success).toBe(false);
  });
});

describe('lot PRIO-1 : alerte critique gardée sous exception (« risque accepté »)', () => {
  const base: FaitsAlerte = {
    priorite: { niveau: 'P1', faits: [] },
    presences: ['detectee'],
    exploitation: [{ source: 'kev', le: '2026-11-01T00:00:00.000Z' }],
    nombres: { machines: 1, produits: 0, actifs: 0 },
    titre: 'Faille fictive',
    produit: null,
  };
  it('la marque change l’empreinte (mise à jour), sans nouvelle notification', () => {
    const avant = empreinteAlerte(base);
    const apres = empreinteAlerte({ ...base, risqueAccepte: true });
    expect(apres).not.toBe(avant);
    expect(
      deciderAlerte(
        { niveau: 'critique', etat: 'prise_en_compte', empreinte: avant },
        { niveau: 'critique', empreinte: apres, situation: { priorite: 'P1', traitee: false } },
      ),
    ).toEqual({ action: 'mettre_a_jour', niveau: 'critique', notifier: null, reprise: false });
  });
  it('sans marque, l’empreinte d’avant le lot est gardée', () => {
    expect(empreinteAlerte({ ...base, risqueAccepte: false })).toBe(empreinteAlerte(base));
  });
});

describe('lot PRIO-1 : « zero-day » réservé à une faille exploitée sans correctif connu', () => {
  it('libellés', () => {
    expect(libelleMarqueExploitation('sans_correctif')).toBe('Zero-day : exploitée, sans correctif connu');
    expect(libelleMarqueExploitation('corrigible')).toBe('Exploitation avérée');
    expect(libelleMarqueExploitation('correctif_non_renseigne')).toBe('Exploitation avérée');
    expect(estZeroDay(null)).toBe(false);
    expect(REGLE_ZERO_DAY).toContain('ni « récente », ni « critique »');
  });
});

describe('lot PRIO-1 : réglages des fréquences', () => {
  const maintenant = new Date('2026-11-20T12:00:00.000Z');
  const il = (h: number) => new Date(maintenant.getTime() - h * 3_600_000);
  it('plancher de NVD et durée de conservation des journaux', () => {
    expect(PLANCHER_NVD_HEURES).toBe(2);
    expect(Math.min(...FREQUENCES_VEILLE.nvd)).toBe(PLANCHER_NVD_HEURES);
    expect(JOURNAUX_CONSERVATION_JOURS).toBe(90);
  });
  it('« En retard » après trois périodes sans collecte réussie', () => {
    expect(PERIODES_AVANT_RETARD).toBe(3);
    expect(sourceEnRetard(null, 2, maintenant)).toBe(true);
    expect(sourceEnRetard(il(6), 2, maintenant)).toBe(false);
    expect(sourceEnRetard(il(6.1), 2, maintenant)).toBe(true);
    // EPSS (une fois par jour) : trois jours ; l'ancien seuil de 36 h ne vaut plus.
    expect(sourceEnRetard(il(48), 24, maintenant)).toBe(false);
    expect(sourceEnRetard(il(73), 24, maintenant)).toBe(true);
    expect(sourceEnRetard(il(25).toISOString(), 12, maintenant)).toBe(false);
  });
});
