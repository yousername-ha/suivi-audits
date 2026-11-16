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
   Lecture seule, en deux requêtes pour un lot de CVE. */
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
  nvd: { publieLe: string | null; gravite: GraviteTenable | null; score: number | null } | null;
  kevAjout: string | null;
  epss: number | null;
  /** Publications d'avis qui citent la CVE (source, nature, date de publication ou, à défaut, de première vue). */
  avis: { source: 'cert-fr' | 'cert-sante'; nature: 'alerte' | 'avis'; le: string; produit: string | null }[];
  fiches: FicheLue[];
}

/** Faits de chaque CVE demandée (les CVE inconnues de la veille sont absentes de la table rendue). */
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
  }>`SELECT cve, publie_le, nvd_le, cvss31_gravite, cvss40_gravite,
            CASE WHEN cvss31_gravite IS NOT NULL THEN cvss31_score ELSE cvss40_score END AS score,
            epss_score, kev_ajout::text AS kev_ajout
     FROM vulnerabilites_veille_cve WHERE cve = ANY(${liste}::text[])`.execute(k);
  for (const l of v)
    out.set(l.cve, {
      cve: l.cve,
      nvd: l.nvd_le
        ? {
            publieLe: iso(l.publie_le),
            gravite: graviteDepuisNvd(l.cvss31_gravite, l.cvss40_gravite),
            score: nombre(l.score),
          }
        : null,
      kevAjout: l.kev_ajout,
      epss: nombre(l.epss_score),
      avis: [],
      fiches: [],
    });
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
     WHERE a.cves && ${liste}::text[] AND c.cve = ANY(${liste}::text[])
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

/** Ce que dit Tenable d'un constat (valeurs de la source « tenable »). */
export interface FaitsTenable {
  gravite: GraviteTenable;
  cvss3: number | null;
  epss: number | null;
  exploitable: boolean;
}

/** Une valeur par source : la plus sévère de la source quand plusieurs CVE en portent une (constat de Tenable). */
function parSource<T extends { source: SourceValeur }>(liste: T[], valeur: (x: T) => number): T[] {
  const m = new Map<SourceValeur, T>();
  for (const x of liste) {
    const deja = m.get(x.source);
    if (!deja || valeur(x) > valeur(deja)) m.set(x.source, x);
  }
  return SOURCES_VALEUR.flatMap((s) => (m.has(s) ? [m.get(s)!] : []));
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
  for (const f of faits) {
    if (f.kevAjout) exploitation.push({ source: 'kev', le: `${f.kevAjout}T00:00:00.000Z` });
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
  }
  if (tenable) {
    gravites.push({ source: 'tenable', gravite: tenable.gravite });
    if (tenable.cvss3 !== null) cvss.push({ source: 'tenable', score: tenable.cvss3 });
    if (tenable.epss !== null) epss.push({ source: 'tenable', score: tenable.epss });
    if (tenable.exploitable) exploitable.push({ source: 'tenable', le: null });
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
    KEV, alerte du CERT-FR, ou fiche du CERT Santé (« activement exploitée : Oui »). Pour les filtres et les compteurs
    calculés en SQL ; même règle que sourcesDe. */
export const exploiteeCve = (colonne: 'v.cve' | 'cc.cve' | 'r.cve'): RawBuilder<boolean> =>
  sql<boolean>`(EXISTS (SELECT 1 FROM vulnerabilites_veille_cve vk WHERE vk.cve = ${sql.ref(colonne)}
      AND vk.kev_ajout IS NOT NULL)
    OR EXISTS (SELECT 1 FROM vulnerabilites_veille_avis a WHERE a.cves @> ARRAY[${sql.ref(colonne)}]::text[]
      AND ((a.source = 'cert-fr' AND a.nature = 'alerte') OR (a.source = 'cert-sante' AND a.fiche_exploitee = 'oui'))))`;

/** La CVE de la colonne désignée est « exploitable » selon la fiche du CERT Santé (preuve de concept disponible). */
export const preuveCertSante = (colonne: 'cc.cve'): RawBuilder<boolean> =>
  sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_veille_avis a WHERE a.source = 'cert-sante'
    AND a.fiche_preuve = 'disponible' AND a.cves @> ARRAY[${sql.ref(colonne)}]::text[])`;
