/* Boîtes de pilotage par processus (ISO 9001:2015, 4.4.1 c et 9.1.1) : ce qui est rattaché à chaque processus dans le
   registre commun (actions ouvertes, risques, séries récurrentes) et la prochaine échéance récurrente. Les indicateurs eux-
   mêmes sont lus et calculés avec l'état de l'outil de suivi. Aucun taux de conformité n'est calculé ici. */
import { GRC_MODULES, Recurrence, prochaineOccurrence } from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { horsRegistresMasques } from '../grc/registres.js';
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
    // Chemins jsonb fixes.
    const objets = await this.g.db.k
      .selectFrom('grc_objects')
      .select([
        'id',
        'kind',
        sql<string | null>`data->>'status'`.as('status'),
        sql<string | null>`data->>'dueAt'`.as('due'),
        sql<unknown>`data->'refs'`.as('refs'),
        sql<unknown>`data->'recurrence'`.as('recurrence'),
      ])
      .where('smsi_id', '=', smsi)
      .where('archived', '=', false)
      .where('kind', 'in', ['action', 'risk', 'task_series'])
      .where(horsRegistresMasques(masques))
      .limit(20000)
      .execute();
    const liens = await this.g.db.k
      .selectFrom('grc_links')
      .select(['source_ref', 'target_ref'])
      .where('smsi_id', '=', smsi)
      .where((eb) =>
        eb.or([eb('source_ref', 'like', 'legacy:processes:%'), eb('target_ref', 'like', 'legacy:processes:%')]),
      )
      .execute();
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
