/* Validation des occurrences de tâches récurrentes : OK, KO ou NA, journal immuable et commandes idempotentes (migration 030).
   - Valider exige le rôle de contributeur sur l'occurrence (ou son registre) ; l'auteur et l'heure viennent de la session et du
     serveur, jamais du client.
   - Une occurrence validée ne change plus : la reprendre passe par une réouverture motivée (rôle de gestionnaire), inscrite
     au même journal. Rejouer une commande avec le même identifiant de requête renvoie l'enregistrement d'origine. */
import {
  fenetreOccurrence,
  GrcRef,
  ReouvertureOccurrenceBody,
  SeriesData,
  ValidationOccurrenceBody,
  type EtatValidation,
  type GrcObject,
  type ValidationDto,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

interface Ligne {
  id: string;
  seq: number;
  kind: 'validation' | 'reouverture';
  result: ValidationDto['result'];
  comment: string;
  proofRef: string;
  createdBy: string;
  createdAt: Date;
  requestId: string;
}
const colonnes = `id,seq,kind,result,comment,proof_ref AS "proofRef",created_by AS "createdBy",created_at AS "createdAt",request_id AS "requestId"`;
const dto = (l: Ligne): ValidationDto => ({
  id: l.id,
  seq: l.seq,
  kind: l.kind,
  result: l.result,
  comment: l.comment,
  proofRef: l.proofRef,
  createdBy: l.createdBy,
  createdAt: l.createdAt.toISOString(),
});
const etatDe = (lignes: { kind: 'validation' | 'reouverture' }[]): EtatValidation => {
  const derniere = lignes[lignes.length - 1];
  return !derniere ? 'ouverte' : derniere.kind === 'validation' ? 'validee' : 'rouverte';
};

/** La preuve est une référence que le serveur sait résoudre (et que la personne a le droit de lire) : jamais un texte libre.
    C'est une version de document ou une fiche de preuve, pas n'importe quel objet. */
export async function exigerPreuve(g: Grc, smsi: string, proofRef: string, user: SessionUser, c?: Client) {
  if (!GrcRef.safeParse(proofRef).success) throw new HttpError(422, 'Référence de preuve invalide.');
  const preuve = await g.resolve(smsi, proofRef, user, c);
  if (!proofRef.startsWith('document:') && !(proofRef.startsWith('object:') && preuve.kind === 'evidence'))
    throw new HttpError(422, 'La preuve est une version de document ou une fiche de preuve.');
}

export class GrcValidations {
  constructor(private readonly g: Grc) {}
  private q(c?: Client) {
    return c ?? this.g.db.pool;
  }
  private async lignes(id: string, c?: Client) {
    return (
      await this.q(c).query<Ligne>(`SELECT ${colonnes} FROM occurrence_validations WHERE objet_id=$1 ORDER BY seq`, [
        id,
      ])
    ).rows;
  }
  /** L'objet doit être une occurrence (action issue d'une série) d'un registre accessible pour ce besoin. */
  private async occurrence(
    smsi: string,
    id: string,
    user: SessionUser,
    besoin: 'lire' | 'contribuer' | 'gerer',
    c?: Client,
    verrou = false,
  ): Promise<GrcObject> {
    const o = await this.g.raw(id, c, verrou);
    if (!o || o.smsiId !== smsi || !o.registreId) throw new HttpError(404, 'Occurrence introuvable ou non accessible.');
    await this.g.registres.exigerElement(user, o, besoin, c);
    if (o.kind !== 'action' || typeof o.data.seriesId !== 'string' || !o.data.seriesId)
      throw new HttpError(422, 'La validation concerne les occurrences de tâches récurrentes.');
    if (o.archived) throw new HttpError(409, 'Occurrence archivée.');
    return o;
  }
  /** La fenêtre de réalisation de la série décide : on ne valide ni avant son ouverture ni après sa fermeture. */
  private async exigerFenetreOuverte(o: GrcObject, c: Client) {
    const serie = await this.g.raw(String(o.data.seriesId), c);
    const dueAt = typeof o.data.dueAt === 'string' ? o.data.dueAt : null;
    if (!serie || serie.kind !== 'task_series' || !dueAt) return;
    const f = fenetreOccurrence(SeriesData.parse(serie.data).recurrence, dueAt);
    const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '');
    if (f.etat === 'a_venir')
      throw new HttpError(409, `La fenêtre de réalisation de cette occurrence n’ouvre que le ${date(f.ouvreLe)}.`);
    if (f.etat === 'fermee')
      throw new HttpError(
        409,
        `La fenêtre de réalisation de cette occurrence s’est fermée le ${date(f.fermeLe)} : demandez à un gestionnaire de la série d’élargir la fenêtre.`,
      );
  }
  async historique(smsi: string, id: string, user: SessionUser) {
    await this.occurrence(smsi, id, user, 'lire');
    const lignes = await this.lignes(id);
    // Intitulé des preuves, résolu avec les droits de la personne : une preuve qu'elle ne peut pas lire reste une référence.
    const noms = new Map<string, string | null>();
    for (const ref of new Set(lignes.map((l) => l.proofRef).filter(Boolean)))
      noms.set(
        ref,
        await this.g.resolve(smsi, ref, user).then(
          (r) => r.name,
          () => null,
        ),
      );
    return { etat: etatDe(lignes), items: lignes.map((l) => ({ ...dto(l), proofName: noms.get(l.proofRef) ?? null })) };
  }
  private async ajouter(
    c: Client,
    o: GrcObject,
    ligne: {
      requestId: string;
      kind: 'validation' | 'reouverture';
      result: string | null;
      comment: string;
      proofRef: string;
    },
    user: SessionUser,
    ip: string,
  ) {
    const dernier = (await this.lignes(o.id, c)).length;
    const l = (
      await c.query<Ligne>(
        `INSERT INTO occurrence_validations(objet_id,request_id,seq,kind,result,comment,proof_ref,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${colonnes}`,
        [o.id, ligne.requestId, dernier + 1, ligne.kind, ligne.result, ligne.comment, ligne.proofRef, user.username],
      )
    ).rows[0]!;
    await this.g.db.audit(
      user,
      ip,
      ligne.kind === 'validation' ? 'occurrence.validee' : 'occurrence.rouverte',
      o.id,
      { resultat: ligne.result, seq: l.seq, requestId: ligne.requestId, preuve: ligne.proofRef || undefined },
      c,
    );
    return l;
  }
  /** Rejeu d'une commande déjà enregistrée : même enregistrement, sans écriture, si la nature correspond. */
  private async rejeu(c: Client, o: GrcObject, requestId: string, kind: 'validation' | 'reouverture') {
    const l = (
      await c.query<Ligne>(`SELECT ${colonnes} FROM occurrence_validations WHERE objet_id=$1 AND request_id=$2`, [
        o.id,
        requestId,
      ])
    ).rows[0];
    if (!l) return null;
    if (l.kind !== kind) throw new HttpError(409, 'Cet identifiant de requête a déjà servi à une autre commande.');
    return l;
  }
  async valider(smsi: string, id: string, input: ValidationOccurrenceBody, user: SessionUser, ip: string) {
    const b = ValidationOccurrenceBody.parse(input);
    return this.g.db.tx(async (c) => {
      const o = await this.occurrence(smsi, id, user, 'contribuer', c, true);
      const rejoue = await this.rejeu(c, o, b.requestId, 'validation');
      if (rejoue) return { validation: dto(rejoue), etat: etatDe(await this.lignes(id, c)), rejoue: true };
      if (b.proofRef) await exigerPreuve(this.g, smsi, b.proofRef, user, c);
      const lignes = await this.lignes(id, c);
      if (etatDe(lignes) === 'validee')
        throw new HttpError(409, 'Cette occurrence est déjà validée : seule une réouverture motivée la reprend.');
      await this.exigerFenetreOuverte(o, c);
      const l = await this.ajouter(
        c,
        o,
        { requestId: b.requestId, kind: 'validation', result: b.result, comment: b.comment, proofRef: b.proofRef },
        user,
        ip,
      );
      return { validation: dto(l), etat: 'validee' as const, rejoue: false };
    }, user.username);
  }
  async rouvrir(smsi: string, id: string, input: ReouvertureOccurrenceBody, user: SessionUser, ip: string) {
    const b = ReouvertureOccurrenceBody.parse(input);
    return this.g.db.tx(async (c) => {
      const o = await this.occurrence(smsi, id, user, 'gerer', c, true);
      const rejoue = await this.rejeu(c, o, b.requestId, 'reouverture');
      if (rejoue) return { validation: dto(rejoue), etat: etatDe(await this.lignes(id, c)), rejoue: true };
      if (etatDe(await this.lignes(id, c)) !== 'validee')
        throw new HttpError(409, 'Seule une occurrence validée peut être rouverte.');
      const l = await this.ajouter(
        c,
        o,
        { requestId: b.requestId, kind: 'reouverture', result: null, comment: b.reason, proofRef: '' },
        user,
        ip,
      );
      return { validation: dto(l), etat: 'rouverte' as const, rejoue: false };
    }, user.username);
  }
}
