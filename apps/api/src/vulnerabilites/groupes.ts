/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026) : groupes de machines faits à la
   main. Les droits du module sont contrôlés par route() (lecture `vulnerabilites:lire`, écritures `vulnerabilites:modifier`,
   le droit qui modifie déjà les machines) ; ce service est seul juge du reste :
   - lecture par périmètre : une personne ne voit dans un groupe que les machines qu'elle lit (règle `lisible` des machines,
     sql.ts) ; le nombre rendu est celui qu'elle lit, et `horsLecture` dit seulement qu'il en existe d'autres, sans nombre ;
   - ajouter ou retirer une machine exige de la lire (une machine illisible répond comme une machine inconnue, comme pour un
     produit surveillé relié à une machine) ; supprimer un groupe qui compte des machines hors de la lecture de la personne
     est refusé (409) : elle effacerait ce qu'elle ne voit pas ;
   - fournisseur : un au plus, par sa référence `legacy:suppliers:<id>` ; le rattacher, le changer ou le retirer exige en
     plus `fournisseurs:lire` (403 sinon) et un fournisseur présent au registre de l'organisation (422 sinon) ; le reste du
     groupe reste modifiable sans ce droit. Le nom du fournisseur est lu dans le registre à chaque lecture (une lecture du
     registre des fournisseurs par requête, jamais une par groupe) et donné à toute personne qui lit le module ; un
     fournisseur disparu laisse le groupe valide, marqué « supprimé » ;
   - If-Match sur la version du groupe (modification, suppression, membres) ; chaque écriture est journalisée
     (`vulnerabilites.groupe.*`) avec des identifiants internes seulement, jamais un nom ni une adresse de machine.
   Rien de ces groupes ne part chez l'assistant. Accès aux données en Kysely (ADR 0062). */
import {
  type BilanMembresGroupe,
  type FournisseurGroupe,
  type GroupeDuFournisseur,
  type GroupeMachines,
  type GroupeMachinesBody,
  type GroupeMachinesPatch,
  type GroupesDuFournisseur,
  GROUPES_MACHINES_BORNES,
  idDeRefFournisseur,
  MACHINES_GROUPE_PAR_PAGE,
  type MachineGroupe,
  type MembresGroupeBody,
  motifLitteral,
  type PageMachinesGroupe,
  type RechercheMachinesGroupe,
  refFournisseur,
  type RoleMachine,
} from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { lisible, perimetreMachine, present } from './sql.js';
import { close } from './suivi.js';

const INTROUVABLE = 'Groupe de machines introuvable.';
const MACHINE_INTROUVABLE = 'Machine introuvable ou non accessible.';
const DOUBLON = 'Un groupe de machines porte déjà ce nom (sans tenir compte de la casse).';
const DROIT_FOURNISSEUR =
  'Rattacher, changer ou retirer le fournisseur d’un groupe demande aussi le droit de lire les fournisseurs, module actif.';
const FOURNISSEUR_ABSENT = 'Fournisseur absent du registre de l’organisation.';
const HORS_LECTURE =
  'Ce groupe compte des machines hors de votre lecture : il ne peut être supprimé que par une personne qui les lit toutes. Retirez d’abord les machines que vous lisez, ou demandez à l’administration du module.';

interface LigneGroupe {
  id: string;
  nom: string;
  description: string;
  fournisseur_ref: string | null;
  version: number;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
  lues: number;
  hors: boolean;
}

const doublonEnBase = (e: unknown): never => {
  if ((e as { code?: string }).code === '23505') throw new HttpError(409, DOUBLON);
  throw e;
};

/** Champs comparés et journalisés (aucun nom de machine). */
const resume = (g: Pick<GroupeMachines, 'nom' | 'description'> & { fournisseurRef: string | null }) => ({
  nom: g.nom,
  description: g.description,
  fournisseurRef: g.fournisseurRef,
});

export class GroupesMachines {
  constructor(
    private readonly db: Db,
    private readonly grc: Grc,
  ) {}

