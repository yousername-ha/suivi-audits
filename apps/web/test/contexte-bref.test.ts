/* « Le contexte en bref » (Périmètre et contexte, décision du RSSI du 27/11/2026) : chaque chiffre a une définition
   vérifiable dans les données ; une tuile sans ses données reste vide au lieu d'afficher zéro. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PESTEL_PAR_DEFAUT,
  regrouperPestel,
  type CarteProcessus,
  type EnjeuPestel,
  type GrcObject,
} from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { chiffresContexte, detailsContexte } from '../src/pilotage/contexte-bref';

const AUJOURDHUI = '2026-11-27';
const partie = (id: string, reviewedAt?: string): GrcObject =>
  ({
    id,
    smsiId: 's',
    kind: 'stakeholder',
    name: `Partie ${id}`,
    data: reviewedAt === undefined ? {} : { reviewedAt },
    version: 1,
    archived: false,
    createdAt: '',
    updatedAt: '',
    createdBy: '',
    updatedBy: '',
  }) as unknown as GrcObject;
const processus = (id: string, swots: CarteProcessus['rattaches']['swots']): CarteProcessus => ({
  id,
  ref: `legacy:processes:${id}`,
  name: `Processus ${id}`,
  owner: '',
  family: '',
  parent: '',
  purpose: '',
  rattaches: { objectifs: [], indicateurs: [], swots, risques: [], fournisseurs: [] },
});
const swot = (id: string) => ({ ref: `legacy:swots:${id}`, id, name: id, via: 'fiche' as const, lienId: null });
const enjeu = (ref: string, facteur: string | null, nature: 'ext' | 'int' = 'ext'): EnjeuPestel => ({
  ref,
  label: ref,
  nature,
  description: '',
  processus: [],
  facteur,
});

describe('Le contexte en bref : parties intéressées', () => {
  it('compte toutes les fiches et celles dont la revue est absente ou date de plus de 365 jours', () => {
    const c = chiffresContexte({
      aujourdhui: AUJOURDHUI,
      parties: [
        partie('recente', '2026-06-01'),
        partie('limite', '2025-11-27'),
        partie('ancienne', '2025-11-26'),
        partie('sans-date'),
        partie('vide', ''),
      ],
    });
    expect(c.parties).toEqual({ total: 5, aRevoir: 3 });
    expect(detailsContexte(c).parties).toBe('3 à revoir (revue absente ou de plus d’un an)');
  });

  it('libellés sans parties ou sans revue en retard', () => {
    expect(detailsContexte(chiffresContexte({ aujourdhui: AUJOURDHUI, parties: [] })).parties).toBe(
      'Aucune partie enregistrée',
    );
    expect(
      detailsContexte(chiffresContexte({ aujourdhui: AUJOURDHUI, parties: [partie('a', '2026-01-01')] })).parties,
    ).toBe('Toutes revues depuis moins d’un an');
  });
});

describe('Le contexte en bref : SWOT par processus', () => {
  it('analyses du registre, processus sans aucune analyse rattachée ; une nature illisible n’est pas comptée', () => {
    const c = chiffresContexte({
      aujourdhui: AUJOURDHUI,
      analysesSwot: 6,
      processus: [processus('p1', [swot('a')]), processus('p2', []), processus('p3', []), processus('p4', null)],
    });
    expect(c.swot).toEqual({ analyses: 6, processus: 4, processusSansAnalyse: 2 });
    expect(detailsContexte(c).swot).toBe('2 processus sans analyse');
  });

  it('libellés sans processus ou quand chacun a son analyse', () => {
    expect(detailsContexte(chiffresContexte({ aujourdhui: AUJOURDHUI, analysesSwot: 0, processus: [] })).swot).toBe(
      'Aucun processus dans ce périmètre',
    );
    expect(
      detailsContexte(
        chiffresContexte({ aujourdhui: AUJOURDHUI, analysesSwot: 1, processus: [processus('p', [swot('a')])] }),
      ).swot,
    ).toBe('Chaque processus a son analyse');
  });
});

describe('Le contexte en bref : PESTEL', () => {
  it('enjeux externes classés et non classés, dont ceux du facteur « legal » ; les internes restent hors PESTEL', () => {
    const vue = regrouperPestel(
      [
        enjeu('issue:a', 'legal'),
        enjeu('issue:b', 'legal'),
        enjeu('issue:c', 'technologique'),
        enjeu('issue:d', null),
        enjeu('issue:e', 'inconnu'),
        enjeu('issue:f', 'legal', 'int'),
      ],
      PESTEL_PAR_DEFAUT.map((f) => ({ ...f })),
    );
    const c = chiffresContexte({ aujourdhui: AUJOURDHUI, pestel: vue });
    expect(c.pestel).toEqual({ enjeux: 5, reglementaires: 2, libelleReglementaire: 'Légal', nonClasses: 2 });
    expect(detailsContexte(c).pestel).toBe('dont 2 réglementaires (Légal)');
    const aucun = chiffresContexte({
      aujourdhui: AUJOURDHUI,
      pestel: regrouperPestel(
        [enjeu('issue:a', null)],
        PESTEL_PAR_DEFAUT.map((f) => ({ ...f })),
      ),
    });
    expect(aucun.pestel?.reglementaires).toBe(0);
    expect(detailsContexte(aucun).pestel).toBe('dont aucun réglementaire (Légal)');
  });

  it('nomenclature sans facteur « legal » : les non classés à la place, jamais un zéro inventé', () => {
    const vue = regrouperPestel(
      [enjeu('issue:a', 'marche'), enjeu('issue:b', null)],
      [{ id: 'marche', label: 'Marché' }],
    );
    const c = chiffresContexte({ aujourdhui: AUJOURDHUI, pestel: vue });
    expect(c.pestel).toEqual({ enjeux: 2, reglementaires: null, libelleReglementaire: '', nonClasses: 1 });
    expect(detailsContexte(c).pestel).toBe('1 non classé');
  });
});

describe('Le contexte en bref : données manquantes', () => {
  it('chaque tuile reste vide tant qu’une de ses données manque', () => {
    const c = chiffresContexte({ aujourdhui: AUJOURDHUI, analysesSwot: 3 });
    expect(c).toEqual({ parties: null, swot: null, pestel: null });
    expect(detailsContexte(c)).toEqual({
      parties: 'Chiffre indisponible',
      swot: 'Chiffre indisponible',
      pestel: 'Chiffre indisponible',
    });
  });
});

describe('Le contexte en bref : intégration', () => {
  const ICI = path.dirname(fileURLToPath(import.meta.url));
  const lire = (...p: string[]) => readFileSync(path.resolve(ICI, ...p), 'utf8');

  it('affiché à côté de la liste de Périmètre et contexte seulement, tuiles vers les trois onglets', () => {
    expect(lire('../src/pages/Pilotage.tsx')).toContain(
      "<DispositionContexte actif={section === 'contexte'} smsi={smsi}>",
    );
    const vue = lire('../src/pilotage/ContexteEnBref.tsx');
    for (const onglet of ['/pilotage/parties', '/pilotage/swot', '/pilotage/pestel'])
      expect(vue).toContain(`to="${onglet}"`);
    expect(vue).toContain('Clause 4 de l’ISO 27001');
  });

  it('habillé dans tous les styles (styles.css) et en panneau de verre (verre.css)', () => {
    expect(lire('../../../packages/ui/src/styles.css')).toMatch(/\n\.contexte-bref \{/);
    expect(lire('../../../packages/ui/src/verre.css')).toMatch(/\nhtml\[data-style='verre'\] \.contexte-bref \{/);
  });
});
