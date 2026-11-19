/* Commandes d'exploitation :  docker compose exec app suivi <commande> [arguments]
     users                       liste les comptes
     setup-token [--recovery]    nouveau jeton d'installation, annule le précédent (--recovery : administrateur de secours)
     reset-password <compte>     mot de passe temporaire (changement imposé à la connexion)
     reset-mfa <compte>          réinitialise la double authentification (téléphone perdu)
     unlock <compte>             déverrouille un compte
     disable <compte> | enable <compte>
     sessions-purge              ferme toutes les sessions
     migrate                     applique les migrations en attente
     migrations [--a-appliquer]  migrations appliquées, ou seulement celles en attente (script de mise à jour)
     controle-donnees            nombres d'enregistrements, empreinte de l'état, relecture de chaque document chiffré
     controle-relations [--anomalies]  références logiques entre objets (JSON, ou une ligne par anomalie)
     jeu-de-test <compte> --confirmer  charge un jeu de données fictif et cohérent (instance de test vide uniquement)
     backup-worker [ready|unavailable] annonce l'état de l'exécutant serveur
     backup-claim               réclame une demande (verrou hôte obligatoire)
     backup-finish <id> <code>   termine une demande avec le rapport serveur
     backup-secours             clés publiques de secours des sauvegardes (une par ligne)
     site-adresse               adresse du site demandée dans l'application
     backup-secours-realigner | site-adresse-realigner  après une restauration : réaligne l'application sur l'hôte (JSON sur l'entrée standard)
     mail-claim | mail-finish <id>  courriels : réclame une demande, rapporte l'envoi (JSON sur l'entrée standard)
     integrations-claim | integrations-lot <id> | integrations-finish <id>  connecteurs : réclame une exécution, rapporte un lot (synchronisation), son résultat (JSON sur l'entrée standard)
     veille-claim | veille-lot <id> | veille-finish <id>  veille des vulnérabilités : réclame une collecte, rapporte un lot, la termine (JSON sur l'entrée standard)
     flux-souhaites              flux vers l'extérieur voulus ouverts (JSON, ADR 0097)
     flux-appliques              état appliqué de chaque flux, rapporté par l'exécutant (JSON sur l'entrée standard)
     flux-reprise                reprise des modules en service jamais décidés (JSON sur l'entrée standard), puis flux voulus ouverts
     ops-policy | ops-sync [date] | ops-claim  protocole hôte (jamais HTTP)
  ops-request | ops-certificate  JSON privé sur entrée standard
  ops-schedule <UUID>         demande planifiée (verrou hôte)
  consigner-mise-a-jour       consigne au journal d'audit le rapport de mise à jour lu sur l'entrée standard
  charger-jeu <compte> --confirmer  instance de test vide : charge un jeu de données JSON lu sur l'entrée standard
  recette-locale              poste de test sur localhost : crée le compte administrateur sans assistant d'installation
  poivre-restaurer            reprend le poivre des mots de passe (texte sur l'entrée standard) après perte de la clé maîtresse
  poivre-reinitialiser --confirmer  URGENCE, poivre perdu : nouveau poivre, mots de passe temporaires pour tous les comptes
   Raccourci : docker compose exec app setup-token                                                                */
import crypto from 'node:crypto';
import {
  FluxAppliques,
  FluxReprise,
  formaterPoivreGenere,
  LotSynchronisation,
  LotVeille,
  RapportCollecte,
  RapportExecution,
  type SettingsValues,
} from '@suivi/shared';
import { sql } from 'kysely';
import { z } from 'zod';
import { certificateInfo } from './certificates.js';
import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { tempPassword } from './security/crypto.js';
import { createServices, type Services } from './services.js';
import { controleRelations } from './controle-relations.js';
import { pendingMigrations } from './systeme.js';

