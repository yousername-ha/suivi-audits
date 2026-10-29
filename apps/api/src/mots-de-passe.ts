/* Mots de passe poivrés (ADR 0072, ASVS 2.4.5). L'empreinte scrypt de chaque compte est chiffrée en AES-256-GCM par une clé
   dérivée d'un poivre que l'organisation conserve au coffre-fort ; la vérification déchiffre, puis compare l'empreinte scrypt en
   temps constant. Le poivre peut ainsi être changé sans connaître aucun mot de passe : changer, c'est rechiffrer.

     password_hash = poivre$<idClé>$<base64(iv | étiquette | AES-256-GCM(clé, "scrypt$N$r$p$sel$empreinte", AAD = "mdp:" + userId))>

   La clé dérivée (jamais le poivre en texte) est scellée par le coffre dans la ligne `settings` `secret:poivre`, avec le sel de
   dérivation et l'identifiant de clé. Toute création ou modification d'un mot de passe passe par ce service ; `crypto.ts` garde les
   primitives. Le poivre est défini par l'assistant d'installation, avec le premier compte (ADR 0077) : une empreinte qui n'est pas
   poivrée par la clé courante (`scrypt$` comprise) est refusée, et aucun compte ne reçoit d'empreinte tant qu'il n'y a pas de poivre. */
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoivreEtat } from '@suivi/shared';
import { canoniquePoivre, genererPoivre } from '@suivi/shared';
import { sql } from 'kysely';
import type { Client } from 'pg';
import type { Actor, Db, Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';
import {
  chiffrerEmpreinte,
  deriverClePoivre,
  dummyVerify,
  hashPassword,
  idCleEmpreinte,
  idClePoivre,
  ouvrirEmpreinte,
  tempPassword,
  verifyPassword,
  type Vault,
} from './security/crypto.js';

const CLE = 'secret:poivre';
const AAD = 'poivre';
/** Verrou consultatif : une seule opération sur le poivre à la fois (installation, changement, reprise). */
const VERROU_POIVRE = 727279;

interface LigneCle {
  scelle: string;
  sel: string;
  idCle: string;
  definiLe: string;
  definiPar: string;
}
/** Poivre dérivé, prêt à être inscrit : la dérivation (coûteuse) se fait avant toute transaction. */
export interface PoivrePrepare {
  cle: Buffer;
  sel: Buffer;
  idCle: string;
}

const egales = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export class MotsDePasse {
  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
  ) {}

  /* ---------------------------------------------------------------- Clé */
  private async ligne(k: Kdb = this.db.k, verrouiller = false): Promise<LigneCle | null> {
    let q = k.selectFrom('settings').select('value').where('key', '=', CLE);
    if (verrouiller) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return (r?.value as LigneCle | undefined) ?? null;
  }
  private ouvrir(l: LigneCle): Buffer {
    const cle = this.vault.openSmall(Buffer.from(l.scelle, 'base64'), AAD);
    if (idClePoivre(cle) !== l.idCle) throw new Error('Poivre scellé incohérent avec son identifiant.');
    return cle;
  }
  private async cleCourante(k?: Kdb): Promise<{ cle: Buffer; idCle: string } | null> {
    const l = await this.ligne(k);
    return l ? { cle: this.ouvrir(l), idCle: l.idCle } : null;
  }

  async defini(): Promise<boolean> {
    return (await this.ligne()) !== null;
  }

  async etat(): Promise<PoivreEtat> {
    const l = await this.ligne();
    const n = await this.db.k
      .selectFrom('users')
      .select([
        sql<number>`count(*)::int`.as('comptes'),
        sql<number>`(count(*) FILTER (WHERE password_hash LIKE 'poivre$%'))::int`.as('poivrees'),
      ])
      .executeTakeFirstOrThrow();
    return {
      defini: !!l,
      idCle: l?.idCle ?? null,
      definiLe: l?.definiLe ?? null,
      definiPar: l?.definiPar ?? null,
      empreintesPoivrees: n.poivrees,
      comptes: n.comptes,
    };
  }

  /** Dérive la clé d'un poivre (forme canonique) avec un sel neuf. */
  async preparer(poivre: string): Promise<PoivrePrepare> {
    const sel = randomBytes(16);
    const cle = await deriverClePoivre(canoniquePoivre(poivre), sel);
    return { cle, sel, idCle: idClePoivre(cle) };
  }

  /** Vrai si le poivre donné est le poivre courant (comparaison de clés en temps constant). */
  async estLePoivre(poivre: string): Promise<boolean> {
    const l = await this.ligne();
    if (!l) return false;
    const cle = await deriverClePoivre(canoniquePoivre(poivre), Buffer.from(l.sel, 'base64'));
    return egales(cle, this.ouvrir(l));
  }

  private async inscrire(k: Kdb, p: PoivrePrepare, par: string, remplacer: boolean) {
    const valeur: LigneCle = {
      scelle: this.vault.sealSmall(p.cle, AAD).toString('base64'),
      sel: p.sel.toString('base64'),
      idCle: p.idCle,
      definiLe: new Date().toISOString(),
      definiPar: par,
    };
    const q = k.insertInto('settings').values({ key: CLE, value: JSON.stringify(valeur) });
    const r = remplacer
      ? await q
          .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
          .execute()
      : await q.onConflict((oc) => oc.column('key').doNothing()).executeTakeFirst();
    if (!remplacer && !Number((r as { numInsertedOrUpdatedRows?: bigint }).numInsertedOrUpdatedRows ?? 0))
      throw new HttpError(409, 'Le poivre est déjà défini.');
  }

  /** Verrou consultatif de l'opération, à prendre au début de la transaction. */
  private verrou(c: Client) {
    return c.query('SELECT pg_advisory_xact_lock($1)', [VERROU_POIVRE]);
  }

  /** Réécrit les empreintes de tous les comptes avec la clé donnée. `ancienne` : clé courante (null : aucune, tous les comptes
      reçoivent un mot de passe de `mots`). Une empreinte poivrée illisible avec la clé courante annule toute l'opération. */
  private async rechiffrer(
    k: Kdb,
    ancienne: Buffer | null,
    nouvelle: Buffer,
    mots?: Map<string, string>,
  ): Promise<number> {
    const comptes = await k.selectFrom('users').select(['id', 'password_hash']).orderBy('id').forUpdate().execute();
    let n = 0;
    for (const u of comptes) {
      let scrypt: string | null;
      if (mots?.has(u.id)) scrypt = await hashPassword(mots.get(u.id) as string);
      else if (idCleEmpreinte(u.password_hash) !== null) {
        scrypt = ancienne ? ouvrirEmpreinte(ancienne, u.id, u.password_hash) : null;
        if (scrypt === null)
          throw new Error(`Empreinte illisible avec le poivre courant (compte ${u.id}) : opération annulée.`);
      } else continue; // empreinte non poivrée ou forme inconnue : laissée telle quelle, refusée à la connexion
      await k
        .updateTable('users')
        .set({ password_hash: chiffrerEmpreinte(nouvelle, u.id, scrypt) })
        .where('id', '=', u.id)
        .execute();
      n++;
    }
    return n;
  }

  /* ---------------------------------------------------------------- Hachage et vérification */
  /** Empreinte poivrée à stocker pour un compte. L'identifiant doit être connu avant l'insertion. Sans poivre, aucune empreinte :
      l'installation poivre le premier compte elle-même (`inscrireALInstallation`). */
  async hacher(userId: string, mdp: string): Promise<string> {
    const k = await this.cleCourante();
    if (!k) throw new Error('Poivre des mots de passe non défini : aucune empreinte ne peut être enregistrée.');
    return chiffrerEmpreinte(k.cle, userId, await hashPassword(mdp));
  }

  async verifier(userId: string, mdp: string, stockee: string | null | undefined): Promise<boolean> {
    const stock = String(stockee || '');
    const idEmpreinte = idCleEmpreinte(stock);
    const k = await this.cleCourante();
    const clair = k && idEmpreinte !== null ? ouvrirEmpreinte(k.cle, userId, stock) : null;
    if (clair === null) {
      // Empreinte non poivrée (insérée hors service : l'accepter laisserait quiconque écrit dans la base choisir le mot de passe
      // d'un compte), aucun poivre, autre clé, autre compte ou contenu altéré : refus, au même coût qu'une vérification ordinaire.
      await dummyVerify(mdp);
      this.db.log.error(
        { idCleEmpreinte: idEmpreinte, idCleCourante: k?.idCle ?? null },
        'empreinte de mot de passe illisible',
      );
      await this.db.audit(null, null, 'securite.poivre_integrite', userId, {
        idCleEmpreinte: idEmpreinte,
        idCleCourante: k?.idCle ?? null,
      });
      return false;
    }
    return verifyPassword(mdp, clair);
  }

  /* ---------------------------------------------------------------- Installation, changement */
  /** Identifiant d'un futur compte : généré par le serveur, car l'empreinte y est liée (AAD). */
  nouvelId() {
    return randomUUID();
  }

  /** Installation : inscrit le poivre dans la transaction de création de l'administrateur (jamais deux fois). */
  async inscrireALInstallation(c: Client, k: Kdb, p: PoivrePrepare, par: string): Promise<void> {
    await this.verrou(c);
    await this.inscrire(k, p, par, false);
  }

  /** Changement : l'ancien poivre est contrôlé avant (route) ; ici tout est rechiffré dans une seule transaction. */
  async changer(p: PoivrePrepare, ancienIdCle: string, par: Actor, ip: string | null): Promise<number> {
    return this.db.tx(async (c, k) => {
      await this.verrou(c);
      const l = await this.ligne(k, true);
      if (!l) throw new HttpError(409, 'Le poivre n’est pas encore défini.');
      if (l.idCle !== ancienIdCle)
        throw new HttpError(409, 'Le poivre vient d’être modifié par une autre personne. Rechargez la page.');
      const n = await this.rechiffrer(k, this.ouvrir(l), p.cle);
      await this.inscrire(k, p, par.username, true);
      await this.db.audit(
        par,
        ip,
        'securite.poivre_change',
        '',
        { ancienIdCle: l.idCle, nouvelIdCle: p.idCle, empreintes: n },
        c,
      );
      return n;
    }, par.username);
  }

  /* ---------------------------------------------------------------- Procédures d'exploitation (CLI) */
  /** Reprise après perte de la clé maîtresse (base intacte) : le poivre redonné rescelle la clé sous la clé maîtresse actuelle. */
  async restaurer(poivre: string, par: Actor): Promise<'restaure'> {
    return this.db.tx(async (c, k) => {
      await this.verrou(c);
      const l = await this.ligne(k, true);
      if (!l) throw new HttpError(409, 'Aucun poivre n’est enregistré : rien à restaurer.');
      const cle = await deriverClePoivre(canoniquePoivre(poivre), Buffer.from(l.sel, 'base64'));
      if (idClePoivre(cle) !== l.idCle)
        throw new HttpError(403, 'Ce poivre ne correspond pas à celui des empreintes enregistrées.');
      // La date et l'auteur d'origine sont conservés : seule l'enveloppe change.
      await k
        .updateTable('settings')
        .set({ value: JSON.stringify({ ...l, scelle: this.vault.sealSmall(cle, AAD).toString('base64') }) })
        .where('key', '=', CLE)
        .execute();
      await this.db.audit(par, null, 'securite.poivre_restaure', '', { idCle: l.idCle }, c);
      return 'restaure' as const;
    }, par.username);
  }

  /** Poivre perdu : nouveau poivre généré, nouveaux mots de passe temporaires pour TOUS les comptes (changement imposé), sessions
      fermées. Renvoie le poivre (à mettre au coffre) et les mots de passe temporaires, affichés une seule fois par la CLI. */
  async reinitialiser(
    par: Actor,
  ): Promise<{ poivre: string; idCle: string; comptes: { username: string; motDePasse: string }[] }> {
    const poivre = genererPoivre();
    const p = await this.preparer(poivre);
    const comptes: { username: string; motDePasse: string }[] = [];
    await this.db.tx(async (c, k) => {
      await this.verrou(c);
      const tous = await k.selectFrom('users').select(['id', 'username']).orderBy('id').execute();
      const mots = new Map<string, string>();
      for (const u of tous) {
        const mdp = tempPassword();
        mots.set(u.id, mdp);
        comptes.push({ username: u.username, motDePasse: mdp });
      }
      await this.inscrire(k, p, par.username, true);
      await this.rechiffrer(k, null, p.cle, mots);
      await k
        .updateTable('users')
        .set((eb) => ({
          must_change_password: true,
          failed_logins: 0,
          locked_until: null,
          version: eb('version', '+', 1),
        }))
        .execute();
      await k.deleteFrom('sessions').execute();
      await this.db.audit(par, null, 'securite.poivre_reinitialise', '', { idCle: p.idCle, comptes: tous.length }, c);
    }, par.username);
    return { poivre, idCle: p.idCle, comptes };
  }
}
