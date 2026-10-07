'use strict';
/* Commandes d'exploitation :  docker compose exec app node src/cli.js <commande> [arguments]
     users                       liste les comptes
     setup-token [--recovery]    émet un jeton d'installation (--recovery : création d'un administrateur de secours)
     reset-password <compte>     mot de passe temporaire (changement imposé à la connexion)
     reset-mfa <compte>          réinitialise la double authentification
     unlock <compte>             déverrouille un compte
     disable <compte> | enable <compte>
     sessions-purge              ferme toutes les sessions                                                     */
const db = require('./db');
const sec = require('./security');
const auth = require('./auth');

const tempPassword = () => sec.tempPassword();
const SYS = { username: 'cli' };

async function user(name) {
  const u = await db.one('SELECT * FROM users WHERE lower(username)=lower($1)', [name || '']);
  if (!u) { console.error(`Compte inconnu : ${name}`); process.exit(1); }
  return u;
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  await db.waitReady(5);
  switch (cmd) {
    case 'users': {
      const r = await db.q('SELECT username, role, disabled, totp_enabled, locked_until, last_login_at FROM users ORDER BY lower(username)');
      console.table(r.rows.map((u) => ({ compte: u.username, role: u.role, actif: !u.disabled, mfa: u.totp_enabled, verrouillé: !!(u.locked_until && u.locked_until > new Date()), derniere_connexion: u.last_login_at && u.last_login_at.toISOString() })));
      break;
    }
    case 'setup-token': {
      const recovery = arg === '--recovery';
      if (!recovery && (await auth.adminExists())) { console.error('Un administrateur existe déjà. Utilisez --recovery pour créer un administrateur de secours.'); process.exit(1); }
      await auth.issueSetupToken(recovery ? 'recovery' : 'cli');
      break;
    }
    case 'reset-password': {
      const u = await user(arg); const pw = tempPassword();
      await db.q('UPDATE users SET password_hash=$2, must_change_password=true, failed_logins=0, locked_until=NULL WHERE id=$1', [u.id, await sec.hashPassword(pw)]);
      await auth.destroyUserSessions(u.id);
      await db.audit(SYS, null, 'cli.user_password_reset', u.username);
      console.log(`Mot de passe temporaire de ${u.username} : ${pw}`);
      break;
    }
    case 'reset-mfa': {
      const u = await user(arg);
      await db.q('UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_enabled=false WHERE id=$1', [u.id]);
      await auth.destroyUserSessions(u.id);
      await db.audit(SYS, null, 'cli.user_mfa_reset', u.username);
      console.log(`Double authentification réinitialisée pour ${u.username} (nouvel enrôlement à la prochaine connexion).`);
      break;
    }
    case 'unlock': { const u = await user(arg); await db.q('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1', [u.id]); await db.audit(SYS, null, 'cli.user_unlock', u.username); console.log('Compte déverrouillé.'); break; }
    case 'disable': case 'enable': {
      const u = await user(arg);
      await db.q('UPDATE users SET disabled=$2 WHERE id=$1', [u.id, cmd === 'disable']);
      if (cmd === 'disable') await auth.destroyUserSessions(u.id);
      await db.audit(SYS, null, `cli.user_${cmd}`, u.username); console.log('Fait.'); break;
    }
    case 'sessions-purge': { const r = await db.q('DELETE FROM sessions'); await db.audit(SYS, null, 'cli.sessions_purge', '', { count: r.rowCount }); console.log(`${r.rowCount} session(s) fermée(s).`); break; }
    default:
      console.log(require('node:fs').readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n'));
      process.exit(cmd ? 2 : 0);
  }
  await db.pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
