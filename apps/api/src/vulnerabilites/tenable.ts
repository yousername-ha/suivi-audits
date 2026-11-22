/* Module Vulnérabilités (ADR 0100, lot V5) : réception des synchronisations de Tenable Security Center. L'opération
   « synchroniser » du connecteur « tenable » (module Intégrations, ADR 0076) est inscrite par le tic quotidien ou par
   « Synchroniser maintenant », réclamée par l'exécutant (`suivi integrations-claim`), qui lance le script isolé
   scripts/integration-http.py puis rapporte les éléments par lots bornés (`suivi integrations-lot`) et termine
   (`suivi integrations-finish`). Modèle suivi : la veille (veille.ts).
   - Chaque élément est validé par son schéma (packages/shared/src/failles-tenable.ts) ; un seul refus fait refuser le lot.
     Rangement sans doublon : machine par (instance, identifiant dans la source), constat par (instance, contrôle), détection
     par (constat, machine, port, protocole). Une synchronisation rejouée met à jour, n'ajoute rien.
   - Présence : chaque synchronisation reçoit un numéro à sa réclamation ; une détection garde le numéro de la dernière
     synchronisation qui l'a vue. Seule une synchronisation complète (succès, bilan cohérent, aucune borne atteinte) fait
     avancer le numéro de référence : une détection plus ancienne n'est plus « présente », mais rien n'est supprimé. Une
     synchronisation interrompue ou incomplète ne fait donc rien disparaître.
   - L'inventaire des machines (`GET /rest/hosts`, annoncé expérimental) complète les machines connues ou en ajoute ; son
     échec est consigné sans faire échouer la synchronisation des failles.
   - Planification (lot F1) : une synchronisation par période réglée sur l'instance (vingt-quatre heures par défaut ; 6 h,
     12 h, 24 h ou 7 jours) et par instance active et complète, comptée depuis la dernière demande automatique ; cette
     référence est consommée avant l'inscription (aucun rejeu après une panne ni redemande après un échec avant la période
     suivante). Rien si le flux « tenable » est fermé ; le tic vérifie les modules.
   Journal `vulnerabilites.synchronisation.*` : identifiants internes et nombres seulement, jamais un nom ni une adresse de
   machine. Accès aux données en Kysely (ADR 0062).
   Lot V4b : à la fin d'une synchronisation reçue, le suivi des failles retire les propositions « corrigée » des constats
   de nouveau présents et remet « à traiter » ceux qui étaient corrigés ; après une synchronisation complète seulement, il
   propose « corrigé selon Tenable, à confirmer » pour les constats qui ne sont plus présents nulle part (suivi.ts).
   Lot V4d : le dépôt de chaque machine (identifiant et nom) est rangé par instance ; une synchronisation met à jour son nom
   et le dépôt de la machine, jamais la liaison du dépôt à un périmètre, ni le périmètre, le rôle ou la version d'une
   machine. Une machine rapportée sans dépôt (inventaire, forme inattendue) garde celui qu'elle avait.
   Lot N1 : l'import d'un scan Nessus (import-nessus.ts) range ses machines, constats et détections par ce même chemin
   d'écriture (`rangerPassage`), avec la source « nessus-fichier » et la première détection la plus ancienne connue (un scan
   ne dit que la date de son passage).
   Lot N2 : un constat importé porte en plus `exploiteMalware` (« exploité par un logiciel malveillant » selon Tenable) ;
   Security Center ne le rapporte pas, ses constats sont rangés à false.
   Lot QF-TEN : les correctifs regroupés de Tenable (`sumremediation`), rapportés en dernier par le script et seulement si
   leur lecture est complète, sont rangés et rattachés aux constats de l'instance ; à la fin acceptée, `correctifs_numero`
   désigne la synchronisation dont ils sont montrés. Un import Nessus n'en a pas. */
