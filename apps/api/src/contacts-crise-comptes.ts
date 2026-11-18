/* Contacts de crise issus des comptes de la plateforme (ADR 0105, migration 087). L'administrateur
   (administration:administrer) marque un compte, choisit son rôle de crise, la case « contact clé » et les périmètres ; la
   personne met à jour ses seuls téléphones et sa disponibilité. Lecture par la page des contacts de crise et la cellule de
   crise (`GET /api/crise`, incidents:lire) : comptes actifs seulement, du périmètre affiché, ou couvrant au moins un
   périmètre lisible (ou tous) quand aucun n'est choisi. Écritures versionnées (If-Match) et journalisées par noms de champs,
   jamais avec les numéros. Accès aux données en Kysely (ADR 0062). */
import type {
  ContactCriseCompte,
  ContactCriseCompteAdmin,
  ContactCriseCompteAdminOut,
  ContactCriseCompteSoi,
  ContactCriseCompteSoiOut,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import type { SessionUser } from './auth.js';
import type { Actor, Db, Kdb } from './db/db.js';
import type { ContactsCriseComptes as Ligne } from './db/types.generated.js';
import type { Grc } from './grc/core.js';
import { actif, nomAffiche } from './grc/annuaires.js';
import { conflict } from './http/concurrency.js';
import { HttpError } from './http/errors.js';

type Fiche = Selectable<Ligne>;
/** Champs de la fiche, nommés comme dans l'API (journal : noms seulement). */
const CHAMPS = ['role', 'telephone', 'telephone2', 'disponibilite', 'cle', 'tousPerimetres', 'perimetres'] as const;
type Champ = (typeof CHAMPS)[number];

const AUCUNE: ContactCriseCompteAdminOut = {
  actif: false,
  role: '',
  telephone: '',
  telephone2: '',
  disponibilite: '',
  cle: false,
  tousPerimetres: true,
  perimetres: [],
  version: 0,
};

const versAdmin = (f: Fiche): ContactCriseCompteAdminOut => ({
  actif: true,
  role: f.role_crise,
  telephone: f.telephone,
  telephone2: f.telephone2,
  disponibilite: f.disponibilite,
  cle: f.cle,
  tousPerimetres: f.tous_perimetres,
  perimetres: [...f.perimetres],
  version: f.version,
});
const memesPerimetres = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Comptes contacts de crise visibles d'un lecteur des incidents : `lisibles` = ses périmètres lisibles ; `smsi` = le
    périmètre affiché (déjà vérifié lisible par l'appelant). Sans périmètre lisible, aucun contact (ADR 0095). */
export async function contactsComptesVisibles(
  k: Kdb,
  lisibles: ReadonlySet<string>,
  smsi?: string,
): Promise<ContactCriseCompte[]> {
  const ids = [...lisibles];
  if (!ids.length || (smsi && !lisibles.has(smsi))) return [];
  const couvre = smsi
    ? sql<boolean>`(c.tous_perimetres OR ${smsi}::uuid = ANY(c.perimetres))`
    : sql<boolean>`(c.tous_perimetres OR c.perimetres && ${ids}::uuid[])`;
  return k
    .selectFrom('contacts_crise_comptes as c')
    .innerJoin('users as u', 'u.id', 'c.user_id')
    .select([
      'c.user_id as userId',
      nomAffiche.as('nom'),
      'u.email as courriel',
      'c.role_crise as role',
      'c.telephone as phone',
      'c.telephone2 as phone2',
      'c.disponibilite as avail',
      'c.cle as key',
    ])
    .where(actif)
    .where(couvre)
    .orderBy('c.cle', 'desc')
    .orderBy(sql`lower(${nomAffiche})`)
    .orderBy('c.user_id')
    .limit(500)
    .execute();
}

export class ContactsCriseComptes {
  constructor(
    private readonly db: Db,
    private readonly grc: Grc,
  ) {}

  /** Fiche d'un compte pour l'administration ; 404 si le compte n'existe pas. */
  async lireAdmin(userId: string): Promise<ContactCriseCompteAdminOut> {
    const u = await this.db.k.selectFrom('users').select('id').where('id', '=', userId).executeTakeFirst();
    if (!u) throw new HttpError(404, 'Compte introuvable.');
    const f = await this.db.k
      .selectFrom('contacts_crise_comptes')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return f ? versAdmin(f) : AUCUNE;
  }

  /** Écriture de la fiche entière par l'administrateur (version attendue : 0 si le compte n'est pas encore contact de
      crise). `actif: false` supprime la fiche. Périmètres inconnus : 400. */
  async ecrireAdmin(
    userId: string,
    b: ContactCriseCompteAdmin,
    attendue: number,
    acteur: Actor,
    ip: string,
  ): Promise<ContactCriseCompteAdminOut> {
    return this.db.tx(async (c, k) => {
      const u = await k.selectFrom('users').select('username').where('id', '=', userId).executeTakeFirst();
      if (!u) throw new HttpError(404, 'Compte introuvable.');
      const cur = await k
        .selectFrom('contacts_crise_comptes')
        .selectAll()
        .where('user_id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      const version = cur?.version ?? 0;
      if (version !== attendue) throw conflict({ version, updated_by: cur?.updated_by });
      if (!b.actif) {
        if (cur) {
          await k.deleteFrom('contacts_crise_comptes').where('user_id', '=', userId).execute();
          await this.db.audit(acteur, ip, 'admin.user_crisis_contact', u.username, { operation: 'retrait' }, c);
        }
        return AUCUNE;
      }
      if (b.perimetres.length) {
        const connus = await k.selectFrom('grc_smsis').select('id').where('id', 'in', b.perimetres).execute();
        if (connus.length !== b.perimetres.length) throw new HttpError(400, 'Périmètre inconnu.');
      }
      const valeurs = {
        role_crise: b.role,
        telephone: b.telephone,
        telephone2: b.telephone2,
        disponibilite: b.disponibilite,
        cle: b.cle,
        tous_perimetres: b.tousPerimetres,
        // « Tous les périmètres » : la liste choisie n'est pas gardée.
        perimetres: b.tousPerimetres ? [] : b.perimetres,
      };
      const avant = cur ? versAdmin(cur) : AUCUNE;
      const apres: Record<Champ, unknown> = {
        role: valeurs.role_crise,
        telephone: valeurs.telephone,
        telephone2: valeurs.telephone2,
        disponibilite: valeurs.disponibilite,
        cle: valeurs.cle,
        tousPerimetres: valeurs.tous_perimetres,
        perimetres: valeurs.perimetres,
      };
      const changes = CHAMPS.filter((f) =>
        f === 'perimetres' ? !memesPerimetres(avant.perimetres, valeurs.perimetres) : avant[f] !== apres[f],
      );
      if (cur && !changes.length) return avant;
      let fiche: Fiche;
      if (cur)
        fiche = await k
          .updateTable('contacts_crise_comptes')
          .set((eb) => ({
            ...valeurs,
            version: eb('version', '+', 1),
            mis_a_jour: sql<Date>`now()`,
            updated_by: acteur.username,
          }))
          .where('user_id', '=', userId)
          .returningAll()
          .executeTakeFirstOrThrow();
      else
        fiche = await k
          .insertInto('contacts_crise_comptes')
          .values({ user_id: userId, ...valeurs, updated_by: acteur.username })
          .returningAll()
          .executeTakeFirstOrThrow()
          .catch((e: { code?: string }) => {
            // Création simultanée par un autre administrateur : même réponse qu'un conflit de version.
            if (e.code === '23505') throw conflict({ version: 1 });
            throw e;
          });
      await this.db.audit(
        acteur,
        ip,
        'admin.user_crisis_contact',
        u.username,
        { operation: cur ? 'modification' : 'creation', changes, version: fiche.version },
        c,
      );
      return versAdmin(fiche);
    }, acteur.username);
  }

  /** Fiche de la personne connectée ; null si elle n'est pas contact de crise (Mon compte l'interroge à chaque ouverture :
      une réponse vide plutôt qu'une erreur). Les périmètres qu'elle ne lit pas sont seulement comptés. */
  async lireSoi(user: SessionUser): Promise<ContactCriseCompteSoiOut | null> {
    const f = await this.db.k
      .selectFrom('contacts_crise_comptes')
      .selectAll()
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!f) return null;
    return this.versSoi(f, user);
  }

  /** La personne met à jour ses téléphones et sa disponibilité (le schéma refuse tout autre champ). */
  async ecrireSoi(
    user: SessionUser,
    b: ContactCriseCompteSoi,
    attendue: number,
    ip: string,
  ): Promise<ContactCriseCompteSoiOut> {
    const f = await this.db.tx(async (c, k) => {
      const cur = await k
        .selectFrom('contacts_crise_comptes')
        .selectAll()
        .where('user_id', '=', user.id)
        .forUpdate()
        .executeTakeFirst();
      if (!cur) throw new HttpError(404, 'Vous n’êtes pas contact de crise.');
      if (cur.version !== attendue) throw conflict({ version: cur.version, updated_by: cur.updated_by });
      const m: { telephone?: string; telephone2?: string; disponibilite?: string } = {};
      for (const champ of ['telephone', 'telephone2', 'disponibilite'] as const)
        if (b[champ] !== undefined && b[champ] !== cur[champ]) m[champ] = b[champ];
      const changes = Object.keys(m);
      if (!changes.length) return cur;
      const fiche = await k
        .updateTable('contacts_crise_comptes')
        .set((eb) => ({
          ...m,
          version: eb('version', '+', 1),
          mis_a_jour: sql<Date>`now()`,
          updated_by: user.username,
        }))
        .where('user_id', '=', user.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        'account.crisis_contact_update',
        user.username,
        { changes, version: fiche.version },
        c,
      );
      return fiche;
    }, user.username);
    return this.versSoi(f, user);
  }

  private async versSoi(f: Fiche, user: SessionUser): Promise<ContactCriseCompteSoiOut> {
    const lisibles = f.perimetres.length ? await this.grc.listSmsis(user) : [];
    const choisis = new Set(f.perimetres);
    const perimetres = lisibles.filter((s) => choisis.has(s.id)).map((s) => ({ id: s.id, nom: s.name }));
    return {
      role: f.role_crise,
      telephone: f.telephone,
      telephone2: f.telephone2,
      disponibilite: f.disponibilite,
      cle: f.cle,
      tousPerimetres: f.tous_perimetres,
      perimetres,
      perimetresNonLisibles: f.perimetres.length - perimetres.length,
      version: f.version,
    };
  }
}
