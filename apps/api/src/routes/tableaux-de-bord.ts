/* Tableaux de bord multiples de l'accueil et mode public (ADR 0109) ; remplacent les routes de l'ADR 0078, sans
   compatibilité (pas de reprise de données, AGENTS.md). Lectures ouvertes à tout compte connecté (garde « auth » : un
   compte sans droit métier voit les tableaux publics) ; la visibilité de chaque tableau est recontrôlée à chaque lecture
   (tableaux-de-bord/service.ts). Créer, modifier et partager ses tableaux : tableau_de_bord:modifier ; publier pour tous
   et ouvrir ses chiffres par un partage : tableau_de_bord:administrer ; tableaux proposés d'office :
   administration:administrer. Concurrence optimiste par If-Match sur la version du tableau (modification, suppression,
   partage). Journal : publication, retrait, partage modifié, tableaux proposés modifiés ou rétablis, suspension des
   chiffres ouverts à la première lecture refusée. Les lectures ne sont pas journalisées ; aucun événement temps réel. */
import {
  AnnuaireTableauDeBord,
  ChiffresPublics,
  CreerTableauBody,
  DEFS_MODELES,
  MAX_ONGLETS,
  MAX_TABLEAUX_PAR_COMPTE,
  ModifierTableauBody,
  OngletsBody,
  PartageTableauBody,
  PartageTableauOut,
  TableauDetail,
  TableauxOut,
  Uuid,
  type Disposition,
} from '@suivi/shared';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Session } from '../auth.js';
import type { Kdb } from '../db/db.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { permissionDenied, utilisateurPourCalcul } from '../rights.js';
import type { Services } from '../services.js';
import { chiffresDe } from '../tableaux-de-bord/chiffres.js';
import {
  actif,
  cleDestinataire,
  destinataires,
  detail,
  dispositionDeDepart,
  dispositionDuTableau,
  ecrireOnglets,
  exigerEcriture,
  introuvable,
  lecteur,
  lireLigne,
  nomAffiche,
  nomDe,
  ongletsEffectifs,
  ongletsVoulus,
  partagesAvec,
  SYSTEME,
  tableaux,
  verifierDestinataires,
  visibles,
  type Lecteur,
  type Ligne,
} from '../tableaux-de-bord/service.js';

const tags = ['Tableau de bord'];
const parId = z.object({ id: Uuid });

const conflitDe = (l: Ligne) =>
  conflict({ version: l.version, updated_by: l.updated_by, updated_at: l.updated_at.toISOString() });

const nomPris = () =>
  new HttpError(422, 'Vous avez déjà un tableau de bord de ce nom : choisissez-en un autre.', { reason: 'nom_pris' });

/** Le nom est libre parmi les tableaux du propriétaire, sans tenir compte de la casse (hors le tableau `sauf`). */
async function exigerNomLibre(k: Kdb, proprietaire: string, nom: string, sauf?: string) {
  let q = k
    .selectFrom('tableaux_de_bord')
    .select('id')
    .where('proprietaire', '=', proprietaire)
    .where(sql<string>`lower(nom)`, '=', sql<string>`lower(${nom})`);
  if (sauf) q = q.where('id', '!=', sauf);
  if (await q.executeTakeFirst()) throw nomPris();
}

/** Deux écritures simultanées du même nom butent sur l'index unique : même réponse qu'un nom déjà pris. */
async function avecNomUnique<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if ((e as { code?: string; constraint?: string }).constraint === 'tableaux_de_bord_nom_par_proprietaire')
      throw nomPris();
    throw e;
  }
}

/** Détail d'un tableau tel que la personne le voit (après une écriture). */
async function detailDe(svc: Services, lc: Lecteur, id: string) {
  const vus = await visibles(svc, lc);
  const v = vus.get(id);
  if (!v) throw introuvable();
  const onglets = await ongletsEffectifs(svc.db.k, lc, vus);
  return detail(v, onglets.includes(id), lc);
}

const compte = (d: Disposition) => ({
  dalles: d.dalles.length,
  masquees: d.dalles.filter((x) => x.masquee).length,
});