import {
  BilanSynchronisation,
  cleMachine,
  type ElementConstatTenable,
  type ElementCorrectifTenable,
  type ElementDetectionTenable,
  type ElementHoteTenable,
  type ElementMachineTenable,
  ElementSynchronisation,
  echeanceAtteinte,
  frequenceConnecteur,
  type EtatSynchronisationDto,
  GRAVITES_PAR_DEFAUT,
  type GraviteTenable,
  kitsRanges,
  LotSynchronisation,
  type SourceMachine,
  prochaineAffichee,
  referenceApresDemande,
  TENABLE_BORNES,
} from '@suivi/shared';
import { sql } from 'kysely';
import { analyserTables } from '../db/analyser.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { FluxExternes } from '../flux-externes.js';
import { HttpError } from '../http/errors.js';
import { type Integrations, type OperationEnLots, verrouFileIntegrations } from '../integrations/index.js';

/** Constat d'un passage : celui de Security Center, ou celui d'un import Nessus qui dit en plus s'il est exploité par un
    logiciel malveillant (lot N2 ; absent : false). */
export type ConstatPassage = ElementConstatTenable & { exploiteMalware?: boolean };

const PLANIFICATION = { username: 'planification' };
const EXECUTANT = { username: 'exécutant serveur' };

/** Dernier élément de chaque clé (un même identifiant ne peut pas être mis à jour deux fois par la même requête). */
function dernierParCle<T>(elements: T[], cle: (e: T) => string): T[] {
  return [...new Map(elements.map((e) => [cle(e), e])).values()];
}

export class SynchronisationTenable implements OperationEnLots {
  /** Suivi des failles (lot V4b) : propositions « corrigée », retraits et réapparitions, dans la transaction de la fin. */
  apresSynchronisation?: (k: Kdb, c: Client, integrationId: string, complete: boolean) => Promise<void>;

  constructor(
    private readonly db: Db,
    private readonly flux: FluxExternes,
    private readonly integrations: Integrations,
  ) {}

  /* ---------------------------------------------------------------- Réception (CLI de l'exécutant) */
  async reclamee(k: Kdb, executionId: string, integrationId: string): Promise<void> {
    await k
      .insertInto('vulnerabilites_tenable_etat')
      .values({ integration_id: integrationId })
      .onConflict((oc) => oc.column('integration_id').doNothing())
      .execute();
    const { numero } = await k
      .updateTable('vulnerabilites_tenable_etat')
      .set((eb) => ({ numero: eb('numero', '+', 1) }))
      .where('integration_id', '=', integrationId)
      .returning('numero')
      .executeTakeFirstOrThrow();
    await k
      .insertInto('vulnerabilites_synchronisations')
      .values({ execution_id: executionId, integration_id: integrationId, numero })
      .execute();
  }

  async lot(k: Kdb, executionId: string, brut: unknown[]): Promise<{ elements: number; lots: number }> {
    const { elements } = LotSynchronisation.parse({ elements: brut });
    const s = await k
      .selectFrom('vulnerabilites_synchronisations')
      .select(['integration_id', 'numero', 'lots'])
      .where('execution_id', '=', executionId)
      .forUpdate()
      .executeTakeFirst();
    if (!s) throw new HttpError(409, 'Synchronisation absente.');
    if (s.lots >= TENABLE_BORNES.lots) throw new HttpError(409, 'Nombre de lots dépassé pour cette synchronisation.');
    const valides: ElementSynchronisation[] = [];
    elements.forEach((e, i) => {
      const v = ElementSynchronisation.safeParse(e);
      if (!v.success)
        throw new HttpError(
          422,
          `Élément ${i + 1} du lot refusé (${v.error.issues[0]?.message ?? 'forme inattendue'}).`,
        );
      valides.push(v.data);
    });
    const de = <T extends ElementSynchronisation['type']>(t: T) =>
      valides.filter((e): e is Extract<ElementSynchronisation, { type: T }> => e.type === t);
    // Ordre : machines et constats d'abord, puis les détections qui s'y réfèrent, puis l'inventaire.
    await this.rangerMachines(k, s.integration_id, s.numero, de('machine'));
    await this.rangerConstats(k, s.integration_id, s.numero, de('constat'));
    await this.rangerDetections(k, s.integration_id, s.numero, de('detection'));
    await this.rangerHotes(k, s.integration_id, s.numero, de('hote'));
    await this.rangerCorrectifs(k, s.integration_id, s.numero, de('correctif'));
    const r = await k
      .updateTable('vulnerabilites_synchronisations')
      .set((eb) => ({ lots: eb('lots', '+', 1), elements: eb('elements', '+', valides.length) }))
      .where('execution_id', '=', executionId)
      .returning(['lots', 'elements'])
      .executeTakeFirstOrThrow();
    return { elements: r.elements, lots: r.lots };
  }

