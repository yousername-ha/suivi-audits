/* Page « Processus » en cartes : lecture agrégée d'un processus et de ce qui lui est rattaché. Les rattachements se lisent
   à leur source : objectifs (champ `processes` de l'objectif), SWOT (champ `process` de l'analyse), risques (références de la
   fiche) et liens transverses (indicateurs, SWOT, risques, fournisseurs). Aucune copie, aucun taux calculé. */
import {
  NATURES_RATTACHEMENT,
  type Candidat,
  type CarteProcessus,
  type NatureRattachement,
  type ProcessusCartes,
  type Rattache,
} from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { horsRegistresMasques } from '../grc/registres.js';
import { HttpError } from '../http/errors.js';

type Obj = Record<string, unknown>;
const lignes = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObject) : []);
const texte = (v: unknown) => (typeof v === 'string' ? v : '');
const identifiants = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export class PilotageProcessusCartes {
  constructor(private readonly g: Grc) {}

  async lire(smsi: string, user: SessionUser): Promise<Omit<ProcessusCartes, 'types'>> {
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    await this.g.access(smsi, user);
    await this.g.permission(user, 'pilotage', 'lire');
    const etat = (await this.g.legacy.recompose())?.data ?? {};
    const peutFournisseurs = user.rights.can('fournisseurs', 'lire');

    const processus = lignes(etat.processes).filter((p) => texte(p.id));
    const objectifs = lignes(etat.objectives).filter((o) => texte(o.id));
    const indicateurs = lignes(etat.indicators).filter((i) => texte(i.id));
    const swots = lignes(etat.swots).filter((s) => texte(s.id));
    const fournisseurs = lignes(etat.suppliers).filter((f) => texte(f.id));

    const masques = await this.g.registres.inaccessibles(user, smsi);
    const risques = await this.g.db.k
      .selectFrom('grc_objects')
      .select(['id', 'name', sql<unknown>`data->'refs'`.as('refs')])
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'risk')
      .where('archived', '=', false)
      .where(horsRegistresMasques(masques))
      .orderBy(sql`lower(name)`)
      .limit(2000)
      .execute();
    const liens = await this.g.db.k
      .selectFrom('grc_links')
      .select(['id', 'source_ref', 'target_ref', 'type'])
      .where('smsi_id', '=', smsi)
      .where((eb) =>
        eb.or([eb('target_ref', 'like', 'legacy:processes:%'), eb('source_ref', 'like', 'legacy:processes:%')]),
      )
      .execute();

    const objetsConnus = new Map<NatureRattachement, Map<string, Candidat>>([
      ['objectifs', new Map(objectifs.map((o) => [`legacy:objectives:${texte(o.id)}`, cand('objectives', o)]))],
      ['indicateurs', new Map(indicateurs.map((i) => [`legacy:indicators:${texte(i.id)}`, cand('indicators', i)]))],
      [
        'swots',
        new Map(
          swots.map((s) => [
            `legacy:swots:${texte(s.id)}`,
            { ref: `legacy:swots:${texte(s.id)}`, id: texte(s.id), name: texte(s.name) || `SWOT ${texte(s.id)}` },
          ]),
        ),
      ],
      ['risques', new Map(risques.map((r) => [`object:${r.id}`, { ref: `object:${r.id}`, id: r.id, name: r.name }]))],
      ['fournisseurs', new Map(fournisseurs.map((f) => [`legacy:suppliers:${texte(f.id)}`, cand('suppliers', f)]))],
    ]);

    const cartes: CarteProcessus[] = processus.map((p) => {
      const id = texte(p.id),
        ref = `legacy:processes:${id}`;
      const rattaches: Record<NatureRattachement, Rattache[] | null> = {
        objectifs: [],
        indicateurs: [],
        swots: [],
        risques: [],
        fournisseurs: peutFournisseurs ? [] : null,
      };
      const ajouter = (nature: NatureRattachement, ref_: string, via: Rattache['via'], lienId: string | null) => {
        const liste = rattaches[nature];
        const c = objetsConnus.get(nature)?.get(ref_);
        if (!liste || !c || liste.some((x) => x.ref === ref_)) return;
        liste.push({ ref: ref_, id: c.id, name: c.name, via, lienId });
      };
      // Objectifs du processus, puis indicateurs de ces objectifs.
      for (const o of objectifs)
        if (identifiants(o.processes).includes(id)) {
          ajouter('objectifs', `legacy:objectives:${texte(o.id)}`, 'fiche', null);
          for (const i of indicateurs)
            if (texte(i.obj) === texte(o.id))
              ajouter('indicateurs', `legacy:indicators:${texte(i.id)}`, 'objectif', null);
        }
      // SWOT saisi « par processus » et risques qui citent le processus dans leur fiche.
      for (const s of swots)
        if (texte(s.process) === id) ajouter('swots', `legacy:swots:${texte(s.id)}`, 'fiche', null);
      for (const r of risques)
        if (identifiants(r.refs).includes(ref)) ajouter('risques', `object:${r.id}`, 'fiche', null);
      // Liens transverses, dans un sens ou dans l'autre.
      for (const l of liens) {
        const autre = l.source_ref === ref ? l.target_ref : l.target_ref === ref ? l.source_ref : null;
        if (!autre) continue;
        for (const nature of NATURES_RATTACHEMENT)
          if (nature !== 'objectifs' && objetsConnus.get(nature)?.has(autre)) ajouter(nature, autre, 'lien', l.id);
      }
      return {
        id,
        ref,
        name: texte(p.name) || id,
        owner: texte(p.owner),
        family: texte(p.family),
        parent: texte(p.parent),
        purpose: texte(p.purpose),
        rattaches,
      };
    });

    const candidats = Object.fromEntries(
      NATURES_RATTACHEMENT.map((n) => {
        if (n === 'fournisseurs' && !peutFournisseurs) return [n, null];
        return [n, [...(objetsConnus.get(n)?.values() ?? [])]];
      }),
    ) as ProcessusCartes['candidats'];
    return { processus: cartes, candidats };
  }
}

function cand(cle: string, o: Obj): Candidat {
  return { ref: `legacy:${cle}:${texte(o.id)}`, id: texte(o.id), name: texte(o.name) || texte(o.id) };
}
