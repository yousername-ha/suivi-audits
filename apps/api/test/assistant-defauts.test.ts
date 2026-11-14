/* Réglages par défaut de l'assistant (migration 064, demande du RSSI du 12/11/2026) : un profil lit tous les périmètres,
   y compris ceux créés plus tard, et les documents de toute classification. L'assistant reste inactif tant qu'il n'est pas
   réglé, et ne lit jamais plus que la personne. Faux modèle, données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EtatAssistantDto, ReglagesAssistantDto } from '@suivi/shared';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

class FauxModele implements TransportModele {
  script: (d: DemandeModele, n: number) => MessageModele = () => ({ role: 'assistant', content: 'Réponse fictive.' });
  n = 0;
  declare() {
    return true;
  }
  async completer(_a: string, _c: string, demande: DemandeModele): Promise<ReponseModele> {
    return { message: this.script(structuredClone(demande), ++this.n), jetonsEntree: 10, jetonsSortie: 5 };
  }
}
let t: TestApp, modele: FauxModele, admin: Agent, invite: Agent;
const base = '/api/assistant';
const creer = async (name: string) =>
  (await admin.post('/api/grc/smsis', { name, scope: 'Périmètre fictif', timezone: 'Europe/Paris' })).json()
    .id as string;
/** Périmètres que l'assistant liste pour la personne, par l'outil lister_perimetres. */
const lister = async (a: Agent) => {
  let noms: string[] = [];
  modele.n = 0;
  modele.script = (d, n) => {
    if (n === 1)
      return {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'l1', type: 'function', function: { name: 'lister_perimetres', arguments: '{}' } }],
      };
    const r = JSON.parse([...d.messages].reverse().find((m) => m.role === 'tool')!.content!) as {
      perimetres: { nom: string }[];
    };
    noms = r.perimetres.map((p) => p.nom);
    return { role: 'assistant', content: 'Réponse fictive.' };
  };
  const conv = (await a.post(`${base}/conversations`, { profil: 'mise_en_oeuvre' })).json().id as string;
  expect((await a.post(`${base}/conversations/${conv}/messages`, { texte: 'Question fictive' })).statusCode).toBe(202);
  await t.svc.assistant.attendre(conv);
  return noms;
};

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  admin = await login(t, await makeUser(t, 'def_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_assistant', 'Utilisateur de l’assistant', $1)",
    [['assistant:lire', 'ecarts:lire']],
  );
  invite = await login(t, await makeUser(t, 'def_invite', 'r_assistant'));
});
afterAll(async () => {
  await t?.close();
});

