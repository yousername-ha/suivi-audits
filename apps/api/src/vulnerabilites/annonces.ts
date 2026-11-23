/* Module Vulnérabilités (ADR 0100, lot CVE-INC ; décisions du RSSI du 22/11/2026) : sources facultatives de la veille,
   désactivées au départ (préavis des CVE de Cloudflare Radar, résumés de tldrcve), sur le modèle de la veille réglementaire
   (ADR 0110) : l'API inscrit les collectes des sources activées à leur fréquence (en minutes ; lot F1 pour les règles), sous
   le flux « veille-vulnerabilites » ; l'exécutant réclame (`suivi veille-annonces-claim`), rapporte par lots (`-lot`) puis
   clôt (`-finish`) avec le même script isolé que la veille.
   - Chaque élément est revalidé (ELEMENT_ANNONCE) ; un élément refusé fait refuser tout le lot.
   - Préavis : seuls sont gardés les CVE critiques et ceux dont le titre ou le résumé cite le nom d'un produit surveillé
     (correspondance de mots faite ici, en local ; « à confirmer »). Un préavis est « remplacé » dès que la CVE est connue par
     NVD, cve.org ou un CERT : il n'est plus montré. Aucune notification, aucune alerte, aucun effet sur la priorité ; les CVE
     citées n'entrent pas dans la veille.
   - Résumés de tldrcve : rangés tels que le flux les publie (texte simple borné) ; les cartes de l'interface y ajoutent les
     faits de la plateforme (exploitation, KEV, EPSS, présence, exposition, produit surveillé), les mêmes pour tout le monde.
   - Purge : annonces non revues depuis 90 jours, journal des collectes de plus de 90 jours.
   - Journal d'audit (décision du RSSI du 23/11/2026) : une seule entrée par collecte, à sa fin, avec son résultat
     (`vulnerabilites.annonces.collecte.terminee` : reçue avec ses nombres, ou échec ou expiration avec l'erreur) ; ni la
     demande planifiée ni la réclamation par l'exécutant n'y sont inscrites (à 15 minutes, trois entrées par collecte
     faisaient près de 300 lignes par jour). Le journal des collectes (une ligne par collecte) est purgé à 90 jours.
   Réglages avec `vulnerabilites:administrer`, If-Match, journal `vulnerabilites.annonces.reglage`. Kysely (ADR 0062). */
import {
  ANNONCES_BORNES,
  ANNONCES_PAR_PAGE,
  type AnnonceDto,
  echeanceAtteinte,
  ELEMENT_ANNONCE,
  type ElementPreavis,
  type ElementTldrcve,
  type EtatSourceAnnonceDto,
  type FaitsAnnonceCve,
  FREQUENCES_ANNONCES,
  frequenceAnnonces,
  frequenceAnnoncesAdmise,
  LotVeille,
  type PageAnnoncesDto,
  prochaineAffichee,
  RapportCollecte,
  type RechercheAnnonces,
  referenceApresDemande,
  type ReglageSourceAnnonce,
  retenirPreavis,
  type SourceAnnonce,
  sourceAnnonce,
  SOURCES_ANNONCES_DEFINITIONS,
  VEILLE_BORNES,
} from '@suivi/shared';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Actor, Client, Db, Kdb } from '../db/db.js';
import type { FluxExternes } from '../flux-externes.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { detailMandataire, type Mandataire } from '../mandataire.js';
import { nonRemplacee } from './cve-inconnue.js';
import { cvesExploitees } from './sources.js';
import type { SurfaceExterneAlh } from './surface-externe.js';
import type { VeilleVulnerabilites } from './veille.js';

