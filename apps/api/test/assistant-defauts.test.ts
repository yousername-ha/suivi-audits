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
