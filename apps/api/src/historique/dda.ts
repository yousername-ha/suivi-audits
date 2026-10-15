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

  async vue(reference: ReferenceDda, user: SessionUser): Promise<VueDda> {
    const { version, data } = await this.r.lire(user, 'audit');
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

  modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<{ id: string; dda: Dda }> {
    const body = DdaModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'audit', action: 'dda.updated', reference: (x: { id: string }) => `legacy:dda:${x.id}` },
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
        dda[id] = { ...courante, ...champs };
        data.dda = dda;
        return { id, dda: lireDda(dda[id]) };
      },
    );
  }
}
