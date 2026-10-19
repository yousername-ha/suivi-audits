/* Exploitation (EXPL-04, EXPL-05) : migrations en attente, état du serveur lu dans DATA_DIR/etat (rapports écrits
   par les scripts du serveur : mises à jour, sauvegardes, version disponible), espace disque.
   L'application lit ce dossier en lecture seule ; elle n'a aucun accès Internet et n'installe jamais rien. */
import { readdirSync, readFileSync, statfsSync } from 'node:fs';
import path from 'node:path';
import type { Config } from './config.js';
import { MIGRATIONS_DIR, type Db } from './db/db.js';

/** Fichiers de migration présents dans l'image, triés. */
export function migrationFiles(dir = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
}

/** Migrations présentes dans l'image mais pas encore appliquées à la base. */
export async function pendingMigrations(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  const exists = await db.one<{ t: string | null }>("SELECT to_regclass('schema_migrations')::text AS t");
  const applied = new Set(
    exists?.t ? (await db.q<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name) : [],
  );
  return migrationFiles(dir).filter((f) => !applied.has(f));
}

export async function lastMigration(db: Db): Promise<string | null> {
  const r = await db.one<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');
  return r?.name ?? null;
}

/** Comparaison de versions X.Y.Z (les suffixes éventuels sont ignorés). */
export function compareVersions(a: string, b: string): number {
  const p = (v: string) => (/^v?(\d+)\.(\d+)\.(\d+)/.exec(v) ?? []).slice(1, 4).map(Number);
  const [x, y] = [p(a), p(b)];
  if (x.length !== 3 || y.length !== 3) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! < y[i]! ? -1 : 1;
  return 0;
}

const readJson = (f: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(readFileSync(f, 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export interface MiseAJour {
  fichier: string;
  date: string;
  depuis: string;
  vers: string;
  resultat: string;
  dureeSecondes: number | null;
  migrations: string[];
  message: string;
}

/** Rapports de mise à jour (DATA_DIR/etat/mises-a-jour/*.json), du plus récent au plus ancien. */
export function readUpdates(etatDir: string, max = 20): MiseAJour[] {
  const dir = path.join(etatDir, 'mises-a-jour');
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^[\w.-]+\.json$/.test(f));
  } catch {
    return [];
  }
  return files
    .sort()
    .reverse()
    .slice(0, max)
    .map((f) => {
      const r = readJson(path.join(dir, f)) ?? {};
      return {
        fichier: f,
        date: str(r.date),
        depuis: str(r.depuis),
        vers: str(r.vers),
        resultat: str(r.resultat) || 'inconnu',
        dureeSecondes: typeof r.dureeSecondes === 'number' ? r.dureeSecondes : null,
        migrations: Array.isArray(r.migrations) ? r.migrations.map(str) : [],
        message: str(r.message),
      };
    });
}

export const BACKUP_MAX_AGE_HOURS = 48;

export function systemStatus(cfg: Config, now = new Date()) {
  const etat = cfg.etatDir;
  const derniere = readJson(path.join(etat, 'sauvegardes', 'derniere.json'));
  const reussie = readJson(path.join(etat, 'sauvegardes', 'derniere-reussie.json'));
  const dispo = readJson(path.join(etat, 'version-disponible.json'));
  const ageH = reussie?.date ? (now.getTime() - new Date(str(reussie.date)).getTime()) / 3600e3 : null;
  let disque: { libreOctets: number; totalOctets: number } | null;
  try {
    const s = statfsSync(etat);
    disque = { libreOctets: s.bavail * s.bsize, totalOctets: s.blocks * s.bsize };
  } catch {
    disque = null;
  }
  const derniereVersion = dispo ? str(dispo.derniere) : '';
  return {
    version: cfg.version,
    donnees: { chemin: cfg.dataDirHote, disque },
    misesAJour: readUpdates(etat),
    sauvegarde: {
      derniere: derniere
        ? { date: str(derniere.date), resultat: str(derniere.resultat), fichier: str(derniere.fichier) }
        : null,
      derniereReussie: reussie
        ? {
            date: str(reussie.date),
            fichier: str(reussie.fichier),
            tailleOctets: typeof reussie.tailleOctets === 'number' ? reussie.tailleOctets : null,
            chiffree: reussie.chiffree === true,
          }
        : null,
      ageHeures: ageH == null || Number.isNaN(ageH) ? null : Math.round(ageH * 10) / 10,
      enRetard: ageH == null || Number.isNaN(ageH) || ageH > BACKUP_MAX_AGE_HOURS,
    },
    versionDisponible: dispo
      ? {
          derniere: derniereVersion,
          verifieeLe: str(dispo.verifieeLe),
          notes: str(dispo.notes),
          nouvelle: !!derniereVersion && compareVersions(cfg.version, derniereVersion) < 0,
        }
      : null,
  };
}
export type SystemStatus = ReturnType<typeof systemStatus>;
