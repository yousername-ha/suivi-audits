/* Module Vulnérabilités (ADR 0100, lot SI1) : lecture de la surface externe importée de Silène (ANSSI), à côté
   d'AlgoLightHouse, en lecture seule. Une seule surface externe, deux sources :
   - droits : même logique que la surface externe d'AlgoLightHouse et même fragment (`lisibleAlh`, alias `sp`) : tout ce
     qu'une instance a importé hérite du périmètre de la plateforme relié à l'instance (écran « Périmètres » du module) ;
     non reliée, elle n'est lisible qu'avec vulnerabilites:administrer. Aucun mécanisme de droits nouveau ;
   - présence : vu par le dernier import complet de l'instance (alias `se`), ou plus récemment ;
   - actifs : un actif est identifié par son adresse IP (hôte) ou son nom de domaine (nom de résolution directe d'un hôte,
     TYPES_NOM_ACTIF). `clesActifs` rend les actifs lisibles vus par Silène, `actifs` ce que Silène dit d'une liste de clés
     (type, valeur) : la liste « Actifs » de SurfaceExterneAlh les réunit avec AlgoLightHouse, et la carte pourra s'en servir
     (lot SI2) sans autre lecture ;
   - note, constats et fiche d'un actif : lectures propres, bornées.
   Aucune priorité P1-P4 ni alerte : un constat Silène n'a pas de CVE (correspondance classe → priorité en attente). Les
   produits vus (CPE) ne sont pas rapprochés des CVE. Accès aux données en Kysely (ADR 0062). */
