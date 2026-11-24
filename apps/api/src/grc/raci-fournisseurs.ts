/* Matrice RACI des fournisseurs (ADR 0113 ; décision du RSSI du 23/11/2026). Le registre reste celui de l'état historique
   (sans copie, contrat inchangé) ; la matrice vit dans la table fournisseurs_raci (migration 106), une ligne au plus par
   fournisseur. Droits : ceux du registre des fournisseurs (lire ; modifier pour créer et enregistrer ; supprimer pour
   effacer la matrice, ADR 0068). Les fournisseurs appartiennent à l'organisation, pas à un périmètre (ADR 0032) : aucun
   cloisonnement par périmètre, comme pour la liste et les évaluations. La règle « un A, au moins un R » est contrôlée et
   rendue, jamais bloquante. Journal : fournisseur, nombres de lignes et de colonnes, rien d'autre. */
import {
  MatriceRaciBody,
  controleRaci,
  type ControleActiviteRaci,
  type MatriceRaci,
  type RaciCase,
} from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, type Grc } from './core.js';

type Ligne = {
  fournisseur_id: string;
  activites: unknown;
  acteurs: unknown;
  cases: unknown;
  version: number;
  mise_a_jour_le: Date;
  mise_a_jour_par: string;
};
const ref = (id: string) => `legacy:suppliers:${id}`;
const matrice = (r: Ligne): MatriceRaci => ({
  fournisseurId: r.fournisseur_id,
  activites: r.activites as MatriceRaci['activites'],
  acteurs: r.acteurs as MatriceRaci['acteurs'],
  cases: r.cases as RaciCase[],
  version: r.version,
  misAJourLe: r.mise_a_jour_le.toISOString(),
  misAJourPar: r.mise_a_jour_par,
});
/** Nombres journalisés : lignes (activités) et colonnes (fonctions de l'établissement et colonne du fournisseur). */
const comptes = (m: { activites: unknown; acteurs: unknown }) => ({
  lignes: Array.isArray(m.activites) ? m.activites.length : 0,
  colonnes: (Array.isArray(m.acteurs) ? m.acteurs.length : 0) + 1,
});

export class GrcRaciFournisseurs {
  constructor(private readonly g: Grc) {}

  /** Le fournisseur doit être dans le registre de l'état historique. */
  private async fournisseur(id: string, c?: Client) {
    const state = await this.g.legacy.recompose(c);
    const liste = Array.isArray(state?.data.suppliers) ? state.data.suppliers : [];
    if (!liste.some((s) => isObject(s) && s.id === id)) throw new HttpError(404, 'Fournisseur absent du registre.');
  }
  private async ligne(k: Kdb, id: string, verrou = false) {
    let q = k.selectFrom('fournisseurs_raci').selectAll().where('fournisseur_id', '=', id);
    if (verrou) q = q.forUpdate();
    return (await q.executeTakeFirst()) as Ligne | undefined;
  }

  /** Matrice du fournisseur, avec le contrôle de la règle ; null tant qu'elle n'a pas été créée. */
  async lire(
    id: string,
    user: SessionUser,
  ): Promise<{ matrice: MatriceRaci | null; controle: ControleActiviteRaci[] }> {
    await this.g.permission(user, 'fournisseurs', 'lire');
    await this.fournisseur(id);
    const r = await this.ligne(this.g.db.k, id);
    const m = r ? matrice(r) : null;
    return { matrice: m, controle: m ? controleRaci(m) : [] };
  }

  /** Crée (If-Match "0", matrice absente) ou remplace la matrice (If-Match = version courante). La règle RACI est rendue
      avec la matrice enregistrée, sans bloquer l'enregistrement. */
  async enregistrer(id: string, input: unknown, attendue: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    const body = MatriceRaciBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      await this.fournisseur(id, c);
      const avant = await this.ligne(k, id, true);
      let apres: Ligne;
      if (!avant) {
        if (attendue !== 0)
          throw new HttpError(412, 'La matrice RACI a été supprimée entre-temps. Rechargez la fiche du fournisseur.', {
            reason: 'conflict',
            current: null,
          });
        const cree = await k
          .insertInto('fournisseurs_raci')
          .values({
            fournisseur_id: id,
            activites: JSON.stringify(body.activites),
            acteurs: JSON.stringify(body.acteurs),
            cases: JSON.stringify(body.cases),
            mise_a_jour_par: user.username,
          })
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .executeTakeFirst();
        // Créée en même temps par une autre personne : même réponse qu'une version périmée.
        if (!cree) throw conflict({ ...matrice((await this.ligne(k, id))!), updated_by: '' });
        apres = cree as Ligne;
      } else {
        if (avant.version !== attendue) throw conflict({ ...matrice(avant), updated_by: avant.mise_a_jour_par });
        apres = (await k
          .updateTable('fournisseurs_raci')
          .set((eb) => ({
            activites: JSON.stringify(body.activites),
            acteurs: JSON.stringify(body.acteurs),
            cases: JSON.stringify(body.cases),
            version: eb('version', '+', 1),
            mise_a_jour_le: sql<Date>`now()`,
            mise_a_jour_par: user.username,
          }))
          .where('fournisseur_id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()) as Ligne;
      }
      await this.g.db.audit(
        user,
        ip,
        avant ? 'supplier.raci.updated' : 'supplier.raci.created',
        ref(id),
        comptes(body),
        c,
      );
      await this.g.notify(c, ref(id), apres.version, DEFAULT_SMSI, 'fournisseurs', user.username);
      const m = matrice(apres);
      return { matrice: m, controle: controleRaci(m) };
    }, user.username);
  }

  /** Supprime la matrice (If-Match = version courante). Une matrice dont le fournisseur a quitté le registre (signalée par
      le contrôle des relations) se supprime aussi : seule l'absence de matrice donne 404. */
  async supprimer(id: string, attendue: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'supprimer');
    await this.g.db.tx(async (c, k) => {
      const avant = await this.ligne(k, id, true);
      if (!avant) throw new HttpError(404, 'Aucune matrice RACI pour ce fournisseur.');
      if (avant.version !== attendue) throw conflict({ ...matrice(avant), updated_by: avant.mise_a_jour_par });
      await k.deleteFrom('fournisseurs_raci').where('fournisseur_id', '=', id).execute();
      await this.g.db.audit(user, ip, 'supplier.raci.deleted', ref(id), comptes(avant), c);
      await this.g.notify(c, ref(id), avant.version + 1, DEFAULT_SMSI, 'fournisseurs', user.username);
    }, user.username);
  }

  /** Identifiant attribué à un nouveau fournisseur : la matrice d'un ancien fournisseur retiré du registre qui portait le
      même identifiant est effacée, pour qu'elle ne passe pas au nouveau (appelé dans la transaction de création). */
  async effacerOrpheline(c: Client, k: Kdb, id: string, user: SessionUser, ip: string) {
    const r = await k
      .deleteFrom('fournisseurs_raci')
      .where('fournisseur_id', '=', id)
      .returning(['activites', 'acteurs'])
      .executeTakeFirst();
    if (r) await this.g.db.audit(user, ip, 'supplier.raci.orphan_deleted', ref(id), comptes(r), c);
  }
}
