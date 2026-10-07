'use strict';
/* Journalisation JSON sur la sortie standard (collectable par le SIEM via le pilote de logs Docker). */
const w = (lvl) => (msg, extra) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), lvl, msg, ...(extra || {}) }) + '\n');
module.exports = { info: w('info'), warn: w('warn'), error: w('error') };
