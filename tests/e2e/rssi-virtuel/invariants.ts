/* Règles de cohérence du SMSI vérifiées par le RSSI virtuel (oracle indépendant) : elles sont réécrites ici à partir des
   normes, sans réutiliser le code de l'application (`@suivi/shared`), pour qu'un défaut de calcul de l'application ne se
   retrouve pas dans son propre contrôle. Chaque règle cite sa source ; une violation « bloquante » serait relevée en audit
   de certification ou rend une donnée fausse, un « avertissement » est un point que le RSSI doit regarder.

   Ce fichier ne contient aucun texte normatif sous licence : seulement des numéros de clause et de mesure. */
import type { APIRequestContext } from '@playwright/test';

export const PERIMETRE_COMMUN = '00000000-0000-4000-8000-000000000001';

export interface Mesure {
  id: string;
  ref: string;
  num: string;
  title: string;
}
export interface LigneDda {
  app?: string;
  level?: string;
  just?: string;
  actions?: string;
}
export interface EcartDda {
  id: string;
  type: string;
  status: string;
  source: string;
  items: string[];
}
export interface PageDda {
  reference: 'ISO' | 'A' | 'HDS';
  mesures: Mesure[];
  dda: Record<string, LigneDda>;
  ecarts: EcartDda[];
}
export interface Ecart {
  id: string;
  /** Identifiant historique (« FOU-01 », « INC-AC-01 ») : celui sous lequel la DdA expose un écart né dans le registre
      historique. */
  legacyId?: string | null;
  name: string;
  archived: boolean;
  data: {
    status?: string;
    classification?: string;
    dueAt?: string;
    ownerId?: string | null;
    refs?: string[];
    effectiveness?: string;
  };
}
export interface Instantane {
  dda: Record<'ISO' | 'A' | 'HDS', PageDda>;
  ecarts: Ecart[];
}
export interface Violation {
  regle: string;
  gravite: 'bloquant' | 'avertissement';
  detail: string;
}

/** Répartition attendue de l'annexe A de l'ISO/IEC 27001:2022 : 93 mesures en quatre thèmes (5 organisationnelles,
    6 personnes, 7 physiques, 8 technologiques). */
export const ANNEXE_A_2022: Record<string, number> = { '5': 37, '6': 8, '7': 14, '8': 34 };
/** Clauses obligatoires du système de management (ISO/IEC 27001:2022, 4 à 10). */
export const CLAUSES_OBLIGATOIRES = ['4', '5', '6', '7', '8', '9', '10'];

const ouvert = (statut: string | undefined) => !/^(clos|closed|fermé|ferme|annulé|cancelled)$/i.test(statut ?? '');