import {
  type ActifSileneDto,
  type ConstatSileneDto,
  type FicheActifSileneDto,
  type FicheConstatSileneDto,
  type FicheActifSileneRequete,
  type LiaisonPerimetreAlh,
  type NomHoteSilene,
  type NoteImportSileneDto,
  type NoteSileneDto,
  type PageSurface,
  type PerimetreSileneDto,
  type PortSileneDto,
  type ProduitSileneDto,
  BilanImportSilene,
  type RechercheConstatsSilene,
  SILENE_BORNES,
  SURFACE_PAR_PAGE,
  TYPE_SILENE_FICHIER,
  TYPES_NOM_ACTIF,
  type TypeActifAlh,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { lisibleAlh } from './sql.js';

const iso = (d: Date | null) => d?.toISOString() ?? null;
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
/** Motif LIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const NOMS_ACTIF = [...TYPES_NOM_ACTIF];
export const cleActif = (type: TypeActifAlh, valeur: string) => `${type}|${valeur}`;

/** Hôtes lisibles et présents (alias `h`, `i`, `se`, `sp`, `sm`), avec le nom de l'instance et de son périmètre. */
const hotesLisibles = (user: SessionUser) => sql`
  SELECT h.id, h.integration_id, h.adresse, h.ports_ouverts, h.controles, i.nom AS integration_nom,
    sm.name AS perimetre_nom
  FROM vulnerabilites_silene_hotes h
  JOIN integrations i ON i.id = h.integration_id
  LEFT JOIN vulnerabilites_silene_etat se ON se.integration_id = h.integration_id
  LEFT JOIN vulnerabilites_silene_perimetres sp ON sp.integration_id = h.integration_id
  LEFT JOIN grc_smsis sm ON sm.id = sp.perimetre_id
  WHERE ${lisibleAlh(user, 'sp')} AND h.vu_numero >= coalesce(se.numero_complet, 0)`;

interface LigneHote {
  id: string;
  integration_id: string;
  adresse: string;
  ports_ouverts: number | null;
  controles: string[];
  integration_nom: string;
  perimetre_nom: string | null;
  cle_type: TypeActifAlh;
  cle_valeur: string;
}

export class SurfaceSilene {
  constructor(
    private readonly db: Db,
    private readonly g: Grc,
  ) {}

  /* ---------------------------------------------------------------- Actifs (liste commune) */
  /** Actifs lisibles vus par Silène, une ligne par clé (type, valeur) : colonnes `id` (hôte, ou nom pour un nom de domaine ;
      le plus petit si plusieurs instances le voient), `type`, `valeur`. Filtres de la liste « Actifs » : type, texte
      (adresse ou nom de domaine, et adresse qui porte le nom). */
  clesActifs(
    user: SessionUser,
    q: { type?: TypeActifAlh; q?: string },
  ): RawBuilder<{
    id: string;
    type: TypeActifAlh;
    valeur: string;
  }> {
    const filtres: RawBuilder<boolean>[] = [sql<boolean>`true`];
    if (q.type) filtres.push(sql<boolean>`s.type = ${q.type}`);
    const texte = q.q?.trim();
    if (texte) {
      const motif = `%${litteral(texte.toLowerCase())}%`;
      filtres.push(sql<boolean>`(s.valeur LIKE ${motif} OR s.adresse LIKE ${motif})`);
    }
    return sql`SELECT DISTINCT ON (s.type, s.valeur) s.id, s.type, s.valeur FROM (
        SELECT h.id, 'hote'::text AS type, h.adresse AS valeur, h.adresse FROM (${hotesLisibles(user)}) h
        UNION ALL
        SELECT n.id, 'domaine'::text, n.nom, h.adresse FROM (${hotesLisibles(user)}) h
          JOIN vulnerabilites_silene_noms n ON n.hote_id = h.id AND n.type = ANY(${NOMS_ACTIF}::text[])
      ) s
      WHERE ${sql.join(filtres, sql` AND `)}
      ORDER BY s.type, s.valeur, s.id`;
  }

  /** Ce que Silène dit des actifs demandés (clé `type|valeur`), pour la personne : hôtes lisibles et présents de même
      adresse (hôte) ou qui portent le nom par résolution directe (nom de domaine). `portsMax` borne les ports rendus (la
      liste), `null` : tous (la fiche). Une clé que Silène ne voit pas (pour la personne) est absente de la carte. */
  async actifs(
    k: Kdb,
    user: SessionUser,
    cles: readonly { type: TypeActifAlh; valeur: string }[],
    portsMax: number | null,
  ): Promise<Map<string, ActifSileneDto & { constatIds: string[] }>> {
    const out = new Map<string, ActifSileneDto & { constatIds: string[] }>();
    const adresses = cles.filter((c) => c.type === 'hote').map((c) => c.valeur);
    const noms = cles.filter((c) => c.type === 'domaine').map((c) => c.valeur);
    if (!adresses.length && !noms.length) return out;
    const { rows } = await sql<LigneHote>`
      WITH lis AS (${hotesLisibles(user)})
      SELECT lis.*, 'hote'::text AS cle_type, lis.adresse AS cle_valeur FROM lis WHERE lis.adresse = ANY(${adresses}::text[])
      UNION ALL
      SELECT lis.*, 'domaine'::text, n.nom FROM lis
        JOIN vulnerabilites_silene_noms n ON n.hote_id = lis.id AND n.type = ANY(${NOMS_ACTIF}::text[])
      WHERE n.nom = ANY(${noms}::text[])
      ORDER BY 9, 8, 3, 1`.execute(k);
    if (!rows.length) return out;
    const ids = [...new Set(rows.map((r) => r.id))];
    const ports = new Map<string, PortSileneDto[]>();
    const nomsHote = new Map<string, NomHoteSilene[]>();
    const produits = new Map<string, ProduitSileneDto[]>();
    const constats = new Map<string, string[]>();
    const ajouter = <T>(m: Map<string, T[]>, id: string, x: T) => m.set(id, [...(m.get(id) ?? []), x]);
    for (const p of await k
      .selectFrom('vulnerabilites_silene_ports')
      .selectAll()
      .where('hote_id', 'in', ids)
      .orderBy('port')
      .orderBy('protocole')
      .execute())
      ajouter(ports, p.hote_id, {
        port: p.port,
        protocole: p.protocole as PortSileneDto['protocole'],
        service: p.service,
        produit: p.produit,
        tunnel: p.tunnel,
      });
    for (const n of await k
      .selectFrom('vulnerabilites_silene_noms')
      .select(['hote_id', 'nom', 'type'])
      .where('hote_id', 'in', ids)
      .orderBy('type')
      .orderBy('nom')
      .execute())
      ajouter(nomsHote, n.hote_id, { nom: n.nom, type: n.type as NomHoteSilene['type'] });
    for (const p of await k
      .selectFrom('vulnerabilites_silene_produits')
      .selectAll()
      .where('hote_id', 'in', ids)
      .orderBy('rang')
      .execute())
      ajouter(produits, p.hote_id, {
        type: p.type as ProduitSileneDto['type'],
        editeur: p.editeur,
        produit: p.produit,
        version: p.version,
      });
    const { rows: cs } = await sql<{ hote_id: string; constat_id: string }>`
      SELECT h.id AS hote_id, c.id AS constat_id
      FROM vulnerabilites_silene_hotes h
      JOIN vulnerabilites_silene_constat_hotes ch ON ch.adresse = h.adresse
      JOIN vulnerabilites_silene_constats c ON c.id = ch.constat_id AND c.integration_id = h.integration_id
      LEFT JOIN vulnerabilites_silene_etat se ON se.integration_id = c.integration_id
      WHERE h.id = ANY(${ids}::uuid[]) AND c.vu_numero >= coalesce(se.numero_complet, 0)
      ORDER BY c.controle, c.identifiant`.execute(k);
    for (const x of cs) ajouter(constats, x.hote_id, x.constat_id);

    for (const r of rows) {
      const cle = cleActif(r.cle_type, r.cle_valeur);
      const a = out.get(cle) ?? {
        instances: [],
        perimetreNom: null,
        adresses: [],
        noms: [],
        ports: [],
        nombrePorts: 0,
        portsOuverts: null,
        produits: [],
        controles: [],
        constats: 0,
        constatIds: [],
      };
      if (!a.instances.some((x) => x.id === r.integration_id))
        a.instances.push({ id: r.integration_id, nom: r.integration_nom });
      a.perimetreNom ??= r.perimetre_nom;
      if (!a.adresses.includes(r.adresse)) a.adresses.push(r.adresse);
      for (const n of nomsHote.get(r.id) ?? [])
        if (!a.noms.some((x) => x.nom === n.nom && x.type === n.type)) a.noms.push(n);
      for (const p of ports.get(r.id) ?? [])
        if (!a.ports.some((x) => x.port === p.port && x.protocole === p.protocole)) a.ports.push(p);
      for (const p of produits.get(r.id) ?? [])
        if (
          !a.produits.some(
            (x) => x.type === p.type && x.editeur === p.editeur && x.produit === p.produit && x.version === p.version,
          )
        )
          a.produits.push(p);
      for (const c of r.controles) if (!a.controles.includes(c)) a.controles.push(c);
      if (r.ports_ouverts !== null) a.portsOuverts = (a.portsOuverts ?? 0) + r.ports_ouverts;
      for (const c of constats.get(r.id) ?? []) if (!a.constatIds.includes(c)) a.constatIds.push(c);
      out.set(cle, a);
    }
    for (const a of out.values()) {
      a.ports.sort((x, y) => x.port - y.port || x.protocole.localeCompare(y.protocole));
      a.adresses.sort();
      a.controles.sort();
      a.nombrePorts = a.ports.length;
      if (portsMax !== null) a.ports = a.ports.slice(0, portsMax);
      a.constats = a.constatIds.length;
    }
    return out;
  }

  /** Fiche Silène d'un actif lisible : tous ses ports, noms, produits et la liste de ses constats présents. */
  async ficheActif(user: SessionUser, q: FicheActifSileneRequete): Promise<FicheActifSileneDto> {
    const valeur = q.valeur.trim().toLowerCase();
    const a = (await this.actifs(this.db.k, user, [{ type: q.type, valeur }], null)).get(cleActif(q.type, valeur));
    if (!a) throw new HttpError(404, 'Actif introuvable chez Silène ou non accessible.');
    const liste = a.constatIds.length
      ? await this.db.k
          .selectFrom('vulnerabilites_silene_constats')
          .select(['id', 'identifiant', 'controle', 'classe'])
          .where('id', 'in', a.constatIds)
          .orderBy('controle')
          .orderBy('identifiant')
          .execute()
      : [];
    const { constatIds: _ignore, ...dto } = a;
    void _ignore;
    return { ...dto, listeConstats: liste };
  }

  /* ---------------------------------------------------------------- Note */
  /** Note de chaque instance lisible : dernier import complet, le précédent, l'historique, l'état du dernier import. */
  async notes(user: SessionUser): Promise<NoteSileneDto[]> {
    const { rows: instances } = await sql<{
      id: string;
      nom: string;
      actif: boolean;
      perimetre_nom: string | null;
      numero_complet: number;
    }>`
      SELECT i.id, i.nom, i.actif, sm.name AS perimetre_nom, coalesce(se.numero_complet, 0) AS numero_complet
      FROM integrations i
      LEFT JOIN vulnerabilites_silene_etat se ON se.integration_id = i.id
      LEFT JOIN vulnerabilites_silene_perimetres sp ON sp.integration_id = i.id
      LEFT JOIN grc_smsis sm ON sm.id = sp.perimetre_id
      WHERE i.type = ${TYPE_SILENE_FICHIER} AND ${lisibleAlh(user, 'sp')}
      ORDER BY lower(i.nom), i.id`.execute(this.db.k);
    const out: NoteSileneDto[] = [];
    for (const i of instances) {
      const historique = await this.db.k
        .selectFrom('vulnerabilites_silene_imports')
        .selectAll()
        .where('integration_id', '=', i.id)
        .where('complet', '=', true)
        .orderBy('numero', 'desc')
        .limit(SILENE_BORNES.historique)
        .execute();
      const notes = historique.map((h): NoteImportSileneDto => ({
        date: h.date_rapport ? SurfaceSilene.jour(h.date_rapport) : null,
        debut: h.debut_rapport,
        fin: h.fin_rapport,
        note: nombre(h.note),
        noteReseau: nombre(h.note_reseau),
        vulnreco: h.vulnreco,
        warning: h.warning,
        info: h.info,
        ok: h.ok,
        importeLe: h.maj_le.toISOString(),
      }));
      const d = await this.db.k
        .selectFrom('integration_executions as x')
        .leftJoin('vulnerabilites_silene_imports as v', 'v.execution_id', 'x.id')
        .select(['x.id', 'x.etat', 'x.demande_le', 'x.termine_le', 'x.erreur', 'x.resultat'])
        .where('x.integration_id', '=', i.id)
        .where('x.operation', '=', 'importer')
        .orderBy('x.demande_le', 'desc')
        .orderBy('x.id')
        .limit(1)
        .executeTakeFirst();
      const { rows: n } = await sql<{ hotes: number; constats: number }>`SELECT
          (SELECT count(*)::int FROM vulnerabilites_silene_hotes WHERE integration_id = ${i.id}::uuid
             AND vu_numero >= ${i.numero_complet}::int) AS hotes,
          (SELECT count(*)::int FROM vulnerabilites_silene_constats WHERE integration_id = ${i.id}::uuid
             AND vu_numero >= ${i.numero_complet}::int) AS constats`.execute(this.db.k);
      const bilan = d?.resultat ? BilanImportSilene.safeParse(d.resultat) : null;
      out.push({
        integrationId: i.id,
        nom: i.nom,
        actif: i.actif,
        perimetreNom: i.perimetre_nom,
        courante: notes[0] ?? null,
        precedente: notes[1] ?? null,
        historique: notes,
        hotes: n[0]?.hotes ?? 0,
        constats: n[0]?.constats ?? 0,
        perimetre: {
          domaines: historique[0]?.perimetre_domaines.length ?? 0,
          plages: historique[0]?.perimetre_plages.length ?? 0,
        },
        derniere: d
          ? {
              id: d.id,
              etat: d.etat as NonNullable<NoteSileneDto['derniere']>['etat'],
              demandeLe: d.demande_le.toISOString(),
              termineLe: iso(d.termine_le),
              erreur: d.erreur,
              bilan: bilan?.success ? bilan.data : null,
            }
          : null,
      });
    }
    return out;
  }

  /** Date du rapport (colonne `date`, lue sans fuseau). */
  private static jour(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* ---------------------------------------------------------------- Constats */
  private async lignesConstats(
    user: SessionUser,
    conditions: RawBuilder<boolean>[],
    page: { limite: number; decalage: number } | null,
  ) {
    const { rows } = await sql<{
      id: string;
      identifiant: string;
      controle: string;
      classe: number;
      points: string | null;
      note: string | null;
      integration_id: string;
      integration_nom: string;
      perimetre_nom: string | null;
      hotes: number;
      lignes: number;
      total: number;
    }>`
      SELECT c.id, c.identifiant, c.controle, c.classe, c.points, c.note, c.integration_id, i.nom AS integration_nom,
        sm.name AS perimetre_nom,
        (SELECT count(*)::int FROM vulnerabilites_silene_constat_hotes ch WHERE ch.constat_id = c.id) AS hotes,
        (SELECT count(*)::int FROM vulnerabilites_silene_lignes l WHERE l.constat_id = c.id) AS lignes,
        count(*) OVER ()::int AS total
      FROM vulnerabilites_silene_constats c
      JOIN integrations i ON i.id = c.integration_id
      LEFT JOIN vulnerabilites_silene_etat se ON se.integration_id = c.integration_id
      LEFT JOIN vulnerabilites_silene_perimetres sp ON sp.integration_id = c.integration_id
      LEFT JOIN grc_smsis sm ON sm.id = sp.perimetre_id
      WHERE ${lisibleAlh(user, 'sp')} AND c.vu_numero >= coalesce(se.numero_complet, 0)
        AND ${sql.join(conditions, sql` AND `)}
      ORDER BY c.controle, c.classe, c.identifiant, c.id
      ${page ? sql`LIMIT ${page.limite} OFFSET ${page.decalage}` : sql``}`.execute(this.db.k);
    return rows;
  }

  private static versConstat(c: Awaited<ReturnType<SurfaceSilene['lignesConstats']>>[number]): ConstatSileneDto {
    return {
      id: c.id,
      identifiant: c.identifiant,
      controle: c.controle,
      classe: c.classe,
      points: nombre(c.points),
      note: nombre(c.note),
      hotes: c.hotes,
      lignes: c.lignes,
      integration: { id: c.integration_id, nom: c.integration_nom },
      perimetreNom: c.perimetre_nom,
    };
  }

  /** Constats lisibles et présents, par contrôle ; recherche par contrôle, identifiant ou adresse d'un hôte concerné. */
  async constats(user: SessionUser, q: RechercheConstatsSilene): Promise<PageSurface<ConstatSileneDto>> {
    const conditions: RawBuilder<boolean>[] = [sql<boolean>`true`];
    if (q.controle) conditions.push(sql<boolean>`c.controle = ${q.controle}`);
    const texte = q.q?.trim();
    if (texte) {
      const motif = `%${litteral(texte)}%`;
      conditions.push(
        sql<boolean>`(c.controle ILIKE ${motif} OR c.identifiant ILIKE ${motif}
          OR EXISTS (SELECT 1 FROM vulnerabilites_silene_constat_hotes ch WHERE ch.constat_id = c.id
                     AND ch.adresse LIKE ${`%${litteral(texte.toLowerCase())}%`}))`,
      );
    }
    const rows = await this.lignesConstats(user, conditions, {
      limite: SURFACE_PAR_PAGE,
      decalage: (q.page - 1) * SURFACE_PAR_PAGE,
    });
    return {
      total: rows[0]?.total ?? 0,
      page: q.page,
      parPage: SURFACE_PAR_PAGE,
      elements: rows.map(SurfaceSilene.versConstat),
    };
  }

  /** Fiche d'un constat lisible et présent : détail par hôte. Illisible, absent ou inconnu : 404. */
  async constat(user: SessionUser, id: string): Promise<FicheConstatSileneDto> {
    const [c] = await this.lignesConstats(user, [sql<boolean>`c.id = ${id}::uuid`], null);
    if (!c) throw new HttpError(404, 'Constat introuvable ou non accessible.');
    const hotes = await this.db.k
      .selectFrom('vulnerabilites_silene_constat_hotes')
      .select('adresse')
      .where('constat_id', '=', id)
      .orderBy('adresse')
      .execute();
    const lignes = await this.db.k
      .selectFrom('vulnerabilites_silene_lignes')
      .selectAll()
      .where('constat_id', '=', id)
      .orderBy('rang')
      .execute();
    const parHote = new Map<string, FicheConstatSileneDto['parHote'][number]>(
      hotes.map((h) => [h.adresse, { hote: h.adresse, lignes: [] }]),
    );
    for (const l of lignes) {
      const x = parHote.get(l.adresse) ?? { hote: l.adresse, lignes: [] };
      x.lignes.push({
        rang: l.rang,
        port: l.port,
        protocole: l.protocole as 'tcp' | 'udp' | null,
        service: l.service,
        produit: l.produit,
        nomHote: l.nom_hote,
        type: l.type,
        echeance: l.echeance,
      });
      parHote.set(l.adresse, x);
    }
    return {
      ...SurfaceSilene.versConstat(c),
      parHote: [...parHote.values()].sort((a, b) => (a.hote < b.hote ? -1 : a.hote > b.hote ? 1 : 0)),
    };
  }

  /* ---------------------------------------------------------------- Périmètres (vulnerabilites:administrer) */
  async perimetres(id?: string, k: Kdb = this.db.k): Promise<PerimetreSileneDto[]> {
    const { rows } = await sql<{
      id: string;
      nom: string;
      perimetre_id: string | null;
      perimetre_nom: string | null;
      version: number | null;
      maj_par: string | null;
      maj_le: Date | null;
      hotes: number;
      constats: number;
    }>`
      SELECT i.id, i.nom, sp.perimetre_id, sm.name AS perimetre_nom, sp.version, sp.maj_par, sp.maj_le,
        (SELECT count(*)::int FROM vulnerabilites_silene_hotes h WHERE h.integration_id = i.id
           AND h.vu_numero >= coalesce(se.numero_complet, 0)) AS hotes,
        (SELECT count(*)::int FROM vulnerabilites_silene_constats c WHERE c.integration_id = i.id
           AND c.vu_numero >= coalesce(se.numero_complet, 0)) AS constats
      FROM integrations i
      LEFT JOIN vulnerabilites_silene_etat se ON se.integration_id = i.id
      LEFT JOIN vulnerabilites_silene_perimetres sp ON sp.integration_id = i.id
      LEFT JOIN grc_smsis sm ON sm.id = sp.perimetre_id
      WHERE i.type = ${TYPE_SILENE_FICHIER} AND ${id ? sql<boolean>`i.id = ${id}::uuid` : sql<boolean>`true`}
      ORDER BY lower(i.nom), i.id`.execute(k);
    return rows.map((p) => ({
      integrationId: p.id,
      nom: p.nom,
      perimetreId: p.perimetre_id,
      perimetreNom: p.perimetre_nom,
      hotes: p.hotes,
      constats: p.constats,
      version: p.version ?? 0,
      majPar: p.maj_par,
      majLe: iso(p.maj_le),
    }));
  }

  /** Relier (ou délier) une instance Silène : If-Match (0 : jamais reliée) ; écriture exigée sur le périmètre actuel et sur
      le périmètre visé (même règle que les périmètres d'AlgoLightHouse). */
  async lier(
    id: string,
    corps: LiaisonPerimetreAlh,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<PerimetreSileneDto> {
    await this.db.tx(async (c, k) => {
      const i = await k
        .selectFrom('integrations')
        .select(['id', 'type'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!i || i.type !== TYPE_SILENE_FICHIER) throw new HttpError(404, 'Instance Silène introuvable.');
      const sp = await k
        .selectFrom('vulnerabilites_silene_perimetres')
        .select(['perimetre_id', 'version', 'maj_par'])
        .where('integration_id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      const version = sp?.version ?? 0;
      if (version !== attendue)
        throw conflict({ ...(await this.perimetres(id, k))[0]!, updated_by: sp?.maj_par ?? '' });
      const avant = sp?.perimetre_id ?? null;
      if (avant === corps.perimetreId) return;
      if (avant) await this.g.access(avant, user, true, c);
      if (corps.perimetreId)
        await this.g.access(corps.perimetreId, user, true, c).catch((e: unknown) => {
          if (e instanceof HttpError && e.status === 404)
            throw new HttpError(422, 'Périmètre introuvable ou non accessible.');
          throw e;
        });
      const apres = await k
        .insertInto('vulnerabilites_silene_perimetres')
        .values({ integration_id: id, perimetre_id: corps.perimetreId, maj_par: user.username })
        .onConflict((oc) =>
          oc.column('integration_id').doUpdateSet((eb) => ({
            perimetre_id: eb.ref('excluded.perimetre_id'),
            version: sql<number>`vulnerabilites_silene_perimetres.version + 1`,
            maj_le: sql<Date>`now()`,
            maj_par: eb.ref('excluded.maj_par'),
          })),
        )
        .returning('version')
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        corps.perimetreId ? 'vulnerabilites.silene.perimetre.relie' : 'vulnerabilites.silene.perimetre.delie',
        id,
        { avant: { perimetreId: avant }, apres: { perimetreId: corps.perimetreId }, version: apres.version },
        c,
      );
    }, user.username);
    return (await this.perimetres(id))[0]!;
  }
}