const HELP = `Commandes : docker compose exec app suivi <commande> [arguments]
  users                       liste les comptes
  setup-token [--recovery]    nouveau jeton d'installation, annule le précédent (--recovery : administrateur de secours)
  reset-password <compte>     mot de passe temporaire (changement imposé à la connexion)
  reset-mfa <compte>          réinitialise la double authentification (téléphone perdu)
  unlock <compte>             déverrouille un compte
  disable <compte> | enable <compte>
  sessions-purge              ferme toutes les sessions
  migrate                     applique les migrations en attente
  migrations [--a-appliquer]  migrations appliquées, ou seulement celles en attente
  controle-donnees            nombres d'enregistrements, empreinte de l'état, relecture des documents chiffrés (JSON)
  jeu-de-test <compte> --confirmer  charge un jeu de données fictif et cohérent, au nom d'un administrateur (instance de test vide uniquement)
  backup-worker [ready|unavailable] état du worker serveur
  backup-claim               réclame une demande (verrou hôte obligatoire)
  backup-finish <id> <code>   termine une demande avec son rapport
  backup-secours             clés publiques de secours des sauvegardes
  site-adresse               adresse du site demandée
  backup-secours-realigner | site-adresse-realigner  après une restauration : réaligne l'application sur l'hôte (JSON sur l'entrée standard)
  mail-claim | mail-finish <id>  courriels : réclame une demande, rapporte l'envoi (JSON sur l'entrée standard)
  integrations-claim | integrations-lot <id> | integrations-finish <id>  connecteurs : réclame une exécution, rapporte un lot (synchronisation), son résultat (JSON sur l'entrée standard)
  veille-claim | veille-lot <id> | veille-finish <id>  veille des vulnérabilités : réclame une collecte, rapporte un lot, la termine (JSON sur l'entrée standard)
  flux-souhaites              flux vers l'extérieur voulus ouverts (JSON)
  flux-appliques              état appliqué de chaque flux, rapporté par l'exécutant (JSON sur l'entrée standard)
  flux-reprise                modules en service jamais décidés enregistrés ouverts (JSON sur l'entrée standard), puis flux voulus ouverts
  ops-policy | ops-sync [date] | ops-claim  protocole hôte (jamais HTTP)
  ops-request | ops-certificate  JSON privé sur entrée standard
  ops-schedule <UUID>         demande planifiée (verrou hôte)
  consigner-mise-a-jour       consigne au journal d'audit un rapport de mise à jour (JSON sur l'entrée standard)
  poivre-restaurer            reprend le poivre des mots de passe (texte sur l'entrée standard) après perte de la clé maîtresse
  poivre-reinitialiser --confirmer  URGENCE, poivre perdu : nouveau poivre, mots de passe temporaires pour tous les comptes`;

