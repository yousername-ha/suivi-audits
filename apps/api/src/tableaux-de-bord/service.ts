/* Tableaux de bord multiples de l'accueil (ADR 0109) : tableaux proposés d'office, visibilité recontrôlée à chaque lecture,
   onglets de chaque personne et destinataires d'un partage. Une disposition ne contient aucune donnée ; les chiffres
   ouverts d'un auteur sont calculés à part (chiffres.ts).

   Visibilité d'un tableau pour une personne :
   - les siens, toujours (dans la liste ; dans la barre des favoris seulement si la personne les y met) ;
   - un tableau proposé d'office : son public (lignes de partage s'il y en a, sinon les rôles du modèle, `null` : tout le
     monde) ; l'administrateur (administration:administrer) les voit tous, pour les gérer ;
   - celui d'une autre personne : partagé avec elle (directement, par un de ses groupes ou un de ses rôles), ou publié par un
     auteur dont le compte est actif et qui a encore le droit de publier (module « Tableau de bord » activé).
   Les chiffres de l'auteur sont ouverts quand le tableau n'est ni à la personne ni proposé d'office, que son auteur a
   encore le droit de publier et qu'il est public ou partagé avec elle. */
import {
  DEFS_MODELES,
  dispositionDe,
  dispositionStandard,
  lireDisposition,
  MAX_ONGLETS,
  MODELES_TABLEAUX,
  type DepartTableau,
  type DestinataireTableau,
  type Disposition,
  type ModeleTableau,
  type OrigineTableau,
  type PartageTableauOut,
  type TableauDetail,
  type TableauResume,
  type TableauxOut,
} from '@suivi/shared';
import { sql, type ExpressionBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Kdb } from '../db/db.js';
import type { DB } from '../db/types.generated.js';
import { HttpError } from '../http/errors.js';
import { permissionDenied, utilisateurPourCalcul } from '../rights.js';
import type { Services } from '../services.js';

export const SYSTEME = 'système';

/** Compte actif : ni désactivé ni expiré (alias « u » de la table users ; fragment constant, sans valeur). */
export const actif = sql<boolean>`(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at > now()))`;
export const nomAffiche = sql<string>`coalesce(nullif(u.display_name, ''), u.username)`;

export const estModele = (m: string | null): m is ModeleTableau =>
  !!m && (MODELES_TABLEAUX as readonly string[]).includes(m);

export interface Ligne {
  id: string;
  proprietaire: string | null;
  nom: string;
  disposition: unknown;
  version: number;
  modele: string | null;
  public: boolean;
  surchargee: boolean;
  updated_by: string;
  updated_at: Date;
  created_at: Date;
  chiffres_servis_le: Date | null;
  auteur: string | null;
}

const COLONNES = [
  't.id',
  't.proprietaire',
  't.nom',
  't.disposition',
  't.version',
  't.modele',
  't.public',
  't.surchargee',
  't.updated_by',
  't.updated_at',
  't.created_at',
  't.chiffres_servis_le',
] as const;

const selection = (k: Kdb) =>
  k
    .selectFrom('tableaux_de_bord as t')
    .leftJoin('users as u', 'u.id', 't.proprietaire')
    .select([...COLONNES, sql<string | null>`CASE WHEN u.id IS NULL THEN NULL ELSE ${nomAffiche} END`.as('auteur')]);

/** Un tableau par son identifiant (verrou de ligne dans une transaction). */
export async function lireLigne(k: Kdb, id: string, verrou = false): Promise<Ligne | undefined> {
  const q = selection(k).where('t.id', '=', id);
  return (verrou ? q.forUpdate('t') : q).executeTakeFirst();
}

/** Tableaux proposés d'office : une ligne par modèle du code, créée si elle manque (première lecture, ou après une remise à
    vide). Leur disposition enregistrée n'est lue que si l'administrateur l'a modifiée (`surchargee`). */
