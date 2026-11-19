/* Lot N1 (ADR 0100) : schémas de l'extrait d'un scan Nessus revalidé par l'API (le navigateur n'est jamais cru) : formes et
   bornes de Tenable Security Center, champ en trop refusé, valeurs hors liste refusées, lot cohérent (machines entières,
   aucun contrôle orphelin), bilan borné. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  BilanImportNessus,
  ConfigurationNessusFichier,
  ConstatImportNessus,
  DebutImportNessus,
  ECARTS_IMPORT,
  FinImportNessus,
  LotImportNessus,
  MachineImportNessus,
  NESSUS_BORNES,
  RESULTATS_OPERATION,
  TENABLE_BORNES,
} from '../src/index.js';

const machine = (x: Record<string, unknown> = {}) => ({
  cle: 'ip:192.0.2.31|srv-fictif-31.example.org',
  uuid: null,
  nom: 'srv-fictif-31.example.org',
  adresse: '192.0.2.31',
  systeme: 'Fictional Linux 9',
  debut: '2026-11-18T08:00:00.000Z',
  fin: '2026-11-18T08:10:00.000Z',
  ...x,
});
const constat = (x: Record<string, unknown> = {}) => ({
  plugin: '919101',
  nom: 'Fictional flaw',
  gravite: 'critique',
  famille: null,
  synopsis: null,
  correctif: null,
  cvss3Vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  cvss3Score: 9.8,
  vpr: null,
  epss: null,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: null,
  voirAussi: null,
  cves: ['CVE-2026-91101'],
  cvesTronquees: false,
  ...x,
});
const ecartes = Object.fromEntries(ECARTS_IMPORT.map((e) => [e, 0]));
const lot = (x: Record<string, unknown> = {}) => ({
  machines: [{ machine: machine(), detections: [{ plugin: '919101', port: 443, protocole: 'TCP' }] }],
  constats: [constat()],
  ...x,
});

describe('extrait d’un scan Nessus', () => {
  it('machine : même identifiant que Tenable, nom en minuscules, adresse, texte nettoyé', () => {
    expect(MachineImportNessus.safeParse(machine()).success).toBe(true);
    expect(
      MachineImportNessus.safeParse(machine({ cle: 'ip:203.0.113.5', nom: null, adresse: '203.0.113.5' })).success,
    ).toBe(true);
    for (const x of [
      { nom: 'SRV-FICTIF-31.example.org' },
      { cle: 'ip:192.0.2.32|srv-fictif-31.example.org' },
      { adresse: '192.0.2.300', cle: 'ip:192.0.2.300|srv-fictif-31.example.org' },
      { systeme: '<script>x' },
      { systeme: 'x'.repeat(TENABLE_BORNES.systeme + 1) },
      { debut: '18/11/2026' },
      { macAddress: '00:00:5e:00:53:01' },
    ])
      expect(MachineImportNessus.safeParse(machine(x)).success, JSON.stringify(x)).toBe(false);
  });

  it('constat : formes de Tenable, champ en trop refusé, gravité informative refusée, pas de fin de support', () => {
    expect(ConstatImportNessus.safeParse(constat()).success).toBe(true);
    for (const x of [
      { gravite: 'info' },
      { gravite: 'Critical' },
      { plugin: '0' },
      { plugin: 'abc' },
      { cves: ['CVE-26-1'] },
      { cves: ['CVE-2026-91101', 'CVE-2026-91101'] },
      { cvss3Score: 11 },
      { cvss3Vecteur: 'CVSS:4.0/AV:N' },
      { voirAussi: 'http://example.org/' },
      { voirAussi: 'https://example.org/"x' },
      { nom: 'x'.repeat(TENABLE_BORNES.nomControle + 1) },
      { pluginOutput: 'sortie brute' },
      { description: 'description longue' },
      { finSupportLe: '2026-01-01T00:00:00.000Z' },
      { epss: 2 },
    ])
      expect(ConstatImportNessus.safeParse(constat(x)).success, JSON.stringify(x)).toBe(false);
  });

  it('lot : machines entières, chaque contrôle décrit une fois et utilisé, bornes', () => {
    expect(LotImportNessus.safeParse(lot()).success).toBe(true);
    const deux = lot({
      machines: [lot().machines[0], lot().machines[0]],
    });
    expect(LotImportNessus.safeParse(deux).success).toBe(false);
    expect(LotImportNessus.safeParse(lot({ constats: [] })).success).toBe(false);
    expect(LotImportNessus.safeParse(lot({ constats: [constat(), constat({ plugin: '919102' })] })).success).toBe(
      false,
    );
    expect(LotImportNessus.safeParse(lot({ constats: [constat(), constat()] })).success).toBe(false);
    expect(LotImportNessus.safeParse(lot({ machines: [] })).success).toBe(false);
    expect(LotImportNessus.safeParse(lot({ fichier: 'scan.nessus' })).success).toBe(false);
    const doublon = lot({
      machines: [
        {
          machine: machine(),
          detections: [
            { plugin: '919101', port: 443, protocole: 'TCP' },
            { plugin: '919101', port: 443, protocole: 'TCP' },
          ],
        },
      ],
    });
    expect(LotImportNessus.safeParse(doublon).success).toBe(false);
    expect(
      LotImportNessus.safeParse(
        lot({ machines: [{ machine: machine(), detections: [{ plugin: '919101', port: 443, protocole: 'tcp' }] }] }),
      ).success,
    ).toBe(false);
    // Machine sans détection retenue : admise (ses failles disparues se jugent sur elle).
    expect(
      LotImportNessus.safeParse({ machines: [{ machine: machine(), detections: [] }], constats: [] }).success,
    ).toBe(true);
    const trop = Array.from({ length: NESSUS_BORNES.machinesParLot + 1 }, (_, i) => ({
      machine: machine({
        cle: `ip:198.51.100.${(i % 250) + 1}|m${i}`,
        nom: `m${i}`,
        adresse: `198.51.100.${(i % 250) + 1}`,
      }),
      detections: [],
    }));
    expect(LotImportNessus.safeParse({ machines: trop, constats: [] }).success).toBe(false);
  });

  it('début, fin et bilan : nombres seulement, bornés ; configuration : gravités seulement', () => {
    expect(DebutImportNessus.safeParse({ machines: 3, detections: 4, ecartes }).success).toBe(true);
    for (const x of [
      { machines: 0, detections: 0, ecartes },
      { machines: NESSUS_BORNES.machinesParImport + 1, detections: 0, ecartes },
      { machines: 1, detections: 0, ecartes: { ...ecartes, autre: 1 } },
      { machines: 1, detections: 0, ecartes, fichier: 'scan.nessus' },
    ])
      expect(DebutImportNessus.safeParse(x).success).toBe(false);
    expect(FinImportNessus.safeParse({}).success).toBe(true);
    expect(FinImportNessus.safeParse({ ok: true }).success).toBe(false);
    const bilan = {
      machinesAnnoncees: 3,
      machines: 3,
      constats: 3,
      detections: 4,
      disparues: 0,
      lots: 1,
      ecartes,
      gravites: ['critique', 'elevee'],
    };
    expect(BilanImportNessus.safeParse(bilan).success).toBe(true);
    expect(BilanImportNessus.safeParse({ ...bilan, nom: 'srv' }).success).toBe(false);
    expect(BilanImportNessus.safeParse({ ...bilan, gravites: [] }).success).toBe(false);
    expect(RESULTATS_OPERATION['nessus-fichier'].importer).toBe(BilanImportNessus);
    expect(ConfigurationNessusFichier.parse({})).toEqual({ gravites: ['critique', 'elevee'] });
    expect(ConfigurationNessusFichier.parse({ gravites: ['moyenne', 'critique'] })).toEqual({
      gravites: ['critique', 'moyenne'],
    });
    expect(
      ConfigurationNessusFichier.safeParse({ gravites: ['critique'], adresse: 'https://x.example.org' }).success,
    ).toBe(false);
    expect(ConfigurationNessusFichier.safeParse({ gravites: ['info'] }).success).toBe(false);
  });
});
