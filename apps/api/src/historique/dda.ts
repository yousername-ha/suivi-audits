/* Déclaration d'applicabilité (reprise des pages « Clauses ISO 27001 », « Annexe A (DdA) » et « HDS (DdA) » de l'outil de
   suivi) : clé `dda` de l'état historique, modifiée sous verrou et sans copie. Les clauses ISO sont obligatoires :
   seuls le niveau, les documents, le lien, le commentaire et le texte de référence s'y modifient, comme dans l'outil
   historique. Le texte de référence est saisi par l'utilisateur (aucun texte normatif n'est fourni). */
import {
  CHAMPS_CLAUSE_ISO,
  DdaModification,
  lireDda,
  lireEcartDda,
  lireMesureDda,
  type Dda,
  type EcartDda,
  type MesureDda,
  type ReferenceDda,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { DEFAULT_SMSI } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import { entrees, remplacerEntree, type RegistreHistorique } from './registre.js';

export interface VueDda {
  version: number;
  reference: ReferenceDda;
  mesures: MesureDda[];
  dda: Record<string, Dda>;
  /** Écarts du registre (tous statuts) qui rattachent des mesures : base des écarts ouverts et des incohérences. */
  ecarts: EcartDda[];
}

export class DeclarationApplicabilite {
  constructor(private readonly r: RegistreHistorique) {}

  /** Déclaration du périmètre : celle de l'outil de suivi au périmètre commun, celle du périmètre (`dda_perimetres`) sinon. */
  async vue(reference: ReferenceDda, user: SessionUser, smsi: string = DEFAULT_SMSI): Promise<VueDda> {
    const { version, data } = await this.r.lire(user, 'audit');
    await this.r.g.access(smsi, user);
    if (smsi !== DEFAULT_SMSI) return this.vuePerimetre(reference, smsi, version, data);
    const mesures = entrees(data, 'items')
      .map(lireMesureDda)
      .filter((m): m is MesureDda => !!m && m.ref === reference);
    const ids = new Set(mesures.map((m) => m.id));
    const brute = isObject(data.dda) ? data.dda : {};
    return {
      version,
      reference,
      mesures,
      dda: Object.fromEntries(
        Object.keys(brute)
          .filter((k) => ids.has(k))
          .map((k) => [k, lireDda(brute[k])]),
      ),
      ecarts: entrees(data, 'findings')
        .map(lireEcartDda)
        .filter((e): e is EcartDda => !!e && e.items.some((i) => ids.has(i))),
    };
  }

  /** Déclaration d'un périmètre autre que le commun : mesures communes, décisions et écarts propres au périmètre. */
  private async vuePerimetre(
    reference: ReferenceDda,
    smsi: string,
    version: number,
    data: JsonObject,
  ): Promise<VueDda> {
    const mesures = entrees(data, 'items')
      .map(lireMesureDda)
      .filter((m): m is MesureDda => !!m && m.ref === reference);
    const ids = new Set(mesures.map((m) => m.id));
    const lignes = await this.r.g.db.k
      .selectFrom('dda_perimetres')
      .select(['mesure_id', 'data'])
      .where('smsi_id', '=', smsi)
      .execute();
    const natifs = await this.r.g.db.k
      .selectFrom('grc_objects')
      .select(['id', 'legacy_id', 'name', 'data'])
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'nonconformity')
      .where('archived', '=', false)
      .execute();
    const mesureDe = (r: string) =>
      r.startsWith('legacy:items:')
        ? r.slice(13)
        : (/^requirement:[0-9a-f-]{36}:[1-9][0-9]*:(.+)$/.exec(r)?.[1] ?? null);
    return {
      version,
      reference,
      mesures,
      dda: Object.fromEntries(lignes.filter((l) => ids.has(l.mesure_id)).map((l) => [l.mesure_id, lireDda(l.data)])),
      ecarts: natifs.flatMap((o) => {
        const d = o.data as Record<string, unknown>;
        const items = (Array.isArray(d.refs) ? d.refs : [])
          .map((r) => (typeof r === 'string' ? mesureDe(r) : null))
          .filter((x): x is string => !!x && ids.has(x));
        return items.length
          ? [
              {
                id: o.legacy_id ?? o.id,
                type: '',
                text: o.name,
                status: d.status === 'closed' ? 'Clos' : 'Ouvert',
                source: '',
                items,
              },
            ]
          : [];
      }),
    };
  }

  private async modifierPerimetre(
    smsi: string,
    id: string,
    body: ReturnType<typeof DdaModification.parse>,
    user: SessionUser,
    ip: string,
  ): Promise<{ id: string; dda: Dda }> {
    await this.r.g.permission(user, 'audit', 'modifier');
    await this.r.g.permission(user, 'pilotage', 'modifier');
    await this.r.g.access(smsi, user, true);
    const { data } = await this.r.lire(user, 'audit');
    const item = entrees(data, 'items').find((x) => x.id === id);
    if (!item) throw new HttpError(404, 'Mesure absente.');
    const iso = item.ref === 'ISO';
    if (iso) {
      const interdit = Object.keys(body).filter((k) => !(CHAMPS_CLAUSE_ISO as readonly string[]).includes(k));
      if (interdit.length)
        throw new HttpError(422, `Une clause ISO est obligatoire : ${interdit.join(', ')} ne se modifie pas.`);
    }
    const { refText, ...champs } = body;
    void refText;
    return this.r.g.db.tx(async (c, k) => {
      const actuel = await k
        .selectFrom('dda_perimetres')
        .select('data')
        .where('smsi_id', '=', smsi)
        .where('mesure_id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      const suivante = { ...lireDda(actuel?.data), ...champs };
      if (!iso && champs.level && !['oui', 'non'].includes(suivante.app))
        throw new HttpError(
          422,
          'Décidez d’abord l’applicabilité de la mesure (Oui ou Non) avant d’en renseigner le niveau de mise en œuvre.',
        );
      await k
        .insertInto('dda_perimetres')
        .values({ smsi_id: smsi, mesure_id: id, data: JSON.stringify(suivante), updated_by: user.username })
        .onConflict((oc) =>
          oc.columns(['smsi_id', 'mesure_id']).doUpdateSet({
            data: JSON.stringify(suivante),
            updated_by: user.username,
            updated_at: sql<Date>`now()`,
          }),
        )
        .execute();
      await this.r.g.db.audit(user, ip, 'dda.updated', `dda:${smsi}:${id}`, { smsiId: smsi }, c);
      return { id, dda: lireDda(suivante) };
    }, user.username);
  }

  modifier(
    id: string,
    input: unknown,
    user: SessionUser,
    ip: string,
    smsi: string = DEFAULT_SMSI,
  ): Promise<{ id: string; dda: Dda }> {
    const body = DdaModification.parse(input);
    if (smsi !== DEFAULT_SMSI) return this.modifierPerimetre(smsi, id, body, user, ip);
    return this.r.modifier(
      user,
      ip,
      {
        module: 'audit',
        // La clé « dda » relève du pilotage (ADR 0010) : l'écrire exige aussi pilotage:modifier.
        droits: ['pilotage'],
        action: 'dda.updated',
        reference: (x: { id: string }) => `legacy:dda:${x.id}`,
      },
      (data) => {
        const items = entrees(data, 'items').filter((x) => x.id === id);
        if (items.length > 1)
          throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
        const item = items[0];
        if (!item) throw new HttpError(404, 'Mesure absente.');
        if (item.ref === 'ISO') {
          const interdit = Object.keys(body).filter((k) => !(CHAMPS_CLAUSE_ISO as readonly string[]).includes(k));
          if (interdit.length)
            throw new HttpError(422, `Une clause ISO est obligatoire : ${interdit.join(', ')} ne se modifie pas.`);
        }
        const { refText, ...champs } = body;
        if (refText !== undefined) remplacerEntree(data, 'items', id, { ...item, refText });
        const dda: JsonObject = isObject(data.dda) ? { ...data.dda } : {};
        const courante = isObject(dda[id])
          ? (dda[id] as JsonObject)
          : { app: '', just: '', risk: '', level: '', actions: '', docs: '', comment: '' };
        const suivante = { ...courante, ...champs };
        // Le niveau de mise en œuvre d'une mesure suppose son applicabilité décidée (6.1.3 d, BUG-065) ; les clauses ISO,
        // obligatoires, n'ont pas d'applicabilité.
        if (item.ref !== 'ISO' && champs.level && !['oui', 'non'].includes(String(suivante.app ?? '')))
          throw new HttpError(
            422,
            'Décidez d’abord l’applicabilité de la mesure (Oui ou Non) avant d’en renseigner le niveau de mise en œuvre.',
          );
        dda[id] = suivante;
        data.dda = dda;
        return { id, dda: lireDda(dda[id]) };
      },
    );
  }
}
