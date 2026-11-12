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
let compteInvite: Parameters<typeof login>[1];
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
  // Le scénario lance plus de rondes qu'un administrateur n'en demanderait en une heure.
  t.svc.limits.assistantRondeByUser = Object.assign(() => true, { reset() {} });
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
  compteInvite = i;

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
      // Quatre appels : le modèle est renvoyé une fois à ses rappels avant de conclure (filet de la ronde).
      jetons: 480,
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
    expect(String(comptes[2]!.detail)).toContain('pas de responsable joignable');

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

describe('assistant : amélioration avec l’usage', () => {
  const lancer = async () => {
    modele.demandes = [];
    const r = await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' });
    expect(r.statusCode, r.body).toBe(202);
    await t.svc.assistantRondes.attendre();
    return (r.json() as RondeAssistantDto).id;
  };
  const consigne = () => String(modele.demandes[0]!.messages[0]!.content);

  it('remet un référent valide après les tests de bornes', async () => {
    expect((await regler({}, { referent: adminId })).statusCode).toBe(200);
    await t.svc.db.q('UPDATE users SET disabled = false WHERE id = $1', [inviteId]);
    invite = await login(t, compteInvite);
  });

  it('relit le contexte de l’organisation en ronde comme en conversation', async () => {
    expect(
      (await regler({ contexte: 'Contexte fictif : certification fictive visée en fin d’année.' })).statusCode,
    ).toBe(200);
    modele.script = () => ({ role: 'assistant', content: 'Rapport fictif.' });
    await lancer();
    expect(consigne()).toContain('Contexte fictif : certification fictive');

    const conv = (await admin.post(`${base}/conversations`, { profil: 'mise_en_oeuvre' })).json().id as string;
    modele.demandes = [];
    await admin.post(`${base}/conversations/${conv}/messages`, { texte: 'Question fictive' });
    await t.svc.assistant.attendre(conv);
    expect(consigne()).toContain('Contexte fictif : certification fictive');
    expect(consigne()).not.toContain('RONDE AUTONOME');
  });

  it('ne relit une fiche de méthode proposée par l’assistant qu’après validation, corrigée au besoin', async () => {
    const comptes: Record<string, unknown>[] = [];
    modele.script = (d, n) => {
      if (n > 1) comptes.push(dernierOutil(d)!);
      if (n <= 2)
        return appel('f' + n, 'proposer_methode', {
          titre: 'Méthode fictive de suivi',
          contenu: 'Étape fictive 1 : lire les signaux. Étape fictive 2 : relire les actions en retard.',
        });
      return { role: 'assistant', content: 'Rapport fictif : une fiche proposée.' };
    };
    const ronde = await lancer();
    expect(comptes[0]).toMatchObject({ enregistre: true });
    // Une seule fiche par ronde.
    expect(comptes[1]).toMatchObject({ enregistre: false });
    expect((await admin.get(`${base}/rondes/${ronde}`)).json()).toMatchObject({ methodes: 1 });

    const fiches = (await admin.get(`${base}/methodes`)).json() as { id: string; etat: string; origine: string }[];
    expect(fiches).toHaveLength(1);
    expect(fiches[0]).toMatchObject({ etat: 'proposee', origine: 'assistant' });
    expect((await invite.get(`${base}/methodes`)).statusCode).toBe(403);

    // Tant qu'elle n'est pas validée, l'assistant ne la relit pas.
    modele.script = () => ({ role: 'assistant', content: 'Rapport fictif.' });
    await lancer();
    expect(consigne()).not.toContain('Méthode fictive de suivi');

    const decision = await admin.post(`${base}/methodes/${fiches[0]!.id}/decision`, {
      decision: 'valider',
      contenu: 'Étape fictive corrigée par le RSSI.',
    });
    expect(decision.statusCode, decision.body).toBe(200);
    await lancer();
    expect(consigne()).toContain('### Méthode fictive de suivi\nÉtape fictive corrigée par le RSSI.');

    // Refusée : elle n'est plus relue.
    expect((await admin.post(`${base}/methodes/${fiches[0]!.id}/decision`, { decision: 'refuser' })).statusCode).toBe(
      200,
    );
    await lancer();
    expect(consigne()).not.toContain('Méthode fictive de suivi');
  });

  it('accepte une fiche rédigée par une personne, validée d’office, et sa suppression', async () => {
    const r = await admin.post(`${base}/methodes`, {
      profil: 'mise_en_oeuvre',
      titre: 'Fiche fictive du RSSI',
      contenu: 'Toujours commencer par le plan d’action fictif.',
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ etat: 'validee', origine: 'personne' });
    await lancer();
    expect(consigne()).toContain('Fiche fictive du RSSI');
    expect((await admin.del(`${base}/methodes/${r.json().id}`)).statusCode).toBe(204);
  });

  it('relit à la ronde suivante l’avis rendu sur une ronde, réservé au référent et aux administrateurs', async () => {
    const ronde = await lancer();
    expect((await invite.put(`${base}/rondes/${ronde}/avis`, { avis: 'utile' })).statusCode).toBe(404);
    const r = await admin.put(`${base}/rondes/${ronde}/avis`, {
      avis: 'inutile',
      motif: 'Motif fictif : rapport trop long.',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ avis: 'inutile', avisMotif: 'Motif fictif : rapport trop long.' });
    await lancer();
    expect(consigne()).toContain('Pas utile : Motif fictif : rapport trop long.');
  });

  it('laisse le seul destinataire dire si un rappel était utile, et compte le tout par mois', async () => {
    const { rows } = await t.svc.db.q<{ id: string }>(
      "SELECT id::text FROM grc_notifications WHERE kind = 'assistant_rappel' AND user_id = $1",
      [responsableId],
    );
    const rappel = rows[0]!.id;
    expect((await admin.put(`/api/grc/notifications/${rappel}/avis`, { avis: 'utile' })).statusCode).toBe(404);
    expect((await responsable.put(`/api/grc/notifications/${rappel}/avis`, { avis: 'utile' })).statusCode).toBe(200);
    const vus = (await responsable.get('/api/grc/notifications')).json() as { id: string; avis: string | null }[];
    expect(vus.find((n) => n.id === rappel)).toMatchObject({ avis: 'utile' });

    const mesures = (await admin.get(`${base}/mesures`)).json() as Record<string, number | string>[];
    expect(mesures).toHaveLength(6);
    expect(mesures[0]).toMatchObject({
      mois: new Date().toISOString().slice(0, 7),
      rappels: 1,
      rappelsUtiles: 1,
      rappelsInutiles: 0,
      rondesInutiles: 1,
      methodesRefusees: 1,
    });
    expect(Number(mesures[0]!.rondes)).toBeGreaterThan(5);
    expect((await invite.get(`${base}/mesures`)).statusCode).toBe(403);
  });
});

