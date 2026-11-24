/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026) : schémas des groupes de machines
   (création, modification, membres en lot, fenêtre d'un groupe, route du fournisseur), filtre « Groupe » de la liste et du
   parc, présentation « Parc » par défaut. Données entièrement fictives. */
import { describe, expect, it } from 'vitest';
import {
  FILTRE_SANS_GROUPE,
  GroupeDuFournisseur,
  GroupeMachines,
  GroupeMachinesBody,
  GroupeMachinesPatch,
  GROUPES_MACHINES_BORNES,
  GroupesDuFournisseur,
  idDeRefFournisseur,
  MembresGroupeBody,
  PageMachinesGroupe,
  ParamsGroupesFournisseur,
  RechercheMachines,
  RechercheMachinesGroupe,
  RechercheParc,
  refFournisseur,
  RefFournisseur,
  VUE_MACHINES_DEFAUT,
  VUES_MACHINES,
} from '../src/index.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const groupe = {
  id: uuid(1),
  nom: 'Groupe fictif',
  description: '',
  fournisseur: { id: 'SUP-001', ref: 'legacy:suppliers:SUP-001', nom: 'Fournisseur fictif', etat: 'present' },
  machinesLues: 2,
  horsLecture: true,
  version: 1,
  createdBy: 'compte.fictif',
  createdAt: '2026-11-23T08:00:00.000Z',
  updatedBy: 'compte.fictif',
  updatedAt: '2026-11-23T08:00:00.000Z',
};

describe('création et modification d’un groupe', () => {
  it('nom obligatoire, borné, sur une ligne, sans espace autour ; description facultative bornée', () => {
    expect(GroupeMachinesBody.parse({ nom: '  Applications fictives ' })).toEqual({
      nom: 'Applications fictives',
      description: '',
      fournisseurRef: null,
      machineIds: [],
    });
    for (const nom of ['', '   ', 'x'.repeat(GROUPES_MACHINES_BORNES.nom + 1), 'Deux\nlignes', 'Cloche\u0007'])
      expect(GroupeMachinesBody.safeParse({ nom }).success, nom).toBe(false);
    expect(GroupeMachinesBody.parse({ nom: 'x'.repeat(GROUPES_MACHINES_BORNES.nom) }).nom).toHaveLength(120);
    expect(GroupeMachinesBody.parse({ nom: 'G', description: ' Sur\ndeux lignes ' }).description).toBe(
      'Sur\ndeux lignes',
    );
    expect(
      GroupeMachinesBody.safeParse({ nom: 'G', description: 'd'.repeat(GROUPES_MACHINES_BORNES.description + 1) })
        .success,
    ).toBe(false);
    expect(GroupeMachinesBody.safeParse({ nom: 'G', description: 'Cloche\u0007' }).success).toBe(false);
    expect(GroupeMachinesBody.safeParse({ nom: 'G', inconnu: 1 }).success).toBe(false);
  });

  it('machines : identifiants, sans doublon, 500 au plus', () => {
    expect(GroupeMachinesBody.parse({ nom: 'G', machineIds: [uuid(1), uuid(2)] }).machineIds).toHaveLength(2);
    expect(GroupeMachinesBody.safeParse({ nom: 'G', machineIds: [uuid(1), uuid(1)] }).success).toBe(false);
    expect(GroupeMachinesBody.safeParse({ nom: 'G', machineIds: ['srv-01'] }).success).toBe(false);
    const trop = Array.from({ length: GROUPES_MACHINES_BORNES.lot + 1 }, (_, i) => uuid(i + 1));
    expect(GroupeMachinesBody.safeParse({ nom: 'G', machineIds: trop }).success).toBe(false);
  });

  it('fournisseur : référence legacy:suppliers:<id> ou null', () => {
    expect(RefFournisseur.safeParse('legacy:suppliers:SUP-001').success).toBe(true);
    for (const r of ['SUP-001', 'legacy:suppliers:', 'legacy:suppliers:SUP 001', 'legacy:processes:P-1'])
      expect(RefFournisseur.safeParse(r).success, r).toBe(false);
    expect(RefFournisseur.safeParse(`legacy:suppliers:${'x'.repeat(61)}`).success).toBe(false);
    expect(refFournisseur('SUP-002')).toBe('legacy:suppliers:SUP-002');
    expect(idDeRefFournisseur('legacy:suppliers:SUP-002')).toBe('SUP-002');
    expect(idDeRefFournisseur('legacy:items:SUP-002')).toBeNull();
    expect(GroupeMachinesBody.parse({ nom: 'G', fournisseurRef: 'legacy:suppliers:SUP-001' }).fournisseurRef).toBe(
      'legacy:suppliers:SUP-001',
    );
  });

  it('modification : au moins un champ ; fournisseur retirable (null)', () => {
    expect(GroupeMachinesPatch.safeParse({}).success).toBe(false);
    expect(GroupeMachinesPatch.parse({ fournisseurRef: null })).toEqual({ fournisseurRef: null });
    expect(GroupeMachinesPatch.parse({ nom: ' Renommé ' })).toEqual({ nom: 'Renommé' });
    expect(GroupeMachinesPatch.safeParse({ machineIds: [] }).success).toBe(false);
  });

  it('membres en lot : au moins une machine, 500 au plus en tout, aucune à la fois ajoutée et retirée', () => {
    expect(MembresGroupeBody.parse({ ajouter: [uuid(1)] })).toEqual({ ajouter: [uuid(1)], retirer: [] });
    expect(MembresGroupeBody.safeParse({}).success).toBe(false);
    expect(MembresGroupeBody.safeParse({ ajouter: [uuid(1)], retirer: [uuid(1)] }).success).toBe(false);
    expect(MembresGroupeBody.safeParse({ ajouter: [uuid(1), uuid(1)] }).success).toBe(false);
    const moitie = (d: number) => Array.from({ length: 251 }, (_, i) => uuid(d + i));
    expect(MembresGroupeBody.safeParse({ ajouter: moitie(1), retirer: moitie(1000) }).success).toBe(false);
  });
});