  async terminee(
    k: Kdb,
    c: Client,
    executionId: string,
    resultat: Record<string, unknown> | null,
  ): Promise<string | null> {
    const s = await k
      .selectFrom('vulnerabilites_synchronisations')
      .select(['integration_id', 'numero', 'elements', 'lots'])
      .where('execution_id', '=', executionId)
      .forUpdate()
      .executeTakeFirst();
    if (!s) return resultat ? 'Synchronisation absente : résultat refusé.' : null;
    const bilan = resultat ? BilanSynchronisation.parse(resultat) : null;
    let refus: string | null = null;
    if (bilan && bilan.elements !== s.elements)
      refus = `Bilan incohérent : ${bilan.elements} élément(s) annoncé(s), ${s.elements} reçu(s).`;
    const complete = !!bilan && !refus && !bilan.tronque;
    if (bilan && !refus) {
      await k
        .updateTable('vulnerabilites_synchronisations')
        .set({ complete })
        .where('execution_id', '=', executionId)
        .execute();
      await k
        .updateTable('vulnerabilites_tenable_etat')
        .set((eb) => ({
          inventaire_ok: bilan.inventaire.ok,
          inventaire_erreur: bilan.inventaire.erreur,
          inventaire_le: sql<Date>`now()`,
          // Lot QF-TEN : correctifs regroupés de cette synchronisation, tous reçus (fin acceptée) ; sinon, les précédents.
          correctifs_numero: sql<number | null>`CASE WHEN EXISTS (SELECT 1 FROM vulnerabilites_tenable_correctifs tc
            WHERE tc.integration_id = ${s.integration_id}::uuid AND tc.vu_numero = ${s.numero}::int)
            THEN ${s.numero}::int ELSE ${eb.ref('correctifs_numero')} END`,
          ...(complete
            ? {
                numero_complet: sql<number>`greatest(${eb.ref('numero_complet')}, ${s.numero}::int)`,
                complete_le: sql<Date>`now()`,
              }
            : {}),
        }))
        .where('integration_id', '=', s.integration_id)
        .execute();
      await this.apresSynchronisation?.(k, c, s.integration_id, complete);
    }
    await this.db.audit(
      EXECUTANT,
      null,
      'vulnerabilites.synchronisation.terminee',
      executionId,
      {
        integration: s.integration_id,
        numero: s.numero,
        lots: s.lots,
        elements: s.elements,
        etat: bilan && !refus ? 'recu' : 'echec',
        complete,
        ...(bilan && !refus
          ? {
              constats: bilan.constats,
              detections: bilan.detections,
              machines: bilan.machines,
              hotes: bilan.hotes,
              tronque: bilan.tronque,
              inventaire: bilan.inventaire.ok,
            }
          : {}),
      },
      c,
    );
    return refus;
  }

  /** Après la validation d'une fin reçue, hors transaction : statistiques des tables réécrites par les lots, s'il y en a eu. */
  async apresValidation(executionId: string): Promise<void> {
    const s = await this.db.k
      .selectFrom('vulnerabilites_synchronisations')
      .select('elements')
      .where('execution_id', '=', executionId)
      .executeTakeFirst();
    if (s?.elements)
      await analyserTables(
        this.db.k,
        [
          'vulnerabilites_tenable_depots',
          'vulnerabilites_machines',
          'vulnerabilites_constats',
          'vulnerabilites_constat_cves',
          'vulnerabilites_detections',
        ],
        this.db.log,
      );
  }

