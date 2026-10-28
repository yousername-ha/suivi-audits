/* Initialisation de la base au démarrage : migrations, état initial vide (référentiels seulement), jeton d'installation. */
import { readFileSync } from 'node:fs';
import { validLegacyState } from './routes/suivi.js';
import type { Services } from './services.js';

export async function seedState(svc: Services): Promise<boolean> {
  if (await svc.db.k.selectFrom('app_state').select('id').where('id', '=', 1).executeTakeFirst()) return false;
  try {
    const obj = JSON.parse(readFileSync(svc.cfg.seedFile, 'utf8'));
    if (!validLegacyState(obj)) throw new Error('structure inattendue');
    await svc.db.tx((c) => svc.legacy.nativeWrite(c, obj, null, null, 'Données initiales'), 'système');
    svc.log.info('state seeded');
    return true;
  } catch (e) {
    svc.log.warn({ err: (e as Error).message }, 'no initial state');
    return false;
  }
}

export async function prepareDatabase(svc: Services, opts: { issueToken?: boolean } = {}) {
  await svc.db.waitReady();
  await svc.db.migrate();
  await svc.businessPolicies.initialize();
  await svc.grc.initialize();
  await seedState(svc);
  await svc.settings.load();
  if (opts.issueToken !== false && !(await svc.auth.adminExists())) await svc.auth.issueSetupToken('first_start');
  // Installation existante : le poivre des mots de passe se définit dans l'administration (ADR 0072).
  if ((await svc.auth.adminExists()) && !(await svc.motsDePasse.defini()))
    svc.log.warn(
      'poivre non défini : un administrateur doit le définir (Administration, Configuration système, Sécurité)',
    );
}
