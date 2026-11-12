/* Garde-fou d'architecture (ADR 0083, chantier 4) : une donnée d'un module ne sort vers un autre qu'à travers la porte de
   lecture. Le test analyse le source de l'API et échoue si un fichier interroge directement les tables GRC partagées
   (objets, liens, registres, périmètres de registre) ou relit l'état historique brut (`recompose()`) sans figurer dans la
   liste blanche ci-dessous. Chaque entrée porte sa justification ; ajouter une entrée se discute en revue. Une entrée qui ne
   correspond plus à aucun accès est refusée (la liste ne peut que se réduire). */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

const SRC = path.join(REPO, 'apps/api/src');

/** Catégories : `module` (primitives du module GRC), `porte`, `systeme` (opération qui doit tout voir), `ecriture` (lecture
    pour écrire, sous transaction et verrous), `agregat` (requête SQL dont périmètres et masques viennent de la porte),
    `dette` (lecture déjà gardée par droit de module, à migrer vers la porte). */
type Categorie = 'module' | 'porte' | 'systeme' | 'ecriture' | 'agregat' | 'dette';
interface Entree {
  categorie: Categorie;
  raison: string;
}

/** Préfixes autorisés en bloc : le module GRC porte les primitives de lecture (ADR 0083), la porte les compose. */
const PREFIXES: Record<string, Entree> = {
  'grc/': {
    categorie: 'module',
    raison: 'Module GRC : primitives de lecture et d’écriture (object, listObjects, links, registres…).',
  },
};

/** Fichiers autorisés hors du module GRC, chacun avec sa justification. */
const LISTE_BLANCHE: Record<string, Entree> = {
  'acces/portee.ts': { categorie: 'porte', raison: 'La porte de lecture elle-même.' },
  'conservation.ts': {
    categorie: 'systeme',
    raison: 'Aperçu et purge de conservation : opération système qui compte et supprime toutes les données échues.',
  },
  'controle-relations.ts': {
    categorie: 'systeme',
    raison:
      'Contrôle administrateur des références logiques de toute la base (lecture seule, tout est visible par construction).',
  },
  'documents-usage.ts': {
    categorie: 'systeme',
    raison: 'Garde de purge d’un document : doit voir toutes les citations, quel que soit le lecteur.',
  },
  'jeu-de-test.ts': { categorie: 'systeme', raison: 'Jeu de données de démonstration chargé par un administrateur.' },
  'legacy/store.ts': {
    categorie: 'systeme',
    raison:
      'Registre historique : recompose l’état brut depuis les tables ; la rédaction par lecteur se fait en aval (porte).',
  },
  'historique/ecarts-natifs.ts': {
    categorie: 'systeme',
    raison:
      'Mappeur natif des écarts du registre historique : projette les objets dans l’état brut, rédigé en aval par la porte.',
  },
  'historique/registre.ts': {
    categorie: 'ecriture',
    raison:
      'Création d’un écart et modifications déléguées sous verrou ; lecture déléguée non rédigée, filtrée par son appelant (ADR 0080).',
  },
  'tenacy.ts': {
    categorie: 'ecriture',
    raison:
      'Import Tenacy : recherche et écriture des écarts sous transaction et verrou de ligne, avec registres.exigerElement (ADR 0083, 2d).',
  },
  'routes/import.ts': {
    categorie: 'ecriture',
    raison:
      'Application et annulation d’un import sous verrou de l’état ; la simulation lit l’état rédigé par la porte.',
  },
  'routes/carto.ts': { categorie: 'ecriture', raison: 'Écritures de cartes sous verrou de l’état historique.' },
  'settings.ts': {
    categorie: 'ecriture',
    raison: 'Réglages (cycle, référentiels) : écriture des clés de l’état sous verrou.',
  },
  'pilotage/objectifs.ts': {
    categorie: 'ecriture',
    raison: 'Objectifs et indicateurs : lecture et écriture de l’état historique sous verrou et droit de module.',
  },
  'pilotage/service.ts': {
    categorie: 'agregat',
    raison:
      'Décisions de pilotage : écritures sous transaction ; masques et références lisibles viennent de la porte (2c).',
  },
  'pilotage/boites.ts': {
    categorie: 'agregat',
    raison: 'Boîtes de pilotage : agrégats SQL, masques du périmètre et état rédigé viennent de la porte (2c).',
  },
  'pilotage/processus-cartes.ts': {
    categorie: 'agregat',
    raison: 'Cartes de processus : agrégats SQL, masques et état rédigé viennent de la porte (2c).',
  },
  'pilotage/revue.ts': {
    categorie: 'agregat',
    raison: 'Revue de direction : agrégats SQL, masques et état rédigé viennent de la porte (2c).',
  },
  'routes/pilotage.ts': {
    categorie: 'agregat',
    raison: 'Export du registre de pilotage : masques et état rédigé viennent de la porte (2c).',
  },
  'tableau-de-bord.ts': {
    categorie: 'agregat',
    raison: 'Agrégats du tableau de bord : périmètres lisibles et masques viennent de la porte (2g).',
  },
  'config-grc.ts': {
    categorie: 'agregat',
    raison:
      'Catalogue de configuration : associe chaque consommateur à son périmètre ; le filtrage de visibilité passe par la porte (2e).',
  },
  'carto/sources.ts': {
    categorie: 'dette',
    raison: 'Sources de la cartographie : état historique filtré par droit de module ; à migrer vers la porte.',
  },
  'pilotage/legacy.ts': {
    categorie: 'dette',
    raison: 'Fiches historiques du pilotage : lecture après droit de module de la clé ; à migrer vers la porte.',
  },
  'pilotage/pestel.ts': {
    categorie: 'dette',
    raison: 'PESTEL : lecture de l’état après droit du module ; à migrer vers la porte.',
  },
  'routes/affichage.ts': {
    categorie: 'dette',
    raison: 'Synthèse de l’accueil et de l’écran mural : filtrée par droits ; à migrer vers la porte.',
  },
  'routes/settings.ts': {
    categorie: 'dette',
    raison: 'Réglage des référentiels : lecture d’une clé de l’état après contrôle ; à migrer vers la porte.',
  },
  'routes/suivi.ts': {
    categorie: 'dette',
    raison: 'État du suivi : rédigé par redactLegacy avec les droits de la session ; à migrer vers la porte.',
  },
};

