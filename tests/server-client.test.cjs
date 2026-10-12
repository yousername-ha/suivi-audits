const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('sauvegardes en attente : identifiants serveur, éditions et suppressions conservés', async () => {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sent = [], releases = [];
  let stored = { plans: [], bia: { activities: [] } }, version = 0, acknowledged;
  const context = {
    Blob, setTimeout, setInterval() {},
    document: { getElementById() { return null; } },
    window: { LegacyDFStore: { get() {}, loadState() {} }, addEventListener() {} },
    async fetch(url, options) {
      const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => clone(body) });
      if (url === '/api/session') return response({ user: { permission: 'admin' }, csrf: 'fixture' });
      if (!options.method) return response({ version, state: stored });
      const payload = JSON.parse(options.body);
      assert.equal(payload.version, version);
      const rows = (s) => [...s.plans, ...s.bia.activities];
      const old = new Map(rows(stored).map((r) => [r.id, r.internalId]));
      if (rows(payload.state).some((r) => old.has(r.id) && old.get(r.id) !== r.internalId)) {
        return response({ error: 'Identifiant immuable' }, 422);
      }
      sent.push(clone(payload.state));
      stored = payload.state;
      for (const row of rows(stored)) row.internalId ||= 'REF-' + row.id;
      version++;
      const result = { version, state: clone(stored) };
      await new Promise((resolve) => releases.push(resolve));
      return response(result);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../modules/server-client.js'), 'utf8'), context);
  const api = context.window.LegacyServer;
  await api.start({ ack(state) { acknowledged = state; }, error() {} });
  const first = { plans: [{ id: 'a', title: 'Initial' }, { id: 'b', title: 'Supprimé' }], bia: { activities: [{ id: 'c', title: 'Activité' }] } };
  const saving = api.save(first);
  await api.save({ plans: [{ id: 'a', title: 'Deuxième saisie' }], bia: { activities: [{ id: 'c', title: 'Activité modifiée' }] } });
  releases[0]();
  while (sent.length < 2) await new Promise(setImmediate);
  await api.save({ plans: [{ id: 'a', title: 'Dernière saisie' }], bia: { activities: [{ id: 'c', title: 'Dernière activité' }] } });
  releases[1]();
  while (sent.length < 3) await new Promise(setImmediate);
  releases[2]();
  await saving;
  await api.flush();
  assert.equal(sent[1].plans[0].internalId, 'REF-a');
  assert.equal(sent[2].bia.activities[0].internalId, 'REF-c');
  assert.equal(acknowledged.plans.length, 1);
  assert.equal(acknowledged.plans[0].title, 'Dernière saisie');
  assert.equal(acknowledged.bia.activities[0].title, 'Dernière activité');
  assert.equal(first.plans[0].internalId, undefined, 'Le snapshot fourni ne doit pas être muté');
  const altered = clone(acknowledged);
  altered.plans[0].internalId = 'ALTÉRÉ';
  await assert.rejects(api.save(altered), /Identifiant immuable/);
  await assert.rejects(api.flush(), /Sauvegarde en attente/);
});
