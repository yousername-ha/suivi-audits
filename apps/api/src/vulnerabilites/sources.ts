/* Module Vulnérabilités (ADR 0100, décisions V23, V26 et V27 ; lot V4c) : ce que chaque source dit d'une CVE, avec sa
   provenance et sa date. Rien n'est recopié d'une source dans une autre : chaque fait reste dans les colonnes de sa source
   (NVD, catalogue KEV, EPSS dans vulnerabilites_veille_cve ; alertes du CERT-FR et fiches du CERT Santé dans
   vulnerabilites_veille_avis ; Tenable dans le constat), et la publication par NVD d'une CVE déjà connue par un avis ne
   l'efface pas. Ce module rassemble ces faits pour l'affichage et pour la priorité :
   - exploitation avérée dès qu'une source le dit (« ou » logique, V26) : catalogue KEV, alerte du CERT-FR qui cite la CVE,
     mention « activement exploitée : Oui » de la fiche du CERT Santé (V23) ; « exploitable » : Tenable, ou preuve de
     concept disponible selon le CERT Santé. Sources rangées de la première à la dernière, avec leur date ;
   - valeurs par source (gravité, score CVSS, score EPSS), toutes gardées ; la priorité prend la plus sévère (V27,
     valeursRetenues du paquet partagé).
   Lecture seule, en deux requêtes pour un lot de CVE.
   Lot ALH2 (décision B du RSSI du 17/11/2026) : AlgoLightHouse est une source de plus, pour les CVE des technologies qu'il
   voit encore : `is_exploited` vaut exploitation avérée, `has_poc` vaut « exploitable », score CVSS et EPSS gardés avec
   leur source (gravité déduite du score, comme pour le CERT Santé). Les CVE des alertes ne portent aucun fait : elles ne
   disent que la présence. Lot ALH5 (décision A du RSSI du 17/11/2026) : « une priorité est la même pour tout le monde » ;
   ces faits sont lus sur toutes les technologies, sans tenir compte des droits de lecture de la personne (ils ne nomment
   aucun actif ; le choix n° 1 du lot ALH2 est remplacé).
   Lot N2 (décision du RSSI du 19/11/2026) : un contrôle de Tenable marqué « exploité par un logiciel malveillant » (colonne
   `exploite_malware` du constat, import Nessus) est une source de plus de l'exploitation avérée, propre au constat (pas à
   ses CVE) : sourcesDe la reçoit avec les faits de Tenable ; les filtres SQL l'ajoutent à exploiteeCve (failles.ts). */
