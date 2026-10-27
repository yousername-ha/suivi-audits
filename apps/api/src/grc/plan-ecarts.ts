/* Plan d'action des écarts (ADR 0056) : pour un référentiel rattaché au périmètre, les exigences APPLICABLES dont l'état est
   « non implémenté » ou « partiel » reçoivent chacune une action liée (« met en œuvre ») dans le plan d'actions choisi.
   Aperçu en lecture seule, création idempotente : une exigence qui a déjà une action active liée n'en reçoit pas une
   deuxième. Rien n'est inféré : une exigence « à déterminer » n'est jamais un écart. */
import {
  etatExigence,
  evaluationEffective,
  exclusionInterdite,
  type FrameworkDefinition,
  type PlanEcartsCorps,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

const requirementRef = (fw: string, v: number, id: string) => `requirement:${fw}:${v}:${id}`;
const LIMITE = 200;
const ETATS_ECART = new Set(['non_implemente', 'partiel']);
const coupe = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

interface Ecart {
  id: string;
  title: string;
  etat: 'non_implemente' | 'partiel';
  actions: number;
}

export class GrcPlanEcarts {
  constructor(private readonly g: Grc) {}

  private async cible(smsi: string, frameworkId: string, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const eff = (await this.g.effectiveFrameworks(smsi)).find((e) => e.frameworkId === frameworkId && e.enabled);
    if (!eff) throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
    const v = await this.g.library.version(frameworkId, eff.version, user);
    const definition: FrameworkDefinition = v.definition;
    const evaluations = await this.g.evaluations.courantes(smsi, [frameworkId]);
    const liees = await this.g.db.k
      .selectFrom('grc_links as l')
      .innerJoin('grc_objects as o', 'o.id', 'l.source_id')
      .select(['l.target_ref', sql<number>`count(DISTINCT o.id)::int`.as('n')])
      .where('l.smsi_id', '=', smsi)
      .where('l.type', '=', 'implements')
      .where('l.target_ref', 'like', 'requirement:%')
      .where('o.kind', '=', 'action')
      .where('o.archived', '=', false)
      .groupBy('l.target_ref')
      .execute();
    const parRef = new Map(liees.map((r) => [r.target_ref, r.n]));
    const ecarts: Ecart[] = [];
    let dejaCouvertes = 0;
    let horsEcart = 0;
    for (const r of definition.requirements) {
      const obligatoire = exclusionInterdite(definition, r.domain);
      const ev = evaluationEffective(evaluations.get(`${frameworkId}:${r.id}`) ?? null, obligatoire);
      const etat = etatExigence(ev);
      if (ev?.applicability !== 'applicable' || !ETATS_ECART.has(etat)) {
        horsEcart++;
        continue;
      }
      const actions = parRef.get(requirementRef(frameworkId, eff.version, r.id)) ?? 0;
      if (actions) dejaCouvertes++;
      ecarts.push({ id: r.id, title: r.title, etat: etat as Ecart['etat'], actions });
    }
    return { eff, definition, ecarts, dejaCouvertes, horsEcart };
  }

  /** Lecture seule : les écarts du référentiel, ceux qui ont déjà une action et ceux qui en recevraient une. */
  async apercu(smsi: string, frameworkId: string, user: SessionUser) {
    const c = await this.cible(smsi, frameworkId, user);
    const aCreer = c.ecarts.filter((e) => !e.actions);
    return {
      frameworkId,
      version: c.eff.version,
      nom: c.definition.name,
      ecarts: c.ecarts.length,
      dejaCouverts: c.dejaCouvertes,
      aCreer: aCreer.length,
      horsEcart: c.horsEcart,
      limite: LIMITE,
      exigences: aCreer.slice(0, LIMITE).map(({ id, title, etat }) => ({ id, title, etat })),
      avertissements: [
        'Un écart est une exigence évaluée « applicable » et « non implémentée » ou « partiellement implémentée » ; une exigence « à déterminer » n’en est pas un.',
        ...(aCreer.length > LIMITE ? [`Seules les ${LIMITE} premières exigences sont proposées par lot.`] : []),
      ],
    };
  }

  /** Crée les actions manquantes parmi les exigences demandées. Rejouer la demande n'ajoute rien. */
  async creer(smsi: string, corps: PlanEcartsCorps, user: SessionUser, ip: string) {
    const c = await this.cible(smsi, corps.frameworkId, user);
    const voulues = new Set(corps.requirementIds);
    const connues = new Set(c.definition.requirements.map((r) => r.id));
    const inconnues = [...voulues].filter((id) => !connues.has(id));
    if (inconnues.length) throw new HttpError(422, `Exigence inconnue du référentiel : ${inconnues[0]}.`);
    const cibles = c.ecarts.filter((e) => voulues.has(e.id));
    const dejaCouvertes = cibles.filter((e) => e.actions).length;
    const aCreer = cibles.filter((e) => !e.actions);
    const horsEcart = [...voulues].filter((id) => !c.ecarts.some((e) => e.id === id)).length;
    if (!aCreer.length) return { creees: 0, dejaCouvertes, horsEcart, actions: [] as { id: string; name: string }[] };
    const actions = await this.g.db.tx(async (cx, k) => {
      const accueil = await this.g.registreDeCreation(cx, smsi, 'action', 'plan_actions', corps.registreId, user);
      await this.g.checkOwner(smsi, corps.ownerId ?? null, cx);
      const policy = (await this.g.policy(smsi, user)).definition;
      const out: { id: string; name: string }[] = [];
      for (const e of aCreer) {
        // Verrou de l'exigence pour la durée de la transaction : deux demandes simultanées ne créent pas deux actions.
        // Verrou consultatif : SQL direct (ADR 0062).
        await cx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `plan-ecarts:${smsi}:${corps.frameworkId}:${e.id}`,
        ]);
        const deja = await k
          .selectFrom('grc_links as l')
          .innerJoin('grc_objects as o', 'o.id', 'l.source_id')
          .select('l.id')
          .where('l.smsi_id', '=', smsi)
          .where('l.type', '=', 'implements')
          .where('l.target_ref', '=', requirementRef(corps.frameworkId, c.eff.version, e.id))
          .where('o.kind', '=', 'action')
          .where('o.archived', '=', false)
          .executeTakeFirst();
        if (deja) continue;
        const name = coupe(`Mettre en œuvre : ${e.title}`, 200);
        const donnees = await this.g.normalize(
          smsi,
          'action',
          {
            description: coupe(
              `${c.definition.name} — ${e.id} : ${e.title}. Écart constaté : ${e.etat === 'partiel' ? 'partiellement implémenté' : 'non implémenté'}.`,
              2000,
            ),
            status: policy.statuses[0]!.id,
            ownerId: corps.ownerId ?? null,
            startAt: null,
            dueAt: corps.dueAt ? corps.dueAt + 'T09:00:00Z' : null,
            priority: 'normal',
            category: policy.catalogues.actionCategories[0]!.id,
            justification: '',
            reminderDays: policy.notifications.leadDays,
            dependencies: [],
          },
          user,
          cx,
        );
        const action = await this.g.insert(cx, smsi, 'action', name, donnees, user, ip, accueil);
        await k
          .insertInto('grc_links')
          .values({
            smsi_id: smsi,
            source_id: action.id,
            source_ref: 'object:' + action.id,
            target_ref: requirementRef(corps.frameworkId, c.eff.version, e.id),
            type: 'implements',
            note: 'Action créée par le plan d’action des écarts',
            created_by: user.username,
          })
          .execute();
        out.push({ id: action.id, name });
      }
      if (out.length)
        await this.g.db.audit(
          user,
          ip,
          'grc.plan_ecarts.created',
          corps.frameworkId,
          { smsiId: smsi, version: c.eff.version, creees: out.length, demandees: voulues.size },
          cx,
        );
      return out;
    }, user.username);
    return {
      creees: actions.length,
      dejaCouvertes: dejaCouvertes + (aCreer.length - actions.length),
      horsEcart,
      actions,
    };
  }
}
