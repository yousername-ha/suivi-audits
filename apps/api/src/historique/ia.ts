/* Conformité IA (reprise des vues « Usages de l'IA », « Évaluation », « Plan » et « Politiques » de l'outil de suivi) :
   clé `ai` de l'état historique, modifiée sous verrou et sans copie. Les scénarios, étapes et politiques viennent de
   l'état (import ou outil historique) : l'écran ne modifie que leur évaluation et leur avancement ; seul le registre des
   usages se crée et se supprime. Le registre démarre vide (aucun usage, scénario, étape ni politique n'est créé). */
import {
  EtapeIaModification,
  EvaluationIaModification,
  PlanIaModification,
  PolitiqueIaModification,
  UsageIaModification,
  identifiantUsageIa,
  lireDonneesIa,
  type DonneesIa,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Initialise la clé `ai` si elle est absente (registre vide) et la retourne ; une clé existante est conservée. */
export function assurerIa(data: JsonObject): JsonObject {
  const ai: JsonObject = isObject(data.ai) ? { ...data.ai } : {};
  for (const k of ['register', 'evals', 'plan', 'policies']) if (!Array.isArray(ai[k])) ai[k] = [];
  if (typeof ai.context !== 'string') ai.context = '';
  if (typeof ai.start !== 'string') ai.start = '';
  data.ai = ai;
  return ai;
}
/** Nouvelle entrée du registre, avec les valeurs de l'outil historique. */
export const usageVierge = (id: string, maintenant: string): JsonObject => ({
  id,
  createdAt: maintenant,
  aiPresence: 'À vérifier',
  category: 'Service IA web externe',
  usecase: '',
  owner: 'À confirmer',
  role: 'Utilisateur / déployeur',
  type: 'IA générative',
  provider: '',
  purpose: '',
  dscp: 'À qualifier',
  data: '',
  hdsAct: '',
  hdsCert: '',
  storage: 'À qualifier',
  remote: 'À qualifier',
  training: 'À qualifier',
  aiact: 'À qualifier',
  dm: '',
  human: '',
  aipd: 'À qualifier',
  authz: 'En qualification',
  golive: '',
  proof: '',
});

export class ConformiteIa {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<{ version: number; ia: DonneesIa | null }> {
    const { version, data } = await this.r.lire(user, 'ia');
    return { version, ia: lireDonneesIa(data.ai) };
  }

  async creerUsage(user: SessionUser, ip: string) {
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'ia', action: 'ai.usage.created', reference: (x) => `legacy:ai:${x.id}` },
      (data) => {
        const ai = assurerIa(data);
        const registre = ai.register as JsonObject[];
        const id = identifiantUsageIa(registre.map((u) => str(u.id)));
        ai.register = [...(ai.register as JsonObject[]), usageVierge(id, new Date().toISOString())];
        return { id };
      },
    );
  }
  async modifierUsage(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = UsageIaModification.parse(input);
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'ia', action: 'ai.usage.updated', reference: (x) => `legacy:ai:${x.id}` },
      (data) => {
        this.remplacer(data, 'register', 'id', id, (u) => ({ ...u, ...body }));
        return { id };
      },
    );
  }
  async supprimerUsage(id: string, user: SessionUser, ip: string) {
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'ia', action: 'ai.usage.deleted', reference: (x) => `legacy:ai:${x.id}` },
      (data) => {
        this.remplacer(data, 'register', 'id', id, null);
        return { id };
      },
    );
  }
  async modifierEvaluation(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = EvaluationIaModification.parse(input);
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'ia', action: 'ai.evaluation.updated', reference: (x) => `legacy:ai:${x.id}` },
      (data) => {
        this.remplacer(data, 'evals', 'id', id, (e) => ({ ...e, ...body }));
        return { id };
      },
    );
  }
  /** Statut et avancement d'une étape ; « Terminé » porte l'avancement à 100 %, comme dans l'outil historique. */
  async modifierEtape(cle: string, input: unknown, user: SessionUser, ip: string) {
    const body = EtapeIaModification.parse(input);
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'ia', action: 'ai.step.updated', reference: (x) => `legacy:ai:${x.id}` },
      (data) => {
        this.remplacer(data, 'plan', 'cle', cle, (p) => ({
          ...p,
          ...body,
          ...(body.status === 'Terminé' ? { progress: 100 } : {}),
        }));
        return { id: cle };
      },
    );
  }
  async modifierPolitique(cle: string, input: unknown, user: SessionUser, ip: string) {
    const body = PolitiqueIaModification.parse(input);
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'ia', action: 'ai.policy.updated', reference: (x) => `legacy:ai:${x.id}` },
      (data) => {
        this.remplacer(data, 'policies', 'cle', cle, (p) => ({ ...p, ...body }));
        return { id: cle };
      },
    );
  }
  /** Date de début du plan et validation de cette date (une date non validée est indicative : aucune alerte de retard). */
  async majPlan(input: unknown, user: SessionUser, ip: string) {
    const body = PlanIaModification.parse(input);
    return this.r.modifier<{ ok: boolean }>(
      user,
      ip,
      { module: 'ia', action: 'ai.plan.updated', reference: () => 'legacy:ai' },
      (data) => {
        if (!isObject(data.ai)) throw new HttpError(404, 'Aucune donnée IA.');
        data.ai = { ...data.ai, ...body };
        return { ok: true };
      },
    );
  }

  /** Remplace (ou retire, avec `null`) un élément d'une liste de `ai` : par identifiant, ou par « @rang » pour un élément
      sans identifiant. */
  private remplacer(
    data: JsonObject,
    liste: 'register' | 'evals' | 'plan' | 'policies',
    champ: 'id' | 'cle',
    cle: string,
    f: ((o: JsonObject) => JsonObject) | null,
  ) {
    if (!isObject(data.ai) || !Array.isArray(data.ai[liste])) throw new HttpError(404, 'Aucune donnée IA.');
    const elements = data.ai[liste] as unknown[];
    const cles = elements.map((e, i) => (isObject(e) ? str(e.id) || (champ === 'cle' ? '@' + i : '') : ''));
    const correspond = cles.filter((c) => c === cle);
    if (correspond.length > 1)
      throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    const i = cles.indexOf(cle);
    if (i < 0) throw new HttpError(404, 'Élément absent.');
    const suivante = elements.flatMap((e, j) => (j === i ? (f ? [f(e as JsonObject)] : []) : [e]));
    data.ai = { ...data.ai, [liste]: suivante } as JsonObject;
    void entrees;
  }
}
