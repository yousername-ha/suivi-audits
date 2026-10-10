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
     backup-worker [ready|unavailable] annonce l'état de l'exécutant serveur
     backup-claim               réclame une demande (verrou hôte obligatoire)
     backup-finish <id> <code>   termine une demande avec le rapport serveur
     ops-policy | ops-sync [date] | ops-claim  protocole hôte (jamais HTTP)
  ops-request | ops-certificate  JSON privé sur entrée standard
  ops-schedule <UUID>         demande planifiée (verrou hôte)
  consigner-mise-a-jour       consigne au journal d'audit le rapport de mise à jour lu sur l'entrée standard
   Raccourci : docker compose exec app setup-token                                                                */
import crypto from 'node:crypto';
import { z } from 'zod';
import { certificateInfo } from './certificates.js';
import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { hashPassword, tempPassword } from './security/crypto.js';
import { createServices, type Services } from './services.js';
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
  backup-worker [ready|unavailable] état du worker serveur
  backup-claim               réclame une demande (verrou hôte obligatoire)
  backup-finish <id> <code>   termine une demande avec son rapport
  ops-policy | ops-sync [date] | ops-claim  protocole hôte (jamais HTTP)
  ops-request | ops-certificate  JSON privé sur entrée standard
  ops-schedule <UUID>         demande planifiée (verrou hôte)
  consigner-mise-a-jour       consigne au journal d'audit un rapport de mise à jour (JSON sur l'entrée standard)`;

async function main() {
  const [cmd, arg, extra] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(HELP);
    process.exit(cmd ? 0 : 2);
  }
  const svc = createServices(loadConfig(), createLogger('warn'));
  const SYS = { username: 'cli' };
  const user = async (name?: string) => {
    const u = await svc.db.one<{ id: string; username: string }>(
      'SELECT id, username FROM users WHERE lower(username)=lower($1)',
      [name || ''],
    );
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
    case 'backup-finish': {
      if (!arg || !extra || !/^\d{1,3}$/.test(extra)) throw new Error('Identifiant et code requis.');
      await svc.backups.finish(arg, Number(extra));
      break;
    }
    case 'ops-policy': {
      console.log(JSON.stringify(await svc.operations.policy()));
      break;
    }
    case 'ops-sync': {
      await svc.operations.synchronize(arg || null);
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
      const r = await svc.db.q<{
        username: string;
        roles: string | null;
        expires_at: Date | null;
        disabled: boolean;
        totp_enabled: boolean;
        locked_until: Date | null;
        last_login_at: Date | null;
      }>(
        `SELECT u.username, u.disabled, u.totp_enabled, u.locked_until, u.last_login_at, u.expires_at,
                (SELECT string_agg(r.name, ', ' ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                  WHERE ur.user_id = u.id) AS roles
           FROM users u ORDER BY lower(u.username)`,
      );
      console.table(
        r.rows.map((u) => ({
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
      await svc.db.tx(async (c) => {
        await c.query(
          'UPDATE users SET password_hash=$2, must_change_password=true, failed_logins=0, locked_until=NULL, version=version+1 WHERE id=$1',
          [u.id, await hashPassword(pw)],
        );
        await svc.auth.destroyUserSessions(u.id, null, c);
      }, 'cli');
      await svc.db.audit(SYS, null, 'cli.user_password_reset', u.username);
      console.log(`Mot de passe temporaire de ${u.username} : ${pw}`);
      break;
    }
    case 'reset-mfa': {
      const u = await user(arg);
      await svc.db.tx(async (c) => {
        await c.query(
          'UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_enabled=false, version=version+1 WHERE id=$1',
          [u.id],
        );
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
      await svc.db.q('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1', [u.id]);
      await svc.db.audit(SYS, null, 'cli.user_unlock', u.username);
      console.log('Compte déverrouillé.');
      break;
    }
    case 'disable':
    case 'enable': {
      const u = await user(arg);
      await svc.db.tx(async (c) => {
        await c.query('UPDATE users SET disabled=$2, version=version+1 WHERE id=$1', [u.id, cmd === 'disable']);
        if (cmd === 'disable') await svc.auth.destroyUserSessions(u.id, null, c);
      }, 'cli');
      await svc.db.audit(SYS, null, `cli.user_${cmd}`, u.username);
      console.log('Fait.');
      break;
    }
    case 'sessions-purge': {
      const r = await svc.db.tx((c) => c.query('DELETE FROM sessions'), 'cli');
      await svc.db.audit(SYS, null, 'cli.sessions_purge', '', { count: r.rowCount });
      console.log(`${r.rowCount} session(s) fermée(s).`);
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
        const r = await svc.db.q<{ name: string; applied_at: Date }>(
          'SELECT name, applied_at FROM schema_migrations ORDER BY name',
        );
        for (const m of r.rows) console.log(`${m.name}\t${new Date(m.applied_at).toISOString()}`);
      }
      break;
    }
    case 'controle-donnees': {
      const out = await controleDonnees(svc);
      console.log(JSON.stringify(out, null, 2));
      if (!out.ok) process.exitCode = 1;
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
    default:
      console.error(`Commande inconnue : ${cmd}\n\n${HELP}`);
      process.exit(2);
  }
  svc.presence.stop();
  await svc.db.end();
}

const readStdin = async () => {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

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
  for (const t of TABLES) {
    const exists = await svc.db.one<{ r: string | null }>('SELECT to_regclass($1)::text AS r', [t]);
    if (exists?.r) tables[t] = (await svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`))!.n;
  }
  const st = await svc.db.one<{ version: number; empreinte: string }>(
    "SELECT version, encode(sha256(convert_to(data::text, 'UTF8')), 'hex') AS empreinte FROM app_state WHERE id = 1",
  );
  const versions = await svc.db.q<{
    document_id: string;
    version: number;
    sha256: string;
    key_id: string;
    iv: Buffer;
    auth_tag: Buffer;
    content: Buffer;
  }>('SELECT document_id, version, sha256, key_id, iv, auth_tag, content FROM document_versions ORDER BY 1, 2');
  let relues = 0;
  const erreurs: string[] = [];
  const h = crypto.createHash('sha256');
  for (const v of versions.rows) {
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
  return {
    ok: erreurs.length === 0,
    tables,
    etat: st ? { version: st.version, empreinte: st.empreinte } : null,
    documents: { versions: versions.rows.length, relues, empreinte: h.digest('hex'), erreurs },
  };
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
