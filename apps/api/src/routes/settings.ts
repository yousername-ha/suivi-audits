/* Page Paramètres : lecture et enregistrement par section (permission « paramètres »), logo de l'organisation. */
import {
  SETTINGS_SECTIONS,
  SETTINGS_WRITE,
  SettingsSectionOut,
  type SettingsSection,
  type SettingsValues,
} from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import type { Rights } from '@suivi/shared';
import type { Services } from '../services.js';

const SectionParams = z.object({ section: z.enum(SETTINGS_SECTIONS) });

/** Droits d'écriture d'une section : sa permission, plus le module métier pour les sections tirées de l'outil historique. */
function writePermissions(s: SettingsSection) {
  return [
    SETTINGS_WRITE[s],
    ...(s === 'cycle' ? (['audit:modifier'] as const) : s === 'referentiels' ? (['conformite:modifier'] as const) : []),
  ];
}
const canWrite = (rights: Rights, s: SettingsSection) => writePermissions(s).every((p) => rights.has(p));

async function info(svc: Services, s: SettingsSection, values: Record<string, unknown>) {
  switch (s) {
    case 'general':
      return { logo: !!(await svc.db.one("SELECT 1 FROM settings WHERE key = 'logo'")) };
    case 'referentiels': {
      const d = ((await svc.legacy.recompose())?.data ?? {}) as JsonObject;
      const items = Array.isArray(d.items) ? (d.items as JsonObject[]) : [];
      const count = (ref: string) => items.filter((i) => i.ref === ref).length;
      const fws = Array.isArray(d.frameworks) ? (d.frameworks as JsonObject[]) : [];
      return {
        referentiels: [
          { nom: 'ISO/IEC 27001 (clauses 4 à 10)', exigences: count('ISO') },
          { nom: 'ISO/IEC 27001, Annexe A', exigences: count('A') },
          { nom: 'Hébergeur de données de santé (HDS)', exigences: count('HDS') },
        ],
        complementaires: fws.map((f) => ({
          nom: String(f.name ?? f.id ?? ''),
          exigences: Array.isArray(f.requirements) ? f.requirements.length : 0,
        })),
      };
    }
    case 'import_export': {
      const n = await svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM import_batches');
      return { tailleMaxImportMo: svc.cfg.maxImportMb, imports: n?.n ?? 0 };
    }
    case 'sauvegardes': {
      const v = values as SettingsValues['sauvegardes'];
      if (!v.dernierTestRestauration) return { prochainTest: '', enRetard: true };
      const next = new Date(v.dernierTestRestauration);
      next.setMonth(next.getMonth() + v.frequenceTestMois);
      return { prochainTest: next.toISOString().slice(0, 10), enRetard: next < new Date() };
    }
    case 'securite':
      return { mfaObligatoire: true };
    default:
      return {};
  }
}

async function sectionOut(svc: Services, s: SettingsSection, rights: Rights): Promise<SettingsSectionOut> {
  if (s === 'cycle') await svc.modules.assert('audit');
  if (s === 'referentiels') {
    await svc.modules.assert('audit');
    await svc.modules.assert('conformite');
  }
  if (s === 'import_export') await svc.modules.assert('import_export');
  const { values, version } = await svc.settings.read(s);
  return { section: s, values, version, canWrite: canWrite(rights, s), info: await info(svc, s, values) };
}

const LOGO_MAX = 256 * 1024;
const LOGO_TYPES: [string, Buffer][] = [
  ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
];

