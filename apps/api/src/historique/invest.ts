/* Plan d'investissement (reprise de la page « Investissements » de l'outil de suivi) : clé `invest` de l'état historique
   (`{ baseYear, lines }`), modifiée sous verrou et sans copie. Comme dans l'outil historique, la ligne se crée, se modifie
   et se supprime. L'import et l'export Excel de l'outil historique ne sont pas repris. */
import { LigneInvestModification, identifiantInvest, lireLigneInvest, type LigneInvest } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export interface VueInvest {
  version: number;
  anneeN: number;
  lignes: LigneInvest[];
  fournisseurs: { id: string; name: string }[];
}

/** Objet `invest` de l'état (créé s'il manque), avec année de référence et liste des lignes. */
function etatInvest(data: JsonObject): JsonObject & { lines: unknown[] } {
  const v: JsonObject = isObject(data.invest) ? { ...data.invest } : {};
  const annee = Number(v.baseYear);
  v.baseYear = Number.isInteger(annee) && annee > 0 ? annee : new Date().getFullYear();
  v.lines = Array.isArray(v.lines) ? v.lines : [];
  data.invest = v;
  return v as JsonObject & { lines: unknown[] };
}

export class Investissements {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VueInvest> {
    const { version, data } = await this.r.lire(user, 'investissements');
    const v = etatInvest({ ...data });
    return {
      version,
      anneeN: v.baseYear as number,
      lignes: v.lines.map(lireLigneInvest).filter((x): x is LigneInvest => !!x),
      fournisseurs: entrees(data, 'suppliers')
        .map((s) => ({ id: str(s.id), name: str(s.name) }))
        .filter((s) => s.id),
    };
  }

  async creer(user: SessionUser, ip: string): Promise<LigneInvest> {
    return this.r.modifier(
      user,
      ip,
      { module: 'investissements', action: 'invest.created', reference: (x) => `legacy:invest:${x.id}` },
      (data) => {
        const v = etatInvest(data);
        const id = identifiantInvest(v.lines.map((l) => (isObject(l) ? str(l.id) : '')));
        const neuve: JsonObject = {
          id,
          createdAt: new Date().toISOString(),
          company: '',
          priority: '',
          type: '',
          desc: '',
          n0: 0,
          n1: 0,
          n2: 0,
          comment: '',
          alt: '',
          account: '',
          perimeter: '',
          status: 'À qualifier',
          nature: 'Abonnement',
          renewal: '',
          notice: 60,
          supplier: '',
        };
        v.lines = [...v.lines, neuve];
        data.invest = v;
        return lireLigneInvest(neuve)!;
      },
    );
  }

  async modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<LigneInvest> {
    const body = LigneInvestModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'investissements', action: 'invest.updated', reference: (x) => `legacy:invest:${x.id}` },
      (data) => {
        const v = etatInvest(data);
        const trouvees = v.lines.filter((l) => isObject(l) && l.id === id);
        if (trouvees.length > 1)
          throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
        if (!trouvees[0]) throw new HttpError(404, 'Ligne budgétaire absente.');
        if (body.supplier && !entrees(data, 'suppliers').some((s) => s.id === body.supplier))
          throw new HttpError(422, 'Fournisseur absent du registre.');
        const suivante = { ...(trouvees[0] as JsonObject), ...body };
        v.lines = v.lines.map((l) => (isObject(l) && l.id === id ? suivante : l));
        data.invest = v;
        return lireLigneInvest(suivante)!;
      },
    );
  }

  async supprimer(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.r.modifier(
      user,
      ip,
      {
        droit: 'supprimer',
        module: 'investissements',
        action: 'invest.deleted',
        reference: (x) => `legacy:invest:${x.id}`,
      },
      (data) => {
        const v = etatInvest(data);
        if (!v.lines.some((l) => isObject(l) && l.id === id)) throw new HttpError(404, 'Ligne budgétaire absente.');
        v.lines = v.lines.filter((l) => !(isObject(l) && l.id === id));
        data.invest = v;
        return { id };
      },
    );
  }

  async annee(anneeN: number, user: SessionUser, ip: string): Promise<{ anneeN: number }> {
    return this.r.modifier(
      user,
      ip,
      { module: 'investissements', action: 'invest.year', reference: () => 'legacy:invest:annee' },
      (data) => {
        const v = etatInvest(data);
        v.baseYear = anneeN;
        data.invest = v;
        return { anneeN };
      },
    );
  }
}
