/* Chiffres ouverts d'un tableau de bord (ADR 0109, décision 7) : la synthèse de l'auteur, calculée avec ses droits et sa
   portée (registres restreints qu'il lit compris, choix « B » du RSSI), puis recopiée CHAMP PAR CHAMP en liste blanche dans
   `ChiffresPublics`. Seuls passent des nombres et des libellés tirés de listes fermées du code (statuts, classifications,
   sources, référentiels de la DdA, types de plans, types d'écarts) ; une clé inconnue devient « Autre ». Aucune liste
   nommée (échéances, journées du plan d'audit, intitulés), aucun texte libre (libellé de l'année d'audit, statut du plan),
   aucun journal. Les incidents sont agrégés comme la carte « Incidents » de l'accueil (compteurs, nombre par mois de
   détection), sans titre ni description. */
import {
  ChiffresPublics,
  incidentOuvert,
  REFERENTIELS_DDA,
  TYPES_PLAN,
  type Incident,
  type Synthese,
} from '@suivi/shared';
import { FINDING_TYPE_LABELS } from '@suivi/shared/audit';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { synthese } from '../routes/affichage.js';
import type { Services } from '../services.js';
import { LIBELLES_ECARTS } from '../tableau-de-bord.js';

export const AUTRE = 'Autre';
/** Nombre de mois de détection gardés, les plus récents (borne du contrat). */
const MOIS_MAX = 120;

const entier = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
const DATE = /^\d{4}-\d{2}-\d{2}/;
/** Date « AAAA-MM-JJ » seule : le reste d'une saisie (heure, texte) n'est jamais recopié. */
const dateSeule = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v.slice(0, 10) : '');

/** Compteurs dont les clés sont prises dans `permises` ; une clé inconnue est comptée dans « Autre ». */
function compteursFermes(m: Record<string, number> | undefined, permises: readonly string[]): Record<string, number> {
  const connues = new Set(permises);
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(m ?? {})) {
    const cle = connues.has(k) ? k : AUTRE;
    out[cle] = (out[cle] ?? 0) + entier(n);
  }
  return out;
}

const REFS_DDA = new Map<string, string>(REFERENTIELS_DDA.map((r) => [r.ref, r.libelle]));
const TYPES_PLANS = new Map<string, string>(TYPES_PLAN.map((t) => [t.type, t.libelle]));
const TYPES_ECARTS = new Map<string, string>(Object.entries(FINDING_TYPE_LABELS));

/** Agrégats de la carte « Incidents » (mêmes regroupements que l'accueil) : total, ouverts, ouverts de sécurité, en cours,
    clos ou résolus, et nombre par mois de détection (AAAA-MM), du plus ancien au plus récent. */
export function agregerIncidents(l: readonly Incident[]): NonNullable<ChiffresPublics['incidents']> {
  const ouverts = l.filter(incidentOuvert);
  const parMois = new Map<string, number>();
  for (const i of l) {
    if (!/^\d{4}-\d{2}/.test(i.detectedAt) || !Number.isFinite(Date.parse(i.detectedAt))) continue;
    const mois = i.detectedAt.slice(0, 7);
    parMois.set(mois, (parMois.get(mois) ?? 0) + 1);
  }
  return {
    total: l.length,
    ouverts: ouverts.length,
    // Même règle que la synthèse (apps/api/src/tableau-de-bord.ts) : qualification « … sécurité ».
    securiteOuverts: ouverts.filter((i) => /sécurité/i.test(i.kind)).length,
    enCours: l.filter((i) => i.status === 'En cours').length,
    clos: l.filter((i) => ['Clos', 'Résolu'].includes(i.status)).length,
    parMois: [...parMois]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-MOIS_MAX)
      .map(([mois, n]) => ({ mois, n })),
  };
}