  /* ---------------------------------------------------------------- Registre des fournisseurs */
  /** Noms des fournisseurs du registre de l'organisation, par identifiant : une lecture du seul registre des fournisseurs
      (module repris de l'état historique, mappeur « suppliers »), sans recomposer tout l'état. Hors porte de lecture
      (ADR 0083), par décision du 23/11/2026 : le nom du fournisseur rattaché est donné à toute personne qui lit le module,
      même sans `fournisseurs:lire` ; seuls l'identifiant et le nom en sortent. */
  private async fournisseurs(c?: Client): Promise<Map<string, string>> {
    const lire = async (cl: Client) => {
      const m = this.grc.legacy.mapper('suppliers');
      if (!m) throw new Error('Registre des fournisseurs non enregistré.');
      const v = await m.read(cl);
      const out = new Map<string, string>();
      for (const s of Array.isArray(v) ? v : [])
        if (isObject(s) && typeof s.id === 'string' && s.id) out.set(s.id, typeof s.name === 'string' ? s.name : s.id);
      return out;
    };
    if (c) return lire(c);
    const cl = await this.db.pool.connect();
    try {
      return await lire(cl);
    } finally {
      cl.release();
    }
  }

  /** Rattacher, changer ou retirer le fournisseur : droit de lire les fournisseurs (module actif), puis fournisseur présent
      au registre (sauf pour le retirer). */
  private async verifierFournisseur(ref: string | null, user: SessionUser, c: Client) {
    if (!user.rights.can('fournisseurs', 'lire')) throw new HttpError(403, DROIT_FOURNISSEUR);
    if (ref === null) return;
    const id = idDeRefFournisseur(ref);
    if (!id || !(await this.fournisseurs(c)).has(id)) throw new HttpError(422, FOURNISSEUR_ABSENT);
  }

  private fournisseurDe(ref: string | null, noms: Map<string, string>): FournisseurGroupe | null {
    if (ref === null) return null;
    const id = idDeRefFournisseur(ref) ?? ref;
    const nom = noms.get(id);
    return nom === undefined ? { id, ref, nom: null, etat: 'supprime' } : { id, ref, nom, etat: 'present' };
  }

  /* ---------------------------------------------------------------- Lectures */
  /** Groupes et, pour chacun, machines lues et drapeau hors lecture, en une requête (aucune par groupe). */
  private async lignes(user: SessionUser, k: Kdb, ou: RawBuilder<boolean>): Promise<LigneGroupe[]> {
    const { rows } = await sql<LigneGroupe>`
      SELECT g.id, g.nom, g.description, g.fournisseur_ref, g.version, g.created_by, g.created_at, g.updated_by,
             g.updated_at, coalesce(x.lues, 0)::int AS lues, coalesce(x.hors, false) AS hors
      FROM vulnerabilites_groupes g
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE l.lisible) AS lues, bool_or(NOT l.lisible) AS hors
        FROM (SELECT ${lisible(user)} AS lisible FROM vulnerabilites_groupe_machines gm
              JOIN vulnerabilites_machines m ON m.id = gm.machine_id WHERE gm.groupe_id = g.id) l) x ON true
      WHERE ${ou}
      ORDER BY lower(g.nom), g.id`.execute(k);
    return rows;
  }

  private versDto(l: LigneGroupe, noms: Map<string, string>): GroupeMachines {
    return {
      id: l.id,
      nom: l.nom,
      description: l.description,
      fournisseur: this.fournisseurDe(l.fournisseur_ref, noms),
      machinesLues: l.lues,
      horsLecture: l.hors,
      version: l.version,
      createdBy: l.created_by,
      createdAt: l.created_at.toISOString(),
      updatedBy: l.updated_by,
      updatedAt: l.updated_at.toISOString(),
    };
  }

  /** Tous les groupes, par nom (menu « Groupe »). */
  async lister(user: SessionUser): Promise<GroupeMachines[]> {
    const lignes = await this.lignes(user, this.db.k, sql<boolean>`true`);
    const noms = lignes.some((l) => l.fournisseur_ref) ? await this.fournisseurs() : new Map<string, string>();
    return lignes.map((l) => this.versDto(l, noms));
  }

