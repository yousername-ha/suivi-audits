/* Rondes autonomes de l'assistant (ADR 0086, lot A3, première tranche) : planification quotidienne, une ronde à la fois,
   pause, référent dont les droits bornent les lectures, rappels plafonnés et non réémis, mémoire, missions, rapport réservé.
   Le modèle est remplacé par un faux transport scripté : aucun appel réseau. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  MemoireAssistantDto,
  MissionAssistantDto,
  ReglagesAssistantDto,
  RondeAssistantDetailDto,
  RondeAssistantDto,
} from '@suivi/shared';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';
import { HttpError } from '../src/http/errors.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

class FauxModele implements TransportModele {
  demandes: DemandeModele[] = [];
  script: (d: DemandeModele, n: number) => MessageModele | Error | Promise<MessageModele> = () => ({
    role: 'assistant',
    content: 'Rapport fictif : rien à signaler.',
  });
  declare() {
    return true;
  }
  async completer(_adresse: string, _cle: string, demande: DemandeModele): Promise<ReponseModele> {
    this.demandes.push(structuredClone(demande));
    const r = await this.script(demande, this.demandes.length);
    if (r instanceof Error) throw r;
    return { message: r, jetonsEntree: 100, jetonsSortie: 20 };
  }
}
const appel = (id: string, nom: string, args: unknown): MessageModele => ({
  role: 'assistant',
  content: '',
  tool_calls: [{ id, type: 'function', function: { name: nom, arguments: JSON.stringify(args) } }],
});
const dernierOutil = (d: DemandeModele) => {
  const m = [...d.messages].reverse().find((x) => x.role === 'tool');
  return m ? (JSON.parse(m.content ?? 'null') as Record<string, unknown>) : null;
};
const action = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
    ...extra,
  },
});

let t: TestApp, modele: FauxModele;
let admin: Agent, responsable: Agent, invite: Agent;
let adminId: string, responsableId: string, inviteId: string;
let perimetre: string, autre: string, enRetard: string, sansResponsable: string;
const base = '/api/assistant';
/** 12/11/2026 à 07 h 30 (heure de Paris) et le lendemain. */
const MATIN = new Date('2026-11-12T06:30:00.000Z');
const AVANT_L_HEURE = new Date('2026-11-12T03:00:00.000Z');
const LENDEMAIN = new Date('2026-11-13T06:30:00.000Z');

const reglages = async () => (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
const regler = async (change: Record<string, unknown>, profil: Record<string, unknown> = {}) => {
  const cur = await reglages();
  return admin.put(`${base}/reglages`, {
    actif: cur.actif,
    adresse: cur.adresse,
    modele: cur.modele,
    budgetJetonsJour: cur.budgetJetonsJour,
    profils: cur.profils.map(({ id, actif, perimetres }) => ({
      id,
      actif,
      perimetres,
      ...(id === 'mise_en_oeuvre' ? profil : {}),
    })),
    version: cur.version,
    ...change,
  });
};
const rondes = async (a: Agent) => (await a.get(`${base}/rondes`)).json() as RondeAssistantDto[];
const tic = async (quand: Date) => {
  modele.demandes = [];
  const id = await t.svc.assistantRondes.tic(quand);
  await t.svc.assistantRondes.attendre();
  return id;
};
const rappelsDe = async (userId: string) =>
  (
    await t.svc.db.q<{ title: string; message: string; object_id: string; due_key: string }>(
      "SELECT title, message, object_id::text, due_key FROM grc_notifications WHERE kind = 'assistant_rappel' AND user_id = $1 ORDER BY created_at",
      [userId],
    )
  ).rows;

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  const a = await makeUser(t, 'ro_admin', 'admin');
  adminId = a.id;
  admin = await login(t, a);
  const r = await makeUser(t, 'ro_resp', 'rw');
  responsableId = r.id;
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_assistant', 'Utilisateur de l’assistant', $1)",
    [['assistant:lire', 'ecarts:lire']],
  );
  const i = await makeUser(t, 'ro_invite', 'r_assistant');
  inviteId = i.id;

  const creer = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'Périmètre fictif', timezone: 'Europe/Paris' })).json()
      .id as string;
  perimetre = await creer('Périmètre fictif de ronde');
  autre = await creer('Périmètre fictif fermé');
  expect((await admin.put(`/api/grc/${perimetre}/members`, { userId: r.id, write: true })).statusCode).toBe(204);
  responsable = await login(t, r);
  invite = await login(t, i);

  const poser = async (smsi: string, corps: unknown) => {
    const rep = await admin.post(`/api/grc/${smsi}/objects`, corps);
    expect(rep.statusCode, rep.body).toBe(200);
    return rep.json().id as string;
  };
  enRetard = await poser(
    perimetre,
    action('Action fictive en retard', { dueAt: '2020-01-01T00:00:00.000Z', ownerId: r.id }),
  );
  sansResponsable = await poser(
    perimetre,
    action('Action fictive sans responsable', { dueAt: '2020-02-01T00:00:00.000Z' }),
  );

  expect((await admin.put(`${base}/reglages/cle`, { cle: 'cle-fictive-de-test-0123456789' })).statusCode).toBe(204);
  const rep = await regler(
    { actif: true, adresse: 'https://modele.example.invalid/v1', modele: 'modele-fictif' },
    { actif: true, perimetres: [perimetre] },
  );
  expect(rep.statusCode, rep.body).toBe(200);
});
afterAll(async () => {
  await t?.close();
});

