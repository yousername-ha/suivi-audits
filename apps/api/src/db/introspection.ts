/* Types Kysely des tables et vues, déduits de la base réellement migrée (ADR 0062) : les migrations SQL restent la seule
   source de vérité du schéma. Fonction pure (rendu) séparée de la lecture du catalogue pour être testée sans base. */
import type pg from 'pg';

export interface ColonneCatalogue {
  table_name: string;
  column_name: string;
  ordinal_position: number;
  is_nullable: 'YES' | 'NO';
  data_type: string;
  udt_name: string;
  column_default: string | null;
  is_identity: 'YES' | 'NO';
  is_generated: 'ALWAYS' | 'NEVER';
}
export interface EnumCatalogue {
  typname: string;
  enumlabel: string;
}
/** Contrainte CHECK portant sur une seule colonne (pg_get_constraintdef). */
export interface CheckCatalogue {
  table_name: string;
  column_name: string;
  definition: string;
}

/** Lecture du catalogue du schéma public (tables et vues), dans un ordre stable. */
export async function lireCatalogue(c: Pick<pg.Client, 'query'>) {
  const colonnes = (
    await c.query<ColonneCatalogue>(
      `SELECT table_name, column_name, ordinal_position, is_nullable, data_type, udt_name, column_default, is_identity,
              is_generated
         FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
    )
  ).rows;
  const enums = (
    await c.query<EnumCatalogue>(
      `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`,
    )
  ).rows;
  const checks = (
    await c.query<CheckCatalogue>(
      `SELECT r.relname AS table_name, a.attname AS column_name, pg_get_constraintdef(k.oid) AS definition
         FROM pg_constraint k JOIN pg_class r ON r.oid = k.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace
         JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = k.conkey[1]
        WHERE n.nspname = 'public' AND k.contype = 'c' AND cardinality(k.conkey) = 1
        ORDER BY 1, 2, 3`,
    )
  ).rows;
  return { colonnes, enums, checks };
}

/** Valeurs permises par « CHECK (col IN ('a', 'b')) », telle que PostgreSQL la restitue ; null si autre forme. */
export function valeursCheck(definition: string): string[] | null {
  const m = /^CHECK \(\(\(?(\w+)\)?(?:::[\w ]+)? = ANY \(\(?ARRAY\[(.+?)\]\)?(?:::text\[\])?\)\)\)$/.exec(definition);
  if (!m) return null;
  const elements = [...m[2]!.matchAll(/'((?:[^']|'')*)'::(?:text|character varying)/g)];
  // Tout le contenu doit être une suite de littéraux : sinon la forme n'est pas reconnue.
  if (!elements.length || elements.map((e) => e[0]).join(', ') !== m[2]) return null;
  return elements.map((e) => e[1]!.replace(/''/g, "'"));
}

// Correspondance des types PostgreSQL vers TypeScript, alignée sur les analyseurs de pg configurés dans db.ts
// (int8 lu en nombre). Chaque type a sa forme en lecture, à l'insertion et à la mise à jour. Un type inconnu devient
// « unknown » et est signalé dans l'en-tête du fichier.
interface Forme {
  lecture: string;
  insertion: string;
  maj: string;
}
const simple = (t: string): Forme => ({ lecture: t, insertion: t, maj: t });
const HORODATAGE: Forme = { lecture: 'Date', insertion: 'Date | string', maj: 'Date | string' };
const SCALAIRES: Record<string, Forme> = {
  ...Object.fromEntries(
    ['uuid', 'text', 'varchar', 'bpchar', 'citext', 'name', 'inet', 'cidr', 'tsvector'].map((t) => [
      t,
      simple('string'),
    ]),
  ),
  ...Object.fromEntries(['int2', 'int4', 'int8', 'float4', 'float8', 'oid'].map((t) => [t, simple('number')])),
  bool: simple('boolean'),
  bytea: simple('Buffer'),
  // numeric : lu en texte pour ne perdre aucune précision.
  numeric: { lecture: 'string', insertion: 'number | string', maj: 'number | string' },
  timestamptz: HORODATAGE,
  timestamp: HORODATAGE,
  date: HORODATAGE,
  // jsonb : lu analysé ; écrit en texte JSON (JSON.stringify), comme le pilote pg l'exige pour un tableau.
  jsonb: { lecture: 'JsonValue', insertion: 'string', maj: 'string' },
  json: { lecture: 'JsonValue', insertion: 'string', maj: 'string' },
  interval: { lecture: 'unknown', insertion: 'string', maj: 'string' },
};
const tableau = (t: string) => (/^[\w.]+$/.test(t) ? `${t}[]` : `(${t})[]`);

const pascal = (s: string) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');
const identifiant = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s));

export function rendreTypes(
  colonnes: ColonneCatalogue[],
  enums: EnumCatalogue[],
  checks: CheckCatalogue[] = [],
): string {
  // Colonnes texte limitées par CHECK (col IN (...)) : union des valeurs permises (intersection si plusieurs).
  const permises = new Map<string, string[]>();
  for (const k of checks) {
    const v = valeursCheck(k.definition);
    if (!v) continue;
    const cle = `${k.table_name}.${k.column_name}`;
    const avant = permises.get(cle);
    permises.set(cle, avant ? avant.filter((x) => v.includes(x)) : v);
  }
  const valeursEnum = new Map<string, string[]>();
  for (const e of enums) valeursEnum.set(e.typname, [...(valeursEnum.get(e.typname) ?? []), e.enumlabel]);
  const inconnus = new Set<string>();
  const formeDe = (udt: string): Forme => {
    if (udt.startsWith('_')) {
      const f = formeDe(udt.slice(1));
      return { lecture: tableau(f.lecture), insertion: tableau(f.insertion), maj: tableau(f.maj) };
    }
    if (SCALAIRES[udt]) return SCALAIRES[udt];
    if (valeursEnum.has(udt)) return simple(pascal(udt));
    inconnus.add(udt);
    return simple('unknown');
  };
  const TEXTES = new Set(['text', 'varchar', 'bpchar', 'citext']);
  const rendreColonne = (col: ColonneCatalogue): string => {
    const valeurs = TEXTES.has(col.udt_name) ? permises.get(`${col.table_name}.${col.column_name}`) : undefined;
    const f = valeurs?.length ? simple(valeurs.map((v) => JSON.stringify(v)).join(' | ')) : formeDe(col.udt_name);
    const nul = col.is_nullable === 'YES' ? ' | null' : '';
    const [l, i, m] = [f.lecture + nul, f.insertion + nul, f.maj + nul];
    const homogene = l === i && i === m;
    if (col.is_generated === 'ALWAYS') return `GeneratedAlways<${l}>`;
    if (col.is_identity === 'YES' || col.column_default !== null)
      return homogene ? `Generated<${l}>` : `ColumnType<${l}, ${i} | undefined, ${m}>`;
    return homogene ? l : `ColumnType<${l}, ${i}, ${m}>`;
  };

  const tables = new Map<string, ColonneCatalogue[]>();
  for (const col of [...colonnes].sort(
    (a, b) => a.table_name.localeCompare(b.table_name) || a.ordinal_position - b.ordinal_position,
  ))
    tables.set(col.table_name, [...(tables.get(col.table_name) ?? []), col]);

  const noms = new Map<string, string>();
  for (const t of tables.keys()) {
    let n = pascal(t) || 'Table';
    while ([...noms.values()].includes(n)) n += '_';
    noms.set(t, n);
  }

  const corps: string[] = [];
  for (const [nom, labels] of [...valeursEnum].sort(([a], [b]) => a.localeCompare(b)))
    corps.push(`export type ${pascal(nom)} = ${labels.map((l) => JSON.stringify(l)).join(' | ')};`, '');
  for (const [table, cols] of tables) {
    corps.push(`export interface ${noms.get(table)} {`);
    for (const col of cols) {
      corps.push(`  ${identifiant(col.column_name)}: ${rendreColonne(col)};`);
    }
    corps.push('}', '');
  }
  corps.push('export interface DB {');
  for (const [table, nom] of noms) corps.push(`  ${identifiant(table)}: ${nom};`);
  corps.push('}');

  const entete = [
    '/* Types des tables et vues de la base, générés depuis la base migrée (ADR 0062). NE PAS MODIFIER À LA MAIN :',
    '   pnpm --filter @suivi/api db:types ; la CI régénère ce fichier et échoue s’il diffère. */',
    ...(inconnus.size ? [`/* Types PostgreSQL non reconnus (unknown) : ${[...inconnus].sort().join(', ')}. */`] : []),
    `import type { ${['ColumnType', 'Generated', 'GeneratedAlways'].filter((n) => corps.some((l) => l.includes(`${n}<`))).join(', ')} } from 'kysely';`,
    '',
    'export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };',
    '',
  ];
  return [...entete, ...corps].join('\n') + '\n';
}
