/* Module Vulnérabilités (ADR 0100, lot SI1 ; décisions du RSSI du 19/11/2026) : import du rapport Silène de l'ANSSI déposé
   dans la carte « Intégrations » (connecteur « silene-fichier » : ni adresse, ni clé, ni flux, ni exécutant). Le rapport
   JSON est lu dans le navigateur ; l'API ne lit aucun rapport : elle reçoit un extrait en liste blanche, en trois temps
   (début, lots d'hôtes et de constats, fin), revalidé champ par champ (packages/shared/src/import-silene.ts). Protocole du
   lot N1 (import-nessus.ts) :
   - un import est une exécution de l'instance (opération « importer »), inscrite « en cours » au début sous le nom de la
     personne qui importe : elle seule envoie ses lots et le termine ; un import à la fois par instance ; resté sans lot
     trente minutes, il est clos comme interrompu (au début d'un autre import, ou au tic de l'API) ;
   - un import est l'état complet de la surface vue par Silène à la date du rapport : chaque import reçoit un numéro ; ses
     hôtes et constats sont rangés sans doublon (instance et adresse, instance et identifiant), leurs noms, ports, produits,
     hôtes concernés et lignes remplacés ; à la fin d'un import complet (tous les hôtes et constats annoncés reçus), le numéro
     de référence avance : ce qui n'était pas dans le rapport n'est plus présent (rien n'est supprimé). Un import interrompu
     laisse la référence où elle était (les éléments déjà rangés le restent) ;
   - la synthèse du rapport (note, sous-note réseau, nombres par famille, dates) et le périmètre déclaré sont gardés avec
     l'import : la note des imports complets successifs fait la tendance.
   Aucun effet sur les priorités ni sur les alertes du module (un constat Silène n'a pas de CVE ; correspondance classe →
   priorité en attente d'une décision du RSSI). Journal `integration.import.*`, `vulnerabilites.silene.lot` et
   `integration.supprimee` : instance, exécution et nombres seulement ; jamais une adresse, un nom ni un nom de fichier. */
