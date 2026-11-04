/* Modèles publics de la configuration GRC : EBIOS Risk Manager (guide ANSSI 1.5) et MÉHARI 2010 (CLUSIF). Les grilles
   attendues sont recopiées des documents cités dans `source` (EBIOS RM p. 75, lue avec G4 en haut ; MÉHARI § 4 p. 28). */
import { describe, expect, it } from 'vitest';
import {
  appliesToFamily,
  cfgTemplates,
  evaluateMatrix,
  evaluateMethod,
  instantiateTemplateDefinition,
  methodTemplate,
  parseCfgDefinition,
  resolveMethodBindings,
  validateMatrix,
  type CfgTemplate,
  type MatrixDefinition,
  type ScaleDefinition,
} from '../src/index.js';

/** Adoption simulée d'un modèle : chaque élément reçoit un identifiant, puis sa définition est validée. */
function adopter(id: string) {
  const tpl = cfgTemplates().find((t) => t.id === id) as CfgTemplate;
  const ids = Object.fromEntries(tpl.items.map((i, n) => [i.ref, `00000000-0000-4000-8000-0000000000${10 + n}`]));
  const defs = Object.fromEntries(
    tpl.items.map((i) => {
      const r = parseCfgDefinition(
        i.kind,
        instantiateTemplateDefinition(i.definition, (x) => ({ item: ids[x]!, version: 1 })),
      );
      if (!r.ok) throw new Error(`${id}/${i.ref} : ${r.errors.join(' ; ')}`);
      return [i.ref, r.definition];
    }),
  );
  return { tpl, ids, defs };
}

/** Grille lue ligne par ligne, du niveau le plus fort au plus faible (comme dans les documents). */
const lignes = (m: MatrixDefinition, rows: string[], cols: string[]) =>
  rows.map((r) => cols.map((c) => evaluateMatrix(m, r, c)?.result));

describe('modèle EBIOS Risk Manager (ANSSI)', () => {
  const { tpl, ids, defs } = adopter('ebios-rm-gravite-vraisemblance');
  const gravite = defs.gravite as ScaleDefinition,
    vraisemblance = defs.vraisemblance as ScaleDefinition,
    niveau = defs.niveau as ScaleDefinition,
    matrice = defs.matrice as MatrixDefinition;

  it('cite sa source publique et sa licence', () => {
    expect(tpl.source).toMatchObject({ organisation: 'ANSSI', version: '1.5 — septembre 2024' });
    expect(tpl.source!.license).toMatch(/Licence Ouverte/);
    expect(tpl.note).toMatch(/valider/);
  });
  it('reprend les quatre niveaux de gravité et de vraisemblance du guide', () => {
    expect(gravite.levels.map((l) => l.label)).toEqual([
      'G1 — Mineure',
      'G2 — Significative',
      'G3 — Grave',
      'G4 — Critique',
    ]);
    expect(vraisemblance.levels.map((l) => l.label)).toEqual([
      'V1 — Peu vraisemblable',
      'V2 — Vraisemblable',
      'V3 — Très vraisemblable',
      'V4 — Quasi certain',
    ]);
    expect(gravite.levels.every((l) => l.description.length > 0)).toBe(true);
    expect(niveau.levels.map((l) => [l.label, l.acceptability])).toEqual([
      ['Faible', 'acceptable'],
      ['Moyen', 'conditional'],
      ['Élevé', 'unacceptable'],
    ]);
  });
  it('donne la cartographie du risque du guide (16 cellules, G4 en haut)', () => {
    expect(validateMatrix(matrice, { rows: gravite, columns: vraisemblance, result: niveau })).toEqual([]);
    expect(lignes(matrice, ['g4', 'g3', 'g2', 'g1'], ['v1', 'v2', 'v3', 'v4'])).toEqual([
      ['moyen', 'moyen', 'eleve', 'eleve'],
      ['faible', 'moyen', 'eleve', 'eleve'],
      ['faible', 'faible', 'moyen', 'eleve'],
      ['faible', 'faible', 'moyen', 'moyen'],
    ]);
    // Scénarios de l'exemple : R4 (G4, V2) moyen, R1 (G3, V3) et R3 (G3, V4) élevés, R2 (G3, V2) moyen.
    expect(evaluateMatrix(matrice, 'g4', 'v2')?.result).toBe('moyen');
    expect(evaluateMatrix(matrice, 'g3', 'v3')?.result).toBe('eleve');
    expect(evaluateMatrix(matrice, 'g3', 'v2')?.result).toBe('moyen');
  });
  it('convient à EBIOS RM et à ISO/IEC 27005, pas à MÉHARI', () => {
    for (const d of Object.values(defs) as { appliesTo: ScaleDefinition['appliesTo'] }[]) {
      expect(appliesToFamily(d.appliesTo, 'ebios_rm')).toBe(true);
      expect(appliesToFamily(d.appliesTo, 'iso27005')).toBe(true);
      expect(appliesToFamily(d.appliesTo, 'mehari')).toBe(false);
    }
  });
  it('s’épingle dans une méthode EBIOS RM et calcule le niveau de risque', () => {
    const ref = (r: string) => ({ item: ids[r]!, version: 1 });
    const method = {
      ...methodTemplate('ebios_rm'),
      bindings: {
        dimensions: { severity: ref('gravite') },
        likelihood: ref('vraisemblance'),
        levels: ref('niveau'),
        matrix: { ref: ref('matrice'), dimension: 'severity' },
      },
    };
    const k = (r: string) => `${ids[r]}@1`;
    const r = resolveMethodBindings(method, {
      scales: new Map([
        [k('gravite'), gravite],
        [k('vraisemblance'), vraisemblance],
        [k('niveau'), niveau],
      ]),
      matrices: new Map([[k('matrice'), matrice]]),
    });
    expect(r.ok, r.ok ? '' : r.errors.join(' ; ')).toBe(true);
    if (!r.ok) return;
    const e = evaluateMethod(r.definition, {
      dimensions: { severity: 'g3' },
      likelihood: 'v4',
      level: null,
      inputs: {},
    });
    expect(e).toMatchObject({ level: 'eleve', acceptability: 'unacceptable' });
  });
});