/** Recopie en liste blanche d'une synthèse vers les chiffres ouverts. Fonction pure. */
export function listeBlanche(s: Synthese, incidents: ChiffresPublics['incidents']): ChiffresPublics {
  const e = s.ecarts;
  const eo = s.ecartsOuverts;
  return ChiffresPublics.parse({
    genereLe: dateSeule(s.genereLe) ? new Date(s.genereLe).toISOString() : new Date().toISOString(),
    prochainAudit: s.prochainAudit ? { date: dateSeule(s.prochainAudit.date) } : null,
    auditInterne: dateSeule(s.auditInterne) || null,
    ecarts: e
      ? {
          total: entier(e.total),
          ouverts: entier(e.ouverts),
          enRetard: entier(e.enRetard),
          aEcheance: entier(e.aEcheance),
          parStatut: compteursFermes(e.parStatut, LIBELLES_ECARTS.statut),
          parType: compteursFermes(e.parType, LIBELLES_ECARTS.type),
          parSource: compteursFermes(e.parSource, LIBELLES_ECARTS.source),
        }
      : null,
    mesures: s.mesures
      ? {
          total: entier(s.mesures.total),
          parReferentiel: compteursFermes(s.mesures.parReferentiel, [...REFS_DDA.keys()]),
        }
      : null,
    conformite: s.conformite
      ? s.conformite
          .filter((c) => REFS_DDA.has(c.ref))
          .map((c) => ({
            ref: c.ref,
            libelle: REFS_DDA.get(c.ref)!,
            exigences: entier(c.exigences),
            applicables: entier(c.applicables),
            total: entier(c.total),
            partiel: entier(c.partiel),
            insuffisant: entier(c.insuffisant),
            nonRenseigne: entier(c.nonRenseigne),
          }))
      : null,
    ecartsOuverts: eo
      ? {
          ouverts: entier(eo.ouverts),
          parType: eo.parType
            .filter((x) => TYPES_ECARTS.has(x.type))
            .map((x) => ({ type: x.type, libelle: TYPES_ECARTS.get(x.type)!, n: entier(x.n) })),
          actionsRealisees: entier(eo.actionsRealisees),
          actionsTotal: entier(eo.actionsTotal),
        }
      : null,
    indicateurs: s.indicateurs
      ? {
          total: entier(s.indicateurs.total),
          atteints: entier(s.indicateurs.atteints),
          nonAtteints: entier(s.indicateurs.nonAtteints),
          nonMesures: entier(s.indicateurs.nonMesures),
        }
      : null,
    plans: s.plans
      ? {
          annee: Number.isInteger(s.plans.annee) ? s.plans.annee : new Date().getFullYear(),
          types: s.plans.types
            .filter((t) => TYPES_PLANS.has(t.type))
            .map((t) => ({
              type: t.type,
              libelle: TYPES_PLANS.get(t.type)!,
              realises: entier(t.realises),
              aVenir: entier(t.aVenir),
              enRetard: entier(t.enRetard),
            })),
        }
      : null,
    actions: s.actions
      ? {
          total: entier(s.actions.total),
          ouvertes: entier(s.actions.ouvertes),
          enRetard: entier(s.actions.enRetard),
          terminees: entier(s.actions.terminees),
        }
      : null,
    recurrences: s.recurrences
      ? {
          series: entier(s.recurrences.series),
          occurrencesOuvertes: entier(s.recurrences.occurrencesOuvertes),
          occurrencesEnRetard: entier(s.recurrences.occurrencesEnRetard),
        }
      : null,
    risques: s.risques
      ? {
          total: entier(s.risques.total),
          sansDecision: entier(s.risques.sansDecision),
          revueEchue: entier(s.risques.revueEchue),
        }
      : null,
    continuite: s.continuite ? { plans: entier(s.continuite.plans) } : null,
    incidents,
  });
}

/** Chiffres de l'auteur (droits et portée relus pour ce calcul, `utilisateurPourCalcul`), en liste blanche. Aucun cache :
    la porte de lecture interdit de garder une portée d'une requête à l'autre. */
export async function chiffresDe(svc: Services, auteur: SessionUser): Promise<ChiffresPublics> {
  const s = await synthese(svc, auteur.rights, auteur);
  let incidents: ChiffresPublics['incidents'] = null;
  // La synthèse ne compte les incidents que si l'auteur lit le module (activé) : même condition ici.
  if (s.incidents)
    try {
      incidents = agregerIncidents((await svc.historique.incidents.vue(auteur)).incidents);
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
    }
  return listeBlanche(s, incidents);
}
