/* Assistant et module Vulnérabilités (ADR 0100, V14, V29, V30) : format des repères, repères cités, découpage d'un texte pour
   l'affichage (machine nommée, repère non lisible, repère inconnu), décision sur une proposition, bloc des actifs touchés
   d'une action et description bornée. Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  blocActifsTouches,
  citeUnRepere,
  DecisionPropositionVulnBody,
  decouperReperes,
  descriptionAvecActifs,
  numeroRepere,
  repereMachine,
  reperesCites,
  texteDesSegments,
} from '../src/index.js';

describe('repères', () => {
  it('format M-001 à M-999', () => {
    expect(repereMachine(1)).toBe('M-001');
    expect(repereMachine(42)).toBe('M-042');
    expect(repereMachine(999)).toBe('M-999');
    expect(numeroRepere('M-007')).toBe(7);
    for (const x of ['M-000', 'M-1000', 'm-001', 'M-01', 'X-001', ' M-001']) expect(numeroRepere(x)).toBeNull();
  });

  it('repères cités : mots entiers, sans doublon, dans l’ordre', () => {
    expect(reperesCites('Traiter M-002, puis M-001 et encore M-002.')).toEqual(['M-002', 'M-001']);
    expect(reperesCites('M-0012 XM-001 M-001a srv-M-001 M-001_x')).toEqual([]);
    expect(citeUnRepere('(M-003)')).toBe(true);
    expect(citeUnRepere('Aucun repère ici.')).toBe(false);
  });

  it('découpage : nom à la place d’un repère résolu ; repère non lisible ou inconnu laissé tel quel', () => {
    const s = decouperReperes('D’abord M-001, puis M-002 et M-777.', (r) =>
      r === 'M-001' ? { machine: 'srv-fictif-01.exemple.invalid' } : r === 'M-002' ? 'non_lisible' : 'inconnu',
    );
    expect(s).toEqual([
      { texte: 'D’abord ' },
      { repere: 'M-001', machine: 'srv-fictif-01.exemple.invalid' },
      { texte: ', puis ' },
      { repere: 'M-002', etat: 'non_lisible' },
      { texte: ' et ' },
      { repere: 'M-777', etat: 'inconnu' },
      { texte: '.' },
    ]);
    expect(texteDesSegments(s)).toBe('D’abord srv-fictif-01.exemple.invalid, puis M-002 et M-777.');
    expect(decouperReperes('Sans repère.', () => 'inconnu')).toEqual([{ texte: 'Sans repère.' }]);
    expect(decouperReperes('', () => 'inconnu')).toEqual([]);
  });
});

describe('décision sur une proposition', () => {
  it('confirmer exige le périmètre ; rejeter non ; champs bornés', () => {
    const p = '00000000-0000-4000-8000-000000000001';
    expect(DecisionPropositionVulnBody.safeParse({ decision: 'confirmer' }).success).toBe(false);
    expect(DecisionPropositionVulnBody.parse({ decision: 'confirmer', perimetreId: p })).toEqual({
      decision: 'confirmer',
      perimetreId: p,
      note: '',
    });
    expect(DecisionPropositionVulnBody.parse({ decision: 'rejeter', note: ' Hors sujet. ' }).note).toBe('Hors sujet.');
    expect(
      DecisionPropositionVulnBody.safeParse({ decision: 'confirmer', perimetreId: p, titre: 'x'.repeat(201) }).success,
    ).toBe(false);
    expect(
      DecisionPropositionVulnBody.safeParse({ decision: 'confirmer', perimetreId: p, echeance: '31/01/2099' }).success,
    ).toBe(false);
    expect(DecisionPropositionVulnBody.safeParse({ decision: 'rejeter', inconnu: 1 }).success).toBe(false);
  });
});

describe('actifs touchés d’une action (V30)', () => {
  const noms = (k: number) => Array.from({ length: k }, (_, i) => `srv-fictif-${String(i + 1).padStart(2, '0')}`);

  it('une machine et une application', () => {
    expect(
      blocActifsTouches({
        machines: ['srv-fictif-01'],
        autres: 0,
        sansNom: 0,
        applications: ['Éditeur fictif Produit fictif 1.5'],
        renvoi: 'CVE-2026-90001',
      }),
    ).toBe(
      'Actifs touchés (selon vos droits de lecture) :\nMachine touchée : srv-fictif-01.\nApplication touchée : Éditeur fictif Produit fictif 1.5.',
    );
  });

  it('liste bornée : « et N autres », machines sans nom comptées, renvoi à la faille', () => {
    const b = blocActifsTouches({
      machines: noms(20),
      autres: 5,
      sansNom: 2,
      applications: ['Contrôle fictif'],
      renvoi: 'contrôle n° 990001 de Tenable Security Center',
    });
    expect(b).toContain(`Machines touchées : ${noms(20).join(', ')} et 5 autres et 2 machines sans nom`);
    expect(b).toContain(
      '(liste complète dans le module Vulnérabilités : contrôle n° 990001 de Tenable Security Center).',
    );
    expect(blocActifsTouches({ machines: [], autres: 0, sansNom: 1, applications: [], renvoi: 'CVE-2026-90001' })).toBe(
      'Actifs touchés (selon vos droits de lecture) :\nMachine touchée : 1 machine sans nom (liste complète dans le module Vulnérabilités : CVE-2026-90001).',
    );
    const apps = blocActifsTouches({
      machines: [],
      autres: 0,
      sansNom: 0,
      applications: noms(12),
      renvoi: 'x',
    });
    expect(apps).toContain('Applications touchées : ');
    expect(apps).toContain('et 2 autre(s).');
  });

  it('rien de connu : bloc vide ; description bornée en raccourcissant la part de la personne, jamais le bloc', () => {
    expect(blocActifsTouches({ machines: [], autres: 0, sansNom: 0, applications: [], renvoi: 'x' })).toBe('');
    expect(descriptionAvecActifs('  Texte.  ', '')).toBe('Texte.');
    expect(descriptionAvecActifs('', 'Bloc')).toBe('Bloc');
    expect(descriptionAvecActifs('Texte.', 'Bloc')).toBe('Texte.\n\nBloc');
    const d = descriptionAvecActifs('a'.repeat(50), 'Bloc fictif', 30);
    expect(d).toHaveLength(30);
    expect(d.endsWith('…\n\nBloc fictif')).toBe(true);
  });
});
