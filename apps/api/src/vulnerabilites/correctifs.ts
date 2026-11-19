/* Module Vulnérabilités (ADR 0100, lot S3 ; décision du RSSI du 18/11/2026) : vue « Correctifs ». Une ligne par correctif
   (texte de la solution de Tenable, en anglais, tel quel), avec les failles qu'il corrige, les machines concernées que la
   personne lit, la priorité la plus haute, les marques, l'état de délai le plus défavorable et l'état du correctif.
   - Origine du regroupement : le texte `solution` de chaque constat (vulndetails, déjà lu et rangé `correctif`). La vue
     `sumremediation` n'est pas lue par le connecteur (aucun appel nouveau dans ce lot) ; elle donnerait `solutionID` et la
     liste des contrôles d'un correctif. Limite : deux libellés différents pour la même mise à jour ne sont pas fusionnés.
   - Failles regroupées : les constats de Tenable présents (vus par la dernière synchronisation complète) et encore à traiter
     (nouvelle, à traiter, en cours ; hors proposition « corrigée » à confirmer), comme la liste par défaut. Les failles
     déclarées (produits surveillés) et les CVE de la surface externe n'y figurent pas : aucune source rangée ne leur donne
     un correctif (NVD publie des versions touchées, pas une version corrigée ; `latest_version` d'AlgoLightHouse n'est pas
     lu) ; l'écran le dit.
   - Droits (lot ALH5) : priorité, nombres de failles et de CVE, marques et délais calculés sur tous les faits connus, les
     mêmes pour tout le monde ; machines nommées et comptées selon les droits (périmètre effectif), drapeau sans nombre pour
     les autres. Le détail d'un groupe nomme les machines lisibles seulement ; une faille dont la personne ne lit aucune
     machine est montrée par son contrôle (comme la vue d'ensemble), sans lien vers sa fiche.
   - Lecture seule, sans entrée de journal. Nombre de requêtes fixe, aucune par faille ni par correctif : réglage 1,
     constats 1, machines lisibles des constats 1, CVE des constats 1, faits des sources 3 ; détail : les mêmes, plus les
     machines lisibles du groupe 1. */