async function main() {
  const [cmd, arg, extra] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(HELP);
    process.exit(cmd ? 0 : 2);
  }
  const svc = createServices(loadConfig(), createLogger('warn'));
  const SYS = { username: 'cli' };
  const user = async (name?: string) => {
    const u = await svc.db.k
      .selectFrom('users')
      .select(['id', 'username'])
      .where(sql`lower(username)`, '=', sql`lower(${name || ''})`)
      .executeTakeFirst();
    if (!u) {
      console.error(`Compte inconnu : ${name ?? ''}`);
      process.exit(1);
    }
    return u;
  };
  await svc.db.waitReady(5);
  switch (cmd) {
    case 'update-sync': {
      await svc.updates.synchronize();
      break;
    }
    case 'update-drain': {
      // Attend la fin de l'exécutant en prenant puis rendant son verrou consultatif : appel SQL direct (ADR 0062 §5).
      const c = await svc.db.pool.connect();
      try {
        await c.query('SELECT pg_advisory_lock(727276)');
        await c.query('SELECT pg_advisory_unlock(727276)');
      } finally {
        c.release();
      }
      break;
    }
    case 'update-claim': {
      const job = await svc.updates.claim();
      if (job) console.log(JSON.stringify(job));
      break;
    }
    case 'update-finish': {
      await svc.updates.finish(arg ?? '', extra ?? '');
      break;
    }
    case 'backup-worker': {
      if (!['ready', 'unavailable'].includes(arg ?? '')) throw new Error('État worker invalide.');
      await svc.backups.heartbeat(arg === 'ready');
      break;
    }
    case 'backup-claim': {
      const id = await svc.backups.claim();
      if (id) console.log(id);
      break;
    }
    case 'backup-secours': {
      // Clés publiques de secours (ADR 0077), une par ligne, pour le fichier de l'exécutant des sauvegardes.
      for (const cle of await svc.cleSecours.publiques()) console.log(cle);
      break;
    }
    case 'backup-secours-realigner': {
      // Après une restauration, l'hôte fait foi : la clé de secours de l'archive restaurée ne redevient pas destinataire.
      const { keys } = z
        .object({ keys: z.array(z.string()).min(1).max(10) })
        .strict()
        .parse(JSON.parse(await readStdin()));
      await svc.cleSecours.inscrire(svc.db.k, keys[0]!, 'restauration');
      await svc.db.audit(null, '', 'sauvegarde.cle_secours_realignee', '', {});
      break;
    }
    case 'site-adresse-realigner': {
      const { adresse } = z
        .object({ adresse: z.string() })
        .strict()
        .parse(JSON.parse(await readStdin()));
      await svc.adresseSite.demander(svc.db.k, adresse, 'restauration');
      await svc.db.audit(null, '', 'exploitation.adresse_site_realignee', adresse, {});
      break;
    }
    case 'site-adresse': {
      // Adresse du site demandée dans l'application (ADR 0077), à appliquer par l'exécutant ; rien si aucune demande.
      const a = await svc.adresseSite.demandee();
      if (a) console.log(a);
      break;
    }
    case 'backup-finish': {
      if (!arg || !extra || !/^\d{1,3}$/.test(extra)) throw new Error('Identifiant et code requis.');
      await svc.backups.finish(arg, Number(extra));
      break;
    }
    case 'mail-claim': {
      const job = await svc.courriel.reclamer(
        (await svc.settings.read('courriel')).values as SettingsValues['courriel'],
      );
      if (job) console.log(JSON.stringify(job));
      break;
    }
    case 'mail-finish': {
      await svc.courriel.terminer(
        arg ?? '',
        JSON.parse(await readStdin()),
        (await svc.settings.read('courriel')).values as SettingsValues['courriel'],
      );
      break;
    }
    case 'integrations-claim': {
      // Connecteurs du module Intégrations (ADR 0076) : module désactivé ou flux du type fermé, rien n'est remis. Une
      // synchronisation dont le module destinataire (Vulnérabilités) est désactivé est close sans appel.
      const { disabled } = await svc.modules.state(true);
      const job = await svc.integrations.reclamer(!disabled.includes('integrations'), disabled);
      if (job) console.log(JSON.stringify(job));
      break;
    }
    case 'integrations-lot': {
      // Lot d'une synchronisation (ADR 0100, lot V5), validé strictement : taille bornée, champ inattendu ou élément mal formé
      // refusés (code 2, rien n'est écrit) ; exécution close ou sans envoi par lots : code 1.
      const brut = await readStdin(INTEGRATIONS_LOT_MAX);
      let valeur: unknown;
      try {
        valeur = brut === null ? null : JSON.parse(brut);
      } catch {
        valeur = null;
      }
      const p = LotSynchronisation.safeParse(valeur);
      if (!z.uuid().safeParse(arg).success || !p.success) {
        console.error('Lot refusé : identifiant, taille ou contenu invalide.');
        process.exit(2);
      }
      try {
        console.log(JSON.stringify(await svc.integrations.lot(arg!, p.data.elements)));
      } catch (e) {
        console.error((e as Error).message);
        process.exit((e as { status?: number }).status === 422 ? 2 : 1);
      }
      break;
    }
    case 'integrations-finish': {
      // Rapport de l'exécutant, validé strictement : champ inattendu, erreur sur plusieurs lignes ou résultat absent refusés.
      let brut: unknown;
      try {
        brut = JSON.parse(await readStdin());
      } catch {
        console.error('Rapport illisible : JSON attendu sur l’entrée standard.');
        process.exit(2);
      }
      const p = RapportExecution.safeParse(brut);
      if (!z.uuid().safeParse(arg).success || !p.success) {
        console.error('Rapport refusé : identifiant ou contenu invalide.');
        process.exit(2);
      }
      await svc.integrations.terminer(arg!, p.data);
      break;
    }
    case 'veille-claim': {
      // Veille des vulnérabilités (ADR 0100, lots V2 et V3) : module désactivé ou flux fermé, rien n'est remis.
      const actif = !(await svc.modules.state(true)).disabled.includes('vulnerabilites');
      const job = await svc.vulnerabilites.veille.reclamer(actif);
      if (job) console.log(JSON.stringify(job));
      break;
    }
    case 'veille-lot':
    case 'veille-finish': {
      // Lot ou bilan de l'exécutant, validé strictement (taille bornée, champ inattendu ou élément mal formé refusés).
      const brut = await readStdin(VEILLE_ENTREE_MAX);
      let valeur: unknown;
      try {
        valeur = brut === null ? null : JSON.parse(brut);
      } catch {
        valeur = null;
      }
      const schema = cmd === 'veille-lot' ? LotVeille : RapportCollecte;
      if (!z.uuid().safeParse(arg).success || valeur === null || !schema.safeParse(valeur).success) {
        console.error('Envoi refusé : identifiant, taille ou contenu invalide.');
        process.exit(2);
      }
      try {
        if (cmd === 'veille-lot') console.log(JSON.stringify(await svc.vulnerabilites.veille.lot(arg!, valeur)));
        else await svc.vulnerabilites.veille.terminer(arg!, valeur);
      } catch (e) {
        // Lot refusé (élément mal formé : 422) : code 2, comme un envoi invalide ; collecte close (409) : code 1.
        console.error((e as Error).message);
        process.exit((e as { status?: number }).status === 422 ? 2 : 1);
      }
      break;
    }
    case 'flux-souhaites': {
      // Flux vers l'extérieur (ADR 0097) : l'exécutant ouvre ceux-ci et ferme tous les autres modules du registre.
      console.log(JSON.stringify(await svc.flux.souhaites()));
      break;
    }
    case 'flux-appliques': {
      // Rapport de l'exécutant, validé strictement : module inconnu, champ inattendu ou erreur mal formée refusés.
      let brut: unknown;
      try {
        brut = JSON.parse(await readStdin());
      } catch {
        console.error('Rapport illisible : JSON attendu sur l’entrée standard.');
        process.exit(2);
      }
      const p = FluxAppliques.safeParse(brut);
      if (!p.success) {
        console.error(
          `Rapport refusé : ${p.error.issues.map((i) => `${i.path.join('.') || '(racine)'} ${i.message}`).join(' ; ')}`,
        );
        process.exit(2);
      }
      console.log(JSON.stringify({ modules: await svc.flux.appliquer(p.data) }));
      break;
    }
    case 'flux-reprise': {
      // Reprise de l'existant (précision du RSSI du 16/11/2026) : l'exécutant déclare les modules réellement en service sur
      // le serveur, avec le motif constaté, AVANT toute fermeture. Un module jamais décidé est enregistré ouvert ; un module
      // déjà décidé n'est jamais touché. Entrée validée strictement ; la sortie est celle de « flux-souhaites ».
      let brut: unknown;
      try {
        brut = JSON.parse(await readStdin());
      } catch {
        console.error('Reprise illisible : JSON attendu sur l’entrée standard.');
        process.exit(2);
      }
      const p = FluxReprise.safeParse(brut);
      if (!p.success) {
        console.error(
          `Reprise refusée : ${p.error.issues.map((i) => `${i.path.join('.') || '(racine)'} ${i.message}`).join(' ; ')}`,
        );
        process.exit(2);
      }
      await svc.flux.reprendre(p.data.enService, 'executant');
      console.log(JSON.stringify(await svc.flux.souhaites()));
      break;
    }
    case 'ops-policy': {
      console.log(JSON.stringify(await svc.operations.policy()));
      break;
    }
    case 'ops-sync': {
      await svc.operations.synchronize(arg || null);
      // Espace disque (ADR 0106) : alerte aux administrateurs au franchissement du seuil ; ne fait jamais échouer la synchronisation.
      await svc.alertesSecurite.espaceDisque(svc.operations.disqueHote());
      break;
    }
    case 'ops-claim': {
      const job = await svc.operations.claim();
      if (job) console.log(JSON.stringify(job));
      break;
    }
    case 'ops-request': {
      console.log(
        JSON.stringify(
          await svc.operations.request(JSON.parse(await readStdin()), { username: 'exploitation serveur' }, null),
        ),
      );
      break;
    }
    case 'ops-schedule': {
      z.string().uuid().parse(arg);
      console.log(JSON.stringify(await svc.backups.schedule(arg!)));
      break;
    }
    case 'ops-certificate': {
      const p = z
        .object({ pem: z.string().max(65536), privateKey: z.string().max(16384).optional() })
        .strict()
        .parse(JSON.parse(await readStdin()));
      console.log(JSON.stringify(certificateInfo(p.pem, new URL(svc.cfg.publicUrl).hostname, p.privateKey)));
      break;
    }
    case 'users': {
      const r = await svc.db.k
        .selectFrom('users as u')
        .select([
          'u.username',
          'u.disabled',
          'u.totp_enabled',
          'u.locked_until',
          'u.last_login_at',
          'u.expires_at',
          sql<
            string | null
          >`(SELECT string_agg(r.name, ', ' ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id)`.as('roles'),
        ])
        .orderBy(sql`lower(u.username)`)
        .execute();
      console.table(
        r.map((u) => ({
          compte: u.username,
          roles: u.roles ?? '',
          expiration: u.expires_at ? new Date(u.expires_at).toISOString().slice(0, 10) : '',
          actif: !u.disabled,
          mfa: u.totp_enabled,
          verrouillé: !!(u.locked_until && u.locked_until > new Date()),
          derniere_connexion: u.last_login_at?.toISOString() ?? null,
        })),
      );
      break;
    }
    case 'recette-locale': {
      // Poste de test seulement : premier administrateur créé sans assistant, refusé hors de « localhost ».
      const { buildApp } = await import('./app.js');
      const { installerRecetteLocale } = await import('./recette-locale.js');
      const app = await buildApp(svc);
      try {
        const c = await installerRecetteLocale(svc, app);
        console.log(`\nCompte de recette créé.\n  Identifiant  : ${c.identifiant}\n  Mot de passe : ${c.motDePasse}\n`);
      } catch (e) {
        console.error((e as Error).message);
        process.exitCode = 1;
      } finally {
        await app.close();
      }
      break;
    }
    case 'setup-token': {
      const recovery = arg === '--recovery';
      if (!recovery && (await svc.auth.adminExists())) {
        console.error('Un administrateur existe déjà. Utilisez --recovery pour créer un administrateur de secours.');
        process.exit(1);
      }
      await svc.auth.issueSetupToken(recovery ? 'recovery' : 'cli');
      break;
    }
    case 'reset-password': {
      const u = await user(arg);
      const pw = tempPassword();
      const empreinte = await svc.motsDePasse.hacher(u.id, pw);
      await svc.db.tx(async (c, k) => {
        await k
          .updateTable('users')
          .set((eb) => ({
            password_hash: empreinte,
            must_change_password: true,
            failed_logins: 0,
            locked_until: null,
            version: eb('version', '+', 1),
          }))
          .where('id', '=', u.id)
          .execute();
        await svc.auth.destroyUserSessions(u.id, null, c);
      }, 'cli');
      await svc.db.audit(SYS, null, 'cli.user_password_reset', u.username);
      console.log(`Mot de passe temporaire de ${u.username} : ${pw}`);
      break;
    }
    case 'reset-mfa': {
      const u = await user(arg);
      await svc.db.tx(async (c, k) => {
        await k
          .updateTable('users')
          .set((eb) => ({ totp_secret: null, totp_pending: null, totp_enabled: false, version: eb('version', '+', 1) }))
          .where('id', '=', u.id)
          .execute();
        await svc.auth.destroyUserSessions(u.id, null, c);
      }, 'cli');
      await svc.db.audit(SYS, null, 'cli.user_mfa_reset', u.username);
      console.log(
        `Double authentification réinitialisée pour ${u.username} (nouvel enrôlement à la prochaine connexion).`,
      );
      break;
    }
    case 'unlock': {
      const u = await user(arg);
      await svc.db.k
        .updateTable('users')
        .set({ failed_logins: 0, locked_until: null })
        .where('id', '=', u.id)
        .execute();
      await svc.db.audit(SYS, null, 'cli.user_unlock', u.username);
      console.log('Compte déverrouillé.');
      break;
    }
    case 'disable':
    case 'enable': {
      const u = await user(arg);
      await svc.db.tx(async (c, k) => {
        await k
          .updateTable('users')
          .set((eb) => ({ disabled: cmd === 'disable', version: eb('version', '+', 1) }))
          .where('id', '=', u.id)
          .execute();
        if (cmd === 'disable') await svc.auth.destroyUserSessions(u.id, null, c);
      }, 'cli');
      await svc.db.audit(SYS, null, `cli.user_${cmd}`, u.username);
      console.log('Fait.');
      break;
    }
    case 'sessions-purge': {
      const r = await svc.db.tx((_c, k) => k.deleteFrom('sessions').executeTakeFirst(), 'cli');
      const n = Number(r.numDeletedRows);
      await svc.db.audit(SYS, null, 'cli.sessions_purge', '', { count: n });
      console.log(`${n} session(s) fermée(s).`);
      break;
    }
    case 'migrate': {
      const applied = await svc.db.migrate();
      console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Aucune migration en attente.');
      break;
    }
    case 'migrations': {
      if (arg === '--a-appliquer') {
        for (const f of await pendingMigrations(svc.db)) console.log(f);
      } else {
        const r = await svc.db.k
          .selectFrom('schema_migrations')
          .select(['name', 'applied_at'])
          .orderBy('name')
          .execute();
        for (const m of r) console.log(`${m.name}\t${new Date(m.applied_at).toISOString()}`);
      }
      break;
    }
    case 'controle-donnees': {
      const out = await controleDonnees(svc);
      console.log(JSON.stringify(out, null, 2));
      if (!out.ok) process.exitCode = 1;
      break;
    }
    case 'controle-relations': {
      const r = await controleRelations(svc);
      if (arg === '--anomalies')
        for (const c of r.controles) for (const a of c.anomalies) console.log(`${c.nom} : ${a}`);
      else {
        console.log(JSON.stringify(r, null, 2));
        if (!r.ok) process.exitCode = 1;
      }
      break;
    }
    case 'jeu-de-test': {
      if (!arg || extra !== '--confirmer') {
        console.error(
          'Jeu de données fictif : à réserver à une instance de test vide.\nUsage : suivi jeu-de-test <compte administrateur> --confirmer',
        );
        process.exit(2);
      }
      const { buildApp } = await import('./app.js');
      const { chargerJeuDeTest } = await import('./jeu-de-test.js');
      const app = await buildApp(svc);
      await app.ready();
      try {
        const bilan = await chargerJeuDeTest(svc, app, arg, { publicUrl: svc.cfg.publicUrl || 'https://localhost' });
        console.log(JSON.stringify(bilan, null, 2));
      } finally {
        await app.close();
      }
      break;
    }
    case 'charger-jeu': {
      if (!arg || extra !== '--confirmer') {
        console.error(
          'Jeu de données fourni sur l’entrée standard (JSON) : à réserver à une instance de test vide.\nUsage : suivi charger-jeu <compte administrateur> --confirmer < jeu.json',
        );
        process.exit(2);
      }
      const { buildApp } = await import('./app.js');
      const { chargerJeuExterne } = await import('./jeu-externe.js');
      let jeu: unknown;
      try {
        jeu = JSON.parse(await readStdin());
      } catch {
        console.error('Jeu de données illisible : JSON attendu sur l’entrée standard.');
        process.exit(1);
      }
      const app = await buildApp(svc);
      await app.ready();
      try {
        const bilan = await chargerJeuExterne(svc, app, arg, jeu, {
          publicUrl: svc.cfg.publicUrl || 'https://localhost',
        });
        console.log(JSON.stringify(bilan, null, 2));
      } catch (e) {
        console.error((e as Error).message);
        process.exitCode = 1;
      } finally {
        await app.close();
      }
      break;
    }
    case 'consigner-mise-a-jour': {
      const raw = await readStdin();
      let rep: Record<string, unknown>;
      try {
        rep = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.error('Rapport illisible : JSON attendu sur l’entrée standard.');
        process.exit(2);
      }
      const ok = rep.resultat === 'reussie';
      await svc.db.audit(
        { username: 'mise à jour' },
        null,
        ok ? 'system.update' : 'system.update_failed',
        `${String(rep.depuis ?? '?')} → ${String(rep.vers ?? '?')}`,
        rep,
      );
      console.log('Mise à jour consignée au journal d’audit.');
      break;
    }
    case 'poivre-restaurer': {
      // Le poivre se lit sur l'entrée standard : il n'apparaît ni dans la liste des processus ni dans l'historique du shell.
      const poivre = (await readStdin()).replace(/\r?\n$/, '');
      if (!poivre) {
        console.error(
          'Poivre attendu sur l\'entrée standard : printf %s "$POIVRE" | docker compose exec -T app suivi poivre-restaurer',
        );
        process.exit(1);
      }
      try {
        await svc.motsDePasse.restaurer(poivre, SYS);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log('Poivre repris : la clé est de nouveau scellée par la clé maîtresse actuelle.');
      break;
    }
    case 'poivre-reinitialiser': {
      if (arg !== '--confirmer') {
        console.error(
          "PROCÉDURE D'URGENCE, à n'utiliser que si le poivre est perdu. Elle génère un nouveau poivre, impose un mot de passe\n" +
            "temporaire à TOUS les comptes et ferme toutes les sessions. Relancer avec --confirmer pour l'exécuter.",
        );
        process.exit(1);
      }
      const r = await svc.motsDePasse.reinitialiser(SYS);
      await svc.alertesSecurite.poivre({
        type: 'reinitialise',
        auteur: 'cli',
        ancienIdCle: null,
        nouvelIdCle: r.idCle,
      });
      console.log(
        `NOUVEAU POIVRE (à enregistrer au coffre-fort MAINTENANT ; affiché une seule fois) :\n  ${formaterPoivreGenere(r.poivre)}\n`,
      );
      console.log(`Mots de passe temporaires (changement imposé à la connexion), ${r.comptes.length} compte(s) :`);
      console.table(r.comptes.map((c) => ({ compte: c.username, 'mot de passe temporaire': c.motDePasse })));
      break;
    }
    default:
      console.error(`Commande inconnue : ${cmd}\n\n${HELP}`);
      process.exit(2);
  }
  svc.presence.stop();
  await svc.db.end();
}

