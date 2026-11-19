/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : veille sur cinq sources publiques (CISA KEV, NVD, EPSS, CERT-FR,
   CERT Santé). L'API n'a aucun accès réseau sortant (ADR 0014) : elle inscrit une collecte « en file » (tic quotidien, ou
   « Collecter maintenant ») ; l'exécutant d'exploitation (scripts/exploitation-worker.py) la réclame par la CLI
   (`suivi veille-claim`), lance le script isolé scripts/veille-vulnerabilites.py, rapporte les éléments par lots bornés
   (`suivi veille-lot`) puis termine (`suivi veille-finish`). Modèle suivi : le socle des connecteurs (integrations/index.ts).
   - Flux « veille-vulnerabilites » (ADR 0097), fermé par défaut, ouvert par « Activer la veille » (route commune des flux,
     validation explicite), refermé par la désactivation du module. Flux fermé ou module désactivé : rien n'est inscrit ni
     réclamé ; une collecte en file est close sans appel.
   - Planification (lot F1) : une collecte par source et par période réglée au plus (deux heures par défaut, NVD jamais plus
     d'une fois toutes les deux heures, EPSS une fois par jour), comptée depuis la dernière demande automatique ; cette
     référence est consommée avant l'inscription, dans la même transaction : une collecte perdue (exécutant absent, panne)
     ou en échec n'est pas redemandée avant la période suivante. EPSS passe quand la file est vide, puisqu'il ne note que
     des failles déjà connues de la veille.
   - Les éléments sont des données publiques, validées un à un par le schéma de leur source (packages/shared) et rangées sans
     doublon (clé de la faille, ou source et identifiant de l'avis) : une collecte rejouée met à jour, n'ajoute rien.
   - Lot V4c (V23, V26) : une CVE citée par un avis existe dans la veille dès cette publication, avant NVD ; chaque fait
     reste rangé avec sa source et sa date (sources.ts). Fiches du CERT Santé : le script reçoit l'empreinte du titre des
     fiches lues depuis moins de FICHE_CERTSANTE_RELECTURE_JOURS jours et ne relit que les autres ; les mentions lues sont
     rangées sur la publication, avec la date du premier signalement de l'exploitation et de la preuve de concept.
   Droits contrôlés par route() (lire, administrer) ; journal `vulnerabilites.veille.*` sans contenu de source. Accès aux
   données en Kysely (ADR 0062). */
import { createHash } from 'node:crypto';
import {
  CVE_ID,
  echeanceAtteinte,
  ELEMENT_VEILLE,
  type EtatSourceVeilleDto,
  FREQUENCES_VEILLE,
  frequenceVeille,
  frequenceVeilleAdmise,
  frequenceVeilleModifiable,
  prochaineAffichee,
  referenceApresDemande,
  sourceVeille,
  FICHE_CERTSANTE_RELECTURE_JOURS,
  type AvisVeilleDto,
  type CollecteVeilleDto,
  type ElementAvis,
  type ElementEpss,
  type ElementKev,
  type ElementNvd,
  type EtatVeilleDto,
  type FailleVeilleDto,
  type GraviteCvss,
  LotVeille,
  normaliserNom,
  type PageVeille,
  RapportCollecte,
  type RechercheAvis,
  type RechercheFailles,
  SOURCES_VEILLE,
  SOURCES_VEILLE_DEFINITIONS,
  type SourceVeille,
  type SurfaceCveDto,
  VEILLE_BORNES,
  VEILLE_PAR_PAGE,
  VEILLE_RETARD_HEURES,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import type { Actor, Client, Db, Kdb } from '../db/db.js';
import type { VulnerabilitesVeilleCollectes } from '../db/types.generated.js';
import type { FluxExternes } from '../flux-externes.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { Mandataire } from '../mandataire.js';
import { lireFaitsCve, publicationsDe, sourcesDe } from './sources.js';
import type { SurfaceExterneAlh } from './surface-externe.js';

type LigneCollecte = Selectable<VulnerabilitesVeilleCollectes>;

const FLUX = 'veille-vulnerabilites' as const;
/** Verrou consultatif de la file des collectes (727277 : courriels, 727278 : connecteurs). */
const verrouFile = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727279)`.execute(k);
/** Une collecte non réclamée après ce délai expire ; une collecte « en cours » au-delà est considérée interrompue (NVD
    attend six secondes entre deux pages, le CERT-FR lit l'export de chaque avis nouveau). */
const EXPIRATION_FILE = sql<Date>`now() - interval '30 minutes'`;
const ABANDON_EN_COURS = sql<Date>`now() - interval '20 minutes'`;
/** « Collecter maintenant » : une source déjà demandée à la main depuis moins de ce délai n'est pas redemandée. */
const INTERVALLE_MANUEL = sql<Date>`now() - interval '15 minutes'`;
/** Fenêtre NVD : la suivante part de la fin de la précédente réussie ; jamais plus de sept jours en arrière (le rattrapage
    d'une longue interruption est borné), un jour pour la première collecte. */
const NVD_PREMIERE_FENETRE_MS = 24 * 3_600_000;
const NVD_RATTRAPAGE_MAX_MS = 7 * 24 * 3_600_000;
/** Avis du CERT-FR déjà lus (identifiants CVE connus) remis au script, qui ne relit pas leur export : bornés. */
const CERTFR_CONNUS_MAX = 2000;
/** Fiches du CERT Santé déjà lues remises au script (identifiant et empreinte du titre lu) : bornées. */
const CERTSANTE_LUES_MAX = 2000;
/** Empreinte du titre sous lequel une fiche a été lue : le script la recalcule sur le titre du flux (même texte nettoyé). */
const empreinteTitre = (titre: string) => createHash('sha256').update(titre, 'utf8').digest('hex').slice(0, 16);
const EXECUTANT = { username: 'exécutant serveur' };
const PLANIFICATION = { username: 'planification' };
/** Ordre de planification : EPSS en dernier. */
const AVANT_EPSS: SourceVeille[] = ['cisa-kev', 'nvd', 'cert-fr', 'cert-sante'];

const versCollecte = (r: LigneCollecte): CollecteVeilleDto => ({
  id: r.id,
  source: r.source,
  origine: r.origine,
  etat: r.etat,
  demandePar: r.demande_par,
  demandeLe: r.demande_le.toISOString(),
  termineLe: r.termine_le?.toISOString() ?? null,
  elements: r.elements,
  tronque: r.tronque,
  erreur: r.erreur,
});

/** Motif ILIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const nombre = (v: string | null) => (v === null ? null : Number(v));

export class VeilleVulnerabilites {
  /** Recalcul des rapprochements après une collecte NVD (lot V4a) ou CERT Santé (lot V4c : produit cité par une CVE
      absente de NVD) réussie, branché par services.ts. */
  apresCollecte: (() => Promise<unknown>) | null = null;
  /** Lot V6 : après toute collecte reçue (quelle que soit la source, après le rapprochement), évaluation des alertes. Ne lève
      jamais (le service des alertes journalise ses échecs). */
  apresReception: ((source: SourceVeille) => Promise<unknown>) | null = null;
  /** Surface externe (lot ALH2), branchée par services.ts : actifs exposés lisibles qui portent une CVE. */
  surface: SurfaceExterneAlh | null = null;

  constructor(
    private readonly db: Db,
    private readonly flux: FluxExternes,
    /** Mandataire sortant de l'établissement (ADR 0101, lot P1) : la veille est le seul flux qui l'emprunte. */
    private readonly mandataire: Mandataire,
  ) {}

  /* ---------------------------------------------------------------- Lecture (vulnerabilites:lire) */
  async etat(): Promise<EtatVeilleDto> {
    const flux = await this.flux.lire(FLUX);
    const lignes = new Map(
      (await this.db.k.selectFrom('vulnerabilites_veille_sources').selectAll().execute()).map((l) => [l.source, l]),
    );
    const dernieres = new Map(
      (
        await this.db.k
          .selectFrom('vulnerabilites_veille_collectes')
          .selectAll()
          .distinctOn('source')
          .orderBy('source')
          .orderBy('demande_le', 'desc')
          .orderBy('id')
          .execute()
      ).map((c) => [c.source, versCollecte(c)]),
    );
    const maintenant = new Date();
    const limite = maintenant.getTime() - VEILLE_RETARD_HEURES * 3_600_000;
    const fiches = await this.db.k
      .selectFrom('vulnerabilites_veille_avis')
      .select([
        sql<number>`count(*) FILTER (WHERE fiche_lue_le IS NOT NULL AND fiche_titre = titre
          AND fiche_lue_le >= now() - make_interval(days => ${FICHE_CERTSANTE_RELECTURE_JOURS}))::int`.as('lues'),
        sql<number>`count(*) FILTER (WHERE fiche_lue_le IS NULL OR fiche_titre <> titre
          OR fiche_lue_le < now() - make_interval(days => ${FICHE_CERTSANTE_RELECTURE_JOURS}))::int`.as('a_lire'),
        sql<Date | null>`max(fiche_lue_le)`.as('derniere'),
      ])
      .where('source', '=', 'cert-sante')
      .where('adresse', 'is not', null)
      .where(sql<boolean>`cardinality(cves) > 0`)
      // Publications encore présentes dans le flux (vues par une collecte des deux derniers jours) : une publication sortie
      // du flux n'est plus jamais lue, elle ne compte ni comme lue ni comme à lire.
      .where('maj_le', '>=', sql<Date>`now() - interval '48 hours'`)
      .executeTakeFirstOrThrow();
    return {
      flux: { ouvert: flux.ouvert, applique: flux.applique },
      executant: { disponible: await this.executantDisponible() },
      mandataire: { actif: await this.mandataire.actif() },
      sources: SOURCES_VEILLE_DEFINITIONS.map((d) => {
        const l = lignes.get(d.id);
        const reussite = l?.derniere_reussite ?? null;
        const frequence = frequenceVeille(d.id, l?.frequence_heures);
        return {
          source: d.id,
          libelle: d.libelle,
          organisme: d.organisme,
          hote: d.hote,
          format: d.format,
          langue: d.langue,
          demande: d.demande,
          derniereReussite: reussite?.toISOString() ?? null,
          dernierEssai: l?.dernier_essai?.toISOString() ?? null,
          erreur: l?.erreur ?? null,
          enRetard: flux.ouvert && (!reussite || reussite.getTime() < limite),
          derniereCollecte: dernieres.get(d.id) ?? null,
          frequenceHeures: frequence,
          prochaineCollecte: flux.ouvert
            ? prochaineAffichee(l?.planifiee_le ?? null, frequence, maintenant).toISOString()
            : null,
          version: l?.version ?? 1,
        };
      }),
      fichesCertSante: {
        lues: fiches.lues,
        aLire: fiches.a_lire,
        derniereLecture: fiches.derniere?.toISOString() ?? null,
        relectureJours: FICHE_CERTSANTE_RELECTURE_JOURS,
      },
    };
  }

  /** Alertes et avis, les plus récents d'abord ; recherche par identifiant CVE cité, identifiant de l'avis ou titre. */
  async avis(q: RechercheAvis): Promise<PageVeille<AvisVeilleDto>> {
    let base = this.db.k.selectFrom('vulnerabilites_veille_avis');
    if (q.source) base = base.where('source', '=', q.source);
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      base = /^cve-\d/i.test(texte)
        ? base.where(sql<boolean>`EXISTS (SELECT 1 FROM unnest(cves) c WHERE c ILIKE ${`${motif.toUpperCase()}%`})`)
        : base.where((eb) => eb.or([eb('titre', 'ilike', `%${motif}%`), eb('identifiant', 'ilike', `%${motif}%`)]));
    }
    const { n } = await base.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
    const lignes = await base
      .select([
        'id',
        'source',
        'identifiant',
        'nature',
        'titre',
        'resume',
        'adresse',
        'publie_le',
        'cves',
        'vu_le',
        'produit',
        'fiche_lue_le',
        'fiche_exploitee',
        'fiche_correctif',
        'fiche_contournement',
        'fiche_preuve',
        'fiche_cvss31',
        'fiche_exploitee_le',
        'fiche_preuve_le',
      ])
      .orderBy(sql`publie_le DESC NULLS LAST`)
      .orderBy('identifiant', 'desc')
      .limit(VEILLE_PAR_PAGE)
      .offset((q.page - 1) * VEILLE_PAR_PAGE)
      .execute();
    return {
      total: n,
      page: q.page,
      parPage: VEILLE_PAR_PAGE,
      elements: lignes.map((l) => ({
        id: l.id,
        source: l.source,
        identifiant: l.identifiant,
        nature: l.nature,
        titre: l.titre,
        resume: l.resume,
        adresse: l.adresse,
        publieLe: l.publie_le?.toISOString() ?? null,
        cves: l.cves,
        vuLe: l.vu_le.toISOString(),
        produit: l.produit,
        fiche: l.fiche_lue_le
          ? {
              exploitee: l.fiche_exploitee as 'oui' | 'non' | null,
              correctif: l.fiche_correctif as 'oui' | 'non' | null,
              contournement: l.fiche_contournement as 'oui' | 'non' | null,
              preuveConcept: l.fiche_preuve as 'disponible' | 'indisponible' | null,
              cvss31: nombre(l.fiche_cvss31),
              lueLe: l.fiche_lue_le.toISOString(),
              exploiteeLe: l.fiche_exploitee_le?.toISOString() ?? null,
              preuveLe: l.fiche_preuve_le?.toISOString() ?? null,
            }
          : null,
      })),
    };
  }

  /** Failles connues de la veille ; `kev` : celles du catalogue des failles exploitées, les plus récemment ajoutées d'abord.
      Recherche par identifiant CVE, éditeur, produit ou nom de la faille. Lot ALH2 : ce que dit AlgoLightHouse et la vue sur
      la surface externe ; lot ALH5 : les faits d'AlgoLightHouse sont les mêmes pour tout le monde, les actifs et alertes
      comptés sont ceux que la personne lit (une exposition ailleurs est signalée sans nom ni nombre). */
  async failles(q: RechercheFailles, user: SessionUser): Promise<PageVeille<FailleVeilleDto>> {
    let base = this.db.k.selectFrom('vulnerabilites_veille_cve');
    if (q.kev) base = base.where('kev_ajout', 'is not', null);
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      base = /^cve-\d/i.test(texte)
        ? base.where('cve', 'like', `${motif.toUpperCase()}%`)
        : base.where((eb) =>
            eb.or([
              eb('kev_editeur', 'ilike', `%${motif}%`),
              eb('kev_produit', 'ilike', `%${motif}%`),
              eb('kev_nom', 'ilike', `%${motif}%`),
              sql<boolean>`EXISTS (SELECT 1 FROM unnest(editeurs) e WHERE e ILIKE ${`%${motif}%`})`,
              sql<boolean>`EXISTS (SELECT 1 FROM unnest(produits) p WHERE p ILIKE ${`%${motif}%`})`,
              sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_veille_avis a WHERE a.source = 'cert-sante'
                AND a.cves @> ARRAY[vulnerabilites_veille_cve.cve] AND a.produit ILIKE ${`%${motif}%`})`,
            ]),
          );
    }
    const { n } = await base.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
    const lignes = await base
      .selectAll()
      .select([
        sql<string | null>`kev_ajout::text`.as('kev_ajout_t'),
        sql<string | null>`kev_echeance::text`.as('kev_echeance_t'),
        sql<string | null>`epss_date::text`.as('epss_date_t'),
      ])
      .orderBy(q.kev ? sql`kev_ajout DESC` : sql`coalesce(modifie_le, kev_le, avis_le, cree_le) DESC`)
      .orderBy('cve', 'desc')
      .limit(VEILLE_PAR_PAGE)
      .offset((q.page - 1) * VEILLE_PAR_PAGE)
      .execute();
    const cvss = (score: string | null, vecteur: string | null, gravite: string | null) =>
      score !== null && vecteur && gravite ? { score: Number(score), vecteur, gravite: gravite as GraviteCvss } : null;
    const faits = await lireFaitsCve(
      this.db.k,
      lignes.map((l) => l.cve),
    );
    const surface = this.surface
      ? await this.surface.surfaceDesCves(
          user,
          lignes.map((l) => l.cve),
        )
      : new Map<string, SurfaceCveDto>();
    return {
      total: n,
      page: q.page,
      parPage: VEILLE_PAR_PAGE,
      elements: lignes.map((l) => ({
        cve: l.cve,
        description: l.description,
        publieLe: l.publie_le?.toISOString() ?? null,
        modifieLe: l.modifie_le?.toISOString() ?? null,
        cvss31: cvss(l.cvss31_score, l.cvss31_vecteur, l.cvss31_gravite),
        cvss40: cvss(l.cvss40_score, l.cvss40_vecteur, l.cvss40_gravite),
        editeurs: l.editeurs,
        produits: l.produits,
        epss:
          l.epss_score !== null && l.epss_date_t
            ? { score: nombre(l.epss_score)!, centile: nombre(l.epss_centile) ?? 0, date: l.epss_date_t }
            : null,
        kev: l.kev_ajout_t
          ? {
              editeur: l.kev_editeur ?? '',
              produit: l.kev_produit ?? '',
              nom: l.kev_nom ?? '',
              description: l.kev_description ?? '',
              action: l.kev_action ?? '',
              ajoutLe: l.kev_ajout_t,
              echeance: l.kev_echeance_t,
              rancongiciel: l.kev_rancongiciel,
            }
          : null,
        ...(() => {
          const f = faits.get(l.cve);
          return {
            publications: f ? publicationsDe(f) : [],
            produitsCites: [
              ...new Set((f?.avis ?? []).flatMap((a) => (a.source === 'cert-sante' && a.produit ? [a.produit] : []))),
            ],
            sources: sourcesDe(f ? [f] : []),
            surfaceExterne: surface.get(l.cve) ?? null,
          };
        })(),
      })),
    };
  }

  /* ---------------------------------------------------------------- Collecte manuelle (vulnerabilites:administrer) */
  /** « Collecter maintenant » : inscrit une collecte par source demandée, sauf si elle est déjà en file ou en cours, ou si
      elle a été demandée à la main depuis moins de quinze minutes. Refusé si le flux est fermé ou l'exécutant absent. */
  async demander(source: SourceVeille | undefined, user: Actor, ip: string): Promise<CollecteVeilleDto[]> {
    await this.flux.exiger(FLUX);
    if (!(await this.executantDisponible()))
      throw new HttpError(
        503,
        'L’exécutant d’exploitation du serveur n’est pas disponible : c’est lui qui lit les sources (guide d’installation, étape 11.6).',
      );
    const voulues = source ? [source] : [...SOURCES_VEILLE];
    const crees = await this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      const out: LigneCollecte[] = [];
      for (const s of voulues) {
        const occupee = await k
          .selectFrom('vulnerabilites_veille_collectes')
          .select('id')
          .where('source', '=', s)
          .where((eb) =>
            eb.or([
              eb('etat', 'in', ['en_file', 'en_cours']),
              eb.and([eb('origine', '=', 'manuel'), eb('demande_le', '>', INTERVALLE_MANUEL)]),
            ]),
          )
          .executeTakeFirst();
        if (occupee) continue;
        const r = await this.inscrire(k, c, s, 'manuel', user, ip);
        out.push(r);
      }
      return out;
    }, user.username);
    if (!crees.length)
      throw new HttpError(
        409,
        'Collecte déjà en cours, ou demandée il y a moins de quinze minutes : réessayez plus tard.',
      );
    return crees.map(versCollecte);
  }

  /* ---------------------------------------------------------------- Planification (tic de l'API) */
  /** Lot F1 : inscrit au plus une collecte par source et par période réglée (deux heures par défaut, EPSS une fois par jour),
      comptée depuis la dernière demande AUTOMATIQUE. La référence est consommée avant l'inscription, dans la même
      transaction : une collecte perdue, expirée ou en échec n'est pas redemandée avant la période suivante (aucune boucle à
      chaque tic). Une collecte de la source déjà en file ou en cours (demandée à la main) tient lieu de celle-ci. EPSS passe
      après les autres sources dues au même tic, quand la file est vide. Le module est contrôlé par l'appelant ; flux fermé :
      rien. */
  async planifier(maintenant = new Date()): Promise<string[]> {
    if (!(await this.flux.ouvert(FLUX))) return [];
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      await k
        .insertInto('vulnerabilites_veille_sources')
        .values(SOURCES_VEILLE.map((source) => ({ source })))
        .onConflict((oc) => oc.column('source').doNothing())
        .execute();
      const etats = new Map(
        (
          await k
            .selectFrom('vulnerabilites_veille_sources')
            .select(['source', 'frequence_heures', 'planifiee_le'])
            .forUpdate()
            .execute()
        ).map((l) => [l.source, l]),
      );
      const due = (s: SourceVeille) => {
        const e = etats.get(s);
        return echeanceAtteinte(e?.planifiee_le ?? null, frequenceVeille(s, e?.frequence_heures), maintenant);
      };
      const enAttente = async (s?: SourceVeille) => {
        let q = k
          .selectFrom('vulnerabilites_veille_collectes')
          .select('id')
          .where('etat', 'in', ['en_file', 'en_cours']);
        if (s) q = q.where('source', '=', s);
        return !!(await q.executeTakeFirst());
      };
      const ids: string[] = [];
      const consommer = async (s: SourceVeille) => {
        const e = etats.get(s);
        const reference = referenceApresDemande(
          e?.planifiee_le ?? null,
          frequenceVeille(s, e?.frequence_heures),
          maintenant,
        );
        // Référence consommée d'abord : une collecte inscrite puis perdue n'est pas réinscrite avant la période suivante.
        await k
          .updateTable('vulnerabilites_veille_sources')
          .set({ planifiee_le: reference })
          .where('source', '=', s)
          .execute();
        // Une collecte de la source déjà en file ou en cours (demandée à la main) tient lieu de celle-ci.
        if (!(await enAttente(s))) ids.push((await this.inscrire(k, c, s, 'planifie', PLANIFICATION, null)).id);
      };
      for (const s of AVANT_EPSS) if (due(s)) await consommer(s);
      // EPSS : seulement quand aucune collecte n'attend (les autres sources dues sont traitées), pour noter les failles
      // qu'elles viennent d'apporter.
      if (due('epss') && !(await enAttente())) await consommer('epss');
      return ids;
    });
  }

  /* ---------------------------------------------------------------- Fréquence (vulnerabilites:administrer) */
  /** Lot F1 : règle la fréquence d'une source (liste fermée de la source, 422 hors liste ; EPSS fixe). If-Match sur la version
      de la source ; journal `vulnerabilites.veille.frequence` (source, ancienne et nouvelle fréquence). La référence de la
      dernière demande automatique est gardée : la prochaine échéance se recalcule, sans rafale (une seule demande si elle est
      déjà passée). */
  async reglerFrequence(
    source: SourceVeille,
    frequenceHeures: number,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<EtatSourceVeilleDto> {
    if (!frequenceVeilleModifiable(source))
      throw new HttpError(422, `La fréquence de la source « ${sourceVeille(source).libelle} » est fixe.`);
    if (!frequenceVeilleAdmise(source, frequenceHeures))
      throw new HttpError(
        422,
        `Fréquence refusée pour la source « ${sourceVeille(source).libelle} » : ${FREQUENCES_VEILLE[source].join(', ')} heures seulement.`,
      );
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('vulnerabilites_veille_sources')
        .values({ source })
        .onConflict((oc) => oc.column('source').doNothing())
        .execute();
      const avant = await k
        .selectFrom('vulnerabilites_veille_sources')
        .select(['frequence_heures', 'version'])
        .where('source', '=', source)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (avant.version !== attendue)
        throw conflict({ version: avant.version, frequenceHeures: frequenceVeille(source, avant.frequence_heures) });
      const ancienne = frequenceVeille(source, avant.frequence_heures);
      await k
        .updateTable('vulnerabilites_veille_sources')
        .set((eb) => ({ frequence_heures: frequenceHeures, version: eb('version', '+', 1) }))
        .where('source', '=', source)
        .execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.veille.frequence',
        source,
        { source, avant: ancienne, apres: frequenceHeures },
        c,
      );
    }, user.username);
    return (await this.etat()).sources.find((s) => s.source === source)!;
  }

  private async inscrire(
    k: Kdb,
    c: Client,
    source: SourceVeille,
    origine: 'manuel' | 'planifie',
    acteur: Actor,
    ip: string | null,
  ): Promise<LigneCollecte> {
    const r = await k
      .insertInto('vulnerabilites_veille_collectes')
      .values({ source, origine, demande_par: acteur.username })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.db.audit(acteur, ip, 'vulnerabilites.veille.collecte.demandee', r.id, { source, origine }, c);
    return r;
  }

  /** Ménage de la file, sous son verrou : collecte jamais réclamée expirée, collecte interrompue close. */
  private async menage(k: Kdb, c: Client) {
    const expirees = await k
      .updateTable('vulnerabilites_veille_collectes')
      .set({
        etat: 'expire',
        termine_le: sql<Date>`now()`,
        erreur: 'Collecte expirée : l’exécutant ne l’a pas prise en charge à temps.',
      })
      .where('etat', '=', 'en_file')
      .where('demande_le', '<', EXPIRATION_FILE)
      .returning(['id', 'source', 'erreur'])
      .execute();
    const interrompues = await k
      .updateTable('vulnerabilites_veille_collectes')
      .set({ etat: 'echec', termine_le: sql<Date>`now()`, erreur: 'Exécutant interrompu : aucun résultat reçu.' })
      .where('etat', '=', 'en_cours')
      .where('debute_le', '<', ABANDON_EN_COURS)
      .returning(['id', 'source', 'erreur'])
      .execute();
    for (const r of [...expirees, ...interrompues]) {
      await this.noterEchec(k, r.source, r.erreur!);
      await this.db.audit(
        EXECUTANT,
        null,
        'vulnerabilites.veille.collecte.terminee',
        r.id,
        { source: r.source, etat: expirees.includes(r) ? 'expire' : 'echec' },
        c,
      );
    }
  }

  private async noterEchec(k: Kdb, source: SourceVeille, erreur: string) {
    await k
      .insertInto('vulnerabilites_veille_sources')
      .values({ source, erreur, dernier_essai: sql<Date>`now()` })
      .onConflict((oc) => oc.column('source').doUpdateSet({ erreur, dernier_essai: sql<Date>`now()` }))
      .execute();
  }

  /* ---------------------------------------------------------------- CLI de l'exécutant */
  /** `suivi veille-claim` : réclame la collecte en file la plus ancienne et rend ses paramètres (fenêtre NVD, failles à
      noter par EPSS, avis du CERT-FR déjà lus). Module désactivé ou flux fermé : rien n'est remis, les collectes en file
      sont closes sans appel. Mandataire de l'établissement actif (ADR 0101) : ses paramètres, mot de passe compris, sont
      joints à la demande remise à l'exécutant (jamais au journal) ; réglage illisible : rien n'est remis, la collecte en
      file est close, plutôt que de sortir en direct. */
  async reclamer(moduleActif: boolean): Promise<Record<string, unknown> | null> {
    const ouvert = moduleActif && (await this.flux.ouvert(FLUX));
    const mandataire = ouvert ? await this.mandataire.pourExecutant() : null;
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      if (!ouvert || mandataire === 'illisible') {
        const closes = await k
          .updateTable('vulnerabilites_veille_collectes')
          .set({
            etat: 'echec',
            termine_le: sql<Date>`now()`,
            erreur: !ouvert
              ? 'Flux fermé ou module désactivé : la collecte n’a pas été transmise.'
              : 'Réglage du mandataire sortant illisible : la collecte n’a pas été transmise (Configuration système, Mandataire sortant).',
          })
          .where('etat', '=', 'en_file')
          .returning(['id', 'source'])
          .execute();
        for (const x of closes)
          await this.db.audit(
            EXECUTANT,
            null,
            'vulnerabilites.veille.collecte.terminee',
            x.id,
            { source: x.source, etat: 'echec' },
            c,
          );
        return null;
      }
      const r = await k
        .selectFrom('vulnerabilites_veille_collectes')
        .selectAll()
        .where('etat', '=', 'en_file')
        .orderBy('demande_le')
        .orderBy('id')
        .limit(1)
        .forUpdate()
        .executeTakeFirst();
      if (!r) return null;
      const maintenant = new Date();
      let parametres: Record<string, unknown> = {};
      let fenetre: { debut: Date; fin: Date } | null = null;
      if (r.source === 'nvd') {
        const s = await k
          .selectFrom('vulnerabilites_veille_sources')
          .select('fenetre_fin')
          .where('source', '=', 'nvd')
          .executeTakeFirst();
        const fin = new Date(Math.floor(maintenant.getTime() / 1000) * 1000);
        const plancher = fin.getTime() - NVD_RATTRAPAGE_MAX_MS;
        const debut = new Date(
          Math.max(s?.fenetre_fin?.getTime() ?? fin.getTime() - NVD_PREMIERE_FENETRE_MS, plancher),
        );
        fenetre = { debut: debut < fin ? debut : new Date(fin.getTime() - 60_000), fin };
        parametres = { depuis: fenetre.debut.toISOString(), jusqua: fenetre.fin.toISOString() };
      } else if (r.source === 'epss') {
        // Failles déjà connues de la veille (KEV, avis, fenêtre NVD) dont le score n'a pas été lu depuis vingt heures :
        // celles du catalogue KEV d'abord, puis celles citées par un avis, puis les plus récemment modifiées. Le registre des
        // produits et le parc n'interviennent jamais dans ce choix.
        const cves = await k
          .selectFrom('vulnerabilites_veille_cve')
          .select('cve')
          .where((eb) => eb.or([eb('epss_le', 'is', null), eb('epss_le', '<', sql<Date>`now() - interval '20 hours'`)]))
          .orderBy(sql`(kev_ajout IS NOT NULL) DESC`)
          .orderBy(sql`avis_le DESC NULLS LAST`)
          .orderBy(sql`modifie_le DESC NULLS LAST`)
          .orderBy('cve', 'desc')
          .limit(VEILLE_BORNES.epss)
          .execute();
        parametres = { cves: cves.map((x) => x.cve) };
      } else if (r.source === 'cert-fr') {
        // Avis (AVI) dont les identifiants CVE ont déjà été lus : le script ne relit pas leur export. Les alertes (ALE),
        // mises à jour au fil de l'exploitation, sont relues à chaque collecte.
        const connus = await k
          .selectFrom('vulnerabilites_veille_avis')
          .select('identifiant')
          .where('source', '=', 'cert-fr')
          .where('nature', '=', 'avis')
          .where('cves_lues', '=', true)
          .orderBy(sql`publie_le DESC NULLS LAST`)
          .limit(CERTFR_CONNUS_MAX)
          .execute();
        parametres = { connus: connus.map((x) => x.identifiant) };
      } else if (r.source === 'cert-sante') {
        // Fiches lues depuis moins du délai de relecture : le script ne les relit que si le titre du flux a changé.
        const lues = await k
          .selectFrom('vulnerabilites_veille_avis')
          .select(['identifiant', 'fiche_titre'])
          .where('source', '=', 'cert-sante')
          .where('fiche_lue_le', '>=', sql<Date>`now() - make_interval(days => ${FICHE_CERTSANTE_RELECTURE_JOURS})`)
          .orderBy(sql`publie_le DESC NULLS LAST`)
          .orderBy('identifiant', 'desc')
          .limit(CERTSANTE_LUES_MAX)
          .execute();
        parametres = { lues: Object.fromEntries(lues.map((x) => [x.identifiant, empreinteTitre(x.fiche_titre!)])) };
      }
      await k
        .updateTable('vulnerabilites_veille_collectes')
        .set({
          etat: 'en_cours',
          debute_le: sql<Date>`now()`,
          fenetre_debut: fenetre?.debut ?? null,
          fenetre_fin: fenetre?.fin ?? null,
        })
        .where('id', '=', r.id)
        .execute();
      await k
        .insertInto('vulnerabilites_veille_sources')
        .values({ source: r.source, dernier_essai: sql<Date>`now()` })
        .onConflict((oc) => oc.column('source').doUpdateSet({ dernier_essai: sql<Date>`now()` }))
        .execute();
      await this.db.audit(
        EXECUTANT,
        null,
        'vulnerabilites.veille.collecte.reclamee',
        r.id,
        { source: r.source, ...(fenetre ? { depuis: parametres.depuis, jusqua: parametres.jusqua } : {}) },
        c,
      );
      return { id: r.id, source: r.source, parametres, ...(mandataire ? { mandataire } : {}) };
    });
  }

  /** `suivi veille-lot <id>` : range un lot d'éléments d'une collecte en cours. Chaque élément est validé par le schéma de la
      source ; un seul élément refusé fait refuser tout le lot (rien n'est écrit). */
  async lot(id: string, brut: unknown): Promise<{ elements: number; lots: number }> {
    z.uuid().parse(id);
    const { elements } = LotVeille.parse(brut);
    return this.db.tx(async (_c, k) => {
      const cur = await k
        .selectFrom('vulnerabilites_veille_collectes')
        .select(['source', 'lots', 'elements'])
        .where('id', '=', id)
        .where('etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!cur) throw new HttpError(409, 'Collecte absente ou déjà terminée.');
      if (cur.lots >= VEILLE_BORNES.lots) throw new HttpError(409, 'Nombre de lots dépassé pour cette collecte.');
      const schema = ELEMENT_VEILLE[cur.source];
      const valides: unknown[] = [];
      elements.forEach((e, i) => {
        const v = schema.safeParse(e);
        if (!v.success)
          throw new HttpError(
            422,
            `Élément ${i + 1} du lot refusé (${v.error.issues[0]?.message ?? 'forme inattendue'}).`,
          );
        valides.push(v.data);
      });
      await this.ranger(k, cur.source, valides);
      const r = await k
        .updateTable('vulnerabilites_veille_collectes')
        .set((eb) => ({ lots: eb('lots', '+', 1), elements: eb('elements', '+', valides.length) }))
        .where('id', '=', id)
        .returning(['lots', 'elements'])
        .executeTakeFirstOrThrow();
      return { elements: r.elements, lots: r.lots };
    });
  }

  /** `suivi veille-finish <id>` : clôt la collecte. Un succès dont le bilan ne correspond pas aux éléments reçus est
      consigné en échec. */
  async terminer(id: string, rapport: unknown): Promise<CollecteVeilleDto> {
    z.uuid().parse(id);
    const p = RapportCollecte.parse(rapport);
    const r = await this.db.tx(async (c, k) => {
      const cur = await k
        .selectFrom('vulnerabilites_veille_collectes')
        .selectAll()
        .where('id', '=', id)
        .where('etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!cur) return undefined;
      let erreur = p.erreur;
      if (p.ok && p.bilan!.elements !== cur.elements)
        erreur = `Bilan incohérent : ${p.bilan!.elements} élément(s) annoncé(s), ${cur.elements} reçu(s).`;
      const ok = p.ok && erreur === null;
      const fin = await k
        .updateTable('vulnerabilites_veille_collectes')
        .set({
          etat: ok ? 'recu' : 'echec',
          termine_le: sql<Date>`now()`,
          ecartes: p.bilan?.ecartes ?? 0,
          tronque: p.bilan?.tronque ?? false,
          erreur: ok ? null : erreur,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (ok)
        await k
          .insertInto('vulnerabilites_veille_sources')
          .values({
            source: cur.source,
            derniere_reussite: sql<Date>`now()`,
            dernier_essai: sql<Date>`now()`,
            erreur: null,
            fenetre_fin: cur.fenetre_fin,
          })
          .onConflict((oc) =>
            oc.column('source').doUpdateSet((eb) => ({
              derniere_reussite: sql<Date>`now()`,
              erreur: null,
              fenetre_fin:
                cur.source === 'nvd'
                  ? eb.ref('excluded.fenetre_fin')
                  : eb.ref('vulnerabilites_veille_sources.fenetre_fin'),
            })),
          )
          .execute();
      else await this.noterEchec(k, cur.source, fin.erreur!);
      await this.db.audit(
        EXECUTANT,
        null,
        'vulnerabilites.veille.collecte.terminee',
        id,
        {
          source: cur.source,
          etat: fin.etat,
          elements: fin.elements,
          lots: fin.lots,
          ...(ok ? { ecartes: fin.ecartes, tronque: fin.tronque } : { erreur: fin.erreur }),
        },
        c,
      );
      return fin;
    });
    if (!r) throw new HttpError(409, 'Collecte absente ou déjà terminée.');
    // Rapprochement (lots V4a et V4c) : recalculé après chaque collecte NVD ou CERT Santé réussie, hors de la transaction de
    // clôture (la collecte reste close et reçue même si le recalcul échoue ; il est refait à la collecte ou à la
    // modification suivante).
    if ((r.source === 'nvd' || r.source === 'cert-sante') && r.etat === 'recu' && this.apresCollecte)
      await this.apresCollecte();
    if (r.etat === 'recu' && this.apresReception) await this.apresReception(r.source);
    return versCollecte(r);
  }

  /* ---------------------------------------------------------------- Rangement (sans doublon) */
  private async ranger(k: Kdb, source: SourceVeille, elements: unknown[]) {
    if (!elements.length) return;
    switch (source) {
      case 'cisa-kev':
        return this.rangerKev(
          k,
          dernierParCle(elements as ElementKev[], (e) => e.cve),
        );
      case 'nvd':
        return this.rangerNvd(
          k,
          dernierParCle(elements as ElementNvd[], (e) => e.cve),
        );
      case 'epss':
        return this.rangerEpss(
          k,
          dernierParCle(elements as ElementEpss[], (e) => e.cve),
        );
      case 'cert-fr':
      case 'cert-sante':
        return this.rangerAvis(
          k,
          source,
          dernierParCle(elements as ElementAvis[], (e) => e.identifiant),
        );
    }
  }

  private async rangerKev(k: Kdb, el: ElementKev[]) {
    await k
      .insertInto('vulnerabilites_veille_cve')
      .values(
        el.map((e) => ({
          cve: e.cve,
          kev_editeur: e.editeur,
          kev_produit: e.produit,
          kev_nom: e.nom,
          kev_description: e.description,
          kev_action: e.action,
          kev_ajout: e.ajoutLe,
          kev_echeance: e.echeance,
          kev_rancongiciel: e.rancongiciel,
          kev_le: sql<Date>`now()`,
        })),
      )
      .onConflict((oc) =>
        oc.column('cve').doUpdateSet((eb) => ({
          kev_editeur: eb.ref('excluded.kev_editeur'),
          kev_produit: eb.ref('excluded.kev_produit'),
          kev_nom: eb.ref('excluded.kev_nom'),
          kev_description: eb.ref('excluded.kev_description'),
          kev_action: eb.ref('excluded.kev_action'),
          kev_ajout: eb.ref('excluded.kev_ajout'),
          kev_echeance: eb.ref('excluded.kev_echeance'),
          kev_rancongiciel: eb.ref('excluded.kev_rancongiciel'),
          kev_le: sql<Date>`now()`,
          maj_le: sql<Date>`now()`,
        })),
      )
      .execute();
  }

  private async rangerNvd(k: Kdb, el: ElementNvd[]) {
    await k
      .insertInto('vulnerabilites_veille_cve')
      .values(
        el.map((e) => ({
          cve: e.cve,
          description: e.description,
          publie_le: e.publieLe,
          modifie_le: e.modifieLe,
          cvss31_score: e.cvss31?.score ?? null,
          cvss31_vecteur: e.cvss31?.vecteur ?? null,
          cvss31_gravite: e.cvss31?.gravite ?? null,
          cvss40_score: e.cvss40?.score ?? null,
          cvss40_vecteur: e.cvss40?.vecteur ?? null,
          cvss40_gravite: e.cvss40?.gravite ?? null,
          editeurs: e.editeurs,
          produits: e.produits,
          produits_tronques: e.produitsTronques,
          nvd_le: sql<Date>`now()`,
        })),
      )
      .onConflict((oc) =>
        oc.column('cve').doUpdateSet((eb) => ({
          description: eb.ref('excluded.description'),
          publie_le: eb.ref('excluded.publie_le'),
          modifie_le: eb.ref('excluded.modifie_le'),
          cvss31_score: eb.ref('excluded.cvss31_score'),
          cvss31_vecteur: eb.ref('excluded.cvss31_vecteur'),
          cvss31_gravite: eb.ref('excluded.cvss31_gravite'),
          cvss40_score: eb.ref('excluded.cvss40_score'),
          cvss40_vecteur: eb.ref('excluded.cvss40_vecteur'),
          cvss40_gravite: eb.ref('excluded.cvss40_gravite'),
          editeurs: eb.ref('excluded.editeurs'),
          produits: eb.ref('excluded.produits'),
          produits_tronques: eb.ref('excluded.produits_tronques'),
          nvd_le: sql<Date>`now()`,
          maj_le: sql<Date>`now()`,
        })),
      )
      .execute();
    // Produits touchés (lot V4a) : remplacés en bloc pour chaque CVE du lot, dans l'ordre rapporté par le script.
    await k
      .deleteFrom('vulnerabilites_veille_cve_produits')
      .where(
        'cve',
        'in',
        el.map((e) => e.cve),
      )
      .execute();
    const touches = el.flatMap((e) =>
      e.produitsTouches.map((p, rang) => ({
        cve: e.cve,
        rang,
        partie: p.partie,
        editeur: p.editeur,
        produit: p.produit,
        editeur_norm: normaliserNom(p.editeur),
        produit_norm: normaliserNom(p.produit),
        version: p.version,
        debut_inclus: p.debutInclus,
        debut_exclus: p.debutExclus,
        fin_inclus: p.finInclus,
        fin_exclus: p.finExclus,
        vulnerable: p.vulnerable,
      })),
    );
    for (let i = 0; i < touches.length; i += 2000)
      await k
        .insertInto('vulnerabilites_veille_cve_produits')
        .values(touches.slice(i, i + 2000))
        .execute();
  }

  /** EPSS ne note que des failles déjà connues : un score pour une faille inconnue de la veille est ignoré. */
  private async rangerEpss(k: Kdb, el: ElementEpss[]) {
    await sql`UPDATE vulnerabilites_veille_cve AS v
      SET epss_score = x.score, epss_centile = x.centile, epss_date = x.date, epss_le = now(), maj_le = now()
      FROM unnest(${el.map((e) => e.cve)}::text[], ${el.map((e) => e.score)}::numeric[],
                  ${el.map((e) => e.centile)}::numeric[], ${el.map((e) => e.date)}::date[]) AS x(cve, score, centile, date)
      WHERE v.cve = x.cve`.execute(k);
  }

  /** Une alerte ou un avis, sans doublon par (source, identifiant). Les CVE citées entrent dans la liste des failles connues
      dès cette publication (V26 : avant NVD s'il le faut, sans autre champ ; leur score EPSS peut être demandé). Un export
      illisible (cvesLues faux) ne remplace pas les CVE déjà lues. CERT Santé (lot V4c) : produit cité par le titre ;
      mentions de la fiche lue à cette collecte, sinon celles déjà rangées sont gardées. Date du premier signalement de
      l'exploitation (et de la preuve de concept) : date de publication si la mention figurait dès la première lecture de la
      fiche, sinon date de la lecture qui l'a vue ; effacée si la source change d'avis. */
  private async rangerAvis(k: Kdb, source: 'cert-fr' | 'cert-sante', el: ElementAvis[]) {
    const lu = (e: ElementAvis) => source === 'cert-sante' && !!e.fiche;
    await k
      .insertInto('vulnerabilites_veille_avis')
      .values(
        el.map((e) => {
          const produit = source === 'cert-sante' ? (e.produit ?? null) : null;
          const premier = sql<Date>`coalesce(${e.publieLe}::timestamptz, now())`;
          return {
            source,
            identifiant: e.identifiant,
            nature: e.nature,
            titre: e.titre,
            resume: e.resume,
            adresse: e.adresse,
            publie_le: e.publieLe,
            cves: e.cves,
            cves_lues: e.cvesLues,
            produit,
            produit_norm: produit ? normaliserNom(produit) || null : null,
            fiche_lue_le: lu(e) ? sql<Date>`now()` : null,
            fiche_titre: lu(e) ? e.titre : null,
            fiche_exploitee: lu(e) ? e.fiche!.exploitee : null,
            fiche_correctif: lu(e) ? e.fiche!.correctif : null,
            fiche_contournement: lu(e) ? e.fiche!.contournement : null,
            fiche_preuve: lu(e) ? e.fiche!.preuveConcept : null,
            fiche_cvss31: lu(e) ? e.fiche!.cvss31 : null,
            fiche_exploitee_le: lu(e) && e.fiche!.exploitee === 'oui' ? premier : null,
            fiche_preuve_le: lu(e) && e.fiche!.preuveConcept === 'disponible' ? premier : null,
          };
        }),
      )
      .onConflict((oc) =>
        oc.columns(['source', 'identifiant']).doUpdateSet((eb) => {
          const garder = <C extends string>(c: C) =>
            sql`CASE WHEN excluded.fiche_lue_le IS NULL THEN vulnerabilites_veille_avis.${sql.ref(c)}
                ELSE excluded.${sql.ref(c)} END`;
          /** Premier signalement : gardé tant que la source le dit ; date de la lecture s'il apparaît après la première. */
          const premier = (mention: 'fiche_exploitee' | 'fiche_preuve', valeur: string, date: string) =>
            sql<Date | null>`CASE WHEN excluded.fiche_lue_le IS NULL THEN vulnerabilites_veille_avis.${sql.ref(date)}
              WHEN excluded.${sql.ref(mention)} = ${valeur} THEN coalesce(vulnerabilites_veille_avis.${sql.ref(date)},
                CASE WHEN vulnerabilites_veille_avis.fiche_lue_le IS NULL THEN excluded.${sql.ref(date)} ELSE now() END)
              ELSE NULL END`;
          return {
            nature: eb.ref('excluded.nature'),
            titre: eb.ref('excluded.titre'),
            resume: eb.ref('excluded.resume'),
            adresse: eb.ref('excluded.adresse'),
            publie_le: eb.ref('excluded.publie_le'),
            cves: sql<
              string[]
            >`CASE WHEN excluded.cves_lues THEN excluded.cves ELSE vulnerabilites_veille_avis.cves END`,
            cves_lues: sql<boolean>`vulnerabilites_veille_avis.cves_lues OR excluded.cves_lues`,
            produit: eb.ref('excluded.produit'),
            produit_norm: eb.ref('excluded.produit_norm'),
            fiche_exploitee_le: premier('fiche_exploitee', 'oui', 'fiche_exploitee_le'),
            fiche_preuve_le: premier('fiche_preuve', 'disponible', 'fiche_preuve_le'),
            fiche_lue_le: garder('fiche_lue_le') as never,
            fiche_titre: garder('fiche_titre') as never,
            fiche_exploitee: garder('fiche_exploitee') as never,
            fiche_correctif: garder('fiche_correctif') as never,
            fiche_contournement: garder('fiche_contournement') as never,
            fiche_preuve: garder('fiche_preuve') as never,
            fiche_cvss31: garder('fiche_cvss31') as never,
            maj_le: sql<Date>`now()`,
          };
        }),
      )
      .execute();
    const cves = [...new Set(el.flatMap((e) => e.cves))].filter((x) => CVE_ID.test(x));
    if (cves.length)
      await k
        .insertInto('vulnerabilites_veille_cve')
        .values(cves.map((cve) => ({ cve, avis_le: sql<Date>`now()` })))
        .onConflict((oc) => oc.column('cve').doUpdateSet({ avis_le: sql<Date>`now()` }))
        .execute();
  }

  private async executantDisponible(): Promise<boolean> {
    return !!(await this.db.k
      .selectFrom('backup_worker')
      .select('id')
      .where('id', '=', 1)
      .where('ready', '=', true)
      .where('seen_at', '>', sql<Date>`now() - interval '120 seconds'`)
      .executeTakeFirst());
  }
}

/** Dernier élément de chaque clé (un même identifiant ne peut pas être mis à jour deux fois par la même requête). */
function dernierParCle<T>(elements: T[], cle: (e: T) => string): T[] {
  return [...new Map(elements.map((e) => [cle(e), e])).values()];
}
