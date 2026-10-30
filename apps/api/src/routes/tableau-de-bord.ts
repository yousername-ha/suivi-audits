/* Tableau de bord de l'accueil (ADR 0078) : disposition personnelle et disposition proposée par défaut (lot 2a), partage
   en lecture avec des comptes ou des groupes et choix du tableau affiché (lot 2b). Une disposition ne contient aucune
   donnée ; les valeurs affichées restent celles de la synthèse filtrée selon les droits de la personne qui regarde.
   Disposer et partager son tableau exigent le droit tableau_de_bord:modifier ; voir le tableau par défaut, ceux qu'on
   reçoit et revenir au défaut restent ouverts à toute personne connectée. Concurrence optimiste par If-Match (« 0 » :
   création). */
import {
  AnnuaireTableauDeBord,
  ChoixTableauBody,
  DispositionBody,
  DispositionEnregistree,
  DispositionsOut,
  lireDisposition,
  PartageBody,
  PartageOut,
  type DestinatairePartage,
  type Disposition,
  type TableauPartage,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Session } from '../auth.js';
import type { Kdb } from '../db/db.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import type { Services } from '../services.js';

type Ligne = { id: string; disposition: unknown; version: number; updated_by: string; updated_at: Date };

/** Compte actif : ni désactivé ni expiré (alias « u » de la table users ; fragment constant, sans valeur). */
const actif = sql<boolean>`(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at > now()))`;
const nomAffiche = sql<string>`coalesce(nullif(u.display_name, ''), u.username)`;

const lire = (k: Kdb, proprietaire: string | null, verrou = false) => {
  const q = k.selectFrom('tableaux_de_bord').select(['id', 'disposition', 'version', 'updated_by', 'updated_at']);
  const r = proprietaire ? q.where('proprietaire', '=', proprietaire) : q.where('proprietaire', 'is', null);
  return (verrou ? r.forUpdate() : r).executeTakeFirst();
};

const sortie = (l: Ligne | undefined): DispositionEnregistree | null =>
  l
    ? {
        id: l.id,
        disposition: lireDisposition(l.disposition),
        version: l.version,
        modifieePar: l.updated_by,
        modifieeLe: l.updated_at.toISOString(),
      }
    : null;

/** Tableaux partagés avec `u`, directement ou par l'un de ses groupes (jamais le sien). */
async function partagesRecus(k: Kdb, u: string): Promise<TableauPartage[]> {
  const rows = await k
    .selectFrom('tableaux_de_bord as t')
    .innerJoin('users as u', 'u.id', 't.proprietaire')
    .select(['t.id', 't.disposition', 't.version', 't.updated_by', 't.updated_at', nomAffiche.as('auteur')])
    .where('t.proprietaire', '!=', u)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('tableaux_de_bord_partages as p')
          .select('p.tableau')
          .whereRef('p.tableau', '=', 't.id')
          .where((e) =>
            e.or([
              e('p.utilisateur', '=', u),
              e('p.groupe', 'in', e.selectFrom('user_groups').select('group_id').where('user_id', '=', u)),
            ]),
          ),
      ),
    )
    .orderBy(sql`lower(${nomAffiche})`)
    .execute();
  return rows.map((r) => ({ ...sortie(r)!, auteur: r.auteur }));
}

async function dispositions(k: Kdb, u: string) {
  const [personnelle, organisation, partages, choix] = await Promise.all([
    lire(k, u),
    lire(k, null),
    partagesRecus(k, u),
    k.selectFrom('tableaux_de_bord_choix').select('tableau').where('utilisateur', '=', u).executeTakeFirst(),
  ]);
  const visibles = new Set([personnelle?.id, organisation?.id, ...partages.map((p) => p.id)].filter(Boolean));
  return {
    personnelle: sortie(personnelle),
    organisation: sortie(organisation),
    partages,
    // Un partage retiré (ou un tableau supprimé) ramène au choix automatique.
    choix: choix && visibles.has(choix.tableau) ? choix.tableau : null,
  };
}