describe('lectures', () => {
  it('groupe : fournisseur présent ou supprimé, machines lues et drapeau hors lecture', () => {
    expect(GroupeMachines.parse(groupe)).toEqual(groupe);
    expect(
      GroupeMachines.parse({
        ...groupe,
        fournisseur: { id: 'SUP-009', ref: 'legacy:suppliers:SUP-009', nom: null, etat: 'supprime' },
      }).fournisseur?.etat,
    ).toBe('supprime');
    expect(GroupeMachines.safeParse({ ...groupe, machinesHorsLecture: 3 }).success).toBe(false);
  });

  it('fenêtre d’un groupe : recherche, membres, page ; identifiants bornés', () => {
    expect(RechercheMachinesGroupe.parse({ q: ' srv ', membres: 'non', page: '2' })).toEqual({
      q: 'srv',
      membres: 'non',
      page: 2,
    });
    expect(RechercheMachinesGroupe.safeParse({ membres: 'tous' }).success).toBe(false);
    const page = {
      groupe,
      total: 1,
      page: 1,
      parPage: 25,
      elements: [
        {
          id: uuid(9),
          nom: 'srv-fictif-01.interne.invalid',
          adresse: '192.0.2.10',
          systeme: null,
          role: 'front',
          perimetreNom: null,
          membre: true,
          autresGroupes: [{ id: uuid(2), nom: 'Autre groupe fictif' }],
        },
      ],
      identifiants: [uuid(9)],
      identifiantsTronques: false,
    };
    expect(PageMachinesGroupe.parse(page)).toEqual(page);
    const trop = Array.from({ length: GROUPES_MACHINES_BORNES.lot + 1 }, (_, i) => uuid(i + 1));
    expect(PageMachinesGroupe.safeParse({ ...page, identifiants: trop }).success).toBe(false);
  });

  it('route du fournisseur : identifiant borné ; aucun détail de machine dans la réponse', () => {
    expect(ParamsGroupesFournisseur.parse({ id: 'SUP-001' })).toEqual({ id: 'SUP-001' });
    for (const id of ['', 'SUP 001', 'x'.repeat(61)])
      expect(ParamsGroupesFournisseur.safeParse({ id }).success).toBe(false);
    const g = {
      id: uuid(1),
      nom: 'Groupe fictif',
      description: '',
      machinesLues: 2,
      horsLecture: true,
      faillesCritiquesOuvertes: 3,
    };
    expect(GroupesDuFournisseur.parse({ fournisseurId: 'SUP-001', groupes: [g] }).groupes).toEqual([g]);
    expect(GroupeDuFournisseur.safeParse({ ...g, machines: [{ nom: 'srv-fictif' }] }).success).toBe(false);
    expect(Object.keys(GroupeDuFournisseur.shape).sort()).toEqual([
      'description',
      'faillesCritiquesOuvertes',
      'horsLecture',
      'id',
      'machinesLues',
      'nom',
    ]);
  });
});

describe('filtre « Groupe » de la liste et du parc ; présentation par défaut', () => {
  it('un groupe ou « Sans groupe » ; tout autre texte refusé', () => {
    for (const schema of [RechercheMachines, RechercheParc]) {
      expect(schema.parse({ groupe: uuid(3) })).toMatchObject({ groupe: uuid(3) });
      expect(schema.parse({ groupe: FILTRE_SANS_GROUPE })).toMatchObject({ groupe: 'aucun' });
      expect(schema.safeParse({ groupe: 'Applications' }).success).toBe(false);
      expect(schema.parse({})).not.toHaveProperty('groupe');
    }
  });

  it('présentation « Parc » sans préférence mémorisée', () => {
    expect(VUE_MACHINES_DEFAUT).toBe('parc');
    expect(VUES_MACHINES).toContain(VUE_MACHINES_DEFAUT);
  });
});