export async function assurerModeles(k: Kdb): Promise<void> {
  const presents = new Set(
    (
      await k
        .selectFrom('tableaux_de_bord')
        .select('modele')
        .where('proprietaire', 'is', null)
        .where('modele', 'is not', null)
        .execute()
    ).map((r) => r.modele),
  );
  const manquants = MODELES_TABLEAUX.filter((m) => !presents.has(m));
  if (!manquants.length) return;
  await k
    .insertInto('tableaux_de_bord')
    .values(
      manquants.map((m) => ({
        proprietaire: null,
        modele: m,
        nom: DEFS_MODELES[m].nom,
        disposition: JSON.stringify(DEFS_MODELES[m].disposition()),
        updated_by: SYSTEME,
      })),
    )
    .onConflict((oc) => oc.column('modele').where('proprietaire', 'is', null).doNothing())
    .execute();
}

/* ---------------------------------------------------------------- Lecteur */
/** La personne qui regarde : ses groupes et ses rôles (directs ou par un groupe), relus à chaque requête. */
export interface Lecteur {
  user: SessionUser;
  groupes: string[];
  roles: string[];
  /** Module « Tableau de bord » activé. */
  moduleActif: boolean;
}

export async function lecteur(svc: Services, user: SessionUser): Promise<Lecteur> {
  const k = svc.db.k;
  const [groupes, roles, etat] = await Promise.all([
    k.selectFrom('user_groups').select('group_id').where('user_id', '=', user.id).execute(),
    k
      .selectFrom('user_roles')
      .select('role_id')
      .where('user_id', '=', user.id)
      .union(
        k
          .selectFrom('user_groups as ug')
          .innerJoin('group_roles as gr', 'gr.group_id', 'ug.group_id')
          .select('gr.role_id')
          .where('ug.user_id', '=', user.id),
      )
      .execute(),
    svc.modules.state(),
  ]);
  return {
    user,
    groupes: groupes.map((g) => g.group_id),
    roles: roles.map((r) => r.role_id),
    moduleActif: !etat.disabled.includes('tableau_de_bord'),
  };
}

/** Lignes de partage destinées au lecteur : à lui, à un de ses groupes ou à un de ses rôles. */
const pourLecteur = (eb: ExpressionBuilder<DB, 'tableaux_de_bord_partages'>, lc: Lecteur) => {
  const c = [eb('tableaux_de_bord_partages.utilisateur', '=', lc.user.id)];
  if (lc.groupes.length) c.push(eb('tableaux_de_bord_partages.groupe', 'in', lc.groupes));
  if (lc.roles.length) c.push(eb('tableaux_de_bord_partages.role', 'in', lc.roles));
  return eb.or(c);
};

/** Tableaux partagés avec le lecteur (identifiants), quel qu'en soit l'auteur. */
export async function partagesAvec(k: Kdb, lc: Lecteur, tableau?: string): Promise<Set<string>> {
  let q = k
    .selectFrom('tableaux_de_bord_partages')
    .select('tableaux_de_bord_partages.tableau')
    .distinct()
    .where((eb) => pourLecteur(eb, lc));
  if (tableau) q = q.where('tableaux_de_bord_partages.tableau', '=', tableau);
  return new Set((await q.execute()).map((r) => r.tableau));
}

/* ---------------------------------------------------------------- Visibilité */
export interface Vu {
  ligne: Ligne;
  origine: OrigineTableau;
  modele: ModeleTableau | null;
  /** Publié et ouvert (auteur actif qui a encore le droit de publier) ; pour ses propres tableaux, l'état enregistré. */
  public: boolean;
  restreint: boolean;
  chiffresOuverts: boolean;
  disponible: boolean;
}

export const nomDe = (v: Pick<Vu, 'ligne' | 'modele'>) =>
  v.modele && !v.ligne.surchargee ? DEFS_MODELES[v.modele].nom : v.ligne.nom;
export const dispositionDuTableau = (v: Pick<Vu, 'ligne' | 'modele'>): Disposition =>
  v.modele && !v.ligne.surchargee ? DEFS_MODELES[v.modele].disposition() : lireDisposition(v.ligne.disposition);

