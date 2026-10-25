/* Kit d'intégration IA (ADR 0055) : aperçu puis import des contrôles IA internes dans la bibliothèque de référentiels,
   correspondances proposées vers l'ISO/IEC 27001 et l'HDS (jamais validées automatiquement), et annexes de veille.
   L'import est idempotent : le même kit, octet pour octet, n'écrit rien de plus. Aucun texte normatif n'est repris. */
import { createHash } from 'node:crypto';
import {
  KIT_IA_IDENTIFIANT,
  KitIaBundle,
  cibleHds,
  cibleIso,
  jetonsHds,
  jetonsIso,
  kitVersReferentiel,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

const URL_ISO = 'https://www.iso.org/fr/standard/27001';
const URL_HDS =
  'https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante/les-referentiels-de-la-procedure-de-certification';
const empreinte = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

interface Correspondance {
  controle: string;
  cible: { frameworkId: string; version: number; requirementId: string };
  indication: string;
  typeReference: 'ISO27001' | 'HDS_V2_0';
  explication: string;
}
interface NonResolue {
  controle: string;
  type: string;
  indication: string;
  raison: string;
}

export class GrcKitIa {
  constructor(private readonly g: Grc) {}

  /** Référentiel de la bibliothèque dont l'identifiant commence par le préfixe donné (version courante). */
  private async cible(prefixe: string, user: SessionUser) {
    const f = (await this.g.library.list(user)).find((x) => x.identifier.startsWith(prefixe));
    if (!f) return null;
    const v = await this.g.library.version(f.id, f.version, user);
    return { frameworkId: f.id, version: f.version, exigences: v.definition.requirements };
  }

  private async resoudre(b: KitIaBundle, user: SessionUser) {
    const iso = await this.cible('iso-27001', user);
    const hds = await this.cible('hds', user);
    const resolues: Correspondance[] = [];
    const nonResolues: NonResolue[] = [];
    let themes = 0;
    const vus = new Set<string>();
    for (const m of b.correspondances) {
      if (m.target_reference_type === 'ISO42001_THEME') {
        themes++;
        continue;
      }
      const cible = m.target_reference_type === 'ISO27001' ? iso : hds;
      const nom = m.target_reference_type === 'ISO27001' ? 'ISO/IEC 27001' : 'HDS';
      const base = { controle: m.internal_control_id, type: m.target_reference_type, indication: m.reference_hint_raw };
      if (!cible) {
        nonResolues.push({ ...base, raison: `Référentiel ${nom} absent de la bibliothèque.` });
        continue;
      }
      const ids =
        m.target_reference_type === 'ISO27001'
          ? (() => {
              const j = jetonsIso(m.reference_hint_raw);
              return [
                ...j.annexe.flatMap((t) => cibleIso(cible.exigences, 'annexe', t)),
                ...j.clause.flatMap((t) => cibleIso(cible.exigences, 'clause', t)),
              ];
            })()
          : jetonsHds(m.reference_hint_raw).flatMap((t) => cibleHds(cible.exigences, t));
      if (!ids.length) {
        nonResolues.push({ ...base, raison: 'Aucune exigence reconnue pour cette indication.' });
        continue;
      }
      for (const id of new Set(ids)) {
        const cle = `${m.internal_control_id}>${cible.frameworkId}:${id}`;
        if (vus.has(cle)) continue;
        vus.add(cle);
        resolues.push({
          controle: m.internal_control_id,
          cible: { frameworkId: cible.frameworkId, version: cible.version, requirementId: id },
          indication: m.reference_hint_raw,
          typeReference: m.target_reference_type,
          explication: m.explanation ?? '',
        });
      }
    }
    return { resolues, nonResolues, themes };
  }

  private analyser(input: unknown) {
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
    await this.g.permission(user, 'conformite', 'modifier');
    const b = this.analyser(input);
    const definition = kitVersReferentiel(b);
    const existant = (await this.g.library.list(user)).find((f) => f.identifier === KIT_IA_IDENTIFIANT) ?? null;
    const p = await this.g.library.preview(existant?.id ?? null, definition, user);
    const derniere = existant ? (await this.g.library.version(existant.id, existant.version, user)).definition : null;
    const identique = !!derniere && empreinte(derniere) === empreinte(definition);
    const sha = empreinte(b);
    const dejaTrace = !!(await this.g.db.one('SELECT 1 FROM lib_kit_ia WHERE sha256=$1', [sha]));
    const { resolues, nonResolues, themes } = await this.resoudre(b, user);
    const existantes = existant
      ? (await this.g.libraryMappings.list(user, { frameworkId: existant.id })).filter((m) => m.status !== 'withdrawn')
      : [];
    const dejaPresentes = new Set(
      existantes.map((m) => `${m.source.requirementId}>${m.target.frameworkId}:${m.target.requirementId}`),
    );
    const nouvelles = resolues.filter(
      (m) => !dejaPresentes.has(`${m.controle}>${m.cible.frameworkId}:${m.cible.requirementId}`),
    ).length;
    // Déjà importé : même contenu et rien de nouveau à rattacher (un référentiel cible importé depuis permet de compléter).
    const dejaImporte = dejaTrace && nouvelles === 0;
    const parDomaine = new Map<string, number>();
    for (const c of b.controls) parDomaine.set(c.domain, (parDomaine.get(c.domain) ?? 0) + 1);
    const avertissements = [
      'Contrôles internes proposés par l’organisation : ils ne reproduisent aucun texte normatif et ne valent pas conformité.',
      'Toutes les correspondances sont importées « proposées » : aucune n’est validée sans décision humaine.',
      ...(b.deltas.length
        ? [
            `${b.deltas.length} delta(s) HDS 2.1 préparatoires : lisibles en veille, jamais importés comme exigences en vigueur.`,
          ]
        : []),
      ...(b.sources.length || b.deltas.length
        ? ['Sources et statuts juridiques du kit : à revérifier (aucune date de vérification n’est enregistrée).']
        : []),
      ...(!resolues.length && b.correspondances.length
        ? [
            'Aucune correspondance n’a pu être rattachée : importez d’abord l’ISO/IEC 27001 et l’HDS dans la bibliothèque.',
          ]
        : []),
    ];
    return {
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
      correspondances: {
        total: b.correspondances.length,
        resolues: resolues.length,
        dejaPresentes: resolues.length - nouvelles,
        nouvelles,
        themesIso42001: themes,
        nonResolues: nonResolues.slice(0, 200),
        nonResoluesTotal: nonResolues.length,
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
  }

  async importer(input: unknown, previewId: string, reason: string, user: SessionUser, ip: string) {
    const b = this.analyser(input);
    const apercu = await this.apercu(input, user);
    if (apercu.referentiel.previewId !== previewId)
      throw new HttpError(422, 'Relancez l’aperçu : le contenu a changé.');
    if (apercu.dejaImporte)
      return { statut: 'deja_importe' as const, controles: apercu.controles, mappings: 0, ignorees: 0 };
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
    const { resolues } = await this.resoudre(b, user);
    let crees = 0;
    let ignorees = 0;
    for (const m of resolues) {
      try {
        await this.g.libraryMappings.create(
          {
            source: { frameworkId, version, requirementId: m.controle },
            target: m.cible,
            type: 'related',
            justification:
              `Indication thématique du kit IA : « ${m.indication} ». ${m.explication || 'Sans équivalence normative ni automatisation de conformité.'}`.slice(
                0,
                5000,
              ),
            coverage: 0,
            origin: 'ai',
            sourceUrl: m.typeReference === 'ISO27001' ? URL_ISO : URL_HDS,
          },
          user,
          ip,
        );
        crees++;
      } catch (e) {
        if (e instanceof HttpError && e.status === 409) ignorees++;
        else throw e;
      }
    }
    await this.g.db.tx(async (c) => {
      await c.query(
        `INSERT INTO lib_kit_ia(sha256,kit_version,framework_id,framework_version,annexes,reason,imported_by)
         VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sha256) DO NOTHING`,
        [
          apercu.sha256,
          b.version,
          frameworkId,
          version,
          JSON.stringify({
            actions: b.actions,
            scenarios: b.scenarios,
            deltas: b.deltas,
            memosHds: b.memosHds,
            questionnaire: b.questionnaire,
            sources: b.sources,
          }),
          reason,
          user.username,
        ],
      );
      await this.g.db.audit(
        user,
        ip,
        'library.ia_kit.imported',
        frameworkId,
        { version, controles: b.controls.length, mappings: crees, ignorees, sha256: apercu.sha256 },
        c,
      );
    }, user.username);
    return {
      statut: 'importe' as const,
      controles: b.controls.length,
      mappings: crees,
      ignorees,
      frameworkId,
      version,
    };
  }

  /** Dernier kit importé : version, date et annexes de veille ; sources et deltas portent toujours « à revérifier ». */
  async dernier(user: SessionUser) {
    await this.g.permission(user, 'conformite', 'lire');
    const r = await this.g.db.one<{
      kit_version: string;
      framework_id: string;
      framework_version: number;
      annexes: Record<string, unknown>;
      imported_by: string;
      imported_at: string;
    }>(
      'SELECT kit_version,framework_id,framework_version,annexes,imported_by,imported_at FROM lib_kit_ia ORDER BY imported_at DESC LIMIT 1',
    );
    if (!r) return { importe: false as const };
    return {
      importe: true as const,
      version: r.kit_version,
      frameworkId: r.framework_id,
      frameworkVersion: r.framework_version,
      importePar: r.imported_by,
      importeLe: r.imported_at,
      annexes: r.annexes,
      statutJuridique: 'a_reverifier' as const,
    };
  }
}
