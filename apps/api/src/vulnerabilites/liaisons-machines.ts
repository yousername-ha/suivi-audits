/* Module Vulnérabilités (ADR 0100, lot ALH3 ; décision du RSSI du 17/11/2026) : actif exposé sur Internet (AlgoLightHouse,
   hôte ou domaine) relié à la ou aux machines internes (Tenable) vers lesquelles va la connexion. AlgoLightHouse ne range
   pas les services comme des objets : c'est l'actif qui est relié (un actif → une ou plusieurs machines, bornées).
   - Propositions calculées par la plateforme à la fin de chaque synchronisation reçue d'AlgoLightHouse ou de Tenable (dans
     sa transaction), jamais à la lecture : même adresse, ou nom de la machine qui correspond au domaine (critères et
     transitions : packages/shared/src/liaisons-surface.ts, qui reprend la règle du rapprochement des failles). Rien n'est
     relié sans une personne ; un rejet ou une déliaison n'est pas reproposé à données égales.
   - Lecture : une liaison ou une proposition n'est montrée que si la personne lit l'actif (périmètre ALH relié, sinon
     administrer) ET la machine (périmètre effectif, `lisible`) ; sinon la machine n'est ni nommée ni comptée. Seule une
     liaison confirmée vers une machine illisible est signalée, sans nom ni nombre (`autresMachines`) ; une proposition vers
     une machine illisible ne se voit d'aucune façon.
   - Écriture (`vulnerabilites:modifier`, route) : confirmer, rejeter, relier, délier exigent de lire l'actif et la machine,
     l'écriture sur le périmètre de l'actif et sur le périmètre effectif de la machine (sans périmètre : lisible seulement
     avec administrer), If-Match sur la version des liaisons de l'actif. Une machine ou une liaison illisible répond
     comme inconnue.
   - Liaison en masse (lot ALH5, décision C du RSSI du 17/11/2026) : motif à joker « * » pour les actifs et, en mode « un
     pour un », pour les machines (comparaison littérale, packages/shared : correspondanceJoker) ; aperçu obligatoire et
     borné, application sur les seules paires de l'aperçu validé (empreinte), chacune revérifiée (droits de lecture et
     d'écriture, version des liaisons de l'actif, plafond) ; liaisons confirmées d'origine « masse ».
   Journal `vulnerabilites.surface.liaison.*`, `vulnerabilites.surface.liaisons.recalculees` et
   `vulnerabilites.surface.liaisons.reliees_en_masse` (une entrée par opération : motifs saisis, mode et nombres) :
   identifiants internes, statuts, critères et nombres ; jamais un nom de machine, un domaine, une adresse ni la note.
   Kysely (ADR 0062). */