import { createHash } from 'node:crypto';
import {
  calculerDelai,
  calculerPriorite,
  CLE_SANS_CORRECTIF,
  CORRECTIFS_BORNES,
  type CorrectifDetailDto,
  type CorrectifsDto,
  etatCorrectif,
  etatFinSupport,
  type FailleAGrouper,
  type FailleCorrectifDto,
  faitsDepuisSources,
  type GraviteTenable,
  type MachineCorrectifDto,
  NIVEAUX_PRIORITE,
  type RechercheCorrectifs,
  regrouperParCorrectif,
  type RoleMachine,
  situationExploitation,
  texteCorrectif,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { lireFaitsCve, sourcesDe } from './sources.js';
import { lisible, perimetreMachine, premiereConstat, present } from './sql.js';
import { colonnesSuivi, filtreSuivi, type LigneSuivi } from './suivi.js';

const nombre = (v: string | null) => (v === null ? null : Number(v));
const iso = (d: Date | null) => d?.toISOString() ?? null;
/** Clé stable d'un texte de solution : empreinte SHA-256 tronquée (16 caractères hexadécimaux). */
export const cleCorrectif = (texte: string) => createHash('sha256').update(texte, 'utf8').digest('hex').slice(0, 16);

interface LigneConstat extends LigneSuivi {
  id: string;
  plugin_id: number;
  nom: string;
  gravite: GraviteTenable;
  correctif: string | null;
  cvss3_score: string | null;
  epss_score: string | null;
  exploitable: boolean;
  /** Lot N2 : contrôle « exploité par un logiciel malveillant » selon Tenable. */
  exploite_malware: boolean;
  correctif_publie_le: Date | null;
  fin_support_le: Date | null;
  premiere: Date;
  hors_lecture: boolean;
}

interface FailleCalculee {
  l: LigneConstat;
  groupe: FailleAGrouper;
  detail: FailleCorrectifDto;
}

export class CorrectifsVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly reglage: ReglagePrioriteVulnerabilites,
  ) {}

  /** Groupes par correctif, dans l'ordre du gain. */
  async lister(user: SessionUser, q: RechercheCorrectifs): Promise<CorrectifsDto> {
    const maintenant = new Date();
    const failles = await this.failles(user, maintenant);
    let groupes = regrouperParCorrectif(
      failles.map((f) => f.groupe),
      cleCorrectif,
    );
    const misesAJour = groupes.filter((g) => g.solution !== null);
    const sansCorrectif = groupes.find((g) => g.solution === null)?.failles ?? 0;
    const texte = q.q?.trim().toLowerCase();
    if (texte) groupes = groupes.filter((g) => (g.solution ?? '').toLowerCase().includes(texte));
    if (q.priorite) groupes = groupes.filter((g) => g.priorite === q.priorite);
    return {
      misesAJour: misesAJour.length,
      failles: misesAJour.reduce((n, g) => n + g.failles, 0),
      sansCorrectif,
      groupes: groupes.slice(0, CORRECTIFS_BORNES.groupes),
      total: groupes.length,
      tronquee: groupes.length > CORRECTIFS_BORNES.groupes,
      calculeLe: maintenant.toISOString(),
    };
  }

  /** Détail d'un groupe : ses failles (toutes, bornées ; lien vers la fiche si la personne lit une machine) et les machines
      concernées qu'elle lit. Un groupe inconnu répond 404. */
  async detail(user: SessionUser, cle: string): Promise<CorrectifDetailDto> {
    const maintenant = new Date();
    const failles = await this.failles(user, maintenant);
    const dans = failles.filter((f) => {
      const t = texteCorrectif(f.l.correctif);
      return (t === null ? CLE_SANS_CORRECTIF : cleCorrectif(t)) === cle;
    });
    const [groupe] = regrouperParCorrectif(
      dans.map((f) => f.groupe),
      cleCorrectif,
    );
    if (!groupe) throw new HttpError(404, 'Correctif introuvable.');
    const ids = dans.map((f) => f.l.id);
    const { rows } = await sql<{
      id: string;
      nom: string | null;
      adresse: string | null;
      role: RoleMachine | null;
      perimetre_nom: string | null;
      fin_support: boolean;
    }>`
      SELECT DISTINCT m.id, m.nom, m.adresse, m.role, sm.name AS perimetre_nom,
        EXISTS (SELECT 1 FROM vulnerabilites_detections d2 JOIN vulnerabilites_constats c2 ON c2.id = d2.constat_id
                WHERE d2.machine_id = m.id AND d2.vu_numero >= coalesce(e.numero_complet, 0)
                  AND c2.fin_support_le IS NOT NULL AND c2.fin_support_le <= now()) AS fin_support,
        lower(coalesce(m.nom, m.adresse, '')) AS tri
      FROM vulnerabilites_detections d
      JOIN vulnerabilites_machines m ON m.id = d.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      LEFT JOIN grc_smsis sm ON sm.id = ${perimetreMachine}
      WHERE d.constat_id = ANY(${ids}::uuid[]) AND ${present} AND ${lisible(user)}
      ORDER BY tri, m.id
      LIMIT ${CORRECTIFS_BORNES.machines + 1}`.execute(this.db.k);
    const ordre = (f: FailleCorrectifDto) => NIVEAUX_PRIORITE.indexOf(f.priorite);
    const liste = dans
      .map((f) => f.detail)
      .sort(
        (a, b) =>
          ordre(a) - ordre(b) || Number(b.exploitee) - Number(a.exploitee) || Number(a.plugin) - Number(b.plugin),
      );
    return {
      groupe,
      failles: liste.slice(0, CORRECTIFS_BORNES.failles),
      faillesTronquees: liste.length > CORRECTIFS_BORNES.failles,
      machines: rows.slice(0, CORRECTIFS_BORNES.machines).map((m): MachineCorrectifDto => ({
        id: m.id,
        nom: m.nom,
        adresse: m.adresse,
        role: m.role,
        perimetreNom: m.perimetre_nom,
        finDeSupport: m.fin_support,
      })),
      machinesTronquees: rows.length > CORRECTIFS_BORNES.machines,
    };
  }

  /** Constats présents encore à traiter, sur tous les faits connus, avec les machines que la personne lit. */
  private async failles(user: SessionUser, maintenant: Date): Promise<FailleCalculee[]> {
    const k = this.db.k;
    const reglage = await this.reglage.valeurs();
    const { rows } = await sql<LigneConstat>`
      WITH x AS (
        SELECT d.constat_id, ${lisible(user)} AS lu
        FROM vulnerabilites_detections d
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE ${present}),
      p AS (SELECT constat_id, bool_or(NOT lu) AS hors_lecture FROM x GROUP BY constat_id)
      SELECT c.id, c.plugin_id, c.nom, c.gravite, c.correctif, c.cvss3_score, c.epss_score, c.exploitable,
        c.exploite_malware, c.correctif_publie_le, c.fin_support_le, ${premiereConstat} AS premiere, p.hors_lecture, ${colonnesSuivi}
      FROM vulnerabilites_constats c JOIN p ON p.constat_id = c.id
      LEFT JOIN vulnerabilites_suivis s ON s.constat_id = c.id
      WHERE ${filtreSuivi(undefined, sql<boolean>`true`)}`.execute(k);
    const ids = rows.map((r) => r.id);
    const { rows: lues } = ids.length
      ? await sql<{ constat_id: string; machine_id: string }>`
          SELECT DISTINCT d.constat_id, d.machine_id
          FROM vulnerabilites_detections d
          JOIN vulnerabilites_machines m ON m.id = d.machine_id
          LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
          WHERE d.constat_id = ANY(${ids}::uuid[]) AND ${present} AND ${lisible(user)}`.execute(k)
      : { rows: [] };
    const { rows: cc } = ids.length
      ? await sql<{ constat_id: string; cve: string }>`SELECT constat_id, cve FROM vulnerabilites_constat_cves
          WHERE constat_id = ANY(${ids}::uuid[])`.execute(k)
      : { rows: [] };
    const faits = await lireFaitsCve(
      k,
      cc.map((x) => x.cve),
    );
    const cvesDe = new Map<string, string[]>();
    for (const x of cc) cvesDe.set(x.constat_id, [...(cvesDe.get(x.constat_id) ?? []), x.cve]);
    const machinesDe = new Map<string, string[]>();
    for (const x of lues) machinesDe.set(x.constat_id, [...(machinesDe.get(x.constat_id) ?? []), x.machine_id]);
    return rows.map((l): FailleCalculee => {
      const cves = cvesDe.get(l.id) ?? [];
      const sources = sourcesDe(
        cves.flatMap((c) => (faits.has(c) ? [faits.get(c)!] : [])),
        {
          gravite: l.gravite,
          cvss3: nombre(l.cvss3_score),
          epss: nombre(l.epss_score),
          exploitable: l.exploitable,
          malware: l.exploite_malware,
        },
      );
      const f = faitsDepuisSources(sources);
      const priorite = calculerPriorite({ ...f, presence: 'detectee' }, reglage).niveau;
      const correctif = etatCorrectif({
        tenablePublieLe: iso(l.correctif_publie_le),
        certSante: sources.certSante?.correctif ?? null,
      });
      const exploitee = f.exploitation.length > 0;
      const exploitable = f.exploitable.length > 0;
      const finDeSupport = etatFinSupport(iso(l.fin_support_le), maintenant) === 'atteinte';
      const delai = calculerDelai({
        priorite,
        etatSuivi: l.suivi_etat,
        present: true,
        premiere: l.premiere.toISOString(),
        repartLe: iso(l.suivi_repart),
        delais: reglage.delais,
        maintenant,
      });
      const machines = machinesDe.get(l.id) ?? [];
      return {
        l,
        groupe: {
          id: l.id,
          solution: l.correctif,
          priorite,
          exploitee,
          exploitable,
          correctif,
          finDeSupport,
          delai,
          cves,
          machinesLisibles: machines,
          horsLecture: l.hors_lecture,
        },
        detail: {
          id: l.id,
          plugin: String(l.plugin_id),
          nom: l.nom,
          priorite,
          exploitee,
          exploitable,
          correctif,
          situation: situationExploitation(exploitee, correctif.etat),
          finSupportLe: iso(l.fin_support_le),
          finDeSupport,
          delai,
          cves: cves.length,
          lisible: machines.length > 0,
        },
      };
    });
  }
}
