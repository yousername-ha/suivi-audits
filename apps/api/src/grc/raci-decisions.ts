/* Matrice « Qui décide quoi » des rôles et responsabilités (ADR 0115 ; décision du RSSI du 27/11/2026). Une matrice au plus
   par périmètre (table responsabilites_raci, migration 108) : décisions en lignes, rôles du registre « Rôles et
   responsabilités » du périmètre en colonnes. Même grille et même règle que la matrice des fournisseurs (ADR 0113).
   Droits : ceux des fiches du registre (pilotage : lire ; modifier pour enregistrer), avec l'accès au périmètre (lecture,
   ou écriture pour enregistrer ; pyramide des périmètres, ADR 0092). Les colonnes sont lues à chaque fois, avec les mêmes
   règles que le registre : fiches non archivées du périmètre (kind governance), plus les rôles de l'outil de suivi au
   périmètre commun ; aucun libellé n'est recopié (ADR 0083). Un rôle retiré garde ses lettres (« Rôle retiré »), ignorées
   par le contrôle. Journal : périmètre, nombres de lignes et de colonnes, rien d'autre. */
import {
  MatriceDecisionsBody,
  colonnesRolesRaci,
  controleDecisionsRaci,
  type MatriceDecisions,
  type MatriceDecisionsReponse,
  type RaciCaseDecision,
} from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, type Grc } from './core.js';

type Ligne = {
  smsi_id: string;
  decisions: unknown;
  cases: unknown;
  version: number;
  mise_a_jour_le: Date;
  mise_a_jour_par: string;
};
const matrice = (r: Ligne): MatriceDecisions => ({
  smsiId: r.smsi_id,
  decisions: r.decisions as MatriceDecisions['decisions'],
  cases: r.cases as RaciCaseDecision[],
  version: r.version,
  misAJourLe: r.mise_a_jour_le.toISOString(),
  misAJourPar: r.mise_a_jour_par,
});
const cible = (smsi: string) => `responsabilites-raci:${smsi}`;

export class GrcRaciDecisions {
  constructor(private readonly g: Grc) {}

  /** Rôles du registre du périmètre, dans l'ordre alphabétique : fiches du Pilotage non archivées et, au périmètre commun,
      rôles de l'outil de suivi qui portent un identifiant (mêmes fiches que la liste du registre). */
  async roles(smsi: string, c?: Client): Promise<{ ref: string; libelle: string }[]> {
    const natifs = await (c ? surConnexion(c) : this.g.db.k)
      .selectFrom('grc_objects')
      .select(['id', 'name'])
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'governance')
      .where('archived', '=', false)
      .execute();
    const roles = natifs.map((o) => ({ ref: `object:${o.id}`, libelle: o.name }));
    if (smsi === DEFAULT_SMSI) {
      const etat = await this.g.legacy.recompose(c);
      for (const r of Array.isArray(etat?.data.roles) ? etat.data.roles : [])
        if (isObject(r) && typeof r.id === 'string' && r.id)
          roles.push({ ref: `legacy:roles:${r.id}`, libelle: String(r.name ?? r.title ?? r.id) });
    }
    return roles.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr') || a.ref.localeCompare(b.ref));
  }
  private async ligne(k: Kdb, smsi: string, verrou = false) {
    let q = k.selectFrom('responsabilites_raci').selectAll().where('smsi_id', '=', smsi);
    if (verrou) q = q.forUpdate();
    return (await q.executeTakeFirst()) as Ligne | undefined;
  }
  private reponse(m: MatriceDecisions | null, roles: { ref: string; libelle: string }[]): MatriceDecisionsReponse {
    return {
      matrice: m,
      roles: colonnesRolesRaci(roles, m?.cases ?? []),
      controle: m
        ? controleDecisionsRaci(
            m,
            roles.map((r) => r.ref),
          )
        : [],
    };
  }

  /** Matrice du périmètre, ses colonnes et le contrôle de la règle ; matrice null tant que rien n'a été enregistré. */
  async lire(smsi: string, user: SessionUser): Promise<MatriceDecisionsReponse> {
    await this.g.permission(user, 'pilotage', 'lire');
    await this.g.access(smsi, user);
    const r = await this.ligne(this.g.db.k, smsi);
    return this.reponse(r ? matrice(r) : null, await this.roles(smsi));
  }

  /** Crée (If-Match "0", matrice absente) ou remplace la matrice (If-Match = version courante). Une case doit désigner un
      rôle du registre, ou un rôle retiré qui y portait déjà une lettre (sa colonne « Rôle retiré » se vide sans se
      recréer). La règle RACI est rendue avec la matrice enregistrée, sans bloquer l'enregistrement. */
  async enregistrer(
    smsi: string,
    input: unknown,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<MatriceDecisionsReponse & { matrice: MatriceDecisions }> {
    await this.g.permission(user, 'pilotage', 'modifier');
    const body = MatriceDecisionsBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      await this.g.access(smsi, user, true, c);
      const avant = await this.ligne(k, smsi, true);
      const roles = await this.roles(smsi, c);
      const admis = new Set([
        ...roles.map((r) => r.ref),
        ...((avant?.cases as RaciCaseDecision[] | undefined) ?? []).map((x) => x.role),
      ]);
      if (body.cases.some((x) => !admis.has(x.role)))
        throw new HttpError(422, 'Rôle absent du registre « Rôles et responsabilités » du périmètre.');
      let apres: Ligne;
      if (!avant) {
        if (attendue !== 0)
          throw new HttpError(412, 'La matrice « Qui décide quoi » a changé entre-temps. Rechargez la page.', {
            reason: 'conflict',
            current: null,
          });
        const cree = await k
          .insertInto('responsabilites_raci')
          .values({
            smsi_id: smsi,
            decisions: JSON.stringify(body.decisions),
            cases: JSON.stringify(body.cases),
            mise_a_jour_par: user.username,
          })
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .executeTakeFirst();
        // Créée en même temps par une autre personne : même réponse qu'une version périmée.
        if (!cree) throw conflict({ ...matrice((await this.ligne(k, smsi))!), updated_by: '' });
        apres = cree as Ligne;
      } else {
        if (avant.version !== attendue) throw conflict({ ...matrice(avant), updated_by: avant.mise_a_jour_par });
        apres = (await k
          .updateTable('responsabilites_raci')
          .set((eb) => ({
            decisions: JSON.stringify(body.decisions),
            cases: JSON.stringify(body.cases),
            version: eb('version', '+', 1),
            mise_a_jour_le: sql<Date>`now()`,
            mise_a_jour_par: user.username,
          }))
          .where('smsi_id', '=', smsi)
          .returningAll()
          .executeTakeFirstOrThrow()) as Ligne;
      }
      const m = matrice(apres);
      const r = this.reponse(m, roles);
      await this.g.db.audit(
        user,
        ip,
        avant ? 'grc.responsabilites.raci.updated' : 'grc.responsabilites.raci.created',
        cible(smsi),
        { smsiId: smsi, lignes: body.decisions.length, colonnes: r.roles.length },
        c,
      );
      await this.g.notify(c, cible(smsi), apres.version, smsi, 'pilotage', user.username);
      return { ...r, matrice: m };
    }, user.username);
  }
}
