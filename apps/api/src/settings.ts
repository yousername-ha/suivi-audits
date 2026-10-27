/* Paramètres de l'application (page Paramètres) : une version par section, valeurs par défaut issues de la
   configuration (.env), cache en mémoire pour les réglages lus à chaque requête (sécurité, général, apparence),
   rechargé à chaque modification (y compris par une autre instance, via le temps réel). */
import {
  FENETRE_MAINTENANCE_DEFAUT,
  SETTINGS_SCHEMAS,
  SETTINGS_SECTIONS,
  type SettingsSection,
  type SettingsValues,
} from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import type { Config } from './config.js';
import { sql } from 'kysely';
import { surConnexion, type Client, type Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import type { LegacyStore } from './legacy/store.js';

/** Sections stockées dans la table settings ; les autres (cycle, référentiels) vivent dans l'état legacy. */
const STORED_SECTIONS = [
  'general',
  'apparence',
  'notifications',
  'import_export',
  'sauvegardes',
  'conservation',
  'courriel',
  'securite',
] as const;
type Stored = (typeof STORED_SECTIONS)[number];
const isStored = (s: SettingsSection): s is Stored => (STORED_SECTIONS as readonly string[]).includes(s);

const LEGACY_SECTION_KEYS = {
  cycle: ['years', 'yearLabels', 'nextYear', 'nextDate', 'internalDate', 'iso27001Certified'],
  referentiels: ['activeFw', 'entityCategory'],
} as const;

function settingsDefaults(cfg: Config): { [K in Stored]: SettingsValues[K] } {
  return {
    general: {
      appName: cfg.appName,
      orgName: cfg.orgName,
      adresse: '',
      telephone: '',
      email: '',
      site: '',
      rssi: '',
    },
    apparence: { theme: 'auto', densite: 'normale', style: 'sage' },
    notifications: { echeancesJours: 30, conventionJours: 90, alerterImports: true, alerterDroits: true },
    import_export: { formatRevue: 'xlsx' },
    sauvegardes: { emplacement: '/srv/sauvegardes/suivi-audits', dernierTestRestauration: '', frequenceTestMois: 12 },
    conservation: { documentsCorbeilleJours: null, rappelsLusJours: null, elementsArchivesJours: null },
    courriel: {
      actif: false,
      hote: '',
      port: 587,
      securite: 'starttls',
      utilisateur: '',
      expediteur: '',
      contactTechnique: '',
      relanceEssais: 5,
      relanceDelaiMinutes: 10,
      autoriteCertification: '',
    },
    securite: {
      passwordMinLength: Math.max(12, cfg.passwordMinLength),
      sessionIdleMinutes: Math.min(240, Math.max(5, cfg.session.idleMinutes)),
      sessionMaxHours: Math.min(24, Math.max(1, cfg.session.maxHours)),
      lockoutThreshold: Math.min(10, Math.max(3, cfg.lockout.threshold)),
      lockoutMinutes: Math.min(1440, Math.max(5, cfg.lockout.minutes)),
      mfaRequired: true,
      fenetreMaintenance: { ...FENETRE_MAINTENANCE_DEFAUT, jours: [...FENETRE_MAINTENANCE_DEFAUT.jours] },
    },
  };
}

const key = (s: Stored) => `section:${s}`;

export class Settings {
  private cache: { [K in Stored]: SettingsValues[K] };
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly legacy: LegacyStore,
  ) {
    this.cache = settingsDefaults(cfg);
  }

  /** Charge les sections enregistrées (au démarrage, puis à chaque événement « settings »). */
  async load() {
    const defaults = settingsDefaults(this.cfg);
    const r = await this.db.k
      .selectFrom('settings')
      .select(['key', 'value'])
      .where('key', 'like', 'section:%')
      .execute();
    const next = { ...defaults } as Record<Stored, unknown>;
    for (const ligne of r) {
      const row = ligne as { key: string; value: { values: unknown } };
      const s = row.key.slice('section:'.length) as Stored;
      if (!(STORED_SECTIONS as readonly string[]).includes(s)) continue;
      const parsed = SETTINGS_SCHEMAS[s].safeParse({ ...defaults[s], ...(row.value.values as object) });
      if (parsed.success) next[s] = parsed.data;
    }
    this.cache = next as typeof this.cache;
  }

  /** Réglages courants (synchrone : utilisés à chaque requête). */
  get<K extends Stored>(s: K): SettingsValues[K] {
    return this.cache[s] as SettingsValues[K];
  }

  /** Lecture d'une section avec sa version. */
  async read(
    s: SettingsSection,
    c?: Pick<Client, 'query'>,
  ): Promise<{ values: Record<string, unknown>; version: number }> {
    if (isStored(s)) {
      const r = await (c ? surConnexion(c) : this.db.k)
        .selectFrom('settings')
        .select('value')
        .where('key', '=', key(s))
        .executeTakeFirst();
      const row = r?.value as { values: unknown; version: number } | undefined;
      const values = SETTINGS_SCHEMAS[s].safeParse({
        ...settingsDefaults(this.cfg)[s],
        ...((row?.values as object) ?? {}),
      });
      return { values: values.success ? values.data : settingsDefaults(this.cfg)[s], version: row?.version ?? 0 };
    }
    const st = await this.legacy.recompose(c as Client | undefined);
    const d = (st?.data ?? {}) as JsonObject;
    const keys = LEGACY_SECTION_KEYS[s];
    const raw = Object.fromEntries(keys.map((k) => [k, d[k]]));
    const values =
      s === 'cycle'
        ? {
            years: Array.isArray(raw.years) ? raw.years : [],
            yearLabels: raw.yearLabels && typeof raw.yearLabels === 'object' ? raw.yearLabels : {},
            nextYear: typeof raw.nextYear === 'number' ? raw.nextYear : null,
            nextDate: typeof raw.nextDate === 'string' ? raw.nextDate : '',
            internalDate: typeof raw.internalDate === 'string' ? raw.internalDate : '',
            iso27001Certified: raw.iso27001Certified === true,
          }
        : {
            activeFw: typeof raw.activeFw === 'string' ? raw.activeFw : '',
            entityCategory: typeof raw.entityCategory === 'string' ? raw.entityCategory : '',
          };
    return { values, version: st?.version ?? 0 };
  }

  /** Enregistrement d'une section (dans la transaction « c ») ; 412 si la version a changé. */
  async write(
    c: Client,
    s: SettingsSection,
    input: unknown,
    expected: number,
    user: { id?: string; username: string },
  ): Promise<{ before: Record<string, unknown>; after: Record<string, unknown>; version: number }> {
    const parsed = SETTINGS_SCHEMAS[s].safeParse(input);
    if (!parsed.success)
      throw new HttpError(422, parsed.error.issues.map((i) => `${i.path.join('.') || s} : ${i.message}`).join(' ; '));
    const after = parsed.data as Record<string, unknown>;
    const k = surConnexion(c);
    if (isStored(s)) {
      await k
        .insertInto('settings')
        .values({ key: key(s), value: '{"values": {}, "version": 0}' })
        .onConflict((oc) => oc.doNothing())
        .execute();
      const cur = (
        await k.selectFrom('settings').select('value').where('key', '=', key(s)).forUpdate().executeTakeFirstOrThrow()
      ).value as { values: Record<string, unknown>; version: number };
      const before = (await this.read(s, c)).values;
      if ((cur.version ?? 0) !== expected) throw conflictError(cur.version ?? 0, before);
      const version = (cur.version ?? 0) + 1;
      await k
        .updateTable('settings')
        .set({
          value: JSON.stringify({ values: after, version, updatedBy: user.username }),
          updated_at: sql<Date>`now()`,
        })
        .where('key', '=', key(s))
        .execute();
      return { before, after, version };
    }
    // Cycle et référentiels : écriture des clés correspondantes de l'état legacy (contrôle de version de l'état).
    await k.selectFrom('app_state').select('id').where('id', '=', 1).forUpdate().execute();
    const st = await this.legacy.recompose(c);
    if (!st) throw new HttpError(404, 'Aucune donnée.');
    const before = (await this.read(s, c)).values;
    if (st.version !== expected) throw conflictError(st.version, before);
    const data: JsonObject = { ...st.data };
    for (const k of LEGACY_SECTION_KEYS[s]) {
      const v = after[k];
      if (v === null || v === '') delete data[k];
      else data[k] = v as JsonObject[string];
    }
    const r = await this.legacy.nativeWrite(c, data, user, st.version, `Paramètres : ${s}`);
    if (r.conflict) throw conflictError(r.version, before);
    return { before, after, version: r.version };
  }
}

function conflictError(version: number, current: Record<string, unknown>) {
  return new HttpError(412, 'Ces paramètres ont été modifiés par ailleurs. Rechargez la section.', {
    current: { values: current, version },
  });
}

export { SETTINGS_SECTIONS };
