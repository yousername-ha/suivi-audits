/* Boîtes de pilotage par processus (ISO 9001:2015, 4.4.1 c et 9.1.1) : ce qui est rattaché à chaque processus dans le
   registre commun (actions ouvertes, risques, séries récurrentes) et la prochaine échéance récurrente. Les indicateurs eux-
   mêmes sont lus et calculés avec l'état de l'outil de suivi. Aucun taux de conformité n'est calculé ici. */
import { GRC_MODULES, Recurrence, prochaineOccurrence } from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';

export interface BoitePilotage {
  ref: string;
  /** Null quand la personne n'a pas le droit de lire le module concerné. */
  actionsOuvertes: number | null;
  actionsEnRetard: number | null;
  risques: number | null;
  series: number | null;
  prochaineEcheance: string | null;
}

export class PilotageBoites {
  constructor(private readonly g: Grc) {}

  async lister(smsi: string, user: SessionUser): Promise<BoitePilotage[]> {
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    await this.g.access(smsi, user);
    await this.g.permission(user, GRC_MODULES.process, 'lire');
    const etat = await this.g.legacy.recompose();
    const refs = (Array.isArray(etat?.data.processes) ? (etat!.data.processes as unknown[]) : [])
      .filter(isObject)
      .filter((p) => typeof p.id === 'string')
      .map((p) => `legacy:processes:${p.id}`);
    const lire = (m: 'ecarts' | 'pilotage') => user.rights.can(m, 'lire');
    const politique = (await this.g.policy(smsi, user)).definition;
    const clos = new Set(politique.statuses.filter((s) => s.terminal).map((s) => s.id));
    const masques = await this.g.registres.inaccessibles(user, smsi);
    const objets = (
      await this.g.db.q<{
        id: string;
        kind: string;
        status: string | null;
        due: string | null;
        refs: unknown;
        recurrence: unknown;
      }>(
        `SELECT id,kind,data->>'status' AS status,data->>'dueAt' AS due,data->'refs' AS refs,data->'recurrence' AS recurrence
           FROM grc_objects WHERE smsi_id=$1 AND NOT archived AND kind IN ('action','risk','task_series') AND (registre_id IS NULL OR registre_id<>ALL($2::uuid[])) LIMIT 20000`,
        [smsi, masques],
      )
    ).rows;
    const liens = (
      await this.g.db.q<{ source_ref: string; target_ref: string }>(
        `SELECT source_ref,target_ref FROM grc_links WHERE smsi_id=$1 AND (source_ref LIKE 'legacy:processes:%' OR target_ref LIKE 'legacy:processes:%')`,
        [smsi],
      )
    ).rows;
    const rattaches = (ref: string) => {
      const ids = new Set<string>();
      for (const o of objets) if (Array.isArray(o.refs) && o.refs.includes(ref)) ids.add(o.id);
      for (const l of liens) {
        const autre = l.source_ref === ref ? l.target_ref : l.target_ref === ref ? l.source_ref : null;
        if (autre?.startsWith('object:')) ids.add(autre.slice(7));
      }
      return objets.filter((o) => ids.has(o.id));
    };
    const aujourdhui = new Date().toISOString().slice(0, 10);
    return refs.map((ref) => {
      const liees = rattaches(ref);
      const actions = liees.filter((o) => o.kind === 'action' && !clos.has(String(o.status)));
      const series = liees.filter((o) => o.kind === 'task_series');
      const prochaines = series
        .map((o) => {
          const r = Recurrence.safeParse(o.recurrence);
          return r.success ? prochaineOccurrence(r.data, aujourdhui) : null;
        })
        .filter((x): x is string => !!x)
        .sort();
      return {
        ref,
        actionsOuvertes: lire('ecarts') ? actions.length : null,
        actionsEnRetard: lire('ecarts')
          ? actions.filter((o) => !!o.due && o.due.slice(0, 10) < aujourdhui).length
          : null,
        risques: lire('pilotage') ? liees.filter((o) => o.kind === 'risk').length : null,
        series: lire('ecarts') ? series.length : null,
        prochaineEcheance: lire('ecarts') ? (prochaines[0] ?? null) : null,
      };
    });
  }
}