/** Tous les tableaux visibles du lecteur, avec leur origine et l'ouverture de leurs chiffres. */
export async function visibles(svc: Services, lc: Lecteur): Promise<Map<string, Vu>> {
  const k = svc.db.k;
  await assurerModeles(k);
  const moi = lc.user.id;
  const [partages, lignes, restreints] = await Promise.all([
    partagesAvec(k, lc),
    selection(k)
      .where((eb) =>
        eb.or([
          eb('t.proprietaire', '=', moi),
          eb.and([eb('t.proprietaire', 'is', null), eb('t.modele', 'in', [...MODELES_TABLEAUX])]),
          eb('t.public', '=', true),
          eb.exists(
            eb
              .selectFrom('tableaux_de_bord_partages')
              .select('tableaux_de_bord_partages.tableau')
              .whereRef('tableaux_de_bord_partages.tableau', '=', 't.id')
              .where((e) => pourLecteur(e, lc)),
          ),
        ]),
      )
      .orderBy('t.created_at')
      .orderBy('t.id')
      .execute(),
    // Tableaux proposés dont le public est fixé par des lignes de partage.
    k
      .selectFrom('tableaux_de_bord_partages as p')
      .innerJoin('tableaux_de_bord as t', 't.id', 'p.tableau')
      .select('p.tableau')
      .distinct()
      .where('t.proprietaire', 'is', null)
      .execute(),
  ]);
  const avecPublic = new Set(restreints.map((r) => r.tableau));
  const admin = lc.user.rights.has('administration:administrer');
  // Auteurs des tableaux d'autres personnes : compte actif et droit de publier, relus une fois chacun à chaque lecture.
  const autres = [...new Set(lignes.map((l) => l.proprietaire).filter((p): p is string => !!p && p !== moi))];
  const publient = new Set<string>();
  if (lc.moduleActif)
    for (const [i, u] of (await Promise.all(autres.map((p) => utilisateurPourCalcul(svc.db, p)))).entries())
      if (u) publient.add(autres[i]!);
  const out = new Map<string, Vu>();
  for (const l of lignes) {
    if (l.proprietaire === moi) {
      out.set(l.id, {
        ligne: l,
        origine: 'mien',
        modele: null,
        public: l.public,
        restreint: false,
        chiffresOuverts: false,
        disponible: true,
      });
      continue;
    }
    if (l.proprietaire === null) {
      // Ligne sans propriétaire ni modèle connu (disposition par défaut de l'ADR 0078, modèle retiré du code) : ignorée.
      if (!estModele(l.modele)) continue;
      const def = DEFS_MODELES[l.modele];
      const restreint = avecPublic.has(l.id) || def.roles !== null;
      const vise = avecPublic.has(l.id)
        ? partages.has(l.id)
        : def.roles === null || def.roles.some((r) => lc.roles.includes(r));
      if (!vise && !admin) continue;
      out.set(l.id, {
        ligne: l,
        origine: 'propose',
        modele: l.modele,
        public: false,
        restreint,
        chiffresOuverts: false,
        disponible: def.disponible,
      });
      continue;
    }
    const partage = partages.has(l.id);
    const auteurOk = publient.has(l.proprietaire);
    if (!partage && !(l.public && auteurOk)) continue;
    out.set(l.id, {
      ligne: l,
      origine: partage ? 'partage' : 'public',
      modele: null,
      public: l.public && auteurOk,
      restreint: false,
      chiffresOuverts: auteurOk && (l.public || partage),
      disponible: true,
    });
  }
  return out;
}

/** Favoris effectifs du lecteur (lignes d'onglets) : dans l'ordre, filtrés par la visibilité ; sans aucun favori, le
    tableau proposé « Global ». */
export async function ongletsEffectifs(k: Kdb, lc: Lecteur, vus: Map<string, Vu>): Promise<string[]> {
  const rangs = await k
    .selectFrom('tableaux_de_bord_onglets')
    .select('tableau')
    .where('utilisateur', '=', lc.user.id)
    .orderBy('rang')
    .orderBy('tableau')
    .execute();
  const ids = rangs
    .map((r) => r.tableau)
    .filter((id) => vus.has(id))
    .slice(0, MAX_ONGLETS);
  if (!ids.length) {
    const global = [...vus.values()].find((v) => v.modele === 'global');
    if (global) ids.push(global.ligne.id);
  }
  return ids;
}

export async function ecrireOnglets(k: Kdb, utilisateur: string, ids: readonly string[]) {
  await k.deleteFrom('tableaux_de_bord_onglets').where('utilisateur', '=', utilisateur).execute();
  if (ids.length)
    await k
      .insertInto('tableaux_de_bord_onglets')
      .values(ids.map((tableau, rang) => ({ utilisateur, tableau, rang })))
      .execute();
}

