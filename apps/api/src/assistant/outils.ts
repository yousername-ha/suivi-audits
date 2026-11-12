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
  /** Présent pendant une ronde autonome seulement : ce que l'assistant peut émettre seul (rappel, note de mémoire). */
  ronde?: ActionsRonde;
}
/** Actions d'une ronde : aucune n'écrit dans un registre. Chaque méthode rend un compte rendu remis au modèle. */
export interface ActionsRonde {
  rappeler(perimetre: string, objet: string, message: string): Promise<{ envoye: boolean; detail: string }>;
  questionner(perimetre: string, objet: string, question: string): Promise<{ envoye: boolean; detail: string }>;
  memoriser(note: string): Promise<{ enregistre: boolean; detail: string }>;
  proposerMethode(titre: string, contenu: string): Promise<{ enregistre: boolean; detail: string }>;
  proposerAction(p: {
    perimetre: string;
    titre: string;
    description: string;
    echeance?: string;
    source?: string;
  }): Promise<{ enregistre: boolean; detail: string }>;
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

/** Parcourt les actions d'un périmètre (nombre de pages borné) : en retard, et sans responsable nommé. */
async function parcourirActions(ctx: ContexteOutil, smsi: string) {
  const terminaux = new Set(
    (await ctx.g.policy(smsi, ctx.user)).definition.statuses.filter((s) => s.terminal).map((s) => s.id),
  );
  const maintenant = new Date().toISOString();
  const retard: ReturnType<typeof resume>[] = [];
  const sansResponsable: ReturnType<typeof resume>[] = [];
  let examinees = 0;
  let total = 0;
  let offset: number | null = 0;
  for (let page = 0; page < PAGES_MAX_RETARD && offset !== null; page++) {
    const r = await ctx.g.listObjects(smsi, ctx.user, 'action', '', offset);
    total = r.total;
    examinees += r.items.length;
    for (const o of r.items) {
      if (terminaux.has(String(o.data.status ?? ''))) continue;
      const echeance = typeof o.data.dueAt === 'string' ? o.data.dueAt : '';
      if (echeance && echeance < maintenant) retard.push(resume(o));
      if (!o.data.ownerId && !o.data.responsable) sansResponsable.push(resume(o));
    }
    offset = r.nextOffset;
  }
  return { retard, sansResponsable, examinees, total };
}

/** Résumé d'un objet pour une liste : aucun champ libre long, aucun nom de personne. */
function resume(o: { id: string; kind: GrcKind; name: string; data: Record<string, unknown>; updatedAt: string }) {
  return {
    id: o.id,
    type: o.kind,
    nom: o.name,
    statut: texte(o.data.status, 60),
    echeance: texte(o.data.dueAt, 40),
    // Sans identité : dit seulement si quelqu'un peut être rappelé ou interrogé au sujet de l'élément.
    responsable: o.data.ownerId ? 'personne nommée' : o.data.responsable ? 'groupe ou fonction' : 'aucun',
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
          // L'identifiant d'une personne n'apprend rien au modèle et n'a pas à sortir : seul le fait qu'un responsable
          // est nommé est transmis.
          champs: { ...o.data, ownerId: o.data.ownerId ? 'responsable nommé (identité non transmise)' : null },
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
      const { retard, examinees, total } = await parcourirActions(ctx, a.perimetre);
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
  outil({
    nom: 'signaux',
    description:
      'Points d’attention d’un périmètre, calculés par la plateforme : actions en retard, actions sans responsable, risques dont la revue est dépassée, exigences non couvertes ou à valider par référentiel. À appeler en début de ronde ou de bilan.',
    parametres: z.object({ perimetre }).strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      const s = await ctx.g.access(a.perimetre, ctx.user);
      const actions = await parcourirActions(ctx, a.perimetre);
      actions.retard.sort((x, y) => String(x.echeance).localeCompare(String(y.echeance)));
      const aujourdHui = new Date().toISOString().slice(0, 10);
      const risques: (ReturnType<typeof resume> & { revue: string })[] = [];
      let offset: number | null = 0;
      let risquesExamines = 0;
      let risquesTotal = 0;
      for (let page = 0; page < PAGES_MAX_RETARD && offset !== null; page++) {
        const r = await ctx.g.listObjects(a.perimetre, ctx.user, 'risk', '', offset);
        risquesTotal = r.total;
        risquesExamines += r.items.length;
        for (const o of r.items) {
          const revue = typeof o.data.reviewAt === 'string' ? o.data.reviewAt.slice(0, 10) : '';
          if (revue && revue < aujourdHui) risques.push({ ...resume(o), revue });
        }
        offset = r.nextOffset;
      }
      // La couverture relève du module Conformité : sans ce droit, le signal est simplement absent.
      let referentiels: unknown[] | null = null;
      try {
        referentiels = (await ctx.g.rapprochements.coverage(a.perimetre, ctx.user)).frameworks.map((f) => ({
          id: f.frameworkId,
          nom: f.name,
          exigences: f.requirements,
          nonCouvertes: f.uncovered,
          aValider: f.toValidate,
        }));
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
      }
      const cites = [...actions.retard.slice(0, 20), ...actions.sansResponsable.slice(0, 20), ...risques.slice(0, 20)];
      return {
        donnees: {
          perimetre: s.name,
          // Au-delà de la limite d'examen, les listes sont partielles : à dire tel quel, sans extrapoler.
          partiel: actions.examinees < actions.total || risquesExamines < risquesTotal,
          actionsEnRetard: { nombre: actions.retard.length, premieres: actions.retard.slice(0, 20) },
          actionsSansResponsable: {
            nombre: actions.sansResponsable.length,
            premieres: actions.sansResponsable.slice(0, 20),
          },
          risquesRevueDepassee: { nombre: risques.length, premiers: risques.slice(0, 20) },
          ...(referentiels ? { referentiels } : {}),
        },
        elements: actions.retard.length + actions.sansResponsable.length + risques.length,
        sources: [
          { perimetre: a.perimetre, nom: s.name },
          ...cites.map((o) => ({ perimetre: a.perimetre, objet: o.id, type: o.type, nom: o.nom })),
        ],
      };
    },
  }),
];

/** Message d'un rappel : court, affiché tel quel à son destinataire dans l'application. */
export const RAPPEL_MAX = 400;
export const NOTE_MEMOIRE_MAX = 500;

/** Outils réservés aux rondes autonomes : ce que l'assistant émet seul. Aucun n'écrit dans un registre. */
export const OUTILS_RONDE: readonly Outil[] = [
  outil({
    nom: 'envoyer_rappel',
    description:
      'Envoie un rappel au responsable d’un élément (personne nommée, sinon membres du groupe ou de la fonction responsable) pour une action en retard ou un risque à revoir. La plateforme choisit le destinataire et refuse un second rappel tant que l’élément n’a pas changé. À utiliser avec mesure : seulement pour un retard ou un manque constaté par un outil.',
    parametres: z
      .object({
        perimetre,
        id: z.uuid().describe('Identifiant de l’élément concerné.'),
        message: z.string().trim().min(10).max(RAPPEL_MAX).describe('Rappel court, factuel et courtois, en français.'),
      })
      .strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      if (!ctx.ronde) throw new HttpError(403, 'Un rappel ne peut être envoyé que pendant une ronde.');
      const r = await ctx.ronde.rappeler(a.perimetre, a.id, a.message);
      return { donnees: r, elements: r.envoye ? 1 : 0, sources: [] };
    },
  }),
  outil({
    nom: 'poser_question',
    description:
      'Pose une question au responsable d’un élément quand il vous manque une information que lui seul peut donner (état réel, obstacle, nouvelle échéance). La plateforme choisit le destinataire, le relance une fois sans réponse, et vous remet la réponse à une ronde suivante. Une seule question en attente par élément.',
    parametres: z
      .object({
        perimetre,
        id: z.uuid().describe('Identifiant de l’élément concerné.'),
        question: z
          .string()
          .trim()
          .min(10)
          .max(RAPPEL_MAX)
          .describe('Question courte, précise et courtoise, en français.'),
      })
      .strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      if (!ctx.ronde) throw new HttpError(403, 'Une question ne peut être posée que pendant une ronde.');
      const r = await ctx.ronde.questionner(a.perimetre, a.id, a.question);
      return { donnees: r, elements: r.envoye ? 1 : 0, sources: [] };
    },
  }),
  outil({
    nom: 'memoriser',
    description:
      'Écrit une note courte dans votre mémoire de profil, relue aux rondes suivantes : contexte durable de l’organisation, constat à suivre. Pas de donnée personnelle ni de copie de fiche.',
    parametres: z.object({ note: z.string().trim().min(5).max(NOTE_MEMOIRE_MAX) }).strict(),
    async executer(ctx, a) {
      if (!ctx.ronde) throw new HttpError(403, 'La mémoire ne s’écrit que pendant une ronde.');
      const r = await ctx.ronde.memoriser(a.note);
      return { donnees: r, elements: r.enregistre ? 1 : 0, sources: [] };
    },
  }),
  outil({
    nom: 'proposer_action',
    description:
      'Propose au RSSI la création d’une action dans un périmètre (par exemple une action manquante pour traiter un écart ou un retard constaté). Rien n’est créé : une personne confirmera, corrigera ou rejettera. Ne proposez pas une action qui existe déjà, et pas deux fois pour le même élément.',
    parametres: z
      .object({
        perimetre,
        titre: z.string().trim().min(5).max(200).describe('Intitulé de l’action, à l’infinitif.'),
        description: z
          .string()
          .trim()
          .min(10)
          .max(2000)
          .describe('Ce qu’il faut faire et pourquoi, en citant ce que vous avez lu.'),
        echeance: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Échéance suggérée, AAAA-MM-JJ.'),
        source: z.uuid().optional().describe('Identifiant de l’élément qui motive l’action.'),
      })
      .strict(),
    async executer(ctx, a) {
      exiger(ctx, a.perimetre);
      if (!ctx.ronde) throw new HttpError(403, 'Une proposition ne se dépose que pendant une ronde.');
      const r = await ctx.ronde.proposerAction(a);
      return { donnees: r, elements: r.enregistre ? 1 : 0, sources: [] };
    },
  }),
  outil({
    nom: 'proposer_methode',
    description:
      'Propose au RSSI une fiche de méthode : une façon de faire propre à cette organisation, que vous venez d’éprouver et qui servira aux rondes suivantes. Elle ne sera relue qu’après validation par le RSSI. Une seule par ronde ; ni donnée personnelle, ni copie de fiche, ni texte de norme.',
    parametres: z
      .object({
        titre: z
          .string()
          .trim()
          .min(5)
          .max(120)
          .describe('Titre court, par exemple « Préparer la revue de direction ».'),
        contenu: z.string().trim().min(20).max(2000).describe('Étapes de la méthode, en français.'),
      })
      .strict(),
    async executer(ctx, a) {
      if (!ctx.ronde) throw new HttpError(403, 'Une fiche de méthode ne se propose que pendant une ronde.');
      const r = await ctx.ronde.proposerMethode(a.titre, a.contenu);
      return { donnees: r, elements: r.enregistre ? 1 : 0, sources: [] };
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
