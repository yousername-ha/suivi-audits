/* Outils de lecture de l'assistant (ADR 0086, points 5 à 7). Chaque outil appelle un service existant AVEC LES DROITS DE LA
   PERSONNE qui interroge l'assistant, après avoir vérifié que le périmètre appartient au profil : l'assistant ne lit jamais
   plus que l'intersection des deux. Aucun outil n'écrit. Les chiffres viennent des services (jamais du modèle) et chaque
   résultat porte ses sources. Les résultats sont bornés avant d'être remis au modèle. */
import { GRC_KINDS, GRC_LABELS, type GrcKind, type SourceAssistant } from '@suivi/shared';
import { z, type ZodType } from 'zod';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from '../grc/core.js';
import { dashboard } from '../grc/dashboard.js';

export interface ContexteOutil {
  g: Grc;
  user: SessionUser;
  /** Périmètres ouverts au profil de l'assistant. */
  perimetres: ReadonlySet<string>;
}
export interface ResultatOutil {
  donnees: unknown;
  /** Nombre d'éléments rendus (journal d'audit et affichage). */
  elements: number;
  sources: SourceAssistant[];
}
export interface Outil<A = unknown> {
  nom: string;
  description: string;
  parametres: ZodType<A>;
  executer(ctx: ContexteOutil, args: A): Promise<ResultatOutil>;
}

/** Taille maximale, en caractères, de ce qu'un outil remet au modèle. */
export const TAILLE_MAX_RESULTAT = 12_000;
const PAGES_MAX_RETARD = 4;

const perimetre = z.uuid().describe('Identifiant du périmètre, obtenu par lister_perimetres.');
const texte = (v: unknown, max = 300) => (typeof v === 'string' ? (v.length > max ? v.slice(0, max) + '…' : v) : null);

/** Le périmètre doit appartenir au profil ; l'accès de la personne est vérifié ensuite par le service appelé. */
function exiger(ctx: ContexteOutil, smsi: string) {
  if (!ctx.perimetres.has(smsi)) throw new HttpError(403, 'Ce périmètre n’est pas ouvert à ce profil de l’assistant.');
}
const outil = <A>(o: Outil<A>): Outil => o as Outil;

/** Résumé d'un objet pour une liste : aucun champ libre long, aucun nom de personne. */
function resume(o: { id: string; kind: GrcKind; name: string; data: Record<string, unknown>; updatedAt: string }) {
  return {
    id: o.id,
    type: o.kind,
    nom: o.name,
    statut: texte(o.data.status, 60),
    echeance: texte(o.data.dueAt, 40),
    modifieLe: o.updatedAt,
  };
}