import { createHash } from 'node:crypto';
import {
  type ActifMasseDto,
  ApplicationLiaisonMasse,
  type ApercuLiaisonMasseDto,
  correspondanceJoker,
  DemandeLiaisonMasse,
  LIAISONS_MASSE_MAX,
  LIGNES_APERCU_MASSE_MAX,
  type MachineMasseDto,
  type ResultatLiaisonMasseDto,
  type CorpsDeliaisonMachine,
  type CorpsLiaisonMachine,
  critereLiaisonMachine,
  type DecisionLiaisonMachine,
  type ExpositionMachineDto,
  type FicheLiaisonsActifDto,
  type FiltreLiaisonActif,
  LIAISONS_MACHINES_PAR_ACTIF_MAX,
  type LiaisonMachineDto,
  type MotifLiaisonMachine,
  normaliserAdresseIp,
  nomCourt,
  normaliserNomDns,
  type OrigineLiaisonMachine,
  type PageSurface,
  type PropositionLiaisonDto,
  PROPOSITIONS_MACHINES_PAR_ACTIF_MAX,
  rangMotifLiaison,
  type RechercheLiaisonsMachines,
  type ResumeLiaisonsActifDto,
  type RoleMachine,
  type StatutLiaisonMachine,
  SURFACE_PAR_PAGE,
  transitionLiaisonMachine,
  type TypeActifAlh,
  adressesActif,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { lisible, lisibleAlh, perimetreMachine } from './sql.js';

const AUTOMATE = { username: 'rapprochement automatique' };
const LIAISON_INTROUVABLE = 'Liaison introuvable ou non accessible.';
const ACTIF_INTROUVABLE = 'Actif introuvable ou non accessible.';
const MACHINE_INTROUVABLE = 'Machine introuvable ou non accessible.';
const empreinte = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const empreinteActif = (a: { type: TypeActifAlh; valeur: string; adresse: string | null }) =>
  empreinte(['actif', a.type, a.valeur, a.adresse]);
const empreinteMachine = (m: { nom: string | null; adresse: string | null }) =>
  empreinte(['machine', m.nom, m.adresse]);
/** Un seul recalcul ou une seule décision à la fois (les deux synchronisations peuvent finir ensemble). */
const verrou = (k: Kdb) =>
  sql`SELECT pg_advisory_xact_lock(hashtextextended('vulnerabilites.liaisons-machines', 0))`.execute(k);

/* ------------------------------------------------------------------ Fragments pour la liste des actifs (alias `x`) */
/** Filtre « Machine interne » de la liste des actifs (alias `x` de vulnerabilites_alh_actifs), sur les machines lisibles. */
export function filtreLiaison(user: SessionUser, f: FiltreLiaisonActif): RawBuilder<boolean> {
  const existe = (statuts: StatutLiaisonMachine[]) =>
    sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_alh_liaisons_machines l
      JOIN vulnerabilites_machines m ON m.id = l.machine_id
      WHERE l.actif_id = x.id AND l.statut = ANY(${statuts}::text[]) AND ${lisible(user)})`;
  if (f === 'reliee') return existe(['confirmee']);
  if (f === 'proposee') return existe(['proposee']);
  return sql<boolean>`NOT ${existe(['confirmee', 'proposee'])}`;
}

/** Résumé des liaisons d'actifs déjà lisibles (colonne « Machine interne ») : machines reliées et propositions lisibles ;
    une liaison confirmée vers une machine illisible n'est signalée que par un drapeau. */
export async function resumesLiaisons(
  k: Kdb,
  user: SessionUser,
  actifs: readonly string[],
): Promise<Map<string, ResumeLiaisonsActifDto>> {
  const out = new Map<string, ResumeLiaisonsActifDto>(
    actifs.map((id) => [id, { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false }]),
  );
  if (!actifs.length) return out;
  const { rows } = await sql<{
    actif_id: string;
    statut: 'proposee' | 'confirmee';
    id: string;
    nom: string | null;
    adresse: string | null;
    lisible: boolean;
  }>`SELECT l.actif_id, l.statut, m.id, m.nom, m.adresse, ${lisible(user)} AS lisible
     FROM vulnerabilites_alh_liaisons_machines l
     JOIN vulnerabilites_machines m ON m.id = l.machine_id
     WHERE l.actif_id = ANY(${[...actifs]}::uuid[]) AND l.statut IN ('proposee', 'confirmee')
     ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id`.execute(k);
  for (const r of rows) {
    const x = out.get(r.actif_id)!;
    if (!r.lisible) {
      // Une proposition vers une machine illisible ne laisse aucune trace ; une liaison confirmée, un drapeau sans nom.
      if (r.statut === 'confirmee') x.autresMachines = true;
      continue;
    }
    if (r.statut === 'proposee') x.propositions++;
    else {
      x.nombreReliees++;
      if (x.reliees.length < 3) x.reliees.push({ id: r.id, nom: r.nom, adresse: r.adresse });
    }
  }
  return out;
}

/** Liaisons d'actifs déjà lisibles, pour la carte de la surface externe (lot ALH4) : toutes les machines reliées lisibles
    (vingt au plus par actif), propositions lisibles comptées ; mêmes règles que le résumé de la liste (une proposition vers
    une machine illisible ne laisse aucune trace, une liaison confirmée vers elle n'est qu'un drapeau). */
export async function liaisonsCarte(
  k: Kdb,
  user: SessionUser,
  actifs: readonly string[],
): Promise<
  Map<
    string,
    {
      machines: { id: string; nom: string | null; adresse: string | null; role: RoleMachine | null }[];
      propositions: number;
      autresMachines: boolean;
    }
  >
> {
  const out = new Map(
    actifs.map((id) => [
      id,
      {
        machines: [] as { id: string; nom: string | null; adresse: string | null; role: RoleMachine | null }[],
        propositions: 0,
        autresMachines: false,
      },
    ]),
  );
  if (!actifs.length) return out;
  const { rows } = await sql<{
    actif_id: string;
    statut: 'proposee' | 'confirmee';
    id: string;
    nom: string | null;
    adresse: string | null;
    role: RoleMachine | null;
    lisible: boolean;
  }>`SELECT l.actif_id, l.statut, m.id, m.nom, m.adresse, m.role, ${lisible(user)} AS lisible
     FROM vulnerabilites_alh_liaisons_machines l
     JOIN vulnerabilites_machines m ON m.id = l.machine_id
     WHERE l.actif_id = ANY(${[...actifs]}::uuid[]) AND l.statut IN ('proposee', 'confirmee')
     ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id`.execute(k);
  for (const r of rows) {
    const x = out.get(r.actif_id)!;
    if (!r.lisible) {
      if (r.statut === 'confirmee') x.autresMachines = true;
      continue;
    }
    if (r.statut === 'proposee') x.propositions++;
    else if (x.machines.length < LIAISONS_MACHINES_PAR_ACTIF_MAX)
      x.machines.push({ id: r.id, nom: r.nom, adresse: r.adresse, role: r.role });
  }
  return out;
}

interface LigneLiaison {
  id: string;
  actif_id: string;
  statut: StatutLiaisonMachine;
  motif: MotifLiaisonMachine | null;
  origine: OrigineLiaisonMachine;
  decide_par: string | null;
  decide_le: Date | null;
  note: string;
  calcule_le: Date;
  machine_id: string;
  machine_nom: string | null;
  machine_adresse: string | null;
  machine_role: RoleMachine | null;
  machine_perimetre_nom: string | null;
}

const versDto = (r: LigneLiaison): LiaisonMachineDto => ({
  id: r.id,
  statut: r.statut,
  motif: r.motif,
  origine: r.origine,
  machine: {
    id: r.machine_id,
    nom: r.machine_nom,
    adresse: r.machine_adresse,
    role: r.machine_role,
    perimetreNom: r.machine_perimetre_nom,
  },
  decidePar: r.decide_par,
  decideLe: r.decide_le?.toISOString() ?? null,
  note: r.note,
  calculeLe: r.calcule_le.toISOString(),
});

/** Colonnes d'une liaison et de sa machine (alias `l`, `m`, `sm` : périmètre effectif de la machine). */
const COLONNES = sql`l.id, l.actif_id, l.statut, l.motif, l.origine, l.decide_par, l.decide_le, l.note, l.calcule_le,
  m.id AS machine_id, m.nom AS machine_nom, m.adresse AS machine_adresse, m.role AS machine_role,
  sm.name AS machine_perimetre_nom`;

export class LiaisonsMachines {
  constructor(
    private readonly db: Db,
    private readonly g: Grc,
  ) {}

  /* ---------------------------------------------------------------- Recalcul des propositions */
  /** Recalcule les propositions de tous les actifs (dans la transaction de la fin d'une synchronisation). Seuls les actifs
      et les machines vus par la dernière synchronisation complète de leur instance (ou plus récemment) sont proposés ; une
      proposition dont le critère ne tient plus est retirée ; une liaison confirmée ne change pas ; un rejet reste tant que
      les données de l'actif et de la machine sont les mêmes. Rend le nombre de liaisons créées ou modifiées. */
  async recalculer(k: Kdb, c: Client): Promise<number> {
    await verrou(k);
    const { rows: actifs } = await sql<{
      id: string;
      type: TypeActifAlh;
      valeur: string;
      adresse: string | null;
      present: boolean;
    }>`SELECT x.id, x.type, x.valeur, x.adresse, x.vu_numero >= coalesce(e.numero_complet, 0) AS present
       FROM vulnerabilites_alh_actifs x
       LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id`.execute(k);
    const { rows: machines } = await sql<{
      id: string;
      nom: string | null;
      adresse: string | null;
      present: boolean;
    }>`SELECT m.id, m.nom, m.adresse, m.vu_numero >= coalesce(e.numero_complet, 0) AS present
       FROM vulnerabilites_machines m
       LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id`.execute(k);
    const actifParId = new Map(actifs.map((a) => [a.id, a]));
    const machineParId = new Map(machines.map((m) => [m.id, m]));
    const indexer = (cle: (m: (typeof machines)[number]) => string | null) => {
      const index = new Map<string, string[]>();
      for (const m of machines) {
        const v = m.present ? cle(m) : null;
        if (!v) continue;
        const ids = index.get(v);
        if (ids) ids.push(m.id);
        else index.set(v, [m.id]);
      }
      return index;
    };
    const parAdresse = indexer((m) => normaliserAdresseIp(m.adresse));
    const parNom = indexer((m) => normaliserNomDns(m.nom));
    const parCourt = indexer((m) => nomCourt(m.nom));
    const candidats = new Map<string, MotifLiaisonMachine>();
    const cle = (actif: string, machine: string) => `${actif}|${machine}`;
    for (const a of actifs) {
      if (!a.present) continue;
      const ids = new Set<string>(adressesActif(a).flatMap((ip) => parAdresse.get(ip) ?? []));
      if (a.type === 'domaine') {
        const d = normaliserNomDns(a.valeur);
        for (const id of [...(d ? (parNom.get(d) ?? []) : []), ...(d ? (parCourt.get(nomCourt(d)!) ?? []) : [])])
          ids.add(id);
      }
      const trouves = [...ids]
        .map((id) => ({ id, motif: critereLiaisonMachine(a, machineParId.get(id)!) }))
        .filter((x): x is { id: string; motif: MotifLiaisonMachine } => x.motif !== null)
        .sort((x, y) => rangMotifLiaison(x.motif) - rangMotifLiaison(y.motif) || (x.id < y.id ? -1 : 1))
        .slice(0, PROPOSITIONS_MACHINES_PAR_ACTIF_MAX);
      for (const x of trouves) candidats.set(cle(a.id, x.id), x.motif);
    }
    const existants = new Map(
      (await k.selectFrom('vulnerabilites_alh_liaisons_machines').selectAll().execute()).map((l) => [
        cle(l.actif_id, l.machine_id),
        l,
      ]),
    );
    const bilan: Partial<Record<StatutLiaisonMachine, number>> = {};
    const nouveaux: Record<string, unknown>[] = [];
    let changements = 0;
    for (const paire of [...new Set([...candidats.keys(), ...existants.keys()])].sort()) {
      const [actifId, machineId] = paire.split('|') as [string, string];
      const a = actifParId.get(actifId)!;
      const m = machineParId.get(machineId)!;
      const motif = candidats.get(paire) ?? null;
      const courant = existants.get(paire);
      const actuel = { empreinteActif: empreinteActif(a), empreinteMachine: empreinteMachine(m) };
      const t = transitionLiaisonMachine(
        courant
          ? {
              statut: courant.statut,
              empreinteActif: courant.empreinte_actif,
              empreinteMachine: courant.empreinte_machine,
            }
          : null,
        motif,
        actuel,
      );
      if (!t) continue;
      const valeurs = {
        statut: t.statut,
        motif: t.statut === 'proposee' ? motif : (courant?.motif ?? null),
        origine: t.statut === 'proposee' ? ('proposition' as const) : (courant?.origine ?? ('proposition' as const)),
        empreinte_actif: actuel.empreinteActif,
        empreinte_machine: actuel.empreinteMachine,
        decide_par: t.garderDecision ? (courant?.decide_par ?? null) : null,
        decide_le: t.garderDecision ? (courant?.decide_le ?? null) : null,
        note: t.garderDecision ? (courant?.note ?? '') : '',
      };
      if (!courant) nouveaux.push({ actif_id: actifId, machine_id: machineId, ...valeurs });
      else {
        const change = (Object.keys(valeurs) as (keyof typeof valeurs)[]).some(
          (x) => JSON.stringify(valeurs[x]) !== JSON.stringify(courant[x]),
        );
        if (!change) continue;
        await k
          .updateTable('vulnerabilites_alh_liaisons_machines')
          .set({ ...valeurs, calcule_le: sql<Date>`now()` })
          .where('id', '=', courant.id)
          .execute();
      }
      changements++;
      bilan[t.statut] = (bilan[t.statut] ?? 0) + 1;
    }
    for (let i = 0; i < nouveaux.length; i += 1000)
      await k
        .insertInto('vulnerabilites_alh_liaisons_machines')
        .values(nouveaux.slice(i, i + 1000) as never)
        .execute();
    if (changements)
      await this.db.audit(
        AUTOMATE,
        null,
        'vulnerabilites.surface.liaisons.recalculees',
        '',
        { changements, statuts: bilan },
        c,
      );
    return changements;
  }

  /* ---------------------------------------------------------------- Lecture (vulnerabilites:lire) */
  /** Fiche des liaisons d'un actif lisible : reliées, propositions et rejets dont la machine est lisible ; drapeau d'une
      liaison confirmée vers une machine illisible. Actif illisible ou inconnu : 404. */
  async fiche(user: SessionUser, actifId: string, k: Kdb = this.db.k): Promise<FicheLiaisonsActifDto> {
    const { rows: actif } = await sql<{ id: string; liaisons_version: number }>`
      SELECT x.id, x.liaisons_version FROM vulnerabilites_alh_actifs x
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      WHERE x.id = ${actifId}::uuid AND ${lisibleAlh(user)}`.execute(k);
    if (!actif[0]) throw new HttpError(404, ACTIF_INTROUVABLE);
    const { rows } = await sql<LigneLiaison & { lisible: boolean }>`
      SELECT ${COLONNES}, ${lisible(user)} AS lisible
      FROM vulnerabilites_alh_liaisons_machines l
      JOIN vulnerabilites_machines m ON m.id = l.machine_id
      LEFT JOIN grc_smsis sm ON sm.id = ${perimetreMachine}
      WHERE l.actif_id = ${actifId}::uuid AND l.statut <> 'retiree'
      ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id`.execute(k);
    const lues = rows.filter((r) => r.lisible);
    const de = (s: StatutLiaisonMachine) => lues.filter((r) => r.statut === s).map(versDto);
    return {
      actifId,
      versionLiaisons: actif[0].liaisons_version,
      reliees: de('confirmee'),
      propositions: de('proposee'),
      rejetees: de('rejetee'),
      autresMachines: rows.some((r) => !r.lisible && r.statut === 'confirmee'),
      max: LIAISONS_MACHINES_PAR_ACTIF_MAX,
    };
  }

  /** Liaisons d'un statut (par défaut : les propositions à décider) dont l'actif et la machine sont lisibles. */
  async lister(user: SessionUser, q: RechercheLiaisonsMachines): Promise<PageSurface<PropositionLiaisonDto>> {
    const { rows } = await sql<
      LigneLiaison & {
        actif_type: TypeActifAlh;
        actif_valeur: string;
        actif_adresse: string | null;
        perimetre_alh_nom: string | null;
        perimetre_nom: string | null;
        liaisons_version: number;
        total: number;
      }
    >`
      SELECT ${COLONNES}, x.type AS actif_type, x.valeur AS actif_valeur, x.adresse AS actif_adresse,
        lp.nom AS perimetre_alh_nom, sx.name AS perimetre_nom, x.liaisons_version, count(*) OVER ()::int AS total
      FROM vulnerabilites_alh_liaisons_machines l
      JOIN vulnerabilites_alh_actifs x ON x.id = l.actif_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      LEFT JOIN grc_smsis sx ON sx.id = lp.perimetre_id
      JOIN vulnerabilites_machines m ON m.id = l.machine_id
      LEFT JOIN grc_smsis sm ON sm.id = ${perimetreMachine}
      WHERE l.statut = ${q.statut} AND ${lisibleAlh(user)} AND ${lisible(user)}
      ORDER BY x.type, x.valeur, lower(coalesce(m.nom, m.adresse, '')), l.id
      LIMIT ${SURFACE_PAR_PAGE} OFFSET ${(q.page - 1) * SURFACE_PAR_PAGE}`.execute(this.db.k);
    return {
      total: rows[0]?.total ?? 0,
      page: q.page,
      parPage: SURFACE_PAR_PAGE,
      elements: rows.map((r) => ({
        ...versDto(r),
        actif: {
          id: r.actif_id,
          type: r.actif_type,
          valeur: r.actif_valeur,
          adresse: r.actif_adresse,
          perimetreAlh: r.perimetre_alh_nom,
          perimetreNom: r.perimetre_nom,
        },
        versionLiaisons: r.liaisons_version,
      })),
    };
  }

  /** Fiche d'une machine lisible : actifs exposés lisibles reliés à elle ; drapeau d'un actif relié illisible. */
  async deMachine(user: SessionUser, machineId: string): Promise<ExpositionMachineDto> {
    const { rows: m } = await sql<{ id: string }>`SELECT m.id FROM vulnerabilites_machines m
      WHERE m.id = ${machineId}::uuid AND ${lisible(user)}`.execute(this.db.k);
    if (!m[0]) throw new HttpError(404, MACHINE_INTROUVABLE);
    const { rows } = await sql<{
      liaison_id: string;
      origine: OrigineLiaisonMachine;
      motif: MotifLiaisonMachine | null;
      id: string;
      type: TypeActifAlh;
      valeur: string;
      adresse: string | null;
      perimetre_alh_nom: string | null;
      perimetre_nom: string | null;
      lisible: boolean;
    }>`
      SELECT l.id AS liaison_id, l.origine, l.motif, x.id, x.type, x.valeur, x.adresse, lp.nom AS perimetre_alh_nom,
        sx.name AS perimetre_nom, ${lisibleAlh(user)} AS lisible
      FROM vulnerabilites_alh_liaisons_machines l
      JOIN vulnerabilites_alh_actifs x ON x.id = l.actif_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      LEFT JOIN grc_smsis sx ON sx.id = lp.perimetre_id
      WHERE l.machine_id = ${machineId}::uuid AND l.statut = 'confirmee'
      ORDER BY x.type DESC, x.valeur, x.id`.execute(this.db.k);
    return {
      actifs: rows
        .filter((r) => r.lisible)
        .map((r) => ({
          id: r.id,
          type: r.type,
          valeur: r.valeur,
          adresse: r.adresse,
          perimetreAlh: r.perimetre_alh_nom,
          // Le nom du périmètre de la plateforme n'est donné que s'il est relié (lisible, puisque l'actif l'est).
          perimetreNom: r.perimetre_nom,
          liaisonId: r.liaison_id,
          origine: r.origine,
          motif: r.motif,
        })),
      autresActifs: rows.some((r) => !r.lisible),
    };
  }

  /* ---------------------------------------------------------------- Écriture (vulnerabilites:modifier) */
  /** Actif lisible, verrouillé, avec la version de ses liaisons et son périmètre (null : non relié, administrer). */
  private async actif(k: Kdb, user: SessionUser, id: string) {
    const { rows } = await sql<{
      id: string;
      type: TypeActifAlh;
      valeur: string;
      adresse: string | null;
      liaisons_version: number;
      perimetre_id: string | null;
    }>`SELECT x.id, x.type, x.valeur, x.adresse, x.liaisons_version, lp.perimetre_id
       FROM vulnerabilites_alh_actifs x
       LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
       WHERE x.id = ${id}::uuid AND ${lisibleAlh(user)} FOR UPDATE OF x`.execute(k);
    return rows[0];
  }

  /** Machine lisible, avec son périmètre effectif (null : sans périmètre, administrer). */
  private async machine(k: Kdb, user: SessionUser, id: string) {
    const { rows } = await sql<{ id: string; nom: string | null; adresse: string | null; perimetre_id: string | null }>`
      SELECT m.id, m.nom, m.adresse, ${perimetreMachine} AS perimetre_id FROM vulnerabilites_machines m
      WHERE m.id = ${id}::uuid AND ${lisible(user)}`.execute(k);
    return rows[0];
  }

  /** Écriture sur le périmètre de l'actif et sur le périmètre effectif de la machine. Un élément sans périmètre n'est lisible
      qu'avec administrer : sa lecture vaut le contrôle (comme l'affectation d'une machine). */
  private async controlerEcriture(c: Client, user: SessionUser, perimetres: (string | null)[]) {
    for (const p of new Set(perimetres)) if (p) await this.g.access(p, user, true, c);
  }

  private async relieesDe(k: Kdb, actifId: string): Promise<number> {
    const r = await k
      .selectFrom('vulnerabilites_alh_liaisons_machines')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('actif_id', '=', actifId)
      .where('statut', '=', 'confirmee')
      .executeTakeFirstOrThrow();
    return r.n;
  }

  private async plafond(k: Kdb, actifId: string) {
    if ((await this.relieesDe(k, actifId)) >= LIAISONS_MACHINES_PAR_ACTIF_MAX)
      throw new HttpError(
        409,
        `Cet actif est déjà relié au nombre maximal de machines internes (${LIAISONS_MACHINES_PAR_ACTIF_MAX}) : déliez-en une avant d’en relier une autre.`,
      );
  }

  private async nouvelleVersion(k: Kdb, actifId: string) {
    await k
      .updateTable('vulnerabilites_alh_actifs')
      .set((eb) => ({ liaisons_version: eb('liaisons_version', '+', 1) }))
      .where('id', '=', actifId)
      .execute();
  }

  /** Liaison lisible (actif et machine lisibles), verrouillée avec son actif ; illisible ou inconnue : 404. */
  private async liaison(k: Kdb, user: SessionUser, id: string) {
    const l = await k
      .selectFrom('vulnerabilites_alh_liaisons_machines')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!l) throw new HttpError(404, LIAISON_INTROUVABLE);
    const a = await this.actif(k, user, l.actif_id);
    const m = a ? await this.machine(k, user, l.machine_id) : undefined;
    if (!a || !m) throw new HttpError(404, LIAISON_INTROUVABLE);
    return { l, a, m };
  }

  /** Confirmer ou rejeter une proposition (If-Match : version des liaisons de l'actif). */
  async decider(
    id: string,
    body: DecisionLiaisonMachine,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<FicheLiaisonsActifDto> {
    const actifId = await this.db.tx(async (c, k) => {
      await verrou(k);
      const { l, a, m } = await this.liaison(k, user, id);
      if (a.liaisons_version !== attendue)
        throw conflict({ ...(await this.fiche(user, a.id, k)), version: a.liaisons_version });
      if (l.statut !== 'proposee')
        throw new HttpError(409, 'Cette proposition n’est plus à décider : rechargez la fiche de l’actif.');
      await this.controlerEcriture(c, user, [a.perimetre_id, m.perimetre_id]);
      const statut: StatutLiaisonMachine = body.decision === 'confirmer' ? 'confirmee' : 'rejetee';
      if (statut === 'confirmee') await this.plafond(k, a.id);
      await k
        .updateTable('vulnerabilites_alh_liaisons_machines')
        .set({
          statut,
          decide_par: user.username,
          decide_le: sql<Date>`now()`,
          note: body.note,
          empreinte_actif: empreinteActif(a),
          empreinte_machine: empreinteMachine(m),
        })
        .where('id', '=', id)
        .execute();
      await this.nouvelleVersion(k, a.id);
      await this.db.audit(
        user,
        ip,
        statut === 'confirmee' ? 'vulnerabilites.surface.liaison.confirmee' : 'vulnerabilites.surface.liaison.rejetee',
        id,
        { actif: a.id, machine: m.id, motif: l.motif, versionLiaisons: attendue + 1 },
        c,
      );
      return a.id;
    }, user.username);
    return this.fiche(user, actifId);
  }

  /** Relier à la main un actif lisible à une machine lisible (If-Match : version des liaisons de l'actif). Une proposition
      ou un rejet existant devient la liaison confirmée. */
  async relier(
    actifId: string,
    body: CorpsLiaisonMachine,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<FicheLiaisonsActifDto> {
    await this.db.tx(async (c, k) => {
      await verrou(k);
      const a = await this.actif(k, user, actifId);
      if (!a) throw new HttpError(404, ACTIF_INTROUVABLE);
      const m = await this.machine(k, user, body.machineId);
      if (!m) throw new HttpError(404, MACHINE_INTROUVABLE);
      if (a.liaisons_version !== attendue)
        throw conflict({ ...(await this.fiche(user, a.id, k)), version: a.liaisons_version });
      await this.controlerEcriture(c, user, [a.perimetre_id, m.perimetre_id]);
      const avant = await k
        .selectFrom('vulnerabilites_alh_liaisons_machines')
        .select(['id', 'statut', 'origine'])
        .where('actif_id', '=', a.id)
        .where('machine_id', '=', m.id)
        .forUpdate()
        .executeTakeFirst();
      if (avant?.statut === 'confirmee') throw new HttpError(409, 'Cette machine est déjà reliée à l’actif.');
      await this.plafond(k, a.id);
      const valeurs = {
        statut: 'confirmee' as const,
        motif: critereLiaisonMachine(a, m),
        // Relier à la main une machine proposée revient à confirmer la proposition.
        origine: avant?.statut === 'proposee' ? ('proposition' as const) : ('manuelle' as const),
        empreinte_actif: empreinteActif(a),
        empreinte_machine: empreinteMachine(m),
        decide_par: user.username,
        decide_le: sql<Date>`now()`,
        note: body.note,
      };
      const r = avant
        ? await k
            .updateTable('vulnerabilites_alh_liaisons_machines')
            .set(valeurs)
            .where('id', '=', avant.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await k
            .insertInto('vulnerabilites_alh_liaisons_machines')
            .values({ actif_id: a.id, machine_id: m.id, ...valeurs })
            .returning('id')
            .executeTakeFirstOrThrow();
      await this.nouvelleVersion(k, a.id);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.surface.liaison.reliee',
        r.id,
        {
          actif: a.id,
          machine: m.id,
          motif: valeurs.motif,
          origine: valeurs.origine,
          avant: avant?.statut ?? null,
          versionLiaisons: attendue + 1,
        },
        c,
      );
    }, user.username);
    return this.fiche(user, actifId);
  }

  /** Délier une machine reliée (If-Match : version des liaisons de l'actif) : la liaison devient « rejetée », et n'est pas
      reproposée tant que les données de l'actif et de la machine n'ont pas changé. */
  async delier(
    id: string,
    body: CorpsDeliaisonMachine,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<FicheLiaisonsActifDto> {
    const actifId = await this.db.tx(async (c, k) => {
      await verrou(k);
      const { l, a, m } = await this.liaison(k, user, id);
      if (a.liaisons_version !== attendue)
        throw conflict({ ...(await this.fiche(user, a.id, k)), version: a.liaisons_version });
      if (l.statut !== 'confirmee')
        throw new HttpError(409, 'Cette machine n’est plus reliée à l’actif : rechargez la fiche de l’actif.');
      await this.controlerEcriture(c, user, [a.perimetre_id, m.perimetre_id]);
      await k
        .updateTable('vulnerabilites_alh_liaisons_machines')
        .set({
          statut: 'rejetee',
          decide_par: user.username,
          decide_le: sql<Date>`now()`,
          note: body.note,
          empreinte_actif: empreinteActif(a),
          empreinte_machine: empreinteMachine(m),
        })
        .where('id', '=', id)
        .execute();
      await this.nouvelleVersion(k, a.id);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.surface.liaison.deliee',
        id,
        { actif: a.id, machine: m.id, origine: l.origine, versionLiaisons: attendue + 1 },
        c,
      );
      return a.id;
    }, user.username);
    return this.fiche(user, actifId);
  }

  /* ---------------------------------------------------------------- Liaison en masse (lot ALH5, décision C) */
  /** Paires d'une demande, calculées sur ce que la personne lit : actifs lisibles et présents dont la valeur (domaine ou
      adresse) correspond au motif ; machines lisibles dont le nom correspond au motif (un pour un : même partie couverte
      par les jokers, une seule machine), ou la machine choisie. Écartées et comptées : sans correspondance, plusieurs
      machines, déjà reliées, actif au plafond, écriture refusée sur l'un des deux périmètres. Rien n'est écrit. */
  private async calculerMasse(k: Kdb, user: SessionUser, d: DemandeLiaisonMasse) {
    const { rows: actifs } = await sql<{
      id: string;
      type: TypeActifAlh;
      valeur: string;
      adresse: string | null;
      liaisons_version: number;
      perimetre_id: string | null;
      reliees: number;
    }>`SELECT x.id, x.type, x.valeur, x.adresse, x.liaisons_version, lp.perimetre_id,
         (SELECT count(*)::int FROM vulnerabilites_alh_liaisons_machines lc
            WHERE lc.actif_id = x.id AND lc.statut = 'confirmee') AS reliees
       FROM vulnerabilites_alh_actifs x
       LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
       LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
       WHERE ${lisibleAlh(user)} AND x.vu_numero >= coalesce(e.numero_complet, 0)
       ORDER BY x.type, x.valeur, x.id`.execute(k);
    const retenus = actifs.flatMap((a) => {
      const parts = correspondanceJoker(d.motifActifs, a.valeur);
      return parts ? [{ a, cle: parts.join('\u0000') }] : [];
    });
    type Machine = { id: string; nom: string | null; adresse: string | null; perimetre_id: string | null };
    let choisie: Machine | null = null;
    const parCle = new Map<string, Machine[]>();
    if (d.mode === 'tous_vers_une') {
      choisie = (await this.machine(k, user, d.machineId)) ?? null;
      if (!choisie) throw new HttpError(404, MACHINE_INTROUVABLE);
    } else {
      const { rows: machines } = await sql<Machine>`
        SELECT m.id, m.nom, m.adresse, ${perimetreMachine} AS perimetre_id FROM vulnerabilites_machines m
        WHERE m.nom IS NOT NULL AND ${lisible(user)} ORDER BY lower(m.nom), m.id`.execute(k);
      for (const m of machines) {
        const parts = correspondanceJoker(d.motifMachines, m.nom!);
        if (!parts) continue;
        const cle = parts.join('\u0000');
        parCle.set(cle, [...(parCle.get(cle) ?? []), m]);
      }
    }
    const ids = retenus.map((x) => x.a.id);
    const deja = new Set(
      ids.length
        ? (
            await sql<{
              cle: string;
            }>`SELECT actif_id || '|' || machine_id AS cle FROM vulnerabilites_alh_liaisons_machines
              WHERE statut = 'confirmee' AND actif_id = ANY(${ids}::uuid[])`.execute(k)
          ).rows.map((x) => x.cle)
        : [],
    );
    const perimetres = [
      ...new Set(
        [
          ...retenus.map((x) => x.a.perimetre_id),
          choisie?.perimetre_id,
          ...[...parCle.values()].flat().map((m) => m.perimetre_id),
        ].filter((x): x is string => !!x),
      ),
    ];
    // Écriture sur un périmètre : même règle que les périmètres affectables (administration de la plateforme, ou accès en
    // écriture par la pyramide) ; un élément sans périmètre n'est lisible qu'avec administrer, sa lecture vaut le contrôle.
    const ecriture = new Set(
      perimetres.length
        ? (
            await sql<{ id: string }>`SELECT s.id FROM grc_smsis s WHERE s.id = ANY(${perimetres}::uuid[])
              AND (grc_est_admin(${user.id}::uuid) OR grc_acces_perimetre(s.id, ${user.id}::uuid) IS TRUE)`.execute(k)
          ).rows.map((x) => x.id)
        : [],
    );
    const ecrit = (p: string | null) => p === null || ecriture.has(p);
    const actifDto = (a: (typeof actifs)[number]): ActifMasseDto => ({ id: a.id, type: a.type, valeur: a.valeur });
    const machineDto = (m: Machine): MachineMasseDto => ({ id: m.id, nom: m.nom, adresse: m.adresse });
    const paires: { a: (typeof actifs)[number]; m: Machine }[] = [];
    const sansCorrespondance: ActifMasseDto[] = [];
    const multiples: { actif: ActifMasseDto; machines: number }[] = [];
    let dejaReliees = 0;
    let plafond = 0;
    let nonModifiables = 0;
    for (const { a, cle } of retenus) {
      const candidates = choisie ? [choisie] : (parCle.get(cle) ?? []);
      if (!candidates.length) {
        sansCorrespondance.push(actifDto(a));
        continue;
      }
      if (candidates.length > 1) {
        multiples.push({ actif: actifDto(a), machines: candidates.length });
        continue;
      }
      const m = candidates[0]!;
      if (deja.has(`${a.id}|${m.id}`)) dejaReliees++;
      else if (a.reliees >= LIAISONS_MACHINES_PAR_ACTIF_MAX) plafond++;
      else if (!ecrit(a.perimetre_id) || !ecrit(m.perimetre_id)) nonModifiables++;
      else paires.push({ a, m });
    }
    return {
      paires,
      dto: (empreinte: string): ApercuLiaisonMasseDto => ({
        demande: d,
        machine: choisie ? machineDto(choisie) : null,
        paires: paires.map((x) => ({
          actif: actifDto(x.a),
          machine: machineDto(x.m),
          versionLiaisons: x.a.liaisons_version,
        })),
        actifs: retenus.length,
        sansCorrespondance: sansCorrespondance.slice(0, LIGNES_APERCU_MASSE_MAX),
        nombreSansCorrespondance: sansCorrespondance.length,
        multiples: multiples.slice(0, LIGNES_APERCU_MASSE_MAX),
        nombreMultiples: multiples.length,
        dejaReliees,
        plafond,
        nonModifiables,
        empreinte,
        max: LIAISONS_MASSE_MAX,
      }),
    };
  }

  /** Empreinte d'un aperçu : la personne, la demande et les paires (identifiants et version des liaisons de l'actif). */
  private static empreinteMasse(
    user: SessionUser,
    d: DemandeLiaisonMasse,
    paires: readonly { actifId: string; machineId: string; versionLiaisons: number }[],
  ): string {
    return empreinte([
      'vulnerabilites.liaisons-masse',
      user.id,
      d.mode,
      d.motifActifs,
      d.mode === 'un_pour_un' ? d.motifMachines : d.machineId,
      [...paires]
        .map((p) => [p.actifId, p.machineId, p.versionLiaisons] as const)
        .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)),
    ]);
  }

  /** Aperçu d'une liaison en masse (rien n'est écrit) ; au-delà de LIAISONS_MASSE_MAX paires : 422 avec le nombre. */
  async apercuMasse(user: SessionUser, body: DemandeLiaisonMasse): Promise<ApercuLiaisonMasseDto> {
    const d = DemandeLiaisonMasse.parse(body);
    const r = await this.calculerMasse(this.db.k, user, d);
    if (r.paires.length > LIAISONS_MASSE_MAX)
      throw new HttpError(
        422,
        `Le motif donne ${r.paires.length} paires à relier : ${LIAISONS_MASSE_MAX} au plus par opération. Précisez les motifs.`,
      );
    return r.dto(
      LiaisonsMachines.empreinteMasse(
        user,
        d,
        r.paires.map((x) => ({ actifId: x.a.id, machineId: x.m.id, versionLiaisons: x.a.liaisons_version })),
      ),
    );
  }

  /** Application d'un aperçu validé : seules les paires envoyées, si leur empreinte est celle de l'aperçu, sont reliées ;
      chacune est revérifiée (elle figure encore parmi les paires que la demande donne à la personne, avec la même version des
      liaisons de l'actif ; écriture sur les deux périmètres) ; sinon elle est écartée et comptée. Une seule entrée de
      journal, sans nom d'actif ni de machine. */
  async appliquerMasse(user: SessionUser, body: ApplicationLiaisonMasse, ip: string): Promise<ResultatLiaisonMasseDto> {
    const p = ApplicationLiaisonMasse.parse(body);
    if (new Set(p.paires.map((x) => x.actifId)).size !== p.paires.length)
      throw new HttpError(422, 'Un actif ne peut figurer qu’une fois par opération.');
    if (LiaisonsMachines.empreinteMasse(user, p.demande, p.paires) !== p.empreinte)
      throw new HttpError(422, 'Les paires envoyées ne sont pas celles de l’aperçu : refaites l’aperçu.');
    return this.db.tx(async (c, k) => {
      await verrou(k);
      // Actifs verrouillés avant le calcul de contrôle : leur version ne peut plus changer jusqu'à la fin.
      await sql`SELECT x.id FROM vulnerabilites_alh_actifs x WHERE x.id = ANY(${p.paires.map((x) => x.actifId)}::uuid[])
        ORDER BY x.id FOR UPDATE`.execute(k);
      const controle = await this.calculerMasse(k, user, p.demande);
      const valides = new Map(controle.paires.map((x) => [`${x.a.id}|${x.m.id}`, x]));
      let reliees = 0;
      let ecartees = 0;
      for (const q of [...p.paires].sort((x, y) => (x.actifId < y.actifId ? -1 : 1))) {
        const v = valides.get(`${q.actifId}|${q.machineId}`);
        if (!v || v.a.liaisons_version !== q.versionLiaisons) {
          ecartees++;
          continue;
        }
        await this.controlerEcriture(c, user, [v.a.perimetre_id, v.m.perimetre_id]);
        const valeurs = {
          statut: 'confirmee' as const,
          motif: critereLiaisonMachine(v.a, v.m),
          origine: 'masse' as const,
          empreinte_actif: empreinteActif(v.a),
          empreinte_machine: empreinteMachine(v.m),
          decide_par: user.username,
          decide_le: sql<Date>`now()`,
          note: '',
        };
        const avant = await k
          .selectFrom('vulnerabilites_alh_liaisons_machines')
          .select('id')
          .where('actif_id', '=', v.a.id)
          .where('machine_id', '=', v.m.id)
          .forUpdate()
          .executeTakeFirst();
        if (avant)
          await k.updateTable('vulnerabilites_alh_liaisons_machines').set(valeurs).where('id', '=', avant.id).execute();
        else
          await k
            .insertInto('vulnerabilites_alh_liaisons_machines')
            .values({ actif_id: v.a.id, machine_id: v.m.id, ...valeurs })
            .execute();
        await this.nouvelleVersion(k, v.a.id);
        reliees++;
      }
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.surface.liaisons.reliees_en_masse',
        '',
        {
          mode: p.demande.mode,
          motifActifs: p.demande.motifActifs,
          motifMachines: p.demande.mode === 'un_pour_un' ? p.demande.motifMachines : null,
          machine: p.demande.mode === 'tous_vers_une' ? p.demande.machineId : null,
          demandees: p.paires.length,
          reliees,
          ecartees,
        },
        c,
      );
      return { reliees, ecartees };
    }, user.username);
  }
}
