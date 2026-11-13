/* Kit d'intégration IA (ADR 0055) : aperçu puis import des contrôles IA internes dans la bibliothèque de référentiels et
   des annexes de veille. Les correspondances vers l'ISO/IEC 27001 et l'HDS que le kit pouvait porter ne sont plus
   importées (ADR 0089, lot 3). L'import est idempotent : le même kit, octet pour octet, n'écrit rien de plus. Aucun texte
   normatif n'est repris. */
import { createHash } from 'node:crypto';
import { KIT_IA_IDENTIFIANT, KitIaBundle, kitVersReferentiel } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

/** Forme canonique : clés triées à tous les niveaux (jsonb réordonne les clés, la comparaison ne doit pas en dépendre). */
const canon = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, x]) => [k, canon(x)]),
        )
      : v;
const empreinte = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canon(v)))
    .digest('hex');

export class GrcKitIa {
  constructor(private readonly g: Grc) {}

  private analyser(input: unknown) {
    // Le caractère nul passe la validation du schéma mais PostgreSQL le refuse dans un jsonb : refus net, avant toute écriture.
    if (JSON.stringify(input ?? null).includes('\\u0000'))
      throw new HttpError(422, 'Kit invalide : caractère nul interdit.');
    const parsed = KitIaBundle.safeParse(input);
    if (!parsed.success)
      throw new HttpError(
        422,
        'Kit invalide : ' +
          parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.') || 'kit'} : ${i.message}`)
            .join(' ; '),
      );
    return parsed.data;
  }

  async apercu(input: unknown, user: SessionUser) {
    return (await this.calculer(input, user)).apercu;
  }

  private async calculer(input: unknown, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'modifier');
    const b = this.analyser(input);
    const definition = kitVersReferentiel(b);
    const existant = (await this.g.library.list(user)).find((f) => f.identifier === KIT_IA_IDENTIFIANT) ?? null;
    const p = await this.g.library.preview(existant?.id ?? null, definition, user);
    const derniere = existant ? (await this.g.library.version(existant.id, existant.version, user)).definition : null;
    const identique = !!derniere && empreinte(derniere) === empreinte(definition);
    const sha = empreinte(b);
    // Déjà importé : même kit, octet pour octet (trace immuable existante).
    const dejaImporte = !!(await this.g.db.k
      .selectFrom('lib_kit_ia')
      .select('id')
      .where('sha256', '=', sha)
      .executeTakeFirst());
    const parDomaine = new Map<string, number>();
    for (const c of b.controls) parDomaine.set(c.domain, (parDomaine.get(c.domain) ?? 0) + 1);
    const avertissements = [
      'Contrôles internes proposés par l’organisation : ils ne reproduisent aucun texte normatif et ne valent pas conformité.',
      ...(b.deltas.length
        ? [
            `${b.deltas.length} delta(s) HDS 2.1 préparatoires : lisibles en veille, jamais importés comme exigences en vigueur.`,
          ]
        : []),
      ...(b.sources.length || b.deltas.length
        ? ['Sources et statuts juridiques du kit : à revérifier (aucune date de vérification n’est enregistrée).']
        : []),
    ];
    const apercu = {
      version: b.version,
      sha256: sha,
      dejaImporte,
      controles: b.controls.length,
      domaines: [...parDomaine].map(([domaine, n]) => ({ domaine, n })),
      portees: {
        externe: b.controls.filter((c) => c.eligible_scopes.length === 1 && c.eligible_scopes[0] === 'external').length,
        metier: b.controls.filter((c) => c.eligible_scopes.length === 1 && c.eligible_scopes[0] === 'business').length,
        les_deux: b.controls.filter((c) => c.eligible_scopes.length === 2).length,
      },
      referentiel: {
        existant: !!existant,
        versionCourante: existant?.version ?? 0,
        identique,
        previewId: p.previewId,
        warning: p.warning,
      },
      annexes: {
        actions: b.actions.length,
        scenarios: b.scenarios.length,
        deltas: b.deltas.length,
        memosHds: b.memosHds.length,
        questions: b.questionnaire.length,
        sources: b.sources.length,
      },
      avertissements,
    };
    return { b, apercu };
  }

  async importer(input: unknown, previewId: string, reason: string, user: SessionUser, ip: string) {
    const { b, apercu } = await this.calculer(input, user);
    if (apercu.referentiel.previewId !== previewId)
      throw new HttpError(422, 'Relancez l’aperçu : le contenu a changé.');
    if (apercu.dejaImporte) return { statut: 'deja_importe' as const, controles: apercu.controles };
    const definition = kitVersReferentiel(b);
    const existant = (await this.g.library.list(user)).find((f) => f.identifier === KIT_IA_IDENTIFIANT) ?? null;
    let frameworkId: string;
    let version: number;
    if (existant && apercu.referentiel.identique) {
      frameworkId = existant.id;
      version = existant.version;
    } else {
      const p = await this.g.library.preview(existant?.id ?? null, definition, user);
      const pub = await this.g.library.publish(
        existant?.id ?? null,
        definition,
        p.version,
        p.previewId,
        reason,
        user,
        ip,
      );
      frameworkId = pub.id;
      version = pub.version;
    }
    await this.g.db.tx(async (c, k) => {
      await k
        .insertInto('lib_kit_ia')
        .values({
          sha256: apercu.sha256,
          kit_version: b.version,
          framework_id: frameworkId,
          framework_version: version,
          annexes: JSON.stringify({
            actions: b.actions,
            scenarios: b.scenarios,
            deltas: b.deltas,
            memosHds: b.memosHds,
            questionnaire: b.questionnaire,
            sources: b.sources,
          }),
          reason,
          imported_by: user.username,
        })
        .onConflict((oc) => oc.column('sha256').doNothing())
        .execute();
      await this.g.db.audit(
        user,
        ip,
        'library.ia_kit.imported',
        frameworkId,
        { version, controles: b.controls.length, sha256: apercu.sha256 },
        c,
      );
    }, user.username);
    return {
      statut: 'importe' as const,
      controles: b.controls.length,
      frameworkId,
      version,
    };
  }

  /** Dernier kit importé : version, date et annexes de veille ; sources et deltas portent toujours « à revérifier ». */
  async dernier(user: SessionUser) {
    await this.g.permission(user, 'conformite', 'lire');
    const r = await this.g.db.k
      .selectFrom('lib_kit_ia')
      .select(['kit_version', 'framework_id', 'framework_version', 'annexes', 'imported_by', 'imported_at'])
      .orderBy('imported_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (!r) return { importe: false as const };
    return {
      importe: true as const,
      version: r.kit_version,
      frameworkId: r.framework_id,
      frameworkVersion: r.framework_version,
      importePar: r.imported_by,
      importeLe: r.imported_at,
      annexes: r.annexes as Record<string, unknown>,
      statutJuridique: 'a_reverifier' as const,
    };
  }
}
