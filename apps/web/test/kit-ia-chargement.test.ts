import { describe, expect, it } from 'vitest';
import { assembler, reconnaitre } from '../src/pilotage/kit-ia-chargement';

const f = (nom: string, v: unknown) => ({ nom, texte: JSON.stringify(v) });
const controle = { id: 'IA-001', domain: 'D', title_fr: 'T', requirement_fr: 'Exigence fictive assez longue' };

describe('chargement du kit IA', () => {
  it('reconnaît les listes d’après leurs champs, pas d’après le nom du fichier', () => {
    expect(reconnaitre([controle])).toBe('controls');
    expect(reconnaitre([{ internal_control_id: 'IA-001' }])).toBe('correspondances');
    expect(reconnaitre([{ delta_id: 'D1' }])).toBe('deltas');
    expect(reconnaitre([{ title: 't', url: 'https://example.invalid' }])).toBe('sources');
    expect(reconnaitre([{ autre: 1 }])).toBeNull();
    expect(reconnaitre([])).toBeNull();
    // Une liste vide est ignorée sans bloquer les autres fichiers.
    expect(assembler([f('vide.json', []), f('c.json', [controle])]).problemes).toEqual([]);
  });

  it('assemble plusieurs fichiers en un kit', () => {
    const r = assembler([
      f('a.json', [controle]),
      f('b.json', [{ internal_control_id: 'IA-001', target_reference_type: 'ISO27001', reference_hint_raw: '§5.2' }]),
      f('v.json', { version: 'fictif-1' }),
    ]);
    expect(r.problemes).toEqual([]);
    expect(Object.keys(r.kit).sort()).toEqual(['controls', 'correspondances', 'version']);
    expect(r.trouvees.map((t) => t.rubrique)).toEqual(['controls', 'correspondances']);
  });

  it('accepte le kit complet en un seul fichier', () => {
    const r = assembler([f('kit.json', { version: '2', controls: [controle], sources: [] })]);
    expect(r.problemes).toEqual([]);
    expect(r.kit.version).toBe('2');
  });

  it('signale les fichiers invalides, les rubriques répétées et l’absence de contrôles', () => {
    const r = assembler([
      f('x.json', [{ autre: 1 }]),
      { nom: 'y.json', texte: '{' },
      f('c.json', [controle]),
      f('d.json', [controle]),
    ]);
    expect(r.problemes.some((p) => p.includes('liste non reconnue'))).toBe(true);
    expect(r.problemes.some((p) => p.includes('JSON valide'))).toBe(true);
    expect(r.problemes.some((p) => p.includes('déjà fournie'))).toBe(true);
    expect(assembler([]).problemes[0]).toMatch(/Aucun fichier de contrôles/);
  });
});
