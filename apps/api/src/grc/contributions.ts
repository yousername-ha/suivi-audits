/* Contributions d'un collaborateur à une action : commentaire et preuve jointe (migration 036, ADR 0043).
   - Le rôle de contributeur suffit, sur l'action ou sur son registre : un droit attribué sur une seule action ne donne accès qu'à
     cette action. Les contributions n'altèrent jamais la définition de l'action (version, champs, statut).
   - Journal immuable : l'auteur et l'heure viennent de la session et du serveur. Rejouer une commande avec le même identifiant de
     requête renvoie l'enregistrement d'origine. */
import { CommentaireElementBody, PreuveElementBody, type ContributionElementDto, type GrcObject } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';
import { exigerPreuve } from './validations.js';

interface Ligne {
  id: string;
  seq: number;
  kind: 'commentaire' | 'preuve';
  comment: string;
  proofRef: string;
  createdBy: string;
  createdAt: Date;
}
const colonnes = `id,seq,kind,comment,proof_ref AS "proofRef",created_by AS "createdBy",created_at AS "createdAt"`;
const dto = (l: Ligne): ContributionElementDto => ({
  id: l.id,
  seq: l.seq,
  kind: l.kind,
  comment: l.comment,
  proofRef: l.proofRef,
  createdBy: l.createdBy,
  createdAt: l.createdAt.toISOString(),
});

export class GrcContributions {
  constructor(private readonly g: Grc) {}
  private q(c?: Client) {
    return c ?? this.g.db.pool;
  }
  /** L'objet doit être une action d'un registre accessible pour ce besoin (404 sinon : aucune fuite d'existence). */
  private async action(
    smsi: string,
    id: string,
    user: SessionUser,
    besoin: 'lire' | 'contribuer',
    c?: Client,
    verrou = false,
  ): Promise<GrcObject> {
    const o = await this.g.raw(id, c, verrou);
    if (!o || o.smsiId !== smsi || !o.registreId) throw new HttpError(404, 'Action introuvable ou non accessible.');
    await this.g.registres.exigerElement(user, o, besoin, c);
    if (o.kind !== 'action') throw new HttpError(422, 'Les contributions concernent les actions.');
    if (besoin === 'contribuer' && o.archived) throw new HttpError(409, 'Action archivée.');
    return o;
  }
  async lister(smsi: string, id: string, user: SessionUser) {
    await this.action(smsi, id, user, 'lire');
    const lignes = (
      await this.q().query<Ligne>(`SELECT ${colonnes} FROM contributions_elements WHERE objet_id=$1 ORDER BY seq`, [id])
    ).rows;
    // Intitulé des preuves, résolu avec les droits de la personne : une preuve illisible pour elle reste une référence.
    const noms = new Map<string, string | null>();
    for (const ref of new Set(lignes.map((l) => l.proofRef).filter(Boolean)))
      noms.set(
        ref,
        await this.g.resolve(smsi, ref, user).then(
          (r) => r.name,
          () => null,
        ),
      );
    return {
      items: lignes.map((l) => ({ ...dto(l), proofName: l.proofRef ? (noms.get(l.proofRef) ?? null) : undefined })),
    };
  }
  private async ajouter(
    smsi: string,
    id: string,
    kind: 'commentaire' | 'preuve',
    requestId: string,
    valeurs: { comment: string; proofRef: string },
    user: SessionUser,
    ip: string,
    verifier?: (c: Client) => Promise<void>,
  ) {
    return this.g.db.tx(async (c) => {
      const o = await this.action(smsi, id, user, 'contribuer', c, true);
      const rejoue = (
        await c.query<Ligne & { kind: string }>(
          `SELECT ${colonnes} FROM contributions_elements WHERE objet_id=$1 AND request_id=$2`,
          [o.id, requestId],
        )
      ).rows[0];
      if (rejoue) {
        if (rejoue.kind !== kind)
          throw new HttpError(409, 'Cet identifiant de requête a déjà servi à une autre commande.');
        return { contribution: dto(rejoue), rejoue: true };
      }
      await verifier?.(c);
      const dernier = (
        await c.query<{ n: number }>('SELECT count(*)::int n FROM contributions_elements WHERE objet_id=$1', [o.id])
      ).rows[0]!.n;
      const l = (
        await c.query<Ligne>(
          `INSERT INTO contributions_elements(objet_id,request_id,seq,kind,comment,proof_ref,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${colonnes}`,
          [o.id, requestId, dernier + 1, kind, valeurs.comment, valeurs.proofRef, user.username],
        )
      ).rows[0]!;
      await this.g.db.audit(
        user,
        ip,
        kind === 'commentaire' ? 'element.commentaire' : 'element.preuve',
        o.id,
        { seq: l.seq, requestId, preuve: valeurs.proofRef || undefined },
        c,
      );
      return { contribution: dto(l), rejoue: false };
    }, user.username);
  }
  async commenter(smsi: string, id: string, input: CommentaireElementBody, user: SessionUser, ip: string) {
    const b = CommentaireElementBody.parse(input);
    return this.ajouter(smsi, id, 'commentaire', b.requestId, { comment: b.comment, proofRef: '' }, user, ip);
  }
  async joindrePreuve(smsi: string, id: string, input: PreuveElementBody, user: SessionUser, ip: string) {
    const b = PreuveElementBody.parse(input);
    return this.ajouter(
      smsi,
      id,
      'preuve',
      b.requestId,
      { comment: b.comment, proofRef: b.proofRef },
      user,
      ip,
      async (c) => exigerPreuve(this.g, smsi, b.proofRef, user, c),
    );
  }
}