export const OUTILS: readonly Outil[] = [
  outil({
    nom: 'lister_perimetres',
    description:
      'Liste les périmètres (SMSI, SMQ…) que vous pouvez consulter pour cette personne. À appeler en premier pour obtenir les identifiants.',
    parametres: z.object({}).strict(),
    async executer(ctx) {
      const liste = (await ctx.g.listSmsis(ctx.user)).filter((s) => ctx.perimetres.has(s.id));
      return {
        donnees: { perimetres: liste.map((s) => ({ id: s.id, nom: s.name, nature: s.nature, objet: texte(s.scope) })) },
        elements: liste.length,
        sources: liste.map((s) => ({ perimetre: s.id, nom: s.name })),
      };
    },
  }),
  outil({
    nom: 'synthese_perimetre',
    description:
      'Compteurs calculés par la plateforme pour un périmètre : actions (total, closes, en retard, sans responsable), risques (total, à revoir), contrôles, preuves, référentiels rattachés. Ce sont les seuls chiffres de synthèse à citer.',
    parametres: z.object({ perimetre }).strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const s = await ctx.g.access(a.perimetre, ctx.user);
      const d = await dashboard(ctx.g, a.perimetre, ctx.user);
      return {
        donnees: { perimetre: s.name, compteurs: d.sections },
        elements: Object.keys(d.sections).length,
        sources: [{ perimetre: a.perimetre, nom: s.name }],
      };
    },
  }),
  outil({
    nom: 'lister_elements',
    description:
      'Liste les éléments d’un type dans un périmètre (50 par page), avec nom, statut et échéance. Types : ' +
      GRC_KINDS.map((k) => `${k} (${GRC_LABELS[k]})`).join(', ') +
      '.',
    parametres: z
      .object({
        perimetre,
        type: z.enum(GRC_KINDS),
        recherche: z.string().max(100).optional().describe('Texte cherché dans le nom.'),
        statut: z.string().max(60).optional().describe('Identifiant de statut exact.'),
        page: z.number().int().min(0).max(40).optional().describe('Numéro de page, à partir de 0.'),
      })
      .strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const r = await ctx.g.listObjects(
        a.perimetre,
        ctx.user,
        a.type,
        a.recherche ?? '',
        (a.page ?? 0) * 50,
        a.statut ? { status: a.statut } : {},
      );
      return {
        donnees: {
          total: r.total,
          pageSuivante: r.nextOffset === null ? null : r.nextOffset / 50,
          elements: r.items.map(resume),
        },
        elements: r.items.length,
        sources: r.items.map((o) => ({ perimetre: a.perimetre, objet: o.id, type: o.kind, nom: o.name })),
      };
    },
  }),
  outil({
    nom: 'lire_element',
    description: 'Fiche complète d’un élément (champs saisis), à partir de son identifiant.',
    parametres: z.object({ perimetre, id: z.uuid() }).strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const o = await ctx.g.object(a.perimetre, a.id, ctx.user);
      return {
        donnees: {
          id: o.id,
          type: o.kind,
          libelleType: GRC_LABELS[o.kind],
          nom: o.name,
          version: o.version,
          creeLe: o.createdAt,
          modifieLe: o.updatedAt,
          archive: o.archived,
          champs: o.data,
        },
        elements: 1,
        sources: [{ perimetre: a.perimetre, objet: o.id, type: o.kind, nom: o.name }],
      };
    },
  }),
  outil({
    nom: 'historique_element',
    description: 'Versions successives d’un élément : numéro, date et motif de chaque modification (50 dernières).',
    parametres: z.object({ perimetre, id: z.uuid() }).strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const o = await ctx.g.object(a.perimetre, a.id, ctx.user);
      const versions = await ctx.g.history(a.perimetre, a.id, ctx.user);
      return {
        donnees: {
          nom: o.name,
          versionCourante: o.version,
          versions: versions.map((v) => ({ version: v.version, date: v.createdAt, motif: texte(v.reason, 200) })),
        },
        elements: versions.length,
        sources: [{ perimetre: a.perimetre, objet: o.id, type: o.kind, nom: o.name }],
      };
    },
  }),
  outil({
    nom: 'actions_en_retard',
    description:
      'Actions d’un périmètre dont l’échéance est dépassée et dont le statut n’est pas terminal, de la plus ancienne à la plus récente. La liste est calculée par la plateforme.',
    parametres: z.object({ perimetre }).strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const terminaux = new Set(
        (await ctx.g.policy(a.perimetre, ctx.user)).definition.statuses.filter((s) => s.terminal).map((s) => s.id),
      );
      const maintenant = new Date().toISOString();
      const retard: ReturnType<typeof resume>[] = [];
      let examinees = 0;
      let total = 0;
      let offset: number | null = 0;
      for (let page = 0; page < PAGES_MAX_RETARD && offset !== null; page++) {
        const r = await ctx.g.listObjects(a.perimetre, ctx.user, 'action', '', offset);
        total = r.total;
        examinees += r.items.length;
        for (const o of r.items) {
          const echeance = typeof o.data.dueAt === 'string' ? o.data.dueAt : '';
          if (echeance && echeance < maintenant && !terminaux.has(String(o.data.status ?? ''))) retard.push(resume(o));
        }
        offset = r.nextOffset;
      }
      retard.sort((x, y) => String(x.echeance).localeCompare(String(y.echeance)));
      return {
        donnees: {
          actionsExaminees: examinees,
          actionsDuPerimetre: total,
          // Au-delà de la limite d'examen, la liste est partielle : à dire tel quel, sans extrapoler.
          partiel: examinees < total,
          enRetard: retard,
        },
        elements: retard.length,
        sources: retard.map((o) => ({ perimetre: a.perimetre, objet: o.id, type: 'action', nom: o.nom })),
      };
    },
  }),
  outil({
    nom: 'couverture_referentiels',
    description:
      'Couverture des exigences par référentiel rattaché au périmètre (nombre d’exigences, couvertes, à valider, non couvertes, états d’évaluation). Avec « referentiel », rend aussi le détail exigence par exigence (300 au plus).',
    parametres: z.object({ perimetre, referentiel: z.uuid().optional() }).strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const s = await ctx.g.access(a.perimetre, ctx.user);
      const c = await ctx.g.rapprochements.coverage(a.perimetre, ctx.user, a.referentiel);
      const detail = c.detail?.slice(0, 300).map((e) => ({
        id: e.id,
        intitule: texte(e.title, 160),
        couverture: e.status,
        etat: e.etat,
        obligatoire: e.obligatoire,
        mesures: e.measures.length,
        declareeSansMesure: e.sansMesure,
      }));
      return {
        donnees: {
          perimetre: s.name,
          referentiels: c.frameworks.map((f) => ({
            id: f.frameworkId,
            nom: f.name,
            version: f.version,
            exigences: f.requirements,
            couvertes: f.covered,
            aValider: f.toValidate,
            nonCouvertes: f.uncovered,
            etats: f.etats,
          })),
          ...(detail ? { detail, detailTronque: (c.detail?.length ?? 0) > detail.length } : {}),
        },
        elements: detail ? detail.length : c.frameworks.length,
        sources: [{ perimetre: a.perimetre, nom: s.name }],
      };
    },
  }),
];

/** Texte remis au modèle : JSON borné. Une liste trop longue est raccourcie par la fin, et le dit. */
export function serialiser(donnees: unknown, max = TAILLE_MAX_RESULTAT): string {
  let json = JSON.stringify(donnees);
  if (json.length <= max) return json;
  if (donnees && typeof donnees === 'object' && !Array.isArray(donnees)) {
    const copie: Record<string, unknown> = { ...(donnees as Record<string, unknown>) };
    const cle = Object.keys(copie).find((k) => Array.isArray(copie[k]) && (copie[k] as unknown[]).length > 1);
    if (cle) {
      let liste = copie[cle] as unknown[];
      while (liste.length > 1 && json.length > max) {
        liste = liste.slice(0, Math.max(1, Math.floor(liste.length / 2)));
        copie[cle] = liste;
        copie.tronque = `Liste « ${cle} » raccourcie à ${liste.length} éléments : résultat trop volumineux.`;
        json = JSON.stringify(copie);
      }
      if (json.length <= max) return json;
    }
  }
  return JSON.stringify({ tronque: 'Résultat trop volumineux : extrait.', extrait: json.slice(0, max - 200) });
}
