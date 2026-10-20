/* Évaluations de sécurité des fournisseurs par le clausier (reprise de la page « Évaluations sécurité » de l'outil de
   suivi) : clé `supEvals` de l'état historique, modifiée sous verrou et sans copie. Évaluation facultative : les
   évaluations natives de l'organisation (ADR 0032) n'en dépendent pas. Le clausier Club RSSI Santé (CC BY-NC-SA 4.0,
   usage non commercial) est servi par l'API ; voir docs/licences/CLAUSIER-CLUB-RSSI-SANTE.md. L'action des écarts
   (FOU-nn) exige aussi le droit des écarts. */
import {
  EvaluationClausierCreation,
  EvaluationClausierModification,
  ReponsePoint,
  ecartsEvaluation,
  etatCertificats,
  identifiantActionFournisseur,
  lireEvaluationClausier,
  pointsEvaluation,
  scoreEvaluation,
  type EvaluationClausier,
  type PointClausier,
  type ScoreEvaluation,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { CLAUSIER_2026 } from './clausier-club-rssi-sante-2026.js';
import { entrees, remplacerEntree, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export interface ResumeEvaluation extends EvaluationClausier {
  score: ScoreEvaluation;
}
interface FournisseurEvaluation {
  id: string;
  name: string;
  sso: string;
  mfa: string;
  certificats: string;
}
export interface VueEvaluations {
  version: number;
  evaluations: ResumeEvaluation[];
  fournisseurs: FournisseurEvaluation[];
  /** Source, version et licence du clausier. */
  clausier: { version: string; source: string };
}
export interface DetailEvaluation {
  evaluation: ResumeEvaluation;
  points: PointClausier[];
}

export class EvaluationsClausier {
  constructor(private readonly r: RegistreHistorique) {}

  private resume(e: EvaluationClausier): ResumeEvaluation {
    return { ...e, score: scoreEvaluation(pointsEvaluation(CLAUSIER_2026, e.cases), e) };
  }

  async vue(user: SessionUser): Promise<VueEvaluations> {
    const { version, data } = await this.r.lire(user, 'fournisseurs');
    return {
      version,
      evaluations: entrees(data, 'supEvals')
        .map(lireEvaluationClausier)
        .filter((x): x is EvaluationClausier => !!x)
        .map((e) => this.resume(e)),
      fournisseurs: entrees(data, 'suppliers').map((s) => ({
        id: str(s.id),
        name: str(s.name),
        sso: str(s.sso),
        mfa: str(s.mfa),
        certificats: etatCertificats(s, aujourdhui())[0],
      })),
      clausier: { version: CLAUSIER_2026.version, source: CLAUSIER_2026.source },
    };
  }

  /** Points applicables d'une évaluation (selon ses chapitres cochés), avec leur texte intégral. */
  async detail(id: string, user: SessionUser): Promise<DetailEvaluation> {
    const { data } = await this.r.lire(user, 'fournisseurs');
    const e = lireEvaluationClausier(entrees(data, 'supEvals').find((x) => x.id === id));
    if (!e) throw new HttpError(404, 'Évaluation absente.');
    return { evaluation: this.resume(e), points: pointsEvaluation(CLAUSIER_2026, e.cases) };
  }

  creer(input: unknown, user: SessionUser, ip: string): Promise<ResumeEvaluation> {
    const body = EvaluationClausierCreation.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'fournisseurs', action: 'sup-eval.created', reference: (x) => `legacy:supEvals:${x.id}` },
      (data) => {
        const suppliers = entrees(data, 'suppliers');
        const supplier = body.supplier ?? str(suppliers[0]?.id);
        if (!suppliers.some((s) => s.id === supplier)) throw new HttpError(422, 'Fournisseur absent du registre.');
        const brut: JsonObject = {
          id: `EVAL-${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
          grid: CLAUSIER_2026.version,
          supplier,
          product: '',
          date: aujourdhui(),
          evaluator: '',
          source: '',
          cases: ['rgpd'],
          ans: {},
        };
        data.supEvals = [...(Array.isArray(data.supEvals) ? data.supEvals : []), brut];
        return this.resume(lireEvaluationClausier(brut)!);
      },
    );
  }

  modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<ResumeEvaluation> {
    const body = EvaluationClausierModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'fournisseurs', action: 'sup-eval.updated', reference: (x) => `legacy:supEvals:${x.id}` },
      (data) => {
        const e = this.trouver(data, id);
        if (body.supplier && !entrees(data, 'suppliers').some((s) => s.id === body.supplier))
          throw new HttpError(422, 'Fournisseur absent du registre.');
        const suivante = { ...e, ...body } as JsonObject;
        remplacerEntree(data, 'supEvals', id, suivante);
        return this.resume(lireEvaluationClausier(suivante)!);
      },
    );
  }

  /** État et réponse d'un point du clausier ; seuls les points applicables à l'évaluation s'enregistrent. */
  repondre(id: string, ref: string, input: unknown, user: SessionUser, ip: string): Promise<ResumeEvaluation> {
    const body = ReponsePoint.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'fournisseurs', action: 'sup-eval.answered', reference: (x) => `legacy:supEvals:${x.id}` },
      (data) => {
        const e = this.trouver(data, id);
        const lue = lireEvaluationClausier(e)!;
        if (!pointsEvaluation(CLAUSIER_2026, lue.cases).some((p) => p.id === ref))
          throw new HttpError(404, 'Point absent de cette évaluation.');
        const ans: JsonObject = isObject(e.ans) ? { ...e.ans } : {};
        ans[ref] = { ...(isObject(ans[ref]) ? ans[ref] : {}), ...body };
        const suivante = { ...e, ans } as JsonObject;
        remplacerEntree(data, 'supEvals', id, suivante);
        return this.resume(lireEvaluationClausier(suivante)!);
      },
    );
  }

  supprimer(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.r.modifier(
      user,
      ip,
      { module: 'fournisseurs', action: 'sup-eval.deleted', reference: (x) => `legacy:supEvals:${x.id}` },
      (data) => {
        this.trouver(data, id);
        remplacerEntree(data, 'supEvals', id, null);
        return { id };
      },
    );
  }

  /** Écart du registre des écarts pour les points partiels ou non conformes (un point par ligne de la description). */
  action(id: string, user: SessionUser, ip: string): Promise<{ id: string; action: string; taches: number }> {
    return this.r.modifier(
      user,
      ip,
      {
        module: 'fournisseurs',
        droits: ['ecarts'],
        action: 'sup-eval.action-created',
        reference: (x: { id: string }) => `legacy:supEvals:${x.id}`,
      },
      async (data, c) => {
        const e = this.trouver(data, id);
        const lue = lireEvaluationClausier(e)!;
        const ecarts = ecartsEvaluation(pointsEvaluation(CLAUSIER_2026, lue.cases), lue);
        if (!ecarts.length) throw new HttpError(409, 'Aucun écart dans cette évaluation.');
        const sp = entrees(data, 'suppliers').find((s) => s.id === lue.supplier);
        const fid = identifiantActionFournisseur(entrees(data, 'findings').map((f) => str(f.id)));
        const connus = new Set(entrees(data, 'items').map((x) => str(x.id)));
        await this.r.creerEcart(c, user, ip, {
          id: fid,
          name: `Évaluation sécurité ${str(sp?.name)} : ${ecarts.length} point(s) à traiter`,
          description:
            'Obtenir les engagements du fournisseur.\n' +
            ecarts.map((p) => `- Clausier ${p.id} : ${p.titre}`).join('\n'),
          findingType: 'opportunity',
          items: ['A-5.19', 'A-5.20', 'A-5.21', 'A-5.22'].filter((x) => connus.has(x)),
        });
        return { id, action: fid, taches: ecarts.length };
      },
    );
  }

  private trouver(data: JsonObject, id: string): JsonObject {
    const t = entrees(data, 'supEvals').filter((x) => x.id === id);
    if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    if (!t[0]) throw new HttpError(404, 'Évaluation absente.');
    return t[0];
  }
}
