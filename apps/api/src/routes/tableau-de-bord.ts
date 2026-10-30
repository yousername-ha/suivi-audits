/* Disposition du tableau de bord de l'accueil (ADR 0078, lot 2a) : disposition personnelle et disposition proposée par
   défaut à l'organisation. Une disposition ne contient aucune donnée ; les valeurs affichées restent celles de la
   synthèse filtrée selon les droits de la personne qui regarde. Concurrence optimiste par If-Match (« 0 » : création). */
import {
  DispositionBody,
  DispositionEnregistree,
  DispositionsOut,
  lireDisposition,
  type Disposition,
} from '@suivi/shared';
import type { Session } from '../auth.js';
import type { Kdb } from '../db/db.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';
import type { Services } from '../services.js';

type Ligne = { disposition: unknown; version: number; updated_by: string; updated_at: Date };

const lire = (k: Kdb, proprietaire: string | null, verrou = false) => {
  const q = k.selectFrom('tableaux_de_bord').select(['id', 'disposition', 'version', 'updated_by', 'updated_at']);
  const r = proprietaire ? q.where('proprietaire', '=', proprietaire) : q.where('proprietaire', 'is', null);
  return (verrou ? r.forUpdate() : r).executeTakeFirst();
};

const sortie = (l: Ligne | undefined): DispositionEnregistree | null =>
  l
    ? {
        disposition: lireDisposition(l.disposition),
        version: l.version,
        modifieePar: l.updated_by,
        modifieeLe: l.updated_at.toISOString(),
      }
    : null;

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

export const tableauDeBordRoutes = [
  route({
    method: 'GET',
    url: '/api/tableau-de-bord/disposition',
    summary:
      'Disposition du tableau de bord : la sienne et celle proposée par défaut (ordre, largeurs, dalles masquées)',
    tags: ['Tableau de bord'],
    access: 'metier',
    response: DispositionsOut,
    handler: async ({ svc, s }) => ({
      personnelle: sortie(await lire(svc.db.k, (s as Session).user.id)),
      organisation: sortie(await lire(svc.db.k, null)),
    }),
  }),
  route({
    method: 'PUT',
    url: '/api/tableau-de-bord/disposition',
    summary: 'Enregistrement de sa disposition du tableau de bord (If-Match obligatoire, « 0 » pour la première)',
    tags: ['Tableau de bord'],
    access: 'metier',
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
    summary: 'Retour à la disposition par défaut (suppression de sa disposition personnelle)',
    tags: ['Tableau de bord'],
    access: 'metier',
    handler: async ({ svc, s }) => {
      await supprimer(svc, (s as Session).user.id);
      return undefined;
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
