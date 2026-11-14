/* PESTEL Studio (refonte Neon, lot 5) : facteurs issus de la nomenclature de l'API, recherche du registre et noms des
   processus ; aucune liste de six facteurs n'est imposée à la donnée. */
import { PESTEL_PAR_DEFAUT, regrouperPestel, type EnjeuPestel } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import {
  constellationDense,
  enjeuxExternes,
  facteurAffiche,
  filtrerEnjeux,
  groupesPestel,
  processusEnjeu,
  titrePerspectives,
} from '../src/pilotage/pestel-presentation';

const enjeu = (ref: string, label: string, facteur: string | null, nature: 'ext' | 'int' = 'ext'): EnjeuPestel => ({
  ref,
  label,
  nature,
  description: `Description de ${label}`,
  processus: [],
  facteur,
});
const nomenclature = PESTEL_PAR_DEFAUT.map((f) => ({ ...f }));

describe('PESTEL Studio : facteurs', () => {
  it('suit la nomenclature de l’API, dans son ordre, avec les enjeux classés', () => {
    const vue = regrouperPestel(
      [enjeu('issue:a', 'Cyber', 'technologique'), enjeu('issue:b', 'Loi', 'legal'), enjeu('issue:c', 'Libre', null)],
      nomenclature,
    );
    const groupes = groupesPestel(vue);
    expect(groupes.map((g) => [g.facteur.id, g.teinte, g.enjeux.length])).toEqual([
      ['politique', 'politique', 0],
      ['economique', 'economique', 0],
      ['social', 'social', 0],
      ['technologique', 'technologique', 1],
      ['environnemental', 'environnemental', 0],
      ['legal', 'legal', 1],
    ]);
    expect(groupes.map((g) => g.lettre).join('')).toBe('PÉSTEL');
  });
  it('accepte une nomenclature propre à l’organisme : teinte par rang et pictogramme générique', () => {
    const vue = regrouperPestel(
      [enjeu('issue:a', 'Climat', 'climat')],
      [
        { id: 'juridique', label: 'Juridique' },
        { id: 'climat', label: 'Climat et ressources' },
        { id: 'f3', label: 'Concurrence' },
      ],
    );
    const [juridique, climat, concurrence] = groupesPestel(vue);
    expect(juridique).toMatchObject({ teinte: 'legal', icone: 'legal', connue: true });
    expect(climat).toMatchObject({ teinte: 'economique', icone: 'globe', connue: false, enjeux: [{ ref: 'issue:a' }] });
    expect(concurrence).toMatchObject({ teinte: 'social', icone: 'globe' });
  });
  it('passe en grille au-delà de six facteurs ou avec un libellé long', () => {
    const sept = Array.from({ length: 7 }, (_, i) => ({ id: `f${i}`, label: `Facteur ${i}` }));
    expect(constellationDense(groupesPestel(regrouperPestel([], nomenclature)))).toBe(false);
    expect(constellationDense(groupesPestel(regrouperPestel([], sept)))).toBe(true);
    expect(
      constellationDense(
        groupesPestel(regrouperPestel([], [{ id: 'x', label: 'Environnement réglementaire et normatif' }])),
      ),
    ).toBe(true);
  });
  it('gère une nomenclature absente', () => {
    const vue = regrouperPestel([enjeu('issue:a', 'Cyber', 'technologique')], []);
    expect(groupesPestel(vue)).toEqual([]);
    expect(facteurAffiche([], 'technologique')).toBeUndefined();
    expect(vue.nonClasses).toHaveLength(1);
    expect(titrePerspectives(0)).toBe('Une vue d’ensemble des enjeux externes');
  });
  it('garde le facteur de l’adresse s’il existe, sinon le premier qui a des enjeux, sinon le premier', () => {
    const groupes = groupesPestel(regrouperPestel([enjeu('issue:a', 'Loi', 'legal')], nomenclature));
    expect(facteurAffiche(groupes, 'social')?.facteur.id).toBe('social');
    expect(facteurAffiche(groupes, 'inconnu')?.facteur.id).toBe('legal');
    expect(facteurAffiche(groupes, null)?.facteur.id).toBe('legal');
    expect(facteurAffiche(groupesPestel(regrouperPestel([], nomenclature)), null)?.facteur.id).toBe('politique');
  });
  it('titre la scène selon le nombre de facteurs', () => {
    expect(titrePerspectives(6)).toBe('Une vue d’ensemble, six perspectives');
    expect(titrePerspectives(1)).toBe('Une vue d’ensemble, une perspective');
    expect(titrePerspectives(9)).toBe('Une vue d’ensemble, 9 perspectives');
  });
});

describe('PESTEL Studio : enjeux', () => {
  it('sépare les externes (classés puis non classés) des internes', () => {
    const vue = regrouperPestel(
      [
        enjeu('issue:a', 'Libre', null),
        enjeu('issue:b', 'Loi', 'legal'),
        enjeu('issue:c', 'Culture', null, 'int'),
        enjeu('issue:d', 'Ancien facteur', 'disparu'),
      ],
      nomenclature,
    );
    expect(enjeuxExternes(vue).map((e) => e.ref)).toEqual(['issue:b', 'issue:a', 'issue:d']);
    expect(vue.internes.map((e) => e.ref)).toEqual(['issue:c']);
  });
  it('recherche par intitulé, description, facteur (« Non classé » compris) et nom de processus', () => {
    const a = { ...enjeu('issue:a', 'Cyberattaque', 'technologique'), processus: ['PR4'] },
      b = { ...enjeu('issue:b', 'Évolution légale', null), processus: ['PR9'] };
    const noms = new Map([['PR4', 'Systèmes d’information']]);
    expect(filtrerEnjeux([a, b], '', nomenclature, noms)).toHaveLength(2);
    expect(filtrerEnjeux([a, b], 'evolution', nomenclature, noms).map((e) => e.ref)).toEqual(['issue:b']);
    expect(filtrerEnjeux([a, b], 'technologique', nomenclature, noms).map((e) => e.ref)).toEqual(['issue:a']);
    expect(filtrerEnjeux([a, b], 'non classé', nomenclature, noms).map((e) => e.ref)).toEqual(['issue:b']);
    expect(filtrerEnjeux([a, b], 'systemes d’information', nomenclature, noms).map((e) => e.ref)).toEqual(['issue:a']);
    expect(filtrerEnjeux([a, b], 'PR9', nomenclature, noms).map((e) => e.ref)).toEqual(['issue:b']);
  });
  it('affiche le nom du processus, ou sa référence quand elle n’est pas résolue', () => {
    const e = { ...enjeu('issue:a', 'Cyber', null), processus: ['PR4', 'PR9'] };
    expect(processusEnjeu(e, new Map([['PR4', 'Systèmes d’information']]))).toEqual([
      { code: 'PR4', nom: 'Systèmes d’information', resolu: true },
      { code: 'PR9', nom: 'PR9', resolu: false },
    ]);
  });
});
