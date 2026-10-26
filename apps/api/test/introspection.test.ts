import { describe, expect, it } from 'vitest';
import { rendreTypes, type ColonneCatalogue } from '../src/db/introspection.js';

const col = (c: Partial<ColonneCatalogue> & Pick<ColonneCatalogue, 'column_name' | 'udt_name'>): ColonneCatalogue => ({
  table_name: 'exemple',
  ordinal_position: 1,
  is_nullable: 'NO',
  data_type: '',
  column_default: null,
  is_identity: 'NO',
  is_generated: 'NEVER',
  ...c,
});

describe('génération des types Kysely', () => {
  it('traduit les types, la nullabilité, les valeurs par défaut et les colonnes générées', () => {
    const out = rendreTypes(
      [
        col({ column_name: 'id', udt_name: 'uuid', column_default: 'gen_random_uuid()', ordinal_position: 1 }),
        col({ column_name: 'lot', udt_name: 'int8', is_nullable: 'YES', ordinal_position: 2 }),
        col({ column_name: 'refs', udt_name: '_text', ordinal_position: 3 }),
        col({ column_name: 'extra', udt_name: 'jsonb', column_default: "'{}'::jsonb", ordinal_position: 4 }),
        col({ column_name: 'cree', udt_name: 'timestamptz', ordinal_position: 5 }),
        col({ column_name: 'n', udt_name: 'int4', is_identity: 'YES', ordinal_position: 6 }),
        col({ column_name: 'calc', udt_name: 'text', is_generated: 'ALWAYS', ordinal_position: 7 }),
        col({ column_name: 'statut', udt_name: 'etat_t', ordinal_position: 8 }),
        col({ table_name: 'audit_log', column_name: 'details', udt_name: 'mystere' }),
      ],
      [
        { typname: 'etat_t', enumlabel: 'ouvert' },
        { typname: 'etat_t', enumlabel: 'clos' },
      ],
    );
    expect(out).toContain('export type EtatT = "ouvert" | "clos";');
    expect(out).toContain('  id: Generated<string>;');
    expect(out).toContain('  lot: number | null;');
    expect(out).toContain('  refs: string[];');
    expect(out).toContain('  extra: ColumnType<JsonValue, string | undefined, string>;');
    expect(out).toContain('  cree: ColumnType<Date, Date | string, Date | string>;');
    expect(out).toContain('  n: Generated<number>;');
    expect(out).toContain('  calc: GeneratedAlways<string>;');
    expect(out).toContain('  statut: EtatT;');
    expect(out).toContain('Types PostgreSQL non reconnus (unknown) : mystere.');
    // Ordre stable : tables triées, puis l'interface DB.
    expect(out.indexOf('interface AuditLog')).toBeLessThan(out.indexOf('interface Exemple'));
    expect(out).toMatch(/export interface DB \{\n {2}audit_log: AuditLog;\n {2}exemple: Exemple;\n\}\n$/);
  });
  it('est déterministe', () => {
    const c = [col({ column_name: 'a', udt_name: 'text' })];
    expect(rendreTypes(c, [])).toBe(rendreTypes([...c], []));
  });
});
