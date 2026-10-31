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
  'invest_settings',
  'types_processus',
  'roles',
] as const;

/** Effacé seulement par la portée « tout » : comptes, groupes, fonctions, réglages et configuration de la plateforme. */
export const TABLES_CONFIGURATION = [
  'users',
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
  'tableaux_de_bord',
  'tableaux_de_bord_partages',
  'tableaux_de_bord_choix',
  'calendriers_plateforme',
  'calendriers_plateforme_journal',
  'calendriers_plateforme_jours',
] as const;

/** Effacé par les deux portées : tout ce que les utilisateurs ont saisi ou importé. */
export const TABLES_TRAVAIL = [
  'app_state',
  'state_history',
  'contributions_elements',
  'courriel_jobs',
  'document_versions',
  'documents',
  'droits_ressources',
  'grc_framework_versions',
  'grc_links',
  'grc_members',
  'grc_method_versions',
  'grc_notifications',
  'grc_object_versions',
  'grc_objects',
  'grc_occurrences',
  'grc_rapprochements',
  'grc_requirement_assessments',
  'grc_risk_evaluations',
  'grc_scope_frameworks',
  'grc_series',
  'grc_smsis',
  'import_batches',
  'invest_lines',
  'lib_framework_promotions',
  'lib_framework_versions',
  'lib_frameworks',
  'lib_kit_ia',
  'lib_mapping_history',
  'lib_mappings',
  'links',
  'map_versions',
  'maps',
  'occurrence_validations',
  'parcours_associations',
  'pilotage_decisions',
  'registre_perimetres',
  'registres',
  'suivi_access_reviews',
  'suivi_app_gaps',
  'suivi_clausier_evals',
  'suivi_crise_cellules',
  'suivi_crise_contacts',
  'suivi_crise_scenarios',
  'suivi_crrc_alertes',
  'suivi_crrc_etablissements',
  'suivi_crrc_offres',
  'suivi_crrc_ressources',
  'suivi_crrc_restaurations',
  'suivi_crrc_sauvegardes',
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
  'sup_evaluation_items',
  'sup_evaluations',
  'sup_scope_links',
  'cfg_items',
  'cfg_versions',
  'cfg_usages',
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
      for (const t of touchees) await sql`ALTER TABLE ${sql.table(t)} DISABLE TRIGGER USER`.execute(k);
      await sql`TRUNCATE ${sql.join(aVider.map((t) => sql.table(t)))} RESTART IDENTITY`.execute(k);
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
