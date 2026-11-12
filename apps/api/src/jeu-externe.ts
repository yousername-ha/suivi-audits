/* Chargement d'un jeu de données fourni de l'extérieur (fichier JSON lu sur l'entrée standard par `suivi charger-jeu`).
   Le dépôt ne contient aucun jeu : celui-ci reste chez la personne qui le charge. Comme le jeu de test, il se charge
   uniquement à la demande, au nom d'un compte administrateur, sur une instance dont le pilotage est vide, et toutes les
   écritures passent par l'API publique (mêmes validations que l'interface), sauf l'état de l'outil de suivi, écrit par
   son service. Dans les textes, « @J+30 » ou « @J-12 » devient la date du jour décalée, « @MOI » l'identifiant du compte :
   retards et échéances restent vrais quel que soit le jour du chargement. */
import crypto from 'node:crypto';
import { methodTemplate } from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { couvertureEtDda, rattacherStandards } from './demo-normes.js';
import type { Services } from './services.js';

type Json = Record<string, unknown>;
const texte = (max: number) => z.string().max(max);
const Profil = z.enum(['mise_en_oeuvre', 'audit_interne']);
export const JeuExterne = z
  .object({
    nom: texte(200),
    /** État de l'outil de suivi : périmètre, processus, objectifs, indicateurs, parties intéressées, fournisseurs, plans… */
    etat: z.record(z.string(), z.unknown()).default({}),
    /** Rattache les référentiels ISO/IEC 27001 et HDS de la bibliothèque au pilotage commun. */
    referentiels: z.boolean().default(true),
    /** Renseigne en plus une couverture et une déclaration d'applicabilité de démonstration. */
    couverture: z.boolean().default(false),
    risques: z
      .array(
        z.object({
          code: texte(20),
          nom: texte(200),
          domaine: texte(80).default('SSI'),
          description: texte(2000).default(''),
          revue: texte(20).default('@J+180'),
          gravite: z.number().int().min(1).max(4).default(2),
          vraisemblance: z.number().int().min(1).max(4).default(2),
          strategie: z.enum(['reduce', 'accept', 'transfer', 'avoid']).default('reduce'),
        }),
      )
      .max(100)
      .default([]),
    actions: z
      .array(
        z.object({
          nom: texte(200),
          description: texte(2000).default(''),
          statut: texte(40).default('todo'),
          echeance: texte(20),
          priorite: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
          /** Vrai : l'action est attribuée au compte qui charge le jeu (il recevra les rappels de l'assistant). */
          aMoi: z.boolean().default(true),
        }),
      )
      .max(300)
      .default([]),
    ecarts: z
      .array(
        z.object({
          nom: texte(200),
          description: texte(2000).default(''),
          source: z.enum(['', 'AFNOR', 'Interne']).default('Interne'),
          classification: texte(40).default(''),
          nature: z.enum(['observation', 'nonconformity', 'opportunity']).default('nonconformity'),
          statut: z.enum(['draft', 'open', 'progress', 'effectiveness', 'closed']).default('open'),
          echeance: texte(20).default(''),
          cause: texte(2000).default(''),
        }),
      )
      .max(300)
      .default([]),
    /** Autres fiches du registre, telles que l'API les attend : { kind, name, data }. */
    objets: z
      .array(z.object({ kind: texte(40), name: texte(200), data: z.record(z.string(), z.unknown()) }))
      .max(500)
      .default([]),
    documents: z
      .array(
        z.object({
          fichier: texte(200),
          titre: texte(200),
          categorie: texte(80).default(''),
          classification: z.enum(['public', 'interne', 'restreint', 'confidentiel']).default('interne'),
          description: texte(2000).default(''),
          base64: z.string().max(12_000_000),
        }),
      )
      .max(200)
      .default([]),
    liens: z
      .array(
        z.object({
          title: texte(200),
          url: texte(2000),
          description: texte(4000).default(''),
          category: texte(80).default(''),
        }),
      )
      .max(200)
      .default([]),
    assistant: z
      .object({
        contexte: texte(4000).default(''),
        missions: z
          .array(z.object({ profil: Profil, consigne: texte(2000) }))
          .max(20)
          .default([]),
        methodes: z
          .array(z.object({ profil: Profil, titre: texte(120), contenu: texte(2000) }))
          .max(20)
          .default([]),
      })
      .default({ contexte: '', missions: [], methodes: [] }),
  })
  .strict();
export type JeuExterne = z.infer<typeof JeuExterne>;

export interface BilanJeuExterne {
  nom: string;
  etat: boolean;
  referentiels: string[];
  risques: number;
  actions: number;
  ecarts: number;
  objets: number;
  documents: number;
  liens: number;
  missions: number;
  methodes: number;
}

