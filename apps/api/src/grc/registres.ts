/* Registres, périmètres hérités et droits par ressource (ADR 0043).
   - Un registre porte un ou plusieurs périmètres ; ses éléments (actions, écarts, séries) les héritent sans copie.
   - Un droit fin (lecteur, contributeur, gestionnaire) s'attribue à un utilisateur ou à un groupe sur un registre ou sur un
     élément ; il s'ajoute aux droits de module et à l'appartenance aux périmètres, jamais à la place du contrôle serveur.
   - Un registre restreint n'est accessible que par ses droits attribués et par les administrateurs. */
import {
  GRC_MODULES,
  RANG_ROLE,
  RegistreBody,
  RegistrePerimetresBody,
  RegistreUpdate,
  DroitBody,
  REGISTRE_LABELS,
  ROLE_LABELS,
  roleSuffit,
  type Action,
  type Besoin,
  type GrcObject,
  type Module,
  type RegistreDto,
  type RegistreKind,
  type RoleRessource,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, objectColumns, objectDto, type ObjectRow, type Grc } from './core.js';

const MODULE: Module = 'ecarts';
const colonnes = `id,kind,name,description,reference_smsi_id AS "referenceId",restricted,archived,par_defaut AS "parDefaut",version`;
const colonnesR = `r.id,r.kind,r.name,r.description,r.reference_smsi_id AS "referenceId",r.restricted,r.archived,r.par_defaut AS "parDefaut",r.version`;
export interface RegistreRow {
  id: string;
  kind: RegistreKind;
  name: string;
  description: string;
  referenceId: string;
  restricted: boolean;
  archived: boolean;
  parDefaut: boolean;
  version: number;
}
type TypeRessource = 'registre' | 'objet';
const unique = <T>(l: readonly T[]) => [...new Set(l)];

export class GrcRegistres {
  constructor(private readonly g: Grc) {}
  private q(c?: Client) {
    return c ?? this.g.db.pool;
  }

