/* Commandes d'exploitation :  docker compose exec app suivi <commande> [arguments]
     users                       liste les comptes
     setup-token [--recovery]    nouveau jeton d'installation, annule le précédent (--recovery : administrateur de secours)
     reset-password <compte>     mot de passe temporaire (changement imposé à la connexion)
     reset-mfa <compte>          réinitialise la double authentification (téléphone perdu)
     unlock <compte>             déverrouille un compte
     disable <compte> | enable <compte>
     sessions-purge              ferme toutes les sessions
     migrate                     applique les migrations en attente
   Raccourci : docker compose exec app setup-token                                                                */
import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { hashPassword, tempPassword } from './security/crypto.js';
import { createServices } from './services.js';

const HELP = `Commandes : docker compose exec app suivi <commande> [arguments]
  users                       liste les comptes
  setup-token [--recovery]    nouveau jeton d'installation, annule le précédent (--recovery : administrateur de secours)
  reset-password <compte>     mot de passe temporaire (changement imposé à la connexion)
  reset-mfa <compte>          réinitialise la double authentification (téléphone perdu)
  unlock <compte>             déverrouille un compte
  disable <compte> | enable <compte>
  sessions-purge              ferme toutes les sessions
  migrate                     applique les migrations en attente`;

async function main() {
  const [cmd, arg] = process.argv.slice(2);
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
    case 'users': {
      const r = await svc.db.q<{
        username: string;
        role: string;
        disabled: boolean;
        totp_enabled: boolean;
        locked_until: Date | null;
        last_login_at: Date | null;
      }>(
        'SELECT username, role, disabled, totp_enabled, locked_until, last_login_at FROM users ORDER BY lower(username)',
      );
      console.table(
        r.rows.map((u) => ({
          compte: u.username,
          role: u.role,
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
    default:
      console.error(`Commande inconnue : ${cmd}\n\n${HELP}`);
      process.exit(2);
  }
  svc.presence.stop();
  await svc.db.end();
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
