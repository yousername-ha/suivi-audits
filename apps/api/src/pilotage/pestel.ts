/* PESTEL des enjeux externes (ISO 9001:2015, 4.1) : regroupement des enjeux existants (carte de contexte), jamais un nouvel
   objet. Le facteur de chaque enjeu est rangé dans la fiche de périmètre de l'outil de suivi (`scope.issueFactors`), sous
   verrou et avec le journal d'audit ; la nomenclature des facteurs vient de la politique métier du périmètre. */
import { GRC_MODULES, PESTEL_PAR_DEFAUT, regrouperPestel, type EnjeuPestel, type VuePestel } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import { LegacyCartoSource } from '../carto/sources.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import type { Services } from '../services.js';

const PestelBody = z
  .object({
    assignments: z
      .record(z.string().regex(/^issue:[0-9a-z]{1,16}$/), z.string().max(40))
      .refine((a) => Object.keys(a).length <= 1000),
  })
  .strict();

export class PilotagePestel {
  constructor(
    private readonly g: Grc,
    private readonly svc: Services,
  ) {}

  private async facteurs(smsi: string, user: SessionUser) {
    const politique = (await this.g.policy(smsi, user)).definition;
    return politique.catalogues.pestelFactors ?? PESTEL_PAR_DEFAUT.map((f) => ({ ...f }));
  }

  async lire(smsi: string, user: SessionUser): Promise<VuePestel> {
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    await this.g.access(smsi, user);
    await this.g.permission(user, GRC_MODULES.context, 'lire');
    const objets = await new LegacyCartoSource(this.svc).list({ rights: user.rights });
    const etat = await this.g.legacy.recompose();
    const scope = isObject(etat?.data.scope) ? (etat!.data.scope as JsonObject) : {};
    const affectations = isObject(scope.issueFactors) ? (scope.issueFactors as JsonObject) : {};
    const enjeux: EnjeuPestel[] = objets
      .filter((o) => o.type === 'external_issue' || o.type === 'internal_issue')
      .map((o) => ({
        ref: o.ref,
        label: o.name,
        nature: o.type === 'external_issue' ? 'ext' : 'int',
        description: o.sub ?? '',
        processus: o.procs ?? [],
        facteur: typeof affectations[o.ref] === 'string' ? (affectations[o.ref] as string) : null,
      }));
    return regrouperPestel(enjeux, await this.facteurs(smsi, user));
  }

  async affecter(smsi: string, input: unknown, user: SessionUser, ip: string) {
    const body = PestelBody.parse(input);
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    const facteurs = new Set((await this.facteurs(smsi, user)).map((f) => f.id));
    for (const f of Object.values(body.assignments))
      if (f && !facteurs.has(f)) throw new HttpError(422, `Facteur inconnu de la nomenclature : ${f}.`);
    const connus = new Set(
      (await new LegacyCartoSource(this.svc).list({ rights: user.rights }))
        .filter((o) => o.type === 'external_issue')
        .map((o) => o.ref),
    );
    for (const ref of Object.keys(body.assignments))
      if (!connus.has(ref)) throw new HttpError(422, 'Seul un enjeu externe existant se classe dans le PESTEL.');
    return this.g.db.tx(async (c) => {
      await this.g.access(smsi, user, true, c);
      await this.g.permission(user, GRC_MODULES.context, 'modifier');
      await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      const etat = await this.g.legacy.recompose(c);
      if (!etat) throw new HttpError(409, 'Registre historique indisponible.');
      const scope = isObject(etat.data.scope) ? { ...(etat.data.scope as JsonObject) } : {};
      const actuel = isObject(scope.issueFactors) ? { ...(scope.issueFactors as JsonObject) } : {};
      for (const [ref, facteur] of Object.entries(body.assignments)) {
        if (facteur) actuel[ref] = facteur;
        else delete actuel[ref];
      }
      scope.issueFactors = actuel;
      etat.data.scope = scope;
      const r = await this.g.legacy.nativeWrite(c, etat.data, user, etat.version);
      if (r.conflict) throw new HttpError(412, 'Le contexte a changé. Rechargez avant de classer.');
      await this.g.db.audit(
        user,
        ip,
        'pilotage.pestel.updated',
        'legacy:scope:instance',
        { count: Object.keys(body.assignments).length },
        c,
      );
      await this.g.notify(c, 'legacy:scope:instance', r.version, DEFAULT_SMSI, GRC_MODULES.context, user.username);
      return { classes: Object.keys(actuel).length };
    }, user.username);
  }
}