describe('modèle MÉHARI 2010 (CLUSIF)', () => {
  const { tpl, ids, defs } = adopter('mehari-2010-impact-potentialite');
  const impact = defs.impact as ScaleDefinition,
    potentialite = defs.potentialite as ScaleDefinition,
    gravite = defs.gravite as ScaleDefinition,
    grille = defs.grille as MatrixDefinition;

  it('cite sa source et ses réserves', () => {
    expect(tpl.source).toMatchObject({ organisation: 'CLUSIF', version: '2010' });
    expect(tpl.note).toMatch(/marque déposée du CLUSIF/);
    expect(tpl.note).toMatch(/valider/);
  });
  it('reprend les échelles standards d’impact et de potentialité (annexe D)', () => {
    expect(impact.levels.map((l) => l.label)).toEqual([
      '1 — Non significatif',
      '2 — Important',
      '3 — Très grave',
      '4 — Vital',
    ]);
    expect(potentialite.levels.map((l) => l.label)).toEqual([
      '1 — Très improbable',
      '2 — Improbable',
      '3 — Probable',
      '4 — Très probable',
    ]);
    // Gravité 3 (inadmissible) et 4 (insupportable) sont les risques inacceptables ; les gravités inférieures sont tolérées.
    expect(gravite.levels.map((l) => l.acceptability)).toEqual([
      'acceptable',
      'acceptable',
      'unacceptable',
      'unacceptable',
    ]);
  });
  it('donne la grille d’acceptabilité standard (I = 4 en haut, P = 1 à gauche)', () => {
    expect(validateMatrix(grille, { rows: impact, columns: potentialite, result: gravite })).toEqual([]);
    expect(lignes(grille, ['i4', 'i3', 'i2', 'i1'], ['p1', 'p2', 'p3', 'p4'])).toEqual([
      ['g2', 'g3', 'g4', 'g4'],
      ['g2', 'g3', 'g3', 'g4'],
      ['g1', 'g2', 'g2', 'g3'],
      ['g1', 'g1', 'g1', 'g2'],
    ]);
  });
  it('classe disponibilité, intégrité et confidentialité sur l’échelle à quatre niveaux', () => {
    const c = defs.classification as { criteria: { id: string; scale: { item: string } }[] };
    expect(c.criteria.map((x) => x.id)).toEqual(['disponibilite', 'integrite', 'confidentialite']);
    expect(c.criteria.every((x) => x.scale.item === ids.impact)).toBe(true);
  });
  it('s’épingle dans une méthode MÉHARI : impact vital et potentialité probable donnent un risque insupportable', () => {
    const ref = (r: string) => ({ item: ids[r]!, version: 1 });
    const k = (r: string) => `${ids[r]}@1`;
    const r = resolveMethodBindings(
      {
        ...methodTemplate('mehari'),
        bindings: {
          dimensions: { severity: ref('impact') },
          likelihood: ref('potentialite'),
          levels: ref('gravite'),
          matrix: { ref: ref('grille'), dimension: 'severity' },
        },
      },
      {
        scales: new Map([
          [k('impact'), impact],
          [k('potentialite'), potentialite],
          [k('gravite'), gravite],
        ]),
        matrices: new Map([[k('grille'), grille]]),
      },
    );
    expect(r.ok, r.ok ? '' : r.errors.join(' ; ')).toBe(true);
    if (!r.ok) return;
    expect(
      evaluateMethod(r.definition, { dimensions: { severity: 'i4' }, likelihood: 'p3', level: null, inputs: {} }),
    ).toMatchObject({
      level: 'g4',
      acceptability: 'unacceptable',
    });
  });
});