export const REGLES: Record<string, { titre: string; source: string; regle: (i: Instantane) => Violation[] }> = {
  'INV-01': {
    titre: 'Annexe A complète et sans doublon',
    source: 'ISO/IEC 27001:2022, 6.1.3 c) et annexe A',
    regle: ({ dda }) => {
      const v: Violation[] = [];
      const ms = dda.A.mesures;
      const ids = new Set(ms.map((m) => m.id));
      if (ids.size !== ms.length)
        v.push({ regle: 'INV-01', gravite: 'bloquant', detail: 'identifiants de mesure en double' });
      const parTheme: Record<string, number> = {};
      for (const m of ms) parTheme[m.num.split('.')[0]!] = (parTheme[m.num.split('.')[0]!] ?? 0) + 1;
      for (const [theme, n] of Object.entries(ANNEXE_A_2022))
        if (parTheme[theme] !== n)
          v.push({
            regle: 'INV-01',
            gravite: 'bloquant',
            detail: `thème ${theme} : ${parTheme[theme] ?? 0} mesures, ${n} attendues`,
          });
      return v;
    },
  },
  'INV-02': {
    titre: 'Clauses 4 à 10 présentes et jamais exclues',
    source: 'ISO/IEC 27001:2022, 1 (aucune exclusion des clauses 4 à 10)',
    regle: ({ dda }) => {
      const v: Violation[] = [];
      for (const c of CLAUSES_OBLIGATOIRES)
        if (!dda.ISO.mesures.some((m) => m.num.split('.')[0] === c))
          v.push({ regle: 'INV-02', gravite: 'bloquant', detail: `clause ${c} absente` });
      for (const m of dda.ISO.mesures)
        if (dda.ISO.dda[m.id]?.app === 'non')
          v.push({ regle: 'INV-02', gravite: 'bloquant', detail: `clause ${m.num} déclarée non applicable` });
      return v;
    },
  },
  'INV-03': {
    titre: 'Toute exclusion de la DdA est justifiée',
    source: 'ISO/IEC 27001:2022, 6.1.3 d) ; HDS v2 (DdA du périmètre HDS)',
    regle: ({ dda }) =>
      (['A', 'HDS'] as const).flatMap((ref) =>
        dda[ref].mesures
          .filter((m) => dda[ref].dda[m.id]?.app === 'non' && !(dda[ref].dda[m.id]?.just ?? '').trim())
          .map((m) => ({ regle: 'INV-03', gravite: 'bloquant' as const, detail: `${m.id} exclue sans justification` })),
      ),
  },
  'INV-04': {
    titre: 'Toute inclusion de la DdA est justifiée',
    source: 'ISO/IEC 27001:2022, 6.1.3 d) (justification des mesures incluses)',
    regle: ({ dda }) =>
      (['A', 'HDS'] as const).flatMap((ref) =>
        dda[ref].mesures
          .filter((m) => {
            const l = dda[ref].dda[m.id];
            return l?.app === 'oui' && !(l.just ?? '').trim() && !(l.actions ?? '').trim();
          })
          .map((m) => ({
            regle: 'INV-04',
            gravite: 'avertissement' as const,
            detail: `${m.id} déclarée applicable sans justification`,
          })),
      ),
  },
  'INV-05': {
    titre: 'Aucune mesure « Total » avec une non-conformité ou un point sensible ouvert',
    source: 'ISO/IEC 27001:2022, 6.1.3 d) (état de mise en œuvre) et 10.2',
    regle: ({ dda }) =>
      (['ISO', 'A', 'HDS'] as const).flatMap((ref) =>
        dda[ref].mesures
          .filter(
            (m) =>
              dda[ref].dda[m.id]?.app !== 'non' &&
              dda[ref].dda[m.id]?.level === 'Total' &&
              dda[ref].ecarts.some(
                (e) => ouvert(e.status) && e.source !== 'Veille' && /^(NC|PS)/.test(e.type) && e.items.includes(m.id),
              ),
          )
          .map((m) => ({
            regle: 'INV-05',
            gravite: 'bloquant' as const,
            detail: `${m.id} déclarée « Total » avec un écart ouvert`,
          })),
      ),
  },
  'INV-06': {
    titre: 'Un écart ouvert a un responsable et une échéance',
    source: 'ISO/IEC 27001:2022, 10.2 b) et 6.2 (qui, quand)',
    regle: ({ ecarts }) =>
      ecarts
        .filter((e) => !e.archived && ouvert(e.data.status) && (!e.data.ownerId || !e.data.dueAt))
        .map((e) => ({
          regle: 'INV-06',
          gravite: 'avertissement' as const,
          detail: `« ${e.name} » sans ${[!e.data.ownerId && 'responsable', !e.data.dueAt && 'échéance'].filter(Boolean).join(' ni ')}`,
        })),
  },
  'INV-07': {
    titre: 'Un écart est rattaché à une clause, une mesure ou une exigence',
    source: 'ISO/IEC 27001:2022, 9.2.2 (critères d’audit) et 10.2',
    regle: ({ ecarts }) =>
      ecarts
        .filter((e) => !e.archived && !(e.data.refs ?? []).length)
        .map((e) => ({ regle: 'INV-07', gravite: 'avertissement' as const, detail: `« ${e.name} » sans référence` })),
  },
  'INV-08': {
    titre: 'Les écarts du registre et ceux de la DdA concordent',
    source: 'Traçabilité (une seule source modifiable par objet, AGENTS.md)',
    regle: ({ dda, ecarts }) => {
      const v: Violation[] = [];
      const vusDda = new Map<string, EcartDda>();
      for (const ref of ['ISO', 'A', 'HDS'] as const) for (const e of dda[ref].ecarts) vusDda.set(e.id, e);
      for (const e of ecarts.filter((x) => !x.archived)) {
        const mesures = (e.data.refs ?? []).filter((r) => r.startsWith('legacy:items:')).map((r) => r.slice(13));
        if (!mesures.length) continue;
        // La DdA désigne un écart né dans le registre historique par son identifiant historique, pas par l'UUID de l'objet
        // (faux positif relevé par la campagne du 12/11/2026 sur les écarts du clausier et des incidents).
        const d = vusDda.get(e.id) ?? (e.legacyId ? vusDda.get(e.legacyId) : undefined);
        if (!d) v.push({ regle: 'INV-08', gravite: 'bloquant', detail: `« ${e.name} » absent de la DdA` });
        else if (mesures.some((m) => !d.items.includes(m)))
          v.push({ regle: 'INV-08', gravite: 'bloquant', detail: `« ${e.name} » : mesures différentes dans la DdA` });
        else if (ouvert(e.data.status) !== ouvert(d.status))
          v.push({
            regle: 'INV-08',
            gravite: 'bloquant',
            detail: `« ${e.name} » : état « ${e.data.status} » / « ${d.status} »`,
          });
      }
      return v;
    },
  },
};