export const settingsRoutes = [
  route({
    method: 'GET',
    url: '/api/settings',
    summary: 'Paramètres : toutes les sections, avec leur version et le droit d’écriture',
    tags: ['Paramètres'],
    access: 'parametres:lire',
    response: z.array(SettingsSectionOut),
    handler: async ({ svc, s }) => {
      const disabled = (await svc.modules.state()).disabled;
      const visible = SETTINGS_SECTIONS.filter((x) => x !== 'cycle' || !disabled.includes('audit'))
        .filter((x) => x !== 'referentiels' || (!disabled.includes('audit') && !disabled.includes('conformite')))
        .filter((x) => x !== 'import_export' || !disabled.includes('import_export'));
      return Promise.all(visible.map((x) => sectionOut(svc, x, (s as Session).user.rights)));
    },
  }),
  route({
    method: 'GET',
    url: '/api/settings/:section',
    summary: 'Paramètres : une section (ETag = version)',
    tags: ['Paramètres'],
    access: 'parametres:lire',
    params: SectionParams,
    response: SettingsSectionOut,
    handler: async ({ svc, s, params, reply }) => {
      const out = await sectionOut(svc, params.section, (s as Session).user.rights);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/settings/:section',
    summary: 'Paramètres : enregistrement d’une section (If-Match obligatoire ; Sécurité : parametres:administrer)',
    tags: ['Paramètres'],
    access: 'parametres:modifier',
    params: SectionParams,
    body: z.record(z.string(), z.unknown()),
    response: SettingsSectionOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      if (params.section === 'cycle') await svc.modules.assert('audit');
      if (params.section === 'referentiels') {
        await svc.modules.assert('audit');
        await svc.modules.assert('conformite');
      }
      if (params.section === 'import_export') await svc.modules.assert('import_export');
      for (const p of writePermissions(params.section)) svc.auth.requirePermission(sess, p);
      const expected = requireIfMatch(req);
      const r = await svc.db.tx(
        (c) => svc.settings.write(c, params.section, body, expected, sess.user),
        sess.user.username,
      );
      await svc.settings.load();
      await svc.db.audit(sess.user, ip, 'settings.update', params.section, {
        before: r.before,
        after: r.after,
        version: r.version,
      });
      const out = await sectionOut(svc, params.section, sess.user.rights);
      setEtag(reply, out.version);
      return out;
    },
  }),

  /* ---------------------------------------------------------------- Logo */
  route({
    method: 'GET',
    url: '/api/settings/logo',
    summary: 'Logo de l’organisation (PNG ou JPEG), affiché aussi sur la page de connexion',
    tags: ['Paramètres'],
    access: 'public',
    handler: async ({ svc, reply }) => {
      const r = await svc.db.one<{ value: { mime: string; data: string } }>(
        "SELECT value FROM settings WHERE key = 'logo'",
      );
      if (!r) throw new HttpError(404, 'Aucun logo.');
      reply
        .header('Content-Type', r.value.mime)
        .header('Cache-Control', 'no-cache')
        .header('Content-Security-Policy', "default-src 'none'; sandbox");
      return reply.send(Buffer.from(r.value.data, 'base64'));
    },
  }),
  route({
    method: 'PUT',
    url: '/api/settings/logo',
    summary: 'Dépôt du logo (PNG ou JPEG, 256 Ko au plus)',
    tags: ['Paramètres'],
    access: 'parametres:modifier',
    raw: true,
    bodyLimit: LOGO_MAX,
    handler: async ({ svc, s, ip, body }) => {
      const buf = body as unknown as Buffer;
      const type = LOGO_TYPES.find(([, sig]) => buf.subarray(0, sig.length).equals(sig));
      if (!type) throw new HttpError(422, 'Logo refusé : seules les images PNG et JPEG sont acceptées.');
      await svc.db.tx(
        (c) =>
          c.query(
            `INSERT INTO settings(key, value) VALUES ('logo', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [{ mime: type[0], data: buf.toString('base64') }],
          ),
        (s as Session).user.username,
      );
      await svc.db.audit((s as Session).user, ip, 'settings.logo', type[0], { size: buf.length });
      return undefined;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/settings/logo',
    summary: 'Retrait du logo',
    tags: ['Paramètres'],
    access: 'parametres:modifier',
    handler: async ({ svc, s, ip }) => {
      await svc.db.tx((c) => c.query("DELETE FROM settings WHERE key = 'logo'"), (s as Session).user.username);
      await svc.db.audit((s as Session).user, ip, 'settings.logo_delete');
      return undefined;
    },
  }),
];
