/* Module Vulnérabilités (ADR 0100, lot AD-1 ; décisions du RSSI du 20/11/2026) : rapport d'analyse de l'Active Directory
   (service ADS de l'ANSSI, à partir d'une collecte ORADAD), importé depuis la page « Active Directory » du module. Le rapport
   JSON est lu dans le navigateur ; l'API ne lit aucun rapport : elle reçoit un extrait en liste blanche, en une requête,
   revalidé champ par champ (packages/shared/src/import-ads.ts).
   - Import (`vulnerabilites:administrer`, limite horaire des imports de fichiers partagée avec Nessus et Silène) : un numéro
     par import, la synthèse, les points non conformes et, bornés, les noms des objets concernés. Dans la même transaction,
     les noms des imports plus anciens que les deux derniers sont effacés (seuls leurs nombres restent).
   - Lecture (`vulnerabilites:lire`) : nombres seulement (note, progression, points ouverts, objets et variation, corrigés).
     Aucun nom ne figure dans cette réponse, quel que soit le droit de la personne.
   - Noms d'un point (`vulnerabilites:lire` : voir les noms fait partie du droit « Analyste », branché sur l'accès au module
     en attendant le lot 3 de l'ADR 0092 ; décision du RSSI du 20/11/2026), par une route à part, point par point : dernier
     import et comparaison avec le précédent ; chaque consultation est tracée au journal d'audit (qui, quand, quel point),
     sans aucun nom.
   - Suppression d'un import (`vulnerabilites:administrer`, If-Match) : noms et nombres.
   Les noms ne sortent jamais de la plateforme : ce service ne notifie pas, n'écrit aucun nom au journal d'audit ni au
   journal applicatif, et rien d'ici n'est lu par l'assistant, les rapports, les courriels ni la recherche du module.
   Aucun effet sur les priorités ni sur les alertes du module. Les données sont celles de l'organisation, sans périmètre. */
