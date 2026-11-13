import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Fournisseur } from '../../../apps/web/src/pilotage/fournisseurs-types';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/fournisseurs-studio.json', import.meta.url), 'utf8'));
export async function fournisseursFixture(
  page: Page,
  options: { readonly?: boolean; theme?: 'clair' | 'sombre'; many?: number; unavailable?: boolean } = {},
) {
  const me = structuredClone(fixture.me);
  me.preferences.theme = options.theme ?? 'sombre';
  if (options.readonly)
    me.permissions = me.permissions.filter((p: string) => !/^fournisseurs:(modifier|administrer|supprimer)$/.test(p));
  const suppliers: Fournisseur[] = structuredClone(fixture.suppliers);
  if (options.many)
    suppliers.splice(
      0,
      suppliers.length,
      ...Array.from({ length: options.many }, (_, i) => ({
        ...structuredClone(fixture.suppliers[i % fixture.suppliers.length]),
        id: 'DEMO-' + i,
      })),
    );
  const writes: { method: string; path: string; body: Record<string, unknown> | null }[] = [],
    errors: string[] = [];
  const histories: Record<string, Record<string, unknown>[]> = {};
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      method = req.method();
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/api/events')
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': test de presentation\n\n' });
    if (path === '/api/auth/me') return reply(me);
    if (path === '/api/suppliers/criteria') return reply(fixture.criteria);
    if (path === '/api/grc/smsis') return reply(fixture.scopes);
    if (path.endsWith('/policy')) return reply(fixture.policy);
    if (path === '/api/account/preferences') {
      Object.assign(me.preferences, req.postDataJSON());
      return reply(me.preferences);
    }
    if (path === '/api/suppliers' && method === 'GET')
      return options.unavailable ? reply({ error: 'Registre indisponible' }, 503) : reply(suppliers);
    if (!['GET', 'HEAD'].includes(method) && (path.startsWith('/api/suppliers') || /\/suppliers\//.test(path))) {
      const body = req.postData() ? req.postDataJSON() : null;
      writes.push({ method, path, body });
      if (options.readonly) return reply({ error: 'Accès refusé' }, 403);
      if (path === '/api/suppliers' && method === 'POST') {
        const f = { ...structuredClone(fixture.suppliers[4]), id: 'DEMO-CREATE', name: body.name };
        suppliers.push(f);
        return reply(f, 201);
      }
      const id = path.split('/')[3],
        f = suppliers.find((f) => f.id === id);
      if (path.endsWith('/evaluations') && f) {
        const items = body.items.map((it: { criterionId: string; meets: boolean | null; result: string }) => ({
          ...it,
          criterionLabel: fixture.criteria.find((c: { id: string }) => c.id === it.criterionId).label,
          criterionVersion: 1,
        }));
        const evaluation = { ...body, id: 'DEMO-EVAL', evaluator: 'demo_ui', items };
        histories[f.id] = [evaluation, ...(histories[f.id] ?? [])];
        f.current = {
          id: 'DEMO-EVAL',
          evaluatedAt: body.evaluatedAt,
          evaluator: 'demo_ui',
          nextReviewAt: body.nextReviewAt,
          items: items.length,
          meets: items.filter((i: { meets: boolean | null }) => i.meets === true).length,
          notMeets: items.filter((i: { meets: boolean | null }) => i.meets === false).length,
          notAssessed: items.filter((i: { meets: boolean | null }) => i.meets === null).length,
        };
        return reply(evaluation, 201);
      }
      if (method === 'PATCH' && f) {
        Object.assign(f, body);
        return reply(f);
      }
      if (/\/api\/grc\/[^/]+\/suppliers\//.test(path)) {
        const supplier = suppliers.find((f) => f.id === path.split('/')[5]),
          scope = path.split('/')[3]!;
        if (supplier)
          supplier.scopes =
            method === 'PUT' ? [...new Set([...supplier.scopes, scope])] : supplier.scopes.filter((x) => x !== scope);
        return reply({});
      }
      throw new Error('Écriture inattendue dans la recette : ' + method + ' ' + path);
    }
    if (path.endsWith('/evaluations')) return reply(histories[path.split('/')[3]!] ?? []);
    return reply([]);
  });
  await page.route('**/update/**', (route) => route.fulfill({ status: 200, body: '' }));
  await page.goto(new URL('/pilotage/fournisseurs', process.env.E2E_UI_URL || 'http://127.0.0.1:5212').href);
  if (!options.unavailable) await expect(page.locator('.fs-row')).toHaveCount(suppliers.length);
  return { suppliers, writes, errors, criteria: fixture.criteria, scopes: fixture.scopes };
}
export async function supplierAction(page: Page, name: string, action: string) {
  await page.getByRole('button', { name: `Actions de ${name}`, exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
