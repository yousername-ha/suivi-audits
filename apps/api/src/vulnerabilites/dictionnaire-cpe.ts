/* Module Vulnérabilités (ADR 0100, lot CPE-1 ; décisions du RSSI du 22/11/2026) : saisie assistée d'un produit surveillé par
   le dictionnaire CPE 2.3 de la NVD. L'API n'a aucun accès sortant (ADR 0014) : l'exécutant d'exploitation lit la NVD par
   le script isolé scripts/veille-vulnerabilites.py, sous le flux « veille-vulnerabilites » (fermé : rien ne part).
   - Liste des produits : chargée par tranches (une page par passage complet de l'exécutant, sans attente), curseur rangé ici
     (`vulnerabilites_cpe_dictionnaire`), une tranche remise à la fois (`suivi cpe-dictionnaire-claim | -lot | -finish`) ;
     puis les nouveautés à la fréquence réglée (fenêtre de dates de modification, 120 jours au plus, sinon rechargement).
     Seul le dédoublonné est rangé. Source désactivée au départ ; réglage avec `vulnerabilites:administrer`, If-Match.
   - Versions d'un produit choisi : copie complète si elle est faite ; sinon cache durable par produit (frais pendant un
     jour) ; sinon une demande dans une file dédiée (`suivi cpe-versions-claim | -finish`), une seule par produit, limitée
     par personne, purgée après sept jours. Versions déjà vues dans les CVE de la veille proposées aussitôt, marquées.
   - « Saisie en cours » (`saisie_le`) : notée à l'ouverture du formulaire et à chaque demande de versions ; la réclamation
     de l'exécutant rend `actif` (saisie de moins de deux minutes, ou demande en file) pour qu'il pose son témoin et que le
     poller enchaîne des passages courts. Aucune personne n'y est désignée.
   - Copie complète facultative (`administrer`) : un chargement complet qui range aussi les versions ; sa suppression vide
     la table. Journal : réglages, copie demandée et supprimée, fin et échec d'un chargement ; jamais de contenu de la NVD.
   Accès aux données en Kysely (ADR 0062). */
