/* Registres, périmètres hérités et droits par ressource (ADR 0043).
   - Un registre porte un ou plusieurs périmètres ; ses éléments (actions, écarts, séries) les héritent sans copie.
   - Un droit fin (lecteur, contributeur, gestionnaire) s'attribue à un utilisateur ou à un groupe sur un registre ou sur un
     élément ; il s'ajoute aux droits de module et à l'appartenance aux périmètres, jamais à la place du contrôle serveur.
   - Un registre restreint n'est accessible que par ses droits attribués et par les administrateurs. */
import {
  GRC_MODULES,
  RANG_ROLE,
  Rights,
  effectivePermissions,
  DeplacementBody,
  RegistreBody,
  RegistrePerimetresBody,
  RegistreUpdate,
  registreKindOf,
  DroitBody,
  REGISTRE_LABELS,
  ROLE_LABELS,
  roleSuffit,
  type AccesSujetPage,
  type ApercuDroit,
  type AccesSujetRegistre,
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
import { sql, type ExpressionBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import type { DB } from '../db/types.generated.js';
import { loadGrants } from '../rights.js';
import { HttpError } from '../http/errors.js';
import { COLONNES_OBJET, DEFAULT_SMSI, objets, versObjet, type Grc } from './core.js';

const MODULE: Module = 'ecarts';
/** Colonnes d'un registre. Non qualifiées : aucune table jointe ici ne porte ces noms, et un INSERT ne prend pas d'alias. */
const COLONNES_REGISTRE = [
  'id',
  'kind',
  'name',
  'description',
  'reference_smsi_id as referenceId',
  'restricted',
  'archived',
  'par_defaut as parDefaut',
  'version',
  sql<string | null>`to_char(date_debut, 'YYYY-MM-DD')`.as('dateDebut'),
  sql<string | null>`to_char(date_fin, 'YYYY-MM-DD')`.as('dateFin'),
  'statut',
  'responsable',
] as const;
/** Le responsable n'est écrit que par create() et update(), après validation (RegistreBody, RegistreUpdate). */
const versRegistre = (r: Omit<RegistreRow, 'responsable'> & { responsable: unknown }): RegistreRow => ({
  ...r,
  responsable: r.responsable as ResponsableRef | null,
});
const motifIlike = (texte: string) => '%' + texte.replace(/[\\%_]/g, '\\$&') + '%';
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
  /** Kysely sur la transaction de l'appelant, sinon sur le pool. */
  private k(c?: Client): Kdb {
    return c ? surConnexion(c) : this.g.db.k;
  }
  private registres(c?: Client) {
    return this.k(c).selectFrom('registres as r').select(COLONNES_REGISTRE);
  }

  /* ----------------------------------------------------------------------------------------------- lecture brute */
  async brut(id: string, c?: Client, lock = false): Promise<RegistreRow | null> {
    const r = await this.registres(c)
      .where('r.id', '=', id)
      .$if(lock, (q) => q.forUpdate())
      .executeTakeFirst();
    return r ? versRegistre(r) : null;
  }
  async perimetresIds(id: string, c?: Client): Promise<string[]> {
    return (
      await this.k(c)
        .selectFrom('registre_perimetres')
        .select('smsi_id as id')
        .where('registre_id', '=', id)
        .orderBy('smsi_id')
        .execute()
    ).map((r) => r.id);
  }

  /* -------------------------------------------------------------------------------------------- droits effectifs */
  /** Rôle le plus élevé attribué à l'utilisateur, directement ou par un groupe, sur le registre ou sur l'élément. */
  async roleDe(
    user: SessionUser,
    registreId: string,
    objetId: string | null,
    c?: Client,
  ): Promise<RoleRessource | null> {
    const r = await this.k(c)
      .selectFrom('droits_ressources as d')
      .select('d.role')
      .where((eb) =>
        eb.or([
          eb.and([eb('d.resource_type', '=', 'registre'), eb('d.resource_id', '=', registreId)]),
          ...(objetId ? [eb.and([eb('d.resource_type', '=', 'objet'), eb('d.resource_id', '=', objetId)])] : []),
        ]),
      )
      .where((eb) =>
        eb.or([
          eb.and([eb('d.subject_type', '=', 'utilisateur'), eb('d.subject_id', '=', user.id)]),
          eb.and([
            eb('d.subject_type', '=', 'groupe'),
            eb('d.subject_id', 'in', eb.selectFrom('user_groups').select('group_id').where('user_id', '=', user.id)),
          ]),
        ]),
      )
      .execute();
    let meilleur: RoleRessource | null = null;
    for (const { role } of r) if (!meilleur || RANG_ROLE[role] > RANG_ROLE[meilleur]) meilleur = role;
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
    const o = await objets(this.k()).where('id', '=', id).executeTakeFirst();
    const reg = o?.registreId ? await this.brut(o.registreId) : null;
    if (!o || !reg) throw new HttpError(404, 'Élément introuvable ou non accessible.');
    const obj = versObjet(o);
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
    const r = await this.registres(c)
      .where('r.reference_smsi_id', '=', smsi)
      .where('r.restricted', '=', true)
      .execute();
    const masques: string[] = [];
    for (const reg of r.map(versRegistre)) if (!(await this.peut(user, reg, null, 'lire', c))) masques.push(reg.id);
    return masques;
  }

  /** Registres lisibles qui portent ce périmètre sans en être la référence (registre multi-périmètre) : leurs éléments
      apparaissent aussi dans les vues de ce périmètre, sans doublon ni copie. Un registre archivé ou illisible n'y figure pas. */
  async partagesLisibles(user: SessionUser, smsi: string, c?: Client): Promise<string[]> {
    const r = await this.registres(c)
      .innerJoin('registre_perimetres as p', 'p.registre_id', 'r.id')
      .where('p.smsi_id', '=', smsi)
      .where('r.reference_smsi_id', '<>', smsi)
      .where('r.archived', '=', false)
      .execute();
    const ids: string[] = [];
    for (const reg of r.map(versRegistre)) if (await this.peut(user, reg, null, 'lire', c)) ids.push(reg.id);
    return ids;
  }

  /** Tous les registres restreints que l'utilisateur ne peut pas lire, quel que soit leur périmètre de référence : leurs
      éléments ne comptent dans aucun compteur qu'il consulte. */
  async inaccessiblesPartout(user: SessionUser, c?: Client): Promise<string[]> {
    if (await this.g.isAdmin(user, c)) return [];
    const r = await this.registres(c).where('r.restricted', '=', true).execute();
    const masques: string[] = [];
    for (const reg of r.map(versRegistre)) if (!(await this.peut(user, reg, null, 'lire', c))) masques.push(reg.id);
    return masques;
  }

  private readonly cacheEvenements = new Map<string, { registreId: string | null; restreint: boolean; a: number }>();
  /** Un événement temps réel concernant un élément (ou un registre) ne part que vers qui peut lire le registre concerné : un
      registre restreint ne laisse filtrer ni l'identifiant ni la version de ses éléments. Le registre d'un identifiant est
      mis en cache quelques secondes ; seuls les registres restreints coûtent un contrôle de droits. */
  async lisiblePourEvenement(user: SessionUser, id: string): Promise<boolean> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return true;
    let m = this.cacheEvenements.get(id);
    if (!m || Date.now() - m.a > 5000) {
      const k = this.k();
      const r = await k
        .selectFrom('grc_objects as g')
        .innerJoin('registres as r', 'r.id', 'g.registre_id')
        .select(['r.id as registreId', 'r.restricted as restreint'])
        .where('g.id', '=', id)
        .unionAll(
          k
            .selectFrom('registres as r')
            .select(['r.id as registreId', 'r.restricted as restreint'])
            .where('r.id', '=', id),
        )
        .executeTakeFirst();
      m = { registreId: r?.registreId ?? null, restreint: !!r?.restreint, a: Date.now() };
      if (this.cacheEvenements.size > 2000) this.cacheEvenements.clear();
      this.cacheEvenements.set(id, m);
    }
    if (!m.restreint || !m.registreId) return true;
    const reg = await this.brut(m.registreId);
    return !reg || (await this.peut(user, reg, null, 'lire'));
  }

  /* ----------------------------------------------------------------------------------------------------- registre */
  async dto(user: SessionUser, reg: RegistreRow, c?: Client): Promise<RegistreDto> {
    const admin = await this.g.isAdmin(user, c);
    const ids = await this.perimetresIds(reg.id, c);
    const k = this.k(c);
    const noms = ids.length
      ? await k.selectFrom('grc_smsis').select(['id', 'name']).where('id', 'in', ids).execute()
      : [];
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
    const { elements } = await k
      .selectFrom('grc_objects')
      .select(sql<number>`count(*)::int`.as('elements'))
      .where('registre_id', '=', reg.id)
      .where('archived', '=', false)
      .executeTakeFirstOrThrow();
    const avancement = await k
      .selectFrom('grc_objects')
      .select([
        sql<number>`count(*)::int`.as('total'),
        sql<number>`count(*) FILTER (WHERE data->>'status' = 'done')::int`.as('terminees'),
      ])
      .where('registre_id', '=', reg.id)
      .where('archived', '=', false)
      .where('kind', '=', 'action')
      .executeTakeFirstOrThrow();
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
    const rows = await this.registres()
      .$if(!!filtre.kind, (q) => q.where('r.kind', '=', filtre.kind!))
      .$if(!filtre.archives, (q) => q.where('r.archived', '=', false))
      .$if(!!filtre.perimetre, (q) =>
        q.where(({ exists, selectFrom }) =>
          exists(
            selectFrom('registre_perimetres as p')
              .select('p.registre_id')
              .whereRef('p.registre_id', '=', 'r.id')
              .where('p.smsi_id', '=', filtre.perimetre!),
          ),
        ),
      )
      .orderBy('r.kind')
      .orderBy('r.name')
      .orderBy('r.id')
      .execute();
    const out: RegistreDto[] = [];
    for (const reg of rows.map(versRegistre))
      if (await this.peut(user, reg, null, 'lire')) out.push(await this.dto(user, reg));
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
    const k = surConnexion(c);
    const parDefaut = () =>
      k
        .selectFrom('registres')
        .select('id')
        .where('kind', '=', kind)
        .where('reference_smsi_id', '=', smsi)
        .where('par_defaut', '=', true);
    const existant = await parDefaut().executeTakeFirst();
    if (existant) return existant.id;
    const s = await k.selectFrom('grc_smsis').select(['id', 'name']).where('id', '=', smsi).executeTakeFirst();
    if (!s) throw new HttpError(404, 'Périmètre introuvable.');
    const nom = `${REGISTRE_LABELS[kind]} — ${s.id === DEFAULT_SMSI ? 'Pilotage commun' : s.name}`;
    // Index unique partiel (un registre par défaut par famille et périmètre) : le prédicat de l'index est repris tel quel.
    const cree = await k
      .insertInto('registres')
      .values({
        kind,
        name: nom.slice(0, 200),
        reference_smsi_id: smsi,
        par_defaut: true,
        created_by: 'système',
        updated_by: 'système',
      })
      .onConflict((oc) =>
        oc
          .columns(['kind', 'reference_smsi_id'])
          .where(sql<boolean>`par_defaut`)
          .doNothing(),
      )
      .returning('id')
      .executeTakeFirst();
    if (!cree) return (await parDefaut().executeTakeFirstOrThrow()).id;
    await k.insertInto('registre_perimetres').values({ registre_id: cree.id, smsi_id: smsi }).execute();
    return cree.id;
  }

  /** Champs d'un plan d'actions : refusés hors de cette famille ; un responsable doit exister et compter une personne active. */
  private async champsPlan(
    kind: RegistreKind,
    smsi: string,
    v: {
      dateDebut: string | null;
      dateFin: string | null;
      statut: StatutPlanRegistre;
      responsable: ResponsableRef | null;
    },
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
    return this.g.db.tx(async (c, k) => {
      const connus = (await k.selectFrom('grc_smsis').select('id').where('id', 'in', ids).execute()).length;
      if (connus !== ids.length) throw new HttpError(422, 'Périmètre inconnu.');
      if (!(await this.g.isAdmin(user, c))) {
        if (!user.rights.can(MODULE, 'modifier')) throw new HttpError(403, 'Droit requis : ecarts:modifier');
        for (const id of ids) await this.g.access(id, user, true, c);
      }
      const plan = await this.champsPlan(b.kind, b.referenceId, b, c);
      const reg = versRegistre(
        await k
          .insertInto('registres')
          .values({
            kind: b.kind,
            name: b.name,
            description: b.description,
            reference_smsi_id: b.referenceId,
            restricted: b.restreint,
            created_by: user.username,
            updated_by: user.username,
            date_debut: plan.dateDebut,
            date_fin: plan.dateFin,
            statut: plan.statut,
            responsable: plan.responsable ? JSON.stringify(plan.responsable) : null,
          })
          .returning(COLONNES_REGISTRE)
          .executeTakeFirstOrThrow(),
      );
      for (const id of ids)
        await k.insertInto('registre_perimetres').values({ registre_id: reg.id, smsi_id: id }).execute();
      // Le créateur garde la gestion du registre même si ses droits de module changent ensuite.
      await k
        .insertInto('droits_ressources')
        .values({
          resource_type: 'registre',
          resource_id: reg.id,
          subject_type: 'utilisateur',
          subject_id: user.id,
          role: 'gestionnaire',
          granted_by: user.username,
        })
        .execute();
      await this.g.db.audit(user, ip, 'registre.created', reg.id, { kind: b.kind, perimetres: ids }, c);
      await this.g.notify(c, reg.id, reg.version, reg.referenceId, MODULE, user.username);
      return this.dto(user, reg, c);
    }, user.username);
  }
  async update(id: string, input: RegistreUpdate, expected: number, user: SessionUser, ip: string) {
    const b = RegistreUpdate.parse(input);
    return this.g.db.tx(async (c, k) => {
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
      const nouveau = await this.ecrire(k, id, user.username, {
        name: b.name,
        description: b.description,
        restricted: b.restreint,
        date_debut: plan.dateDebut,
        date_fin: plan.dateFin,
        statut: plan.statut,
        responsable: plan.responsable ? JSON.stringify(plan.responsable) : null,
      });
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

  /** Nouvelle version d'un registre (champs donnés, version, auteur et date), relue avec ses colonnes. */
  private async ecrire(
    k: Kdb,
    id: string,
    auteur: string,
    champs: {
      name?: string;
      description?: string;
      restricted?: boolean;
      archived?: boolean;
      date_debut?: string | null;
      date_fin?: string | null;
      statut?: StatutPlanRegistre;
      responsable?: string | null;
    } = {},
  ): Promise<RegistreRow> {
    return versRegistre(
      await k
        .updateTable('registres')
        .set((eb) => ({ ...champs, version: eb('version', '+', 1), updated_by: auteur, updated_at: sql<Date>`now()` }))
        .where('id', '=', id)
        .returning(COLONNES_REGISTRE)
        .executeTakeFirstOrThrow(),
    );
  }
  /** Ordre des actions d'un plan : commande atomique (droit de gestion, `If-Match`) ; les actions citées prennent le rang de
      leur position, les autres passent après. */
  async ordonner(id: string, input: OrdreBody, expected: number, user: SessionUser, ip: string) {
    const b = OrdreBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.archived) throw new HttpError(409, 'Registre archivé.');
      if (reg.kind !== 'plan_actions') throw new HttpError(422, 'Seuls les plans d’actions ont des actions ordonnées.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      const ids = unique(b.ids);
      if (ids.length !== b.ids.length) throw new HttpError(422, 'Une action est citée deux fois.');
      const connues = ids.length
        ? (
            await k
              .selectFrom('grc_objects')
              .select('id')
              .where('registre_id', '=', id)
              .where('kind', '=', 'action')
              .where('archived', '=', false)
              .where('id', 'in', ids)
              .execute()
          ).length
        : 0;
      if (connues !== ids.length) throw new HttpError(422, 'Une action citée n’appartient pas à ce plan.');
      await k
        .updateTable('grc_objects')
        .set({ rang: null })
        .where('registre_id', '=', id)
        .where('rang', 'is not', null)
        .execute();
      // Rang = position dans la liste (à partir de 1) ; les identifiants sont uniques, vérifiés ci-dessus.
      if (ids.length)
        await k
          .updateTable('grc_objects')
          .set({ rang: sql<number>`array_position(${ids}::uuid[], id)` })
          .where('id', 'in', ids)
          .execute();
      const nouveau = await this.ecrire(k, id, user.username);
      await this.g.db.audit(user, ip, 'registre.ordre', id, { actions: ids.length, version: nouveau.version }, c);
      await this.g.notify(c, id, nouveau.version, nouveau.referenceId, MODULE, user.username);
      return this.dto(user, nouveau, c);
    }, user.username);
  }

  /** Impact d'un changement de périmètres : éléments, liens et droits concernés, sans rien écrire. */
  private async impact(reg: RegistreRow, avant: string[], apres: string[], k: Kdb) {
    const nom = async (ids: string[]) =>
      ids.length
        ? await k.selectFrom('grc_smsis').select(['id', 'name']).where('id', 'in', ids).orderBy('name').execute()
        : [];
    const n = sql<number>`count(*)::int`.as('n');
    const elements = k
      .selectFrom('grc_objects')
      .select(n)
      .where('registre_id', '=', reg.id)
      .where('archived', '=', false);
    return {
      ajoutes: await nom(apres.filter((x) => !avant.includes(x))),
      retires: await nom(avant.filter((x) => !apres.includes(x))),
      elements: (await elements.executeTakeFirstOrThrow()).n,
      series: (await elements.where('kind', '=', 'task_series').executeTakeFirstOrThrow()).n,
      liens: (
        await k
          .selectFrom('grc_links as l')
          .innerJoin('grc_objects as o', 'o.id', 'l.source_id')
          .select(n)
          .where('o.registre_id', '=', reg.id)
          .executeTakeFirstOrThrow()
      ).n,
      droits: (
        await k
          .selectFrom('droits_ressources')
          .select(n)
          .where('resource_type', '=', 'registre')
          .where('resource_id', '=', reg.id)
          .executeTakeFirstOrThrow()
      ).n,
    };
  }
  /** Commande atomique : le périmètre de référence reste ; les éléments héritent aussitôt, sans écriture individuelle. */
  async setPerimetres(id: string, input: RegistrePerimetresBody, expected: number, user: SessionUser, ip: string) {
    const b = RegistrePerimetresBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.archived) throw new HttpError(409, 'Registre archivé.');
      const apres = unique(b.perimetres);
      if (!apres.includes(reg.referenceId))
        throw new HttpError(422, 'Le périmètre de référence du registre doit rester rattaché.');
      // apres contient au moins le périmètre de référence : la liste n'est jamais vide.
      const connus = (await k.selectFrom('grc_smsis').select('id').where('id', 'in', apres).execute()).length;
      if (connus !== apres.length) throw new HttpError(422, 'Périmètre inconnu.');
      const avant = await this.perimetresIds(id, c);
      const admin = await this.g.isAdmin(user, c);
      // Rattacher un registre à un périmètre exige de pouvoir au moins le consulter.
      if (!admin) for (const p of apres.filter((x) => !avant.includes(x))) await this.g.access(p, user, false, c);
      const impact = await this.impact(reg, avant, apres, k);
      if (b.apercu) return { apercu: true as const, impact, version: reg.version };
      if (!b.reason) throw new HttpError(422, 'Un motif de 10 caractères au moins est exigé.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      await k
        .deleteFrom('registre_perimetres')
        .where('registre_id', '=', id)
        .where('smsi_id', 'not in', apres)
        .execute();
      for (const p of apres.filter((x) => !avant.includes(x)))
        await k.insertInto('registre_perimetres').values({ registre_id: id, smsi_id: p }).execute();
      const nouveau = await this.ecrire(k, id, user.username);
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
    return this.g.db.tx(async (c, k) => {
      const reg = await this.brut(id, c, true);
      if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
      await this.exiger(user, reg, null, 'gerer', c);
      if (reg.parDefaut) throw new HttpError(409, 'Le registre par défaut d’un périmètre ne s’archive pas.');
      if (reg.version !== expected) throw new HttpError(412, 'Le registre a changé. Rechargez avant de confirmer.');
      const nouveau = await this.ecrire(k, id, user.username, { archived: true });
      // Les éléments, leurs historiques et leurs preuves sont conservés tels quels.
      await this.g.db.audit(user, ip, 'registre.archived', id, { version: nouveau.version }, c);
      await this.g.notify(c, id, nouveau.version, nouveau.referenceId, MODULE, user.username);
      return this.dto(user, nouveau, c);
    }, user.username);
  }
  /** Page d'éléments non archivés de registres donnés (au moins un), dans l'ordre du plan puis du plus récent. */
  private async pageElements(registres: string[], kind: string | undefined, search: string, offset: number) {
    const filtre = this.g.db.k
      .selectFrom('grc_objects')
      .where('registre_id', 'in', registres)
      .where('archived', '=', false)
      .where('name', 'ilike', motifIlike(search))
      .$if(!!kind, (q) => q.where('kind', '=', kind!));
    const { total } = await filtre.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow();
    const items = (
      await filtre
        .select(COLONNES_OBJET)
        .orderBy('rang', (ob) => ob.asc().nullsLast())
        .orderBy('updated_at', 'desc')
        .orderBy('id')
        .limit(50)
        .offset(offset)
        .execute()
    ).map(versObjet);
    return { total, items };
  }
  async elements(id: string, user: SessionUser, kind: string | undefined, search: string, offset: number) {
    const reg = await this.brut(id);
    if (!reg) throw new HttpError(404, 'Registre introuvable ou non accessible.');
    await this.exiger(user, reg, null, 'lire');
    const { total, items } = await this.pageElements([id], kind, search, offset);
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
    const { total, items } = await this.pageElements(ids, f.kind, f.search, f.offset);
    return { registres: visibles, items, total, nextOffset: f.offset + 50 < total ? f.offset + 50 : null };
  }

  /* ---------------------------------------------------------------------------------------------- déplacement */
  /** Déplace un élément (ou une série et ses occurrences) vers un autre registre de la même famille. Droits de gestion sur
      les deux registres ; le périmètre de référence peut changer, d'où les contrôles : état du workflow cible, responsable
      autorisé, liens vers d'autres périmètres. L'historique des versions reste celui d'origine. */
  async deplacer(smsi: string, id: string, input: DeplacementBody, expected: number, user: SessionUser, ip: string) {
    const b = DeplacementBody.parse(input);
    return this.g.db.tx(async (c, k) => {
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
        for (const r of await objets(k)
          .where(sql<string | null>`data->>'seriesId'`, '=', o.id)
          .where('kind', '=', 'action')
          .forUpdate()
          .execute())
          membres.push(versObjet(r));
      const ids = membres.map((m) => m.id);
      const refs = ids.map((i) => 'object:' + i);
      const nouveau = cible.referenceId;
      const nomPerimetres = async (reg: RegistreRow) =>
        await k
          .selectFrom('registre_perimetres as p')
          .innerJoin('grc_smsis as s', 's.id', 'p.smsi_id')
          .select(['s.id', 's.name'])
          .where('p.registre_id', '=', reg.id)
          .orderBy('s.name')
          .execute();
      // Liens qui touchent les éléments déplacés (ids et refs ne sont jamais vides : ils contiennent l'élément lui-même).
      const touchesElements = (eb: ExpressionBuilder<DB, 'grc_links'>) =>
        eb.or([eb('source_id', 'in', ids), eb('source_ref', 'in', refs), eb('target_ref', 'in', refs)]);
      // Liens : ceux dont l'autre extrémité est une fiche d'un autre périmètre de référence ne peuvent pas suivre.
      const liens = await k
        .selectFrom('grc_links')
        .select(['id', 'source_ref', 'target_ref', 'type'])
        .where(touchesElements)
        .execute();
      const incompatibles: ImpactDeplacement['liensIncompatibles'] = [];
      const incompatiblesIds: string[] = [];
      for (const l of liens) {
        const autre = refs.includes(l.source_ref) ? l.target_ref : l.source_ref;
        if (!autre.startsWith('object:') || ids.includes(autre.slice(7))) continue;
        const x = await k
          .selectFrom('grc_objects')
          .select(['smsi_id', 'name'])
          .where('id', '=', autre.slice(7))
          .executeTakeFirst();
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
      if (incompatiblesIds.length) await k.deleteFrom('grc_links').where('id', 'in', incompatiblesIds).execute();
      let deplace = o;
      for (const m of membres) {
        const next = versObjet(
          await k
            .updateTable('grc_objects')
            .set((eb) => ({
              smsi_id: nouveau,
              registre_id: cible.id,
              rang: null,
              version: eb('version', '+', 1),
              updated_by: user.username,
              updated_at: sql<Date>`now()`,
            }))
            .where('id', '=', m.id)
            .returning(COLONNES_OBJET)
            .executeTakeFirstOrThrow(),
        );
        await this.g.snapshot(c, next, 'Déplacement : ' + b.reason);
        if (m.id === o.id) deplace = next;
      }
      await k.updateTable('grc_links').set({ smsi_id: nouveau }).where(touchesElements).execute();
      await k.updateTable('grc_notifications').set({ smsi_id: nouveau }).where('object_id', 'in', ids).execute();
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
    const o = await objets(this.k(c)).where('id', '=', id).executeTakeFirst();
    if (!o?.registreId) throw new HttpError(404, 'Élément introuvable ou non accessible.');
    const reg = await this.exigerElement(user, versObjet(o), 'gerer', c);
    return { reg, objetId: id as string | null };
  }
  async droits(type: TypeRessource, id: string, user: SessionUser) {
    await this.ressource(type, id, user);
    return (
      await this.g.db.k
        .selectFrom('droits_ressources as d')
        .leftJoin('users as u', (j) => j.on('d.subject_type', '=', 'utilisateur').onRef('u.id', '=', 'd.subject_id'))
        .leftJoin('groups as g', (j) => j.on('d.subject_type', '=', 'groupe').onRef('g.id', '=', 'd.subject_id'))
        .select([
          'd.id',
          'd.subject_type as subjectType',
          'd.subject_id as subjectId',
          'd.role',
          sql<string>`CASE WHEN d.subject_type = 'utilisateur' THEN coalesce(nullif(u.display_name, ''), u.username, 'Compte supprimé') ELSE coalesce(g.name, 'Groupe supprimé') END`.as(
            'libelle',
          ),
          'd.granted_by as grantedBy',
          'd.granted_at as grantedAt',
        ])
        .where('d.resource_type', '=', type)
        .where('d.resource_id', '=', id)
        .orderBy('d.subject_type')
        .orderBy('libelle')
        .orderBy('d.id')
        .execute()
    ).map((r) => ({ ...r, grantedAt: r.grantedAt.toISOString() }));
  }
  /** Vue des accès d'une personne ou d'un groupe : pour chaque registre, le rôle attribué (et son origine) et, pour une
      personne, les droits effectifs calculés par le serveur avec les contrôles réels. Réservée aux administrateurs des
      droits ; paginée et filtrable par nom de registre. Les registres archivés sont exclus. */
  async accesDuSujet(
    type: 'utilisateur' | 'groupe',
    id: string,
    f: { q: string; limite: number; decalage: number },
  ): Promise<AccesSujetPage> {
    const k = this.g.db.k;
    const sujet =
      type === 'utilisateur'
        ? await k
            .selectFrom('users')
            .select(['id', sql<string>`coalesce(nullif(display_name, ''), username)`.as('libelle'), 'username'])
            .where('id', '=', id)
            .executeTakeFirst()
        : await k
            .selectFrom('groups')
            .select(['id', 'name as libelle', 'name as username'])
            .where('id', '=', id)
            .executeTakeFirst();
    if (!sujet) throw new HttpError(404, type === 'utilisateur' ? 'Compte introuvable.' : 'Groupe introuvable.');
    const filtre = this.registres().where('r.archived', '=', false).where('r.name', 'ilike', motifIlike(f.q));
    const { total } = await filtre
      .clearSelect()
      .select(sql<number>`count(*)::int`.as('total'))
      .executeTakeFirstOrThrow();
    const regs = (
      await filtre.orderBy('r.kind').orderBy('r.name').orderBy('r.id').limit(f.limite).offset(f.decalage).execute()
    ).map(versRegistre);
    const ids = regs.map((r) => r.id);
    // Rôles attribués, directement ou par un groupe (pour un groupe : les siens seulement).
    const droits = !ids.length
      ? []
      : type === 'utilisateur'
        ? await k
            .selectFrom('droits_ressources as d')
            .leftJoin('groups as g', (j) => j.on('d.subject_type', '=', 'groupe').onRef('g.id', '=', 'd.subject_id'))
            .select([
              'd.resource_id as registre',
              'd.role',
              sql<boolean>`d.subject_type = 'utilisateur'`.as('direct'),
              'g.name as groupe',
            ])
            .where('d.resource_type', '=', 'registre')
            .where('d.resource_id', 'in', ids)
            .where((eb) =>
              eb.or([
                eb.and([eb('d.subject_type', '=', 'utilisateur'), eb('d.subject_id', '=', id)]),
                eb.and([
                  eb('d.subject_type', '=', 'groupe'),
                  eb('d.subject_id', 'in', eb.selectFrom('user_groups').select('group_id').where('user_id', '=', id)),
                ]),
              ]),
            )
            .execute()
        : await k
            .selectFrom('droits_ressources as d')
            .innerJoin('groups as g', 'g.id', 'd.subject_id')
            .select(['d.resource_id as registre', 'd.role', sql<boolean>`false`.as('direct'), 'g.name as groupe'])
            .where('d.resource_type', '=', 'registre')
            .where('d.resource_id', 'in', ids)
            .where('d.subject_type', '=', 'groupe')
            .where('d.subject_id', '=', id)
            .execute();
    const perimetres = ids.length
      ? await k
          .selectFrom('registre_perimetres as p')
          .innerJoin('grc_smsis as s', 's.id', 'p.smsi_id')
          .select(['p.registre_id as registre', 's.id', 's.name'])
          .where('p.registre_id', 'in', ids)
          .orderBy('s.name')
          .execute()
      : [];
    // La personne telle que les contrôles la voient : mêmes droits de module, mêmes périmètres, mêmes administrateurs.
    const personne: SessionUser | null =
      type === 'utilisateur'
        ? ({
            id: sujet.id,
            username: sujet.username,
            displayName: sujet.libelle,
            roles: [],
            rights: new Rights(effectivePermissions(await loadGrants(this.g.db.pool, sujet.id)).keys()),
          } as unknown as SessionUser)
        : null;
    const admin = personne ? await this.g.isAdmin(personne) : false;
    const items: AccesSujetRegistre[] = [];
    for (const reg of regs) {
      const mes = droits.filter((d) => d.registre === reg.id);
      let role: RoleRessource | null = null;
      for (const d of mes) if (!role || RANG_ROLE[d.role] > RANG_ROLE[role]) role = d.role;
      const peut = personne
        ? {
            lire: await this.peut(personne, reg, null, 'lire'),
            contribuer: await this.peut(personne, reg, null, 'contribuer'),
            gerer: await this.peut(personne, reg, null, 'gerer'),
          }
        : undefined;
      const source: AccesSujetRegistre['source'] = admin
        ? 'administrateur'
        : role
          ? 'role'
          : peut?.lire
            ? 'module'
            : 'aucune';
      items.push({
        registre: {
          id: reg.id,
          name: reg.name,
          kind: reg.kind,
          restreint: reg.restricted,
          perimetres: perimetres.filter((p) => p.registre === reg.id).map(({ id: pid, name }) => ({ id: pid, name })),
        },
        role,
        origines: mes.map((d) =>
          d.direct
            ? { type: 'direct', libelle: 'Attribué directement' }
            : { type: 'groupe', libelle: d.groupe ?? 'Groupe supprimé' },
        ),
        ...(peut ? { peut } : {}),
        source,
      });
    }
    return {
      sujet: { type, id: sujet.id, libelle: sujet.libelle },
      total,
      limite: f.limite,
      decalage: f.decalage,
      items,
    };
  }
  /** Utilisateurs et groupes proposables à l'attribution d'un droit : réservé à qui gère la ressource (aucune liste d'annuaire
      n'est servie aux autres). */
  async titulaires(type: TypeRessource, id: string, user: SessionUser, q: string) {
    await this.ressource(type, id, user);
    const motif = motifIlike(q);
    const k = this.g.db.k;
    const utilisateurs = await k
      .selectFrom('users')
      .select(['id', sql<string>`coalesce(nullif(display_name, ''), username)`.as('libelle')])
      .where('disabled', '=', false)
      .where((eb) => eb.or([eb('username', 'ilike', motif), eb('display_name', 'ilike', motif)]))
      .orderBy('libelle')
      .limit(20)
      .execute();
    const groupes = await k
      .selectFrom('groups')
      .select(['id', 'name as libelle'])
      .where('name', 'ilike', motif)
      .orderBy('name')
      .limit(20)
      .execute();
    return { utilisateurs, groupes };
  }
  async accorder(type: TypeRessource, id: string, input: DroitBody, user: SessionUser, ip: string) {
    const b = DroitBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      await this.ressource(type, id, user, c);
      const existe =
        b.subjectType === 'utilisateur'
          ? await k
              .selectFrom('users')
              .select('id')
              .where('id', '=', b.subjectId)
              .where('disabled', '=', false)
              .executeTakeFirst()
          : await k.selectFrom('groups').select('id').where('id', '=', b.subjectId).executeTakeFirst();
      if (!existe) throw new HttpError(422, 'Titulaire du droit introuvable.');
      const avant = await this.droitDe(k, type, id, b).forUpdate().executeTakeFirst();
      const r = await k
        .insertInto('droits_ressources')
        .values({
          resource_type: type,
          resource_id: id,
          subject_type: b.subjectType,
          subject_id: b.subjectId,
          role: b.role,
          granted_by: user.username,
        })
        .onConflict((oc) =>
          oc.columns(['resource_type', 'resource_id', 'subject_type', 'subject_id']).doUpdateSet((eb) => ({
            role: eb.ref('excluded.role'),
            granted_by: eb.ref('excluded.granted_by'),
            granted_at: sql<Date>`now()`,
          })),
        )
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.g.db.audit(
        user,
        ip,
        'droit.accorde',
        id,
        {
          ressource: type,
          titulaire: `${b.subjectType}:${b.subjectId}`,
          role: b.role,
          ancienRole: avant?.role ?? null,
          ...(b.motif ? { motif: b.motif } : {}),
        },
        c,
      );
      return { id: r.id };
    }, user.username);
  }
  /** Droit attribué à un titulaire sur une ressource. */
  private droitDe(k: Kdb, type: TypeRessource, id: string, b: Pick<DroitBody, 'subjectType' | 'subjectId'>) {
    return k
      .selectFrom('droits_ressources')
      .select('role')
      .where('resource_type', '=', type)
      .where('resource_id', '=', id)
      .where('subject_type', '=', b.subjectType)
      .where('subject_id', '=', b.subjectId);
  }
  /** Aperçu d'une attribution : rôle avant et après, personnes concernées, rôles qui subsistent. N'écrit rien. */
  async apercuDroit(type: TypeRessource, id: string, input: DroitBody, user: SessionUser): Promise<ApercuDroit> {
    const b = DroitBody.parse(input);
    await this.ressource(type, id, user);
    const k = this.g.db.k;
    const titulaire =
      b.subjectType === 'utilisateur'
        ? await k
            .selectFrom('users')
            .select(sql<string>`coalesce(nullif(display_name, ''), username)`.as('libelle'))
            .where('id', '=', b.subjectId)
            .where('disabled', '=', false)
            .executeTakeFirst()
        : await k.selectFrom('groups').select('name as libelle').where('id', '=', b.subjectId).executeTakeFirst();
    if (!titulaire) throw new HttpError(422, 'Titulaire du droit introuvable.');
    const avant: RoleRessource | null = (await this.droitDe(k, type, id, b).executeTakeFirst())?.role ?? null;
    let personnes = 1;
    let subsistants: ApercuDroit['subsistants'] = [];
    let dejaPlusEleves = 0;
    if (b.subjectType === 'utilisateur') {
      subsistants = (
        await k
          .selectFrom('droits_ressources as d')
          .innerJoin('groups as g', 'g.id', 'd.subject_id')
          .select(['d.role', 'g.name as libelle'])
          .where('d.resource_type', '=', type)
          .where('d.resource_id', '=', id)
          .where('d.subject_type', '=', 'groupe')
          .where('d.subject_id', 'in', (eb) =>
            eb.selectFrom('user_groups').select('group_id').where('user_id', '=', b.subjectId),
          )
          .orderBy('g.name')
          .execute()
      ).map((r) => ({ role: r.role, libelle: `Groupe ${r.libelle}` }));
    } else {
      personnes = (
        await k
          .selectFrom('user_groups as ug')
          .innerJoin('users as u', 'u.id', 'ug.user_id')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('ug.group_id', '=', b.subjectId)
          .where('u.disabled', '=', false)
          .where((eb) => eb.or([eb('u.expires_at', 'is', null), eb('u.expires_at', '>', sql<Date>`now()`)]))
          .executeTakeFirstOrThrow()
      ).n;
      // Rangs des rôles comparés en SQL, comme RANG_ROLE côté serveur.
      dejaPlusEleves = (
        await k
          .selectFrom('droits_ressources as d')
          .select(sql<number>`count(DISTINCT d.subject_id)::int`.as('n'))
          .where('d.resource_type', '=', type)
          .where('d.resource_id', '=', id)
          .where('d.subject_type', '=', 'utilisateur')
          .where('d.subject_id', 'in', (eb) =>
            eb.selectFrom('user_groups').select('user_id').where('group_id', '=', b.subjectId),
          )
          .where(
            sql<boolean>`CASE d.role WHEN 'lecteur' THEN 1 WHEN 'contributeur' THEN 2 ELSE 3 END >
              CASE ${b.role}::text WHEN 'lecteur' THEN 1 WHEN 'contributeur' THEN 2 ELSE 3 END`,
          )
          .executeTakeFirstOrThrow()
      ).n;
    }
    return {
      apercu: true,
      titulaire: { type: b.subjectType, id: b.subjectId, libelle: titulaire.libelle },
      avant,
      apres: b.role,
      personnes,
      subsistants,
      dejaPlusEleves,
      inchange: avant === b.role,
    };
  }
  async retirer(type: TypeRessource, id: string, droitId: string, user: SessionUser, ip: string) {
    return this.g.db.tx(async (c, k) => {
      await this.ressource(type, id, user, c);
      const r = await k
        .deleteFrom('droits_ressources')
        .where('id', '=', droitId)
        .where('resource_type', '=', type)
        .where('resource_id', '=', id)
        .returning(['subject_type', 'subject_id', 'role'])
        .executeTakeFirst();
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
