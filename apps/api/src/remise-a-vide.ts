/* Remise à vide de la base (ADR 0065), pour la recette : deux portées, jamais sans interrupteur actif, code de double
   authentification, phrase recopiée et sauvegarde récente. C'est le seul chemin qui contourne les triggers d'immuabilité
   (décisions, versions publiées, évaluations) : ils sont suspendus puis rétablis dans la même transaction, qui est
   annulée au moindre échec. Le journal d'audit n'est jamais touché et reçoit une entrée. Chaque table du schéma est
   classée ci-dessous ; un test échoue si une table nouvelle n'est pas classée. */
import {
  REMISE_A_VIDE_DELAI_SAUVEGARDE_MINUTES,
  REMISE_A_VIDE_PHRASES,
  type RemiseAVideEtat,
  type RemiseAVidePortee,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Actor, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import { exploitationOccupee } from './operations.js';

/** Même verrou consultatif que les sauvegardes : aucune remise à vide pendant qu'une sauvegarde démarre. */
const LOCK = 727275;
const CLE_REGLAGE = 'remise_a_vide';

/** Jamais effacé : historique du schéma, journal d'audit, exploitation (sauvegardes, opérations, mises à jour) et
    réglages à valeur unique créés par les migrations. Les rôles prédéfinis restent ; les rôles personnalisés
    disparaissent avec la portée « tout ». */
export const TABLES_SYSTEME = [
  'schema_migrations',
  'audit_log',
  'backup_jobs',
  'backup_policy',
  'backup_worker',
  'operation_jobs',
  'operation_receipts',
  'update_jobs',
  'journal_technique_config',
  'module_activation',
  'business_policy_configuration',
  'business_policy_versions',
  'types_processus',
  'roles',
  'assistant_reglages',
  'assistant_profils',
  // Flux vers l'extérieur (ADR 0097) : décision de l'administrateur, comme les réglages de l'assistant ; une remise à vide
  // ne rouvre ni ne ferme aucun flux.
  'flux_externes',
] as const;

/** Effacé seulement par la portée « tout » : comptes, groupes, fonctions, réglages et configuration de la plateforme. */
export const TABLES_CONFIGURATION = [
  'users',
  // Contacts de crise issus des comptes (ADR 0107) : fiche qui complète le compte, effacée avec lui.
  'contacts_crise_comptes',
  'sessions',
  'webauthn_credentials',
  'webauthn_challenges',
  'recovery_codes',
  'user_roles',
  'user_groups',
  'groups',
  'group_roles',
  'fonctions',
  'fonction_membres',
  'settings',
  'notification_reglages',
  'notification_portees',
  'wall_screens',
  // Tableaux de bord de l'accueil (ADR 0078, 0109) : tableaux, partages et onglets de chaque personne. Les tableaux proposés
  // d'office sont recréés depuis le code à la première lecture.
  'tableaux_de_bord',
  'tableaux_de_bord_partages',
  'tableaux_de_bord_choix',
  'tableaux_de_bord_onglets',
  'calendriers_plateforme',
  'calendriers_plateforme_journal',
  'calendriers_plateforme_jours',
  // Module Intégrations (ADR 0076) : connecteurs configurés par l'administrateur (leurs secrets sont dans settings) et
  // journal de leurs exécutions.
  'integrations',
  'integration_executions',
  // Synchronisations de Tenable (ADR 0100, lot V5) : état par instance (créneau du jour, numéros de synchronisation) et
  // journal des synchronisations, rattachés aux instances et à leurs exécutions ; effacés avec elles.
  'vulnerabilites_tenable_etat',
  'vulnerabilites_synchronisations',
  // Synchronisations d'AlgoLightHouse (ADR 0100, lot ALH1) : même règle que pour Tenable.
  'vulnerabilites_alh_etat',
  'vulnerabilites_alh_synchronisations',
  // Imports de scans Nessus (ADR 0100, lot N1) : journal rattaché aux instances et à leurs exécutions ; même règle.
  'vulnerabilites_imports',
  // Imports du rapport Silène (ADR 0100, lot SI1) : état des numéros et journal des imports (avec leurs notes, nombres
  // seulement), rattachés aux instances et à leurs exécutions ; même règle.
  'vulnerabilites_silene_etat',
  'vulnerabilites_silene_imports',
] as const;

/** Effacé par les deux portées : tout ce que les utilisateurs ont saisi ou importé. */
export const TABLES_TRAVAIL = [
  'app_state',
  'assistant_consommation',
  'assistant_conversations',
  'assistant_messages',
  'assistant_memoire',
  'assistant_methodes',
  'document_textes',
  'assistant_propositions',
  'assistant_questions',
  'assistant_missions',
  'assistant_rondes',
  'state_history',
  'contributions_elements',
  'dda_perimetres',
  'courriel_jobs',
  'document_versions',
  'documents',
  'droits_ressources',
  'grc_framework_copy_versions',
  'grc_framework_versions',
  'grc_links',
  'grc_members',
  'grc_method_versions',
  'grc_notifications',
  'grc_object_versions',
  'grc_objects',
  'grc_occurrences',
  'grc_requirement_assessments',
  'grc_risk_evaluations',
  'grc_scope_frameworks',
  'grc_series',
  'grc_smsis',
  'import_batches',
  'lib_framework_promotions',
  'lib_framework_versions',
  'lib_frameworks',
  'lib_kit_ia',
  'links',
  'map_versions',
  'maps',
  'occurrence_validations',
  'parcours_associations',
  'pilotage_decisions',
  'registre_perimetres',
  'registres',
  'suivi_clausier_evals',
  'suivi_crise_cellules',
  'suivi_crise_contacts',
  'suivi_crise_scenarios',
  'suivi_dda',
  'suivi_fournisseurs',
  'suivi_groupes',
  'suivi_ia_etapes',
  'suivi_ia_evaluations',
  'suivi_ia_politiques',
  'suivi_ia_usages',
  'suivi_incidents',
  'suivi_indicateurs',
  'suivi_indicateurs_valeurs',
  'suivi_mesures',
  'suivi_objectifs',
  'suivi_parties_interessees',
  'suivi_plans',
  'suivi_presence',
  'suivi_preuves',
  'suivi_processus',
  'suivi_referentiels_suivi',
  'suivi_reglages',
  'suivi_revues',
  'suivi_roles',
  'suivi_swot',
  'suivi_taches_recurrentes',
  'sup_criteria',
  'sup_criterion_history',
  'sup_criterion_links',
  'sup_evaluation_items',
  'sup_evaluations',
  'sup_scope_links',
  'cfg_items',
  'cfg_versions',
  'cfg_usages',
  // Module Vulnérabilités (ADR 0100) : produits surveillés saisis par les utilisateurs.
  'vulnerabilites_produits',
  // Veille des vulnérabilités (ADR 0100, lots V2 et V3) : données publiques recalculables par une nouvelle collecte, état des
  // sources (créneau, fenêtre NVD) et journal des collectes ; effacés ensemble pour repartir d'une veille vierge.
  'vulnerabilites_veille_sources',
  'vulnerabilites_veille_cve',
  'vulnerabilites_veille_avis',
  'vulnerabilites_veille_collectes',
  // Failles et machines lues dans Tenable (ADR 0100, lot V5) : relues à la synchronisation suivante ; rôle et périmètre des
  // machines saisis par les utilisateurs, périmètre rattaché à grc_smsis (effacé avec le travail).
  'vulnerabilites_machines',
  // Dépôts de Tenable (ADR 0100, lot V4d) : relus à la synchronisation suivante ; liaison à un périmètre saisie par les
  // utilisateurs, rattachée à grc_smsis (effacée avec le travail, comme le périmètre des machines).
  'vulnerabilites_tenable_depots',
  'vulnerabilites_constats',
  'vulnerabilites_constat_cves',
  'vulnerabilites_detections',
  // Rapprochement par version (ADR 0100, lot V4a) : produits touchés tirés de NVD (recalculables), liens produit-machine et
  // rapprochements décidés par les utilisateurs, effacés avec les produits, les machines et la veille.
  'vulnerabilites_veille_cve_produits',
  'vulnerabilites_produits_machines',
  'vulnerabilites_rapprochements',
  // Suivi des failles (ADR 0100, lot V4b) : états décidés par les utilisateurs, historique immuable de ces décisions et liens
  // vers les actions du registre ; ils portent sur les constats, les rapprochements et les actions, tous effacés avec le
  // travail. L'historique, en ajout seul, n'est effacé que par ce chemin (déclencheurs suspendus le temps de la transaction).
  'vulnerabilites_suivis',
  'vulnerabilites_suivi_historique',
  'vulnerabilites_suivi_actions',
  // Assistant et vulnérabilités (ADR 0100, V14 et V29) : repères des machines et propositions d'action, rattachés aux
  // conversations de l'assistant (travail des utilisateurs, effacées par les deux portées) et effacés avec elles.
  'vulnerabilites_assistant_reperes',
  'vulnerabilites_assistant_propositions',
  // Repères des actifs exposés (AlgoLightHouse) dans une conversation (ADR 0100, lot ALH2), même règle.
  'vulnerabilites_assistant_reperes_externes',
  // Surface externe lue dans AlgoLightHouse (ADR 0100, lot ALH1) : relue à la synchronisation suivante ; liaison des
  // périmètres saisie par les utilisateurs, rattachée à grc_smsis (effacée avec le travail).
  'vulnerabilites_alh_perimetres',
  'vulnerabilites_alh_actifs',
  'vulnerabilites_alh_alertes',
  'vulnerabilites_alh_alerte_cves',
  'vulnerabilites_alh_technologies',
  'vulnerabilites_alh_technologie_actifs',
  'vulnerabilites_alh_technologie_cves',
  // Actifs exposés reliés aux machines internes (ADR 0100, lot ALH3) : propositions recalculées à la synchronisation suivante,
  // décisions des utilisateurs, effacées avec les actifs et les machines qu'elles relient.
  'vulnerabilites_alh_liaisons_machines',
  // Services exposés des actifs et leurs alertes (ADR 0100, lot ALH6) : relus à la synchronisation suivante, effacés avec
  // les actifs et les alertes qui les portent.
  'vulnerabilites_alh_services',
  'vulnerabilites_alh_service_alertes',
  // Surface externe importée de Silène (ADR 0100, lot SI1) : relue au prochain import ; liaison de l'instance à un périmètre
  // saisie par les utilisateurs, rattachée à grc_smsis (effacée avec le travail, comme celle des périmètres ALH).
  'vulnerabilites_silene_perimetres',
  'vulnerabilites_silene_hotes',
  'vulnerabilites_silene_noms',
  'vulnerabilites_silene_ports',
  'vulnerabilites_silene_produits',
  'vulnerabilites_silene_constats',
  'vulnerabilites_silene_constat_hotes',
  'vulnerabilites_silene_lignes',
  // Alertes du module (ADR 0100, lot V6) : décidées par la plateforme à partir des faits ci-dessus (réévaluées à la collecte
  // ou à la synchronisation suivante) et prises en compte par les utilisateurs ; effacées avec le travail.
  'vulnerabilites_alertes',
  // Failles déjà signalées en dépassement de délai (ADR 0100, lot S1) : recalculées à chaque évaluation à partir des faits et
  // des suivis ci-dessus, effacées avec eux.
  'vulnerabilites_depassements',
  // Instantanés quotidiens de la situation (ADR 0100, lot S2) : nombres calculés à partir des faits et des suivis ci-dessus,
  // sans nom ; l'historique repart de zéro avec eux.
  'vulnerabilites_instantanes',
  'vulnerabilites_instantanes_mesures',
  // Déclarations réglementaires des incidents (ADR 0105) : rattachées aux incidents, effacées avec le travail. Une déclaration
  // envoyée ou écartée n'est effacée que par ce chemin (déclencheurs suspendus le temps de la transaction).
  'incidents_declarations',
] as const;

/** Tables à vider pour une portée (users est traité à part : suppression des lignes, pour les clés étrangères). */
export function tablesAVider(portee: RemiseAVidePortee): string[] {
  const t: string[] = [...TABLES_TRAVAIL];
  if (portee === 'tout') t.push(...TABLES_CONFIGURATION.filter((x) => x !== 'users'));
  return t;
}

export class RemiseAVide {
  constructor(private readonly db: Db) {}

  async autorisee(): Promise<boolean> {
    const r = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE_REGLAGE).executeTakeFirst();
    return (r?.value as { autorisee?: boolean } | undefined)?.autorisee === true;
  }

  async definirAutorisation(autorisee: boolean, actor: Actor, ip: string) {
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE_REGLAGE, value: JSON.stringify({ autorisee }) })
        .onConflict((oc) =>
          oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value'), updated_at: sql<Date>`now()` })),
        )
        .execute();
      await this.db.audit(actor, ip, autorisee ? 'remise_a_vide.autorisee' : 'remise_a_vide.interdite', '', {}, c);
    });
  }

  /** Dernière sauvegarde réussie et état de l'exploitation, pour l'écran et pour les contrôles. */
  async etat(): Promise<RemiseAVideEtat> {
    const derniere = await this.db.k
      .selectFrom('backup_jobs')
      .select('finished_at')
      .where('status', '=', 'reussie')
      .where('finished_at', 'is not', null)
      .orderBy('finished_at', 'desc')
      .executeTakeFirst();
    const fin = derniere?.finished_at ?? null;
    return {
      autorisee: await this.autorisee(),
      sauvegarde: {
        derniere: fin ? fin.toISOString() : null,
        recente: !!fin && Date.now() - fin.getTime() <= REMISE_A_VIDE_DELAI_SAUVEGARDE_MINUTES * 60_000,
        delaiMinutes: REMISE_A_VIDE_DELAI_SAUVEGARDE_MINUTES,
      },
      occupee: await exploitationOccupee(
        this.db.k,
        ['en_attente', 'en_cours', 'intervention'],
        ['en_attente', 'en_cours'],
      ),
      phrases: REMISE_A_VIDE_PHRASES,
    };
  }

  /** Efface les données de la portée. Les contrôles (interrupteur, code, phrase) sont faits par la route ; ceux qui
      dépendent de l'état de la base (sauvegarde récente, exploitation libre) sont refaits ici, sous verrou. */
  async executer(portee: RemiseAVidePortee, actor: Actor, ip: string): Promise<{ tables: number }> {
    const aVider = tablesAVider(portee);
    await this.db.tx(async (c, k) => {
      await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
      const e = await this.etat();
      if (!e.autorisee) throw new HttpError(403, 'La remise à vide n’est pas autorisée sur ce serveur.');
      if (e.occupee) throw new HttpError(409, 'Une sauvegarde ou une opération d’exploitation est en cours.');
      if (!e.sauvegarde.recente)
        throw new HttpError(
          409,
          `Aucune sauvegarde réussie depuis moins de ${e.sauvegarde.delaiMinutes} minutes : lancez-en une, puis recommencez.`,
          { reason: 'sauvegarde_requise' },
        );
      // Les triggers d'immuabilité sont suspendus le temps de l'effacement (propriétaire des tables) ; la transaction
      // les rétablit ou, en cas d'échec, annule tout.
      const touchees = [...aVider, ...(portee === 'tout' ? ['users'] : [])];
      // Lot PRIO-1 (décision du RSSI du 20/11/2026) : la remise à vide du travail garde les fréquences choisies pour les
      // sources de la veille (un réglage, comme celle des connecteurs, qui suit leur instance) ; l'état des sources
      // (dernière collecte, fenêtre NVD, référence de planification) repart de zéro. La portée « tout » efface aussi la
      // configuration : les fréquences reviennent alors aux valeurs par défaut.
      const frequences =
        portee === 'travail'
          ? await k
              .selectFrom('vulnerabilites_veille_sources')
              .select(['source', 'frequence_heures'])
              .where('frequence_heures', 'is not', null)
              .execute()
          : [];
      for (const t of touchees) await sql`ALTER TABLE ${sql.table(t)} DISABLE TRIGGER USER`.execute(k);
      await sql`TRUNCATE ${sql.join(aVider.map((t) => sql.table(t)))} RESTART IDENTITY`.execute(k);
      if (frequences.length) await k.insertInto('vulnerabilites_veille_sources').values(frequences).execute();
      if (portee === 'tout') {
        await k.deleteFrom('users').execute();
        await k.deleteFrom('roles').where('system', '=', false).execute();
      }
      for (const t of touchees) await sql`ALTER TABLE ${sql.table(t)} ENABLE TRIGGER USER`.execute(k);
      await this.db.audit(actor, ip, 'remise_a_vide.executee', portee, { tables: aVider.length }, c);
    });
    return { tables: aVider.length };
  }
}
