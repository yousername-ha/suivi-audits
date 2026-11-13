/* Objets du Pilotage repris dans les exports Excel (BUG-038, BUG-058) : les fiches saisies à l'écran (contexte, parties
   intéressées, SWOT, rôles, risques, traitements, études, plans de continuité, exercices, revues) sont des objets GRC d'un
   périmètre, pas des entrées du registre historique que les anciennes rubriques lisaient. Ce module lit les objets que le
   lecteur peut ouvrir, pour le périmètre demandé, et les ajoute à l'état d'export sous des clés dédiées. */
import type { GrcKind, GrcObject } from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { registreRisques } from '../grc/registre-risques.js';
import { HttpError } from '../http/errors.js';

const MAX_OBJETS = 2000;

const texte = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const lignes = (v: unknown) =>
  texte(v)
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/** Objets d'un type et d'un périmètre, lus avec les droits du lecteur ; `[]` si le droit du module manque. */
async function objets(g: Grc, smsi: string, user: SessionUser, kind: GrcKind): Promise<GrcObject[]> {
  const out: GrcObject[] = [];
  try {
    for (let offset: number | null = 0; offset !== null && out.length < MAX_OBJETS;) {
      const page = await g.listObjects(smsi, user, kind, '', offset);
      out.push(...page.items);
      offset = page.nextOffset;
    }
  } catch (e) {
    if (e instanceof HttpError && e.status === 403) return [];
    throw e;
  }
  return out;
}

/** Entrées de l'état d'export pour le périmètre demandé : les rubriques du contexte reprennent les fiches du Pilotage, en
    plus des entrées historiques du périmètre commun ; les autres clés (`natifs`) portent les objets saisis à l'écran. */
export async function etatAvecObjetsPilotage(
  g: Grc,
  user: SessionUser,
  smsi: string,
  etat: JsonObject,
): Promise<JsonObject> {
  // Périmètre illisible : 404 (jamais d'indication sur son existence).
  await g.access(smsi, user);
  const lire = (k: GrcKind) => objets(g, smsi, user, k);
  const contextes = await lire('context');
  const parties = await lire('stakeholder');
  const swots = await lire('swot');
  const roles = await lire('governance');
  const plans = await lire('continuity_plan');
  const exercices = await lire('continuity_exercise');
  const revues = await lire('management_review');
  const traitements = await lire('treatment');
  const etudes = await lire('risk_study');
  let risques: Record<string, unknown>[] = [];
  try {
    risques = (await registreRisques(g, smsi, user, {})).items as unknown as Record<string, unknown>[];
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 403)) throw e;
  }
  // Les entrées historiques (clés `interested`, `swots`, `roles`) appartiennent au périmètre commun.
  const historique = smsi === DEFAULT_SMSI;
  const anciennes = (k: string) => (historique && Array.isArray(etat[k]) ? (etat[k] as JsonObject[]) : []);
  return {
    ...etat,
    interested: [
      ...anciennes('interested'),
      ...parties.map((o) => ({
        name: o.name,
        type: texte(o.data.nature),
        cat: texte(o.data.category),
        needs: texte(o.data.expectations),
        req: texte(o.data.requirements),
        addressed: texte(o.data.addressed),
        how: texte(o.data.treatment),
        owner: '',
        reviewed: texte(o.data.reviewedAt),
      })),
    ],
    swots: [
      ...anciennes('swots'),
      ...swots.map((o) => ({
        process: o.name,
        date: o.updatedAt.slice(0, 10),
        version: String(o.version),
        author: o.updatedBy,
        S: lignes(o.data.strengths),
        W: lignes(o.data.weaknesses),
        O: lignes(o.data.opportunities),
        T: lignes(o.data.threats),
      })),
    ],
    roles: [
      ...anciennes('roles'),
      ...roles.map((o) => ({
        name: texte(o.data.role) || o.name,
        holder: texte(o.data.holder),
        deputy: texte(o.data.deputy),
        email: texte(o.data.email),
        phone: texte(o.data.phone),
        resp: texte(o.data.responsibilities),
        refs: '',
      })),
    ],
    natifs: {
      contextes: contextes.map((o) => ({ name: o.name, ...o.data })),
      risques,
      traitements: traitements.map((o) => ({ name: o.name, ...o.data })),
      etudes: etudes.map((o) => ({ name: o.name, ...o.data })),
      plans: plans.map((o) => ({ name: o.name, ...o.data })),
      exercices: exercices.map((o) => ({ name: o.name, ...o.data })),
      revues: revues.map((o) => ({ name: o.name, ...o.data })),
    } as unknown as JsonObject,
  };
}