export const verifier = (i: Instantane): Violation[] => Object.values(REGLES).flatMap((r) => r.regle(i));

/** Taux affiché attendu par un RSSI : mesures en mise en œuvre totale sur les mesures **examinées et déclarées applicables**
    (une mesure dont l'applicabilité n'est pas décidée n'entre pas au dénominateur). */
export function tauxMiseEnOeuvreTotale(p: PageDda): {
  examinees: number;
  applicables: number;
  total: number;
  taux: number;
} {
  const examinees = p.mesures.filter((m) => ['oui', 'non'].includes(p.dda[m.id]?.app ?? ''));
  const applicables = examinees.filter((m) => p.dda[m.id]?.app === 'oui');
  const total = applicables.filter((m) => p.dda[m.id]?.level === 'Total').length;
  return {
    examinees: examinees.length,
    applicables: applicables.length,
    total,
    taux: applicables.length ? Math.round((total * 100) / applicables.length) : 0,
  };
}

/** Lit l'instantané par l'API, avec la session de `req` (droit de lecture de l'audit). `base` : adresse de la pile quand le
    contexte n'a pas d'adresse de base (pilote de l'agent). */
export async function lireInstantane(req: APIRequestContext, base = ''): Promise<Instantane> {
  const page = async (reference: 'ISO' | 'A' | 'HDS') => {
    const r = await req.get(`${base}/api/dda?reference=${reference}`);
    if (!r.ok()) throw new Error(`DdA ${reference} : ${r.status()} ${await r.text()}`);
    return { reference, ...(await r.json()) } as PageDda;
  };
  const r = await req.get(`${base}/api/grc/${PERIMETRE_COMMUN}/objects?kind=nonconformity`);
  if (!r.ok()) throw new Error(`écarts : ${r.status()} ${await r.text()}`);
  const corps = await r.json();
  return {
    dda: { ISO: await page('ISO'), A: await page('A'), HDS: await page('HDS') },
    ecarts: (Array.isArray(corps) ? corps : corps.items) as Ecart[],
  };
}