describe('assistant : réglages d’autonomie', () => {
  it('rend des valeurs par défaut sans ronde ni référent', async () => {
    const r = await reglages();
    expect(r).toMatchObject({ enPause: false, heureRonde: 6, plafondRappelsJour: 5 });
    expect(r.profils.every((p) => !p.rondeQuotidienne && p.referent === null)).toBe(true);
  });

  it('refuse la ronde quotidienne sans référent, et un référent sans le droit d’utiliser l’assistant', async () => {
    expect((await regler({}, { rondeQuotidienne: true })).statusCode).toBe(422);
    expect((await regler({}, { rondeQuotidienne: true, referent: responsableId })).statusCode).toBe(422);
    expect((await reglages()).profils[0]).toMatchObject({ rondeQuotidienne: false, referent: null });
  });

  it('ne propose comme référents que les comptes autorisés à utiliser l’assistant', async () => {
    const l = (await admin.get(`${base}/referents`)).json() as { id: string }[];
    expect(l.map((x) => x.id).sort()).toEqual([adminId, inviteId].sort());
    expect((await invite.get(`${base}/referents`)).statusCode).toBe(403);
  });
});

describe('assistant : ronde planifiée', () => {
  it('ne part pas sans ronde quotidienne activée', async () => {
    expect(await tic(MATIN)).toBeNull();
    expect(await rondes(admin)).toEqual([]);
  });

  it('part une fois par jour après l’heure réglée, lit avec les droits du référent et rend un rapport', async () => {
    expect((await regler({}, { rondeQuotidienne: true, referent: adminId })).statusCode).toBe(200);
    expect(await tic(AVANT_L_HEURE)).toBeNull();

    modele.script = (d, n) => {
      if (n === 1) return appel('a1', 'signaux', { perimetre });
      if (n === 2) {
        const s = dernierOutil(d) as {
          actionsEnRetard: { nombre: number };
          actionsSansResponsable: { nombre: number };
        };
        expect(s.actionsEnRetard.nombre).toBe(2);
        expect(s.actionsSansResponsable.nombre).toBe(1);
        return appel('a2', 'signaux', { perimetre: autre });
      }
      // Périmètre hors du profil : refus, même si le référent est administrateur.
      expect(dernierOutil(d)).toEqual({ erreur: 'Ce périmètre n’est pas ouvert à ce profil de l’assistant.' });
      return { role: 'assistant', content: 'Rapport fictif : deux actions en retard.' };
    };
    const id = await tic(MATIN);
    expect(id).toBeTruthy();
    // Consigne de ronde, missions et mémoire annoncées ; outils de ronde proposés.
    const premiere = modele.demandes[0]!;
    expect(premiere.messages[0]!.content).toContain('RONDE AUTONOME');
    expect(premiere.tools!.map((o) => o.function.name)).toEqual(
      expect.arrayContaining(['envoyer_rappel', 'memoriser']),
    );

    const detail = (await admin.get(`${base}/rondes/${id}`)).json() as RondeAssistantDetailDto;
    expect(detail).toMatchObject({
      profil: 'mise_en_oeuvre',
      declencheur: 'planifiee',
      etat: 'terminee',
      rapport: 'Rapport fictif : deux actions en retard.',
      rappels: 0,
      jetons: 360,
    });
    expect(detail.outils.map((o) => o.nom)).toEqual(['signaux', 'signaux']);

    // Pas de seconde ronde le même jour ; une nouvelle le lendemain.
    expect(await tic(MATIN)).toBeNull();
    modele.script = () => ({ role: 'assistant', content: 'Rapport fictif du lendemain.' });
    expect(await tic(LENDEMAIN)).toBeTruthy();
    expect((await rondes(admin)).length).toBe(2);
  });

  it('consigne la ronde au journal d’audit sans contenu métier', async () => {
    const { rows } = await t.svc.db.q<{ username: string; details: Record<string, unknown> }>(
      "SELECT username, details FROM audit_log WHERE action = 'assistant.ronde' ORDER BY id",
    );
    expect(rows.length).toBe(2);
    expect(rows[0]!.username).toBe('Assistant RSSI');
    expect(JSON.stringify(rows)).not.toContain('Action fictive');
    expect(JSON.stringify(rows)).not.toContain('Rapport fictif');
  });

  it('réserve le rapport au référent et aux administrateurs de l’assistant', async () => {
    const [r] = await rondes(admin);
    expect(await rondes(invite)).toEqual([]);
    expect((await invite.get(`${base}/rondes/${r!.id}`)).statusCode).toBe(404);
    expect((await responsable.get(`${base}/rondes`)).statusCode).toBe(403);
  });
});