/** Enregistre la disposition de `proprietaire` (null : par défaut) si sa version est toujours `attendue` (0 : aucune). */
async function enregistrer(
  svc: Services,
  proprietaire: string | null,
  disposition: Disposition,
  attendue: number,
  auteur: string,
): Promise<DispositionEnregistree> {
  try {
    await svc.db.tx(async (_c, k) => {
      const cur = await lire(k, proprietaire, true);
      if ((cur?.version ?? 0) !== attendue)
        throw conflict({
          version: cur?.version ?? 0,
          updated_by: cur?.updated_by,
          updated_at: cur?.updated_at.toISOString(),
        });
      const valeur = JSON.stringify(disposition);
      if (cur)
        await k
          .updateTable('tableaux_de_bord')
          .set((eb) => ({
            disposition: valeur,
            version: eb('version', '+', 1),
            updated_by: auteur,
            updated_at: new Date(),
          }))
          .where('id', '=', cur.id)
          .execute();
      else
        await k
          .insertInto('tableaux_de_bord')
          .values({
            proprietaire,
            nom: proprietaire ? 'Mon tableau de bord' : 'Tableau de bord de l’organisation',
            disposition: valeur,
            updated_by: auteur,
          })
          .execute();
      // Qui enregistre sa disposition l'affiche (lot 2b : abandon d'un tableau partagé choisi).
      if (proprietaire) await k.deleteFrom('tableaux_de_bord_choix').where('utilisateur', '=', proprietaire).execute();
    }, auteur);
  } catch (e) {
    // Deux créations simultanées : la seconde bute sur l'index unique, comme une version périmée.
    if ((e as { code?: string }).code === '23505') {
      const cur = await lire(svc.db.k, proprietaire);
      throw conflict({ version: cur?.version ?? 0, updated_by: cur?.updated_by });
    }
    throw e;
  }
  return sortie(await lire(svc.db.k, proprietaire))!;
}

const supprimer = (svc: Services, proprietaire: string | null) => {
  const q = svc.db.k.deleteFrom('tableaux_de_bord');
  return (proprietaire ? q.where('proprietaire', '=', proprietaire) : q.where('proprietaire', 'is', null))
    .returning('id')
    .executeTakeFirst();
};

const cle = (d: DestinatairePartage) => `${d.type}:${d.id}`;

