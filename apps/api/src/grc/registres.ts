/* Registres, périmètres hérités et droits par ressource (ADR 0043).
   - Un registre porte un ou plusieurs périmètres ; ses éléments (actions, écarts, séries) les héritent sans copie.
   - Un droit fin (lecteur, contributeur, gestionnaire) s'attribue à un utilisateur ou à un groupe sur un registre ou sur un
     élément ; il s'ajoute aux droits de module et à l'appartenance aux périmètres, jamais à la place du contrôle serveur.
   - Un registre restreint n'est accessible que par ses droits attribués et par les administrateurs. */
import {
  GRC_MODULES,
  RANG_ROLE,
  DeplacementBody,
  RegistreBody,
  RegistrePerimetresBody,
  RegistreUpdate,
  registreKindOf,
  DroitBody,
  REGISTRE_LABELS,
  ROLE_LABELS,
  roleSuffit,
  type Action,
  type Besoin,
  type GrcObject,
  type ImpactDeplacement,
  type Module,
  type RegistreDto,
  type RegistreKind,
  type ResponsableRef,
  type RoleRessource,
  type StatutPlanRegistre,
  OrdreBody,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, objectColumns, objectDto, type ObjectRow, type Grc } from './core.js';

const MODULE: Module = 'ecarts';
const colonnes = `id,kind,name,description,reference_smsi_id AS "referenceId",restricted,archived,par_defaut AS "parDefaut",version,to_char(date_debut,'YYYY-MM-DD') AS "dateDebut",to_char(date_fin,'YYYY-MM-DD') AS "dateFin",statut,responsable`;
const colonnesR = `r.id,r.kind,r.name,r.description,r.reference_smsi_id AS "referenceId",r.restricted,r.archived,r.par_defaut AS "parDefaut",r.version,to_char(r.date_debut,'YYYY-MM-DD') AS "dateDebut",to_char(r.date_fin,'YYYY-MM-DD') AS "dateFin",r.statut,r.responsable`;
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
  dateDebut: string | null;
  dateFin: string | null;
  statut: StatutPlanRegistre;
  responsable: ResponsableRef | null;
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
  /** Accès effectif de l'utilisateur à un élément (toutes origines confondues), pour adapter l'écran : 404 s'il ne peut pas
      lire. L'API refuse de toute façon ce qui dépasse ces droits. */
  async accesElement(id: string, user: SessionUser) {
    const o = (await this.q().query<ObjectRow>(`SELECT ${objectColumns} FROM grc_objects WHERE id=$1`, [id])).rows[0];
    const reg = o?.registreId ? await this.brut(o.registreId) : null;
    if (!o || !reg) throw new HttpError(404, 'Élément introuvable ou non accessible.');
    const obj = objectDto(o);
    const module = GRC_MODULES[obj.kind];
    const peut = {
      lire: await this.peut(user, reg, id, 'lire', undefined, module),
      contribuer: await this.peut(user, reg, id, 'contribuer', undefined, module),
      gerer: await this.peut(user, reg, id, 'gerer', undefined, module),
    };
    if (!peut.lire) throw new HttpError(404, 'Élément introuvable ou non accessible.');
    return { registreId: reg.id, role: await this.roleDe(user, reg.id, id), peut };
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
    const avancement = (
      await this.q(c).query<{ total: number; terminees: number }>(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE data->>'status'='done')::int AS terminees
           FROM grc_objects WHERE registre_id=$1 AND NOT archived AND kind='action'`,
        [reg.id],
      )
    ).rows[0]!;
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
      dateDebut: reg.dateDebut,
      dateFin: reg.dateFin,
      statut: reg.statut,
      responsable: reg.responsable,
      avancement,
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

  /** Champs d'un plan d'actions : refusés hors de cette famille ; un responsable doit exister et compter une personne active. */
  private async champsPlan(
    kind: RegistreKind,
    smsi: string,
    v: { dateDebut: string | null; dateFin: string | null; statut: StatutPlanRegistre; responsable: ResponsableRef | null },
    c: Client,
  ) {
    if (kind !== 'plan_actions') {
      if (v.dateDebut || v.dateFin || v.responsable || v.statut !== 'prevu')
        throw new HttpError(422, 'Dates, statut et responsable ne concernent que les plans d’actions.');
      return v;
    }
    if (v.responsable) await this.g.annuaires.resoudre(smsi, v.responsable, c);
    return v;
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
      const plan = await this.champsPlan(b.kind, b.referenceId, b, c);
      const reg = (
        await c.query<RegistreRow>(
          `INSERT INTO registres(kind,name,description,reference_smsi_id,restricted,created_by,updated_by,date_debut,date_fin,statut,responsable)
           VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10) RETURNING ${colonnes}`,
          [
            b.kind,
            b.name,
            b.description,
            b.referenceId,
            b.restreint,
            user.username,
            plan.dateDebut,
            plan.dateFin,
            plan.statut,
            plan.responsable ? JSON.stringify(plan.responsable) : null,
          ],
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
      const plan = await this.champsPlan(
        reg.kind,
        reg.referenceId,
        {
          dateDebut: b.dateDebut === undefined ? reg.dateDebut : b.dateDebut,
          dateFin: b.dateFin === undefined ? reg.dateFin : b.dateFin,
          statut: b.statut ?? reg.statut,
          responsable: b.responsable === undefined ? reg.responsable : b.responsable,
        },
        c,
      );
      if (plan.dateDebut && plan.dateFin && plan.dateDebut > plan.dateFin)
        throw new HttpError(422, 'La date de fin ne peut pas précéder la date de début.');
      const nouveau = (
        await c.query<RegistreRow>(
          `UPDATE registres SET name=$2,description=$3,restricted=$4,date_debut=$6,date_fin=$7,statut=$8,responsable=$9,
                  version=version+1,updated_by=$5,updated_at=now() WHERE id=$1 RETURNING ${colonnes}`,
          [
            id,
            b.name,
            b.description,
            b.restreint,
            user.username,
            plan.dateDebut,
            plan.dateFin,
            plan.statut,
            plan.responsable ? JSON.stringify(plan.responsable) : null,
          ],
        )
      ).rows[0]!;
      await this.g.db.audit(
        user,
        ip,
        'registre.updated',
        id,
        { version: nouveau.version, restreint: b.restreint, statut: plan.statut },
        c,
      );
      await this.g.notify(c, id, nouveau.version, nouveau.referenceId, MODULE, user.username);
      return this.dto(user, nouveau, c);
    }, user.username);
  }

  /** Ordre des actions d'un plan : commande atomique (droit de gestion, `If-Match`) ; les actions citées prennent le rang de
      leur position, les autres passent après. */
  async ordonner(id: string, input: OrdreBody, expected: number, user: SessionUser, ip: string) {
    const b = OrdreBody.parse(input);
    return this.g.db.tx(async (c) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.archived) throw new HttpError(409, 'Registre archivé.');
      if (reg.kind !== 'plan_actions') throw new HttpError(422, 'Seuls les plans d’actions ont des actions ordonnées.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      const ids = unique(b.ids);
      if (ids.length !== b.ids.length) throw new HttpError(422, 'Une action est citée deux fois.');
      const connues = (
        await c.query(
          "SELECT 1 FROM grc_objects WHERE registre_id=$1 AND kind='action' AND NOT archived AND id=ANY($2::uuid[])",
          [id, ids],
        )
      ).rowCount;
      if (connues !== ids.length) throw new HttpError(422, 'Une action citée n’appartient pas à ce plan.');
      await c.query('UPDATE grc_objects SET rang=NULL WHERE registre_id=$1 AND rang IS NOT NULL', [id]);
      await c.query(
        `UPDATE grc_objects o SET rang=t.rang FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id,rang) WHERE o.id=t.id`,
        [ids],
      );
      const nouveau = (
        await c.query<RegistreRow>(
          `UPDATE registres SET version=version+1,updated_by=$2,updated_at=now() WHERE id=$1 RETURNING ${colonnes}`,
          [id, user.username],
        )
      ).rows[0]!;
      await this.g.db.audit(user, ip, 'registre.ordre', id, { actions: ids.length, version: nouveau.version }, c);
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
        `SELECT ${objectColumns} FROM grc_objects WHERE ${where} ORDER BY rang NULLS LAST,updated_at DESC,id LIMIT 50 OFFSET $${args.length}`,
        args,
      )
    ).rows.map(objectDto);
    return { registre: await this.dto(user, reg), items, total, nextOffset: offset + 50 < total ? offset + 50 : null };
  }

  /** Éléments des registres d'un périmètre, filtrés par registres choisis : chaque élément n'appartient qu'à un registre,
      donc aucun doublon ; seuls les registres que l'utilisateur peut lire sont considérés. */
  async elementsFiltres(
    user: SessionUser,
    f: { perimetre: string; registres: string[]; kind?: string; search: string; offset: number },
  ) {
    const visibles = (await this.list(user, { perimetre: f.perimetre })).filter(
      (r) => f.registres.length === 0 || f.registres.includes(r.id),
    );
    const ids = visibles.map((r) => r.id);
    if (!ids.length) return { registres: visibles, items: [] as GrcObject[], total: 0, nextOffset: null };
    const args: unknown[] = [ids, '%' + f.search.replace(/[\\%_]/g, '\\$&') + '%'];
    let where = 'registre_id=ANY($1::uuid[]) AND NOT archived AND name ILIKE $2';
    if (f.kind) where += ` AND kind=$${args.push(f.kind)}`;
    const total = Number(
      (await this.g.db.one<{ n: number }>(`SELECT count(*)::int n FROM grc_objects WHERE ${where}`, args))!.n,
    );
    args.push(f.offset);
    const items = (
      await this.g.db.q<ObjectRow>(
        `SELECT ${objectColumns} FROM grc_objects WHERE ${where} ORDER BY rang NULLS LAST,updated_at DESC,id LIMIT 50 OFFSET $${args.length}`,
        args,
      )
    ).rows.map(objectDto);
    return { registres: visibles, items, total, nextOffset: f.offset + 50 < total ? f.offset + 50 : null };
  }

  /* ---------------------------------------------------------------------------------------------- déplacement */
  /** Déplace un élément (ou une série et ses occurrences) vers un autre registre de la même famille. Droits de gestion sur
      les deux registres ; le périmètre de référence peut changer, d'où les contrôles : état du workflow cible, responsable
      autorisé, liens vers d'autres périmètres. L'historique des versions reste celui d'origine. */
  async deplacer(smsi: string, id: string, input: DeplacementBody, expected: number, user: SessionUser, ip: string) {
    const b = DeplacementBody.parse(input);
    return this.g.db.tx(async (c) => {
      const o = await this.g.raw(id, c, true);
      if (!o || o.smsiId !== smsi || !o.registreId) throw new HttpError(404, 'Élément introuvable ou non accessible.');
      const source = await this.exigerElement(user, o, 'gerer', c);
      if (o.archived) throw new HttpError(409, 'Élément archivé.');
      const famille = registreKindOf(o.kind, o.data);
      if (!famille || !['action', 'nonconformity', 'task_series'].includes(o.kind))
        throw new HttpError(422, 'Cet élément ne se déplace pas.');
      if (o.kind === 'action' && o.data.seriesId) throw new HttpError(422, 'Une occurrence se déplace avec sa série.');
      const cible = await this.brut(b.registreId, c);
      if (!cible) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, cible, null, 'gerer', c, GRC_MODULES[o.kind]);
      if (cible.archived) throw new HttpError(409, 'Registre cible archivé.');
      if (cible.id === source.id) throw new HttpError(422, 'L’élément est déjà dans ce registre.');
      if (cible.kind !== famille) throw new HttpError(422, 'Le registre cible n’est pas de la même famille.');
      const membres = [o];
      if (o.kind === 'task_series')
        for (const r of (
          await c.query<ObjectRow>(
            `SELECT ${objectColumns} FROM grc_objects WHERE data->>'seriesId'=$1 AND kind='action' FOR UPDATE`,
            [o.id],
          )
        ).rows)
          membres.push(objectDto(r));
      const ids = membres.map((m) => m.id);
      const refs = ids.map((i) => 'object:' + i);
      const nouveau = cible.referenceId;
      const nomPerimetres = async (reg: RegistreRow) =>
        (
          await c.query<{ id: string; name: string }>(
            'SELECT s.id,s.name FROM registre_perimetres p JOIN grc_smsis s ON s.id=p.smsi_id WHERE p.registre_id=$1 ORDER BY s.name',
            [reg.id],
          )
        ).rows;
      // Liens : ceux dont l'autre extrémité est une fiche d'un autre périmètre de référence ne peuvent pas suivre.
      const liens = (
        await c.query<{ id: string; source_ref: string; target_ref: string; type: string }>(
          'SELECT id,source_ref,target_ref,type FROM grc_links WHERE source_id=ANY($1::uuid[]) OR source_ref=ANY($2) OR target_ref=ANY($2)',
          [ids, refs],
        )
      ).rows;
      const incompatibles: ImpactDeplacement['liensIncompatibles'] = [];
      const incompatiblesIds: string[] = [];
      for (const l of liens) {
        const autre = refs.includes(l.source_ref) ? l.target_ref : l.source_ref;
        if (!autre.startsWith('object:') || ids.includes(autre.slice(7))) continue;
        const x = (
          await c.query<{ smsi_id: string; name: string }>('SELECT smsi_id,name FROM grc_objects WHERE id=$1', [
            autre.slice(7),
          ])
        ).rows[0];
        if (x && x.smsi_id !== nouveau) {
          incompatibles.push({ ref: autre, type: l.type, nom: x.name });
          incompatiblesIds.push(l.id);
        }
      }
      const problemes: string[] = [];
      if (nouveau !== o.smsiId) {
        const policy = (await this.g.politiqueDe(nouveau, c)).definition;
        for (const m of membres)
          if (m.kind === 'action' && !policy.statuses.some((s) => s.id === m.data.status))
            problemes.push(`« ${m.name} » : état « ${String(m.data.status)} » inconnu du workflow du périmètre cible.`);
        for (const m of membres)
          try {
            await this.g.checkOwner(nouveau, m.data.ownerId ?? null, c);
          } catch {
            problemes.push(`« ${m.name} » : le responsable n’est pas autorisé dans le périmètre cible.`);
          }
      }
      const impact: ImpactDeplacement = {
        depuis: { id: source.id, name: source.name, perimetres: await nomPerimetres(source) },
        vers: { id: cible.id, name: cible.name, perimetres: await nomPerimetres(cible) },
        elements: membres.length,
        referenceChange: nouveau !== o.smsiId,
        liensConserves: liens.length - incompatibles.length,
        liensIncompatibles: incompatibles,
        problemes,
      };
      if (b.apercu) return { apercu: true as const, impact, version: o.version };
      if (!b.reason) throw new HttpError(422, 'Un motif de 10 caractères au moins est exigé.');
      if (o.version !== expected) throw new HttpError(412, 'La fiche a changé. Rechargez avant de confirmer.');
      if (problemes.length) throw new HttpError(422, 'Déplacement impossible : ' + problemes.join(' '));
      if (incompatibles.length && !b.retirerLiensIncompatibles)
        throw new HttpError(409, 'Des liens ne peuvent pas suivre le déplacement : confirmez leur retrait.');
      if (incompatiblesIds.length) await c.query('DELETE FROM grc_links WHERE id=ANY($1::uuid[])', [incompatiblesIds]);
      let deplace = o;
      for (const m of membres) {
        const row = (
          await c.query<ObjectRow>(
            `UPDATE grc_objects SET smsi_id=$2,registre_id=$3,rang=NULL,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 RETURNING ${objectColumns}`,
            [m.id, nouveau, cible.id, user.username],
          )
        ).rows[0]!;
        const next = objectDto(row);
        await this.g.snapshot(c, next, 'Déplacement : ' + b.reason);
        if (m.id === o.id) deplace = next;
      }
      await c.query(
        'UPDATE grc_links SET smsi_id=$2 WHERE source_id=ANY($1::uuid[]) OR source_ref=ANY($3) OR target_ref=ANY($3)',
        [ids, nouveau, refs],
      );
      await c.query('UPDATE grc_notifications SET smsi_id=$2 WHERE object_id=ANY($1::uuid[])', [ids, nouveau]);
      await this.g.db.audit(
        user,
        ip,
        'registre.element.deplace',
        o.id,
        {
          de: source.id,
          vers: cible.id,
          smsiAvant: o.smsiId,
          smsiApres: nouveau,
          elements: membres.length,
          liensRetires: incompatiblesIds.length,
          raison: b.reason,
        },
        c,
      );
      await this.g.notify(c, o.id, deplace.version, nouveau, GRC_MODULES[o.kind], user.username);
      return { apercu: false as const, impact, element: deplace };
    }, user.username);
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
  /** Utilisateurs et groupes proposables à l'attribution d'un droit : réservé à qui gère la ressource (aucune liste d'annuaire
      n'est servie aux autres). */
  async titulaires(type: TypeRessource, id: string, user: SessionUser, q: string) {
    await this.ressource(type, id, user);
    const motif = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    const utilisateurs = (
      await this.g.db.q<{ id: string; libelle: string }>(
        `SELECT id,coalesce(nullif(display_name,''),username) AS libelle FROM users
          WHERE NOT disabled AND (username ILIKE $1 OR display_name ILIKE $1) ORDER BY libelle LIMIT 20`,
        [motif],
      )
    ).rows;
    const groupes = (
      await this.g.db.q<{ id: string; libelle: string }>(
        'SELECT id,name AS libelle FROM groups WHERE name ILIKE $1 ORDER BY name LIMIT 20',
        [motif],
      )
    ).rows;
    return { utilisateurs, groupes };
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