describe('assistant : ce qu’une ronde émet seule', () => {
  const lancer = async () => {
    modele.demandes = [];
    const r = await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' });
    await t.svc.assistantRondes.attendre();
    return r;
  };

  it('envoie un rappel au responsable nommé, une seule fois tant que l’élément n’a pas changé', async () => {
    const comptes: Record<string, unknown>[] = [];
    modele.script = (d, n) => {
      if (n > 1) comptes.push(dernierOutil(d)!);
      if (n <= 2)
        return appel('r' + n, 'envoyer_rappel', {
          perimetre,
          id: enRetard,
          message: 'Cette action fictive a dépassé son échéance : pouvez-vous en donner l’état ?',
        });
      if (n === 3)
        return appel('r3', 'envoyer_rappel', {
          perimetre,
          id: sansResponsable,
          message: 'Cette action fictive n’a pas de responsable nommé.',
        });
      return { role: 'assistant', content: 'Rapport fictif : un rappel envoyé.' };
    };
    const r = await lancer();
    expect(r.statusCode, r.body).toBe(202);
    expect(comptes[0]).toMatchObject({ envoye: true });
    expect(comptes[1]).toMatchObject({ envoye: false });
    expect(String(comptes[1]!.detail)).toContain('déjà été envoyé');
    expect(String(comptes[2]!.detail)).toContain('pas de responsable nommé');

    const recus = await rappelsDe(responsableId);
    expect(recus).toHaveLength(1);
    // Le titre, repris dans un éventuel courriel, ne porte aucune donnée métier.
    expect(recus[0]).toMatchObject({ title: 'Rappel de l’assistant RSSI', object_id: enRetard });
    expect(recus[0]!.message).toContain('Action fictive en retard');
    const vus = (await responsable.get('/api/grc/notifications')).json() as { kind: string }[];
    expect(vus.filter((n) => n.kind === 'assistant_rappel')).toHaveLength(1);
    const derniere = (await rondes(admin)).find((x) => x.declencheur === 'manuelle');
    expect(derniere).toMatchObject({ declencheur: 'manuelle', etat: 'terminee', rappels: 1 });
    // Rien n'a été écrit dans le registre : l'action n'a pas changé de version.
    const { rows } = await t.svc.db.q<{ version: number }>('SELECT version FROM grc_objects WHERE id = $1', [enRetard]);
    expect(rows[0]!.version).toBe(1);
  });

  it('respecte le plafond de rappels par personne et par jour', async () => {
    expect((await regler({ plafondRappelsJour: 1 })).statusCode).toBe(200);
    const rep = await admin.post(
      `/api/grc/${perimetre}/objects`,
      action('Autre action fictive en retard', { dueAt: '2020-03-01T00:00:00.000Z', ownerId: responsableId }),
    );
    let compte: Record<string, unknown> | null = null;
    modele.script = (d, n) => {
      if (n === 1)
        return appel('p1', 'envoyer_rappel', {
          perimetre,
          id: rep.json().id,
          message: 'Cette autre action fictive a dépassé son échéance.',
        });
      compte = dernierOutil(d);
      return { role: 'assistant', content: 'Rapport fictif : plafond atteint.' };
    };
    await lancer();
    expect(compte).toMatchObject({ envoye: false });
    expect(await rappelsDe(responsableId)).toHaveLength(1);
    expect((await regler({ plafondRappelsJour: 5 })).statusCode).toBe(200);
  });

  it('refuse rappel et mémoire en dehors d’une ronde', async () => {
    const conv = (await admin.post(`${base}/conversations`, { profil: 'mise_en_oeuvre' })).json().id as string;
    modele.demandes = [];
    modele.script = () => ({ role: 'assistant', content: 'Réponse fictive.' });
    await admin.post(`${base}/conversations/${conv}/messages`, { texte: 'Question fictive' });
    await t.svc.assistant.attendre(conv);
    const noms = modele.demandes[0]!.tools!.map((o) => o.function.name);
    expect(noms).toContain('signaux');
    expect(noms).not.toContain('envoyer_rappel');
    expect(noms).not.toContain('memoriser');
  });

  it('tient une mémoire par profil, relue à la ronde suivante, lisible et supprimable', async () => {
    modele.script = (_d, n) =>
      n === 1
        ? appel('m1', 'memoriser', { note: 'Note fictive : le plan d’action fictif est suivi chaque mois.' })
        : { role: 'assistant', content: 'Rapport fictif : note écrite.' };
    await lancer();
    const notes = (await admin.get(`${base}/memoire`)).json() as MemoireAssistantDto[];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ profil: 'mise_en_oeuvre' });

    modele.demandes = [];
    modele.script = () => ({ role: 'assistant', content: 'Rapport fictif.' });
    await lancer();
    expect(modele.demandes[0]!.messages[0]!.content).toContain('Note fictive : le plan d’action fictif');

    expect((await invite.get(`${base}/memoire`)).statusCode).toBe(403);
    expect((await admin.del(`${base}/memoire/${notes[0]!.id}`)).statusCode).toBe(204);
    expect((await admin.get(`${base}/memoire`)).json()).toEqual([]);
  });

  it('purge la mémoire d’un profil quand un périmètre lui est retiré', async () => {
    await t.svc.db.q(
      "INSERT INTO assistant_memoire(profil, contenu) VALUES ('mise_en_oeuvre', 'Note fictive à purger')",
    );
    expect((await regler({}, { perimetres: [perimetre, autre] })).statusCode).toBe(200);
    expect((await admin.get(`${base}/memoire`)).json()).toHaveLength(1);
    expect((await regler({}, { perimetres: [perimetre] })).statusCode).toBe(200);
    expect((await admin.get(`${base}/memoire`)).json()).toEqual([]);
  });

  it('reprend les missions ouvertes à chaque ronde, jusqu’à leur clôture', async () => {
    const m = await admin.post(`${base}/missions`, {
      profil: 'mise_en_oeuvre',
      consigne: 'Suivre le plan d’action fictif de l’audit fictif.',
    });
    expect(m.statusCode, m.body).toBe(201);
    expect((await invite.post(`${base}/missions`, { profil: 'mise_en_oeuvre', consigne: 'x' })).statusCode).toBe(403);
    modele.demandes = [];
    modele.script = () => ({ role: 'assistant', content: 'Rapport fictif.' });
    await lancer();
    expect(modele.demandes[0]!.messages[0]!.content).toContain('Suivre le plan d’action fictif');

    const id = (m.json() as MissionAssistantDto).id;
    expect((await admin.post(`${base}/missions/${id}/cloture`)).statusCode).toBe(200);
    expect((await admin.post(`${base}/missions/${id}/cloture`)).statusCode).toBe(404);
    modele.demandes = [];
    await lancer();
    expect(modele.demandes[0]!.messages[0]!.content).toContain('Aucune mission en cours.');
  });
});