const resume = (v: Vu, enOnglet: boolean): TableauResume => ({
  id: v.ligne.id,
  nom: nomDe(v),
  origine: v.origine,
  auteur: v.origine === 'propose' ? null : v.ligne.auteur,
  modele: v.modele,
  public: v.public,
  restreint: v.restreint,
  chiffresOuverts: v.chiffresOuverts,
  disponible: v.disponible,
  enOnglet,
});

/** Droit de gérer les tableaux proposés d'office (disposition, nom, public). */
export const gereModeles = (lc: Lecteur) => lc.moduleActif && lc.user.rights.has('administration:administrer');

export const detail = (v: Vu, enOnglet: boolean, lc: Lecteur): TableauDetail => ({
  ...resume(v, enOnglet),
  disposition: dispositionDuTableau(v),
  version: v.ligne.version,
  modifiable:
    v.origine === 'mien' ? lc.user.rights.has('tableau_de_bord:modifier') : v.origine === 'propose' && gereModeles(lc),
});

/** Réponse de lecture : favoris dans l'ordre, tous les tableaux visibles (liste du bouton déroulant), droits. */
export async function tableaux(svc: Services, lc: Lecteur): Promise<TableauxOut> {
  const vus = await visibles(svc, lc);
  const onglets = await ongletsEffectifs(svc.db.k, lc, vus);
  const enOnglet = new Set(onglets);
  const rangModele = (v: Vu) => (v.modele ? MODELES_TABLEAUX.indexOf(v.modele) : MODELES_TABLEAUX.length);
  const rangOrigine = (v: Vu) => ['mien', 'propose', 'partage', 'public'].indexOf(v.origine);
  const disponibles = [...vus.values()]
    .sort(
      (a, b) =>
        rangOrigine(a) - rangOrigine(b) ||
        rangModele(a) - rangModele(b) ||
        nomDe(a).localeCompare(nomDe(b), 'fr', { sensitivity: 'base' }) ||
        (a.ligne.auteur ?? '').localeCompare(b.ligne.auteur ?? '', 'fr'),
    )
    .map((v) => resume(v, enOnglet.has(v.ligne.id)));
  return {
    onglets: onglets.map((id) => detail(vus.get(id)!, true, lc)),
    disponibles,
    droits: {
      creer: lc.user.rights.has('tableau_de_bord:modifier'),
      publier: lc.user.rights.has('tableau_de_bord:administrer'),
      modeles: gereModeles(lc),
    },
  };
}

/* ---------------------------------------------------------------- Droits d'écriture */
export const introuvable = () => new HttpError(404, 'Ce tableau de bord n’existe pas ou ne vous est pas visible.');

/** Ce que la personne peut faire d'un tableau qu'elle veut modifier, supprimer ou partager : le sien (droit
    tableau_de_bord:modifier, sauf `sansDroit`), un tableau proposé (administrateur). Sinon 404 (invisible) ou 403. Le module
    désactivé répond 409, comme les routes gardées par une permission. */
export async function exigerEcriture(
  svc: Services,
  lc: Lecteur,
  ligne: Ligne | undefined,
  opts: { sansDroit?: boolean } = {},
): Promise<{ type: 'mien' } | { type: 'propose'; modele: ModeleTableau }> {
  if (!ligne) throw introuvable();
  if (ligne.proprietaire === lc.user.id) {
    if (opts.sansDroit) return { type: 'mien' };
    await svc.modules.assert('tableau_de_bord');
    if (!lc.user.rights.has('tableau_de_bord:modifier')) throw permissionDenied('tableau_de_bord:modifier');
    return { type: 'mien' };
  }
  const vus = await visibles(svc, lc);
  if (!vus.has(ligne.id)) throw introuvable();
  if (ligne.proprietaire === null && estModele(ligne.modele)) {
    await svc.modules.assert('tableau_de_bord');
    if (!lc.user.rights.has('administration:administrer')) throw permissionDenied('administration:administrer');
    return { type: 'propose', modele: ligne.modele };
  }
  throw new HttpError(403, 'Ce tableau de bord est celui de son auteur : il s’affiche en lecture seule.', {
    reason: 'lecture_seule',
  });
}