describe('assistant : réglages par défaut', () => {
  it('ouvre par défaut tous les périmètres et les documents aux deux profils, l’assistant restant inactif', async () => {
    const r = (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
    expect(r.actif).toBe(false);
    for (const p of r.profils)
      expect(p).toMatchObject({
        actif: true,
        tousPerimetres: true,
        perimetres: [],
        documents: true,
        classificationMax: 'confidentiel',
        rondeQuotidienne: false,
        referent: null,
      });
    expect(((await admin.get(`${base}/etat`)).json() as EtatAssistantDto).pret).toBe(false);
  });

  it('lit un périmètre créé après le réglage, sans rien modifier, mais jamais plus que la personne', async () => {
    expect((await admin.put(`${base}/reglages/cle`, { cle: 'cle-fictive-de-test-0123456789' })).statusCode).toBe(204);
    const cur = (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
    const r = await admin.put(`${base}/reglages`, {
      actif: true,
      adresse: 'https://modele.example.invalid/v1',
      modele: 'modele-fictif',
      budgetJetonsJour: cur.budgetJetonsJour,
      profils: cur.profils.map(({ id, actif, perimetres }) => ({ id, actif, perimetres })),
      version: cur.version,
    });
    expect(r.statusCode, r.body).toBe(200);
    const nouveau = 'Périmètre fictif créé après le réglage';
    await creer(nouveau);
    expect(await lister(admin)).toContain(nouveau);
    // Périmètre restreint : l'invité n'en est pas membre, l'assistant ne le lui montre pas.
    expect(await lister(invite)).not.toContain(nouveau);
    const etat = (await invite.get(`${base}/etat`)).json() as EtatAssistantDto;
    expect(etat.profils[0]!.perimetres.map((p) => p.nom)).not.toContain(nouveau);
  });

  it('revient à une liste explicite quand « tous les périmètres » est décoché', async () => {
    const choisi = await creer('Périmètre fictif choisi');
    const cur = (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
    const r = await admin.put(`${base}/reglages`, {
      actif: cur.actif,
      adresse: cur.adresse,
      modele: cur.modele,
      budgetJetonsJour: cur.budgetJetonsJour,
      profils: cur.profils.map(({ id, actif }) => ({ id, actif, perimetres: [choisi], tousPerimetres: false })),
      version: cur.version,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(await lister(admin)).toEqual(['Périmètre fictif choisi']);
  });
});

describe('assistant : vue d’ensemble de la gouvernance', () => {
  /** Fait appeler un outil par le faux modèle et rend son résultat. */
  const outil = async (a: Agent, nom: string) => {
    let resultat: Record<string, unknown> = {};
    modele.n = 0;
    modele.script = (d, n) => {
      if (n === 1)
        return {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'o1', type: 'function', function: { name: nom, arguments: '{}' } }],
        };
      resultat = JSON.parse([...d.messages].reverse().find((m) => m.role === 'tool')!.content!) as Record<
        string,
        unknown
      >;
      return { role: 'assistant', content: 'Réponse fictive.' };
    };
    const conv = (await a.post(`${base}/conversations`, { profil: 'audit_interne' })).json().id as string;
    expect((await a.post(`${base}/conversations/${conv}/messages`, { texte: 'Question fictive' })).statusCode).toBe(
      202,
    );
    await t.svc.assistant.attendre(conv);
    return resultat;
  };
  const reglerAudit = async (profil: Record<string, unknown>) => {
    const cur = (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
    const r = await admin.put(`${base}/reglages`, {
      actif: cur.actif,
      adresse: cur.adresse,
      modele: cur.modele,
      budgetJetonsJour: cur.budgetJetonsJour,
      profils: cur.profils.map(({ id, actif, perimetres, tousPerimetres }) => ({
        id,
        actif,
        perimetres,
        tousPerimetres,
        ...(id === 'audit_interne' ? profil : {}),
      })),
      version: cur.version,
    });
    expect(r.statusCode, r.body).toBe(200);
  };

  it('rend en un appel tous les périmètres lisibles et les rubriques de l’organisation', async () => {
    await reglerAudit({ tousPerimetres: true });
    const retard = await creer('Périmètre fictif avec retard');
    const o = await admin.post(`/api/grc/${retard}/objects`, {
      kind: 'action',
      name: 'Action fictive en retard',
      data: {
        description: '',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: '2020-01-01T00:00:00.000Z',
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    expect(o.statusCode, o.body).toBe(200);
    const v = (await outil(admin, 'vue_ensemble')) as {
      perimetres: { nom: string; actionsEnRetard?: number; actionsSansResponsable?: number; compteurs?: unknown }[];
      organisation?: { audit?: unknown; incidents?: { nombre: number }; fournisseurs?: unknown };
    };
    const p = v.perimetres.find((x) => x.nom === 'Périmètre fictif avec retard')!;
    expect(p).toMatchObject({ actionsEnRetard: 1, actionsSansResponsable: 1 });
    expect(p.compteurs).toBeTruthy();
    expect(v.perimetres.length).toBeGreaterThan(2);
    expect(v.organisation).toMatchObject({ incidents: { nombre: 0 } });
    expect(v.organisation!.audit).toBeTruthy();
    expect(v.organisation!.fournisseurs).toBeTruthy();
    // Aucun identifiant de personne dans ce qui part au modèle.
    expect(JSON.stringify(v)).not.toMatch(/ownerId|userId/);
  });

  it('lit le plan d’audit, les incidents et les fournisseurs avec les droits de la personne', async () => {
    expect(await outil(admin, 'plan_audit')).toHaveProperty('constats');
    expect(await outil(admin, 'incidents')).toMatchObject({ nombre: 0, incidents: [] });
    expect(await outil(admin, 'evaluations_fournisseurs')).toHaveProperty('evaluations');
    // L'invité n'a pas le droit des incidents : refus du service, et la vue d'ensemble n'en dit rien.
    expect(await outil(invite, 'incidents')).toHaveProperty('erreur');
    const v = (await outil(invite, 'vue_ensemble')) as { organisation?: Record<string, unknown> };
    expect(v.organisation?.incidents).toBeUndefined();
  });

  it('refuse les rubriques d’organisation à un profil limité à certains périmètres', async () => {
    await reglerAudit({ tousPerimetres: false, perimetres: [] });
    expect(await outil(admin, 'incidents')).toEqual({
      erreur:
        'Ce profil est limité à certains périmètres : il ne lit pas les rubriques communes à toute l’organisation.',
    });
    const v = (await outil(admin, 'vue_ensemble')) as { perimetres: unknown[]; organisation?: unknown };
    expect(v.perimetres).toEqual([]);
    expect(v.organisation).toBeUndefined();
  });
});
