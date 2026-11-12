/* Assistant RSSI intégré (ADR 0086, lot A1) : droit dédié, réglages et clé scellée, conversations, outils de lecture bornés à
   l'intersection des droits de la personne et des périmètres du profil, budget, journal sans contenu. Le modèle est remplacé
   par un faux transport scripté : aucun appel réseau. Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConversationAssistantDetailDto, EtatAssistantDto, ReglagesAssistantDto } from '@suivi/shared';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';
import { OUTILS, serialiser } from '../src/assistant/outils.js';
import { HttpError } from '../src/http/errors.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const CLE = 'cle-fictive-de-test-0123456789';
const ADRESSE = 'https://modele.example.invalid/v1';

/** Faux modèle : chaque réponse est décidée par le test à partir de la demande reçue. */
class FauxModele implements TransportModele {
  demandes: { adresse: string; cle: string; demande: DemandeModele }[] = [];
  script: (d: DemandeModele, n: number) => MessageModele | Error = () => ({ role: 'assistant', content: 'prêt' });
  disponible = true;
  declare() {
    return this.disponible;
  }
  async completer(adresse: string, cle: string, demande: DemandeModele): Promise<ReponseModele> {
    // Copie : la boucle complète la même liste de messages d'un tour à l'autre.
    this.demandes.push({ adresse, cle, demande: structuredClone(demande) });
    const r = this.script(demande, this.demandes.length);
    if (r instanceof Error) throw r;
    return { message: r, jetonsEntree: 100, jetonsSortie: 20 };
  }
}
const appel = (id: string, nom: string, args: unknown): MessageModele => ({
  role: 'assistant',
  content: '',
  tool_calls: [{ id, type: 'function', function: { name: nom, arguments: JSON.stringify(args) } }],
});
/** Dernier résultat d'outil remis au modèle. */
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
let admin: Agent, contributeur: Agent, invite: Agent;
let ouvert: string, ferme: string, horsProfil: string, enRetard: string;
const base = '/api/assistant';

const reglages = async () => (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
const regler = async (
  a: Agent,
  change: Partial<Pick<ReglagesAssistantDto, 'actif' | 'adresse' | 'modele' | 'budgetJetonsJour'>> & {
    profils?: { id: string; actif: boolean; perimetres: string[] }[];
    version?: number;
  },
) => {
  const cur = await reglages();
  return a.put(`${base}/reglages`, {
    actif: cur.actif,
    adresse: cur.adresse,
    modele: cur.modele,
    budgetJetonsJour: cur.budgetJetonsJour,
    profils: cur.profils.map(({ id, actif, perimetres }) => ({ id, actif, perimetres })),
    version: cur.version,
    ...change,
  });
};
/** Pose une question et attend la réponse préparée en tâche de fond. */
const demander = async (a: Agent, conversation: string, texte: string) => {
  const r = await a.post(`${base}/conversations/${conversation}/messages`, { texte });
  if (r.statusCode !== 202) return r;
  await t.svc.assistant.attendre(conversation);
  return r;
};
const fil = async (a: Agent, conversation: string) =>
  (await a.get(`${base}/conversations/${conversation}`)).json() as ConversationAssistantDetailDto;
const ouvrir = async (a: Agent, profil = 'mise_en_oeuvre') => {
  const r = await a.post(`${base}/conversations`, { profil });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
};

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  admin = await login(t, await makeUser(t, 'as_admin', 'admin'));
  contributeur = await login(t, await makeUser(t, 'as_rw', 'rw'));
  // Rôle personnalisé : le droit dédié, plus la lecture des écarts ; aucune appartenance aux périmètres restreints.
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_assistant', 'Utilisateur de l’assistant', $1)",
    [['assistant:lire', 'ecarts:lire', 'pilotage:lire']],
  );
  const u = await makeUser(t, 'as_invite', 'r_assistant');

  const creer = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'Périmètre fictif', timezone: 'Europe/Paris' })).json()
      .id as string;
  ouvert = await creer('Périmètre ouvert à l’invité');
  ferme = await creer('Périmètre fermé à l’invité');
  horsProfil = await creer('Périmètre hors du profil');
  expect((await admin.put(`/api/grc/${ouvert}/members`, { userId: u.id, write: false })).statusCode).toBe(204);
  // Connexion après l'ajout au périmètre : une modification d'appartenance ferme les sessions ouvertes du compte.
  invite = await login(t, u);

  const poser = async (smsi: string, corps: unknown) => {
    const r = await admin.post(`/api/grc/${smsi}/objects`, corps);
    expect(r.statusCode, r.body).toBe(200);
    return r.json().id as string;
  };
  enRetard = await poser(ferme, action('Action fictive en retard', { dueAt: '2020-01-01T00:00:00.000Z' }));
  await poser(ferme, action('Action fictive à venir', { dueAt: '2999-01-01T00:00:00.000Z' }));
  // Une action se crée ouverte : la clôture est posée directement en base (statut terminal de la politique par défaut).
  const close = await poser(ferme, action('Action fictive close', { dueAt: '2020-01-01T00:00:00.000Z' }));
  await t.svc.db.q(`UPDATE grc_objects SET data = jsonb_set(data, '{status}', '"done"') WHERE id = $1`, [close]);
  await poser(ouvert, action('Action fictive du périmètre ouvert', { dueAt: '2020-06-01T00:00:00.000Z' }));
  await poser(horsProfil, action('Action fictive hors profil', { dueAt: '2020-01-01T00:00:00.000Z' }));
});
afterAll(() => t.close());