import {
  BilanImportSilene,
  type DebutImportSilene,
  type DebutImportSileneDto,
  type EcartsImportSilene,
  type LotImportSilene,
  type ResultatLotSileneDto,
  SILENE_BORNES,
  type SuppressionSileneDto,
  TYPE_SILENE_FICHIER,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { analyserTables } from '../db/analyser.js';
import type { Actor, Client, Db, Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { type Integrations, verrouFileIntegrations } from '../integrations/index.js';

const PLANIFICATION = { username: 'planification' };
const INACTIVITE = sql<Date>`now() - make_interval(mins => ${SILENE_BORNES.inactiviteMinutes})`;
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

interface LigneImport {
  execution_id: string;
  integration_id: string;
  numero: number;
  hotes_annonces: number;
  constats_annonces: number;
  ecartes: unknown;
  lots: number;
  hotes: number;
  constats: number;
  hotes_disparus: number;
  constats_disparus: number;
}

export class ImportSilene {
  constructor(
    private readonly db: Db,
    private readonly integrations: Integrations,
  ) {}

  /* ---------------------------------------------------------------- Début */
  async debuter(id: string, body: DebutImportSilene, user: SessionUser, ip: string): Promise<DebutImportSileneDto> {
    const i = await this.integrations.lire(id);
    if (i.type !== TYPE_SILENE_FICHIER) throw new HttpError(422, 'Ce connecteur ne reçoit pas de rapport Silène.');
    if (!i.actif) throw new HttpError(409, 'Activez d’abord ce connecteur.');
    return this.db.tx(async (c, k) => {
      await verrouFileIntegrations(k);
      await this.clore(k, c, id);
      const active = await k
        .selectFrom('integration_executions')
        .select('id')
        .where('integration_id', '=', id)
        .where('etat', 'in', ['en_file', 'en_cours'])
        .executeTakeFirst();
      if (active) throw new HttpError(409, 'Un import de ce connecteur est déjà en cours.');
      const x = await k
        .insertInto('integration_executions')
        .values({
          integration_id: id,
          operation: 'importer',
          origine: 'manuel',
          etat: 'en_cours',
          demande_par: user.username,
          debute_le: sql<Date>`now()`,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await k
        .insertInto('vulnerabilites_silene_etat')
        .values({ integration_id: id })
        .onConflict((oc) => oc.column('integration_id').doNothing())
        .execute();
      const { numero } = await k
        .updateTable('vulnerabilites_silene_etat')
        .set((eb) => ({ numero: eb('numero', '+', 1) }))
        .where('integration_id', '=', id)
        .returning('numero')
        .executeTakeFirstOrThrow();
      const r = body.rapport;
      await k
        .insertInto('vulnerabilites_silene_imports')
        .values({
          execution_id: x.id,
          integration_id: id,
          numero,
          date_rapport: r.date,
          debut_rapport: r.debut,
          fin_rapport: r.fin,
          note: r.note === null ? null : String(r.note),
          note_reseau: r.noteReseau === null ? null : String(r.noteReseau),
          vulnreco: r.vulnreco,
          warning: r.warning,
          info: r.info,
          ok: r.ok,
          perimetre_domaines: body.perimetre.domaines,
          perimetre_plages: body.perimetre.plages,
          hotes_annonces: body.hotes,
          constats_annonces: body.constats,
          ecartes: JSON.stringify(body.ecartes),
        })
        .execute();
      await this.db.audit(
        user,
        ip,
        'integration.import.debute',
        x.id,
        {
          integration: id,
          type: i.type,
          numero,
          hotesAnnonces: body.hotes,
          constatsAnnonces: body.constats,
          perimetre: { domaines: body.perimetre.domaines.length, plages: body.perimetre.plages.length },
          ecartes: body.ecartes,
        },
        c,
      );
      return { id: x.id };
    }, user.username);
  }

  /* ---------------------------------------------------------------- Lot */
  async lot(
    id: string,
    executionId: string,
    lot: LotImportSilene,
    user: SessionUser,
    ip: string,
  ): Promise<ResultatLotSileneDto> {
    return this.db.tx(async (c, k) => {
      const imp = await this.importEnCours(k, id, executionId, user);
      if (imp.lots >= SILENE_BORNES.lotsParImport) throw new HttpError(409, 'Nombre de lots dépassé pour cet import.');
      if (imp.hotes + lot.hotes.length > imp.hotes_annonces)
        throw new HttpError(422, 'Lot refusé : plus d’hôtes que l’import n’en annonçait.');
      if (imp.constats + lot.constats.length > imp.constats_annonces)
        throw new HttpError(422, 'Lot refusé : plus de constats que l’import n’en annonçait.');
      await this.rangerHotes(k, id, imp.numero, lot.hotes);
      await this.rangerConstats(k, id, imp.numero, lot.constats);
      const r = await k
        .updateTable('vulnerabilites_silene_imports')
        .set((eb) => ({
          lots: eb('lots', '+', 1),
          hotes: eb('hotes', '+', lot.hotes.length),
          constats: eb('constats', '+', lot.constats.length),
          maj_le: sql<Date>`now()`,
        }))
        .where('execution_id', '=', executionId)
        .returning(['lots', 'hotes', 'constats'])
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.silene.lot',
        executionId,
        {
          integration: id,
          numero: imp.numero,
          hotes: lot.hotes.length,
          ports: lot.hotes.reduce((s, h) => s + h.ports.length, 0),
          constats: lot.constats.length,
          lignes: lot.constats.reduce((s, x) => s + x.lignes.length, 0),
        },
        c,
      );
      return { lots: r.lots, hotes: r.hotes, constats: r.constats };
    }, user.username);
  }

  /** Hôtes : rangés sans doublon (instance, adresse), vus par cet import ; noms, ports et produits remplacés. */
  private async rangerHotes(k: Kdb, integration: string, numero: number, hotes: LotImportSilene['hotes']) {
    if (!hotes.length) return;
    const lignes = await k
      .insertInto('vulnerabilites_silene_hotes')
      .values(
        hotes.map((h) => ({
          integration_id: integration,
          adresse: h.adresse,
          ports_ouverts: h.portsOuverts,
          controles: h.controles,
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'adresse']).doUpdateSet((eb) => ({
          ports_ouverts: eb.ref('excluded.ports_ouverts'),
          controles: eb.ref('excluded.controles'),
          vu_numero: sql`greatest(vulnerabilites_silene_hotes.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
        })),
      )
      .returning(['id', 'adresse'])
      .execute();
    const ids = new Map(lignes.map((l) => [l.adresse, l.id]));
    const tous = [...ids.values()];
    await k.deleteFrom('vulnerabilites_silene_noms').where('hote_id', 'in', tous).execute();
    await k.deleteFrom('vulnerabilites_silene_ports').where('hote_id', 'in', tous).execute();
    await k.deleteFrom('vulnerabilites_silene_produits').where('hote_id', 'in', tous).execute();
    const noms = hotes.flatMap((h) => h.noms.map((n) => ({ hote_id: ids.get(h.adresse)!, nom: n.nom, type: n.type })));
    const ports = hotes.flatMap((h) =>
      h.ports.map((p) => ({
        hote_id: ids.get(h.adresse)!,
        port: p.port,
        protocole: p.protocole,
        service: p.service,
        produit: p.produit,
        tunnel: p.tunnel,
      })),
    );
    const produits = hotes.flatMap((h) =>
      h.produits.map((p, rang) => ({
        hote_id: ids.get(h.adresse)!,
        rang,
        type: p.type,
        editeur: p.editeur,
        produit: p.produit,
        version: p.version,
      })),
    );
    for (let i = 0; i < noms.length; i += 2000)
      await k
        .insertInto('vulnerabilites_silene_noms')
        .values(noms.slice(i, i + 2000))
        .execute();
    for (let i = 0; i < ports.length; i += 2000)
      await k
        .insertInto('vulnerabilites_silene_ports')
        .values(ports.slice(i, i + 2000))
        .execute();
    for (let i = 0; i < produits.length; i += 2000)
      await k
        .insertInto('vulnerabilites_silene_produits')
        .values(produits.slice(i, i + 2000))
        .execute();
  }

  /** Constats : rangés sans doublon (instance, identifiant), vus par cet import ; hôtes concernés et lignes remplacés. */
  private async rangerConstats(k: Kdb, integration: string, numero: number, constats: LotImportSilene['constats']) {
    if (!constats.length) return;
    const lignes = await k
      .insertInto('vulnerabilites_silene_constats')
      .values(
        constats.map((x) => ({
          integration_id: integration,
          identifiant: x.identifiant,
          controle: x.controle,
          classe: x.classe,
          points: x.points === null ? null : String(x.points),
          note: x.note === null ? null : String(x.note),
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'identifiant']).doUpdateSet((eb) => ({
          controle: eb.ref('excluded.controle'),
          classe: eb.ref('excluded.classe'),
          points: eb.ref('excluded.points'),
          note: eb.ref('excluded.note'),
          vu_numero: sql`greatest(vulnerabilites_silene_constats.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
        })),
      )
      .returning(['id', 'identifiant'])
      .execute();
    const ids = new Map(lignes.map((l) => [l.identifiant, l.id]));
    const tous = [...ids.values()];
    await k.deleteFrom('vulnerabilites_silene_constat_hotes').where('constat_id', 'in', tous).execute();
    await k.deleteFrom('vulnerabilites_silene_lignes').where('constat_id', 'in', tous).execute();
    const hotes = constats.flatMap((x) => x.hotes.map((a) => ({ constat_id: ids.get(x.identifiant)!, adresse: a })));
    const details = constats.flatMap((x) =>
      x.lignes.map((l, rang) => ({
        constat_id: ids.get(x.identifiant)!,
        rang,
        adresse: l.hote,
        port: l.port,
        protocole: l.protocole,
        service: l.service,
        produit: l.produit,
        nom_hote: l.nomHote,
        type: l.type,
        echeance: l.echeance,
      })),
    );
    for (let i = 0; i < hotes.length; i += 5000)
      await k
        .insertInto('vulnerabilites_silene_constat_hotes')
        .values(hotes.slice(i, i + 5000))
        .execute();
    for (let i = 0; i < details.length; i += 2000)
      await k
        .insertInto('vulnerabilites_silene_lignes')
        .values(details.slice(i, i + 2000))
        .execute();
  }

  /* ---------------------------------------------------------------- Fin */
  /** Fin d'un import : reçu et faisant foi si tous les hôtes et constats annoncés sont rangés, sinon en échec (les éléments
      rangés le restent, la référence de présence ne bouge pas). */
  /** Après la fin d'un import, hors transaction : statistiques des tables réécrites par les lots (comme après une
      synchronisation reçue de Security Center ou d'AlgoLightHouse). Ne lève jamais. */
  async apresValidation(): Promise<void> {
    await analyserTables(
      this.db.k,
      [
        'vulnerabilites_silene_hotes',
        'vulnerabilites_silene_noms',
        'vulnerabilites_silene_ports',
        'vulnerabilites_silene_produits',
        'vulnerabilites_silene_constats',
        'vulnerabilites_silene_constat_hotes',
        'vulnerabilites_silene_lignes',
      ],
      this.db.log,
    );
  }

  async terminer(id: string, executionId: string, user: SessionUser, ip: string): Promise<BilanImportSilene> {
    return this.db.tx(async (c, k) => {
      const imp = await this.importEnCours(k, id, executionId, user);
      return this.cloreImport(k, c, imp, user, ip, null);
    }, user.username);
  }

  /** Clôt les imports de l'instance (ou de toutes) restés sans lot pendant trente minutes. Sous le verrou de la file. */
  async clore(k: Kdb, c: Client, integrationId?: string): Promise<number> {
    let q = k
      .selectFrom('vulnerabilites_silene_imports as v')
      .innerJoin('integration_executions as x', 'x.id', 'v.execution_id')
      .selectAll('v')
      .where('x.etat', '=', 'en_cours')
      .where('v.maj_le', '<', INACTIVITE)
      .orderBy('v.maj_le')
      .forUpdate();
    if (integrationId) q = q.where('v.integration_id', '=', integrationId);
    const lignes = (await q.execute()) as unknown as LigneImport[];
    for (const l of lignes)
      await this.cloreImport(k, c, l, PLANIFICATION, null, 'Import abandonné : aucun lot reçu depuis trente minutes.');
    return lignes.length;
  }

  /** Tic de l'API : clôt les imports abandonnés (le module Vulnérabilités est contrôlé par l'appelant). */
  async tic(): Promise<number> {
    return this.db.tx(async (c, k) => {
      await verrouFileIntegrations(k);
      return this.clore(k, c);
    });
  }

  /* ---------------------------------------------------------------- Suppression */
  /** Ce que la suppression ferait disparaître (fenêtre de confirmation). */
  async apercuSuppression(id: string): Promise<SuppressionSileneDto> {
    const i = await this.integrations.lire(id);
    if (i.type !== TYPE_SILENE_FICHIER) throw new HttpError(422, 'Ce connecteur n’est pas un import Silène.');
    return this.compter(this.db.k, id);
  }

  /** Supprime une instance « Silène, import de fichier » et tout ce qu'elle a importé (même décision que le lot N2), If-Match
      sur la version de l'instance ; refus pendant un import en cours (409). Les clés étrangères effacent en cascade :
      exécutions, journal des imports et notes, état des numéros, liaison du périmètre, hôtes et leurs noms, ports et
      produits, constats, hôtes concernés et lignes. Aucun autre objet du module n'en dépend (ni priorité, ni alerte, ni
      suivi). Restent le journal d'audit et l'historique du suivi (sans objet ici). Journal : type et nombres seulement. */
  async supprimer(id: string, attendue: number, user: SessionUser, ip: string): Promise<SuppressionSileneDto> {
    return this.db.tx(async (c, k) => {
      await verrouFileIntegrations(k);
      const avant = await this.integrations.lire(id, k, true);
      if (avant.type !== TYPE_SILENE_FICHIER) throw new HttpError(422, 'Ce connecteur n’est pas un import Silène.');
      if (avant.version !== attendue) throw conflict({ ...avant, updated_by: avant.updatedBy });
      await this.clore(k, c, id);
      const active = await k
        .selectFrom('integration_executions')
        .select('id')
        .where('integration_id', '=', id)
        .where('etat', 'in', ['en_file', 'en_cours'])
        .executeTakeFirst();
      if (active)
        throw new HttpError(409, 'Un import de ce connecteur est en cours : attendez sa fin pour le supprimer.');
      const n = await this.compter(k, id);
      await k.deleteFrom('integrations').where('id', '=', id).execute();
      await this.db.audit(user, ip, 'integration.supprimee', id, { type: avant.type, ...n }, c);
      return n;
    }, user.username);
  }

  private async compter(k: Kdb, id: string): Promise<SuppressionSileneDto> {
    const { rows } = await sql<SuppressionSileneDto>`SELECT
        (SELECT count(*)::int FROM vulnerabilites_silene_hotes WHERE integration_id = ${id}::uuid) AS hotes,
        (SELECT count(*)::int FROM vulnerabilites_silene_constats WHERE integration_id = ${id}::uuid) AS constats,
        (SELECT count(*)::int FROM vulnerabilites_silene_imports WHERE integration_id = ${id}::uuid) AS imports`.execute(
      k,
    );
    return rows[0]!;
  }

  /* ---------------------------------------------------------------- Interne */
  /** Import en cours de l'instance, verrouillé ; seule la personne qui l'a commencé l'alimente et le termine. */
  private async importEnCours(k: Kdb, id: string, executionId: string, user: SessionUser): Promise<LigneImport> {
    const r = await k
      .selectFrom('vulnerabilites_silene_imports as v')
      .innerJoin('integration_executions as x', 'x.id', 'v.execution_id')
      .selectAll('v')
      .select(['x.etat', 'x.demande_par'])
      .where('v.execution_id', '=', executionId)
      .where('v.integration_id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Import introuvable.');
    if (r.etat !== 'en_cours') throw new HttpError(409, 'Import déjà terminé : recommencez l’import du fichier.');
    if (r.demande_par !== user.username)
      throw new HttpError(409, 'Cet import a été commencé par une autre personne : elle seule peut le poursuivre.');
    return r as unknown as LigneImport;
  }

  /** Termine un import : complet, il fait foi (référence de présence avancée, disparus comptés) ; sinon en échec. */
  private async cloreImport(
    k: Kdb,
    c: Client,
    l: LigneImport,
    acteur: Actor,
    ip: string | null,
    motif: string | null,
  ): Promise<BilanImportSilene> {
    const complet = l.hotes === l.hotes_annonces && l.constats === l.constats_annonces;
    let hotesDisparus = 0;
    let constatsDisparus = 0;
    if (complet) {
      const e = await k
        .selectFrom('vulnerabilites_silene_etat')
        .select('numero_complet')
        .where('integration_id', '=', l.integration_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      // Présents avant (vus depuis la référence) et absents de ce rapport.
      const { rows } = await sql<{ h: number; c: number }>`SELECT
          (SELECT count(*)::int FROM vulnerabilites_silene_hotes WHERE integration_id = ${l.integration_id}::uuid
             AND vu_numero >= ${e.numero_complet}::int AND vu_numero < ${l.numero}::int) AS h,
          (SELECT count(*)::int FROM vulnerabilites_silene_constats WHERE integration_id = ${l.integration_id}::uuid
             AND vu_numero >= ${e.numero_complet}::int AND vu_numero < ${l.numero}::int) AS c`.execute(k);
      hotesDisparus = rows[0]?.h ?? 0;
      constatsDisparus = rows[0]?.c ?? 0;
      await k
        .updateTable('vulnerabilites_silene_etat')
        .set((eb) => ({
          numero_complet: sql<number>`greatest(${eb.ref('numero_complet')}, ${l.numero}::int)`,
          complete_le: sql<Date>`now()`,
        }))
        .where('integration_id', '=', l.integration_id)
        .execute();
    }
    await k
      .updateTable('vulnerabilites_silene_imports')
      .set({ complet, hotes_disparus: hotesDisparus, constats_disparus: constatsDisparus, maj_le: sql<Date>`now()` })
      .where('execution_id', '=', l.execution_id)
      .execute();
    const bilan = BilanImportSilene.parse({
      hotesAnnonces: l.hotes_annonces,
      hotes: l.hotes,
      constatsAnnonces: l.constats_annonces,
      constats: l.constats,
      lots: l.lots,
      hotesDisparus,
      constatsDisparus,
      ecartes: l.ecartes as EcartsImportSilene,
    });
    const erreur = complet
      ? null
      : `${motif ?? 'Import interrompu.'} ${pluriel(l.hotes, 'hôte importé', 'hôtes importés')} sur ${l.hotes_annonces}, ${pluriel(l.constats, 'constat importé', 'constats importés')} sur ${l.constats_annonces} ; le rapport précédent reste celui qui fait foi, réimportez le fichier.`;
    await k
      .updateTable('integration_executions')
      .set({
        etat: complet ? 'recu' : 'echec',
        termine_le: sql<Date>`now()`,
        resultat: complet ? JSON.stringify(bilan) : null,
        erreur: erreur ? erreur.slice(0, 300) : null,
      })
      .where('id', '=', l.execution_id)
      .execute();
    await this.db.audit(
      acteur,
      ip,
      'integration.import.termine',
      l.execution_id,
      { integration: l.integration_id, etat: complet ? 'recu' : 'echec', numero: l.numero, ...bilan },
      c,
    );
    return bilan;
  }
}
