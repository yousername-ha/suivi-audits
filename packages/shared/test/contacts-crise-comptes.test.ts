/* Contacts de crise issus des comptes (ADR 0107) : schémas d'écriture (administrateur, personne) et contacts de la cellule
   de crise (comptes et contacts saisis à la main, contacts clés en premier). Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  ContactCriseCompteAdmin,
  ContactCriseCompteSoi,
  contactsCellule,
  lireEtatCrise,
  type ContactCriseCompte,
} from '../src/index.js';

const PERIMETRE = '11111111-1111-4111-8111-111111111111';
const compte = (nom: string, key: boolean): ContactCriseCompte => ({
  userId: `id-${nom}`,
  nom,
  courriel: `${nom}@exemple.invalid`,
  role: 'Rôle fictif',
  phone: '01 99 00 00 01',
  phone2: '',
  avail: '',
  key,
});

describe('écriture par l’administrateur', () => {
  it('« Tous les périmètres » par défaut, champs vides par défaut, doublons de périmètres retirés', () => {
    expect(ContactCriseCompteAdmin.parse({ actif: true })).toEqual({
      actif: true,
      role: '',
      telephone: '',
      telephone2: '',
      disponibilite: '',
      cle: false,
      tousPerimetres: true,
      perimetres: [],
    });
    expect(
      ContactCriseCompteAdmin.parse({ actif: true, tousPerimetres: false, perimetres: [PERIMETRE, PERIMETRE] })
        .perimetres,
    ).toEqual([PERIMETRE]);
  });
  it('refuse une liste choisie vide, un identifiant de périmètre invalide, un champ inconnu ou trop long', () => {
    expect(ContactCriseCompteAdmin.safeParse({ actif: true, tousPerimetres: false }).success).toBe(false);
    expect(ContactCriseCompteAdmin.safeParse({ actif: false, tousPerimetres: false }).success).toBe(true);
    expect(ContactCriseCompteAdmin.safeParse({ actif: true, perimetres: ['commun'] }).success).toBe(false);
    expect(ContactCriseCompteAdmin.safeParse({ actif: true, notes: 'x' }).success).toBe(false);
    expect(ContactCriseCompteAdmin.safeParse({ actif: true, telephone: '0'.repeat(101) }).success).toBe(false);
  });
});

describe('écriture par la personne', () => {
  it('admet ses téléphones et sa disponibilité, refuse tout autre champ', () => {
    expect(ContactCriseCompteSoi.parse({ telephone: ' 01 99 00 00 02 ' })).toEqual({ telephone: '01 99 00 00 02' });
    for (const interdit of [
      { role: 'x' },
      { cle: true },
      { tousPerimetres: false },
      { perimetres: [] },
      { actif: false },
    ])
      expect(ContactCriseCompteSoi.safeParse(interdit).success, JSON.stringify(interdit)).toBe(false);
  });
});

describe('contacts de la cellule de crise', () => {
  it('contacts clés d’abord (comptes puis saisis), puis les autres, douze au plus', () => {
    const etat = lireEtatCrise({
      contacts: [
        { name: 'Saisi simple', org: 'Org fictive', key: false },
        { name: 'Saisi clé', key: true, email: 'saisi@exemple.invalid' },
      ],
    });
    const l = contactsCellule(etat.contacts, [compte('Compte simple', false), compte('Compte clé', true)]);
    expect(l.map((x) => [x.name, x.key, x.compte])).toEqual([
      ['Compte clé', true, true],
      ['Saisi clé', true, false],
      ['Compte simple', false, true],
      ['Saisi simple', false, false],
    ]);
    expect(l[0]).toMatchObject({ email: 'Compte clé@exemple.invalid', role: 'Rôle fictif', org: '' });
    const beaucoup = Array.from({ length: 20 }, (_, i) => compte(`C${i}`, i % 2 === 0));
    expect(contactsCellule([], beaucoup)).toHaveLength(12);
    expect(
      contactsCellule([], beaucoup)
        .slice(0, 10)
        .every((x) => x.key),
    ).toBe(true);
  });
  it('sans compte, l’ordre des contacts saisis reste celui de la cellule historique', () => {
    const etat = lireEtatCrise({ contacts: [{ name: 'A' }, { name: 'B', key: true }, { name: 'C' }] });
    expect(contactsCellule(etat.contacts, []).map((x) => x.name)).toEqual(['B', 'A', 'C']);
  });
});