describe('assistant : droit dédié et réglages', () => {
  it('le droit dédié n’est porté que par les rôles administrateur et RSSI', async () => {
    for (const url of [`${base}/etat`, `${base}/conversations`])
      expect((await contributeur.get(url)).statusCode).toBe(403);
    expect((await contributeur.post(`${base}/conversations`, { profil: 'mise_en_oeuvre' })).statusCode).toBe(403);
    // Le droit d'utiliser l'assistant ne donne pas celui de le régler.
    expect((await invite.get(`${base}/etat`)).statusCode).toBe(200);
    expect((await invite.get(`${base}/reglages`)).statusCode).toBe(403);
    expect((await invite.put(`${base}/reglages/cle`, { cle: CLE })).statusCode).toBe(403);
  });

  it('inactif tant qu’il n’est pas réglé : aucun profil, aucune conversation possible', async () => {
    const e = (await admin.get(`${base}/etat`)).json() as EtatAssistantDto;
    expect(e).toMatchObject({ actif: false, pret: false, fournisseur: null, modele: null, profils: [] });
    expect(e.motif).toContain('activé');
    expect((await admin.post(`${base}/conversations`, { profil: 'mise_en_oeuvre' })).statusCode).toBe(409);
    expect((await reglages()).profils.every((p) => !p.actif && p.perimetres.length === 0)).toBe(true);
  });

  it('refuse une adresse sans HTTPS ou avec identifiants, une activation sans modèle, un périmètre inconnu', async () => {
    for (const adresse of [
      'http://modele.example.invalid/v1',
      'https://u:p@modele.example.invalid/v1',
      'pas une adresse',
    ])
      expect((await regler(admin, { adresse })).statusCode).toBe(422);
    expect((await regler(admin, { actif: true, adresse: '', modele: '' })).statusCode).toBe(422);
    const inconnu = '11111111-1111-4111-8111-111111111111';
    const r = await regler(admin, {
      profils: [
        { id: 'mise_en_oeuvre', actif: true, perimetres: [inconnu] },
        { id: 'audit_interne', actif: false, perimetres: [] },
      ],
    });
    expect(r.statusCode, r.body).toBe(422);
  });

  it('enregistre les réglages, refuse une version périmée, garde la clé en écriture seule', async () => {
    const avant = await reglages();
    const ok = await regler(admin, {
      actif: true,
      adresse: ADRESSE,
      modele: 'modele-fictif',
      profils: [
        { id: 'mise_en_oeuvre', actif: true, perimetres: [ouvert, ferme] },
        { id: 'audit_interne', actif: false, perimetres: [] },
      ],
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().version).toBe(avant.version + 1);
    expect((await regler(admin, { version: avant.version })).statusCode).toBe(409);

    expect((await admin.get(`${base}/etat`)).json().motif).toContain('clé');
    expect((await admin.put(`${base}/reglages/cle`, { cle: 'court' })).statusCode).toBe(422);
    expect((await admin.put(`${base}/reglages/cle`, { cle: CLE })).statusCode).toBe(204);
    const apres = await admin.get(`${base}/reglages`);
    expect(apres.json().cleDefinie).toBe(true);
    expect(apres.body).not.toContain(CLE);
    // Scellée en base, absente du journal d'audit.
    const stocke = await t.svc.db.one<{ value: unknown }>("SELECT value FROM settings WHERE key = 'secret:assistant'");
    expect(JSON.stringify(stocke)).not.toContain(CLE);
    const journal = await t.svc.db.q("SELECT details::text AS d FROM audit_log WHERE action LIKE 'assistant.%'");
    expect(journal.rows.length).toBeGreaterThanOrEqual(2);
    expect(journal.rows.some((l) => String(l.d).includes(CLE))).toBe(false);

    const e = (await admin.get(`${base}/etat`)).json() as EtatAssistantDto;
    expect(e).toMatchObject({
      pret: true,
      motif: null,
      fournisseur: 'modele.example.invalid',
      modele: 'modele-fictif',
    });
    expect(e.profils.map((p) => p.id)).toEqual(['mise_en_oeuvre']);
    expect(e.profils[0]!.perimetres.map((p) => p.id).sort()).toEqual([ouvert, ferme].sort());
  });

  it('l’état ne nomme à une personne que les périmètres qu’elle peut ouvrir', async () => {
    const e = (await invite.get(`${base}/etat`)).json() as EtatAssistantDto;
    expect(e.profils[0]!.perimetres.map((p) => p.id)).toEqual([ouvert]);
    expect(JSON.stringify(e)).not.toContain('fermé');
  });

  it('teste le modèle sans donnée métier et dit pourquoi l’appel échoue', async () => {
    modele.demandes = [];
    const ok = await admin.post(`${base}/reglages/test`);
    expect(ok.json()).toEqual({ ok: true, detail: 'Le modèle a répondu.' });
    expect(modele.demandes).toHaveLength(1);
    expect(modele.demandes[0]).toMatchObject({ adresse: ADRESSE, cle: CLE });
    expect(modele.demandes[0]!.demande.tools).toBeUndefined();
    modele.script = () => new HttpError(502, 'Le fournisseur du modèle refuse la clé enregistrée.');
    expect((await admin.post(`${base}/reglages/test`)).json()).toEqual({
      ok: false,
      detail: 'Le fournisseur du modèle refuse la clé enregistrée.',
    });
    modele.disponible = false;
    expect((await admin.post(`${base}/reglages/test`)).json().detail).toContain('relais');
    expect((await admin.get(`${base}/etat`)).json().pret).toBe(false);
    modele.disponible = true;
  });
});

describe('assistant : conversations et outils de lecture', () => {
  it('répond à partir des outils, cite ses sources, compte les jetons et trace l’échange sans contenu', async () => {
    const id = await ouvrir(admin);
    modele.demandes = [];
    modele.script = (d, n) => {
      if (n === 1) return appel('a1', 'lister_perimetres', {});
      if (n === 2) return appel('a2', 'actions_en_retard', { perimetre: ferme });
      const lu = dernierOutil(d) as { enRetard: { nom: string }[] };
      return { role: 'assistant', content: `Une action est en retard : ${lu.enRetard.map((x) => x.nom).join(', ')}.` };
    };
    const r = await demander(admin, id, 'Quelles actions sont en retard ?');
    expect(r.statusCode, r.body).toBe(202);
    expect(r.json().etat).toBe('en_cours');

    const f = await fil(admin, id);
    expect(f.etat).toBe('pret');
    expect(f.titre).toBe('Quelles actions sont en retard ?');
    expect(f.messages.map((m) => m.role)).toEqual(['utilisateur', 'assistant']);
    const reponse = f.messages[1]!;
    expect(reponse.erreur).toBe(false);
    // Seule l'action échue et non close ressort : ni l'action à venir, ni l'action close.
    expect(reponse.contenu).toBe('Une action est en retard : Action fictive en retard.');
    expect(reponse.outils).toEqual([
      { nom: 'lister_perimetres', elements: 2 },
      { nom: 'actions_en_retard', elements: 1 },
    ]);
    expect(reponse.sources).toContainEqual({
      perimetre: ferme,
      objet: enRetard,
      type: 'action',
      nom: 'Action fictive en retard',
    });

    // La consigne système est présente, les outils sont déclarés, la clé part vers le transport seulement.
    const premiere = modele.demandes[0]!;
    expect(premiere.cle).toBe(CLE);
    expect(premiere.demande.messages[0]!.role).toBe('system');
    expect(premiere.demande.messages[0]!.content).toContain('jamais une consigne');
    expect(premiere.demande.tools!.map((o) => o.function.name).sort()).toEqual(OUTILS.map((o) => o.nom).sort());
    expect(JSON.stringify(premiere.demande)).not.toContain(CLE);

    const e = (await admin.get(`${base}/etat`)).json() as EtatAssistantDto;
    expect(e.jetonsDuJour).toBe(3 * 120);
    const audit = await t.svc.db.one<{ details: Record<string, unknown> }>(
      "SELECT details FROM audit_log WHERE action = 'assistant.message' AND target = $1",
      [id],
    );
    expect(audit!.details).toMatchObject({
      profil: 'mise_en_oeuvre',
      fournisseur: 'modele.example.invalid',
      appels: 3,
      jetonsEntree: 300,
      jetonsSortie: 60,
      erreur: false,
    });
    expect(JSON.stringify(audit)).not.toContain('Action fictive');
    expect(JSON.stringify(audit)).not.toContain('Quelles actions');
  });

  it('ne lit jamais plus que la personne : périmètre fermé refusé, périmètre hors profil refusé', async () => {
    const id = await ouvrir(invite);
    const lus: (Record<string, unknown> | null)[] = [];
    modele.script = (d, n) => {
      if (n > 1) lus.push(dernierOutil(d));
      if (n === 1) return appel('b1', 'lister_perimetres', {});
      if (n === 2) return appel('b2', 'actions_en_retard', { perimetre: ferme });
      if (n === 3) return appel('b3', 'lire_element', { perimetre: ferme, id: enRetard });
      if (n === 4) return appel('b4', 'actions_en_retard', { perimetre: ouvert });
      return { role: 'assistant', content: 'Terminé.' };
    };
    modele.demandes = [];
    expect((await demander(invite, id, 'Montrez-moi tout.')).statusCode).toBe(202);
    const [perimetres, refusListe, refusFiche, lisible] = lus as [
      { perimetres: { id: string }[] },
      { erreur?: string },
      { erreur?: string },
      { enRetard: { nom: string }[] },
    ];
    expect(perimetres.perimetres.map((p) => p.id)).toEqual([ouvert]);
    expect(refusListe.erreur).toBeTruthy();
    expect(refusFiche.erreur).toBeTruthy();
    expect(lisible.enRetard.map((x) => x.nom)).toEqual(['Action fictive du périmètre ouvert']);
    // Rien du périmètre fermé n'a été remis au modèle, ni affiché en source.
    expect(JSON.stringify(modele.demandes)).not.toContain('Action fictive en retard');
    const f = await fil(invite, id);
    expect(f.messages[1]!.sources.every((s) => s.perimetre === ouvert)).toBe(true);

    // L'administrateur lit tous les périmètres, mais l'assistant reste borné à ceux du profil.
    const idAdmin = await ouvrir(admin);
    let horsProfilLu: Record<string, unknown> | null = null;
    modele.script = (d, n) => {
      if (n === 1) return appel('c1', 'actions_en_retard', { perimetre: horsProfil });
      horsProfilLu = dernierOutil(d);
      return { role: 'assistant', content: 'Terminé.' };
    };
    modele.demandes = [];
    await demander(admin, idAdmin, 'Et ce périmètre ?');
    expect(horsProfilLu).toEqual({ erreur: 'Ce périmètre n’est pas ouvert à ce profil de l’assistant.' });
    expect(JSON.stringify(modele.demandes)).not.toContain('Action fictive hors profil');
  });

  it('le fil d’une autre personne est introuvable ; un fil se supprime', async () => {
    const id = await ouvrir(admin);
    expect((await invite.get(`${base}/conversations/${id}`)).statusCode).toBe(404);
    expect((await invite.post(`${base}/conversations/${id}/messages`, { texte: 'Bonjour' })).statusCode).toBe(404);
    expect((await invite.del(`${base}/conversations/${id}`)).statusCode).toBe(404);
    expect(((await invite.get(`${base}/conversations`)).json() as { id: string }[]).some((c) => c.id === id)).toBe(
      false,
    );
    expect((await admin.del(`${base}/conversations/${id}`)).statusCode).toBe(204);
    expect((await admin.get(`${base}/conversations/${id}`)).statusCode).toBe(404);
  });

  it('un outil inconnu, des paramètres invalides ou trop de tours n’empêchent pas de conclure', async () => {
    const id = await ouvrir(admin);
    const lus: (Record<string, unknown> | null)[] = [];
    modele.script = (d, n) => {
      if (n > 1) lus.push(dernierOutil(d));
      if (n === 1) return appel('d1', 'supprimer_tout', {});
      if (n === 2) return appel('d2', 'lire_element', { perimetre: 'pas-un-identifiant', id: 'x' });
      // Le modèle réclame des outils sans fin : le dernier tour ne lui en offre plus.
      return d.tools ? appel('d' + n, 'lister_perimetres', {}) : { role: 'assistant', content: 'Conclusion.' };
    };
    modele.demandes = [];
    await demander(admin, id, 'Essai.');
    expect(lus[0]).toEqual({ erreur: 'Outil inconnu.' });
    expect(lus[1]).toEqual({ erreur: 'Paramètres invalides pour cet outil.' });
    expect(modele.demandes.at(-1)!.demande.tools).toBeUndefined();
    expect((await fil(admin, id)).messages.at(-1)).toMatchObject({ contenu: 'Conclusion.', erreur: false });
  });

  it('un échec du modèle donne un message d’erreur dans le fil, sans détail interne', async () => {
    const id = await ouvrir(admin);
    modele.script = () => new Error('ECONNRESET détail interne');
    await demander(admin, id, 'Bonjour');
    const f = await fil(admin, id);
    expect(f.etat).toBe('pret');
    expect(f.messages.at(-1)).toMatchObject({ role: 'assistant', erreur: true });
    expect(f.messages.at(-1)!.contenu).not.toContain('ECONNRESET');
    // Le fil reste utilisable ; le message en erreur n'est pas remis au modèle.
    modele.script = () => ({ role: 'assistant', content: 'Bonjour.' });
    modele.demandes = [];
    await demander(admin, id, 'Encore');
    expect(JSON.stringify(modele.demandes[0]!.demande.messages)).not.toContain('pas pu répondre');
  });

  it('s’arrête au budget quotidien, quand l’assistant est désactivé ou quand le module l’est', async () => {
    const id = await ouvrir(admin);
    expect((await regler(admin, { budgetJetonsJour: 1000 })).statusCode).toBe(200);
    expect((await admin.post(`${base}/conversations/${id}/messages`, { texte: 'Bonjour' })).statusCode).toBe(429);
    expect((await regler(admin, { budgetJetonsJour: 500_000, actif: false })).statusCode).toBe(200);
    expect((await admin.post(`${base}/conversations/${id}/messages`, { texte: 'Bonjour' })).statusCode).toBe(409);
    expect((await regler(admin, { actif: true })).statusCode).toBe(200);

    const intent = { changes: [{ id: 'assistant', enabled: false }], cascade: false };
    const apercu = await admin.post('/api/admin/modules/preview', intent);
    expect(apercu.statusCode, apercu.body).toBe(200);
    const applique = await admin.put(
      '/api/admin/modules',
      { intent, previewId: apercu.json().previewId, confirm: 'VALIDER' },
      { 'if-match': `"${apercu.json().version}"` },
    );
    expect(applique.statusCode, applique.body).toBe(200);
    expect((await admin.get(`${base}/etat`)).statusCode).toBe(409);
    expect((await admin.post(`${base}/conversations/${id}/messages`, { texte: 'Bonjour' })).statusCode).toBe(409);
  });
});

describe('assistant : garde-fous de construction', () => {
  it('aucun outil n’appelle une écriture', () => {
    const source = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/assistant/outils.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /\.(createObject|updateObject|insert|write|archive|link|linkIn|unlink|createSmsi|updateSmsi|setMember|contribuer|decide|evaluer|creer|tx|q)\(/,
    );
    expect(OUTILS.map((o) => o.nom)).toEqual([
      'lister_perimetres',
      'synthese_perimetre',
      'lister_elements',
      'lire_element',
      'historique_element',
      'actions_en_retard',
      'couverture_referentiels',
      'applicabilite_hds',
      'chercher_documents',
      'lire_document',
      'signaux',
    ]);
  });

  it('borne ce qui est remis au modèle et le dit', () => {
    const liste = Array.from({ length: 400 }, (_, i) => ({ id: i, nom: 'Élément fictif numéro ' + i }));
    const texte = serialiser({ total: 400, elements: liste }, 2000);
    expect(texte.length).toBeLessThanOrEqual(2000);
    const lu = JSON.parse(texte) as { total: number; elements: unknown[]; tronque: string };
    expect(lu.total).toBe(400);
    expect(lu.elements.length).toBeLessThan(400);
    expect(lu.tronque).toContain('raccourcie');
    expect(JSON.parse(serialiser({ texte: 'x'.repeat(5000) }, 1000))).toHaveProperty('tronque');
  });
});
