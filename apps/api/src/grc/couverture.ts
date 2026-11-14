/* Couverture des exigences par les mesures (vue commune de la Bibliothèque de référentiels) : pour chaque référentiel
   appliqué au périmètre (copie propre ou héritée, ADR 0082), une exigence est « couverte » quand une mesure lui est reliée
   par un lien « met en œuvre » fait à la main, sinon « non couverte ». Aides au pilotage, jamais un taux de conformité. */
import {
  etatExigence,
  evaluationEffective,
  exclusionInterdite,
  syntheseEtats,
  type EntreeSynthese,
  type EvaluationExigence,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, type Grc } from './core.js';

/** « requirement:<référentiel>:<version>:<identifiant> » : l'identifiant d'exigence peut contenir « : ». */
export function parseRequirementRef(ref: string) {
  const [kind, fw, version, ...rest] = ref.split(':');
  if (kind !== 'requirement' || !fw || !version || !rest.length) return null;
  return { frameworkId: fw, version: Number(version), requirementId: rest.join(':') };
}
const requirementRef = (fw: string, v: number, id: string) => `requirement:${fw}:${v}:${id}`;

export class GrcCouverture {
  constructor(private readonly g: Grc) {}

  /** Par référentiel rattaché, exigences couvertes (au moins une mesure reliée) et non couvertes ; avec `frameworkId`, le
      détail par exigence et les mesures reliées. Indicateurs d'aide au pilotage. */
  async coverage(smsi: string, user: SessionUser, frameworkId?: string) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    // Référentiels appliqués et actifs (ADR 0082) : exigences et nom de la copie effective du périmètre.
    const effectives = await this.g.copies.effectives(smsi);
    const identifiants = effectives.size
      ? new Map(
          (
            await this.g.db.k
              .selectFrom('lib_frameworks')
              .select(['id', 'identifier'])
              .where('id', 'in', [...effectives.keys()])
              .execute()
          ).map((f) => [f.id, f.identifier]),
        )
      : new Map<string, string>();
    const attached = [...effectives.values()]
      .map((e) => ({
        framework_id: e.effectif.frameworkId,
        name: e.definition.name,
        identifier: identifiants.get(e.effectif.frameworkId) ?? e.definition.identifier,
        version: e.effectif.version,
        origineId: e.effectif.detenteurId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.framework_id.localeCompare(b.framework_id));
    const links = await this.g.db.k
      .selectFrom('grc_links')
      .select(['source_ref', 'target_ref'])
      .where('smsi_id', '=', smsi)
      .where('type', '=', 'implements')
      .where('target_ref', 'like', 'requirement:%')
      .execute();
    const explicit = new Map<string, string[]>();
    for (const l of links) explicit.set(l.target_ref, [...(explicit.get(l.target_ref) ?? []), l.source_ref]);
    // Définitions des copies effectives du périmètre, par couple (référentiel, édition).
    const defs = new Map(
      [...effectives.values()].map((e) => [`${e.effectif.frameworkId}:${e.effectif.version}`, e.definition] as const),
    );
    const measureNames = new Map(
      (
        await this.g.db.k
          .selectFrom('grc_objects')
          .select(['id', 'name'])
          .where('smsi_id', '=', smsi)
          .where('kind', '=', 'measure')
          .execute()
      ).map((o) => ['object:' + o.id, o.name]),
    );
    const evaluations = await this.g.evaluations.courantes(
      smsi,
      attached.map((a) => a.framework_id),
    );
    // Déclaration d'applicabilité (une seule source de l'applicabilité et du niveau, BUG-063) : à défaut d'évaluation enregistrée
    // pour l'exigence, la couverture reprend la décision de la DdA portant le même identifiant (A-6.8…).
    // Déclaration du périmètre : celle de l'outil de suivi au périmètre commun, celle du périmètre sinon (BUG-062).
    const dda: Record<string, Record<string, unknown> | undefined> =
      smsi === DEFAULT_SMSI
        ? (((await this.g.legacy.recompose())?.data.dda ?? {}) as Record<string, Record<string, unknown> | undefined>)
        : Object.fromEntries(
            (
              await this.g.db.k
                .selectFrom('dda_perimetres')
                .select(['mesure_id', 'data'])
                .where('smsi_id', '=', smsi)
                .execute()
            ).map((l) => [l.mesure_id, l.data as Record<string, unknown>]),
          );
    const depuisDda = (id: string): EvaluationExigence | null => {
      const d = dda[id];
      if (!d || (d.app !== 'oui' && d.app !== 'non')) return null;
      const niveau =
        d.level === 'Total' ? 'complete' : d.level === 'Partiel' || d.level === 'Insuffisant' ? 'partielle' : 'aucune';
      return {
        version: 0,
        applicability: d.app === 'non' ? 'exclue' : 'applicable',
        justification: typeof d.just === 'string' ? d.just : '',
        implementation: d.app === 'non' ? 'aucune' : niveau,
        implementationNote: '',
        testedAt: null,
        testResult: null,
        testNote: '',
        testRef: '',
        validatedAt: null,
        validatedBy: null,
        validationNote: '',
        reason: 'Déclaration d’applicabilité',
        createdBy: 'Déclaration d’applicabilité',
        createdAt: '',
      };
    };
    const frameworks = attached.map((a) => {
      const definition = defs.get(`${a.framework_id}:${a.version}`);
      const reqs = definition?.requirements ?? [];
      let covered = 0;
      const etats: EntreeSynthese[] = [];
      for (const r of reqs) {
        const ref = requirementRef(a.framework_id, a.version, r.id);
        if (explicit.has(ref)) covered++;
        const obligatoire = !!definition && exclusionInterdite(definition, r.domain);
        const evaluation = evaluationEffective(
          evaluations.get(`${a.framework_id}:${r.id}`) ?? depuisDda(r.id),
          obligatoire,
        );
        etats.push({
          etat: etatExigence(evaluation),
          applicability: evaluation?.applicability ?? 'a_determiner',
          obligatoire,
        });
      }
      return {
        frameworkId: a.framework_id,
        identifier: a.identifier,
        name: a.name,
        version: a.version,
        /** Périmètre qui porte le rattachement (le périmètre lui-même, ou l'ancêtre dont il hérite). */
        origineId: a.origineId,
        requirements: reqs.length,
        covered,
        uncovered: reqs.length - covered,
        etats: syntheseEtats(etats),
      };
    });
    const detail = frameworkId
      ? (() => {
          const a = attached.find((x) => x.framework_id === frameworkId);
          if (!a) throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
          const definition = defs.get(`${a.framework_id}:${a.version}`);
          return (definition?.requirements ?? []).slice(0, 1000).map((r) => {
            const ref = requirementRef(a.framework_id, a.version, r.id);
            const measures = (explicit.get(ref) ?? []).map((m) => ({ ref: m, name: measureNames.get(m) ?? '' }));
            const obligatoire = !!definition && exclusionInterdite(definition, r.domain);
            const enregistree = evaluations.get(`${a.framework_id}:${r.id}`) ?? depuisDda(r.id);
            const evaluation = evaluationEffective(enregistree, obligatoire);
            const etat = etatExigence(evaluation);
            return {
              id: r.id,
              title: r.title,
              status: measures.length ? 'covered' : 'uncovered',
              measures,
              evaluation,
              etat,
              obligatoire,
              exclusionIllicite: obligatoire && enregistree?.applicability === 'exclue',
              // Une mise en œuvre déclarée sans mesure reliée : à justifier, jamais comptée comme preuve.
              sansMesure:
                !measures.length &&
                (etat === 'partiel' || etat === 'implemente' || etat === 'teste' || etat === 'valide_metier'),
            };
          });
        })()
      : null;
    return { frameworks, detail };
  }
}