const decaler = (jours: number) => new Date(Date.now() + jours * 86400e3).toISOString().slice(0, 10);
/** Remplace « @J±N » et « @MOI » dans toutes les chaînes d'une valeur. */
export function resoudre<T>(valeur: T, moi: string): T {
  if (typeof valeur === 'string')
    return valeur.replace(/@J([+-]\d{1,4})/g, (_t, n: string) => decaler(Number(n))).replace(/@MOI/g, moi) as T;
  if (Array.isArray(valeur)) return valeur.map((v) => resoudre(v, moi)) as T;
  if (valeur && typeof valeur === 'object')
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, resoudre(v, moi)])) as T;
  return valeur;
}

export async function chargerJeuExterne(
  svc: Services,
  app: FastifyInstance,
  compte: string,
  entree: unknown,
  cfg: { publicUrl: string },
): Promise<BilanJeuExterne> {
  const u = await svc.db.k
    .selectFrom('users')
    .select('id')
    .where(sql<string>`lower(username)`, '=', sql<string>`lower(${compte})`)
    .where('disabled', '=', false)
    .executeTakeFirst();
  if (!u) throw new Error(`Compte inconnu ou désactivé : ${compte}`);
  const jeu = resoudre(JeuExterne.parse(entree), u.id);
  const jeton = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const hash = crypto.createHash('sha256').update(jeton).digest();
  await svc.db.k
    .insertInto('sessions')
    .values({
      id_hash: hash,
      user_id: u.id,
      csrf,
      mfa_ok: true,
      ip: '127.0.0.1',
      user_agent: 'charger-jeu',
      expires_at: sql<Date>`now() + interval '1 hour'`,
    })
    .execute();
  const origine = new URL(cfg.publicUrl).origin;
  let appels = 0;
  const appel = async (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    url: string,
    json?: unknown,
    headers: Record<string, string> = {},
    brut?: Buffer,
  ) =>
    app.inject({
      method,
      url,
      // L'adresse source change tous les 300 appels pour ne pas épuiser la limite par adresse d'une instance réglée bas.
      remoteAddress: `127.0.${Math.floor(appels++ / 300) % 250}.1`,
      headers: {
        'x-forwarded-proto': 'https',
        host: new URL(cfg.publicUrl).host,
        cookie: `suivi_sid=${jeton}; __Host-suivi_sid=${jeton}`,
        ...(method === 'GET' ? {} : { origin: origine, 'x-csrf-token': csrf }),
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      payload: brut ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
  const exiger = async <T>(res: Awaited<ReturnType<typeof appel>>, quoi: string): Promise<T> => {
    if (res.statusCode >= 400) throw new Error(`${quoi} : ${res.statusCode} ${res.body.slice(0, 400)}`);
    return (res.body ? res.json() : {}) as T;
  };
  const bilan: BilanJeuExterne = {
    nom: jeu.nom,
    etat: false,
    referentiels: [],
    risques: 0,
    actions: 0,
    ecarts: 0,
    objets: 0,
    documents: 0,
    liens: 0,
    missions: 0,
    methodes: 0,
  };
  const commun = '00000000-0000-4000-8000-000000000001';
  try {
    // 1) État de l'outil de suivi : refusé si l'instance contient déjà des données de pilotage.
    const courant = await exiger<Json>(await appel('GET', '/api/suivi/etat'), 'Lecture de l’état');
    const existants = ['processes', 'objectives', 'indicators', 'suppliers', 'findings', 'interested'].filter(
      (k) => Array.isArray(courant[k]) && (courant[k] as unknown[]).length > 0,
    );
    if (existants.length)
      throw new Error(
        `L’instance contient déjà des données de pilotage (${existants.join(', ')}) : un jeu se charge sur une instance vide.`,
      );
    if (Object.keys(jeu.etat).length) {
      await svc.db.tx(async (c, k) => {
        await k.selectFrom('app_state').select('id').where('id', '=', 1).forUpdate().execute();
        const r = await svc.legacy.nativeWrite(c, { ...courant, ...jeu.etat } as JsonObject, null, null, 'Jeu externe');
        if (r.conflict) throw new Error('Écriture de l’état : conflit de version.');
      }, compte);
      bilan.etat = true;
    }
    // 2) Référentiels de la bibliothèque, rattachés au pilotage commun.
    if (jeu.referentiels) {
      const ctx = { appel, exiger, commun, decaler, methodeId: '' };
      const normes = await rattacherStandards(ctx);
      bilan.referentiels = [normes.iso.identifier, normes.hds.identifier];
      if (jeu.couverture) await couvertureEtDda(ctx, normes);
    }
    const creer = async (corps: unknown, quoi: string) =>
      exiger<{ id: string; version: number }>(await appel('POST', `/api/grc/${commun}/objects`, corps), quoi);
    // 3) Risques appréciés selon la méthode EBIOS RM de la bibliothèque.
    if (jeu.risques.length) {
      const methode = methodTemplate('ebios_rm');
      const apercu = await exiger<{ previewId: string }>(
        await appel('POST', `/api/grc/${commun}/methods/preview`, { id: null, definition: methode }),
        'Simulation de la méthode',
      );
      const m = await exiger<{ methodId: string }>(
        await appel(
          'POST',
          `/api/grc/${commun}/methods/publish`,
          {
            id: null,
            definition: methode,
            previewId: apercu.previewId,
            reason: 'Jeu de données chargé.',
            confirm: 'PUBLIER',
          },
          { 'if-match': '"0"' },
        ),
        'Publication de la méthode',
      );
      for (const r of jeu.risques) {
        const c = await creer(
          {
            kind: 'risk',
            name: r.nom,
            data: {
              description: r.description,
              code: r.code,
              ownerId: null,
              methodId: m.methodId,
              methodVersion: 1,
              domain: r.domaine,
              entity: jeu.nom,
              scope: '',
              strategy: r.strategie,
              acceptanceReason: '',
              reviewAt: r.revue,
              stages: {},
            },
          },
          `Risque ${r.code}`,
        );
        const notes = {
          dimensions: { severity: `impact_${r.gravite}` },
          likelihood: `likelihood_${r.vraisemblance}`,
          level: null,
          inputs: {},
        };
        const intention = {
          ratings: { gross: notes, residual: notes },
          rationale: 'Appréciation initiale.',
          decision: 'draft',
        };
        const p = await exiger<{ previewId: string }>(
          await appel('POST', `/api/grc/${commun}/risks/${c.id}/preview`, intention),
          `Simulation du risque ${r.code}`,
        );
        await exiger(
          await appel(
            'POST',
            `/api/grc/${commun}/risks/${c.id}/evaluate`,
            { ...intention, previewId: p.previewId, requestId: crypto.randomUUID(), confirm: 'ENREGISTRER' },
            { 'if-match': `"${c.version}"` },
          ),
          `Appréciation du risque ${r.code}`,
        );
        bilan.risques++;
      }
    }
    // 4) Actions, écarts et autres fiches.
    for (const a of jeu.actions) {
      await creer(
        {
          kind: 'action',
          name: a.nom,
          data: {
            description: a.description,
            status: a.statut,
            ownerId: a.aMoi ? u.id : null,
            startAt: null,
            dueAt: `${a.echeance}T09:00:00Z`,
            priority: a.priorite,
            category: 'action',
            justification: '',
            reminderDays: 7,
            dependencies: [],
          },
        },
        `Action « ${a.nom} »`,
      );
      bilan.actions++;
    }
    for (const e of jeu.ecarts) {
      const c = await creer(
        {
          kind: 'nonconformity',
          name: e.nom,
          data: {
            description: e.description,
            source: e.source,
            classification: e.classification,
            findingType: e.nature,
            dueAt: e.echeance,
            cause: e.cause,
          },
        },
        `Écart « ${e.nom} »`,
      );
      // Un écart ne se crée pas clos par l'API : l'état demandé est posé directement, comme pour le jeu de test.
      if (e.statut !== 'open')
        await svc.db.k
          .updateTable('grc_objects')
          .set({ data: sql`jsonb_set(data, '{status}', ${JSON.stringify(e.statut)}::jsonb)` })
          .where('id', '=', c.id)
          .execute();
      bilan.ecarts++;
    }
    for (const o of jeu.objets) {
      await creer(o, `Fiche « ${o.name} »`);
      bilan.objets++;
    }
    // 5) Documents et liens.
    for (const d of jeu.documents) {
      await exiger(
        await appel(
          'POST',
          '/api/documents',
          undefined,
          {
            'content-type': 'application/octet-stream',
            'x-file-name': encodeURIComponent(d.fichier),
            'x-meta': encodeURIComponent(
              JSON.stringify({
                title: d.titre,
                category: d.categorie,
                classification: d.classification,
                description: d.description,
              }),
            ),
          },
          Buffer.from(d.base64, 'base64'),
        ),
        `Document « ${d.titre} »`,
      );
      bilan.documents++;
    }
    for (const l of jeu.liens) {
      await exiger(await appel('POST', '/api/links', l), `Lien « ${l.title} »`);
      bilan.liens++;
    }
    // 6) Assistant : contexte de l'organisation, missions et fiches de méthode (validées, rédigées par une personne).
    if (jeu.assistant.contexte) {
      const r = await exiger<Json & { profils: Json[]; version: number }>(
        await appel('GET', '/api/assistant/reglages'),
        'Lecture des réglages de l’assistant',
      );
      await exiger(
        await appel('PUT', '/api/assistant/reglages', {
          actif: r.actif,
          adresse: r.adresse,
          modele: r.modele,
          budgetJetonsJour: r.budgetJetonsJour,
          contexte: jeu.assistant.contexte,
          profils: r.profils.map((p) => ({ id: p.id, actif: p.actif, perimetres: p.perimetres })),
          version: r.version,
        }),
        'Contexte de l’assistant',
      );
    }
    for (const m of jeu.assistant.missions) {
      await exiger(await appel('POST', '/api/assistant/missions', m), 'Mission de l’assistant');
      bilan.missions++;
    }
    for (const m of jeu.assistant.methodes) {
      await exiger(await appel('POST', '/api/assistant/methodes', m), 'Fiche de méthode');
      bilan.methodes++;
    }
    return bilan;
  } finally {
    await svc.db.k.deleteFrom('sessions').where('id_hash', '=', hash).execute();
  }
}