import {
  type GraviteSource,
  type GraviteTenable,
  graviteDepuisNvd,
  graviteDepuisScore,
  type MentionCertSante,
  rangerSignalements,
  type ScoreSource,
  type Signalement,
  type SourceExploitable,
  type SourceExploitation,
  type SourcesFailleDto,
  SOURCES_EXPLOITABLE,
  SOURCES_EXPLOITATION,
  SOURCES_VALEUR,
  type SourceValeur,
  type SourceVeille,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { Kdb } from '../db/db.js';
import { cvesAlh } from './sql.js';

const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Fiche du CERT Santé lue pour une publication qui cite la CVE. */
interface FicheLue {
  exploitee: MentionCertSante | null;
  exploiteeLe: string | null;
  preuve: 'disponible' | 'indisponible' | null;
  preuveLe: string | null;
  correctif: MentionCertSante | null;
  contournement: MentionCertSante | null;
  cvss31: number | null;
  lueLe: string;
}

/** Faits d'une CVE, par source. */
export interface FaitsCve {
  cve: string;
  /** La CVE est connue de la veille (sinon seulement d'AlgoLightHouse). */
  veille: boolean;
  nvd: { publieLe: string | null; gravite: GraviteTenable | null; score: number | null } | null;
  kevAjout: string | null;
  /** Lot PRIO-1 : le catalogue KEV dit la CVE utilisée par des rançongiciels (`knownRansomwareCampaignUse` = « Known »). */
  kevRancongiciel?: boolean;
  epss: number | null;
  /** Publications d'avis qui citent la CVE (source, nature, date de publication ou, à défaut, de première vue). */
  avis: { source: 'cert-fr' | 'cert-sante'; nature: 'alerte' | 'avis'; le: string; produit: string | null }[];
  fiches: FicheLue[];
  /** Ce qu'AlgoLightHouse dit de la CVE, sur toutes les technologies encore détectées (lots ALH2 et ALH5) : null sans
      technologie. Exploitée ou preuve : vrai dès qu'une version le dit ; scores : le plus haut. */
  alh: { exploitee: boolean; preuve: boolean; cvss: number | null; epss: number | null } | null;
}

/** Au-delà de ce nombre de CVE demandées, les avis sont joints à la liste par hachage plutôt que filtrés par l'index. */
const LISTE_COURTE = 50;

/** Faits de chaque CVE demandée (les CVE inconnues de la veille et d'AlgoLightHouse sont absentes de la table rendue). Les
    mêmes pour tout le monde (lot ALH5, décision A). */
export async function lireFaitsCve(k: Kdb, cves: readonly string[]): Promise<Map<string, FaitsCve>> {
  const liste = [...new Set(cves)];
  const out = new Map<string, FaitsCve>();
  if (!liste.length) return out;
  const { rows: v } = await sql<{
    cve: string;
    publie_le: Date | null;
    nvd_le: Date | null;
    cvss31_gravite: string | null;
    cvss40_gravite: string | null;
    score: string | null;
    epss_score: string | null;
    kev_ajout: string | null;
    kev_rancongiciel: boolean | null;
  }>`SELECT cve, publie_le, nvd_le, cvss31_gravite, cvss40_gravite,
            CASE WHEN cvss31_gravite IS NOT NULL THEN cvss31_score ELSE cvss40_score END AS score,
            epss_score, kev_ajout::text AS kev_ajout, kev_rancongiciel
     FROM vulnerabilites_veille_cve WHERE cve = ANY(${liste}::text[])`.execute(k);
  for (const l of v)
    out.set(l.cve, {
      cve: l.cve,
      veille: true,
      nvd: l.nvd_le
        ? {
            publieLe: iso(l.publie_le),
            gravite: graviteDepuisNvd(l.cvss31_gravite, l.cvss40_gravite),
            score: nombre(l.score),
          }
        : null,
      kevAjout: l.kev_ajout,
      ...(l.kev_ajout && l.kev_rancongiciel === true ? { kevRancongiciel: true } : {}),
      epss: nombre(l.epss_score),
      avis: [],
      fiches: [],
      alh: null,
    });
  const { rows: x } = await sql<{
    cve: string;
    exploitee: boolean;
    preuve: boolean;
    cvss: string | null;
    epss: string | null;
  }>`SELECT c.cve, bool_or(coalesce(c.exploitee, false)) AS exploitee, bool_or(coalesce(c.preuve, false)) AS preuve,
            max(c.cvss) AS cvss, max(c.epss) AS epss
     FROM (${cvesAlh}) c WHERE c.cve = ANY(${liste}::text[]) GROUP BY c.cve`.execute(k);
  for (const l of x) {
    const alh = { exploitee: l.exploitee, preuve: l.preuve, cvss: nombre(l.cvss), epss: nombre(l.epss) };
    const f = out.get(l.cve);
    if (f) f.alh = alh;
    else
      out.set(l.cve, { cve: l.cve, veille: false, nvd: null, kevAjout: null, epss: null, avis: [], fiches: [], alh });
  }
  /* PERF-13 (banc du 21/11/2026) : avec une longue liste, « a.cves && liste » compare chaque CVE de chaque avis à toute la
     liste (3 à 4 s pour 14 000 avis et 13 000 CVE) : jointure par hachage sur la liste, lue une fois. Avec une liste
     courte (fiche d'une CVE, délai d'une décision), l'index des CVE citées reste le plus court chemin. Mêmes lignes dans
     les deux cas : les couples (avis, CVE citée) dont la CVE est demandée. */
  const filtreAvis =
    liste.length > LISTE_COURTE
      ? sql`JOIN (SELECT DISTINCT x AS cve FROM unnest(${liste}::text[]) AS x) l ON l.cve = c.cve`
      : sql`WHERE a.cves && ${liste}::text[] AND c.cve = ANY(${liste}::text[])`;
  const { rows: a } = await sql<{
    cve: string;
    source: 'cert-fr' | 'cert-sante';
    nature: 'alerte' | 'avis';
    le: Date;
    produit: string | null;
    fiche_lue_le: Date | null;
    fiche_exploitee: MentionCertSante | null;
    fiche_exploitee_le: Date | null;
    fiche_preuve: 'disponible' | 'indisponible' | null;
    fiche_preuve_le: Date | null;
    fiche_correctif: MentionCertSante | null;
    fiche_contournement: MentionCertSante | null;
    fiche_cvss31: string | null;
  }>`SELECT c.cve, a.source, a.nature, coalesce(a.publie_le, a.vu_le) AS le, a.produit, a.fiche_lue_le,
            a.fiche_exploitee, a.fiche_exploitee_le, a.fiche_preuve, a.fiche_preuve_le, a.fiche_correctif,
            a.fiche_contournement, a.fiche_cvss31
     FROM vulnerabilites_veille_avis a CROSS JOIN LATERAL unnest(a.cves) AS c(cve)
     ${filtreAvis}
     ORDER BY c.cve, a.source, a.identifiant`.execute(k);
  for (const l of a) {
    const f = out.get(l.cve);
    if (!f) continue;
    f.avis.push({ source: l.source, nature: l.nature, le: l.le.toISOString(), produit: l.produit });
    if (l.source === 'cert-sante' && l.fiche_lue_le)
      f.fiches.push({
        exploitee: l.fiche_exploitee,
        exploiteeLe: iso(l.fiche_exploitee_le),
        preuve: l.fiche_preuve,
        preuveLe: iso(l.fiche_preuve_le),
        correctif: l.fiche_correctif,
        contournement: l.fiche_contournement,
        cvss31: nombre(l.fiche_cvss31),
        lueLe: l.fiche_lue_le.toISOString(),
      });
  }
  return out;
}

/** Ce que dit Tenable d'un constat (valeurs de la source « tenable »). Lot N2 : `malware`, contrôle marqué « exploité par un
    logiciel malveillant » (import Nessus ; toujours faux pour Security Center), vaut exploitation avérée. */
export interface FaitsTenable {
  gravite: GraviteTenable;
  cvss3: number | null;
  epss: number | null;
  exploitable: boolean;
  malware: boolean;
  /** Lot PRIO-1 : kits d'exploitation cités par Tenable (Metasploit, Core Impact, CANVAS) ; « exploitable », source
      `tenable-kit`, jamais exploitation avérée. Absent : aucun. */
  kits?: readonly string[];
}

/** Une valeur par source : la plus sévère de la source quand plusieurs CVE en portent une (constat de Tenable). */
function parSource<T extends { source: SourceValeur }>(liste: T[], valeur: (x: T) => number): T[] {
  const m = new Map<SourceValeur, T>();
  for (const x of liste) {
    const deja = m.get(x.source);
    if (!deja || valeur(x) > valeur(deja)) m.set(x.source, x);
  }
  // Lot PERF-04 : boucle simple (appelée trois fois par ensemble de sources, des dizaines de milliers de fois par calcul global).
  const out: T[] = [];
  for (const s of SOURCES_VALEUR) {
    const x = m.get(s);
    if (x) out.push(x);
  }
  return out;
}
const RANG: Record<GraviteTenable, number> = { critique: 4, elevee: 3, moyenne: 2, faible: 1 };
/** Mention identique dans toutes les fiches lues, sinon non renseignée (null). */
const commune = (valeurs: (MentionCertSante | null)[]) =>
  valeurs.length && valeurs.every((x) => x !== null && x === valeurs[0]) ? valeurs[0]! : null;

/** Ce que les sources disent d'un ensemble de CVE (une seule pour une faille déclarée, celles d'un constat de Tenable),
    et de Tenable lui-même pour un constat. */
export function sourcesDe(faits: readonly FaitsCve[], tenable?: FaitsTenable): SourcesFailleDto {
  const exploitation: Signalement<SourceExploitation>[] = [];
  const exploitable: Signalement<SourceExploitable>[] = [];
  const gravites: GraviteSource[] = [];
  const cvss: ScoreSource[] = [];
  const epss: ScoreSource[] = [];
  const fiches = faits.flatMap((f) => f.fiches);
  let rancongiciel = false;
  for (const f of faits) {
    if (f.kevAjout) exploitation.push({ source: 'kev', le: `${f.kevAjout}T00:00:00.000Z` });
    if (f.kevRancongiciel) rancongiciel = true;
    for (const a of f.avis)
      if (a.source === 'cert-fr' && a.nature === 'alerte') exploitation.push({ source: 'cert-fr', le: a.le });
    for (const x of f.fiches) {
      if (x.exploitee === 'oui') exploitation.push({ source: 'cert-sante', le: x.exploiteeLe });
      if (x.preuve === 'disponible') exploitable.push({ source: 'cert-sante', le: x.preuveLe });
      if (x.cvss31 !== null) {
        cvss.push({ source: 'cert-sante', score: x.cvss31 });
        const g = graviteDepuisScore(x.cvss31);
        if (g) gravites.push({ source: 'cert-sante', gravite: g });
      }
    }
    if (f.nvd?.gravite) gravites.push({ source: 'nvd', gravite: f.nvd.gravite });
    if (f.nvd?.score !== null && f.nvd?.score !== undefined) cvss.push({ source: 'nvd', score: f.nvd.score });
    if (f.epss !== null) epss.push({ source: 'first', score: f.epss });
    if (f.alh) {
      // AlgoLightHouse ne date pas ses faits : date inconnue, rangée après les sources datées (V26).
      if (f.alh.exploitee) exploitation.push({ source: 'alh', le: null });
      if (f.alh.preuve) exploitable.push({ source: 'alh', le: null });
      if (f.alh.cvss !== null) {
        cvss.push({ source: 'alh', score: f.alh.cvss });
        const g = graviteDepuisScore(f.alh.cvss);
        if (g) gravites.push({ source: 'alh', gravite: g });
      }
      if (f.alh.epss !== null) epss.push({ source: 'alh', score: f.alh.epss });
    }
  }
  if (tenable) {
    gravites.push({ source: 'tenable', gravite: tenable.gravite });
    if (tenable.cvss3 !== null) cvss.push({ source: 'tenable', score: tenable.cvss3 });
    if (tenable.epss !== null) epss.push({ source: 'tenable', score: tenable.epss });
    if (tenable.exploitable) exploitable.push({ source: 'tenable', le: null });
    // Lot N2 : fait du contrôle, sans date (rangé après les sources datées, V26).
    if (tenable.malware) exploitation.push({ source: 'tenable', le: null });
    // Lot PRIO-1 : kit d'exploitation disponible selon Tenable, fait du contrôle sans date, rangé avec « exploitable ».
    if (tenable.kits?.length) exploitable.push({ source: 'tenable-kit', le: null });
  }
  return {
    exploitation: rangerSignalements(exploitation, SOURCES_EXPLOITATION),
    exploitable: rangerSignalements(exploitable, SOURCES_EXPLOITABLE),
    valeurs: {
      gravites: parSource(gravites, (x) => RANG[x.gravite]),
      cvss: parSource(cvss, (x) => x.score),
      epss: parSource(epss, (x) => x.score),
    },
    certSante: fiches.length
      ? {
          correctif: commune(fiches.map((x) => x.correctif)),
          contournement: commune(fiches.map((x) => x.contournement)),
        }
      : null,
    ...(rancongiciel ? { rancongiciel: true } : {}),
  };
}

/** Sources qui ont publié une CVE, de la première à la dernière (V26) : NVD, catalogue KEV, CERT-FR, CERT Santé. */
export function publicationsDe(f: FaitsCve): Signalement<Exclude<SourceVeille, 'epss'>>[] {
  const liste: Signalement<Exclude<SourceVeille, 'epss'>>[] = [];
  if (f.nvd) liste.push({ source: 'nvd', le: f.nvd.publieLe });
  if (f.kevAjout) liste.push({ source: 'cisa-kev', le: `${f.kevAjout}T00:00:00.000Z` });
  for (const a of f.avis) liste.push({ source: a.source, le: a.le });
  return rangerSignalements(liste, ['nvd', 'cisa-kev', 'cert-fr', 'cert-sante']);
}

/** La CVE de la colonne désignée (liste fermée écrite dans le code) a une exploitation avérée selon une source : catalogue
    KEV, alerte du CERT-FR, fiche du CERT Santé (« activement exploitée : Oui »), ou AlgoLightHouse sur une technologie
    encore détectée (lots ALH2 et ALH5 : le même résultat pour tout le monde). Pour les filtres et les compteurs calculés en
    SQL ; même règle que sourcesDe. */
export const exploiteeCve = (colonne: 'v.cve' | 'cc.cve' | 'r.cve'): RawBuilder<boolean> =>
  sql<boolean>`(EXISTS (SELECT 1 FROM vulnerabilites_veille_cve vk WHERE vk.cve = ${sql.ref(colonne)}
      AND vk.kev_ajout IS NOT NULL)
    OR EXISTS (SELECT 1 FROM vulnerabilites_veille_avis a WHERE a.cves @> ARRAY[${sql.ref(colonne)}]::text[]
      AND ((a.source = 'cert-fr' AND a.nature = 'alerte') OR (a.source = 'cert-sante' AND a.fiche_exploitee = 'oui')))
    OR EXISTS (SELECT 1 FROM (${cvesAlh}) za WHERE za.cve = ${sql.ref(colonne)} AND za.exploitee))`;

/** Lot PERF (PERF-02) : ensemble des CVE à l'exploitation avérée selon une source, même règle qu'exploiteeCve sous forme
    d'ensemble (une lecture par requête au lieu de trois sous-requêtes par CVE, coût estimé sous le seuil du JIT). Toute
    évolution de l'une se reporte sur l'autre (test vulnerabilites-priorite-commune). Colonne : cve. */
export const cvesExploitees = sql<{ cve: string }>`SELECT vk.cve FROM vulnerabilites_veille_cve vk
    WHERE vk.kev_ajout IS NOT NULL
  UNION SELECT x.cve FROM vulnerabilites_veille_avis a CROSS JOIN LATERAL unnest(a.cves) AS x(cve)
    WHERE x.cve IS NOT NULL
      AND ((a.source = 'cert-fr' AND a.nature = 'alerte') OR (a.source = 'cert-sante' AND a.fiche_exploitee = 'oui'))
  UNION SELECT za.cve FROM (${cvesAlh}) za WHERE za.exploitee AND za.cve IS NOT NULL`;

/** La CVE de la colonne désignée est « exploitable » selon la fiche du CERT Santé (preuve de concept disponible), ou selon
    AlgoLightHouse sur une technologie encore détectée (lots ALH2 et ALH5). */
export const preuveCertSante = (colonne: 'cc.cve'): RawBuilder<boolean> =>
  sql<boolean>`(EXISTS (SELECT 1 FROM vulnerabilites_veille_avis a WHERE a.source = 'cert-sante'
    AND a.fiche_preuve = 'disponible' AND a.cves @> ARRAY[${sql.ref(colonne)}]::text[])
    OR EXISTS (SELECT 1 FROM (${cvesAlh}) za WHERE za.cve = ${sql.ref(colonne)} AND za.preuve))`;