/** Suspension des chiffres ouverts d'un tableau : journalisée à la première lecture refusée après une lecture servie
    seulement (des chiffres jamais servis ne sont pas « suspendus »). */
async function suspendre(svc: Services, l: Ligne, raison: 'module_desactive' | 'auteur_inactif' | 'droit_retire') {
  const r = await svc.db.k
    .updateTable('tableaux_de_bord')
    .set({ chiffres_servis_le: null })
    .where('id', '=', l.id)
    .where('chiffres_servis_le', 'is not', null)
    .returning('id')
    .executeTakeFirst();
  if (r)
    await svc.db.audit({ username: SYSTEME }, null, 'tableau_de_bord.publication_suspendue', l.id, {
      nom: l.nom,
      public: l.public,
      raison,
    });
}

export const tableauxDeBordRoutes = [
  route({
    method: 'GET',
    url: '/api/tableaux-de-bord',
    summary:
      'Tableaux de bord de la personne : ses favoris dans son ordre (le premier s’ouvre à l’arrivée), tous les tableaux qu’elle peut afficher, et ses droits',
    tags,
    access: 'auth',
    response: TableauxOut,
    handler: async ({ svc, s }) => tableaux(svc, await lecteur(svc, (s as Session).user)),
  }),
  route({
    method: 'POST',
    url: '/api/tableaux-de-bord',
    summary:
      'Création d’un tableau de bord (au plus 20 par compte, nom unique) : vide, disposition standard ou copie de la disposition d’un de ses tableaux ou d’un tableau public ; il rejoint ses favoris s’il reste une place',
    tags,
    access: 'tableau_de_bord:modifier',
    body: CreerTableauBody,
    status: 201,
    response: TableauDetail,
    handler: async ({ svc, s, reply, body }) => {
      const sess = s as Session;
      const lc = await lecteur(svc, sess.user);
      const disposition = await dispositionDeDepart(svc, lc, body.depart);
      const onglets = await ongletsEffectifs(svc.db.k, lc, await visibles(svc, lc));
      const moi = sess.user.id;
      const id = await avecNomUnique(() =>
        svc.db.tx(async (_c, k) => {
          // Verrou du compte : deux créations simultanées ne dépassent pas la limite.
          await k.selectFrom('users').select('id').where('id', '=', moi).forNoKeyUpdate().execute();
          const { n } = await k
            .selectFrom('tableaux_de_bord')
            .select(sql<number>`count(*)::int`.as('n'))
            .where('proprietaire', '=', moi)
            .executeTakeFirstOrThrow();
          if (n >= MAX_TABLEAUX_PAR_COMPTE)
            throw new HttpError(
              422,
              `Vous avez déjà ${MAX_TABLEAUX_PAR_COMPTE} tableaux de bord : supprimez-en un pour en créer un autre.`,
              { reason: 'trop_de_tableaux' },
            );
          await exigerNomLibre(k, moi, body.nom);
          const { id } = await k
            .insertInto('tableaux_de_bord')
            .values({
              proprietaire: moi,
              nom: body.nom,
              disposition: JSON.stringify(disposition),
              updated_by: sess.user.username,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          // Il rejoint les favoris s'il reste une place (5 au plus) ; sinon, il est dans la liste du bouton déroulant.
          if (onglets.length < MAX_ONGLETS) await ecrireOnglets(k, moi, [...onglets, id]);
          return id;
        }, sess.user.username),
      );
      const out = await detailDe(svc, lc, id);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/tableaux-de-bord/onglets',
    summary:
      'Favoris de la personne, dans l’ordre (liste complète : un tableau absent sort de ses favoris ; au plus 5)',
    tags,
    access: 'auth',
    body: OngletsBody,
    response: TableauxOut,
    handler: async ({ svc, s, body }) => {
      const lc = await lecteur(svc, (s as Session).user);
      const ids = ongletsVoulus(await visibles(svc, lc), body.tableaux);
      await svc.db.tx((_c, k) => ecrireOnglets(k, lc.user.id, ids), lc.user.username);
      return tableaux(svc, lc);
    },
  }),
  route({
    method: 'GET',
    url: '/api/tableaux-de-bord/annuaire',
    summary:
      'Destinataires possibles d’un partage : comptes actifs (nom affiché et identifiant, sans courriel), groupes et rôles',
    tags,
    access: 'tableau_de_bord:modifier',
    response: AnnuaireTableauDeBord,
    handler: async ({ svc, s }) => {
      const k = svc.db.k;
      const [utilisateurs, groupes, roles] = await Promise.all([
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
        k
          .selectFrom('roles')
          .select(['id', 'name as nom'])
          .orderBy(sql`lower(name)`)
          .execute(),
      ]);
      return { utilisateurs, groupes, roles };
    },
  }),
  route({
    method: 'GET',
    url: '/api/tableaux-de-bord/:id',
    summary: 'Un tableau de bord visible par la personne, avec sa disposition (affiché depuis la liste, hors favoris)',
    tags,
    access: 'auth',
    params: parId,
    response: TableauDetail,
    handler: async ({ svc, s, params }) => detailDe(svc, await lecteur(svc, (s as Session).user), params.id),
  }),
  route({
    method: 'PUT',
    url: '/api/tableaux-de-bord/:id',
    summary:
      'Modification du nom ou de la disposition d’un tableau (If-Match) : le sien (tableau_de_bord:modifier) ou un tableau proposé d’office (administration:administrer, journalisée)',
    tags,
    access: 'auth',
    params: parId,
    body: ModifierTableauBody,
    response: TableauDetail,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const attendue = requireIfMatch(req);
      const lc = await lecteur(svc, sess.user);
      const droit = await exigerEcriture(svc, lc, await lireLigne(svc.db.k, params.id));
      const apres = await avecNomUnique(() =>
        svc.db.tx(async (_c, k) => {
          const cur = await lireLigne(k, params.id, true);
          if (!cur) throw introuvable();
          if (cur.version !== attendue) throw conflitDe(cur);
          if (droit.type === 'mien' && body.nom !== undefined) await exigerNomLibre(k, lc.user.id, body.nom, cur.id);
          const v = { ligne: cur, modele: droit.type === 'propose' ? droit.modele : null };
          const disposition = body.disposition ?? dispositionDuTableau(v);
          // Un tableau proposé modifié garde désormais son nom et sa disposition enregistrés (surcharge du modèle).
          const surcharge =
            droit.type === 'propose'
              ? { nom: body.nom ?? nomDe(v), disposition: JSON.stringify(disposition), surchargee: true }
              : {
                  ...(body.nom !== undefined ? { nom: body.nom } : {}),
                  ...(body.disposition ? { disposition: JSON.stringify(body.disposition) } : {}),
                };
          await k
            .updateTable('tableaux_de_bord')
            .set((eb) => ({
              ...surcharge,
              version: eb('version', '+', 1),
              updated_by: sess.user.username,
              updated_at: new Date(),
            }))
            .where('id', '=', cur.id)
            .execute();
          return { version: cur.version + 1, disposition };
        }, sess.user.username),
      );
      if (droit.type === 'propose')
        await svc.db.audit(sess.user, ip, 'tableau_de_bord.modele_modifie', params.id, {
          modele: droit.modele,
          version: apres.version,
          ...compte(apres.disposition),
        });
      const out = await detailDe(svc, lc, params.id);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/tableaux-de-bord/:id',
    summary:
      'Suppression de son tableau, de ses partages et de sa publication (If-Match ; journalisée s’il était partagé ou publié) ; sur un tableau proposé d’office, retour à la disposition du modèle (administration:administrer)',
    tags,
    access: 'auth',
    params: parId,
    handler: async ({ svc, s, ip, req, params }) => {
      const sess = s as Session;
      const attendue = requireIfMatch(req);
      const lc = await lecteur(svc, sess.user);
      // Supprimer son propre tableau ne demande aucun droit : cela ne fait que retirer ce qu'il montrait.
      const droit = await exigerEcriture(svc, lc, await lireLigne(svc.db.k, params.id), { sansDroit: true });
      const r = await svc.db.tx(async (_c, k) => {
        const cur = await lireLigne(k, params.id, true);
        if (!cur) throw introuvable();
        if (cur.version !== attendue) throw conflitDe(cur);
        if (droit.type === 'propose') {
          const def = DEFS_MODELES[droit.modele];
          await k
            .updateTable('tableaux_de_bord')
            .set((eb) => ({
              nom: def.nom,
              disposition: JSON.stringify(def.disposition()),
              surchargee: false,
              version: eb('version', '+', 1),
              updated_by: sess.user.username,
              updated_at: new Date(),
            }))
            .where('id', '=', cur.id)
            .execute();
          return { cur, partages: 0 };
        }
        const { n } = await k
          .selectFrom('tableaux_de_bord_partages')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('tableau', '=', cur.id)
          .executeTakeFirstOrThrow();
        await k.deleteFrom('tableaux_de_bord').where('id', '=', cur.id).execute();
        return { cur, partages: n };
      }, sess.user.username);
      if (droit.type === 'propose')
        await svc.db.audit(sess.user, ip, 'tableau_de_bord.modele_retabli', params.id, { modele: droit.modele });
      else {
        if (r.partages)
          await svc.db.audit(sess.user, ip, 'tableau_de_bord.partage_supprime', params.id, {
            destinataires: r.partages,
          });
        if (r.cur.public)
          await svc.db.audit(sess.user, ip, 'tableau_de_bord.publication_retiree', params.id, {
            nom: r.cur.nom,
            ...compte(dispositionDuTableau({ ligne: r.cur, modele: null })),
            suppression: true,
          });
      }
      return undefined;
    },
  }),
  route({
    method: 'GET',
    url: '/api/tableaux-de-bord/:id/partage',
    summary: 'Destinataires et publication de son tableau (ou public visé d’un tableau proposé d’office)',
    tags,
    access: 'auth',
    params: parId,
    response: PartageTableauOut,
    handler: async ({ svc, s, reply, params }) => {
      const lc = await lecteur(svc, (s as Session).user);
      const l = await lireLigne(svc.db.k, params.id);
      const droit = await exigerEcriture(svc, lc, l);
      setEtag(reply, l!.version);
      return {
        destinataires: await destinataires(svc.db.k, l!.id),
        public: l!.public,
        chiffresOuverts: droit.type === 'mien' && lc.user.rights.has('tableau_de_bord:administrer'),
        version: l!.version,
      };
    },
  }),
  route({
    method: 'PUT',
    url: '/api/tableaux-de-bord/:id/partage',
    summary:
      'Partage en lecture avec des personnes, des groupes ou des rôles, et publication pour tous (droit tableau_de_bord:administrer, propriétaire seulement) ; liste complète, If-Match, journalisé',
    tags,
    access: 'auth',
    params: parId,
    body: PartageTableauBody,
    response: PartageTableauOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const attendue = requireIfMatch(req);
      const lc = await lecteur(svc, sess.user);
      const droit = await exigerEcriture(svc, lc, await lireLigne(svc.db.k, params.id));
      if (body.public && droit.type === 'propose')
        throw new HttpError(422, 'Un tableau proposé d’office ne se publie pas : choisissez son public.', {
          reason: 'modele_public',
        });
      if (body.public && !lc.user.rights.has('tableau_de_bord:administrer'))
        throw permissionDenied('tableau_de_bord:administrer');
      if (droit.type === 'mien' && body.destinataires.some((d) => d.type === 'utilisateur' && d.id === lc.user.id))
        throw new HttpError(422, 'Ce tableau de bord est déjà le vôtre : retirez-vous des destinataires.');
      const r = await svc.db.tx(async (_c, k) => {
        const cur = await lireLigne(k, params.id, true);
        if (!cur) throw introuvable();
        if (cur.version !== attendue) throw conflitDe(cur);
        await verifierDestinataires(k, body.destinataires);
        const avant = (
          await k
            .selectFrom('tableaux_de_bord_partages')
            .select(['utilisateur', 'groupe', 'role'])
            .where('tableau', '=', cur.id)
            .execute()
        ).map((x) =>
          x.utilisateur ? `utilisateur:${x.utilisateur}` : x.groupe ? `groupe:${x.groupe}` : `role:${x.role}`,
        );
        const voulus = new Set(body.destinataires.map(cleDestinataire));
        const retires = avant.filter((x) => !voulus.has(x));
        const ajoutes = body.destinataires.filter((d) => !avant.includes(cleDestinataire(d)));
        for (const x of retires) {
          const i = x.indexOf(':');
          const type = x.slice(0, i) as 'utilisateur' | 'groupe' | 'role';
          await k
            .deleteFrom('tableaux_de_bord_partages')
            .where('tableau', '=', cur.id)
            .where(type, '=', x.slice(i + 1))
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
                role: d.type === 'role' ? d.id : null,
                created_by: sess.user.username,
              })),
            )
            .execute();
        const publication = droit.type === 'mien' && body.public !== cur.public;
        await k
          .updateTable('tableaux_de_bord')
          .set((eb) => ({
            ...(publication
              ? { public: body.public, publie_le: body.public ? new Date() : null, chiffres_servis_le: null }
              : {}),
            version: eb('version', '+', 1),
            updated_by: sess.user.username,
            updated_at: new Date(),
          }))
          .where('id', '=', cur.id)
          .execute();
        return { cur, version: cur.version + 1, ajoutes: ajoutes.map(cleDestinataire), retires, publication };
      }, sess.user.username);
      if (r.ajoutes.length || r.retires.length)
        await svc.db.audit(sess.user, ip, 'tableau_de_bord.partage_modifie', params.id, {
          ajoutes: r.ajoutes,
          retires: r.retires,
          destinataires: body.destinataires.length,
          ...(droit.type === 'propose' ? { modele: droit.modele } : {}),
        });
      if (r.publication)
        await svc.db.audit(
          sess.user,
          ip,
          body.public ? 'tableau_de_bord.publie' : 'tableau_de_bord.publication_retiree',
          params.id,
          { nom: r.cur.nom, ...compte(dispositionDuTableau({ ligne: r.cur, modele: null })) },
        );
      setEtag(reply, r.version);
      return {
        destinataires: await destinataires(svc.db.k, params.id),
        public: droit.type === 'mien' ? body.public : false,
        chiffresOuverts: droit.type === 'mien' && lc.user.rights.has('tableau_de_bord:administrer'),
        version: r.version,
      };
    },
  }),
  route({
    method: 'GET',
    url: '/api/tableaux-de-bord/:id/chiffres',
    summary:
      'Chiffres de l’auteur d’un tableau public, ou partagé par un détenteur du droit de publier : nombres et libellés de listes fermées seulement, calculés avec ses droits et sa portée (404 si ces chiffres ne vous sont pas ouverts)',
    tags,
    access: 'auth',
    params: parId,
    response: ChiffresPublics,
    handler: async ({ svc, s, params }) => {
      const sess = s as Session;
      if (!svc.limits.tableauChiffres(sess.user.id)) throw new HttpError(429, 'Trop de requêtes. Réessayez plus tard.');
      const l = await lireLigne(svc.db.k, params.id);
      // Ses propres tableaux et les tableaux proposés se voient avec ses droits : pas de chiffres ouverts.
      if (!l || !l.proprietaire || l.proprietaire === sess.user.id) throw introuvable();
      const lc = await lecteur(svc, sess.user);
      if (!l.public && !(await partagesAvec(svc.db.k, lc, l.id)).has(l.id)) throw introuvable();
      // Droits de l'auteur relus à chaque calcul (ADR 0109, décision 7) : sinon 404, journalisé une seule fois.
      if (!lc.moduleActif) {
        await suspendre(svc, l, 'module_desactive');
        throw introuvable();
      }
      const auteur = await utilisateurPourCalcul(svc.db, l.proprietaire);
      if (!auteur) {
        const u = await svc.db.k
          .selectFrom('users as u')
          .select(actif.as('actif'))
          .where('u.id', '=', l.proprietaire)
          .executeTakeFirst();
        await suspendre(svc, l, u?.actif ? 'droit_retire' : 'auteur_inactif');
        throw introuvable();
      }
      const chiffres = await chiffresDe(svc, auteur);
      if (!l.chiffres_servis_le)
        await svc.db.k
          .updateTable('tableaux_de_bord')
          .set({ chiffres_servis_le: new Date() })
          .where('id', '=', l.id)
          .where('chiffres_servis_le', 'is', null)
          .execute();
      return chiffres;
    },
  }),
];