  async lire(user: SessionUser, id: string, k: Kdb = this.db.k, c?: Client, verrou = false): Promise<GroupeMachines> {
    // Verrou d'écriture pris à part : la lecture agrège les membres.
    if (verrou) await k.selectFrom('vulnerabilites_groupes').select('id').where('id', '=', id).forUpdate().execute();
    const [l] = await this.lignes(user, k, sql<boolean>`g.id = ${id}::uuid`);
    if (!l) throw new HttpError(404, INTROUVABLE);
    return this.versDto(l, l.fournisseur_ref ? await this.fournisseurs(c) : new Map());
  }

  /** Fenêtre d'un groupe : machines que la personne lit (membres ou non), recherche par nom (partiel) ou adresse IP (début),
      par nom ; identifiants de toutes les machines trouvées (bornés) pour « Tout cocher » ; autres groupes de chaque
      machine de la page. Trois requêtes, plus la lecture du groupe : aucune par machine. */
  async machines(user: SessionUser, id: string, q: RechercheMachinesGroupe): Promise<PageMachinesGroupe> {
    const groupe = await this.lire(user, id);
    const conditions: RawBuilder<boolean>[] = [lisible(user)];
    const texte = q.q?.trim().toLowerCase();
    if (texte)
      conditions.push(
        sql<boolean>`(lower(coalesce(m.nom, '')) LIKE ${`%${motifLitteral(texte)}%`}
          OR lower(coalesce(m.adresse, '')) LIKE ${`${motifLitteral(texte)}%`})`,
      );
    const membre = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_groupe_machines gm
      WHERE gm.groupe_id = ${id}::uuid AND gm.machine_id = m.id)`;
    if (q.membres === 'oui') conditions.push(membre);
    if (q.membres === 'non') conditions.push(sql<boolean>`NOT ${membre}`);
    const { rows: trouvees } = await sql<{ id: string }>`
      SELECT m.id FROM vulnerabilites_machines m WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id`.execute(this.db.k);
    const debut = (q.page - 1) * MACHINES_GROUPE_PAR_PAGE;
    const ids = trouvees.slice(debut, debut + MACHINES_GROUPE_PAR_PAGE).map((r) => r.id);
    const { rows } = ids.length
      ? await sql<{
          id: string;
          nom: string | null;
          adresse: string | null;
          systeme: string | null;
          role: RoleMachine | null;
          perimetre_nom: string | null;
          membre: boolean;
          autres: { id: string; nom: string }[];
        }>`
          SELECT m.id, m.nom, m.adresse, m.systeme, m.role, s.name AS perimetre_nom, ${membre} AS membre,
                 coalesce((SELECT json_agg(json_build_object('id', g.id, 'nom', g.nom) ORDER BY lower(g.nom), g.id)
                           FROM vulnerabilites_groupe_machines gm2 JOIN vulnerabilites_groupes g ON g.id = gm2.groupe_id
                           WHERE gm2.machine_id = m.id AND gm2.groupe_id <> ${id}::uuid), '[]'::json) AS autres
          FROM vulnerabilites_machines m
          LEFT JOIN grc_smsis s ON s.id = ${perimetreMachine}
          WHERE m.id = ANY(${ids}::uuid[])`.execute(this.db.k)
      : { rows: [] };
    const parId = new Map(rows.map((r) => [r.id, r]));
    const elements: MachineGroupe[] = ids.flatMap((x) => {
      const r = parId.get(x);
      return r
        ? [
            {
              id: r.id,
              nom: r.nom,
              adresse: r.adresse,
              systeme: r.systeme,
              role: r.role,
              perimetreNom: r.perimetre_nom,
              membre: r.membre,
              autresGroupes: r.autres,
            },
          ]
        : [];
    });
    return {
      groupe,
      total: trouvees.length,
      page: q.page,
      parPage: MACHINES_GROUPE_PAR_PAGE,
      elements,
      identifiants: trouvees.slice(0, GROUPES_MACHINES_BORNES.lot).map((r) => r.id),
      identifiantsTronques: trouvees.length > GROUPES_MACHINES_BORNES.lot,
    };
  }

  /** Groupes rattachés à un fournisseur (fiche du fournisseur) : sans aucun détail de machine ; machines lues, drapeau hors
      lecture et failles critiques ouvertes comptées sur les seules machines lues de chaque groupe. Exige aussi le droit de
      lire les fournisseurs (option prudente) ; fournisseur absent du registre : 404. */
  async duFournisseur(user: SessionUser, fournisseurId: string): Promise<GroupesDuFournisseur> {
    if (!user.rights.can('fournisseurs', 'lire'))
      throw new HttpError(403, 'Les groupes d’un fournisseur se lisent aussi avec le droit de lire les fournisseurs.');
    if (!(await this.fournisseurs()).has(fournisseurId)) throw new HttpError(404, 'Fournisseur absent du registre.');
    // « Critique » : gravité du constat ; « ouverte » : présente (dernière synchronisation complète de son instance) et
    // encore à traiter (close) ; mêmes fragments que le compteur « critique » des machines (failles.ts, machinesRangees).
    const { rows } = await sql<{
      id: string;
      nom: string;
      description: string;
      lues: number;
      hors: boolean;
      critiques: number;
    }>`
      SELECT g.id, g.nom, g.description, coalesce(x.lues, 0)::int AS lues, coalesce(x.hors, false) AS hors,
             (SELECT count(DISTINCT c.id) FROM vulnerabilites_groupe_machines gm
                JOIN vulnerabilites_machines m ON m.id = gm.machine_id
                JOIN vulnerabilites_detections d ON d.machine_id = m.id
                LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
                JOIN vulnerabilites_constats c ON c.id = d.constat_id
              WHERE gm.groupe_id = g.id AND ${lisible(user)} AND ${present} AND c.gravite = 'critique'
                AND NOT ${close('constat')})::int AS critiques
      FROM vulnerabilites_groupes g
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE l.lisible) AS lues, bool_or(NOT l.lisible) AS hors
        FROM (SELECT ${lisible(user)} AS lisible FROM vulnerabilites_groupe_machines gm
              JOIN vulnerabilites_machines m ON m.id = gm.machine_id WHERE gm.groupe_id = g.id) l) x ON true
      WHERE g.fournisseur_ref = ${refFournisseur(fournisseurId)}
      ORDER BY lower(g.nom), g.id`.execute(this.db.k);
    return {
      fournisseurId,
      groupes: rows.map((r): GroupeDuFournisseur => ({
        id: r.id,
        nom: r.nom,
        description: r.description,
        machinesLues: r.lues,
        horsLecture: r.hors,
        faillesCritiquesOuvertes: r.critiques,
      })),
    };
  }

  /* ---------------------------------------------------------------- Écritures */
  /** Toutes les machines demandées existent et sont lues par la personne, sinon 404 (tout ou rien). */
  private async verifierMachines(user: SessionUser, ids: string[], k: Kdb) {
    if (!ids.length) return;
    const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM vulnerabilites_machines m
      WHERE m.id = ANY(${ids}::uuid[]) AND ${lisible(user)}`.execute(k);
    if (rows[0]!.n !== ids.length) throw new HttpError(404, MACHINE_INTROUVABLE);
  }

  async creer(body: GroupeMachinesBody, user: SessionUser, ip: string): Promise<GroupeMachines> {
    return this.db
      .tx(async (c, k) => {
        if (body.fournisseurRef !== null) await this.verifierFournisseur(body.fournisseurRef, user, c);
        await this.verifierMachines(user, body.machineIds, k);
        const { id } = await k
          .insertInto('vulnerabilites_groupes')
          .values({
            nom: body.nom,
            description: body.description,
            fournisseur_ref: body.fournisseurRef,
            created_by: user.username,
            updated_by: user.username,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (body.machineIds.length)
          await k
            .insertInto('vulnerabilites_groupe_machines')
            .values(body.machineIds.map((m) => ({ groupe_id: id, machine_id: m, ajoute_par: user.username })))
            .execute();
        await this.db.audit(
          user,
          ip,
          'vulnerabilites.groupe.cree',
          id,
          { ...resume({ ...body }), machines: body.machineIds, version: 1 },
          c,
        );
        return this.lire(user, id, k, c);
      }, user.username)
      .catch(doublonEnBase);
  }

  async modifier(
    id: string,
    patch: GroupeMachinesPatch,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<GroupeMachines> {
    return this.db
      .tx(async (c, k) => {
        const avant = await this.lire(user, id, k, c, true);
        if (avant.version !== attendue) throw conflict({ ...avant });
        const ref = avant.fournisseur?.ref ?? null;
        const apres = {
          nom: patch.nom ?? avant.nom,
          description: patch.description ?? avant.description,
          fournisseurRef: patch.fournisseurRef === undefined ? ref : patch.fournisseurRef,
        };
        // Un fournisseur inchangé reste valable sans le droit de lire les fournisseurs ; tout changement est contrôlé.
        if (apres.fournisseurRef !== ref) await this.verifierFournisseur(apres.fournisseurRef, user, c);
        const champs = (Object.keys(apres) as (keyof typeof apres)[])
          .filter((cle) => apres[cle] !== resume({ ...avant, fournisseurRef: ref })[cle])
          .sort();
        if (!champs.length) return avant;
        await k
          .updateTable('vulnerabilites_groupes')
          .set((eb) => ({
            nom: apres.nom,
            description: apres.description,
            fournisseur_ref: apres.fournisseurRef,
            version: eb('version', '+', 1),
            updated_by: user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', id)
          .execute();
        const modifie = await this.lire(user, id, k, c);
        await this.db.audit(
          user,
          ip,
          'vulnerabilites.groupe.modifie',
          id,
          { champs, avant: resume({ ...avant, fournisseurRef: ref }), apres, version: modifie.version },
          c,
        );
        return modifie;
      }, user.username)
      .catch(doublonEnBase);
  }

  async supprimer(id: string, attendue: number, user: SessionUser, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      const g = await this.lire(user, id, k, c, true);
      if (g.version !== attendue) throw conflict({ ...g });
      if (g.horsLecture) throw new HttpError(409, HORS_LECTURE);
      await k.deleteFrom('vulnerabilites_groupes').where('id', '=', id).execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.groupe.supprime',
        id,
        {
          ...resume({ ...g, fournisseurRef: g.fournisseur?.ref ?? null }),
          machines: g.machinesLues,
          version: g.version,
        },
        c,
      );
    }, user.username);
  }

  /** Ajout et retrait de machines en lot, tout ou rien : chaque machine doit être lue par la personne. Une machine déjà
      dans le groupe (ou déjà absente) est laissée telle quelle ; la version du groupe n'augmente que si quelque chose
      change. */
  async membres(
    id: string,
    body: MembresGroupeBody,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<BilanMembresGroupe> {
    return this.db.tx(async (c, k) => {
      const avant = await this.lire(user, id, k, c, true);
      if (avant.version !== attendue) throw conflict({ ...avant });
      await this.verifierMachines(user, [...body.ajouter, ...body.retirer], k);
      const ajoutees = body.ajouter.length
        ? (
            await k
              .insertInto('vulnerabilites_groupe_machines')
              .values(body.ajouter.map((m) => ({ groupe_id: id, machine_id: m, ajoute_par: user.username })))
              .onConflict((oc) => oc.doNothing())
              .returning('machine_id')
              .execute()
          ).map((r) => r.machine_id)
        : [];
      const retirees = body.retirer.length
        ? (
            await k
              .deleteFrom('vulnerabilites_groupe_machines')
              .where('groupe_id', '=', id)
              .where('machine_id', 'in', body.retirer)
              .returning('machine_id')
              .execute()
          ).map((r) => r.machine_id)
        : [];
      if (!ajoutees.length && !retirees.length) return { ajoutees: 0, retirees: 0, groupe: avant };
      const { version } = await k
        .updateTable('vulnerabilites_groupes')
        .set((eb) => ({ version: eb('version', '+', 1), updated_by: user.username, updated_at: sql<Date>`now()` }))
        .where('id', '=', id)
        .returning('version')
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.groupe.machines',
        id,
        { ajoutees: ajoutees.sort(), retirees: retirees.sort(), version },
        c,
      );
      return { ajoutees: ajoutees.length, retirees: retirees.length, groupe: await this.lire(user, id, k, c) };
    }, user.username);
  }
}
