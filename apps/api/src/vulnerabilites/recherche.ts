/* Module Vulnérabilités (ADR 0100, point 15 et V11 ; lot R1) : barre de recherche globale du module. Lecture seule, sans
   journal (comme les listes, aucune trace du texte cherché), sans appel réseau, sans appel au modèle. Une réponse groupée et
   bornée (RECHERCHE_GLOBALE_BORNES du paquet partagé) :
   - CVE : veille locale (identifiant par préfixe ; sinon éditeurs et produits de NVD, description, éditeur, produit et nom
     du catalogue KEV) et détections (contrôles de Tenable, alertes et technologies d'AlgoLightHouse, par préfixe
     d'identifiant). Les nombres de machines et d'actifs ne comptent que ce que la personne lit (fragments `lisible` et
     `present` de sql.ts ; exposition par SurfaceExterneAlh.surfaceDesCves) ; le reste est un drapeau sans nombre (lot ALH5),
     comme la fiche d'une CVE (lot PC4). Un identifiant CVE bien formé que rien ne cite donne `cveInconnue`, sans appel
     sortant ;
   - machines : celles de la liste « Machines » (FaillesDetectees.machinesRangees, droits du périmètre effectif), filtrées
     par la règle commune machineCorrespond, dans l'ordre du rang (correspondance exacte d'abord) ;
   - actifs exposés : la liste « Actifs » de la surface externe (SurfaceExterneAlh.actifs), même filtre, mêmes droits ;
   - applications : produits surveillés (registre de l'organisation, lu avec `lire` comme sa liste) et leurs machines reliées
     lisibles ; technologies d'AlgoLightHouse (SurfaceExterneAlh.technologies : versions encore détectées sur des actifs
     lisibles) ; contrôles de Tenable par leur nom (FaillesDetectees.constats : présents sur une machine lisible, encore à
     traiter, comme la liste « Failles détectées » par défaut).
   Les listes existantes sont appelées avec la saisie telle quelle : le nombre total d'un groupe est celui de la liste
   ouverte par « tout voir ». */
import {
  estIdentifiantCve,
  type GraviteCvss,
  machineCorrespond,
  motifLitteral,
  type PorteurDto,
  RECHERCHE_GLOBALE_BORNES,
  RechercheConstats,
  type RechercheGlobaleDto,
  type ResultatCveDto,
  type ResultatProduitDto,
  type ResultatTechnologieDto,
  ressembleACve,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db } from '../db/db.js';
import type { FaillesDetectees } from './failles.js';
import type { ProduitsSurveilles } from './produits.js';
import { lisible, present } from './sql.js';
import type { SurfaceExterneAlh } from './surface-externe.js';

const B = RECHERCHE_GLOBALE_BORNES;
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const tronquer = (t: string | null, n: number) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t);

