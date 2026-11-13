/* Frontend compilé ; scénario FICTIF des API bibliothèque/couverture, aucune base métier. */
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { fournisseursFixture } from './fournisseurs-fixture';
const platform = JSON.parse(readFileSync(new URL('../fixtures/fournisseurs-studio.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../fixtures/bibliotheque-unifiee.json', import.meta.url), 'utf8'));
export async function bibliothequeFixture(
  page: Page,
  options: { readonly?: boolean; theme?: 'clair' | 'sombre'; unavailable?: boolean; coverageError?: boolean } = {},
) {
  await fournisseursFixture(page);
  const me = structuredClone(platform.me);
  me.preferences.theme = options.theme ?? 'sombre';
  if (options.readonly) me.permissions = me.permissions.filter((p: string) => p !== 'conformite:modifier');
  const catalogue = structuredClone(demo.catalogue),
    couverture = structuredClone(demo.couverture),
    scopes = [
      ...structuredClone(platform.scopes),
      { id: '00000000-0000-4000-8000-000000000088', name: 'Unité fictive sans rattachement' },
    ];
  const writes: { method: string; path: string; body: Record<string, unknown>; ifMatch: string | undefined }[] = [],
    errors: string[] = [];
  const details: Record<string, Record<string, unknown>[]> = {};
  const history: Record<string, Record<string, unknown>[]> = {};
  const state = { fail: false, version: 0 };
  for (const f of catalogue)
    details[f.id] = Array.from({ length: f.requirements }, (_, i) => ({
      id: 'DEMO-' + (i + 1),
      title: 'Exigence fictive ' + (i + 1),
      status: 'uncovered',
      measures: [],
      evaluation: null,
      etat: 'non_implemente',
      obligatoire: false,
      exclusionIllicite: false,
      sansMesure: true,
    }));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) }),
  );
  await page.route('**/api/grc/smsis', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scopes) }),
  );
  await page.route(/\/api\/(library\/|grc\/[^/]+\/(couverture|exigences\/))/, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method(),
      body = req.postData() ? req.postDataJSON() : null;
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (!['GET', 'HEAD'].includes(method)) {
      writes.push({ method, path, body, ifMatch: req.headers()['if-match'] });
      if (state.fail) {
        state.fail = false;
        return reply({ error: 'Échec de recette, saisie conservée' }, 503);
      }
      if (options.readonly) return reply({ error: 'Accès refusé' }, 403);
    }
    if (path === '/api/library/frameworks' && method === 'GET')
      return options.unavailable ? reply({ error: 'Bibliothèque indisponible' }, 503) : reply(catalogue);
    if (path === '/api/library/ia-kit') return reply({ kit: null, importedAt: null });
    if (path === '/api/library/tracker-import') return reply([]);
    if (path.endsWith('/couverture')) {
      if (options.coverageError) return reply({ error: 'Couverture indisponible' }, 503);
      const selected = url.searchParams.get('frameworkId');
      return reply({
        frameworks: path.includes(scopes[1].id) ? [] : couverture.frameworks,
        detail: selected ? (details[selected] ?? []) : null,
      });
    }
    if (path.endsWith('/evaluations')) {
      const id = path.split('/').at(-2)!,
        key = path;
      if (method === 'POST') {
        const e = {
          ...body,
          version: ++state.version,
          createdBy: 'demo_ui',
          createdAt: '2026-11-12T10:00:00Z',
          etat:
            body.testResult === 'conforme'
              ? 'teste'
              : body.implementation === 'complete'
                ? 'implemente'
                : 'non_implemente',
        };
        history[key] = [e, ...(history[key] ?? [])];
        const fw = path.split('/')[5]!;
        const line = details[fw]?.find((r) => r.id === id);
        if (line) {
          line.evaluation = e;
          line.etat = e.etat;
        }
        return reply(e, 201);
      }
      return reply(history[key] ?? []);
    }
    if (path.endsWith('/copy')) {
      const original = catalogue.find((f: (typeof catalogue)[number]) => f.id === path.split('/')[4]);
      const c = {
        ...structuredClone(original),
        id: 'copie-demo',
        name: body.name,
        scopes: 0,
        locked: false,
        derivedFrom: { identifier: original.identifier, name: original.name, version: original.version },
      };
      catalogue.push(c);
      return reply(c, 201);
    }
    if (path.endsWith('/preview'))
      return reply({
        previewId: 'preview-demo',
        version: 0,
        requirements: body.definition.requirements.length,
        domains: body.definition.domains.length,
        duplicate: false,
        canPublish: true,
        warning: null,
      });
    if (path.endsWith('/publish')) {
      const c = { ...catalogue[0], id: 'import-demo', name: body.definition.name, locked: false, derivedFrom: null };
      catalogue.push(c);
      return reply(c, 201);
    }
    if (path.includes('/versions/'))
      return reply({
        definition: {
          name: 'Référentiel fictif',
          identifier: 'DEMO',
          source: {
            organisation: 'Fictif',
            document: 'Recette',
            url: 'https://example.invalid',
            version: '1',
            date: '',
            license: 'Fictif',
            verifiedAt: '',
            normative: false,
            status: 'organisation',
          },
          domains: [{ id: 'demo', label: 'Domaine fictif' }],
          requirements: [
            {
              id: 'D-1',
              domain: 'demo',
              title: 'Exigence de démonstration',
              description: 'Fictif',
              applicability: '',
              measureRefs: [],
            },
          ],
        },
      });
    return reply([]);
  });
  await page.goto(new URL('/pilotage/bibliotheque', process.env.E2E_UI_URL ?? 'http://127.0.0.1:5212').href);
  await expect(page.locator('.bb-record')).toHaveCount(options.unavailable ? 0 : 2);
  return { catalogue, couverture, scopes, writes, errors, state };
}
