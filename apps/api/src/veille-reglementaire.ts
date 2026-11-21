/* Veille réglementaire (ADR 0110, lot VR-1). Même mécanique que la veille des vulnérabilités (vulnerabilites/veille.ts,
   ADR 0100) : l'API n'a aucun accès sortant (ADR 0014) ; elle inscrit une collecte « en file » (planification à la fréquence
   de la source, ou « Collecter maintenant ») ; l'exécutant d'exploitation la réclame par la CLI
   (`suivi veille-reglementaire-claim`), lance le script isolé scripts/veille-vulnerabilites.py, rapporte les publications
   par lots (`suivi veille-reglementaire-lot`) puis termine (`suivi veille-reglementaire-finish`). Les tables sont propres au
   module : la file de la veille des vulnérabilités n'est pas touchée (sa fermeture ne ferme pas celle-ci, et inversement).
   - Flux « veille-reglementaire » (ADR 0097), fermé par défaut, ouvert par « Activer la veille réglementaire » (route commune
     des flux, administrateur, validation explicite), refermé par la désactivation du module. Flux fermé ou module désactivé :
     rien n'est inscrit ni réclamé ; une collecte en file est close sans appel.
   - Chaque source est activée à part (désactivée par défaut) et réglée en fréquence (liste fermée, vingt-quatre heures par
     défaut) ; règle de planification commune (frequences-synchronisation.ts).
   - EUR-Lex (décision du RSSI du 20/11/2026) : le flux publie tous les actes du Journal officiel. La liste des mots-clés en
     vigueur (réglée, sinon MOTS_CLES_EURLEX_DEFAUT) part avec la collecte ; le script ne remonte que les actes dont le titre
     en contient un (les autres sont comptés comme écartés) ; l'API recalcule le domaine de chaque acte sur la liste en
     vigueur (données personnelles l'emporte si les deux domaines sont trouvés) et ne range pas un acte qui n'en contient
     plus aucun. Réglage avec `administrer`, If-Match sur la version de la source, journal
     `veille_reglementaire.mots_cles.regles`.
   - Qualification : « à qualifier » à l'arrivée, puis « sans objet », « à suivre » ou « impactant », par le rôle qui tient le
     domaine de la publication (rôle RSSI pour la sécurité ; droit réservé `veille_reglementaire:dpo` pour les données
     personnelles, donné à aucun rôle prédéfini), If-Match sur
     la version, journal `veille_reglementaire.publication.qualifiee`. Aucune suite n'est écrite (référentiels, actions,
     documents) : hors de cette tranche.
   Droits contrôlés par route() (lire, administrer) ; journal `veille_reglementaire.*` sans contenu de source. Accès aux
   données en Kysely (ADR 0062). */