/** Lot de la veille : 500 éléments d'au plus quelques kilooctets chacun ; une faille NVD porte depuis le lot V4a jusqu'à
    vingt produits touchés avec leur plage de versions (au pire une douzaine de kilooctets). */
const VEILLE_ENTREE_MAX = 16 * 1024 * 1024;
/** Lot d'une synchronisation de Tenable : 500 éléments, dont des constats qui citent jusqu'à 500 CVE. */
const INTEGRATIONS_LOT_MAX = 8 * 1024 * 1024;

/** Entrée standard entière ; avec une borne, null au-delà (lecture arrêtée). */
async function readStdin(): Promise<string>;
async function readStdin(max: number): Promise<string | null>;
async function readStdin(max?: number) {
  const chunks: Buffer[] = [];
  let taille = 0;
  for await (const c of process.stdin) {
    taille += (c as Buffer).length;
    if (max !== undefined && taille > max) return null;
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Contrôle des données (avant et après une mise à jour, une migration de dossier ou une restauration) :
    nombres d'enregistrements, empreinte de l'état de l'outil historique, relecture de chaque version de document
    (déchiffrement et empreinte SHA-256 comparée à celle enregistrée au dépôt). */
async function controleDonnees(svc: Services) {
  const TABLES = [
    'users',
    'groups',
    'roles',
    'documents',
    'document_versions',
    'links',
    'state_history',
    'import_batches',
  ];
  const tables: Record<string, number> = {};
  const k = svc.db.k;
  for (const t of TABLES) {
    const exists = (await sql<{ r: string | null }>`SELECT to_regclass(${t})::text AS r`.execute(k)).rows[0];
    // Nom de table issu de la liste fermée ci-dessus, cité comme identifiant.
    if (exists?.r)
      tables[t] = (await sql<{ n: number }>`SELECT count(*)::int AS n FROM ${sql.table(t)}`.execute(k)).rows[0]!.n;
  }
  const st = await k
    .selectFrom('app_state')
    .select(['version', sql<string>`encode(sha256(convert_to(data::text, 'UTF8')), 'hex')`.as('empreinte')])
    .where('id', '=', 1)
    .executeTakeFirst();
  const versions = await k
    .selectFrom('document_versions')
    .select(['document_id', 'version', 'sha256', 'key_id', 'iv', 'auth_tag', 'content'])
    .orderBy('document_id')
    .orderBy('version')
    .execute();
  let relues = 0;
  const erreurs: string[] = [];
  const h = crypto.createHash('sha256');
  for (const v of versions) {
    try {
      const plain = svc.vault.decrypt(
        { iv: v.iv, tag: v.auth_tag, content: v.content, keyId: v.key_id },
        `doc:${v.document_id}:${v.version}`,
      );
      if (crypto.createHash('sha256').update(plain).digest('hex') !== v.sha256) throw new Error('empreinte différente');
      relues++;
    } catch (e) {
      erreurs.push(`${v.document_id} v${v.version} : ${(e as Error).message}`);
    }
    h.update(`${v.document_id}:${v.version}:${v.sha256}\n`);
  }
  const relations = await controleRelations(svc);
  return {
    ok: erreurs.length === 0,
    tables,
    etat: st ? { version: st.version, empreinte: st.empreinte } : null,
    documents: { versions: versions.length, relues, empreinte: h.digest('hex'), erreurs },
    relations,
  };
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
