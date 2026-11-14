/* Recette locale : premier administrateur créé sans assistant d'installation, sur « localhost » seulement, par la route
   d'installation normale. Données fictives. */
import { afterAll, describe, expect, it } from 'vitest';
import { installerRecetteLocale } from '../src/recette-locale.js';
import { Agent, createTestApp, type TestApp } from './helpers.js';

const apps: TestApp[] = [];
afterAll(async () => {
  for (const t of apps) await t.close();
});

describe('recette locale', () => {
  it('crée un administrateur utilisable tout de suite, sans double authentification quand elle est désactivée', async () => {
    const t = await createTestApp({ PUBLIC_URL: 'https://localhost', MFA_REQUIRED: 'false' });
    apps.push(t);
    const c = await installerRecetteLocale(t.svc, t.app);
    expect(c.identifiant).toBe('recette');
    const a = new Agent(t);
    const r = await a.post('/api/auth/login', { username: c.identifiant, password: c.motDePasse });
    expect(r.statusCode, r.body).toBe(200);
    expect((await a.me()).stage).toBe('ok');
    expect((await a.get('/api/assistant/reglages')).statusCode).toBe(200);
    // Une seconde fois : refusée, un administrateur existe.
    await expect(installerRecetteLocale(t.svc, t.app)).rejects.toThrow('Un administrateur existe déjà');
  });

  it('est refusée hors de localhost, sans rien créer', async () => {
    const t = await createTestApp({ PUBLIC_URL: 'https://suivi.example.invalid' });
    apps.push(t);
    await expect(installerRecetteLocale(t.svc, t.app)).rejects.toThrow('réservée à une recette locale');
    expect(await t.svc.auth.adminExists()).toBe(false);
  });
});

describe('recette locale sur une base neuve', () => {
  it('définit elle-même le poivre et la clé de secours, comme l’assistant d’installation', async () => {
    const t = await createTestApp({ PUBLIC_URL: 'https://localhost', MFA_REQUIRED: 'false' }, { poivre: false });
    apps.push(t);
    expect(await t.svc.motsDePasse.defini()).toBe(false);
    const c = await installerRecetteLocale(t.svc, t.app);
    expect(await t.svc.motsDePasse.defini()).toBe(true);
    expect(await t.svc.cleSecours.definie()).toBe(true);
    const a = new Agent(t);
    expect((await a.post('/api/auth/login', { username: c.identifiant, password: c.motDePasse })).statusCode).toBe(200);
    expect((await a.me()).stage).toBe('ok');
  });
});