describe('assistant : bornes d’une ronde', () => {
  it('ne lance qu’une ronde à la fois et conclut dès la mise en pause', async () => {
    let liberer: () => void = () => {};
    const attente = new Promise<void>((ok) => (liberer = ok));
    modele.demandes = [];
    modele.script = async (_d, n) => {
      if (n === 1) {
        await attente;
        return appel('b1', 'lister_perimetres', {});
      }
      return { role: 'assistant', content: 'Rapport fictif écourté.' };
    };
    const premiere = await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' });
    expect(premiere.statusCode, premiere.body).toBe(202);
    expect((await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' })).statusCode).toBe(409);
    expect(await t.svc.assistantRondes.tic(new Date('2026-11-14T06:30:00.000Z'))).toBeNull();

    expect((await regler({ enPause: true })).statusCode).toBe(200);
    liberer();
    await t.svc.assistantRondes.attendre();
    // Après la pause, le tour suivant ne propose plus d'outil : le modèle conclut.
    expect(modele.demandes).toHaveLength(2);
    expect(modele.demandes[1]!.tools).toBeUndefined();
    expect((await rondes(admin)).find((x) => x.declencheur === 'manuelle')).toMatchObject({ etat: 'terminee' });

    // En pause : ni ronde planifiée, ni ronde manuelle ; le chat reste disponible.
    expect(await tic(new Date('2026-11-14T06:30:00.000Z'))).toBeNull();
    expect((await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' })).statusCode).toBe(409);
    expect((await admin.get(`${base}/etat`)).json()).toMatchObject({ pret: true, enPause: true });
    expect((await regler({ enPause: false })).statusCode).toBe(200);
  });

  it('consigne un échec quand le modèle est injoignable, sans nouvelle tentative le même jour', async () => {
    modele.script = () => new HttpError(502, 'Le relais de modèle ne répond pas.');
    const jour = new Date('2026-11-15T06:30:00.000Z');
    const id = await tic(jour);
    const detail = (await admin.get(`${base}/rondes/${id}`)).json() as RondeAssistantDetailDto;
    expect(detail).toMatchObject({ etat: 'echec', erreur: 'Le relais de modèle ne répond pas.', rapport: '' });
    expect(await tic(jour)).toBeNull();
  });

  it('ne part pas quand le budget quotidien est atteint', async () => {
    await t.svc.db.q(
      "INSERT INTO assistant_consommation(jour, jetons_entree) VALUES ((now() AT TIME ZONE 'UTC')::date, 60000000) ON CONFLICT (jour) DO UPDATE SET jetons_entree = 60000000",
    );
    expect(await tic(new Date('2026-11-16T06:30:00.000Z'))).toBeNull();
    expect((await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' })).statusCode).toBe(429);
    await t.svc.db.q('DELETE FROM assistant_consommation');
  });

  it('échoue proprement quand le référent n’est plus autorisé', async () => {
    expect((await regler({}, { referent: inviteId })).statusCode).toBe(200);
    await t.svc.db.q('UPDATE users SET disabled = true WHERE id = $1', [inviteId]);
    const id = await tic(new Date('2026-11-17T06:30:00.000Z'));
    const detail = (await admin.get(`${base}/rondes/${id}`)).json() as RondeAssistantDetailDto;
    expect(detail.etat).toBe('echec');
    expect(detail.erreur).toContain('référent');
  });
});