describe('assistant : questions, réponses et relances', () => {
  const lancer = async () => {
    modele.demandes = [];
    const r = await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' });
    expect(r.statusCode, r.body).toBe(202);
    await t.svc.assistantRondes.attendre();
    return (await admin.get(`${base}/rondes/${(r.json() as RondeAssistantDto).id}`)).json() as RondeAssistantDetailDto;
  };
  const consigne = () => String(modele.demandes[0]!.messages[0]!.content);
  const rapport = (): MessageModele => ({ role: 'assistant', content: 'Rapport fictif.' });
  const questionsDe = async (userId: string) =>
    (
      await t.svc.db.q<{ id: string; notification_id: string; etat: string; relances: number; object_id: string }>(
        'SELECT id::text, notification_id::text, etat, relances, object_id::text FROM assistant_questions WHERE user_id = $1 ORDER BY created_at',
        [userId],
      )
    ).rows;

  it('pose une question au responsable, une seule en attente par élément', async () => {
    const comptes: Record<string, unknown>[] = [];
    modele.script = (d, n) => {
      if (n > 1) comptes.push(dernierOutil(d)!);
      if (n <= 2)
        return appel('q' + n, 'poser_question', {
          perimetre,
          id: enRetard,
          question: 'Où en est cette action fictive, et quelle échéance vous paraît tenable ?',
        });
      return rapport();
    };
    const ronde = await lancer();
    expect(comptes[0]).toMatchObject({ envoye: true });
    expect(comptes[1]).toMatchObject({ envoye: false });
    expect(ronde.actions).toContain('Question posée au sujet de « Action fictive en retard ».');
    const [q] = await questionsDe(responsableId);
    expect(q).toMatchObject({ etat: 'ouverte', relances: 0, object_id: enRetard });
    const vus = (await responsable.get('/api/grc/notifications')).json() as {
      id: string;
      kind: string;
      title: string;
    }[];
    expect(vus.find((n) => n.id === q!.notification_id)).toMatchObject({
      kind: 'assistant_question',
      title: 'Question de l’assistant RSSI',
    });
  });

  it('laisse la seule personne interrogée répondre, et remet la réponse à l’assistant une seule fois', async () => {
    const [q] = await questionsDe(responsableId);
    const url = `/api/grc/notifications/${q!.notification_id}/reponse`;
    expect((await admin.put(url, { texte: 'Réponse fictive d’un tiers.' })).statusCode).toBe(404);
    const r = await responsable.put(url, { texte: 'Réponse fictive : action bloquée, échéance fictive en décembre.' });
    expect(r.statusCode, r.body).toBe(200);
    expect((await responsable.put(url, { texte: 'Seconde réponse fictive.' })).statusCode).toBe(404);
    const vus = (await responsable.get('/api/grc/notifications')).json() as { id: string; reponse: string | null }[];
    expect(vus.find((n) => n.id === q!.notification_id)!.reponse).toContain('action bloquée');

    // Le référent lit la réponse ; un autre utilisateur de l'assistant ne voit rien.
    const liste = (await admin.get(`${base}/questions`)).json() as { etat: string; reponse: string }[];
    expect(liste[0]).toMatchObject({ etat: 'repondue' });
    expect((await invite.get(`${base}/questions`)).json()).toEqual([]);
    expect((await responsable.get(`${base}/questions`)).statusCode).toBe(403);

    modele.script = rapport;
    await lancer();
    expect(consigne()).toContain('réponse reçue : « Réponse fictive : action bloquée');
    await lancer();
    expect(consigne()).not.toContain('Réponse fictive : action bloquée');
    // Le journal d'audit ne garde pas le texte de la réponse.
    const { rows } = await t.svc.db.q<{ details: unknown }>(
      "SELECT details FROM audit_log WHERE action = 'assistant.question_repondue'",
    );
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('bloquée');
  });

  it('relance une question sans réponse après le délai, puis la signale au référent', async () => {
    const autreAction = (
      await admin.post(
        `/api/grc/${perimetre}/objects`,
        action('Action fictive muette', { dueAt: '2020-04-01T00:00:00.000Z', ownerId: responsableId }),
      )
    ).json().id as string;
    modele.script = (_d, n) =>
      n === 1
        ? appel('m1', 'poser_question', {
            perimetre,
            id: autreAction,
            question: 'Cette action fictive est-elle toujours utile ?',
          })
        : rapport();
    await lancer();
    const muette = (await questionsDe(responsableId)).find((q) => q.object_id === autreAction)!;
    expect(muette).toMatchObject({ etat: 'ouverte', relances: 0 });

    // Avant le délai : rien. Après : une relance, une seule.
    modele.script = rapport;
    let ronde = await lancer();
    expect(ronde.actions.join(' ')).not.toContain('relancée');
    await t.svc.db.q("UPDATE assistant_questions SET created_at = now() - interval '4 days' WHERE id = $1", [
      muette.id,
    ]);
    ronde = await lancer();
    expect(ronde.actions).toContain('Question relancée au sujet de « Action fictive muette ».');
    ronde = await lancer();
    expect(ronde.actions.join(' ')).not.toContain('relancée');
    const relances = await t.svc.db.q(
      "SELECT 1 FROM grc_notifications WHERE kind = 'assistant_question' AND due_key = $1",
      [muette.id + ':relance'],
    );
    expect(relances.rows).toHaveLength(1);

    // Toujours rien après un second délai : signalée, et dite à l'assistant.
    await t.svc.db.q("UPDATE assistant_questions SET relancee_at = now() - interval '4 days' WHERE id = $1", [
      muette.id,
    ]);
    ronde = await lancer();
    expect(ronde.actions).toContain(
      'Question restée sans réponse malgré une relance, au sujet de « Action fictive muette ».',
    );
    expect(consigne()).toContain('restée sans réponse malgré une relance');
    expect((await questionsDe(responsableId)).find((q) => q.id === muette.id)).toMatchObject({ etat: 'sans_reponse' });
    // Une réponse tardive reste possible.
    const { rows } = await t.svc.db.q<{ id: string }>(
      "SELECT id::text FROM grc_notifications WHERE kind = 'assistant_question' AND due_key = $1",
      [muette.id + ':relance'],
    );
    expect(
      (await responsable.put(`/api/grc/notifications/${rows[0]!.id}/reponse`, { texte: 'Réponse fictive tardive.' }))
        .statusCode,
    ).toBe(200);
  });

  it('rappelle les membres du groupe responsable qui ont accès au périmètre, et eux seuls', async () => {
    const { rows } = await t.svc.db.q<{ id: string }>(
      "INSERT INTO groups(name) VALUES ('Groupe fictif') RETURNING id::text",
    );
    const groupe = rows[0]!.id;
    // Le responsable est membre du périmètre ; l'invité est dans le groupe mais n'a pas accès au périmètre restreint.
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $3), ($2, $3)', [
      responsableId,
      inviteId,
      groupe,
    ]);
    const collective = (
      await admin.post(
        `/api/grc/${perimetre}/objects`,
        action('Action fictive collective', { dueAt: '2020-05-01T00:00:00.000Z' }),
      )
    ).json().id as string;
    await t.svc.db.q(
      `UPDATE grc_objects SET data = data || jsonb_build_object('responsable', jsonb_build_object('type', 'groupe', 'id', $2::text)) WHERE id = $1`,
      [collective, groupe],
    );
    let compte: Record<string, unknown> | null = null;
    modele.script = (d, n) => {
      if (n === 1)
        return appel('g1', 'envoyer_rappel', {
          perimetre,
          id: collective,
          message: 'Cette action fictive collective a dépassé son échéance.',
        });
      compte = dernierOutil(d);
      return rapport();
    };
    await lancer();
    expect(compte).toMatchObject({ envoye: true });
    const recus = await t.svc.db.q<{ user_id: string }>(
      "SELECT user_id::text FROM grc_notifications WHERE kind = 'assistant_rappel' AND object_id = $1",
      [collective],
    );
    expect(recus.rows.map((x) => x.user_id)).toEqual([responsableId]);
  });
});

