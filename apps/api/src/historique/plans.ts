/* Plans du SMSI (formation, sensibilisation, programme d'audit interne, exercices PRA et crise) : clé `plans` de l'état
   historique, éditée sous verrou depuis la nouvelle interface (reprise des pages « Calendrier », « Planning »,
   « Formation » et « Sensibilisation » de l'outil de suivi). Les champs inconnus d'une action sont conservés. */
import {
  ActionPlanCreation,
  ActionPlanModification,
  DecalagePlan,
  STATUTS_PLAN,
  actionPlanVierge,
  analyserValeurIndicateur,
  decalerAction,
  identifiantPlan,
  lireActionPlan,
  lireTacheRecurrente,
  type ActionPlan,
  type TacheRecurrente,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, remplacerEntree, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
/** Date du jour (AAAA-MM-JJ) en UTC, comme `suppliers.ts`. */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export interface MesurePlan {
  id: string;
  ref: string;
  code: string;
  titre: string;
}
export interface VuePlans {
  version: number;
  plans: ActionPlan[];
  recurrences: TacheRecurrente[];
  /** Années du cycle de certification (couverture du cycle). */
  annees: number[];
  /** Indicateurs de sensibilisation proposés à l'enregistrement (nom contenant « sensibilis » ou « phishing »). */
  indicateurs: { id: string; name: string; auto: boolean }[];
  /** Mesures auditables (ISO 27001, Annexe A, HDS). */
  mesures: MesurePlan[];
}

/** Code d'affichage d'une mesure (`code` de l'outil historique) : A.5.29, HDS 12, 7.2. */
const codeMesure = (m: JsonObject) => {
  const ref = str(m.ref),
    num = str(m.num);
  return ref === 'A' ? `A.${num}` : ref === 'HDS' ? `HDS ${num}` : num;
};

export class Plans {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VuePlans> {
    const { version, data } = await this.r.lire(user, 'pilotage');
    return {
      version,
      plans: entrees(data, 'plans')
        .map(lireActionPlan)
        .filter((p): p is ActionPlan => !!p),
      recurrences: entrees(data, 'recurring')
        .map(lireTacheRecurrente)
        .filter((x): x is TacheRecurrente => !!x),
      annees: (Array.isArray(data.years) ? data.years : []).map(Number).filter((n) => Number.isInteger(n)),
      indicateurs: entrees(data, 'indicators')
        .filter((i) => /sensibilis|phishing/i.test(str(i.name)))
        .map((i) => ({ id: str(i.id), name: str(i.name), auto: !!i.calc && i.auto !== false })),
      mesures: entrees(data, 'items')
        .filter((m) => ['ISO', 'A', 'HDS'].includes(str(m.ref)) && str(m.id))
        .map((m) => ({ id: str(m.id), ref: str(m.ref), code: codeMesure(m), titre: str(m.title) })),
    };
  }

  /** Crée une action : identifiant PL-<code>-001, valeurs d'une action neuve, puis champs saisis. */
  async creer(input: unknown, user: SessionUser, ip: string): Promise<ActionPlan> {
    const body = ActionPlanCreation.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'plan.created', reference: (p) => `legacy:plans:${p.id}` },
      (data) => {
        const existants = entrees(data, 'plans');
        const id = identifiantPlan(
          body.type,
          existants.map((p) => str(p.id)),
        );
        const { type, ...saisie } = body;
        const neuve = { ...actionPlanVierge(type, id, new Date().toISOString()), ...saisie };
        data.plans = [...(Array.isArray(data.plans) ? data.plans : []), neuve];
        return neuve;
      },
    );
  }

  /** Modifie les champs fournis ; les autres champs de la source (y compris inconnus) sont conservés. */
  async modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<ActionPlan> {
    const body = ActionPlanModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'plan.updated', reference: (p) => `legacy:plans:${p.id}` },
      (data) => this.remplacer(data, id, (brut) => ({ ...brut, ...body })),
    );
  }

  /** Décale début et fin de n jours (glisser une barre du planning). */
  async decaler(id: string, input: unknown, user: SessionUser, ip: string): Promise<ActionPlan> {
    const { jours } = DecalagePlan.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'plan.shifted', reference: (p) => `legacy:plans:${p.id}` },
      (data) =>
        this.remplacer(data, id, (brut) => {
          const lu = lireActionPlan(brut)!;
          if (!lu.start) throw new HttpError(422, 'Cette action n’a pas de date prévue à décaler.');
          const { start, end } = decalerAction(lu, jours);
          return { ...brut, start, ...(lu.end ? { end } : {}) };
        }),
    );
  }

  async supprimer(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'plan.deleted', reference: (p) => `legacy:plans:${p.id}` },
      (data) => {
        this.trouver(data, id);
        remplacerEntree(data, 'plans', id, null);
        return { id };
      },
    );
  }

  /** Audit réalisé : reporte ses mesures dans la couverture du cycle (« auditée en interne <année> »). */
  async reporterCouverture(id: string, user: SessionUser, ip: string): Promise<{ plan: ActionPlan; marquees: number }> {
    return this.r.modifier(
      user,
      ip,
      {
        module: 'pilotage',
        droits: ['audit'],
        action: 'plan.coverage-synced',
        reference: (x) => `legacy:plans:${x.plan.id}`,
      },
      (data) => {
        const plan = lireActionPlan(this.trouver(data, id))!;
        if (plan.type !== 'audit') throw new HttpError(422, 'Seul un audit interne alimente la couverture du cycle.');
        if (plan.status !== 'Réalisé') throw new HttpError(409, 'Disponible quand l’audit est réalisé.');
        const annee = Number((plan.done || plan.start).slice(0, 4));
        const annees = (Array.isArray(data.years) ? data.years : []).map(Number);
        if (!annees.includes(annee))
          throw new HttpError(422, `L’année ${annee || '?'} n’est pas dans le cycle (${annees.join(', ')}).`);
        let marquees = 0;
        data.items = (Array.isArray(data.items) ? data.items : []).map((m) => {
          if (!isObject(m) || !plan.items.includes(str(m.id))) return m;
          const interne = isObject(m.interne) ? m.interne : {};
          if (interne[String(annee)] === 'X') return m;
          marquees++;
          return { ...m, interne: { ...interne, [String(annee)]: 'X' } };
        });
        return { plan, marquees };
      },
    );
  }

  /** Sensibilisation réalisée : enregistre le taux (réussite pour un indicateur « phishing », sinon participation) dans
      l'indicateur choisi. Un indicateur calculé automatiquement ne reçoit aucune saisie. */
  async enregistrerIndicateur(
    id: string,
    user: SessionUser,
    ip: string,
  ): Promise<{ plan: ActionPlan; valeur: unknown }> {
    return this.r.modifier(
      user,
      ip,
      { module: 'pilotage', action: 'plan.indicator-pushed', reference: (x) => `legacy:plans:${x.plan.id}` },
      (data) => {
        const brut = this.trouver(data, id);
        const plan = lireActionPlan(brut)!;
        if (plan.type !== 'sensi' || plan.status !== 'Réalisé' || !plan.indicator)
          throw new HttpError(409, 'Disponible pour une sensibilisation réalisée liée à un indicateur.');
        const ind = entrees(data, 'indicators').find((i) => i.id === plan.indicator);
        if (!ind) throw new HttpError(404, 'Indicateur absent.');
        if (ind.calc && ind.auto !== false)
          throw new HttpError(
            422,
            'Cet indicateur est calculé automatiquement : sa valeur ne se saisit pas manuellement.',
          );
        const reussite = /phishing/i.test(str(ind.name)) && plan.success;
        const brutTaux = reussite ? plan.success : plan.participation;
        const valeur = analyserValeurIndicateur(ind, brutTaux.includes('%') ? brutTaux : `${brutTaux} %`);
        if (valeur == null || (typeof valeur === 'number' && Number.isNaN(valeur)))
          throw new HttpError(422, 'Renseignez le taux dans la fiche.');
        const maintenant = new Date().toISOString();
        const mesure = {
          date: plan.done || aujourdhui(),
          v: valeur,
          note: `${plan.id} — ${plan.title}`,
          createdAt: maintenant,
        };
        data.indicators = (data.indicators as JsonObject[]).map((i) =>
          isObject(i) && i.id === plan.indicator
            ? { ...i, values: [...(Array.isArray(i.values) ? i.values : []), mesure] }
            : i,
        );
        const suivant = this.remplacer(data, id, (b) => ({ ...b, pushedAt: maintenant }));
        return { plan: suivant, valeur };
      },
    );
  }

  /** Exercice réalisé ou non : crée une action dans le registre des écarts (EXO-nn), liée à l'exercice. */
  async creerEcart(id: string, user: SessionUser, ip: string): Promise<{ plan: ActionPlan; ecart: string }> {
    return this.r.modifier(
      user,
      ip,
      {
        module: 'pilotage',
        droits: ['ecarts'],
        action: 'plan.finding-created',
        reference: (x) => `legacy:plans:${x.plan.id}`,
      },
      (data) => {
        const plan = lireActionPlan(this.trouver(data, id))!;
        if (plan.type !== 'exo')
          throw new HttpError(422, 'Seul un exercice crée une action dans le registre des écarts.');
        const ecarts = entrees(data, 'findings');
        let n = 1;
        while (ecarts.some((f) => f.id === `EXO-${String(n).padStart(2, '0')}`)) n++;
        const ecart = `EXO-${String(n).padStart(2, '0')}`;
        const mesures = new Set(entrees(data, 'items').map((m) => str(m.id)));
        const maintenant = new Date().toISOString();
        const finding: JsonObject = {
          id: ecart,
          createdAt: maintenant,
          source: 'Exercice',
          year: Number((plan.done || plan.start || aujourdhui()).slice(0, 4)),
          type: 'PP',
          status: 'Ouvert',
          text: `Action issue de l’exercice « ${plan.title || plan.id} »`,
          desc: plan.retex,
          action: '',
          tasks: [],
          comment: `Exercice ${plan.id}`,
          items: ['A-5.29', 'A-5.30'].filter((x) => mesures.has(x)),
          owner: plan.owner,
          due: '',
          proof: plan.proof,
        };
        data.findings = [...(Array.isArray(data.findings) ? data.findings : []), finding];
        const suivant = this.remplacer(data, id, (b) => ({
          ...b,
          findings: [...(Array.isArray(b.findings) ? b.findings : []), ecart],
        }));
        return { plan: suivant, ecart };
      },
    );
  }

  /* ------------------------------------------------------------------------------------------------ interne */
  private trouver(data: JsonObject, id: string): JsonObject {
    const trouvees = entrees(data, 'plans').filter((p) => p.id === id);
    if (trouvees.length > 1)
      throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    if (!trouvees[0]) throw new HttpError(404, 'Action de plan absente.');
    if (!lireActionPlan(trouvees[0]))
      throw new HttpError(422, 'Type de plan inconnu : modifiez cette action dans l’outil historique.');
    return trouvees[0];
  }
  private remplacer(data: JsonObject, id: string, transformer: (brut: JsonObject) => JsonObject): ActionPlan {
    const suivante = transformer(this.trouver(data, id));
    if (
      !STATUTS_PLAN.includes(str(suivante.status) as never) &&
      suivante.status !== undefined &&
      suivante.status !== ''
    )
      throw new HttpError(422, 'Statut inconnu.');
    remplacerEntree(data, 'plans', id, suivante);
    return lireActionPlan(suivante)!;
  }
}