  /* ---------------------------------------------------------------- Rangement (sans doublon) */
  /** Lot N1 : un passage d'import (machines, puis constats, puis détections qui s'y réfèrent), par le chemin d'écriture d'une
      synchronisation. Une détection d'un constat ou d'une machine inconnus fait refuser tout le passage. */
  async rangerPassage(
    k: Kdb,
    integration: string,
    numero: number,
    el: {
      machines: ElementMachineTenable[];
      constats: ConstatPassage[];
      detections: ElementDetectionTenable[];
    },
    source: SourceMachine,
  ): Promise<void> {
    await this.rangerMachines(k, integration, numero, el.machines, source);
    await this.rangerConstats(k, integration, numero, el.constats);
    await this.rangerDetections(k, integration, numero, el.detections, true);
  }

  /** Dépôts vus dans le lot (identifiant et nom) : rangés sans doublon, nom mis à jour, liaison jamais touchée. Rend la
      correspondance identifiant Tenable -> identifiant interne. */
  private async rangerDepots(k: Kdb, integration: string, numero: number, el: ElementMachineTenable[]) {
    const depots = dernierParCle(
      el.flatMap((m) => (m.depot ? [m.depot] : [])),
      (d) => d.id,
    );
    if (!depots.length) return new Map<string, string>();
    const r = await k
      .insertInto('vulnerabilites_tenable_depots')
      .values(
        depots.map((d) => ({
          integration_id: integration,
          depot_tenable: Number(d.id),
          nom: d.nom,
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'depot_tenable']).doUpdateSet({
          nom: sql`excluded.nom`,
          vu_numero: sql`greatest(vulnerabilites_tenable_depots.vu_numero, excluded.vu_numero)`,
        }),
      )
      .returning(['id', 'depot_tenable'])
      .execute();
    return new Map(r.map((d) => [String(d.depot_tenable), d.id]));
  }

  private async rangerMachines(
    k: Kdb,
    integration: string,
    numero: number,
    el: ElementMachineTenable[],
    source: SourceMachine = 'tenable',
  ) {
    if (!el.length) return;
    const depots = await this.rangerDepots(k, integration, numero, el);
    await k
      .insertInto('vulnerabilites_machines')
      .values(
        dernierParCle(el, (m) => m.cle).map((m) => ({
          integration_id: integration,
          source,
          identifiant_source: m.cle,
          uuid_source: m.uuid,
          nom: m.nom,
          adresse: m.adresse,
          systeme: m.systeme,
          premiere_detection: m.premiere,
          derniere_detection: m.derniere,
          exposition: m.exposition,
          acr: m.acr === null ? null : String(m.acr),
          // Lot TEN-SCORES : absent (script plus ancien) comme null, non fourni.
          aes: m.aes ?? null,
          depot_id: m.depot ? (depots.get(m.depot.id) ?? null) : null,
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'identifiant_source']).doUpdateSet({
          uuid_source: sql`coalesce(excluded.uuid_source, vulnerabilites_machines.uuid_source)`,
          nom: sql`coalesce(excluded.nom, vulnerabilites_machines.nom)`,
          adresse: sql`coalesce(excluded.adresse, vulnerabilites_machines.adresse)`,
          systeme: sql`coalesce(excluded.systeme, vulnerabilites_machines.systeme)`,
          // LEAST et GREATEST ignorent les valeurs nulles.
          premiere_detection: sql`least(vulnerabilites_machines.premiere_detection, excluded.premiere_detection)`,
          derniere_detection: sql`greatest(vulnerabilites_machines.derniere_detection, excluded.derniere_detection)`,
          exposition: sql`coalesce(excluded.exposition, vulnerabilites_machines.exposition)`,
          acr: sql`coalesce(excluded.acr, vulnerabilites_machines.acr)`,
          // Même règle que l'ACR : une valeur non fournie garde la valeur rangée.
          aes: sql`coalesce(excluded.aes, vulnerabilites_machines.aes)`,
          depot_id: sql`coalesce(excluded.depot_id, vulnerabilites_machines.depot_id)`,
          vu_numero: sql`greatest(vulnerabilites_machines.vu_numero, excluded.vu_numero)`,
          maj_le: sql`now()`,
        }),
      )
      .execute();
  }

  private async rangerConstats(k: Kdb, integration: string, numero: number, el: ConstatPassage[]) {
    if (!el.length) return;
    const uniques = dernierParCle(el, (c) => c.plugin);
    const ids = await k
      .insertInto('vulnerabilites_constats')
      .values(
        uniques.map((c) => ({
          integration_id: integration,
          plugin_id: Number(c.plugin),
          nom: c.nom,
          gravite: c.gravite,
          famille: c.famille,
          synopsis: c.synopsis,
          correctif: c.correctif,
          cvss3_vecteur: c.cvss3Vecteur,
          cvss3_score: c.cvss3Score === null ? null : String(c.cvss3Score),
          vpr_score: c.vpr === null ? null : String(c.vpr),
          epss_score: c.epss === null ? null : String(c.epss),
          exploitable: c.exploitable,
          exploit_libelle: c.exploitLibelle,
          exploite_malware: c.exploiteMalware ?? false,
          // Lot PRIO-1 : kits d'exploitation cités par Tenable (absent : aucun ; un passage suivant sans kit les retire).
          kits_exploitation: kitsRanges(c.kitsExploitation),
          faille_publiee_le: c.failleLe,
          correctif_publie_le: c.correctifLe,
          fin_support_le: c.finSupportLe,
          voir_aussi: c.voirAussi,
          cves_tronquees: c.cvesTronquees,
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'plugin_id']).doUpdateSet((eb) => ({
          nom: eb.ref('excluded.nom'),
          gravite: eb.ref('excluded.gravite'),
          famille: eb.ref('excluded.famille'),
          synopsis: eb.ref('excluded.synopsis'),
          correctif: eb.ref('excluded.correctif'),
          cvss3_vecteur: eb.ref('excluded.cvss3_vecteur'),
          cvss3_score: eb.ref('excluded.cvss3_score'),
          vpr_score: eb.ref('excluded.vpr_score'),
          epss_score: eb.ref('excluded.epss_score'),
          exploitable: eb.ref('excluded.exploitable'),
          exploit_libelle: eb.ref('excluded.exploit_libelle'),
          exploite_malware: eb.ref('excluded.exploite_malware'),
          kits_exploitation: eb.ref('excluded.kits_exploitation'),
          faille_publiee_le: eb.ref('excluded.faille_publiee_le'),
          correctif_publie_le: eb.ref('excluded.correctif_publie_le'),
          fin_support_le: eb.ref('excluded.fin_support_le'),
          voir_aussi: eb.ref('excluded.voir_aussi'),
          cves_tronquees: eb.ref('excluded.cves_tronquees'),
          vu_numero: sql`greatest(vulnerabilites_constats.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
        })),
      )
      .returning(['id', 'plugin_id'])
      .execute();
    const parPlugin = new Map(ids.map((r) => [String(r.plugin_id), r.id]));
    await k
      .deleteFrom('vulnerabilites_constat_cves')
      .where(
        'constat_id',
        'in',
        ids.map((r) => r.id),
      )
      .execute();
    const liens = uniques.flatMap((c) => c.cves.map((cve) => ({ constat_id: parPlugin.get(c.plugin)!, cve })));
    for (let i = 0; i < liens.length; i += 5000)
      await k
        .insertInto('vulnerabilites_constat_cves')
        .values(liens.slice(i, i + 5000))
        .execute();
  }

  /** Une détection se rattache à un constat et à une machine déjà rangés (lot courant ou précédent) : sinon, tout le lot est
      refusé. `premiereLaPlusAncienne` (import, lot N1) : la première détection rangée n'est jamais avancée (un scan ne donne
      que la date de son passage) ; sinon celle de la source la remplace (Tenable donne sa propre première détection). */
  private async rangerDetections(
    k: Kdb,
    integration: string,
    numero: number,
    el: ElementDetectionTenable[],
    premiereLaPlusAncienne = false,
  ) {
    if (!el.length) return;
    const d = dernierParCle(el, (x) => [x.plugin, x.machine, x.port, x.protocole].join('\u0000'));
    const r = await sql<{ id: string }>`
      INSERT INTO vulnerabilites_detections AS d (constat_id, machine_id, port, protocole, premiere_detection,
        derniere_detection, attenue, risque_accepte, risque_requalifie, vu_numero, vu_le)
      SELECT c.id, m.id, x.port, x.protocole, x.premiere, x.derniere, x.attenue, x.accepte, x.requalifie, ${numero}::int, now()
      FROM unnest(${d.map((x) => Number(x.plugin))}::int[], ${d.map((x) => x.machine)}::text[], ${d.map((x) => x.port)}::int[],
                  ${d.map((x) => x.protocole)}::text[], ${d.map((x) => x.premiere)}::timestamptz[],
                  ${d.map((x) => x.derniere)}::timestamptz[], ${d.map((x) => x.attenue)}::boolean[],
                  ${d.map((x) => x.risqueAccepte)}::boolean[], ${d.map((x) => x.risqueRequalifie)}::boolean[])
             AS x(plugin, cle, port, protocole, premiere, derniere, attenue, accepte, requalifie)
      JOIN vulnerabilites_constats c ON c.integration_id = ${integration}::uuid AND c.plugin_id = x.plugin
      JOIN vulnerabilites_machines m ON m.integration_id = ${integration}::uuid AND m.identifiant_source = x.cle
      ON CONFLICT (constat_id, machine_id, port, protocole) DO UPDATE SET
        premiere_detection = CASE WHEN ${premiereLaPlusAncienne}::boolean
                                  THEN least(d.premiere_detection, excluded.premiere_detection)
                                  ELSE coalesce(excluded.premiere_detection, d.premiere_detection) END,
        derniere_detection = coalesce(excluded.derniere_detection, d.derniere_detection),
        attenue = excluded.attenue,
        risque_accepte = excluded.risque_accepte,
        risque_requalifie = excluded.risque_requalifie,
        vu_numero = greatest(d.vu_numero, excluded.vu_numero),
        vu_le = now()
      RETURNING d.id`.execute(k);
    if (r.rows.length !== d.length)
      throw new HttpError(
        422,
        'Lot refusé : détection d’un constat ou d’une machine inconnus de cette synchronisation.',
      );
  }

  /** Inventaire : une machine connue (même identifiant dans Tenable, ou même adresse et même nom) est complétée ; sinon elle
      est ajoutée, identifiée par son UUID. Les champs déjà connus par l'analyse ne sont pas remplacés, sauf le système. */
  private async rangerHotes(k: Kdb, integration: string, numero: number, el: ElementHoteTenable[]) {
    if (!el.length) return;
    const hotes = dernierParCle(el, (h) => h.uuid);
    const cles = hotes.flatMap((h) => [`uuid:${h.uuid}`, ...(h.tenableUuid ? [`uuid:${h.tenableUuid}`] : [])]);
    const adresses = hotes.flatMap((h) => (h.adresse ? [h.adresse] : []));
    const connues = await k
      .selectFrom('vulnerabilites_machines')
      .select(['id', 'identifiant_source', 'adresse', 'nom'])
      .where('integration_id', '=', integration)
      .where((eb) =>
        eb.or([eb('identifiant_source', 'in', cles), ...(adresses.length ? [eb('adresse', 'in', adresses)] : [])]),
      )
      .execute();
    const parCle = new Map(connues.map((m) => [m.identifiant_source, m.id]));
    const nouvelles: ElementMachineTenable[] = [];
    for (const h of hotes) {
      const id =
        parCle.get(`uuid:${h.uuid}`) ??
        (h.tenableUuid ? parCle.get(`uuid:${h.tenableUuid}`) : undefined) ??
        (h.adresse ? connues.find((m) => m.adresse === h.adresse && m.nom === h.nom)?.id : undefined);
      if (id)
        await k
          .updateTable('vulnerabilites_machines')
          .set({
            nom: sql`coalesce(nom, ${h.nom}::text)`,
            adresse: sql`coalesce(adresse, ${h.adresse}::text)`,
            systeme: sql`coalesce(${h.systeme}::text, systeme)`,
            premiere_detection: sql`least(premiere_detection, ${h.premiere}::timestamptz)`,
            derniere_detection: sql`greatest(derniere_detection, ${h.derniere}::timestamptz)`,
            vu_numero: sql`greatest(vu_numero, ${numero}::int)`,
            maj_le: sql`now()`,
          })
          .where('id', '=', id)
          .execute();
      else
        nouvelles.push({
          type: 'machine',
          cle: cleMachine(h.uuid, h.adresse, h.nom)!,
          uuid: h.uuid,
          nom: h.nom,
          adresse: h.adresse,
          systeme: h.systeme,
          premiere: h.premiere,
          derniere: h.derniere,
          exposition: null,
          acr: null,
          aes: null,
        });
    }
    await this.rangerMachines(k, integration, numero, nouvelles);
  }

  /** Lot QF-TEN : correctifs regroupés de Tenable (`sumremediation`), rangés par (instance, identifiant) ; leurs contrôles
      sont rattachés aux constats déjà rangés de la même instance (un numéro inconnu n'est pas gardé) et remplacés à chaque
      synchronisation qui rapporte le correctif. Rien n'est supprimé : seuls ceux de la dernière synchronisation reçue en
      entier sont montrés (`correctifs_numero`). Deux requêtes par lot, plus une par tranche de 5 000 liens. */
  private async rangerCorrectifs(k: Kdb, integration: string, numero: number, el: ElementCorrectifTenable[]) {
    if (!el.length) return;
    const uniques = dernierParCle(el, (c) => c.identifiant);
    const ids = await k
      .insertInto('vulnerabilites_tenable_correctifs')
      .values(
        uniques.map((c) => ({
          integration_id: integration,
          solution_id: c.identifiant,
          solution: c.solution,
          machines: c.machines,
          cves: c.cves,
          detections: c.detections,
          vpr_score: c.vpr === null ? null : String(c.vpr),
          cvss3_score: c.cvss3Score === null ? null : String(c.cvss3Score),
          epss_score: c.epss === null ? null : String(c.epss),
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'solution_id']).doUpdateSet((eb) => ({
          solution: eb.ref('excluded.solution'),
          machines: eb.ref('excluded.machines'),
          cves: eb.ref('excluded.cves'),
          detections: eb.ref('excluded.detections'),
          vpr_score: eb.ref('excluded.vpr_score'),
          cvss3_score: eb.ref('excluded.cvss3_score'),
          epss_score: eb.ref('excluded.epss_score'),
          vu_numero: sql`greatest(vulnerabilites_tenable_correctifs.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
        })),
      )
      .returning(['id', 'solution_id'])
      .execute();
    const parIdentifiant = new Map(ids.map((r) => [r.solution_id, r.id]));
    await k
      .deleteFrom('vulnerabilites_tenable_correctif_constats')
      .where(
        'correctif_id',
        'in',
        ids.map((r) => r.id),
      )
      .execute();
    const liens = uniques.flatMap((c) =>
      c.plugins.map((p) => ({ id: parIdentifiant.get(c.identifiant)!, p: Number(p) })),
    );
    for (let i = 0; i < liens.length; i += 5000) {
      const t = liens.slice(i, i + 5000);
      await sql`
        INSERT INTO vulnerabilites_tenable_correctif_constats (correctif_id, constat_id)
        SELECT x.id, c.id FROM unnest(${t.map((l) => l.id)}::uuid[], ${t.map((l) => l.p)}::int[]) AS x(id, plugin)
        JOIN vulnerabilites_constats c ON c.integration_id = ${integration}::uuid AND c.plugin_id = x.plugin
        ON CONFLICT DO NOTHING`.execute(k);
    }
  }

  /* ---------------------------------------------------------------- Planification (tic de l'API) */
  /** Inscrit au plus une synchronisation par période réglée et par instance Tenable active dont les clés sont enregistrées. Les modules
      Intégrations et Vulnérabilités sont contrôlés par l'appelant ; flux « tenable » fermé : rien. */
  async planifier(maintenant = new Date()): Promise<string[]> {
    if (!(await this.flux.ouvert('tenable'))) return [];
    const instances = (await this.integrations.lister()).filter(
      (i) => i.type === 'tenable' && i.actif && Object.values(i.secrets).every(Boolean),
    );
    const ids: string[] = [];
    for (const i of instances)
      await this.db.tx(async (c, k) => {
        await verrouFileIntegrations(k);
        await this.integrations.menageFile(k, c);
        await k
          .insertInto('vulnerabilites_tenable_etat')
          .values({ integration_id: i.id })
          .onConflict((oc) => oc.column('integration_id').doNothing())
          .execute();
        const e = await k
          .selectFrom('vulnerabilites_tenable_etat')
          .select('planifiee_le')
          .where('integration_id', '=', i.id)
          .forUpdate()
          .executeTakeFirstOrThrow();
        // Lot F1 : au plus une par période réglée sur l'instance (vingt-quatre heures par défaut), comptée depuis la
        // dernière demande automatique.
        if (!echeanceAtteinte(e.planifiee_le, frequenceConnecteur(i.frequenceHeures), maintenant)) return;
        // Référence consommée d'abord : une synchronisation inscrite puis perdue, expirée ou en échec n'est pas redemandée
        // avant la période suivante.
        await k
          .updateTable('vulnerabilites_tenable_etat')
          .set({
            planifiee_le: referenceApresDemande(e.planifiee_le, frequenceConnecteur(i.frequenceHeures), maintenant),
          })
          .where('integration_id', '=', i.id)
          .execute();
        // Une exécution déjà en file ou en cours (demandée à la main, ou un test) tient lieu de celle du jour.
        const occupee = await k
          .selectFrom('integration_executions')
          .select('id')
          .where('integration_id', '=', i.id)
          .where('etat', 'in', ['en_file', 'en_cours'])
          .executeTakeFirst();
        if (!occupee)
          ids.push((await this.integrations.inscrire(k, c, i, 'synchroniser', 'planifie', PLANIFICATION, null)).id);
      });
    return ids;
  }

  /* ---------------------------------------------------------------- État (vulnerabilites:lire) */
  async etat(): Promise<EtatSynchronisationDto[]> {
    const instances = (await this.integrations.lister()).filter((i) => i.type === 'tenable');
    const fluxOuvert = await this.flux.ouvert('tenable');
    const maintenant = new Date();
    const out: EtatSynchronisationDto[] = [];
    for (const i of instances) {
      const e = await this.db.k
        .selectFrom('vulnerabilites_tenable_etat')
        .selectAll()
        .where('integration_id', '=', i.id)
        .executeTakeFirst();
      const d = await this.db.k
        .selectFrom('integration_executions')
        .selectAll()
        .where('integration_id', '=', i.id)
        .where('operation', '=', 'synchroniser')
        .orderBy('demande_le', 'desc')
        .orderBy('id')
        .limit(1)
        .executeTakeFirst();
      const gravites = Array.isArray(i.configuration.gravites)
        ? (i.configuration.gravites as GraviteTenable[])
        : [...GRAVITES_PAR_DEFAUT];
      const bilan = d?.resultat ? BilanSynchronisation.safeParse(d.resultat) : null;
      out.push({
        integrationId: i.id,
        nom: i.nom,
        actif: i.actif,
        gravites,
        derniere: d
          ? {
              id: d.id,
              etat: d.etat as NonNullable<EtatSynchronisationDto['derniere']>['etat'],
              origine: d.origine as 'manuel' | 'planifie',
              demandeLe: d.demande_le.toISOString(),
              termineLe: d.termine_le?.toISOString() ?? null,
              bilan: bilan?.success ? bilan.data : null,
              erreur: d.erreur,
            }
          : null,
        derniereCompleteLe: e?.complete_le?.toISOString() ?? null,
        inventaire:
          e && e.inventaire_ok !== null && e.inventaire_le
            ? { ok: e.inventaire_ok, erreur: e.inventaire_erreur, le: e.inventaire_le.toISOString() }
            : null,
        frequenceHeures: frequenceConnecteur(i.frequenceHeures),
        // Lot F1 : prochaine synchronisation automatique, seulement pour une instance que le planificateur traite.
        prochaineSynchronisation:
          fluxOuvert && i.actif && Object.values(i.secrets).every(Boolean)
            ? prochaineAffichee(
                e?.planifiee_le ?? null,
                frequenceConnecteur(i.frequenceHeures),
                maintenant,
              ).toISOString()
            : null,
      });
    }
    return out;
  }
}
