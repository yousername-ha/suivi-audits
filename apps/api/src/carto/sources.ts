/* Source des objets de la cartographie (CARTO-02, ADR 0013 § 4) : interface unique, une implémentation par origine.
   Aujourd'hui : l'état legacy recomposé, filtré selon les droits de la personne. Quand un module sera repris, sa
   source lira les tables sans changer l'interface ni les cartes (références stables). */
import { legacyKeyModule, type Module, type Rights } from '@suivi/shared';
import {
  MapSettingsSchema,
  buildObjects,
  deriveRelations,
  refModule,
  type CartoObject,
  type DerivedRelation,
} from '@suivi/shared/carto';
import type { JsonObject } from '@suivi/shared/legacy';
import { DEFAULT_SMSI } from '../grc/core.js';
import { redactLegacy } from '../routes/suivi.js';
import type { Services } from '../services.js';
import { listMaps } from './maps.js';

export interface CartoObjectSource {
  /** Objets normalisés visibles par la personne (jamais d'objet d'un module qu'elle ne peut pas lire). */
  list(ctx: { rights: Rights }): Promise<CartoObject[]>;
  /** Relations métier dérivées (lecture seule sur la carte). */
  relations(objects: CartoObject[]): DerivedRelation[];
}

/** Modules d'origine des objets de la carte (pour « Objet non accessible »). */
export const SOURCE_MODULES: readonly Module[] = ['pilotage', 'fournisseurs', 'conformite'];

export class LegacyCartoSource implements CartoObjectSource {
  constructor(private readonly svc: Services) {}

  async list({ rights }: { rights: Rights }): Promise<CartoObject[]> {
    const st = await this.svc.legacy.recompose();
    const data = redactLegacy((st?.data ?? {}) as JsonObject, rights);
    const context = (await listMaps(this.svc.db.pool, true)).find((m) => m.view === 'context');
    const settings = MapSettingsSchema.catch({}).parse(context?.settings ?? {});
    // Fiches saisies à l'écran du périmètre commun (BUG-053) : parties intéressées, menaces et opportunités des SWOT, enjeux
    // des contextes, reprises avec celles de l'outil historique pour la carte.
    const natifs = rights.can('pilotage', 'lire') ? await this.fichesPilotage() : { parties: [], enjeux: [] };
    if (natifs.parties.length)
      data.interested = [...(Array.isArray(data.interested) ? data.interested : []), ...natifs.parties];
    const objs = buildObjects(data, {
      org: this.svc.settings.get('general').orgName,
      issueKind: settings.issueKind,
      mapIssues: [...(settings.issues ?? []), ...natifs.enjeux],
      details: true,
      lisible: (k) => {
        const m = legacyKeyModule(k);
        return !!m && rights.can(m, 'lire');
      },
    });
    return [...objs.values()].filter((o) => {
      const m = refModule(o.ref);
      return !m || rights.can(m, 'lire');
    });
  }

  private async fichesPilotage() {
    const rows = await this.svc.db.k
      .selectFrom('grc_objects')
      .select(['id', 'kind', 'name', 'data'])
      .where('smsi_id', '=', DEFAULT_SMSI)
      .where('kind', 'in', ['stakeholder', 'swot', 'context'])
      .where('archived', '=', false)
      .orderBy('name')
      .limit(500)
      .execute();
    const lignes = (v: unknown) =>
      (typeof v === 'string' ? v : '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
    const parties: JsonObject[] = [];
    const enjeux: { label: string; desc?: string; kind: 'ext' | 'int' }[] = [];
    for (const r of rows) {
      const d = r.data as Record<string, unknown>;
      if (r.kind === 'stakeholder')
        parties.push({
          id: `N-${r.id}`,
          name: r.name,
          type: typeof d.nature === 'string' ? d.nature : '',
          cat: typeof d.category === 'string' ? d.category : '',
          needs: typeof d.expectations === 'string' ? d.expectations : '',
          req: typeof d.requirements === 'string' ? d.requirements : '',
          addressed: typeof d.addressed === 'string' ? d.addressed : '',
          reviewed: typeof d.reviewedAt === 'string' ? d.reviewedAt : '',
        });
      else if (r.kind === 'swot')
        for (const [champ, kind, l] of [
          ['threats', 'ext', 'Menace'],
          ['opportunities', 'ext', 'Opportunité'],
          ['weaknesses', 'int', 'Faiblesse'],
          ['strengths', 'int', 'Force'],
        ] as const)
          for (const t of lignes(d[champ])) enjeux.push({ label: t, desc: `${l} — ${r.name}`, kind });
      else
        for (const t of lignes(d.issues))
          enjeux.push({
            label: t.replace(/^(externes?|internes?)\s*:\s*/i, ''),
            desc: `Contexte — ${r.name}`,
            kind: /^internes?\b/i.test(t) ? 'int' : 'ext',
          });
    }
    return { parties, enjeux };
  }

  relations(objects: CartoObject[]): DerivedRelation[] {
    return deriveRelations(new Map(objects.map((o) => [o.ref, o])));
  }
}
