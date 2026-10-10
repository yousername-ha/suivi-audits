import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let port = 0;
let admin: TestUser, rw: TestUser, ro: TestUser;

/** Ouvre un flux SSE et accumule les événements reçus. */
function openStream(a: Agent) {
  const events: { event: string; data: unknown }[] = [];
  let buf = '';
  let req: http.ClientRequest;
  const ready = new Promise<number>((resolve, reject) => {
    req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/api/events',
        headers: {
          cookie: [...a.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          'x-forwarded-proto': 'https',
          host: 'suivi.test',
        },
      },
      (res) => {
        resolve(res.statusCode ?? 0);
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          buf += chunk;
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
          }
        });
      },
    );
    req.on('error', reject);
  });
  const waitFor = async (pred: (e: { event: string; data: unknown }) => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const e = events.find(pred);
      if (e) return e;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };
  return { events, ready, waitFor, close: () => req.destroy() };
}

beforeAll(async () => {
  t = await createTestApp();
  await t.svc.bus.start();
  await t.app.listen({ port: 0, host: '127.0.0.1' });
  port = (t.app.server.address() as AddressInfo).port;
  admin = await makeUser(t, 'admin', 'admin');
  rw = await makeUser(t, 'redacteur', 'rw');
  ro = await makeUser(t, 'lecteur', 'ro');
});
afterAll(() => t.close());

describe('temps réel (SSE, LISTEN/NOTIFY)', () => {
  it('refuse le flux sans session', async () => {
    const r = await fetch(`http://127.0.0.1:${port}/api/events`);
    expect(r.status).toBe(401);
  });

  it('diffuse les changements (entité, id, version, auteur) aux autres utilisateurs', async () => {
    const reader = await login(t, ro);
    const writer = await login(t, rw);
    const s = openStream(reader);
    expect(await s.ready).toBe(200);
    expect(await s.waitFor((e) => e.event === 'hello')).toBeTruthy();
    const l = (await writer.post('/api/links', { url: 'https://exemple.invalid/rt', title: 'RT' })).json();
    const ev = await s.waitFor((e) => e.event === 'change' && (e.data as { id: string }).id === l.id);
    expect(ev?.data).toMatchObject({ entity: 'links', id: l.id, version: 1, op: 'insert', author: 'redacteur' });
    await writer.patch(`/api/links/${l.id}`, { title: 'RT2' }, { 'if-match': '1' });
    const ev2 = await s.waitFor((e) => e.event === 'change' && (e.data as { version: number }).version === 2);
    expect(ev2?.data).toMatchObject({ entity: 'links', op: 'update', author: 'redacteur' });
    s.close();
  });

  it('filtre selon les droits : les événements des comptes ne vont qu’à l’administration', async () => {
    const roStream = openStream(await login(t, ro));
    const adminAgent = await login(t, admin);
    const adStream = openStream(adminAgent);
    await Promise.all([roStream.ready, adStream.ready]);
    await Promise.all([roStream.waitFor((e) => e.event === 'hello'), adStream.waitFor((e) => e.event === 'hello')]);
    await adminAgent.post('/api/admin/users', { username: 'nouveau', roles: [{ roleId: 'lecteur' }] });
    expect(
      await adStream.waitFor((e) => e.event === 'change' && (e.data as { entity: string }).entity === 'users'),
    ).toBeTruthy();
    // Un événement public ultérieur arrive bien au lecteur : il n'a donc pas reçu celui des comptes.
    await (await login(t, rw)).post('/api/links', { url: 'https://exemple.invalid/marqueur' });
    expect(
      await roStream.waitFor((e) => e.event === 'change' && (e.data as { entity: string }).entity === 'links'),
    ).toBeTruthy();
    expect(roStream.events.some((e) => e.event === 'change' && (e.data as { entity: string }).entity === 'users')).toBe(
      false,
    );
    roStream.close();
    adStream.close();
  });

  it('présence : qui consulte ou modifie quoi', async () => {
    const watcher = openStream(await login(t, ro));
    await watcher.ready;
    const editor = await login(t, rw);
    expect(
      (await editor.post('/api/presence', { client: 'onglet-redacteur-1', resource: 'documents/abc', mode: 'edit' }))
        .statusCode,
    ).toBe(204);
    const ev = await watcher.waitFor((e) => e.event === 'presence' && (e.data as unknown[]).length > 0);
    expect(ev?.data).toEqual([
      expect.objectContaining({ username: 'redacteur', resource: 'documents/abc', mode: 'edit' }),
    ]);
    // L'activité dans l'administration n'est pas visible d'un lecteur, et un non-administrateur ne peut pas la déclarer.
    expect(
      (await editor.post('/api/presence', { client: 'onglet-redacteur-2', resource: 'admin/users', mode: 'view' }))
        .statusCode,
    ).toBe(403);
    await editor.del('/api/presence/onglet-redacteur-1');
    expect(await watcher.waitFor((e) => e.event === 'presence' && (e.data as unknown[]).length === 0)).toBeTruthy();
    watcher.close();
  });
});

