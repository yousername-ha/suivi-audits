/* Revues des accès des applications (reprise de la page « Revues des accès » de l'outil de suivi) : clé
   `accessReviews` de l'état historique, modifiée sous verrou et sans copie. Comme dans l'outil historique, une revue
   se crée et se modifie ; elle ne se supprime pas. */
import { RevueAccesModification, identifiantRevue, lireRevueAcces, type RevueAcces } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export interface VueRevuesAcces {
  version: number;
  revues: RevueAcces[];
  /** Noms des fournisseurs du registre, proposés pour rattacher une revue. */
  fournisseurs: string[];
}

export class RevuesAcces {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VueRevuesAcces> {
    const { version, data } = await this.r.lire(user, 'pilotage');
    return {
      version,
      revues: entrees(data, 'accessReviews')
        .map(lireRevueAcces)
        .filter((x): x is RevueAcces => !!x),
      fournisseurs: entrees(data, 'suppliers')
        .map((s) => str(s.name))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'fr')),
    };
  }

  async creer(user: SessionUser, ip: string): Promise<RevueAcces> {
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'access-review.created', reference: (x) => `legacy:accessReviews:${x.id}` },
      (data) => {
        const liste = entrees(data, 'accessReviews');
        const id = identifiantRevue(liste.map((x) => str(x.id)));
        const neuve: JsonObject = {
          createdAt: new Date().toISOString(),
          id,
          app: 'Nouvelle application',
          month: '',
          supplier: '',
          freq: 12,
          source: '',
          comment: '',
        };
        data.accessReviews = [...(Array.isArray(data.accessReviews) ? data.accessReviews : []), neuve];
        return lireRevueAcces(neuve)!;
      },
    );
  }

  async modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<RevueAcces> {
    const body = RevueAccesModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'access-review.updated', reference: (x) => `legacy:accessReviews:${x.id}` },
      (data) => {
        const trouvees = entrees(data, 'accessReviews').filter((x) => x.id === id);
        if (trouvees.length > 1)
          throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
        if (!trouvees[0]) throw new HttpError(404, 'Revue des accès absente.');
        if (body.supplier) {
          const noms = entrees(data, 'suppliers').map((s) => str(s.name));
          if (!noms.includes(body.supplier)) throw new HttpError(422, 'Fournisseur absent du registre.');
        }
        const suivante = { ...trouvees[0], ...body };
        data.accessReviews = (data.accessReviews as JsonObject[]).map((x) =>
          isObject(x) && x.id === id ? suivante : x,
        );
        return lireRevueAcces(suivante)!;
      },
    );
  }
}