const FLUX = 'veille-vulnerabilites' as const;
const verrouFile = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727293)`.execute(k);
const EXPIRATION_FILE = sql<Date>`now() - interval '30 minutes'`;
const ABANDON_EN_COURS = sql<Date>`now() - interval '10 minutes'`;
const EXECUTANT = { username: 'exécutant serveur' };
const PLANIFICATION = { username: 'planification' };
const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
/** Colonnes d'une collecte close, pour son entrée unique au journal d'audit. */
const FIN = ['id', 'source', 'etat', 'elements', 'gardes', 'erreur'] as const;
const minutes = (s: SourceAnnonce, reglee: number | null | undefined) => frequenceAnnonces(s, reglee);

export class AnnoncesVeille {
  /** Branchées par services.ts : présence sur le parc (veille) et exposition (surface externe), pour les faits des cartes. */
  veille: VeilleVulnerabilites | null = null;
  surface: SurfaceExterneAlh | null = null;

  constructor(
    private readonly db: Db,
    private readonly flux: FluxExternes,
    private readonly mandataire: Mandataire,
  ) {}

  /* ---------------------------------------------------------------- État et réglages */
  async etat(): Promise<EtatSourceAnnonceDto[]> {
    const ouvert = await this.flux.ouvert(FLUX);
    const lignes = new Map(
      (await this.db.k.selectFrom('vulnerabilites_veille_annonces_sources').selectAll().execute()).map((l) => [
        l.source as SourceAnnonce,
        l,
      ]),
    );
    const maintenant = new Date();
    return SOURCES_ANNONCES_DEFINITIONS.map((d) => {
      const l = lignes.get(d.id);
      const f = minutes(d.id, l?.frequence_minutes);
      return {
        source: d.id,
        libelle: d.libelle,
        organisme: d.organisme,
        hote: d.hote,
        activee: l?.activee ?? false,
        frequenceMinutes: f,
        frequences: [...FREQUENCES_ANNONCES[d.id]],
        derniereReussite: iso(l?.derniere_reussite),
        dernierEssai: iso(l?.dernier_essai),
        erreur: l?.erreur ?? null,
        prochaineCollecte:
          ouvert && l?.activee ? prochaineAffichee(l.planifiee_le, f / 60, maintenant).toISOString() : null,
        version: l?.version ?? 1,
      };
    });
  }

  /** Activation et fréquence d'une source (`administrer`, If-Match sur sa version). Activer ne lance rien si le flux est
      fermé ; la première collecte part au tic suivant. */
  async regler(
    source: SourceAnnonce,
    r: ReglageSourceAnnonce,
    attendue: number,
    user: Actor,
    ip: string,
  ): Promise<EtatSourceAnnonceDto> {
    if (r.frequenceMinutes !== undefined && !frequenceAnnoncesAdmise(source, r.frequenceMinutes))
      throw new HttpError(
        422,
        `Fréquence refusée pour « ${sourceAnnonce(source).libelle} » : ${FREQUENCES_ANNONCES[source].join(', ')} minutes seulement.`,
      );
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('vulnerabilites_veille_annonces_sources')
        .values({ source })
        .onConflict((oc) => oc.column('source').doNothing())
        .execute();
      const avant = await k
        .selectFrom('vulnerabilites_veille_annonces_sources')
        .select(['activee', 'frequence_minutes', 'version'])
        .where('source', '=', source)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (avant.version !== attendue) throw conflict({ version: avant.version });
      const ancien = { activee: avant.activee, frequenceMinutes: minutes(source, avant.frequence_minutes) };
      const apres = {
        activee: r.activee ?? ancien.activee,
        frequenceMinutes: r.frequenceMinutes ?? ancien.frequenceMinutes,
      };
      await k
        .updateTable('vulnerabilites_veille_annonces_sources')
        .set((eb) => ({
          activee: apres.activee,
          frequence_minutes: apres.frequenceMinutes,
          ...(apres.activee && !ancien.activee ? { erreur: null } : {}),
          version: eb('version', '+', 1),
        }))
        .where('source', '=', source)
        .execute();
      await this.db.audit(user, ip, 'vulnerabilites.annonces.reglage', source, { source, avant: ancien, apres }, c);
    }, user.username);
    return (await this.etat()).find((s) => s.source === source)!;
  }

  /* ---------------------------------------------------------------- Planification (tic de l'API) */
  /** Au plus une collecte par source activée et par période réglée (référence consommée avant l'inscription, aucune rafale).
      Module contrôlé par l'appelant ; flux fermé : rien. Purge des annonces anciennes et du journal. */
  async planifier(maintenant = new Date()): Promise<string[]> {
    if (!(await this.flux.ouvert(FLUX))) return [];
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      const etats = await k
        .selectFrom('vulnerabilites_veille_annonces_sources')
        .select(['source', 'frequence_minutes', 'planifiee_le'])
        .where('activee', '=', true)
        .orderBy('source')
        .forUpdate()
        .execute();
      const ids: string[] = [];
      for (const e of etats) {
        const s = e.source as SourceAnnonce;
        const h = minutes(s, e.frequence_minutes) / 60;
        if (!echeanceAtteinte(e.planifiee_le, h, maintenant)) continue;
        await k
          .updateTable('vulnerabilites_veille_annonces_sources')
          .set({ planifiee_le: referenceApresDemande(e.planifiee_le, h, maintenant) })
          .where('source', '=', s)
          .execute();
        const attend = await k
          .selectFrom('vulnerabilites_veille_annonces_collectes')
          .select('id')
          .where('source', '=', s)
          .where('etat', 'in', ['en_file', 'en_cours'])
          .executeTakeFirst();
        if (attend) continue;
        // Aucune entrée au journal d'audit à la demande : la collecte y est inscrite une fois, à sa fin.
        const r = await k
          .insertInto('vulnerabilites_veille_annonces_collectes')
          .values({ source: s, origine: 'planifie', demande_par: PLANIFICATION.username })
          .returning('id')
          .executeTakeFirstOrThrow();
        ids.push(r.id);
      }
      return ids;
    });
  }

  /** Seule entrée du journal d'audit pour une collecte, à sa fin : source, état, nombres reçus, erreur (et, pour un
      mandataire sortant injoignable, le détail de l'exécutant). */
  private async journaliserFin(
    c: Client,
    l: { id: string; source: string; etat: string; elements: number; gardes: number; erreur: string | null },
    detail: { detail?: string } = {},
  ) {
    await this.db.audit(
      EXECUTANT,
      null,
      'vulnerabilites.annonces.collecte.terminee',
      l.id,
      {
        source: l.source,
        etat: l.etat,
        elements: l.elements,
        gardes: l.gardes,
        ...(l.erreur ? { erreur: l.erreur, ...detail } : {}),
      },
      c,
    );
  }

  private async menage(k: Kdb, c: Client) {
    const echouees = await k
      .updateTable('vulnerabilites_veille_annonces_collectes')
      .set({
        etat: 'expire',
        termine_le: sql<Date>`now()`,
        erreur: 'Collecte expirée : l’exécutant ne l’a pas prise en charge à temps.',
      })
      .where('etat', '=', 'en_file')
      .where('demande_le', '<', EXPIRATION_FILE)
      .returning(FIN)
      .execute();
    const interrompues = await k
      .updateTable('vulnerabilites_veille_annonces_collectes')
      .set({ etat: 'echec', termine_le: sql<Date>`now()`, erreur: 'Exécutant interrompu : aucun résultat reçu.' })
      .where('etat', '=', 'en_cours')
      .where('debute_le', '<', ABANDON_EN_COURS)
      .returning(FIN)
      .execute();
    for (const r of [...echouees, ...interrompues]) {
      await this.noterEchec(k, r.source as SourceAnnonce, r.erreur!);
      await this.journaliserFin(c, r);
    }
    const jours = sql<Date>`now() - make_interval(days => ${ANNONCES_BORNES.conservationJours})`;
    await k.deleteFrom('vulnerabilites_veille_annonces').where('maj_le', '<', jours).execute();
    await k
      .deleteFrom('vulnerabilites_veille_annonces_collectes')
      .where('etat', 'in', ['recu', 'echec', 'expire'])
      .where('demande_le', '<', jours)
      .execute();
  }

  private async noterEchec(k: Kdb, source: SourceAnnonce, erreur: string) {
    await k
      .insertInto('vulnerabilites_veille_annonces_sources')
      .values({ source, erreur, dernier_essai: sql<Date>`now()` })
      .onConflict((oc) => oc.column('source').doUpdateSet({ erreur, dernier_essai: sql<Date>`now()` }))
      .execute();
  }

  /* ---------------------------------------------------------------- CLI de l'exécutant */
  /** `suivi veille-annonces-claim` : la collecte en file la plus ancienne, ou rien. Module désactivé, flux fermé ou
      mandataire illisible : rien n'est remis, les collectes en file sont closes sans appel. Aucun paramètre : le filtre par
      produit surveillé est fait à la réception, ici. */
  async reclamer(moduleActif: boolean): Promise<Record<string, unknown> | null> {
    const ouvert = moduleActif && (await this.flux.ouvert(FLUX));
    const mandataire = ouvert ? await this.mandataire.pourExecutant() : null;
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      if (!ouvert || mandataire === 'illisible') {
        const closes = await k
          .updateTable('vulnerabilites_veille_annonces_collectes')
          .set({
            etat: 'echec',
            termine_le: sql<Date>`now()`,
            erreur: !ouvert
              ? 'Flux fermé ou module désactivé : la collecte n’a pas été transmise.'
              : 'Réglage du mandataire sortant illisible : la collecte n’a pas été transmise (Configuration système, Mandataire sortant).',
          })
          .where('etat', '=', 'en_file')
          .returning(FIN)
          .execute();
        for (const x of closes) {
          await this.noterEchec(k, x.source as SourceAnnonce, x.erreur!);
          await this.journaliserFin(c, x);
        }
        return null;
      }
      const r = await k
        .selectFrom('vulnerabilites_veille_annonces_collectes')
        .select(['id', 'source'])
        .where('etat', '=', 'en_file')
        .orderBy('demande_le')
        .orderBy('id')
        .limit(1)
        .forUpdate()
        .executeTakeFirst();
      if (!r) return null;
      await k
        .updateTable('vulnerabilites_veille_annonces_collectes')
        .set({ etat: 'en_cours', debute_le: sql<Date>`now()` })
        .where('id', '=', r.id)
        .execute();
      await k
        .insertInto('vulnerabilites_veille_annonces_sources')
        .values({ source: r.source, dernier_essai: sql<Date>`now()` })
        .onConflict((oc) => oc.column('source').doUpdateSet({ dernier_essai: sql<Date>`now()` }))
        .execute();
      // Aucune entrée au journal d'audit à la réclamation : la collecte y est inscrite une fois, à sa fin.
      return { id: r.id, source: r.source, parametres: {}, ...(mandataire ? { mandataire } : {}) };
    });
  }

  /** `suivi veille-annonces-lot <id>` : un lot d'éléments d'une collecte en cours ; un élément refusé fait refuser tout le
      lot. Préavis : seuls les CVE critiques et ceux qui citent un produit surveillé sont rangés. */
  async lot(id: string, brut: unknown): Promise<{ elements: number; gardes: number; lots: number }> {
    z.uuid().parse(id);
    const { elements } = LotVeille.parse(brut);
    return this.db.tx(async (_c, k) => {
      const cur = await k
        .selectFrom('vulnerabilites_veille_annonces_collectes')
        .select(['source', 'lots'])
        .where('id', '=', id)
        .where('etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!cur) throw new HttpError(409, 'Collecte absente ou déjà terminée.');
      if (cur.lots >= VEILLE_BORNES.lots) throw new HttpError(409, 'Nombre de lots dépassé pour cette collecte.');
      const source = cur.source as SourceAnnonce;
      const schema = ELEMENT_ANNONCE[source];
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
      const gardes =
        source === 'cloudflare-radar'
          ? await this.rangerPreavis(k, valides as ElementPreavis[])
          : await this.rangerTldrcve(k, valides as ElementTldrcve[]);
      const r = await k
        .updateTable('vulnerabilites_veille_annonces_collectes')
        .set((eb) => ({
          lots: eb('lots', '+', 1),
          elements: eb('elements', '+', valides.length),
          gardes: eb('gardes', '+', gardes),
        }))
        .where('id', '=', id)
        .returning(['lots', 'elements', 'gardes'])
        .executeTakeFirstOrThrow();
      return { elements: r.elements, gardes: r.gardes, lots: r.lots };
    });
  }

  private async rangerPreavis(k: Kdb, el: ElementPreavis[]): Promise<number> {
    const noms = (await k.selectFrom('vulnerabilites_produits').select('nom').execute()).map((p) => p.nom);
    const lignes = dernierParCle(el, (e) => e.identifiant).flatMap((e) => {
      const r = retenirPreavis(e, noms);
      return r.garder
        ? [
            {
              source: 'cloudflare-radar',
              identifiant: e.identifiant,
              cves: [e.cve],
              titre: e.titre,
              resume: e.resume,
              lien: e.lien,
              publie_le: e.publieLe,
              gravite: e.gravite,
              score: e.score,
              version_cvss: e.versionCvss,
              kev: e.kev,
              critique: r.critique,
              produits_cites: r.produits,
            },
          ]
        : [];
    });
    if (lignes.length) await this.upsert(k, lignes);
    return lignes.length;
  }

  private async rangerTldrcve(k: Kdb, el: ElementTldrcve[]): Promise<number> {
    const lignes = dernierParCle(el, (e) => e.identifiant).map((e) => ({
      source: 'tldrcve',
      identifiant: e.identifiant,
      cves: e.cves,
      titre: e.titre,
      resume: e.resume,
      lien: e.lien,
      publie_le: e.publieLe,
      nature: e.nature,
      verdict: e.verdict,
      verdict_texte: e.verdictTexte,
    }));
    if (lignes.length) await this.upsert(k, lignes);
    return lignes.length;
  }

  private async upsert(k: Kdb, lignes: Record<string, unknown>[]) {
    await k
      .insertInto('vulnerabilites_veille_annonces')
      .values(lignes as never)
      .onConflict((oc) =>
        oc.columns(['source', 'identifiant']).doUpdateSet((eb) => ({
          cves: eb.ref('excluded.cves'),
          titre: eb.ref('excluded.titre'),
          resume: eb.ref('excluded.resume'),
          lien: eb.ref('excluded.lien'),
          publie_le: eb.ref('excluded.publie_le'),
          gravite: eb.ref('excluded.gravite'),
          score: eb.ref('excluded.score'),
          version_cvss: eb.ref('excluded.version_cvss'),
          kev: eb.ref('excluded.kev'),
          critique: eb.ref('excluded.critique'),
          produits_cites: eb.ref('excluded.produits_cites'),
          nature: eb.ref('excluded.nature'),
          verdict: eb.ref('excluded.verdict'),
          verdict_texte: eb.ref('excluded.verdict_texte'),
          maj_le: sql<Date>`now()`,
        })),
      )
      .execute();
  }

  /** `suivi veille-annonces-finish <id>` : clôt la collecte ; un bilan qui ne correspond pas aux éléments reçus est consigné
      en échec. Aucune notification ni alerte, quelle que soit l'annonce. */
  async terminer(id: string, rapport: unknown): Promise<void> {
    z.uuid().parse(id);
    const p = RapportCollecte.parse(rapport);
    await this.db.tx(async (c, k) => {
      const cur = await k
        .selectFrom('vulnerabilites_veille_annonces_collectes')
        .select(['source', 'elements', 'gardes', 'lots'])
        .where('id', '=', id)
        .where('etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!cur) throw new HttpError(409, 'Collecte absente ou déjà terminée.');
      const source = cur.source as SourceAnnonce;
      let erreur = p.erreur;
      if (p.ok && p.bilan!.elements !== cur.elements)
        erreur = `Bilan incohérent : ${p.bilan!.elements} élément(s) annoncé(s), ${cur.elements} reçu(s).`;
      const ok = p.ok && erreur === null;
      await k
        .updateTable('vulnerabilites_veille_annonces_collectes')
        .set({
          etat: ok ? 'recu' : 'echec',
          termine_le: sql<Date>`now()`,
          ecartes: p.bilan?.ecartes ?? 0,
          tronque: p.bilan?.tronque ?? false,
          erreur: ok ? null : erreur,
        })
        .where('id', '=', id)
        .execute();
      if (ok)
        await k
          .insertInto('vulnerabilites_veille_annonces_sources')
          .values({ source, derniere_reussite: sql<Date>`now()`, dernier_essai: sql<Date>`now()`, erreur: null })
          .onConflict((oc) => oc.column('source').doUpdateSet({ derniere_reussite: sql<Date>`now()`, erreur: null }))
          .execute();
      else await this.noterEchec(k, source, erreur!);
      // Mandataire sortant injoignable (décision du RSSI du 23/11/2026) : hôte et port au seul journal d'audit.
      await this.journaliserFin(
        c,
        {
          id,
          source,
          etat: ok ? 'recu' : 'echec',
          elements: cur.elements,
          gardes: cur.gardes,
          erreur: ok ? null : erreur,
        },
        detailMandataire(p),
      );
    });
  }

  /* ---------------------------------------------------------------- Lecture (vulnerabilites:lire) */
  /** Annonces d'une source, les plus récentes d'abord. Préavis : seulement ceux qui ne sont pas remplacés. Chaque CVE citée
      porte les faits de la plateforme, lus en quelques requêtes d'ensemble pour toute la page. */
  async liste(q: RechercheAnnonces): Promise<PageAnnoncesDto> {
    const base = annoncesDeLaSource(this.db.k, q.source);
    const { n } = await base.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
    const lignes = await base
      .selectAll('a')
      .orderBy(sql`a.publie_le DESC NULLS LAST`)
      .orderBy('a.id')
      .limit(ANNONCES_PAR_PAGE)
      .offset((q.page - 1) * ANNONCES_PAR_PAGE)
      .execute();
    const faits = await this.faits([...new Set(lignes.flatMap((l) => l.cves))]);
    return {
      total: n,
      page: q.page,
      parPage: ANNONCES_PAR_PAGE,
      elements: lignes.map((l): AnnonceDto => ({
        id: l.id,
        source: l.source as SourceAnnonce,
        titre: l.titre,
        resume: l.resume,
        lien: l.lien,
        publieLe: iso(l.publie_le),
        vuLe: l.vu_le.toISOString(),
        cves: l.cves,
        gravite: l.gravite as AnnonceDto['gravite'],
        score: l.score === null ? null : Number(l.score),
        versionCvss: l.version_cvss,
        kevAnnonce: l.kev,
        critique: l.critique,
        produitsCites: l.produits_cites,
        nature: l.nature as AnnonceDto['nature'],
        verdict: l.verdict as AnnonceDto['verdict'],
        verdictTexte: l.verdict_texte,
        faits: l.cves.map((c) => faits.get(c)!),
      })),
    };
  }

  /** Faits de la plateforme pour des CVE (les mêmes pour tout le monde, sans nom ni nombre). */
  async faits(cves: readonly string[]): Promise<Map<string, FaitsAnnonceCve>> {
    const out = new Map<string, FaitsAnnonceCve>();
    if (!cves.length) return out;
    const { rows } = await sql<{
      cve: string;
      exploitee: boolean;
      kev: boolean;
      epss: string | null;
      produit: boolean;
    }>`
      WITH x AS (SELECT DISTINCT unnest(${[...cves]}::text[]) AS cve),
      e AS MATERIALIZED (${cvesExploitees})
      SELECT x.cve, EXISTS (SELECT 1 FROM e WHERE e.cve = x.cve) AS exploitee,
        coalesce(v.kev_ajout IS NOT NULL, false) AS kev, v.epss_score AS epss,
        EXISTS (SELECT 1 FROM vulnerabilites_rapprochements r WHERE r.cve = x.cve
          AND r.statut IN ('proposee', 'rattachee', 'confirmee')) AS produit
      FROM x LEFT JOIN vulnerabilites_veille_cve v ON v.cve = x.cve`.execute(this.db.k);
    const presentes = this.veille ? await this.veille.cvesPresentes(cves) : new Set<string>();
    const exposees = this.surface ? await this.surface.cvesExposees(cves) : new Set<string>();
    for (const r of rows)
      out.set(r.cve, {
        cve: r.cve,
        exploitee: r.exploitee,
        kev: r.kev,
        epss: r.epss === null ? null : Number(r.epss),
        presente: presentes.has(r.cve),
        exposee: exposees.has(r.cve),
        produitSurveille: r.produit,
      });
    return out;
  }
}

/** Annonces d'une source montrées par l'écran « Veille » : préavis non remplacés (anti-jointures servies par l'index GIN des
    avis, cve-inconnue.ts), tous les résumés de tldrcve. Exportée pour la vérification du plan par EXPLAIN. */
export function annoncesDeLaSource(k: Kdb, source: SourceAnnonce) {
  const base = k.selectFrom('vulnerabilites_veille_annonces as a').where('a.source', '=', source);
  return source === 'cloudflare-radar' ? base.where(nonRemplacee(sql`a.cves[1]`)) : base;
}

function dernierParCle<T>(elements: T[], cle: (e: T) => string): T[] {
  return [...new Map(elements.map((e) => [cle(e), e])).values()];
}