/** Plafond des entrées « dette » : ce nombre ne doit pas augmenter ; une nouvelle lecture se branche sur la porte. */
const DETTE_MAX = 6;

const TABLES = 'grc_objects|grc_links|registres|registre_perimetres';
const KYSELY = new RegExp(
  `\\b(?:selectFrom|insertInto|updateTable|deleteFrom|innerJoin|leftJoin|rightJoin|fullJoin)\\(\\s*['"\`](?:public\\.)?(${TABLES})\\b`,
  'g',
);
const SQL_TEXTE = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+(?:public\\.)?(${TABLES})\\b`, 'gi');
const RECOMPOSE = /\brecompose\(/;

/** Retire les commentaires pour ne pas compter les mentions dans la documentation. */
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

function fichiers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [],
  );
}

function accesDirects() {
  const out = new Map<string, { tables: string[]; recompose: boolean }>();
  for (const f of fichiers(SRC)) {
    const t = sansCommentaires(readFileSync(f, 'utf8'));
    const tables = new Set<string>();
    for (const m of t.matchAll(KYSELY)) tables.add(m[1]!);
    for (const m of t.matchAll(SQL_TEXTE)) tables.add(m[1]!.toLowerCase());
    const recompose = RECOMPOSE.test(t);
    if (tables.size || recompose)
      out.set(path.relative(SRC, f).split(path.sep).join('/'), { tables: [...tables].sort(), recompose });
  }
  return out;
}

const autorise = (rel: string) => rel in LISTE_BLANCHE || Object.keys(PREFIXES).some((p) => rel.startsWith(p));

describe('architecture : accès directs aux données partagées entre modules', () => {
  const acces = accesDirects();

  it('aucun fichier hors liste blanche ne lit les tables GRC partagées ni l’état historique brut', () => {
    const intrus = [...acces.entries()]
      .filter(([rel]) => !autorise(rel))
      .map(([rel, a]) => `${rel} (${[...a.tables, ...(a.recompose ? ['recompose()'] : [])].join(', ')})`);
    expect(
      intrus,
      'Lire ces données passe par PorteeLecture (apps/api/src/acces/portee.ts, ADR 0083). Si l’accès direct est voulu, l’ajouter à la liste blanche avec sa raison.',
    ).toEqual([]);
  });

  it('chaque entrée de la liste blanche correspond à un accès réel (pas d’entrée périmée)', () => {
    const perimees = Object.keys(LISTE_BLANCHE).filter((rel) => !acces.has(rel));
    expect(perimees, 'Retirer ces entrées : le fichier n’accède plus directement à ces données.').toEqual([]);
    for (const p of Object.keys(PREFIXES)) expect([...acces.keys()].some((rel) => rel.startsWith(p))).toBe(true);
  });

  it('chaque entrée est justifiée et la dette reste plafonnée', () => {
    for (const [rel, e] of Object.entries(LISTE_BLANCHE)) expect(e.raison.length, rel).toBeGreaterThan(20);
    const dette = Object.entries(LISTE_BLANCHE).filter(([, e]) => e.categorie === 'dette');
    expect(dette.length).toBeLessThanOrEqual(DETTE_MAX);
  });

  it('la détection voit bien les accès (garde contre une analyse devenue aveugle)', () => {
    expect(acces.get('acces/portee.ts')?.recompose).toBe(true);
    expect(acces.get('grc/core.ts')?.tables).toEqual(expect.arrayContaining(['grc_objects', 'grc_links']));
    expect(acces.get('tableau-de-bord.ts')?.tables).toEqual(expect.arrayContaining(['grc_objects']));
    expect(acces.size).toBeGreaterThan(20);
  });
});
