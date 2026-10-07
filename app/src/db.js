'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const cfg = require('./config');
const log = require('./log');

const pool = new Pool({ ...cfg.db, application_name: 'suivi-audits', idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
pool.on('error', (e) => log.error('db pool error', { err: e.message }));

const q = (text, params) => pool.query(text, params);
async function one(text, params) { const r = await pool.query(text, params); return r.rows[0] || null; }

async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

async function waitReady(tries = 60) {
  for (let i = 1; i <= tries; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (e) { if (i === tries) throw e; log.info('waiting for database', { attempt: i, err: e.code || e.message }); await new Promise((r) => setTimeout(r, 2000)); }
  }
}

async function migrate() {
  await q(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const done = await one('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done) continue;
    await tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727274)');
      if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f])).rowCount) return;
      await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
    });
    log.info('migration applied', { name: f });
  }
}

async function audit(who, ip, action, target = '', details = {}) {
  try {
    await q('INSERT INTO audit_log(user_id, username, ip, action, target, details) VALUES ($1,$2,$3,$4,$5,$6)',
      [who && who.id || null, who && who.username || '', ip || null, action, String(target || ''), details]);
  } catch (e) { log.error('audit write failed', { err: e.message, action }); }
}

module.exports = { pool, q, one, tx, waitReady, migrate, audit };
