/* Contrats assistant 460060a, données FICTIVES et réponses interceptées. Pas de moteur ni de serveur métier. */
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { fournisseursFixture } from './fournisseurs-fixture';
const data = JSON.parse(readFileSync(new URL('../fixtures/assistant-global.json', import.meta.url), 'utf8'));
const supplier = JSON.parse(readFileSync(new URL('../fixtures/fournisseurs-studio.json', import.meta.url), 'utf8'));
export async function assistantFixture(
  page: Page,
  options: {
    read?: boolean;
    noAdmin?: boolean;
    modify?: boolean;
    theme?: 'clair' | 'sombre';
    pause?: boolean;
    missing?: boolean;
    inactive?: boolean;
    empty?: boolean;
    constat?: boolean;
  } = {},
) {
  await fournisseursFixture(page, { theme: options.theme ?? 'sombre' });
  const me = structuredClone(supplier.me);
  me.preferences.theme = options.theme ?? 'sombre';
  if (options.read !== false) me.permissions.push('assistant:lire');
  if (options.modify !== false) me.permissions.push('assistant:modifier');
  if (options.noAdmin)
    me.permissions = me.permissions.filter(
      (p: string) => !p.startsWith('administration:') && !p.startsWith('import_export:'),
    );
  const d = structuredClone(data);
  d.etat.enPause = !!options.pause;
  d.etat.actif = !options.inactive;
  if (options.empty) {
    d.notifications = [];
    d.propositions = [];
  }
  if (options.constat)
    d.propositions.push({
      ...structuredClone(d.propositions[0]),
      id: 'demo-constat',
      profil: 'audit_interne',
      type: 'constat',
      nature: 'nonconformity',
      sourceIssueAssistant: true,
      titre: 'Traçabilité des revues des accès',
      echeance: null,
    });
  const writes: { method: string; path: string; body: Record<string, unknown> | null; csrf: string | null }[] = [];
  const calls: string[] = [];
  const errors: string[] = [];
  const state = {
    fail: '' as string,
    pending: 0,
    sequence: 0,
    delay: 0,
    missions: [] as { id: string; profil: string; consigne: string; etat: string }[],
    deny: false,
  };
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/mur/synthese', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d.dashboard) }),
  );
  await page.route('**/api/tableau-de-bord/disposition', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ personnelle: null, organisation: null, partages: [], choix: null }),
    }),
  );
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) }),
  );
  await page.route(/\/api\/(assistant\/|grc\/notifications)/, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      method = req.method(),
      body = req.postData() ? req.postDataJSON() : null;
    calls.push(method + ' ' + path);
    const reply = (v: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v) });
    if (state.deny) return reply({ error: 'Accès refusé' }, 403);
    if (options.missing && path.startsWith('/api/assistant/')) return reply({ error: 'Route absente' }, 404);
    if (!['GET', 'HEAD'].includes(method)) {
      writes.push({ method, path, body, csrf: req.headers()['x-csrf-token'] ?? null });
      if (state.fail && path.includes(state.fail)) {
        state.fail = '';
        return reply({ error: 'Indisponibilité simulée' }, 503);
      }
    }
    if (path === '/api/assistant/etat') return reply(d.etat);
    if (path === '/api/assistant/conversations' && method === 'GET')
      return reply(d.conversations.map(({ messages: _, ...c }: (typeof d.conversations)[number]) => c));
    if (path === '/api/assistant/conversations' && method === 'POST') {
      expect(Object.keys(body)).toEqual(['profil']);
      const c = {
        id: 'nouveau-' + ++state.sequence,
        profil: body.profil,
        titre: 'Nouvelle discussion',
        etat: 'pret',
        createdAt: '2026-11-12T10:00:00+01:00',
        updatedAt: '2026-11-12T10:00:00+01:00',
        messages: [],
      };
      d.conversations.unshift(c);
      return reply(c, 201);
    }
    if (path.includes('/api/assistant/conversations/')) {
      const c = d.conversations.find((c: (typeof d.conversations)[number]) => c.id === path.split('/')[4]);
      if (!c) return reply({ error: 'Conversation absente' }, 404);
      if (method === 'DELETE') {
        d.conversations = d.conversations.filter((x: typeof c) => x.id !== c.id);
        return reply({});
      }
      if (method === 'POST') {
        expect(Object.keys(body)).toEqual(['texte']);
        expect(body.texte.length).toBeLessThanOrEqual(4000);
        if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
        c.messages.push({
          id: 'message-' + ++state.sequence,
          role: 'utilisateur',
          contenu: body.texte,
          sources: [],
          outils: [],
          erreur: false,
          createdAt: '2026-11-12T10:00:00+01:00',
        });
        c.etat = 'en_cours';
        state.pending = 1;
        return reply(c);
      }
      if (c.etat === 'en_cours' && state.pending-- <= 0) {
        c.etat = 'pret';
        c.messages.push({
          id: 'reponse-' + ++state.sequence,
          role: 'assistant',
          contenu: 'Réponse de recette API fictive, uniquement pour vérifier le raccordement.',
          sources: [],
          outils: [],
          erreur: false,
          createdAt: '2026-11-12T10:01:00+01:00',
        });
      }
      return reply(c);
    }
    if (path === '/api/assistant/propositions') return reply(d.propositions);
    if (path.endsWith('/decision')) {
      if (options.modify === false) return reply({ error: 'Accès refusé' }, 403);
      const p = d.propositions.find((p: (typeof d.propositions)[number]) => p.id === path.split('/')[4]);
      expect(p).toBeTruthy();
      Object.assign(p, body, {
        etat: body.decision === 'confirmer' ? 'confirmee' : 'rejetee',
        objetCree: body.decision === 'confirmer' ? 'objet-cree-par-recette' : null,
        decidedBy: 'Utilisateur de recette',
      });
      return reply(p);
    }
    if (path === '/api/assistant/missions') {
      if (method === 'POST') {
        expect(Object.keys(body).sort()).toEqual(['consigne', 'profil']);
        state.missions.push({ ...body, id: 'mission-' + ++state.sequence, etat: 'ouverte' });
        return reply(state.missions.at(-1), 201);
      }
      return reply(state.missions);
    }
    if (path === '/api/grc/notifications') return reply(d.notifications);
    if (path.startsWith('/api/grc/notifications/')) {
      const n = d.notifications.find((n: (typeof d.notifications)[number]) => n.id === path.split('/')[4]);
      expect(n).toBeTruthy();
      if (path.endsWith('/reponse')) {
        expect(body.texte.length).toBeLessThanOrEqual(2000);
        n.reponse = body.texte;
      }
      if (path.endsWith('/read')) n.readAt = '2026-11-12T10:00:00+01:00';
      if (path.endsWith('/avis')) n.avis = body.avis;
      return reply(n);
    }
    throw new Error('Appel assistant inattendu : ' + method + ' ' + path);
  });
  await page.reload();
  if (options.missing || options.inactive) {
    if (options.empty) await expect(page.locator('.as-launcher')).toHaveCount(0);
  } else {
    await expect(page.locator('.as-launcher')).toBeVisible();
    await page.locator('.as-launcher').click();
    await expect(page.locator('.as-dock')).toBeVisible();
    if (options.read !== false) await expect(page.locator('.as-message').first()).toBeVisible();
  }
  return { data: d, state, writes, calls, errors };
}
