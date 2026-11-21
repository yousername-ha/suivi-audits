// Installation de la pile vierge comme un administrateur (compte de recette fictif). Identifiants hors dépôt (0600).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { Client } from './client.mjs';
const IDF = '/srv/suivi-banc-perf/identifiants.json';
const c = new Client();
const st = (await c.get('/api/setup')).json;
if (!st.needed) { console.error('Pile non vierge : arrêt.'); process.exit(1); }
const token = execSync(`${process.env.BANC}/perf/pile.sh compose exec -T app setup-token`).toString().split('\n').map((l) => l.trim()).filter((l) => /^[A-Za-z0-9_-]{16,}$/.test(l)).pop();
const cle = execSync('age-keygen 2>/dev/null').toString().match(/age1[0-9a-z]+/)[0];
const rnd = (n) => crypto.randomBytes(n).toString('base64').replace(/[^A-Za-z0-9]/g, '');
const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const poivre = Array.from(crypto.randomBytes(52), (b) => A32[b % 32]).join('');
const password = 'Rc-' + rnd(18) + '!9a';
const r = await c.post('/api/setup', {
  token, username: 'recette.admin', displayName: 'Administrateur de recette', orgName: 'Groupement Sante Fictif',
  password, poivre: { mode: 'genere', valeur: poivre, engagement: { coffre: true, fin: poivre.slice(-8) } },
  cleSecours: { publique: cle, coffre: true },
});
console.log('setup', r.status, r.text().slice(0, 300));
fs.writeFileSync(IDF, JSON.stringify({ username: 'recette.admin', password }), { mode: 0o600 });
const me = await c.refreshCsrf();
console.log('stage', me.stage, me.user?.username, me.permissions.length);