export class RechercheVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly failles: FaillesDetectees,
    private readonly surface: SurfaceExterneAlh,
    private readonly produits: ProduitsSurveilles,
  ) {}

  async chercher(user: SessionUser, saisie: string): Promise<RechercheGlobaleDto> {
    const q = saisie.trim();
    const cve = ressembleACve(q);
    const [cves, machines, actifs, produits, technologies, controles] = await Promise.all([
      this.cves(user, q),
      this.machines(user, q),
      this.actifs(user, q),
      // Un début d'identifiant CVE ne désigne ni un produit, ni une technologie, ni le nom d'un contrôle.
      cve ? vide<ResultatProduitDto>() : this.applications(user, q),
      cve ? vide<ResultatTechnologieDto>() : this.technologies(user, q),
      cve ? vide<RechercheGlobaleDto['controles']['elements'][number]>() : this.controles(user, q),
    ]);
    return {
      q,
      cves: cves.groupe,
      machines,
      actifs,
      produits,
      technologies,
      controles,
      cveInconnue: estIdentifiantCve(q) && !cves.exacteConnue ? { cve: q.toUpperCase() } : null,
    };
  }

  /* ---------------------------------------------------------------- CVE */
  private async cves(
    user: SessionUser,
    q: string,
  ): Promise<{ groupe: RechercheGlobaleDto['cves']; exacteConnue: boolean }> {
    const k = this.db.k;
    const exacte = estIdentifiantCve(q) ? q.toUpperCase() : null;
    // Candidats : un début d'identifiant est cherché partout (veille et détections) ; un texte, dans la veille seulement
    // (les détections ne rangent que des identifiants).
    const candidats = ressembleACve(q)
      ? (() => {
          const m = `${motifLitteral(q.toUpperCase())}%`;
          return sql`SELECT cve FROM vulnerabilites_veille_cve WHERE cve LIKE ${m}
            UNION SELECT cve FROM vulnerabilites_constat_cves WHERE cve LIKE ${m}
            UNION SELECT cve FROM vulnerabilites_alh_alerte_cves WHERE cve LIKE ${m}
            UNION SELECT cve FROM vulnerabilites_alh_technologie_cves WHERE cve LIKE ${m}`;
        })()
      : (() => {
          const m = `%${motifLitteral(q)}%`;
          return sql`SELECT cve FROM vulnerabilites_veille_cve
            WHERE description ILIKE ${m} OR kev_nom ILIKE ${m} OR kev_editeur ILIKE ${m} OR kev_produit ILIKE ${m}
              OR EXISTS (SELECT 1 FROM unnest(editeurs) x WHERE replace(x, '_', ' ') ILIKE ${m} OR x ILIKE ${m})
              OR EXISTS (SELECT 1 FROM unnest(produits) x WHERE replace(x, '_', ' ') ILIKE ${m} OR x ILIKE ${m})`;
        })();
    // Ordre : identifiant exact, puis présente sur une machine lisible (détection), puis la plus récente ; aucun nombre lié
    // à ce que la personne ne lit pas n'entre dans l'ordre.
    // Lot PERF (PERF-03) : les candidates présentes sur une machine lisible sont calculées une fois (ensemble `lues`), au
    // lieu d'une sous-requête par candidate ; même ordre.
    const { rows: tete } = await sql<{ cve: string; total: number; exacte: boolean }>`
      WITH c AS MATERIALIZED (${candidats}),
      lues AS MATERIALIZED (
        SELECT DISTINCT cc.cve FROM c
        JOIN vulnerabilites_constat_cves cc ON cc.cve = c.cve
        JOIN vulnerabilites_detections d ON d.constat_id = cc.constat_id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE ${present} AND ${lisible(user)})
      SELECT c.cve, count(*) OVER ()::int AS total, bool_or(c.cve = ${exacte}) OVER () AS exacte
      FROM c LEFT JOIN vulnerabilites_veille_cve v ON v.cve = c.cve
      ORDER BY (c.cve = ${exacte}) DESC NULLS LAST,
        (c.cve IN (SELECT lues.cve FROM lues)) DESC,
        coalesce(v.publie_le, v.kev_ajout, v.cree_le) DESC NULLS LAST, c.cve DESC
      LIMIT ${B.parGroupe}`.execute(k);
    const total = tete[0]?.total ?? 0;
    const exacteConnue = !!tete[0]?.exacte;
    const liste = tete.map((x) => x.cve);
    if (!liste.length) return { groupe: { elements: [], total }, exacteConnue };
    const { rows: infos } = await sql<{
      cve: string;
      veille: boolean;
      description: string | null;
      kev_nom: string | null;
      produit: string | null;
      cvss31_gravite: string | null;
      cvss31_score: string | null;
      cvss40_gravite: string | null;
      cvss40_score: string | null;
      kev: boolean;
      constat: boolean;
    }>`
      SELECT x.cve, v.cve IS NOT NULL AS veille, v.description, v.kev_nom,
        coalesce(nullif(concat_ws(' ', v.kev_editeur, v.kev_produit), ''),
                 nullif(concat_ws(' ', v.editeurs[1], v.produits[1]), '')) AS produit,
        v.cvss31_gravite, v.cvss31_score, v.cvss40_gravite, v.cvss40_score, coalesce(v.kev_ajout IS NOT NULL, false) AS kev,
        EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc WHERE cc.cve = x.cve) AS constat
      FROM unnest(${liste}::text[]) AS x(cve) LEFT JOIN vulnerabilites_veille_cve v ON v.cve = x.cve`.execute(k);
    // Machines lisibles où Tenable détecte la CVE (détection présente), et drapeau pour les autres.
    const { rows: detectees } = await sql<{ cve: string; lues: number; hors: boolean }>`
      SELECT cc.cve, count(DISTINCT m.id) FILTER (WHERE ${lisible(user)})::int AS lues, bool_or(NOT ${lisible(user)}) AS hors
      FROM vulnerabilites_constat_cves cc
      JOIN vulnerabilites_detections d ON d.constat_id = cc.constat_id
      JOIN vulnerabilites_machines m ON m.id = d.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      WHERE cc.cve = ANY(${liste}::text[]) AND ${present}
      GROUP BY cc.cve`.execute(k);
    // Machines lisibles reliées à un produit surveillé rattaché à la CVE (« déclarée »), et drapeau pour les autres.
    const { rows: declarees } = await sql<{ cve: string; lues: number; hors: boolean }>`
      SELECT r.cve, count(DISTINCT m.id) FILTER (WHERE ${lisible(user)})::int AS lues, bool_or(NOT ${lisible(user)}) AS hors
      FROM vulnerabilites_rapprochements r
      JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      WHERE r.cve = ANY(${liste}::text[]) AND r.statut IN ('rattachee', 'confirmee')
      GROUP BY r.cve`.execute(k);
    const exposition = await this.surface.surfaceDesCves(user, liste);
    const parCve = <T extends { cve: string }>(rows: T[]) => new Map(rows.map((x) => [x.cve, x]));
    const info = parCve(infos);
    const det = parCve(detectees);
    const dec = parCve(declarees);
    const elements = liste.map((c): ResultatCveDto => {
      const i = info.get(c)!;
      const s = exposition.get(c);
      const nvd31 = i.cvss31_gravite !== null;
      return {
        cve: c,
        veille: i.veille,
        resume: tronquer(i.kev_nom ?? i.description, B.resume),
        produit: i.produit,
        gravite: ((nvd31 ? i.cvss31_gravite : i.cvss40_gravite) as GraviteCvss | null) ?? null,
        score: nombre(nvd31 ? i.cvss31_score : i.cvss40_score),
        kev: i.kev,
        machines: det.get(c)?.lues ?? 0,
        machinesDeclarees: dec.get(c)?.lues ?? 0,
        actifs: s?.actifs ?? 0,
        horsLecture: !!det.get(c)?.hors || !!dec.get(c)?.hors || !!s?.horsLecture,
        // Mêmes conditions que la fiche d'une CVE (lot PC4) : connue de la veille, d'un contrôle, ou exposée.
        fiche: i.veille || i.constat || !!s,
      };
    });
    return { groupe: { elements, total }, exacteConnue };
  }

  /* ---------------------------------------------------------------- Machines internes */
  private async machines(user: SessionUser, q: string): Promise<RechercheGlobaleDto['machines']> {
    const t = q.toLowerCase();
    const exacte = (m: { nom: string | null; adresse: string | null }) =>
      (m.nom ?? '').toLowerCase() === t || (m.adresse ?? '').toLowerCase() === t;
    const trouvees = (await this.failles.machinesRangees(user)).filter((m) => machineCorrespond(m, q));
    // Correspondance exacte (nom ou adresse) d'abord ; sinon l'ordre du rang (le tri est stable).
    const triees = [...trouvees].sort((a, b) => Number(exacte(b)) - Number(exacte(a)));
    return {
      total: trouvees.length,
      elements: triees.slice(0, B.parGroupe).map((m) => ({
        id: m.id,
        nom: m.nom,
        adresse: m.adresse,
        systeme: m.systeme,
        role: m.role,
        perimetreNom: m.perimetreNom,
      })),
    };
  }

  /* ---------------------------------------------------------------- Actifs exposés */
  private async actifs(user: SessionUser, q: string): Promise<RechercheGlobaleDto['actifs']> {
    const page = await this.surface.actifs(user, { q, page: 1 });
    return {
      total: page.total,
      elements: page.elements.slice(0, B.parGroupe).map((x) => ({
        id: x.id,
        type: x.type,
        valeur: x.valeur,
        adresse: x.adresse,
        perimetreNom: x.perimetreNom,
        alertesOuvertes: x.alertesOuvertes,
      })),
    };
  }

  /* ---------------------------------------------------------------- Applications */
  /** Produits surveillés dont l'éditeur, le nom, la version ou l'identifiant CPE contient la saisie (casse ignorée), avec
      leurs machines reliées que la personne lit. */
  private async applications(user: SessionUser, q: string): Promise<RechercheGlobaleDto['produits']> {
    const t = q.toLowerCase();
    const trouves = (await this.produits.lister()).filter((p) =>
      [`${p.editeur} ${p.nom} ${p.versionProduit}`, p.cpe ?? ''].some((x) => x.toLowerCase().includes(t)),
    );
    const retenus = trouves.slice(0, B.parGroupe);
    const ids = retenus.map((p) => p.id);
    const { rows } = ids.length
      ? await sql<{ produit_id: string; id: string; nom: string | null; adresse: string | null }>`
          SELECT pm.produit_id, m.id, m.nom, m.adresse
          FROM vulnerabilites_produits_machines pm
          JOIN vulnerabilites_machines m ON m.id = pm.machine_id
          WHERE pm.produit_id = ANY(${ids}::uuid[]) AND ${lisible(user)}
          ORDER BY pm.produit_id, lower(coalesce(m.nom, m.adresse, '')), m.id`.execute(this.db.k)
      : { rows: [] };
    const parProduit = new Map<string, PorteurDto[]>();
    for (const r of rows)
      parProduit.set(r.produit_id, [
        ...(parProduit.get(r.produit_id) ?? []),
        { type: 'machine', id: r.id, libelle: r.nom ?? r.adresse ?? 'Machine sans nom' },
      ]);
    return {
      total: trouves.length,
      elements: retenus.map((p) => {
        const porteurs = parProduit.get(p.id) ?? [];
        return {
          id: p.id,
          editeur: p.editeur,
          nom: p.nom,
          versionProduit: p.versionProduit,
          machines: porteurs.length,
          porteurs: porteurs.slice(0, B.porteurs),
        };
      }),
    };
  }

  /** Technologies vues par AlgoLightHouse (nom, éditeur, produit), avec les actifs lisibles qui les portent encore. */
  private async technologies(user: SessionUser, q: string): Promise<RechercheGlobaleDto['technologies']> {
    const page = await this.surface.technologies(user, { q, page: 1 });
    return {
      total: page.total,
      elements: page.elements.slice(0, B.parGroupe).map((x) => {
        const actifs = new Map<string, PorteurDto>();
        for (const v of x.versions)
          for (const a of v.actifs)
            actifs.set(`${a.type}|${a.libelle}`, { type: a.type, id: null, libelle: a.libelle });
        const porteurs = [...actifs.values()];
        return {
          id: x.id,
          nom: x.nom,
          editeur: x.editeur,
          produit: x.produit,
          actifs: porteurs.length,
          porteurs: porteurs.slice(0, B.porteurs),
        };
      }),
    };
  }

  /** Contrôles de Tenable dont le nom (ou le numéro) correspond : une application vulnérable se retrouve souvent par le nom
      du contrôle (« Apache Tomcat 9.0.x < … »). Mêmes droits et même filtre par défaut que « Failles détectées ». */
  private async controles(user: SessionUser, q: string): Promise<RechercheGlobaleDto['controles']> {
    const page = await this.failles.constats(user, { ...RechercheConstats.parse({}), q });
    return {
      total: page.total,
      elements: page.elements.slice(0, B.parGroupe).map((c) => ({
        id: c.id,
        pluginId: Number(c.plugin),
        nom: c.nom,
        machines: c.machines,
      })),
    };
  }
}

const vide = async <T>(): Promise<{ elements: T[]; total: number }> => ({ elements: [], total: 0 });
