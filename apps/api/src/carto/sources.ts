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
import { redactLegacy } from '../routes/suivi.js';
import type { Services } from '../services.js';
import { listMaps } from './maps.js';

interface CartoObjectSource {
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
    const objs = buildObjects(data, {
      org: this.svc.settings.get('general').orgName,
      issueKind: settings.issueKind,
      mapIssues: settings.issues,
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

  relations(objects: CartoObject[]): DerivedRelation[] {
    return deriveRelations(new Map(objects.map((o) => [o.ref, o])));
  }
}
