/* Parcours guidé ISO 27001 / HDS (ADR 0045, addendum, migration 038) : associations explicites d'une fiche ou d'une preuve à une
   sous-action, et applicabilité HDS lue dans le périmètre.
   - Journal immuable (associer, retirer avec motif) ; l'état courant est la dernière opération pour (périmètre, sous-action,
     cible). Auteur et heure viennent de la session et du serveur ; rejouer une commande renvoie l'enregistrement d'origine.
   - Une association ne modifie jamais sa cible et ne vaut ni revue, ni conformité, ni couverture.
   - La cible doit être lisible par la personne qui associe ; à la lecture, une cible illisible reste une référence sans libellé. */
import {
  sousActionParcours,
  type ApplicabiliteHdsDto,
  type AssociationParcoursBody,
  type AssociationParcoursDto,
  type RetraitAssociationBody,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

interface Ligne {
  sousAction: string;
  ref: string;
  operation: 'associer' | 'retirer';
  note: string;
  createdBy: string;
  createdAt: Date;
  requestId: string;
}
const colonnes = `sous_action AS "sousAction",target_ref AS "ref",operation,note,created_by AS "createdBy",created_at AS "createdAt",request_id AS "requestId"`;

export class GrcParcours {
  constructor(private readonly g: Grc) {}
  private q(c?: Client) {
    return c ?? this.g.db.pool;
  }
  private exigerSousAction(id: string) {
    if (!sousActionParcours(id)) throw new HttpError(422, 'Sous-action inconnue du parcours.');
  }
  /** Dernière opération de chaque (sous-action, cible) du périmètre. */
  private async etat(smsi: string, c?: Client) {
    return (
      await this.q(c).query<Ligne>(
        `SELECT DISTINCT ON (sous_action,target_ref) ${colonnes} FROM parcours_associations WHERE smsi_id=$1
          ORDER BY sous_action,target_ref,seq DESC`,
        [smsi],
      )
    ).rows;
  }
  async lister(smsi: string, user: SessionUser): Promise<{ items: AssociationParcoursDto[] }> {
    await this.g.permission(user, 'pilotage', 'lire');
    await this.g.access(smsi, user);
    const actives = (await this.etat(smsi)).filter((l) => l.operation === 'associer');
    const items: AssociationParcoursDto[] = [];
    for (const l of actives.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      const cible = await this.g.resolve(smsi, l.ref, user).then(
        (r) => r,
        () => null,
      );
      items.push({
        sousAction: l.sousAction,
        ref: l.ref,
        name: cible?.name ?? null,
        kind: cible?.kind ?? null,
        note: l.note,
        associePar: l.createdBy,
        associeLe: l.createdAt.toISOString(),
      });
    }
    return { items };
  }
  async associer(smsi: string, input: AssociationParcoursBody, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'modifier');
    await this.g.access(smsi, user, true);
    this.exigerSousAction(input.sousAction);
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      const rejoue = (
        await c.query<Ligne>(`SELECT ${colonnes} FROM parcours_associations WHERE smsi_id=$1 AND request_id=$2`, [
          smsi,
          input.requestId,
        ])
      ).rows[0];
      if (rejoue) {
        if (rejoue.operation !== 'associer' || rejoue.ref !== input.ref || rejoue.sousAction !== input.sousAction)
          throw new HttpError(409, 'Cet identifiant de requête a déjà servi à une autre commande.');
        return { rejoue: true };
      }
      // La cible doit exister dans ce périmètre et être lisible par la personne (404/403 sinon), non archivée.
      const cible = await this.g.resolve(smsi, input.ref, user, c);
      if (cible.archived) throw new HttpError(422, 'Un élément archivé ne s’associe plus au parcours.');
      const courant = (await this.etat(smsi, c)).find((l) => l.sousAction === input.sousAction && l.ref === input.ref);
      if (courant?.operation === 'associer')
        throw new HttpError(409, 'Cet élément est déjà associé à cette sous-action.');
      await c.query(
        `INSERT INTO parcours_associations(smsi_id,request_id,sous_action,operation,target_ref,note,created_by)
         VALUES($1,$2,$3,'associer',$4,$5,$6)`,
        [smsi, input.requestId, input.sousAction, input.ref, input.note, user.username],
      );
      await this.g.db.audit(
        user,
        ip,
        'parcours.association',
        smsi,
        { sousAction: input.sousAction, ref: input.ref, requestId: input.requestId },
        c,
      );
      await this.g.notify(c, smsi, 1, smsi, 'pilotage', user.username);
      return { rejoue: false };
    }, user.username);
  }
  async retirer(smsi: string, input: RetraitAssociationBody, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'modifier');
    await this.g.access(smsi, user, true);
    this.exigerSousAction(input.sousAction);
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      const rejoue = (
        await c.query<Ligne>(`SELECT ${colonnes} FROM parcours_associations WHERE smsi_id=$1 AND request_id=$2`, [
          smsi,
          input.requestId,
        ])
      ).rows[0];
      if (rejoue) {
        if (rejoue.operation !== 'retirer' || rejoue.ref !== input.ref || rejoue.sousAction !== input.sousAction)
          throw new HttpError(409, 'Cet identifiant de requête a déjà servi à une autre commande.');
        return { rejoue: true };
      }
      const courant = (await this.etat(smsi, c)).find((l) => l.sousAction === input.sousAction && l.ref === input.ref);
      if (courant?.operation !== 'associer') throw new HttpError(404, 'Association introuvable.');
      await c.query(
        `INSERT INTO parcours_associations(smsi_id,request_id,sous_action,operation,target_ref,note,created_by)
         VALUES($1,$2,$3,'retirer',$4,$5,$6)`,
        [smsi, input.requestId, input.sousAction, input.ref, input.reason, user.username],
      );
      await this.g.db.audit(
        user,
        ip,
        'parcours.association_retiree',
        smsi,
        { sousAction: input.sousAction, ref: input.ref, requestId: input.requestId, reason: input.reason },
        c,
      );
      await this.g.notify(c, smsi, 1, smsi, 'pilotage', user.username);
      return { rejoue: false };
    }, user.username);
  }
  /** Applicabilité des exigences du référentiel HDS rattaché (et actif) au périmètre : version courante de chaque évaluation. */
  async applicabiliteHds(smsi: string, user: SessionUser): Promise<ApplicabiliteHdsDto> {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const vide: ApplicabiliteHdsDto = {
      referentiel: null,
      total: 0,
      applicable: 0,
      exclue: 0,
      aDeterminer: 0,
      nonEvaluee: 0,
    };
    for (const e of (await this.g.effectiveFrameworks(smsi)).filter((x) => x.enabled)) {
      const f = await this.g.frameworks.version(smsi, e.frameworkId, e.version, user).then(
        (v) => v,
        () => null,
      );
      const d = f?.definition;
      if (!d || !(/^hds$/i.test(d.identifier) || /\bHDS\b/.test(d.name))) continue;
      const courantes = await this.g.evaluations.courantes(smsi, [e.frameworkId]);
      const r = {
        ...vide,
        referentiel: { id: e.frameworkId, name: d.name, version: e.version, heritage: e.origineId !== smsi },
      };
      for (const req of d.requirements) {
        r.total++;
        const ev = courantes.get(`${e.frameworkId}:${req.id}`);
        if (!ev) r.nonEvaluee++;
        else if (ev.applicability === 'applicable') r.applicable++;
        else if (ev.applicability === 'exclue') r.exclue++;
        else r.aDeterminer++;
      }
      return r;
    }
    return vide;
  }
}