describe('assistant : filet de la ronde', () => {
  it('renvoie une fois le modèle à ses rappels quand il conclut sans avoir écrit à personne', async () => {
    modele.demandes = [];
    modele.script = (_d, n) =>
      n === 1 ? appel('s1', 'signaux', { perimetre }) : { role: 'assistant', content: 'Rapport fictif n° ' + n + '.' };
    const r = await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' });
    expect(r.statusCode, r.body).toBe(202);
    await t.svc.assistantRondes.attendre();
    // Tour 2 : le modèle veut conclure ; la plateforme le renvoie. Tour 3 : il conclut, sans second renvoi.
    expect(modele.demandes).toHaveLength(3);
    const renvoi = modele.demandes[2]!.messages.at(-1)!;
    expect(renvoi.role).toBe('user');
    expect(renvoi.content).toContain('Vous n’avez encore écrit à aucun responsable');
    const detail = (
      await admin.get(`${base}/rondes/${(r.json() as RondeAssistantDto).id}`)
    ).json() as RondeAssistantDetailDto;
    expect(detail).toMatchObject({ etat: 'terminee', rapport: 'Rapport fictif n° 3.' });
  });
});

describe('assistant : propositions décidées par une personne', () => {
  const lancer = async () => {
    modele.demandes = [];
    const r = await admin.post(`${base}/rondes`, { profil: 'mise_en_oeuvre' });
    expect(r.statusCode, r.body).toBe(202);
    await t.svc.assistantRondes.attendre();
    return (await admin.get(`${base}/rondes/${(r.json() as RondeAssistantDto).id}`)).json() as RondeAssistantDetailDto;
  };
  const consigne = () => String(modele.demandes[0]!.messages[0]!.content);
  const proposer = (titre: string) => {
    const comptes: Record<string, unknown>[] = [];
    modele.script = (d, n) => {
      if (n > 1) comptes.push(dernierOutil(d)!);
      return n === 1
        ? appel('p1', 'proposer_action', {
            perimetre,
            titre,
            description: 'Description fictive : traiter le retard constaté sur l’action fictive.',
            echeance: '2027-01-31',
            source: enRetard,
          })
        : { role: 'assistant', content: 'Rapport fictif.' };
    };
    return comptes;
  };
  const actions = async () =>
    Number(
      (
        await t.svc.db.q<{ n: string }>(
          "SELECT count(*) AS n FROM grc_objects WHERE kind = 'action' AND smsi_id = $1",
          [perimetre],
        )
      ).rows[0]!.n,
    );
  const liste = async (a: Agent) =>
    (await a.get(`${base}/propositions`)).json() as {
      id: string;
      etat: string;
      titre: string;
      objetCree: string | null;
    }[];

  it('dépose une proposition sans rien écrire dans le registre, une seule en attente par élément', async () => {
    const avant = await actions();
    let comptes = proposer('Relancer le traitement fictif');
    const ronde = await lancer();
    expect(comptes[0]).toMatchObject({ enregistre: true });
    expect(ronde).toMatchObject({ propositions: 1 });
    expect(ronde.actions).toContain('Proposition d’action déposée : « Relancer le traitement fictif ».');
    expect(await actions()).toBe(avant);
    comptes = proposer('Relancer encore le traitement fictif');
    await lancer();
    expect(String(comptes[0]!.detail)).toContain('attend déjà une décision');
    expect(await liste(admin)).toHaveLength(1);
    // Un autre utilisateur de l'assistant ne voit pas les propositions d'un référent, et ne peut pas décider.
    expect(await liste(invite)).toEqual([]);
    const [p] = await liste(admin);
    expect((await invite.post(`${base}/propositions/${p!.id}/decision`, { decision: 'rejeter' })).statusCode).toBe(403);
  });

  it('ne redépose pas une proposition rejetée tant que l’élément n’a pas changé, et dit la décision à l’assistant', async () => {
    const [p] = await liste(admin);
    const r = await admin.post(`${base}/propositions/${p!.id}/decision`, {
      decision: 'rejeter',
      note: 'Note fictive : action déjà suivie ailleurs.',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ etat: 'rejetee', objetCree: null });
    expect((await admin.post(`${base}/propositions/${p!.id}/decision`, { decision: 'confirmer' })).statusCode).toBe(
      409,
    );

    let comptes = proposer('Relancer le traitement fictif');
    await lancer();
    expect(consigne()).toContain(
      '« Relancer le traitement fictif » : rejetée (Note fictive : action déjà suivie ailleurs.)',
    );
    expect(String(comptes[0]!.detail)).toContain('rejetée et il n’a pas changé');

    // L'élément change de version : une nouvelle proposition redevient possible.
    const o = (await admin.get(`/api/grc/${perimetre}/objects/${enRetard}`)).json() as {
      version: number;
      name: string;
      data: Record<string, unknown>;
    };
    const maj = await admin.put(
      `/api/grc/${perimetre}/objects/${enRetard}`,
      { kind: 'action', name: o.name, data: { ...o.data, description: 'Description fictive modifiée.' } },
      { 'if-match': String(o.version) },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    comptes = proposer('Reprendre le traitement fictif');
    await lancer();
    expect(comptes[0]).toMatchObject({ enregistre: true });
  });

  it('crée l’action à la confirmation, avec les droits et sous l’identité de la personne qui décide', async () => {
    const p = (await liste(admin)).find((x) => x.etat === 'en_attente')!;
    // Décideur sans droit d'écriture sur les écarts : rien n'est créé, la proposition reste à décider.
    await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ('r_decideur', 'Décideur fictif', $1)", [
      ['assistant:lire', 'assistant:modifier', 'assistant:administrer', 'ecarts:lire'],
    ]);
    const decideur = await login(t, await makeUser(t, 'ro_decideur', 'r_decideur'));
    const avant = await actions();
    // Refus du service du registre : 404 sans accès au périmètre restreint, 403 sans droit d'écriture.
    expect([403, 404]).toContain(
      (await decideur.post(`${base}/propositions/${p.id}/decision`, { decision: 'confirmer' })).statusCode,
    );
    expect(await actions()).toBe(avant);
    expect((await liste(admin)).find((x) => x.id === p.id)).toMatchObject({ etat: 'en_attente' });

    const r = await admin.post(`${base}/propositions/${p.id}/decision`, {
      decision: 'confirmer',
      titre: 'Reprendre le traitement fictif (corrigé)',
    });
    expect(r.statusCode, r.body).toBe(200);
    const cree = (r.json() as { objetCree: string }).objetCree;
    expect(cree).toBeTruthy();
    expect(await actions()).toBe(avant + 1);
    const o = (await admin.get(`/api/grc/${perimetre}/objects/${cree}`)).json() as {
      name: string;
      data: { justification: string; dueAt: string };
    };
    expect(o.name).toBe('Reprendre le traitement fictif (corrigé)');
    expect(o.data.justification).toContain('proposée par l’assistant RSSI au sujet de « Action fictive en retard »');
    expect(o.data.dueAt.slice(0, 10)).toBe('2027-01-31');
    // L'écriture est celle de la personne, pas de l'assistant.
    const { rows } = await t.svc.db.q<{ username: string }>(
      'SELECT username FROM audit_log WHERE target = $1 ORDER BY id LIMIT 1',
      [cree],
    );
    expect(rows[0]!.username).toBe('ro_admin');
    const mesures = (await admin.get(`${base}/mesures`)).json() as Record<string, number>[];
    expect(mesures[0]).toMatchObject({ propositionsConfirmees: 1, propositionsRejetees: 1 });
  });
});