import {
  ADS_BORNES,
  type AnnuaireAdsDto,
  type BilanImportAdsDto,
  type EcartsImportAds,
  type ImportAds,
  type ImportAdsDto,
  type NomObjetAds,
  type NomsPointAdsDto,
  type PointCorrigeAdsDto,
  type PointOuvertAdsDto,
  type ProgressionNiveauAds,
  type TypePointAds,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { analyserTables } from '../db/analyser.js';
import type { Db, Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';

interface LigneImport {
  id: string;
  numero: number;
  version: number;
  date_rapport: string | null;
  note: number;
  progression: unknown;
  conformes: number | null;
  points: number;
  objets: number | string;
  noms_conserves: boolean;
  importe_par: string;
  importe_le: Date;
}

const versDto = (l: LigneImport): ImportAdsDto => ({
  id: l.id,
  numero: l.numero,
  version: l.version,
  dateRapport: l.date_rapport,
  note: l.note,
  progression: l.progression as ProgressionNiveauAds[],
  conformes: l.conformes,
  points: l.points,
  objets: Number(l.objets),
  nomsConserves: l.noms_conserves,
  importePar: l.importe_par,
  importeLe: l.importe_le.toISOString(),
});

const cleNom = (n: NomObjetAds) => `${n.nature}\u0000${n.nom}`;

export class AnnuaireAd {
  constructor(private readonly db: Db) {}

  private imports(k: Kdb) {
    return k
      .selectFrom('vulnerabilites_ad_imports')
      .select([
        'id',
        'numero',
        'version',
        sql<string | null>`to_char(date_rapport, 'YYYY-MM-DD')`.as('date_rapport'),
        'note',
        'progression',
        'conformes',
        'points',
        'objets',
        'noms_conserves',
        'importe_par',
        'importe_le',
      ])
      .orderBy('numero', 'desc');
  }

  /* ---------------------------------------------------------------- Import */
  async importer(body: ImportAds, user: SessionUser, ip: string): Promise<BilanImportAdsDto> {
    return this.db.tx(async (c, k) => {
      // Un import à la fois : le numéro suit le plus grand attribué.
      await sql`LOCK TABLE vulnerabilites_ad_imports IN SHARE ROW EXCLUSIVE MODE`.execute(k);
      const { numero } = await k
        .selectFrom('vulnerabilites_ad_imports')
        .select(sql<number>`coalesce(max(numero), 0) + 1`.as('numero'))
        .executeTakeFirstOrThrow();
      const objets = body.points.reduce((s, p) => s + p.objets, 0);
      const noms = body.points.reduce((s, p) => s + p.noms.length, 0);
      const r = body.rapport;
      const imp = await k
        .insertInto('vulnerabilites_ad_imports')
        .values({
          numero,
          date_rapport: r.date,
          note: r.note,
          progression: JSON.stringify(r.progression),
          conformes: r.conformes,
          points: body.points.length,
          objets,
          ecartes: JSON.stringify(body.ecartes),
          importe_par: user.username,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (body.points.length) {
        const points = await k
          .insertInto('vulnerabilites_ad_points')
          .values(
            body.points.map((p) => ({
              import_id: imp.id,
              identifiant: p.identifiant,
              reference: p.reference,
              type: p.type,
              niveau: p.niveau,
              titre: p.titre,
              objets: p.objets,
            })),
          )
          .returning(['id', 'identifiant'])
          .execute();
        const ids = new Map(points.map((p) => [p.identifiant, p.id]));
        const lignes = body.points.flatMap((p) =>
          p.noms.map((n, rang) => ({ point_id: ids.get(p.identifiant)!, rang, nom: n.nom, nature: n.nature })),
        );
        for (let i = 0; i < lignes.length; i += 5000)
          await k
            .insertInto('vulnerabilites_ad_objets')
            .values(lignes.slice(i, i + 5000))
            .execute();
      }
      const nomsPurges = await this.purger(k);
      const ecartes: EcartsImportAds = body.ecartes;
      // Journal : numéro et nombres seulement ; ni nom d'objet, ni titre, ni nom de fichier.
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.annuaire.importe',
        imp.id,
        { numero, note: r.note, points: body.points.length, objets, noms, nomsPurges, ecartes },
        c,
      );
      return { id: imp.id, numero, points: body.points.length, objets, noms, nomsPurges, ecartes };
    }, user.username);
  }

  /** Efface les noms des imports plus anciens que les deux derniers (décision 4 du RSSI) ; rend le nombre d'imports purgés. */
  private async purger(k: Kdb): Promise<number> {
    const anciens = await k
      .selectFrom('vulnerabilites_ad_imports')
      .select('id')
      .where('noms_conserves', '=', true)
      .where(
        'id',
        'not in',
        k
          .selectFrom('vulnerabilites_ad_imports')
          .select('id')
          .orderBy('numero', 'desc')
          .limit(ADS_BORNES.importsAvecNoms),
      )
      .execute();
    if (!anciens.length) return 0;
    const ids = anciens.map((a) => a.id);
    await k
      .deleteFrom('vulnerabilites_ad_objets')
      .where('point_id', 'in', k.selectFrom('vulnerabilites_ad_points').select('id').where('import_id', 'in', ids))
      .execute();
    await k.updateTable('vulnerabilites_ad_imports').set({ noms_conserves: false }).where('id', 'in', ids).execute();
    return ids.length;
  }

  /** Après l'import, hors transaction : statistiques des tables qui grossissent (comme après un import Silène). */
  async apresValidation(): Promise<void> {
    await analyserTables(this.db.k, ['vulnerabilites_ad_points', 'vulnerabilites_ad_objets'], this.db.log);
  }

  /* ---------------------------------------------------------------- Lecture (nombres seulement) */
  async lire(): Promise<AnnuaireAdsDto> {
    const k = this.db.k;
    const historique = ((await this.imports(k).limit(ADS_BORNES.historique).execute()) as LigneImport[]).map(versDto);
    const courant = historique[0] ?? null;
    const precedent = historique[1] ?? null;
    const pointsDe = async (importId: string) =>
      k
        .selectFrom('vulnerabilites_ad_points')
        .select(['identifiant', 'reference', 'type', 'niveau', 'titre', 'objets'])
        .where('import_id', '=', importId)
        .execute();
    const maintenant = courant ? await pointsDe(courant.id) : [];
    const avant = precedent ? await pointsDe(precedent.id) : [];
    const avantPar = new Map(avant.map((p) => [p.identifiant, p]));
    const presents = new Set(maintenant.map((p) => p.identifiant));
    const ordre = (a: { type: number; niveau: number; identifiant: string }, b: typeof a) =>
      b.type - a.type || a.niveau - b.niveau || a.identifiant.localeCompare(b.identifiant);
    const points: PointOuvertAdsDto[] = maintenant.sort(ordre).map((p) => {
      const a = avantPar.get(p.identifiant);
      return {
        ...p,
        type: p.type as TypePointAds,
        objetsAvant: a ? a.objets : null,
        apparu: precedent !== null && !a,
      };
    });
    const corriges: PointCorrigeAdsDto[] = avant
      .filter((p) => !presents.has(p.identifiant))
      .sort(ordre)
      .map((p) => ({ ...p, type: p.type as TypePointAds }));
    return { courant, precedent, historique, points, corriges };
  }

  /* ---------------------------------------------------------------- Noms d'un point (consultation tracée) */
  async noms(identifiant: string, user: SessionUser, ip: string): Promise<NomsPointAdsDto> {
    return this.db.tx(async (c, k) => {
      const deux = (await this.imports(k).limit(2).execute()) as LigneImport[];
      const courant = deux[0];
      if (!courant) throw new HttpError(404, 'Aucun rapport de l’Active Directory importé.');
      const precedent = deux[1] ?? null;
      const point = async (imp: LigneImport | null) => {
        if (!imp) return null;
        const p = await k
          .selectFrom('vulnerabilites_ad_points')
          .select(['id', 'titre', 'objets'])
          .where('import_id', '=', imp.id)
          .where('identifiant', '=', identifiant)
          .executeTakeFirst();
        if (!p) return null;
        const noms = await k
          .selectFrom('vulnerabilites_ad_objets')
          .select(['nom', 'nature'])
          .where('point_id', '=', p.id)
          .orderBy('rang')
          .execute();
        return { ...p, noms: noms as NomObjetAds[], complet: imp.noms_conserves && noms.length === p.objets };
      };
      const ici = await point(courant);
      const la = await point(precedent);
      if (!ici && !la) throw new HttpError(404, 'Point de contrôle introuvable dans les deux derniers imports.');
      const nomsIci = ici?.noms ?? [];
      let comparaison: NomsPointAdsDto['comparaison'] = null;
      if (precedent && precedent.noms_conserves) {
        const nomsLa = la?.noms ?? [];
        const avant = new Set(nomsLa.map(cleNom));
        const apres = new Set(nomsIci.map(cleNom));
        comparaison = {
          numero: precedent.numero,
          apparus: nomsIci.filter((n) => !avant.has(cleNom(n))),
          corriges: nomsLa.filter((n) => !apres.has(cleNom(n))),
          complete: (ici ? ici.complet : true) && (la ? la.complet : true),
        };
      }
      // Trace de la consultation : qui (la session), quand (l'horodatage du journal), quel point ; nombres seulement.
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.annuaire.noms.consultes',
        courant.id,
        {
          point: identifiant,
          numero: courant.numero,
          noms: nomsIci.length,
          apparus: comparaison?.apparus.length ?? null,
          corriges: comparaison?.corriges.length ?? null,
        },
        c,
      );
      return {
        identifiant,
        titre: (ici ?? la)!.titre,
        numero: courant.numero,
        noms: nomsIci,
        sansNom: ici ? ici.objets - nomsIci.length : 0,
        comparaison,
      };
    }, user.username);
  }

  /* ---------------------------------------------------------------- Suppression */
  /** Supprime un import, ses points et ses noms (If-Match sur sa version). Journal : numéro et nombres seulement. */
  async supprimer(
    id: string,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<{ points: number; noms: number }> {
    return this.db.tx(async (c, k) => {
      const l = (await this.imports(k).where('id', '=', id).forUpdate().executeTakeFirst()) as LigneImport | undefined;
      if (!l) throw new HttpError(404, 'Import introuvable.');
      if (l.version !== attendue) throw conflict({ ...versDto(l), updated_by: l.importe_par });
      const { noms } = await k
        .selectFrom('vulnerabilites_ad_objets as o')
        .innerJoin('vulnerabilites_ad_points as p', 'p.id', 'o.point_id')
        .select(sql<number>`count(*)::int`.as('noms'))
        .where('p.import_id', '=', id)
        .executeTakeFirstOrThrow();
      await k.deleteFrom('vulnerabilites_ad_imports').where('id', '=', id).execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.annuaire.import.supprime',
        id,
        { numero: l.numero, points: l.points, objets: Number(l.objets), noms },
        c,
      );
      return { points: l.points, noms };
    }, user.username);
  }
}