import { randomUUID } from 'node:crypto';
import {
  CPE_BORNES,
  echeanceAtteinte,
  type EtatDictionnaireCpeDto,
  type EtatSaisieCpeDto,
  frequenceDictionnaireCpe,
  frequenceDictionnaireCpeAdmise,
  FREQUENCES_DICTIONNAIRE_CPE,
  type IdentiteProduitCpe,
  LotDictionnaireCpe,
  normaliserRechercheCpe,
  prochaineAffichee,
  type ProduitCpeDto,
  RapportDictionnaireCpe,
  RapportVersionsCpe,
  referenceApresDemande,
  type ReglageDictionnaireCpe,
  SOURCE_DICTIONNAIRE_CPE,
  type SourceVersionCpe,
  trierVersionsCpe,
  type VersionsCpeDto,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import type { Actor, Db, Kdb } from '../db/db.js';
import type { VulnerabilitesCpeDictionnaire } from '../db/types.generated.js';
import type { FluxExternes } from '../flux-externes.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { Mandataire } from '../mandataire.js';

type Ligne = Selectable<VulnerabilitesCpeDictionnaire>;
const FLUX = 'veille-vulnerabilites' as const;
const EXECUTANT = { username: 'exécutant serveur' };
/** Verrou consultatif de la file des versions (727279 : veille, 727280 : veille réglementaire). */
const verrouFile = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727283)`.execute(k);
/** Tranche remise à l'exécutant et jamais close : reprise après ce délai. */
const TRANCHE_EXPIRATION_MS = 10 * 60_000;
/** Après un échec, la tranche suivante attend ce délai (pas de rafale vers la NVD). */
const REESSAI_APRES_ECHEC_MS = 15 * 60_000;
/** Demande de versions jamais réclamée : expirée après ce délai (la personne est partie) ; en cours sans fin : close. */
const DEMANDE_EXPIRATION = sql<Date>`now() - interval '10 minutes'`;
const DEMANDE_ABANDON = sql<Date>`now() - interval '2 minutes'`;
const SAISIE_ACTIVE = sql<Date>`now() - make_interval(mins => ${CPE_BORNES.saisieMinutes})`;
const CACHE_FRAIS = sql<Date>`now() - make_interval(hours => ${CPE_BORNES.cacheHeures})`;
const FENETRE_MAX_MS = CPE_BORNES.fenetreJours * 24 * 3_600_000;

export const MESSAGE_PRODUIT_INCONNU = 'Produit inconnu de la liste locale du dictionnaire CPE.';
const MESSAGE_SANS_NVD =
  'Les versions ne sont pas demandées à la NVD (source du dictionnaire désactivée ou veille inactive) : saisissez la version.';
const MESSAGE_AUCUNE = 'Aucune version connue pour ce produit : saisissez la version.';
const MESSAGE_FERME =
  'Flux fermé, module désactivé ou source du dictionnaire désactivée : la demande n’a pas été transmise.';
const MESSAGE_MANDATAIRE =
  'Réglage du mandataire sortant illisible : la demande n’a pas été transmise (Configuration système, Mandataire sortant).';

const memeProduit = (i: IdentiteProduitCpe) =>
  sql<boolean>`partie = ${i.partie} AND editeur = ${i.editeur} AND produit = ${i.produit}`;
const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
const enSecondes = (d: Date) => new Date(Math.floor(d.getTime() / 1000) * 1000);

export class DictionnaireCpe {
  constructor(
    private readonly db: Db,
    private readonly flux: FluxExternes,
    private readonly mandataire: Mandataire,
  ) {}

  /** Ligne unique de l'état, créée au besoin. */
  private async ligne(k: Kdb, verrou = false): Promise<Ligne> {
    await k
      .insertInto('vulnerabilites_cpe_dictionnaire')
      .values({ id: 1 })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
    let q = k.selectFrom('vulnerabilites_cpe_dictionnaire').selectAll().where('id', '=', 1);
    if (verrou) q = q.forUpdate();
    return q.executeTakeFirstOrThrow();
  }

  /* ---------------------------------------------------------------- Saisie (vulnerabilites:modifier) */
  /** Note la saisie en cours (fenêtre de deux minutes, renouvelée par l'activité). */
  private async noterSaisie(k: Kdb = this.db.k) {
    await k
      .insertInto('vulnerabilites_cpe_dictionnaire')
      .values({ id: 1, saisie_le: sql<Date>`now()` })
      .onConflict((oc) => oc.column('id').doUpdateSet({ saisie_le: sql<Date>`now()` }))
      .execute();
  }

  /** Ouverture du formulaire : note la saisie en cours, rend ce que le formulaire peut proposer. */
  async ouvrirSaisie(): Promise<EtatSaisieCpeDto> {
    await this.noterSaisie();
    const l = await this.ligne(this.db.k);
    const liste = await this.db.k
      .selectFrom('vulnerabilites_cpe_produits')
      .select('partie')
      .limit(1)
      .executeTakeFirst();
    return {
      listeChargee: !!liste,
      versionsDistantes: l.activee && (await this.flux.ouvert(FLUX)),
      copieComplete: l.copie_voulue && l.copie_complete_le !== null,
    };
  }

  /** Produits de la liste locale qui contiennent le terme (sans casse ni accent) : correspondance exacte du produit
      d'abord, puis produit qui commence par le terme, puis les plus courts ; 20 au plus. Aucun appel extérieur. */
  async rechercher(q: string): Promise<ProduitCpeDto[]> {
    const terme = normaliserRechercheCpe(q).slice(0, CPE_BORNES.termeMax);
    if (terme.length < CPE_BORNES.termeMin) return [];
    // La forme normalisée ne contient que lettres, chiffres et espaces : aucun joker de LIKE à échapper.
    return this.db.k
      .selectFrom('vulnerabilites_cpe_produits')
      .select(['partie', 'editeur', 'produit', 'intitule'])
      .where('cle', 'like', `%${terme}%`)
      .orderBy(sql`(cle_produit = ${terme})`, 'desc')
      .orderBy(sql`(cle_produit LIKE ${`${terme}%`})`, 'desc')
      .orderBy(sql`char_length(produit)`)
      .orderBy('editeur')
      .orderBy('produit')
      .orderBy('partie')
      .limit(CPE_BORNES.resultats)
      .execute();
  }

  /** Versions d'un produit de la liste locale. `demander` (POST) : inscrit une demande à la NVD si rien de frais n'est
      connu, dans la limite `autoriser` (par personne) ; sinon (GET, interrogation de l'interface) : état seulement. */
  async versions(
    i: IdentiteProduitCpe,
    user: SessionUser,
    demander: boolean,
    autoriser: () => boolean = () => true,
  ): Promise<VersionsCpeDto> {
    await this.noterSaisie();
    const connu = await this.db.k
      .selectFrom('vulnerabilites_cpe_produits')
      .select('partie')
      .where(memeProduit(i))
      .executeTakeFirst();
    if (!connu) throw new HttpError(404, MESSAGE_PRODUIT_INCONNU);
    const veille = (
      await sql<{ version: string }>`
        SELECT DISTINCT version FROM vulnerabilites_veille_cve_produits
        WHERE partie = ${i.partie} AND lower(editeur) = lower(${i.editeur}) AND lower(produit) = lower(${i.produit})
          AND version IS NOT NULL AND version NOT IN ('*', '-')
        LIMIT ${CPE_BORNES.versions}`.execute(this.db.k)
    ).rows.map((r) => r.version);
    const l = await this.ligne(this.db.k);
    const reponse = (
      etat: VersionsCpeDto['etat'],
      principales: readonly string[],
      source: SourceVersionCpe,
      extra: Partial<VersionsCpeDto> = {},
    ): VersionsCpeDto => {
      const dans = new Set(principales);
      return {
        etat,
        versions: trierVersionsCpe([...principales, ...veille]).map((version) => ({
          version,
          source: dans.has(version) ? source : 'veille',
        })),
        tronque: false,
        obtenuLe: null,
        message: null,
        ...extra,
      };
    };
    if (l.copie_voulue && l.copie_complete_le) {
      const copie = await this.db.k
        .selectFrom('vulnerabilites_cpe_copie')
        .select('version')
        .where(memeProduit(i))
        .execute();
      const toutes = copie.map((c) => c.version);
      return reponse('pret', trierVersionsCpe(toutes), 'copie', {
        tronque: toutes.length > CPE_BORNES.versions,
        obtenuLe: l.copie_complete_le.toISOString(),
        message: toutes.length ? null : MESSAGE_AUCUNE,
      });
    }
    const cache = await this.db.k
      .selectFrom('vulnerabilites_cpe_versions')
      .select(['versions', 'tronque', 'obtenu_le', sql<boolean>`obtenu_le > ${CACHE_FRAIS}`.as('frais')])
      .where(memeProduit(i))
      .executeTakeFirst();
    const depuisCache = (etat: VersionsCpeDto['etat'], message: string | null = null) =>
      reponse(etat, cache?.versions ?? [], 'nvd', {
        tronque: cache?.tronque ?? false,
        obtenuLe: iso(cache?.obtenu_le),
        message: message ?? (etat === 'pret' && !cache?.versions.length && !veille.length ? MESSAGE_AUCUNE : null),
      });
    if (cache?.frais) return depuisCache('pret');
    const derniere = await this.db.k
      .selectFrom('vulnerabilites_cpe_demandes')
      .select(['etat', 'erreur', 'termine_le'])
      .where(memeProduit(i))
      .orderBy('demande_le', 'desc')
      .orderBy('id')
      .limit(1)
      .executeTakeFirst();
    if (derniere && (derniere.etat === 'en_file' || derniere.etat === 'en_cours')) return depuisCache('en_attente');
    const echecRecent =
      derniere &&
      (derniere.etat === 'echec' || derniere.etat === 'expire') &&
      (!cache || derniere.termine_le! > cache.obtenu_le);
    if (!demander) {
      if (echecRecent) return depuisCache('indisponible', `${derniere.erreur} Saisissez la version.`);
      return cache ? depuisCache('pret') : depuisCache('indisponible', veille.length ? null : MESSAGE_AUCUNE);
    }
    if (!l.activee || !(await this.flux.ouvert(FLUX))) return depuisCache('indisponible', MESSAGE_SANS_NVD);
    if (!autoriser())
      throw new HttpError(
        429,
        `Trop de demandes de versions (${CPE_BORNES.demandesParHeure} par heure) : saisissez la version, ou réessayez plus tard.`,
      );
    await this.db.tx(async (_c, k) => {
      await verrouFile(k);
      await sql`
        INSERT INTO vulnerabilites_cpe_demandes (partie, editeur, produit, demande_par)
        VALUES (${i.partie}, ${i.editeur}, ${i.produit}, ${user.id})
        ON CONFLICT (partie, editeur, produit) WHERE etat IN ('en_file', 'en_cours') DO NOTHING`.execute(k);
      await this.noterSaisie(k);
    }, user.username);
    return depuisCache('en_attente');
  }

  /* ---------------------------------------------------------------- État et réglages */
  /** État de la source pour l'écran de la veille (`vulnerabilites:lire`). */
  async etat(): Promise<EtatDictionnaireCpeDto> {
    const l = await this.ligne(this.db.k);
    const flux = await this.flux.lire(FLUX);
    const { n } = await this.db.k
      .selectFrom('vulnerabilites_cpe_produits')
      .select(sql<number>`count(*)::int`.as('n'))
      .executeTakeFirstOrThrow();
    // Copie complète : estimation de PostgreSQL (jusqu'à deux millions de lignes, compter serait lent à chaque affichage).
    const estimation = await sql<{ n: number }>`
      SELECT greatest(reltuples, 0)::bigint::int AS n FROM pg_class WHERE oid = 'vulnerabilites_cpe_copie'::regclass`.execute(
      this.db.k,
    );
    const frequence = frequenceDictionnaireCpe(l.frequence_heures);
    const etat: EtatDictionnaireCpeDto['etat'] = !l.activee
      ? 'inactif'
      : l.erreur
        ? 'erreur'
        : l.mode
          ? 'chargement'
          : l.complet_le
            ? 'a_jour'
            : 'en_attente';
    return {
      source: SOURCE_DICTIONNAIRE_CPE,
      activee: l.activee,
      frequenceHeures: frequence,
      flux: { ouvert: flux.ouvert, applique: flux.applique },
      executant: { disponible: await this.executantDisponible() },
      etat,
      chargement: l.mode ? { mode: l.mode as 'complet' | 'nouveautes', lues: l.curseur, total: l.total } : null,
      produits: n,
      completLe: iso(l.complet_le),
      derniereMiseAJour: iso(l.a_jour_le),
      dernierEssai: iso(l.dernier_essai),
      erreur: l.erreur,
      prochaineMiseAJour:
        l.activee && flux.ouvert && l.complet_le && !l.mode
          ? prochaineAffichee(l.planifiee_le, frequence, new Date()).toISOString()
          : null,
      copie: {
        voulue: l.copie_voulue,
        complete: l.copie_complete_le !== null,
        completeLe: iso(l.copie_complete_le),
        versions: l.copie_voulue ? (estimation.rows[0]?.n ?? 0) : 0,
      },
      version: l.version,
    };
  }

  /** Activation et fréquence (`administrer`, If-Match). Activer ne lance rien tant que le flux est fermé ; le premier
      chargement part au passage suivant de l'exécutant. Journal `vulnerabilites.cpe.reglage` (avant, après). */
  async regler(r: ReglageDictionnaireCpe, attendue: number, user: Actor, ip: string): Promise<EtatDictionnaireCpeDto> {
    if (r.frequenceHeures !== undefined && !frequenceDictionnaireCpeAdmise(r.frequenceHeures))
      throw new HttpError(
        422,
        `Fréquence refusée : ${FREQUENCES_DICTIONNAIRE_CPE.join(' ou ')} heures seulement (une fois par jour ou par semaine).`,
      );
    await this.db.tx(async (c, k) => {
      const l = await this.ligne(k, true);
      if (l.version !== attendue) throw conflict({ version: l.version });
      const avant = { activee: l.activee, frequenceHeures: frequenceDictionnaireCpe(l.frequence_heures) };
      const apres = {
        activee: r.activee ?? avant.activee,
        frequenceHeures: r.frequenceHeures ?? avant.frequenceHeures,
      };
      await k
        .updateTable('vulnerabilites_cpe_dictionnaire')
        .set((eb) => ({
          activee: apres.activee,
          frequence_heures: apres.frequenceHeures,
          // Réactivée après une erreur : nouvel essai au passage suivant.
          ...(apres.activee && !avant.activee ? { erreur: null } : {}),
          version: eb('version', '+', 1),
        }))
        .where('id', '=', 1)
        .execute();
      await this.db.audit(user, ip, 'vulnerabilites.cpe.reglage', 'dictionnaire-cpe', { avant, apres }, c);
    }, user.username);
    return this.etat();
  }

  /** Copie complète demandée (`administrer`, If-Match) : le chargement complet suivant range aussi les versions. */
  async demanderCopie(attendue: number, user: Actor, ip: string): Promise<EtatDictionnaireCpeDto> {
    await this.db.tx(async (c, k) => {
      const l = await this.ligne(k, true);
      if (l.version !== attendue) throw conflict({ version: l.version });
      if (!l.activee)
        throw new HttpError(409, 'Activez d’abord la source du dictionnaire CPE : la copie passe par son chargement.');
      if (l.copie_voulue) throw new HttpError(409, 'La copie complète est déjà demandée.');
      await k
        .updateTable('vulnerabilites_cpe_dictionnaire')
        .set((eb) => ({ copie_voulue: true, copie_complete_le: null, erreur: null, version: eb('version', '+', 1) }))
        .where('id', '=', 1)
        .execute();
      await this.db.audit(user, ip, 'vulnerabilites.cpe.copie.demandee', 'dictionnaire-cpe', {}, c);
    }, user.username);
    return this.etat();
  }

  /** Suppression de la copie complète (`administrer`, If-Match) : la table est vidée (place libérée), les versions
      reviennent par la file. Un chargement en cours continue sans les versions. */
  async supprimerCopie(attendue: number, user: Actor, ip: string): Promise<EtatDictionnaireCpeDto> {
    await this.db.tx(async (c, k) => {
      const l = await this.ligne(k, true);
      if (l.version !== attendue) throw conflict({ version: l.version });
      if (!l.copie_voulue) throw new HttpError(409, 'Aucune copie complète à supprimer.');
      await sql`TRUNCATE vulnerabilites_cpe_copie`.execute(k);
      await k
        .updateTable('vulnerabilites_cpe_dictionnaire')
        .set((eb) => ({
          copie_voulue: false,
          copie_complete_le: null,
          avec_versions: false,
          version: eb('version', '+', 1),
        }))
        .where('id', '=', 1)
        .execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.cpe.copie.supprimee',
        'dictionnaire-cpe',
        { complete: l.copie_complete_le !== null },
        c,
      );
    }, user.username);
    return this.etat();
  }

  /* ---------------------------------------------------------------- CLI de l'exécutant : file des versions */
  /** `suivi cpe-versions-claim` : rend `{ actif, demande }` dans tous les cas. `demande` : la plus ancienne en file (mise en
      cours), ou null. `actif` : saisie de moins de deux minutes, ou demande encore en file ; faux si le module est
      désactivé, le flux fermé, la source désactivée ou le mandataire illisible (les demandes en file sont alors closes). */
  async reclamerVersions(moduleActif: boolean): Promise<{ actif: boolean; demande: Record<string, unknown> | null }> {
    const ouvert = moduleActif && (await this.flux.ouvert(FLUX));
    const mandataire = ouvert ? await this.mandataire.pourExecutant() : null;
    return this.db.tx(async (_c, k) => {
      await verrouFile(k);
      await k
        .deleteFrom('vulnerabilites_cpe_demandes')
        .where('demande_le', '<', sql<Date>`now() - make_interval(days => ${CPE_BORNES.purgeJours})`)
        .where('etat', 'not in', ['en_file', 'en_cours'])
        .execute();
      await k
        .updateTable('vulnerabilites_cpe_demandes')
        .set({
          etat: 'expire',
          termine_le: sql<Date>`now()`,
          erreur: 'Demande expirée : l’exécutant ne l’a pas prise en charge à temps.',
        })
        .where('etat', '=', 'en_file')
        .where('demande_le', '<', DEMANDE_EXPIRATION)
        .execute();
      await k
        .updateTable('vulnerabilites_cpe_demandes')
        .set({ etat: 'echec', termine_le: sql<Date>`now()`, erreur: 'Exécutant interrompu : aucune réponse reçue.' })
        .where('etat', '=', 'en_cours')
        .where('debute_le', '<', DEMANDE_ABANDON)
        .execute();
      const l = await this.ligne(k);
      if (!ouvert || !l.activee || mandataire === 'illisible') {
        await k
          .updateTable('vulnerabilites_cpe_demandes')
          .set({
            etat: 'echec',
            termine_le: sql<Date>`now()`,
            erreur: mandataire === 'illisible' ? MESSAGE_MANDATAIRE : MESSAGE_FERME,
          })
          .where('etat', '=', 'en_file')
          .execute();
        return { actif: false, demande: null };
      }
      const d = await k
        .selectFrom('vulnerabilites_cpe_demandes')
        .select(['id', 'partie', 'editeur', 'produit'])
        .where('etat', '=', 'en_file')
        .orderBy('demande_le')
        .orderBy('id')
        .limit(1)
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (d)
        await k
          .updateTable('vulnerabilites_cpe_demandes')
          .set({ etat: 'en_cours', debute_le: sql<Date>`now()` })
          .where('id', '=', d.id)
          .execute();
      const reste = await k
        .selectFrom('vulnerabilites_cpe_demandes')
        .select('id')
        .where('etat', '=', 'en_file')
        .limit(1)
        .executeTakeFirst();
      const saisie = await k
        .selectFrom('vulnerabilites_cpe_dictionnaire')
        .select('id')
        .where('id', '=', 1)
        .where('saisie_le', '>', SAISIE_ACTIVE)
        .executeTakeFirst();
      return {
        actif: !!reste || !!saisie,
        demande: d
          ? {
              id: d.id,
              partie: d.partie,
              editeur: d.editeur,
              produit: d.produit,
              ...(mandataire ? { mandataire } : {}),
            }
          : null,
      };
    });
  }

  /** `suivi cpe-versions-finish <id>` : clôt une demande en cours ; réussie, les versions (triées, bornées) remplacent le
      cache du produit. */
  async terminerVersions(id: string, brut: unknown): Promise<void> {
    z.uuid().parse(id);
    const r = RapportVersionsCpe.parse(brut);
    await this.db.tx(async (_c, k) => {
      const d = await k
        .selectFrom('vulnerabilites_cpe_demandes')
        .select(['partie', 'editeur', 'produit'])
        .where('id', '=', id)
        .where('etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!d) throw new HttpError(409, 'Demande absente ou déjà terminée.');
      await k
        .updateTable('vulnerabilites_cpe_demandes')
        .set({ etat: r.ok ? 'reussie' : 'echec', termine_le: sql<Date>`now()`, erreur: r.ok ? null : r.erreur })
        .where('id', '=', id)
        .execute();
      if (!r.ok) return;
      const versions = trierVersionsCpe(r.versions);
      await k
        .insertInto('vulnerabilites_cpe_versions')
        .values({ ...d, versions, tronque: r.tronque, obtenu_le: sql<Date>`now()` })
        .onConflict((oc) =>
          oc
            .columns(['partie', 'editeur', 'produit'])
            .doUpdateSet({ versions, tronque: r.tronque, obtenu_le: sql<Date>`now()` }),
        )
        .execute();
    });
  }

  /* ---------------------------------------------------------------- CLI de l'exécutant : chargement par tranches */
  /** `suivi cpe-dictionnaire-claim` : la tranche suivante, ou null (source désactivée, flux fermé, module désactivé,
      tranche déjà remise depuis moins de dix minutes, échec depuis moins de quinze minutes, rien d'échu). Ordre : copie
      complète demandée et pas encore chargée (rechargement complet avec les versions) ; chargement en cours ; premier
      chargement ; nouveautés à la fréquence réglée (rechargement complet si la dernière mise à jour a plus de 120 jours). */
  async reclamerTranche(moduleActif: boolean, maintenant = new Date()): Promise<Record<string, unknown> | null> {
    if (!moduleActif || !(await this.flux.ouvert(FLUX))) return null;
    const mandataire = await this.mandataire.pourExecutant();
    if (mandataire === 'illisible') return null;
    return this.db.tx(async (_c, k) => {
      const l = await this.ligne(k, true);
      if (!l.activee) return null;
      const t = maintenant.getTime();
      if (l.tranche_le && t - l.tranche_le.getTime() < TRANCHE_EXPIRATION_MS) return null;
      if (l.erreur && l.dernier_essai && t - l.dernier_essai.getTime() < REESSAI_APRES_ECHEC_MS) return null;
      const complet = (avecVersions: boolean) => ({
        mode: 'complet' as const,
        avec_versions: avecVersions,
        curseur: 0,
        total: null,
        debut_chargement: enSecondes(maintenant),
        fenetre_debut: null,
        fenetre_fin: null,
      });
      let changement: Partial<Ligne> = {};
      if (l.copie_voulue && !l.copie_complete_le && !(l.mode === 'complet' && l.avec_versions))
        changement = complet(true);
      else if (!l.mode) {
        const frequence = frequenceDictionnaireCpe(l.frequence_heures);
        if (!l.complet_le) changement = complet(l.copie_voulue);
        else if (echeanceAtteinte(l.planifiee_le, frequence, maintenant)) {
          const depuis = l.a_jour_le ?? l.complet_le;
          changement = {
            planifiee_le: referenceApresDemande(l.planifiee_le, frequence, maintenant),
            ...(t - depuis.getTime() > FENETRE_MAX_MS
              ? complet(l.copie_voulue)
              : {
                  mode: 'nouveautes' as const,
                  avec_versions: l.copie_voulue,
                  curseur: 0,
                  total: null,
                  fenetre_debut: depuis,
                  fenetre_fin: enSecondes(maintenant),
                }),
          };
          if (changement.mode === 'nouveautes' && changement.fenetre_debut! >= changement.fenetre_fin!) return null;
        } else return null;
      }
      const tranche = randomUUID();
      const r = await k
        .updateTable('vulnerabilites_cpe_dictionnaire')
        .set({ ...changement, tranche_id: tranche, tranche_le: maintenant, dernier_essai: maintenant })
        .where('id', '=', 1)
        .returningAll()
        .executeTakeFirstOrThrow();
      return {
        id: tranche,
        parametres: {
          operation: 'dictionnaire',
          debut: r.curseur,
          pages: CPE_BORNES.pagesParPassage,
          versions: r.avec_versions,
          ...(r.mode === 'nouveautes'
            ? { depuis: r.fenetre_debut!.toISOString(), jusqua: r.fenetre_fin!.toISOString() }
            : {}),
        },
        ...(mandataire ? { mandataire } : {}),
      };
    });
  }

  /** Tranche en cours : seule celle remise (identifiant) est acceptée. */
  private async tranche(k: Kdb, id: string): Promise<Ligne> {
    z.uuid().parse(id);
    const l = await this.ligne(k, true);
    if (l.tranche_id !== id) throw new HttpError(409, 'Tranche absente ou déjà close.');
    return l;
  }

  /** `suivi cpe-dictionnaire-lot <id>` : range un lot (produits sans doublon ; versions si la copie complète est voulue et
      chargée par cette tranche). Un élément refusé fait refuser tout le lot. */
  async lotTranche(id: string, brut: unknown): Promise<{ produits: number; versions: number }> {
    const lot = LotDictionnaireCpe.parse(brut);
    return this.db.tx(async (_c, k) => {
      const l = await this.tranche(k, id);
      const produits = [
        ...new Map(lot.produits.map((p) => [`${p.partie}\u0000${p.editeur}\u0000${p.produit}`, p])).values(),
      ];
      if (produits.length)
        await k
          .insertInto('vulnerabilites_cpe_produits')
          .values(
            produits.map((p) => ({
              partie: p.partie,
              editeur: p.editeur,
              produit: p.produit,
              intitule: p.intitule,
              cle: normaliserRechercheCpe(`${p.editeur} ${p.produit} ${p.intitule ?? ''}`).slice(0, 600),
              cle_produit: normaliserRechercheCpe(p.produit).slice(0, 100),
            })),
          )
          .onConflict((oc) =>
            oc.columns(['partie', 'editeur', 'produit']).doUpdateSet({
              // Intitulé : le premier gardé ; une entrée suivante ne le remplace que s'il manquait.
              intitule: sql`coalesce(vulnerabilites_cpe_produits.intitule, excluded.intitule)`,
              cle: sql`CASE WHEN vulnerabilites_cpe_produits.intitule IS NULL THEN excluded.cle ELSE vulnerabilites_cpe_produits.cle END`,
              maj_le: sql<Date>`now()`,
            }),
          )
          .execute();
      let versions = 0;
      if (l.avec_versions && l.copie_voulue && lot.versions.length) {
        const r = await k
          .insertInto('vulnerabilites_cpe_copie')
          .values(lot.versions)
          .onConflict((oc) => oc.doNothing())
          .executeTakeFirst();
        versions = Number(r.numInsertedOrUpdatedRows ?? 0);
      }
      return { produits: produits.length, versions };
    });
  }

  /** `suivi cpe-dictionnaire-finish <id>` : clôt la tranche ; avance le curseur, ou termine le chargement (liste complète,
      copie complète, nouveautés lues). Échec : erreur rangée, curseur gardé, nouvel essai après quinze minutes. */
  async terminerTranche(id: string, brut: unknown): Promise<void> {
    const r = RapportDictionnaireCpe.parse(brut);
    await this.db.tx(async (c, k) => {
      const l = await this.tranche(k, id);
      const base = { tranche_id: null, tranche_le: null };
      if (!r.ok || !r.bilan) {
        await k
          .updateTable('vulnerabilites_cpe_dictionnaire')
          .set({ ...base, erreur: r.erreur })
          .where('id', '=', 1)
          .execute();
        await this.db.audit(
          EXECUTANT,
          null,
          'vulnerabilites.cpe.chargement.echec',
          'dictionnaire-cpe',
          { mode: l.mode, lues: l.curseur },
          c,
        );
        return;
      }
      const { total, suivant } = r.bilan;
      if (suivant < l.curseur || suivant > l.curseur + CPE_BORNES.pagesParPassage * CPE_BORNES.parPage)
        throw new HttpError(422, 'Rapport refusé : curseur hors de la tranche remise.');
      if (suivant < total) {
        await k
          .updateTable('vulnerabilites_cpe_dictionnaire')
          .set({ ...base, curseur: suivant, total, erreur: null })
          .where('id', '=', 1)
          .execute();
        return;
      }
      const maintenant = new Date();
      const fin =
        l.mode === 'nouveautes'
          ? { a_jour_le: l.fenetre_fin }
          : {
              complet_le: maintenant,
              a_jour_le: l.debut_chargement,
              planifiee_le: maintenant,
              ...(l.avec_versions && l.copie_voulue ? { copie_complete_le: maintenant } : {}),
            };
      await k
        .updateTable('vulnerabilites_cpe_dictionnaire')
        .set({
          ...base,
          ...fin,
          mode: null,
          avec_versions: false,
          curseur: 0,
          total: null,
          debut_chargement: null,
          fenetre_debut: null,
          fenetre_fin: null,
          erreur: null,
        })
        .where('id', '=', 1)
        .execute();
      await this.db.audit(
        EXECUTANT,
        null,
        'vulnerabilites.cpe.chargement.termine',
        'dictionnaire-cpe',
        { mode: l.mode, total, copie: !!(l.avec_versions && l.copie_voulue) },
        c,
      );
    });
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
