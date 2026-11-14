/* PESTEL des enjeux externes (ISO 9001:2015, 4.1) : regroupement des enjeux existants (carte de contexte), jamais un nouvel
   objet. Le facteur de chaque enjeu est rangé dans la fiche de périmètre de l'outil de suivi (`scope.issueFactors`), sous
   verrou et avec le journal d'audit ; la nomenclature des facteurs vient de la politique métier du périmètre. */
import { GRC_MODULES, PESTEL_PAR_DEFAUT, regrouperPestel, type EnjeuPestel, type VuePestel } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import { LegacyCartoSource } from '../carto/sources.js';
import { surConnexion, type Client } from '../db/db.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import { verrouillerEtat } from '../legacy/store.js';
import type { Services } from '../services.js';

const PestelBody = z
  .object({
    assignments: z
      .record(
        // Enjeu historique (`issue:…`) ou ligne d'une fiche du Pilotage (`swot:<id>:<O|T>:<n>`, `context:<id>:<n>`).
        z.string().regex(/^(issue:[0-9a-z]{1,16}|swot:[0-9a-f-]{36}:[OT]:\d{1,4}|context:[0-9a-f-]{36}:\d{1,4})$/),
        z.string().max(40),
      )
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

  /** Enjeux saisis à l'écran : menaces et opportunités des SWOT (externes), lignes des fiches de contexte (« Internes : »
      interne, sinon externe), classés selon le réglage du périmètre (BUG-053). */
  private async enjeuxNatifs(smsi: string, affectations: Record<string, string>): Promise<EnjeuPestel[]> {
    const rows = await this.g.db.k
      .selectFrom('grc_objects')
      .select(['id', 'kind', 'name', 'data'])
      .where('smsi_id', '=', smsi)
      .where('kind', 'in', ['swot', 'context'])
      .where('archived', '=', false)
      .orderBy('name')
      .limit(500)
      .execute();
    const lignes = (v: unknown) =>
      (typeof v === 'string' ? v : '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
    const out: EnjeuPestel[] = [];
    for (const r of rows) {
      const d = r.data as Record<string, unknown>;
      if (r.kind === 'swot')
        for (const [cle, champ] of [
          ['T', 'threats'],
          ['O', 'opportunities'],
        ] as const)
          lignes(d[champ]).forEach((t, n) => {
            const ref = `swot:${r.id}:${cle}:${n}`;
            out.push({
              ref,
              label: t,
              nature: 'ext',
              description: `${cle === 'T' ? 'Menace' : 'Opportunité'} · ${r.name}`,
              processus: [],
              facteur: affectations[ref] ?? null,
            });
          });
      else
        lignes(d.issues).forEach((t, n) => {
          const ref = `context:${r.id}:${n}`;
          const interne = /^internes?\b/i.test(t);
          out.push({
            ref,
            label: t.replace(/^(externes?|internes?)\s*:\s*/i, ''),
            nature: interne ? 'int' : 'ext',
            description: `Contexte · ${r.name}`,
            processus: [],
            facteur: interne ? null : (affectations[ref] ?? null),
          });
        });
    }
    return out;
  }

  private async affectationsNatives(smsi: string, c?: Client): Promise<Record<string, string>> {
    const r = await (c ? surConnexion(c) : this.g.db.k)
      .selectFrom('settings')
      .select('value')
      .where('key', '=', `pestel:${smsi}`)
      .executeTakeFirst();
    const v = r?.value as { assignments?: Record<string, string> } | undefined;
    return v?.assignments ?? {};
  }

  async lire(smsi: string, user: SessionUser): Promise<VuePestel> {
    await this.g.access(smsi, user);
    await this.g.permission(user, GRC_MODULES.context, 'lire');
    // Les enjeux de l'outil de suivi historique relèvent du périmètre commun ; les fiches du Pilotage, de leur périmètre.
    let enjeux: EnjeuPestel[] = [];
    if (smsi === DEFAULT_SMSI) {
      const objets = await new LegacyCartoSource(this.svc).list({ rights: user.rights });
      const etat = await this.g.legacy.recompose();
      const scope = isObject(etat?.data.scope) ? (etat!.data.scope as JsonObject) : {};
      const affectations = isObject(scope.issueFactors) ? (scope.issueFactors as JsonObject) : {};
      enjeux = objets
        .filter((o) => o.type === 'external_issue' || o.type === 'internal_issue')
        .map((o) => ({
          ref: o.ref,
          label: o.name,
          nature: o.type === 'external_issue' ? 'ext' : 'int',
          description: o.sub ?? '',
          processus: o.procs ?? [],
          facteur: typeof affectations[o.ref] === 'string' ? (affectations[o.ref] as string) : null,
        }));
    }
    enjeux.push(...(await this.enjeuxNatifs(smsi, await this.affectationsNatives(smsi))));
    return regrouperPestel(enjeux, await this.facteurs(smsi, user));
  }

  async affecter(smsi: string, input: unknown, user: SessionUser, ip: string) {
    const body = PestelBody.parse(input);
    const facteurs = new Set((await this.facteurs(smsi, user)).map((f) => f.id));
    for (const f of Object.values(body.assignments))
      if (f && !facteurs.has(f)) throw new HttpError(422, `Facteur inconnu de la nomenclature : ${f}.`);
    const natives = Object.fromEntries(Object.entries(body.assignments).filter(([r]) => !r.startsWith('issue:')));
    const historiques = Object.fromEntries(Object.entries(body.assignments).filter(([r]) => r.startsWith('issue:')));
    if (Object.keys(historiques).length && smsi !== DEFAULT_SMSI)
      throw new HttpError(404, 'Ces enjeux appartiennent au pilotage commun.');
    const connus = new Set(
      smsi === DEFAULT_SMSI
        ? (await new LegacyCartoSource(this.svc).list({ rights: user.rights }))
            .filter((o) => o.type === 'external_issue')
            .map((o) => o.ref)
        : [],
    );
    const natifsConnus = new Set(
      (await this.enjeuxNatifs(smsi, {})).filter((e) => e.nature === 'ext').map((e) => e.ref),
    );
    for (const ref of Object.keys(body.assignments))
      if (!connus.has(ref) && !natifsConnus.has(ref))
        throw new HttpError(422, 'Seul un enjeu externe existant se classe dans le PESTEL.');
    if (!Object.keys(historiques).length) {
      return this.g.db.tx(async (c) => {
        await this.g.access(smsi, user, true, c);
        await this.g.permission(user, GRC_MODULES.context, 'modifier');
        const actuel = await this.affectationsNatives(smsi, c);
        for (const [ref, facteur] of Object.entries(natives)) {
          if (facteur) actuel[ref] = facteur;
          else delete actuel[ref];
        }
        await surConnexion(c)
          .insertInto('settings')
          .values({ key: `pestel:${smsi}`, value: JSON.stringify({ assignments: actuel }) })
          .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify({ assignments: actuel }) }))
          .execute();
        await this.g.db.audit(
          user,
          ip,
          'pilotage.pestel.updated',
          `pestel:${smsi}`,
          { count: Object.keys(natives).length },
          c,
        );
        return { classes: Object.keys(actuel).length };
      }, user.username);
    }
    return this.g.db.tx(async (c) => {
      await this.g.access(smsi, user, true, c);
      await this.g.permission(user, GRC_MODULES.context, 'modifier');
      await verrouillerEtat(c);
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