/* ---------------------------------------------------------------- Création */
/** Disposition de départ d'un nouveau tableau : vide, standard, ou copie de la disposition d'un de ses tableaux ou d'un
    tableau public visible (rien d'autre n'est copié : ni partage, ni publication). */
export async function dispositionDeDepart(svc: Services, lc: Lecteur, depart: DepartTableau): Promise<Disposition> {
  if (depart.type === 'vide') return dispositionDe([]);
  if (depart.type === 'standard') return dispositionStandard();
  const v = (await visibles(svc, lc)).get(depart.tableau);
  if (!v) throw introuvable();
  if (v.origine !== 'mien' && !v.public)
    throw new HttpError(422, 'Seuls vos tableaux et les tableaux publics peuvent être copiés.', {
      reason: 'copie_impossible',
    });
  return dispositionDuTableau(v);
}

/* ---------------------------------------------------------------- Partage */
export const cleDestinataire = (d: { type: DestinataireTableau['type']; id: string }) => `${d.type}:${d.id}`;

/** Destinataires d'un tableau, avec leur nom (compte : nom affiché ; groupe et rôle : nom), triés par nom. */
export async function destinataires(k: Kdb, tableau: string): Promise<PartageTableauOut['destinataires']> {
  const [comptes, groupes, roles] = await Promise.all([
    k
      .selectFrom('tableaux_de_bord_partages as p')
      .innerJoin('users as u', 'u.id', 'p.utilisateur')
      .select(['u.id', nomAffiche.as('nom')])
      .where('p.tableau', '=', tableau)
      .execute(),
    k
      .selectFrom('tableaux_de_bord_partages as p')
      .innerJoin('groups as g', 'g.id', 'p.groupe')
      .select(['g.id', 'g.name as nom'])
      .where('p.tableau', '=', tableau)
      .execute(),
    k
      .selectFrom('tableaux_de_bord_partages as p')
      .innerJoin('roles as r', 'r.id', 'p.role')
      .select(['r.id', 'r.name as nom'])
      .where('p.tableau', '=', tableau)
      .execute(),
  ]);
  return [
    ...roles.map((r) => ({ type: 'role' as const, ...r })),
    ...groupes.map((g) => ({ type: 'groupe' as const, ...g })),
    ...comptes.map((c) => ({ type: 'utilisateur' as const, ...c })),
  ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inconnu = () =>
  new HttpError(422, 'Un destinataire n’existe pas ou n’est plus actif.', { reason: 'destinataire_inconnu' });

/** Contrôle des destinataires voulus : comptes actifs, groupes et rôles existants (422 sinon). */
export async function verifierDestinataires(k: Kdb, voulus: readonly DestinataireTableau[]) {
  const ids = (type: DestinataireTableau['type']) => voulus.filter((d) => d.type === type).map((d) => d.id);
  const comptes = ids('utilisateur');
  const groupes = ids('groupe');
  const roles = ids('role');
  if ([...comptes, ...groupes].some((id) => !UUID.test(id))) throw inconnu();
  const trouves = [
    ...(comptes.length
      ? await k.selectFrom('users as u').select('u.id').where('u.id', 'in', comptes).where(actif).execute()
      : []),
    ...(groupes.length ? await k.selectFrom('groups').select('id').where('id', 'in', groupes).execute() : []),
    ...(roles.length ? await k.selectFrom('roles').select('id').where('id', 'in', roles).execute() : []),
  ];
  if (trouves.length !== voulus.length) throw inconnu();
}

/** Favoris : contrôle de la liste voulue (chaque tableau visible et disponible, sans doublon, au plus MAX_ONGLETS). */
export function ongletsVoulus(vus: Map<string, Vu>, voulus: readonly string[]): string[] {
  if (new Set(voulus).size !== voulus.length) throw new HttpError(422, 'Un tableau figure deux fois dans les favoris.');
  for (const id of voulus) {
    const v = vus.get(id);
    if (!v) throw introuvable();
    if (!v.disponible)
      throw new HttpError(422, `Le tableau « ${nomDe(v)} » n’est pas encore disponible.`, { reason: 'indisponible' });
  }
  const ids = [...voulus];
  if (ids.length > MAX_ONGLETS)
    throw new HttpError(422, `Au plus ${MAX_ONGLETS} favoris : retirez-en un pour en ajouter un autre.`, {
      reason: 'trop_d_onglets',
    });
  return ids;
}