import {
  type CollecteReglementaireDto,
  type CompteursQualificationDto,
  type DomaineReglementaire,
  domaineSelonMotsCles,
  type DroitsVeilleReglementaireDto,
  echeanceAtteinte,
  elementPublication,
  type ElementPublication,
  estSourceCollectee,
  type EtatSourceReglementaireDto,
  type EtatVeilleReglementaireDto,
  FREQUENCE_VEILLE_REGLEMENTAIRE_DEFAUT,
  FREQUENCES_VEILLE_REGLEMENTAIRE,
  frequenceReglementaireAdmise,
  LotVeille,
  MotCleEurLex,
  MOTS_CLES_EURLEX_DEFAUT,
  type PagePublicationsDto,
  prochaineAffichee,
  type PublicationReglementaireDto,
  RapportCollecte,
  type RecherchePublications,
  referenceApresDemande,
  type ReglageSourceReglementaire,
  DROIT_DPO,
  QUALIFICATION_SECURITE_ROLE,
  sourceReglementaire,
  type SourceReglementaire,
  type SourceReglementaireCollectee,
  SOURCES_REGLEMENTAIRES_COLLECTEES,
  SOURCES_REGLEMENTAIRES_DEFINITIONS,
  type StatutQualifie,
  type SyntheseVeilleReglementaireDto,
  VEILLE_BORNES,
  VEILLE_REGLEMENTAIRE_PAR_PAGE,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import type { Actor, Client, Db, Kdb } from './db/db.js';
import type { VeilleReglementaireCollectes } from './db/types.generated.js';
import type { FluxExternes } from './flux-externes.js';
import { conflict } from './http/concurrency.js';
import { HttpError } from './http/errors.js';
import type { Mandataire } from './mandataire.js';
import { loadGrants } from './rights.js';

type LigneCollecte = Selectable<VeilleReglementaireCollectes>;

export const MODULE_VEILLE_REGLEMENTAIRE = 'veille_reglementaire' as const;
const FLUX = 'veille-reglementaire' as const;
/** Verrou consultatif de la file (727279 : veille des vulnérabilités). */
const verrouFile = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727280)`.execute(k);
const EXPIRATION_FILE = sql<Date>`now() - interval '30 minutes'`;
const ABANDON_EN_COURS = sql<Date>`now() - interval '20 minutes'`;
const INTERVALLE_MANUEL = sql<Date>`now() - interval '15 minutes'`;
/** Une source activée est « en retard » sans réussite depuis trois périodes (décision du RSSI du 20/11/2026, point 7). */
const PERIODES_RETARD = 3;
const EXECUTANT = { username: 'exécutant serveur' };
const PLANIFICATION = { username: 'planification' };
const SUITES_VIDES = { exigences: 0, actions: 0, documents: 0 } as const;

/** Liste des mots-clés d'EUR-Lex rangée en base (validée à l'écriture) ; illisible ou absente : liste par défaut. */
function motsClesEnVigueur(brut: unknown): { liste: MotCleEurLex[]; parDefaut: boolean } {
  const l = z.array(MotCleEurLex).min(1).safeParse(brut);
  return l.success && brut !== null
    ? { liste: l.data, parDefaut: false }
    : { liste: [...MOTS_CLES_EURLEX_DEFAUT], parDefaut: true };
}

const versCollecte = (r: LigneCollecte): CollecteReglementaireDto => ({
  id: r.id,
  source: r.source,
  origine: r.origine,
  etat: r.etat,
  demandeLe: r.demande_le.toISOString(),
  termineLe: r.termine_le?.toISOString() ?? null,
  elements: r.elements,
  tronque: r.tronque,
  erreur: r.erreur,
});

/** Motif ILIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const frequence = (reglee: number | null | undefined) => reglee ?? FREQUENCE_VEILLE_REGLEMENTAIRE_DEFAUT;
const compteurs = (): CompteursQualificationDto => ({ aQualifier: 0, aSuivre: 0, impactant: 0, sansObjet: 0 });
const CLE_STATUT = {
  'a-qualifier': 'aQualifier',
  'a-suivre': 'aSuivre',
  impactant: 'impactant',
  'sans-objet': 'sansObjet',
} as const;

export class VeilleReglementaire {
  constructor(
    private readonly db: Db,
    private readonly flux: FluxExternes,
    private readonly mandataire: Mandataire,
  ) {}

  /* ---------------------------------------------------------------- Droits de qualification */
  /** La personne peut-elle qualifier ce domaine ? Sécurité : elle tient le rôle RSSI (directement ou par un groupe, sans
      portée qui écarte le module), relu à chaque appel. Données personnelles : elle a le droit réservé « DPO » dans ses
      droits de la requête (relus à chaque requête, module désactivé : retiré). */
  async peutQualifier(user: SessionUser, domaine: DomaineReglementaire, c?: Client): Promise<boolean> {
    if (domaine === 'donnees-personnelles') return user.rights.has(DROIT_DPO);
    return (await loadGrants(c ?? this.db.pool, user.id)).some(
      (g) =>
        g.roleId === QUALIFICATION_SECURITE_ROLE &&
        (g.modules == null || g.modules.includes(MODULE_VEILLE_REGLEMENTAIRE)),
    );
  }

  async droits(user: SessionUser): Promise<DroitsVeilleReglementaireDto> {
    return {
      administrer: user.rights.can(MODULE_VEILLE_REGLEMENTAIRE, 'administrer'),
      qualifier: {
        securite: await this.peutQualifier(user, 'securite'),
        donneesPersonnelles: await this.peutQualifier(user, 'donnees-personnelles'),
      },
    };
  }

  /* ---------------------------------------------------------------- Lecture (veille_reglementaire:lire) */
  async synthese(): Promise<SyntheseVeilleReglementaireDto> {
    const lignes = await this.db.k
      .selectFrom('veille_reglementaire_publications')
      .select(['domaine', 'statut', sql<number>`count(*)::int`.as('n')])
      .groupBy(['domaine', 'statut'])
      .execute();
    const total = compteurs();
    const parDomaine = { securite: compteurs(), donneesPersonnelles: compteurs() };
    for (const l of lignes) {
      const cle = CLE_STATUT[l.statut];
      total[cle] += l.n;
      parDomaine[l.domaine === 'securite' ? 'securite' : 'donneesPersonnelles'][cle] += l.n;
    }
    const s = await this.db.k
      .selectFrom('veille_reglementaire_sources')
      .select([
        sql<Date | null>`max(derniere_reussite)`.as('derniere'),
        sql<number>`count(*) FILTER (WHERE activee AND erreur IS NOT NULL)::int`.as('erreurs'),
      ])
      .executeTakeFirstOrThrow();
    return {
      ...total,
      parDomaine,
      derniereCollecteLe: s.derniere?.toISOString() ?? null,
      sourcesEnErreur: s.erreurs,
    };
  }

  /** Publications, les plus récentes d'abord ; filtres par statut, domaine, source ; recherche dans le titre et le résumé. */
  async publications(q: RecherchePublications): Promise<PagePublicationsDto> {
    let base = this.db.k.selectFrom('veille_reglementaire_publications as p');
    if (q.statut) base = base.where('p.statut', '=', q.statut);
    if (q.domaine) base = base.where('p.domaine', '=', q.domaine);
    if (q.source) base = base.where('p.source', '=', q.source);
    const texte = q.q?.trim();
    if (texte) {
      const motif = `%${litteral(texte)}%`;
      base = base.where((eb) => eb.or([eb('p.titre', 'ilike', motif), eb('p.resume', 'ilike', motif)]));
    }
    const { n } = await base.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
    const lignes = await base
      .leftJoin('users as u', 'u.id', 'p.qualifie_par')
      .selectAll('p')
      .select(['u.id as qp_id', 'u.username as qp_username', 'u.display_name as qp_nom'])
      .orderBy('p.publie_le', 'desc')
      .orderBy('p.id', 'desc')
      .limit(VEILLE_REGLEMENTAIRE_PAR_PAGE)
      .offset((q.page - 1) * VEILLE_REGLEMENTAIRE_PAR_PAGE)
      .execute();
    return {
      elements: lignes.map((l): PublicationReglementaireDto => ({
        id: l.id,
        source: l.source,
        domaine: l.domaine,
        titre: l.titre,
        resume: l.resume,
        lien: l.lien,
        publieLe: l.publie_le.toISOString(),
        collecteLe: l.collecte_le.toISOString(),
        statut: l.statut,
        qualifieLe: l.qualifie_le?.toISOString() ?? null,
        qualifiePar: l.qp_id ? { id: l.qp_id, nom: l.qp_nom || l.qp_username! } : null,
        suites: { ...SUITES_VIDES },
        version: l.version,
      })),
      total: n,
      page: q.page,
      parPage: VEILLE_REGLEMENTAIRE_PAR_PAGE,
    };
  }

  async publication(id: string): Promise<PublicationReglementaireDto> {
    const l = await this.db.k
      .selectFrom('veille_reglementaire_publications as p')
      .leftJoin('users as u', 'u.id', 'p.qualifie_par')
      .selectAll('p')
      .select(['u.id as qp_id', 'u.username as qp_username', 'u.display_name as qp_nom'])
      .where('p.id', '=', id)
      .executeTakeFirst();
    if (!l) throw new HttpError(404, 'Publication introuvable.');
    return {
      id: l.id,
      source: l.source,
      domaine: l.domaine,
      titre: l.titre,
      resume: l.resume,
      lien: l.lien,
      publieLe: l.publie_le.toISOString(),
      collecteLe: l.collecte_le.toISOString(),
      statut: l.statut,
      qualifieLe: l.qualifie_le?.toISOString() ?? null,
      qualifiePar: l.qp_id ? { id: l.qp_id, nom: l.qp_nom || l.qp_username! } : null,
      suites: { ...SUITES_VIDES },
      version: l.version,
    };
  }

  /** État de chaque source, du flux, de l'exécutant et du mandataire (comme l'écran Veille des vulnérabilités). */
  async etat(): Promise<EtatVeilleReglementaireDto> {
    const flux = await this.flux.lire(FLUX);
    const lignes = new Map(
      (await this.db.k.selectFrom('veille_reglementaire_sources').selectAll().execute()).map((l) => [l.source, l]),
    );
    const dernieres = new Map(
      (
        await this.db.k
          .selectFrom('veille_reglementaire_collectes')
          .selectAll()
          .distinctOn('source')
          .orderBy('source')
          .orderBy('demande_le', 'desc')
          .orderBy('id')
          .execute()
      ).map((c) => [c.source as SourceReglementaire, versCollecte(c)]),
    );
    const maintenant = new Date();
    return {
      flux: { ouvert: flux.ouvert, applique: flux.applique },
      executant: { disponible: await this.executantDisponible() },
      mandataire: { actif: await this.mandataire.actif() },
      sources: SOURCES_REGLEMENTAIRES_DEFINITIONS.map((d): EtatSourceReglementaireDto => {
        const l = lignes.get(d.id);
        const activee = !!l?.activee;
        const f = frequence(l?.frequence_heures);
        const reussite = l?.derniere_reussite ?? null;
        const limite = maintenant.getTime() - PERIODES_RETARD * f * 3_600_000;
        return {
          source: d.id,
          libelle: d.libelle,
          organisme: d.organisme,
          hote: d.hote,
          domaine: d.domaine,
          langue: d.langue,
          reprise: d.reprise,
          collecteur: estSourceCollectee(d.id),
          activee,
          frequenceHeures: f,
          derniereReussite: reussite?.toISOString() ?? null,
          dernierEssai: l?.dernier_essai?.toISOString() ?? null,
          erreur: l?.erreur ?? null,
          enErreur: activee && !!l?.erreur,
          enRetard: activee && flux.ouvert && (!reussite || reussite.getTime() < limite),
          motsCles: d.id === 'eur-lex' ? motsClesEnVigueur(l?.mots_cles ?? null) : null,
          derniereCollecte: dernieres.get(d.id) ?? null,
          prochaineCollecte:
            activee && flux.ouvert ? prochaineAffichee(l?.planifiee_le ?? null, f, maintenant).toISOString() : null,
          version: l?.version ?? 1,
        };
      }),
    };
  }

  /* ---------------------------------------------------------------- Qualification (rôle du domaine) */
  async qualifier(
    id: string,
    statut: StatutQualifie,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<PublicationReglementaireDto> {
    await this.db.tx(async (c, k) => {
      const p = await k
        .selectFrom('veille_reglementaire_publications')
        .select(['id', 'source', 'domaine', 'statut', 'version'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!p) throw new HttpError(404, 'Publication introuvable.');
      if (!(await this.peutQualifier(user, p.domaine, c)))
        throw new HttpError(
          403,
          p.domaine === 'securite'
            ? 'Seul le rôle RSSI qualifie les publications du domaine sécurité.'
            : 'Seul le droit « DPO » qualifie les publications du domaine données personnelles.',
          { reason: 'role_qualification', domaine: p.domaine },
        );
      if (p.version !== attendue) throw conflict({ version: p.version, statut: p.statut });
      await k
        .updateTable('veille_reglementaire_publications')
        .set((eb) => ({
          statut,
          qualifie_le: sql<Date>`now()`,
          qualifie_par: user.id,
          version: eb('version', '+', 1),
        }))
        .where('id', '=', id)
        .execute();
      await this.db.audit(
        user,
        ip,
        'veille_reglementaire.publication.qualifiee',
        id,
        { source: p.source, domaine: p.domaine, avant: p.statut, apres: statut },
        c,
      );
    }, user.username);
    return this.publication(id);
  }

  /* ---------------------------------------------------------------- Réglage d'une source (administrer) */
  async reglerSource(
    source: SourceReglementaire,
    r: ReglageSourceReglementaire,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<EtatSourceReglementaireDto> {
    if (r.activee && !estSourceCollectee(source))
      throw new HttpError(422, `La source « ${sourceReglementaire(source).libelle} » n’a pas encore de collecteur.`);
    if (r.frequenceHeures !== undefined && !frequenceReglementaireAdmise(r.frequenceHeures))
      throw new HttpError(422, `Fréquence refusée : ${FREQUENCES_VEILLE_REGLEMENTAIRE.join(', ')} heures seulement.`);
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('veille_reglementaire_sources')
        .values({ source })
        .onConflict((oc) => oc.column('source').doNothing())
        .execute();
      const avant = await k
        .selectFrom('veille_reglementaire_sources')
        .select(['activee', 'frequence_heures', 'version'])
        .where('source', '=', source)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (avant.version !== attendue)
        throw conflict({
          version: avant.version,
          activee: avant.activee,
          frequenceHeures: frequence(avant.frequence_heures),
        });
      const apres = {
        activee: r.activee ?? avant.activee,
        frequenceHeures: r.frequenceHeures ?? frequence(avant.frequence_heures),
      };
      await k
        .updateTable('veille_reglementaire_sources')
        .set((eb) => ({
          activee: apres.activee,
          frequence_heures: apres.frequenceHeures,
          version: eb('version', '+', 1),
        }))
        .where('source', '=', source)
        .execute();
      await this.db.audit(
        user,
        ip,
        'veille_reglementaire.source.reglee',
        source,
        {
          source,
          avant: { activee: avant.activee, frequenceHeures: frequence(avant.frequence_heures) },
          apres,
        },
        c,
      );
    }, user.username);
    return (await this.etat()).sources.find((s) => s.source === source)!;
  }

  /* ---------------------------------------------------------------- Mots-clés d'EUR-Lex (administrer) */
  /** Règle la liste des mots-clés du filtre d'EUR-Lex (`null` : liste par défaut). If-Match sur la version de la source ;
      journal avec la liste avant et après (mots publics, sans donnée de la plateforme). */
  async reglerMotsCles(
    source: SourceReglementaire,
    motsCles: MotCleEurLex[] | null,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<EtatSourceReglementaireDto> {
    if (source !== 'eur-lex') throw new HttpError(422, 'Seul le flux d’EUR-Lex est filtré par mots-clés.');
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('veille_reglementaire_sources')
        .values({ source })
        .onConflict((oc) => oc.column('source').doNothing())
        .execute();
      const avant = await k
        .selectFrom('veille_reglementaire_sources')
        .select(['mots_cles', 'version'])
        .where('source', '=', source)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (avant.version !== attendue) throw conflict({ version: avant.version });
      await k
        .updateTable('veille_reglementaire_sources')
        .set((eb) => ({
          mots_cles: motsCles === null ? null : JSON.stringify(motsCles),
          version: eb('version', '+', 1),
        }))
        .where('source', '=', source)
        .execute();
      const ancienne = motsClesEnVigueur(avant.mots_cles);
      const nouvelle = motsClesEnVigueur(motsCles);
      await this.db.audit(
        user,
        ip,
        'veille_reglementaire.mots_cles.regles',
        source,
        {
          source,
          avant: { parDefaut: ancienne.parDefaut, motsCles: ancienne.liste },
          apres: { parDefaut: nouvelle.parDefaut, motsCles: nouvelle.liste },
        },
        c,
      );
    }, user.username);
    return (await this.etat()).sources.find((s) => s.source === source)!;
  }

  /* ---------------------------------------------------------------- Collecte manuelle (administrer) */
  async demander(
    source: SourceReglementaire | undefined,
    user: Actor,
    ip: string,
  ): Promise<CollecteReglementaireDto[]> {
    await this.flux.exiger(FLUX);
    if (!(await this.executantDisponible()))
      throw new HttpError(
        503,
        'L’exécutant d’exploitation du serveur n’est pas disponible : c’est lui qui lit les sources (guide d’installation, étape 11.6).',
      );
    if (source && !estSourceCollectee(source))
      throw new HttpError(422, `La source « ${sourceReglementaire(source).libelle} » n’a pas encore de collecteur.`);
    const crees = await this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      const activees = new Set(
        (await k.selectFrom('veille_reglementaire_sources').select('source').where('activee', '=', true).execute()).map(
          (l) => l.source,
        ),
      );
      const voulues = (source ? [source] : [...SOURCES_REGLEMENTAIRES_COLLECTEES]).filter(
        (s): s is SourceReglementaireCollectee => estSourceCollectee(s) && activees.has(s),
      );
      if (!voulues.length) throw new HttpError(409, 'Aucune source activée : activez la source avant de la collecter.');
      const out: LigneCollecte[] = [];
      for (const s of voulues) {
        const occupee = await k
          .selectFrom('veille_reglementaire_collectes')
          .select('id')
          .where('source', '=', s)
          .where((eb) =>
            eb.or([
              eb('etat', 'in', ['en_file', 'en_cours']),
              eb.and([eb('origine', '=', 'manuel'), eb('demande_le', '>', INTERVALLE_MANUEL)]),
            ]),
          )
          .executeTakeFirst();
        if (!occupee) out.push(await this.inscrire(k, c, s, 'manuel', user, ip));
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
  /** Au plus une collecte par source activée et par période réglée, comptée depuis la dernière demande automatique
      (référence consommée avant l'inscription). Module contrôlé par l'appelant ; flux fermé : rien. */
  async planifier(maintenant = new Date()): Promise<string[]> {
    if (!(await this.flux.ouvert(FLUX))) return [];
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      const etats = await k
        .selectFrom('veille_reglementaire_sources')
        .select(['source', 'frequence_heures', 'planifiee_le'])
        .where('activee', '=', true)
        .orderBy('source')
        .forUpdate()
        .execute();
      const ids: string[] = [];
      for (const e of etats) {
        if (!estSourceCollectee(e.source)) continue;
        const f = frequence(e.frequence_heures);
        if (!echeanceAtteinte(e.planifiee_le, f, maintenant)) continue;
        await k
          .updateTable('veille_reglementaire_sources')
          .set({ planifiee_le: referenceApresDemande(e.planifiee_le, f, maintenant) })
          .where('source', '=', e.source)
          .execute();
        const attend = await k
          .selectFrom('veille_reglementaire_collectes')
          .select('id')
          .where('source', '=', e.source)
          .where('etat', 'in', ['en_file', 'en_cours'])
          .executeTakeFirst();
        if (!attend) ids.push((await this.inscrire(k, c, e.source, 'planifie', PLANIFICATION, null)).id);
      }
      return ids;
    });
  }

  private async inscrire(
    k: Kdb,
    c: Client,
    source: SourceReglementaireCollectee,
    origine: 'manuel' | 'planifie',
    acteur: Actor,
    ip: string | null,
  ): Promise<LigneCollecte> {
    const r = await k
      .insertInto('veille_reglementaire_collectes')
      .values({ source, origine, demande_par: acteur.username })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.db.audit(acteur, ip, 'veille_reglementaire.collecte.demandee', r.id, { source, origine }, c);
    return r;
  }

  private async menage(k: Kdb, c: Client) {
    const expirees = await k
      .updateTable('veille_reglementaire_collectes')
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
      .updateTable('veille_reglementaire_collectes')
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
        'veille_reglementaire.collecte.terminee',
        r.id,
        { source: r.source, etat: expirees.includes(r) ? 'expire' : 'echec' },
        c,
      );
    }
  }

  private async noterEchec(k: Kdb, source: SourceReglementaire, erreur: string) {
    await k
      .insertInto('veille_reglementaire_sources')
      .values({ source, erreur, dernier_essai: sql<Date>`now()` })
      .onConflict((oc) => oc.column('source').doUpdateSet({ erreur, dernier_essai: sql<Date>`now()` }))
      .execute();
  }

  /* ---------------------------------------------------------------- CLI de l'exécutant */
  /** `suivi veille-reglementaire-claim` : réclame la collecte en file la plus ancienne. Module désactivé ou flux fermé :
      rien n'est remis, les collectes en file sont closes sans appel. Mandataire actif (ADR 0101) : ses paramètres sont
      joints (jamais au journal) ; réglage illisible : rien n'est remis plutôt que de sortir en direct. */
  async reclamer(moduleActif: boolean): Promise<Record<string, unknown> | null> {
    const ouvert = moduleActif && (await this.flux.ouvert(FLUX));
    const mandataire = ouvert ? await this.mandataire.pourExecutant() : null;
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      if (!ouvert || mandataire === 'illisible') {
        const closes = await k
          .updateTable('veille_reglementaire_collectes')
          .set({
            etat: 'echec',
            termine_le: sql<Date>`now()`,
            erreur: !ouvert
              ? 'Flux fermé ou module désactivé : la collecte n’a pas été transmise.'
              : 'Réglage du mandataire sortant illisible : la collecte n’a pas été transmise (Configuration système, Mandataire sortant).',
          })
          .where('etat', '=', 'en_file')
          .returning(['id', 'source', 'erreur'])
          .execute();
        for (const x of closes) {
          await this.noterEchec(k, x.source, x.erreur!);
          await this.db.audit(
            EXECUTANT,
            null,
            'veille_reglementaire.collecte.terminee',
            x.id,
            { source: x.source, etat: 'echec' },
            c,
          );
        }
        return null;
      }
      const r = await k
        .selectFrom('veille_reglementaire_collectes')
        .selectAll()
        .where('etat', '=', 'en_file')
        .orderBy('demande_le')
        .orderBy('id')
        .limit(1)
        .forUpdate()
        .executeTakeFirst();
      if (!r) return null;
      await k
        .updateTable('veille_reglementaire_collectes')
        .set({ etat: 'en_cours', debute_le: sql<Date>`now()` })
        .where('id', '=', r.id)
        .execute();
      await k
        .insertInto('veille_reglementaire_sources')
        .values({ source: r.source, dernier_essai: sql<Date>`now()` })
        .onConflict((oc) => oc.column('source').doUpdateSet({ dernier_essai: sql<Date>`now()` }))
        .execute();
      await this.db.audit(EXECUTANT, null, 'veille_reglementaire.collecte.reclamee', r.id, { source: r.source }, c);
      // EUR-Lex : la liste des mots-clés en vigueur part avec la demande ; le script ne remonte que les actes qui en portent un.
      const parametres =
        r.source === 'eur-lex' ? { motsCles: await this.motsCles(k) } : ({} as Record<string, unknown>);
      return { id: r.id, source: r.source, parametres, ...(mandataire ? { mandataire } : {}) };
    });
  }

  /** `suivi veille-reglementaire-lot <id>` : range un lot de publications d'une collecte en cours ; un seul élément refusé
      fait refuser tout le lot (rien n'est écrit). */
  async lot(id: string, brut: unknown): Promise<{ elements: number; lots: number }> {
    z.uuid().parse(id);
    const { elements } = LotVeille.parse(brut);
    return this.db.tx(async (_c, k) => {
      const cur = await k
        .selectFrom('veille_reglementaire_collectes')
        .select(['source', 'lots', 'elements'])
        .where('id', '=', id)
        .where('etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!cur) throw new HttpError(409, 'Collecte absente ou déjà terminée.');
      if (cur.lots >= VEILLE_BORNES.lots) throw new HttpError(409, 'Nombre de lots dépassé pour cette collecte.');
      const schema = elementPublication(cur.source);
      const valides: ElementPublication[] = [];
      elements.forEach((e, i) => {
        const v = schema.safeParse(e);
        if (!v.success)
          throw new HttpError(
            422,
            `Élément ${i + 1} du lot refusé (${v.error.issues[0]?.message ?? 'forme inattendue'}).`,
          );
        valides.push(v.data);
      });
      await this.ranger(k, cur.source, valides, cur.source === 'eur-lex' ? await this.motsCles(k) : null);
      const r = await k
        .updateTable('veille_reglementaire_collectes')
        .set((eb) => ({ lots: eb('lots', '+', 1), elements: eb('elements', '+', valides.length) }))
        .where('id', '=', id)
        .returning(['lots', 'elements'])
        .executeTakeFirstOrThrow();
      return { elements: r.elements, lots: r.lots };
    });
  }

  /** `suivi veille-reglementaire-finish <id>` : clôt la collecte ; un bilan qui ne correspond pas aux éléments reçus est
      consigné en échec. */
  async terminer(id: string, rapport: unknown): Promise<CollecteReglementaireDto> {
    z.uuid().parse(id);
    const p = RapportCollecte.parse(rapport);
    const r = await this.db.tx(async (c, k) => {
      const cur = await k
        .selectFrom('veille_reglementaire_collectes')
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
        .updateTable('veille_reglementaire_collectes')
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
          .insertInto('veille_reglementaire_sources')
          .values({
            source: cur.source,
            derniere_reussite: sql<Date>`now()`,
            dernier_essai: sql<Date>`now()`,
            erreur: null,
          })
          .onConflict((oc) => oc.column('source').doUpdateSet({ derniere_reussite: sql<Date>`now()`, erreur: null }))
          .execute();
      else await this.noterEchec(k, cur.source, fin.erreur!);
      await this.db.audit(
        EXECUTANT,
        null,
        'veille_reglementaire.collecte.terminee',
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
    return versCollecte(r);
  }

  private async motsCles(k: Kdb): Promise<MotCleEurLex[]> {
    const l = await k
      .selectFrom('veille_reglementaire_sources')
      .select('mots_cles')
      .where('source', '=', 'eur-lex')
      .executeTakeFirst();
    return motsClesEnVigueur(l?.mots_cles ?? null).liste;
  }

  /** Publications sans doublon par (source, identifiant) : une collecte rejouée met à jour le texte, la date et le lien,
      jamais la qualification. EUR-Lex (`motsCles`) : domaine déduit du titre ; un acte sans mot-clé n'est pas rangé. */
  private async ranger(
    k: Kdb,
    source: SourceReglementaireCollectee,
    elements: ElementPublication[],
    motsCles: MotCleEurLex[] | null,
  ) {
    const parDefaut = sourceReglementaire(source).domaine;
    const uniques = [...new Map(elements.map((e) => [e.identifiant, e])).values()].flatMap((e) => {
      const domaine = motsCles ? domaineSelonMotsCles(e.titre, motsCles) : parDefaut;
      return domaine ? [{ ...e, domaine }] : [];
    });
    if (!uniques.length) return;
    await k
      .insertInto('veille_reglementaire_publications')
      .values(
        uniques.map((e) => ({
          source,
          domaine: e.domaine,
          identifiant: e.identifiant,
          titre: e.titre,
          resume: e.resume,
          lien: e.lien,
          publie_le: e.publieLe,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['source', 'identifiant']).doUpdateSet((eb) => ({
          titre: eb.ref('excluded.titre'),
          resume: eb.ref('excluded.resume'),
          lien: eb.ref('excluded.lien'),
          publie_le: eb.ref('excluded.publie_le'),
          maj_le: sql<Date>`now()`,
        })),
      )
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
