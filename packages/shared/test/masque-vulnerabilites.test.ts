/* Liste de mots à ne pas masquer (ADR 0100, décision V31) : forme admise d'un mot (lettres et chiffres de toute écriture,
   tirets), formes refusées (point, espace, deux-points, « \ », adresse, identifiant de Tenable, repère, trop court, trop
   long), doublons sans tenir compte de la casse, borne du nombre de mots, phrase de l'effet. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  cleMotNonMasque,
  EffetMotQuery,
  libelleEffetMot,
  MOT_NON_MASQUE_MAX,
  motNonMasqueAdmis,
  MOTS_NON_MASQUES_MAX,
  REGLAGE_MASQUE_DEFAUT,
  ReglageMasque,
  refusMotNonMasque,
} from '../src/index.js';

describe('mots à ne pas masquer', () => {
  it('admet un mot de lettres et de chiffres de toute écriture, avec des tirets à l’intérieur', () => {
    for (const mot of ['dpi', 'PACS', 'web', 'été', 'ДПИ', 'app-01', 'r2', '42', 'a'.repeat(MOT_NON_MASQUE_MAX)])
      expect(refusMotNonMasque(mot), mot).toBeNull();
    expect(ReglageMasque.parse({ mots: ['  dpi ', 'PACS'] })).toEqual({ mots: ['dpi', 'PACS'] });
    expect(REGLAGE_MASQUE_DEFAUT).toEqual({ mots: [] });
  });

  it('refuse point, espace, deux-points, « \\ », « $ », adresse, identifiant de Tenable, repère, trop court, trop long', () => {
    const refuses = [
      'dpi.exemple',
      'dpi.exemple.invalid',
      'd pi',
      'dpi:8443',
      'EXEMPLE\\DPI',
      'DPI$',
      'dpi_old',
      '-dpi',
      'dpi-',
      '192.0.2.1',
      '2001:db8::1',
      'fe80::1',
      '00000000-0000-4000-8000-0000000009a1',
      '000000000000400080000000000009a1',
      'M-001',
      'm-1234',
      '[machine]',
      'x',
      'a'.repeat(MOT_NON_MASQUE_MAX + 1),
      '',
    ];
    for (const mot of refuses) {
      expect(motNonMasqueAdmis(mot), mot).toBe(false);
      expect(ReglageMasque.safeParse({ mots: [mot] }).success, mot).toBe(false);
    }
    expect(refusMotNonMasque('M-001')).toMatch(/repère/);
    expect(refusMotNonMasque('00000000-0000-4000-8000-0000000009a1')).toMatch(/Tenable/);
    expect(refusMotNonMasque('dpi.exemple')).toMatch(/ni point/);
    expect(refusMotNonMasque('x')).toMatch(/de 2 à 60 caractères/);
  });

  it('refuse les doublons sans tenir compte de la casse, plus de 200 mots et toute autre clé', () => {
    const r = ReglageMasque.safeParse({ mots: ['dpi', 'pacs', 'DPI'] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]).toMatchObject({
      path: ['mots', 2],
      message: 'Le mot « DPI » figure déjà dans la liste.',
    });
    expect(cleMotNonMasque('ÉTÉ')).toBe(cleMotNonMasque('été'));
    const mots = Array.from({ length: MOTS_NON_MASQUES_MAX }, (_, i) => `mot${i}`);
    expect(ReglageMasque.safeParse({ mots }).success).toBe(true);
    expect(ReglageMasque.safeParse({ mots: [...mots, 'encore'] }).success).toBe(false);
    expect(ReglageMasque.safeParse({ mots: [], autre: 1 }).success).toBe(false);
    expect(ReglageMasque.safeParse({}).success).toBe(false);
    expect(EffetMotQuery.safeParse({ mot: 'dpi' }).success).toBe(true);
    expect(EffetMotQuery.safeParse({ mot: 'dpi.exemple' }).success).toBe(false);
  });

  it('dit en clair ce que le mot laisse sortir', () => {
    expect(libelleEffetMot({ machines: 0 })).toContain('aucun effet aujourd’hui');
    expect(libelleEffetMot({ machines: 1 })).toBe(
      'Ce mot est aussi le nom court d’une machine : il partira chez le fournisseur du modèle quand quelqu’un l’écrit.',
    );
    expect(libelleEffetMot({ machines: 2 })).toBe(
      'Ce mot est aussi le nom court de 2 machines : il partira chez le fournisseur du modèle quand quelqu’un l’écrit.',
    );
  });
});