it('B1 : diffuse les activations sans fermer la session et filtre un flux déjà ouvert avec les droits actuels', async () => {
  const reader = await login(t, ro);
  const watcher = openStream(reader);
  expect(await watcher.ready).toBe(200);
  await watcher.waitFor((e) => e.event === 'hello');
  const adminAgent = await login(t, admin);
  const change = async (enabled: boolean) => {
    const intent = { changes: [{ id: 'documents', enabled }], cascade: false };
    const p = (await adminAgent.post('/api/admin/modules/preview', intent)).json();
    const r = await adminAgent.put(
      '/api/admin/modules',
      { intent, previewId: p.previewId, confirm: 'VALIDER' },
      { 'if-match': `"${p.version}"` },
    );
    expect(r.statusCode).toBe(200);
    return r.json().version;
  };
  try {
    const off = await change(false);
    expect(
      await watcher.waitFor(
        (e) =>
          e.event === 'change' &&
          (e.data as { entity: string; version: number }).entity === 'module_activation' &&
          (e.data as { version: number }).version === off,
      ),
    ).toBeTruthy();
    expect((await reader.me()).stage).toBe('ok');
    expect((await reader.get('/api/documents')).statusCode).toBe(409);
    // Une modification par un exécutant interne n'est pas diffusée à ce module désactivé.
    await t.svc.db.q(
      "INSERT INTO links(title,url,created_by,updated_by) VALUES ('Filtré B1','https://exemple.invalid/b1','worker','worker')",
    );
    const on = await change(true);
    await watcher.waitFor(
      (e) =>
        e.event === 'change' &&
        (e.data as { entity: string; version: number }).entity === 'module_activation' &&
        (e.data as { version: number }).version === on,
    );
    expect(
      watcher.events.filter((e) => e.event === 'change' && (e.data as { author?: string }).author === 'worker'),
    ).toEqual([]);
    const link = (
      await adminAgent.post('/api/links', { title: 'Réactivé', url: 'https://exemple.invalid/b1-on' })
    ).json();
    expect(
      await watcher.waitFor((e) => e.event === 'change' && (e.data as { id: string }).id === link.id),
    ).toBeTruthy();
    expect(watcher.events.filter((e) => e.event === 'logout')).toEqual([]);
  } finally {
    watcher.close();
    await t.svc.db.q("UPDATE module_activation SET disabled='{}',version=version+1 WHERE id=1");
  }
});

it('les événements GRC ne révèlent ni objets ni auteurs hors du SMSI autorisé', async () => {
  const owner = await login(t, admin);
  const privateScope = (
    await owner.post('/api/grc/smsis', { name: 'SMSI SSE privé', scope: 'Confidentiel', timezone: 'Europe/Paris' })
  ).json();
  const stream = openStream(await login(t, ro));
  try {
    expect(await stream.ready).toBe(200);
    await stream.waitFor((e) => e.event === 'hello');
    const secret = (
      await owner.post(`/api/grc/${privateScope.id}/objects`, {
        kind: 'objective',
        name: 'Objectif confidentiel',
        data: { description: 'Secret' },
      })
    ).json();
    const marker = (
      await owner.post('/api/grc/00000000-0000-4000-8000-000000000001/objects', {
        kind: 'objective',
        name: 'Objectif partagé',
        data: { description: '' },
      })
    ).json();
    expect(
      await stream.waitFor((e) => e.event === 'change' && (e.data as { id: string }).id === marker.id),
    ).toBeTruthy();
    expect(
      stream.events.some(
        (e) => JSON.stringify(e.data).includes(secret.id) || JSON.stringify(e.data).includes(privateScope.id),
      ),
    ).toBe(false);
  } finally {
    stream.close();
  }
});