/** Destinataires du tableau `tableau`, avec leur nom (compte : nom affiché ; groupe : nom). */
async function destinataires(k: Kdb, tableau: string): Promise<PartageOut['destinataires']> {
  const [comptes, groupes] = await Promise.all([
    k
      .selectFrom('tableaux_de_bord_partages as p')
      .innerJoin('users as u', 'u.id', 'p.utilisateur')
      .select(['u.id', nomAffiche.as('nom')])
      .where('p.tableau', '=', tableau)
      .execute(),
    k
      .selectFrom('tableaux_de_bord_partages as p')
      .innerJoin('groups as g', 'g.id', 'p.groupe')
      .select(['g.id', 'g.name as nom'])
      .where('p.tableau', '=', tableau)
      .execute(),
  ]);
  return [
    ...groupes.map((g) => ({ type: 'groupe' as const, ...g })),
    ...comptes.map((c) => ({ type: 'utilisateur' as const, ...c })),
  ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Remplace les destinataires du tableau personnel de `sess` (version `attendue`) ; renvoie les ajouts et retraits. */
async function partager(svc: Services, sess: Session, voulus: DestinatairePartage[], attendue: number) {
  const moi = sess.user.id;
  if (voulus.some((d) => d.type === 'utilisateur' && d.id === moi))
    throw new HttpError(422, 'Votre tableau de bord est déjà le vôtre : retirez-vous des destinataires.');
  return svc.db.tx(async (_c, k) => {
    const cur = await lire(k, moi, true);
    if (!cur)
      throw new HttpError(409, 'Enregistrez d’abord votre disposition pour pouvoir la partager.', {
        reason: 'tableau_absent',
      });
    if (cur.version !== attendue)
      throw conflict({ version: cur.version, updated_by: cur.updated_by, updated_at: cur.updated_at.toISOString() });
    const ids = (type: DestinatairePartage['type']) => voulus.filter((d) => d.type === type).map((d) => d.id);
    const comptes = ids('utilisateur');
    const groupes = ids('groupe');
    const trouves = [
      ...(comptes.length
        ? (await k.selectFrom('users as u').select('u.id').where('u.id', 'in', comptes).where(actif).execute()).map(
            (r) => `utilisateur:${r.id}`,
          )
        : []),
      ...(groupes.length
        ? (await k.selectFrom('groups').select('id').where('id', 'in', groupes).execute()).map((r) => `groupe:${r.id}`)
        : []),
    ];
    if (trouves.length !== voulus.length)
      throw new HttpError(422, 'Un destinataire n’existe pas ou n’est plus actif.', { reason: 'destinataire_inconnu' });
    const avant = (
      await k
        .selectFrom('tableaux_de_bord_partages')
        .select(['utilisateur', 'groupe'])
        .where('tableau', '=', cur.id)
        .execute()
    ).map((r) => (r.utilisateur ? `utilisateur:${r.utilisateur}` : `groupe:${r.groupe}`));
    const voulusCles = new Set(voulus.map(cle));
    const retires = avant.filter((x) => !voulusCles.has(x));
    const ajoutes = voulus.filter((d) => !avant.includes(cle(d)));
    for (const x of retires) {
      const [type, id] = x.split(':') as [DestinatairePartage['type'], string];
      await k
        .deleteFrom('tableaux_de_bord_partages')
        .where('tableau', '=', cur.id)
        .where(type === 'utilisateur' ? 'utilisateur' : 'groupe', '=', id)
        .execute();
    }
    if (ajoutes.length)
      await k
        .insertInto('tableaux_de_bord_partages')
        .values(
          ajoutes.map((d) => ({
            tableau: cur.id,
            utilisateur: d.type === 'utilisateur' ? d.id : null,
            groupe: d.type === 'groupe' ? d.id : null,
            created_by: sess.user.username,
          })),
        )
        .execute();
    const version = cur.version + 1;
    await k
      .updateTable('tableaux_de_bord')
      .set({ version, updated_by: sess.user.username, updated_at: new Date() })
      .where('id', '=', cur.id)
      .execute();
    return { tableau: cur.id, version, ajoutes: ajoutes.map(cle), retires };
  }, sess.user.username);
}

export const tableauDeBordRoutes = [
  route({
    method: 'GET',
    url: '/api/tableau-de-bord/disposition',
    summary:
      'Tableaux de bord de la personne : le sien, celui proposé par défaut, ceux partagés avec elle et celui qu’elle affiche',
    tags: ['Tableau de bord'],
    access: 'metier',
    response: DispositionsOut,
    handler: async ({ svc, s }) => dispositions(svc.db.k, (s as Session).user.id),
  }),
  route({
    method: 'PUT',
    url: '/api/tableau-de-bord/disposition',
    summary:
      'Enregistrement de sa disposition du tableau de bord (If-Match obligatoire, « 0 » pour la première) ; elle devient le tableau affiché',
    tags: ['Tableau de bord'],
    access: 'tableau_de_bord:modifier',
    body: DispositionBody,
    response: DispositionEnregistree,
    handler: async ({ svc, s, req, reply, body }) => {
      const sess = s as Session;
      const r = await enregistrer(svc, sess.user.id, body.disposition, requireIfMatch(req), sess.user.username);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/tableau-de-bord/disposition',
    summary:
      'Retour à la disposition par défaut : suppression de sa disposition personnelle et de ses partages (journalisée s’il y en avait)',
    tags: ['Tableau de bord'],
    access: 'metier',
    handler: async ({ svc, s, ip }) => {
      const sess = s as Session;
      const cur = await lire(svc.db.k, sess.user.id);
      const n = cur
        ? Number(
            (
              await svc.db.k
                .selectFrom('tableaux_de_bord_partages')
                .select(sql<number>`count(*)::int`.as('n'))
                .where('tableau', '=', cur.id)
                .executeTakeFirst()
            )?.n ?? 0,
          )
        : 0;
      await supprimer(svc, sess.user.id);
      if (n) await svc.db.audit(sess.user, ip, 'tableau_de_bord.partage_supprime', cur!.id, { destinataires: n });
      return undefined;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/tableau-de-bord/choix',
    summary: 'Tableau affiché à l’accueil : le sien, celui par défaut ou un tableau partagé (null : choix automatique)',
    tags: ['Tableau de bord'],
    access: 'metier',
    body: ChoixTableauBody,
    response: DispositionsOut,
    handler: async ({ svc, s, body }) => {
      const u = (s as Session).user.id;
      const tableau = body.tableau;
      if (tableau === null) await svc.db.k.deleteFrom('tableaux_de_bord_choix').where('utilisateur', '=', u).execute();
      else {
        const d = await dispositions(svc.db.k, u);
        const visibles = [d.personnelle?.id, d.organisation?.id, ...d.partages.map((p) => p.id)];
        if (!visibles.includes(tableau))
          throw new HttpError(404, 'Ce tableau de bord n’existe pas ou ne vous est pas partagé.');
        await svc.db.k
          .insertInto('tableaux_de_bord_choix')
          .values({ utilisateur: u, tableau })
          .onConflict((oc) => oc.column('utilisateur').doUpdateSet({ tableau, updated_at: new Date() }))
          .execute();
      }
      return dispositions(svc.db.k, u);
    },
  }),
  route({
    method: 'GET',
    url: '/api/tableau-de-bord/annuaire',
    summary: 'Destinataires possibles d’un partage : comptes actifs (nom affiché et identifiant) et groupes',
    tags: ['Tableau de bord'],
    access: 'tableau_de_bord:modifier',
    response: AnnuaireTableauDeBord,
    handler: async ({ svc, s }) => {
      const k = svc.db.k;
      const [utilisateurs, groupes] = await Promise.all([
        k
          .selectFrom('users as u')
          .select(['u.id', nomAffiche.as('nom'), 'u.username as identifiant'])
          .where(actif)
          .where('u.id', '!=', (s as Session).user.id)
          .orderBy(sql`lower(${nomAffiche})`)
          .limit(1000)
          .execute(),
        k
          .selectFrom('groups as g')
          .leftJoin('user_groups as ug', 'ug.group_id', 'g.id')
          .leftJoin('users as u', (j) => j.onRef('u.id', '=', 'ug.user_id').on(actif))
          .select(['g.id', 'g.name as nom', sql<number>`count(u.id)::int`.as('membres')])
          .groupBy('g.id')
          .orderBy(sql`lower(g.name)`)
          .execute(),
      ]);
      return { utilisateurs, groupes };
    },
  }),
  route({
    method: 'GET',
    url: '/api/tableau-de-bord/partage',
    summary: 'Destinataires de son tableau de bord (version 0 : pas encore enregistré)',
    tags: ['Tableau de bord'],
    access: 'tableau_de_bord:modifier',
    response: PartageOut,
    handler: async ({ svc, s }) => {
      const cur = await lire(svc.db.k, (s as Session).user.id);
      return cur
        ? { destinataires: await destinataires(svc.db.k, cur.id), version: cur.version }
        : { destinataires: [], version: 0 };
    },
  }),
  route({
    method: 'PUT',
    url: '/api/tableau-de-bord/partage',
    summary:
      'Partage de son tableau de bord, en lecture, avec des comptes ou des groupes (liste complète ; If-Match : version du tableau ; journalisé)',
    tags: ['Tableau de bord'],
    access: 'tableau_de_bord:modifier',
    body: PartageBody,
    response: PartageOut,
    handler: async ({ svc, s, ip, req, reply, body }) => {
      const sess = s as Session;
      const r = await partager(svc, sess, body.destinataires, requireIfMatch(req));
      if (r.ajoutes.length || r.retires.length)
        await svc.db.audit(sess.user, ip, 'tableau_de_bord.partage_modifie', r.tableau, {
          ajoutes: r.ajoutes,
          retires: r.retires,
          destinataires: body.destinataires.length,
        });
      setEtag(reply, r.version);
      return { destinataires: await destinataires(svc.db.k, r.tableau), version: r.version };
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/tableau-de-bord/disposition-par-defaut',
    summary:
      'Disposition proposée à tous par défaut (If-Match obligatoire, « 0 » pour la première ; dispositions personnelles inchangées)',
    tags: ['Tableau de bord'],
    access: 'administration:administrer',
    body: DispositionBody,
    response: DispositionEnregistree,
    handler: async ({ svc, s, ip, req, reply, body }) => {
      const sess = s as Session;
      const r = await enregistrer(svc, null, body.disposition, requireIfMatch(req), sess.user.username);
      await svc.db.audit(sess.user, ip, 'tableau_de_bord.defaut_enregistre', '', {
        version: r.version,
        dalles: body.disposition.dalles.length,
        masquees: body.disposition.dalles.filter((x) => x.masquee).length,
      });
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/tableau-de-bord/disposition-par-defaut',
    summary: 'Retour à la disposition standard pour tous ceux qui n’ont pas la leur',
    tags: ['Tableau de bord'],
    access: 'administration:administrer',
    handler: async ({ svc, s, ip }) => {
      const sess = s as Session;
      if (await supprimer(svc, null)) await svc.db.audit(sess.user, ip, 'tableau_de_bord.defaut_supprime');
      return undefined;
    },
  }),
];