  /* ----------------------------------------------------------------------------------------------- lecture brute */
  async brut(id: string, c?: Client, lock = false): Promise<RegistreRow | null> {
    return (
      (
        await this.q(c).query<RegistreRow>(
          `SELECT ${colonnes} FROM registres WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async perimetresIds(id: string, c?: Client): Promise<string[]> {
    return (
      await this.q(c).query<{ id: string }>(
        'SELECT smsi_id AS id FROM registre_perimetres WHERE registre_id=$1 ORDER BY smsi_id',
        [id],
      )
    ).rows.map((r) => r.id);
  }

  /* -------------------------------------------------------------------------------------------- droits effectifs */
  /** Rôle le plus élevé attribué à l'utilisateur, directement ou par un groupe, sur le registre ou sur l'élément. */
  async roleDe(
    user: SessionUser,
    registreId: string,
    objetId: string | null,
    c?: Client,
  ): Promise<RoleRessource | null> {
    const r = await this.q(c).query<{ role: RoleRessource }>(
      `SELECT d.role FROM droits_ressources d
        WHERE ((d.resource_type='registre' AND d.resource_id=$1) OR ($2::uuid IS NOT NULL AND d.resource_type='objet' AND d.resource_id=$2))
          AND ((d.subject_type='utilisateur' AND d.subject_id=$3)
            OR (d.subject_type='groupe' AND d.subject_id IN (SELECT group_id FROM user_groups WHERE user_id=$3)))`,
      [registreId, objetId, user.id],
    );
    let meilleur: RoleRessource | null = null;
    for (const { role } of r.rows) if (!meilleur || RANG_ROLE[role] > RANG_ROLE[meilleur]) meilleur = role;
    return meilleur;
  }
  /** Accès par les droits de module et l'appartenance aux périmètres : lecture si un périmètre au moins est accessible,
      modification seulement si tous le sont en écriture (un registre multi-périmètre n'est pas modifiable depuis un seul). */
  private async parModule(
    user: SessionUser,
    reg: RegistreRow,
    besoin: Besoin,
    module: Module,
    action: Action | undefined,
    c?: Client,
  ): Promise<boolean> {
    if (reg.restricted) return false;
    if (!user.rights.can(module, action ?? (besoin === 'lire' ? 'lire' : 'modifier'))) return false;
    const ids = await this.perimetresIds(reg.id, c);
    const ecriture = besoin !== 'lire';
    let accessibles = 0;
    for (const id of ids) {
      try {
        await this.g.access(id, user, ecriture, c);
        accessibles++;
      } catch {
        /* périmètre non accessible */
      }
    }
    return besoin === 'lire' ? accessibles > 0 : accessibles === ids.length && ids.length > 0;
  }
  async peut(
    user: SessionUser,
    reg: RegistreRow,
    objetId: string | null,
    besoin: Besoin,
    c?: Client,
    module: Module = MODULE,
    action?: Action,
  ): Promise<boolean> {
    await this.g.modules.assert(module);
    if (await this.g.isAdmin(user, c)) return true;
    if (roleSuffit(await this.roleDe(user, reg.id, objetId, c), besoin)) return true;
    return this.parModule(user, reg, besoin, module, action, c);
  }
  /** 404 si l'utilisateur ne peut même pas lire (aucune fuite d'existence) ; 403 s'il lit mais ne peut pas plus. */
  async exiger(
    user: SessionUser,
    reg: RegistreRow,
    objetId: string | null,
    besoin: Besoin,
    c?: Client,
    module: Module = MODULE,
    action?: Action,
  ) {
    if (await this.peut(user, reg, objetId, besoin, c, module, action)) return;
    if (besoin !== 'lire' && (await this.peut(user, reg, objetId, 'lire', c, module))) {
      const role = await this.roleDe(user, reg.id, objetId, c);
      throw new HttpError(
        403,
        role
          ? `Votre rôle de ${ROLE_LABELS[role].toLowerCase()} ne permet pas cette opération.`
          : 'Votre accès à ce registre ne permet pas cette opération.',
      );
    }
    throw new HttpError(404, 'Registre ou élément introuvable ou non accessible.');
  }
  /** Autorisation d'un élément rattaché à un registre. `action` précise le droit de module de l'ancien chemin
      (par exemple « supprimer » pour l'archivage). */
  async exigerElement(user: SessionUser, o: GrcObject, besoin: Besoin, c?: Client, action?: Action) {
    const reg = o.registreId ? await this.brut(o.registreId, c) : null;
    if (!reg) throw new HttpError(404, 'Objet introuvable.');
    await this.exiger(user, reg, o.id, besoin, c, GRC_MODULES[o.kind], action);
    return reg;
  }
  /** Registres restreints d'un périmètre que l'utilisateur ne peut pas lire : leurs éléments sont masqués des listes. */
  async inaccessibles(user: SessionUser, smsi: string, c?: Client): Promise<string[]> {
    if (await this.g.isAdmin(user, c)) return [];
    const r = await this.q(c).query<RegistreRow>(
      `SELECT ${colonnes} FROM registres WHERE reference_smsi_id=$1 AND restricted`,
      [smsi],
    );
    const masques: string[] = [];
    for (const reg of r.rows) if (!(await this.peut(user, reg, null, 'lire', c))) masques.push(reg.id);
    return masques;
  }

  /* ----------------------------------------------------------------------------------------------------- registre */
  async dto(user: SessionUser, reg: RegistreRow, c?: Client): Promise<RegistreDto> {
    const admin = await this.g.isAdmin(user, c);
    const ids = await this.perimetresIds(reg.id, c);
    const noms = (
      await this.q(c).query<{ id: string; name: string }>('SELECT id,name FROM grc_smsis WHERE id=ANY($1::uuid[])', [
        ids,
      ])
    ).rows;
    const visibles: { id: string; name: string }[] = [];
    for (const p of noms.sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
      if (admin) {
        visibles.push(p);
        continue;
      }
      try {
        await this.g.access(p.id, user, false, c);
        visibles.push(p);
      } catch {
        /* non nommé : voir autresPerimetres */
      }
    }
    const peut = {
      lire: await this.peut(user, reg, null, 'lire', c),
      contribuer: await this.peut(user, reg, null, 'contribuer', c),
      gerer: await this.peut(user, reg, null, 'gerer', c),
    };
    const elements = Number(
      (
        await this.q(c).query<{ n: string }>(
          'SELECT count(*)::text AS n FROM grc_objects WHERE registre_id=$1 AND NOT archived',
          [reg.id],
        )
      ).rows[0]!.n,
    );
    return {
      id: reg.id,
      kind: reg.kind,
      name: reg.name,
      description: reg.description,
      referenceId: reg.referenceId,
      restreint: reg.restricted,
      archived: reg.archived,
      parDefaut: reg.parDefaut,
      version: reg.version,
      perimetres: visibles,
      autresPerimetres: ids.length - visibles.length,
      role: await this.roleDe(user, reg.id, null, c),
      peut,
      elements,
    };
  }
  async list(user: SessionUser, filtre: { perimetre?: string; kind?: RegistreKind; archives?: boolean } = {}) {
    const args: unknown[] = [];
    let where = 'TRUE';
    if (filtre.kind) where += ` AND r.kind=$${args.push(filtre.kind)}`;
    if (!filtre.archives) where += ' AND NOT r.archived';
    if (filtre.perimetre)
      where += ` AND EXISTS (SELECT 1 FROM registre_perimetres p WHERE p.registre_id=r.id AND p.smsi_id=$${args.push(filtre.perimetre)})`;
    const rows = (
      await this.g.db.q<RegistreRow>(
        `SELECT ${colonnesR} FROM registres r WHERE ${where} ORDER BY r.kind, r.name, r.id`,
        args,
      )
    ).rows;
    const out: RegistreDto[] = [];
    for (const reg of rows) if (await this.peut(user, reg, null, 'lire')) out.push(await this.dto(user, reg));
    return out;
  }
  async get(id: string, user: SessionUser, c?: Client) {
    const reg = await this.brut(id, c);
    if (!reg || !(await this.peut(user, reg, null, 'lire', c)))
      throw new HttpError(404, 'Registre introuvable ou non accessible.');
    return this.dto(user, reg, c);
  }

  /** Registre par défaut d'une famille pour un périmètre : accueille les éléments créés sans registre choisi. */
  async defautPour(c: Client, smsi: string, kind: RegistreKind): Promise<string> {
    const existant = (
      await c.query<{ id: string }>('SELECT id FROM registres WHERE kind=$1 AND reference_smsi_id=$2 AND par_defaut', [
        kind,
        smsi,
      ])
    ).rows[0];
    if (existant) return existant.id;
    const s = (await c.query<{ id: string; name: string }>('SELECT id,name FROM grc_smsis WHERE id=$1', [smsi]))
      .rows[0];
    if (!s) throw new HttpError(404, 'Périmètre introuvable.');
    const nom = `${REGISTRE_LABELS[kind]} — ${s.id === DEFAULT_SMSI ? 'Pilotage commun' : s.name}`;
    const cree = (
      await c.query<{ id: string }>(
        `INSERT INTO registres(kind,name,reference_smsi_id,par_defaut,created_by,updated_by)
         VALUES($1,$2,$3,true,'système','système') ON CONFLICT (kind,reference_smsi_id) WHERE par_defaut DO NOTHING RETURNING id`,
        [kind, nom.slice(0, 200), smsi],
      )
    ).rows[0];
    if (!cree)
      return (
        await c.query<{ id: string }>(
          'SELECT id FROM registres WHERE kind=$1 AND reference_smsi_id=$2 AND par_defaut',
          [kind, smsi],
        )
      ).rows[0]!.id;
    await c.query('INSERT INTO registre_perimetres(registre_id,smsi_id) VALUES($1,$2)', [cree.id, smsi]);
    return cree.id;
  }

  async create(input: RegistreBody, user: SessionUser, ip: string) {
    const b = RegistreBody.parse(input);
    await this.g.modules.assert(MODULE);
    const ids = unique([b.referenceId, ...b.perimetres]);
    return this.g.db.tx(async (c) => {
      const connus = (await c.query('SELECT 1 FROM grc_smsis WHERE id=ANY($1::uuid[])', [ids])).rowCount;
      if (connus !== ids.length) throw new HttpError(422, 'Périmètre inconnu.');
      if (!(await this.g.isAdmin(user, c))) {
        if (!user.rights.can(MODULE, 'modifier')) throw new HttpError(403, 'Droit requis : ecarts:modifier');
        for (const id of ids) await this.g.access(id, user, true, c);
      }
      const reg = (
        await c.query<RegistreRow>(
          `INSERT INTO registres(kind,name,description,reference_smsi_id,restricted,created_by,updated_by)
           VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING ${colonnes}`,
          [b.kind, b.name, b.description, b.referenceId, b.restreint, user.username],
        )
      ).rows[0]!;
      for (const id of ids)
        await c.query('INSERT INTO registre_perimetres(registre_id,smsi_id) VALUES($1,$2)', [reg.id, id]);
      // Le créateur garde la gestion du registre même si ses droits de module changent ensuite.
      await c.query(
        `INSERT INTO droits_ressources(resource_type,resource_id,subject_type,subject_id,role,granted_by)
         VALUES('registre',$1,'utilisateur',$2,'gestionnaire',$3)`,
        [reg.id, user.id, user.username],
      );
      await this.g.db.audit(user, ip, 'registre.created', reg.id, { kind: b.kind, perimetres: ids }, c);
      await this.g.notify(c, reg.id, reg.version, reg.referenceId, MODULE, user.username);
      return this.dto(user, reg, c);
    }, user.username);
  }
  async update(id: string, input: RegistreUpdate, expected: number, user: SessionUser, ip: string) {
    const b = RegistreUpdate.parse(input);
    return this.g.db.tx(async (c) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.archived) throw new HttpError(409, 'Registre archivé.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      const nouveau = (
        await c.query<RegistreRow>(
          `UPDATE registres SET name=$2,description=$3,restricted=$4,version=version+1,updated_by=$5,updated_at=now() WHERE id=$1 RETURNING ${colonnes}`,
          [id, b.name, b.description, b.restreint, user.username],
        )
      ).rows[0]!;
      await this.g.db.audit(user, ip, 'registre.updated', id, { version: nouveau.version, restreint: b.restreint }, c);
      await this.g.notify(c, id, nouveau.version, nouveau.referenceId, MODULE, user.username);
      return this.dto(user, nouveau, c);
    }, user.username);
  }

  /** Impact d'un changement de périmètres : éléments, liens et droits concernés, sans rien écrire. */
  private async impact(reg: RegistreRow, avant: string[], apres: string[], c: Client) {
    const nom = async (ids: string[]) =>
      (
        await c.query<{ id: string; name: string }>(
          'SELECT id,name FROM grc_smsis WHERE id=ANY($1::uuid[]) ORDER BY name',
          [ids],
        )
      ).rows;
    const compte = async (sql: string) => Number((await c.query<{ n: string }>(sql, [reg.id])).rows[0]!.n);
    return {
      ajoutes: await nom(apres.filter((x) => !avant.includes(x))),
      retires: await nom(avant.filter((x) => !apres.includes(x))),
      elements: await compte('SELECT count(*)::text AS n FROM grc_objects WHERE registre_id=$1 AND NOT archived'),
      series: await compte(
        "SELECT count(*)::text AS n FROM grc_objects WHERE registre_id=$1 AND kind='task_series' AND NOT archived",
      ),
      liens: await compte(
        'SELECT count(*)::text AS n FROM grc_links l JOIN grc_objects o ON o.id=l.source_id WHERE o.registre_id=$1',
      ),
      droits: await compte(
        "SELECT count(*)::text AS n FROM droits_ressources WHERE resource_type='registre' AND resource_id=$1",
      ),
    };
  }
  /** Commande atomique : le périmètre de référence reste ; les éléments héritent aussitôt, sans écriture individuelle. */
  async setPerimetres(id: string, input: RegistrePerimetresBody, expected: number, user: SessionUser, ip: string) {
    const b = RegistrePerimetresBody.parse(input);
    return this.g.db.tx(async (c) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.archived) throw new HttpError(409, 'Registre archivé.');
      const apres = unique(b.perimetres);
      if (!apres.includes(reg.referenceId))
        throw new HttpError(422, 'Le périmètre de référence du registre doit rester rattaché.');
      const connus = (await c.query('SELECT 1 FROM grc_smsis WHERE id=ANY($1::uuid[])', [apres])).rowCount;
      if (connus !== apres.length) throw new HttpError(422, 'Périmètre inconnu.');
      const avant = await this.perimetresIds(id, c);
      const admin = await this.g.isAdmin(user, c);
      // Rattacher un registre à un périmètre exige de pouvoir au moins le consulter.
      if (!admin) for (const p of apres.filter((x) => !avant.includes(x))) await this.g.access(p, user, false, c);
      const impact = await this.impact(reg, avant, apres, c);
      if (b.apercu) return { apercu: true as const, impact, version: reg.version };
      if (!b.reason) throw new HttpError(422, 'Un motif de 10 caractères au moins est exigé.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      await c.query('DELETE FROM registre_perimetres WHERE registre_id=$1 AND smsi_id<>ALL($2::uuid[])', [id, apres]);
      for (const p of apres.filter((x) => !avant.includes(x)))
        await c.query('INSERT INTO registre_perimetres(registre_id,smsi_id) VALUES($1,$2)', [id, p]);
      const nouveau = (
        await c.query<RegistreRow>(
          `UPDATE registres SET version=version+1,updated_by=$2,updated_at=now() WHERE id=$1 RETURNING ${colonnes}`,
          [id, user.username],
        )
      ).rows[0]!;
      await this.g.db.audit(
        user,
        ip,
        'registre.perimetres.changed',
        id,
        { avant, apres, raison: b.reason, impact: { elements: impact.elements, liens: impact.liens } },
        c,
      );
      await this.g.notify(c, id, nouveau.version, nouveau.referenceId, MODULE, user.username);
      return { apercu: false as const, impact, registre: await this.dto(user, nouveau, c) };
    }, user.username);
  }
  async archive(id: string, expected: number, user: SessionUser, ip: string) {
    return this.g.db.tx(async (c) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.parDefaut) throw new HttpError(409, 'Le registre par défaut d’un périmètre ne s’archive pas.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      const nouveau = (
        await c.query<RegistreRow>(
          `UPDATE registres SET archived=true,version=version+1,updated_by=$2,updated_at=now() WHERE id=$1 RETURNING ${colonnes}`,
          [id, user.username],
        )
      ).rows[0]!;
      // Les éléments, leurs historiques et leurs preuves sont conservés tels quels.
      await this.g.db.audit(user, ip, 'registre.archived', id, { version: nouveau.version }, c);
      await this.g.notify(c, id, nouveau.version, nouveau.referenceId, MODULE, user.username);
      return this.dto(user, nouveau, c);
    }, user.username);
  }
  async elements(id: string, user: SessionUser, kind: string | undefined, search: string, offset: number) {
    const reg = await this.brut(id);
    if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
    await this.exiger(user, reg, null, 'lire');
    const args: unknown[] = [id, '%' + search.replace(/[\\%_]/g, '\\$&') + '%'];
    let where = 'registre_id=$1 AND NOT archived AND name ILIKE $2';
    if (kind) where += ` AND kind=$${args.push(kind)}`;
    const total = Number(
      (await this.g.db.one<{ n: number }>(`SELECT count(*)::int n FROM grc_objects WHERE ${where}`, args))!.n,
    );
    args.push(offset);
    const items = (
      await this.g.db.q<ObjectRow>(
        `SELECT ${objectColumns} FROM grc_objects WHERE ${where} ORDER BY updated_at DESC,id LIMIT 50 OFFSET $${args.length}`,
        args,
      )
    ).rows.map(objectDto);
    return { registre: await this.dto(user, reg), items, total, nextOffset: offset + 50 < total ? offset + 50 : null };
  }

  /* ------------------------------------------------------------------------------------------------------ droits */
  private async ressource(type: TypeRessource, id: string, user: SessionUser, c?: Client) {
    if (type === 'registre') {
      const reg = await this.brut(id, c);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      return { reg, objetId: null as string | null };
    }
    const o = (await this.q(c).query<ObjectRow>(`SELECT ${objectColumns} FROM grc_objects WHERE id=$1`, [id])).rows[0];
    if (!o?.registreId) throw new HttpError(404, 'Élément introuvable ou non accessible.');
    const reg = await this.exigerElement(user, objectDto(o), 'gerer', c);
    return { reg, objetId: id as string | null };
  }
  async droits(type: TypeRessource, id: string, user: SessionUser) {
    await this.ressource(type, id, user);
    return (
      await this.g.db.q<{
        id: string;
        subjectType: string;
        subjectId: string;
        role: RoleRessource;
        libelle: string;
        grantedBy: string;
        grantedAt: Date;
      }>(
        `SELECT d.id,d.subject_type AS "subjectType",d.subject_id AS "subjectId",d.role,
                CASE WHEN d.subject_type='utilisateur' THEN coalesce(nullif(u.display_name,''),u.username,'Compte supprimé') ELSE coalesce(g.name,'Groupe supprimé') END AS libelle,
                d.granted_by AS "grantedBy",d.granted_at AS "grantedAt"
           FROM droits_ressources d
           LEFT JOIN users u ON d.subject_type='utilisateur' AND u.id=d.subject_id
           LEFT JOIN groups g ON d.subject_type='groupe' AND g.id=d.subject_id
          WHERE d.resource_type=$1 AND d.resource_id=$2 ORDER BY d.subject_type,libelle,d.id`,
        [type, id],
      )
    ).rows.map((r) => ({ ...r, grantedAt: r.grantedAt.toISOString() }));
  }
  async accorder(type: TypeRessource, id: string, input: DroitBody, user: SessionUser, ip: string) {
    const b = DroitBody.parse(input);
    return this.g.db.tx(async (c) => {
      await this.ressource(type, id, user, c);
      const existe =
        b.subjectType === 'utilisateur'
          ? await c.query('SELECT 1 FROM users WHERE id=$1 AND NOT disabled', [b.subjectId])
          : await c.query('SELECT 1 FROM groups WHERE id=$1', [b.subjectId]);
      if (!existe.rowCount) throw new HttpError(422, 'Titulaire du droit introuvable.');
      const r = (
        await c.query<{ id: string }>(
          `INSERT INTO droits_ressources(resource_type,resource_id,subject_type,subject_id,role,granted_by)
           VALUES($1,$2,$3,$4,$5,$6)
           ON CONFLICT (resource_type,resource_id,subject_type,subject_id)
           DO UPDATE SET role=EXCLUDED.role,granted_by=EXCLUDED.granted_by,granted_at=now() RETURNING id`,
          [type, id, b.subjectType, b.subjectId, b.role, user.username],
        )
      ).rows[0]!;
      await this.g.db.audit(
        user,
        ip,
        'droit.accorde',
        id,
        { ressource: type, titulaire: `${b.subjectType}:${b.subjectId}`, role: b.role },
        c,
      );
      return { id: r.id };
    }, user.username);
  }
  async retirer(type: TypeRessource, id: string, droitId: string, user: SessionUser, ip: string) {
    return this.g.db.tx(async (c) => {
      await this.ressource(type, id, user, c);
      const r = (
        await c.query<{ subject_type: string; subject_id: string; role: string }>(
          'DELETE FROM droits_ressources WHERE id=$1 AND resource_type=$2 AND resource_id=$3 RETURNING subject_type,subject_id,role',
          [droitId, type, id],
        )
      ).rows[0];
      if (!r) throw new HttpError(404, 'Droit introuvable.');
      await this.g.db.audit(
        user,
        ip,
        'droit.retire',
        id,
        { ressource: type, titulaire: `${r.subject_type}:${r.subject_id}`, role: r.role },
        c,
      );
    }, user.username);
  }
}