describe('assistant : synthèse hebdomadaire et ronde sur événement', () => {
  /** Lundi 07/12/2026, 07 h 30 à Paris. */
  const LUNDI = new Date('2026-12-07T06:30:00.000Z');
  const consigne = () => String(modele.demandes[0]!.messages[0]!.content);

  it('rend la synthèse de la semaine le jour réglé, à la place de la ronde quotidienne', async () => {
    expect((await regler({ jourSynthese: 1 })).statusCode).toBe(200);
    modele.script = () => ({ role: 'assistant', content: 'Synthèse fictive de la semaine.' });
    const id = await tic(LUNDI);
    expect(id).toBeTruthy();
    expect((await admin.get(`${base}/rondes/${id}`)).json()).toMatchObject({
      declencheur: 'synthese',
      etat: 'terminee',
    });
    expect(consigne()).toContain('SYNTHÈSE DE LA SEMAINE');
    // Pas de ronde quotidienne en plus ce jour-là ; le lendemain, une ronde ordinaire.
    expect(await tic(new Date('2026-12-07T07:00:00.000Z'))).toBeNull();
    const mardi = await tic(new Date('2026-12-08T06:30:00.000Z'));
    expect((await admin.get(`${base}/rondes/${mardi}`)).json()).toMatchObject({ declencheur: 'planifiee' });
    expect(consigne()).not.toContain('SYNTHÈSE DE LA SEMAINE');
  });

  it('lance une ronde ciblée quand une action vient de dépasser son échéance, au plus toutes les quatre heures', async () => {
    const midi = new Date('2026-12-08T12:00:00.000Z');
    await t.svc.db.q(
      `UPDATE grc_objects SET data = data || '{"dueAt":"2026-12-08T09:00:00.000Z"}'::jsonb WHERE id = $1`,
      [sansResponsable],
    );
    // Inactif par défaut.
    expect(await tic(midi)).toBeNull();
    expect((await regler({ rondesSurEvenement: true })).statusCode).toBe(200);
    const id = await tic(midi);
    expect(id).toBeTruthy();
    expect((await admin.get(`${base}/rondes/${id}`)).json()).toMatchObject({ declencheur: 'evenement' });
    expect(consigne()).toContain('1 action(s) viennent de dépasser leur échéance, 0 écart(s) ont été créés');
    // Rien de nouveau, ou trop tôt : pas de nouvelle ronde.
    expect(await tic(new Date('2026-12-08T13:00:00.000Z'))).toBeNull();
    expect(await tic(new Date('2026-12-08T17:00:00.000Z'))).toBeNull();
    expect((await regler({ rondesSurEvenement: false, jourSynthese: 0 })).statusCode).toBe(200);
  });
});
