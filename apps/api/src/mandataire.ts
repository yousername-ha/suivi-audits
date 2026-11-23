/* Mandataire sortant (proxy) de l'établissement (ADR 0101, lot P1). Réglage unique de la configuration système
   (administration:administrer), rangé dans la table `settings` comme les autres réglages système, sans migration :
   - `systeme:mandataire` : { values, version, updatedBy } (actif, adresse, identifiant, autorité), version pour If-Match ;
   - `secret:mandataire` : mot de passe scellé par le coffre (AES-GCM, AAD dédiée), comme `secret:courriel`. Il n'est jamais
     relu par l'interface, jamais renvoyé ni journalisé ; l'API dit seulement s'il est défini.
   Changer l'adresse ou l'identifiant efface le mot de passe enregistré (même règle que le courriel et les clés de Tenable),
   avec une entrée au journal. Les paramètres (mot de passe compris) ne quittent l'API que vers l'exécutant d'exploitation,
   à la réclamation d'une collecte de la veille, et seulement si le mandataire est actif ; jamais pour un connecteur interne
   (Tenable), qui reste en accès direct par construction. Journal `systeme.mandataire.*` sans secret. */
import {
  analyserAdresseMandataire,
  REGLAGE_MANDATAIRE_DEFAUT,
  ReglageMandataire,
  type MandataireOut,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Actor, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import type { Vault } from './security/crypto.js';

const CLE = 'systeme:mandataire';
const CLE_SECRET = 'secret:mandataire';
const AAD = 'mandataire:mot-de-passe';

interface Ligne {
  values: unknown;
  version: number;
  updatedBy?: string;
}

/** Paramètres remis à l'exécutant pour un flux qui passe par le mandataire. */
export interface MandataireExecutant {
  hote: string;
  port: number;
  identifiant: string;
  motDePasse: string;
  autorite: string;
}

/** Détail d'un échec de collecte par le mandataire (décision du RSSI du 23/11/2026) : l'hôte et le port d'un mandataire
    sortant injoignable, rapportés à part par l'exécutant, ne vont qu'au journal d'audit (lu par l'administration) ; l'erreur
    rangée avec la collecte et rendue à qui lit le module ne les nomme pas. */
export const detailMandataire = (r: { detail?: string | undefined }): { detail?: string } =>
  r.detail ? { detail: r.detail } : {};

/** Ce que le journal garde d'un réglage : ni mot de passe ni certificat entier. */
const pourJournal = (v: ReglageMandataire) => ({
  actif: v.actif,
  adresse: v.adresse,
  identifiant: v.identifiant,
  autoriteFournie: v.autoriteCertification.trim() !== '',
});

export class Mandataire {
  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
  ) {}

  /** Réglage enregistré ; `illisible` : une valeur enregistrée ne passe plus le schéma (le réglage par défaut, inactif, est
      alors rendu, mais la remise à l'exécutant le refuse au lieu de sortir en direct). */
  private async ligne(): Promise<{ values: ReglageMandataire; version: number; illisible: boolean }> {
    const r = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    const l = r?.value as Ligne | undefined;
    const p = ReglageMandataire.safeParse({ ...REGLAGE_MANDATAIRE_DEFAUT, ...((l?.values as object) ?? {}) });
    return {
      values: p.success ? p.data : { ...REGLAGE_MANDATAIRE_DEFAUT },
      version: l?.version ?? 0,
      illisible: !p.success,
    };
  }

  async motDePasseDefini(): Promise<boolean> {
    return !!(await this.db.k.selectFrom('settings').select('key').where('key', '=', CLE_SECRET).executeTakeFirst());
  }

  /** Réglage pour l'administrateur : jamais le mot de passe. */
  async lire(): Promise<MandataireOut> {
    const { values, version } = await this.ligne();
    return { values, version, motDePasseDefini: await this.motDePasseDefini() };
  }

  /** Le mandataire est-il actif (adresse valide) ? Seule information donnée hors de l'écran du réglage. */
  async actif(): Promise<boolean> {
    const { values } = await this.ligne();
    return values.actif && values.adresse !== '';
  }

  /** Enregistrement (If-Match : `attendue`) ; 412 si la version a changé, 422 si le réglage est invalide. */
  async ecrire(saisie: unknown, attendue: number, user: Actor, ip: string): Promise<MandataireOut> {
    const p = ReglageMandataire.safeParse(saisie);
    if (!p.success)
      throw new HttpError(
        422,
        p.error.issues.map((i) => `${i.path.join('.') || 'mandataire'} : ${i.message}`).join(' ; '),
      );
    const apres = p.data;
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE, value: JSON.stringify({ values: REGLAGE_MANDATAIRE_DEFAUT, version: 0 }) })
        .onConflict((oc) => oc.doNothing())
        .execute();
      const cur = (
        await k.selectFrom('settings').select('value').where('key', '=', CLE).forUpdate().executeTakeFirstOrThrow()
      ).value as unknown as Ligne;
      const versionCourante = cur.version ?? 0;
      const avantP = ReglageMandataire.safeParse({ ...REGLAGE_MANDATAIRE_DEFAUT, ...((cur.values as object) ?? {}) });
      const avant = avantP.success ? avantP.data : { ...REGLAGE_MANDATAIRE_DEFAUT };
      if (versionCourante !== attendue)
        throw new HttpError(412, 'Le réglage du mandataire a été modifié par ailleurs. Rechargez-le.', {
          reason: 'conflict',
          current: { values: avant, version: versionCourante },
        });
      const version = versionCourante + 1;
      await k
        .updateTable('settings')
        .set({
          value: JSON.stringify({ values: apres, version, updatedBy: user.username }),
          updated_at: sql<Date>`now()`,
        })
        .where('key', '=', CLE)
        .execute();
      await this.db.audit(
        user,
        ip,
        'systeme.mandataire.modifie',
        '',
        { avant: pourJournal(avant), apres: pourJournal(apres), version },
        c,
      );
      // Le mot de passe ne vaut que pour le mandataire et le compte pour lesquels il a été saisi : changer l'adresse ou
      // l'identifiant le supprime ; il faut le ressaisir.
      if (avant.adresse !== apres.adresse || avant.identifiant !== apres.identifiant) {
        const retire = await k.deleteFrom('settings').where('key', '=', CLE_SECRET).executeTakeFirst();
        if (Number(retire.numDeletedRows) > 0)
          await this.db.audit(
            user,
            ip,
            'systeme.mandataire.mot_de_passe_efface',
            '',
            { motif: avant.adresse !== apres.adresse ? 'adresse modifiée' : 'identifiant modifié' },
            c,
          );
      }
    }, user.username);
    return this.lire();
  }

  async definirMotDePasse(password: string, user: Actor, ip: string): Promise<void> {
    const scelle = this.vault.sealSmall(Buffer.from(password, 'utf8'), AAD).toString('base64');
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE_SECRET, value: JSON.stringify({ sealed: scelle }) })
        .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
        .execute();
      await this.db.audit(user, ip, 'systeme.mandataire.mot_de_passe_defini', '', {}, c);
    }, user.username);
  }

  async retirerMotDePasse(user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      const r = await k.deleteFrom('settings').where('key', '=', CLE_SECRET).executeTakeFirst();
      await this.db.audit(
        user,
        ip,
        'systeme.mandataire.mot_de_passe_retire',
        '',
        { etaitDefini: Number(r.numDeletedRows) > 0 },
        c,
      );
    }, user.username);
  }

  private async lireMotDePasse(): Promise<string> {
    const r = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE_SECRET).executeTakeFirst();
    if (!r) return '';
    return this.vault.openSmall(Buffer.from((r.value as { sealed: string }).sealed, 'base64'), AAD).toString('utf8');
  }

  /** Paramètres remis à l'exécutant (mot de passe compris), seulement si le mandataire est actif ; null s'il est inactif ;
      « illisible » si le réglage enregistré ne se relit pas (la collecte est alors refusée, jamais faite en direct).
      Réservé à la réclamation d'un flux qui passe par le mandataire (veille des vulnérabilités, lot P1). */
  async pourExecutant(): Promise<MandataireExecutant | null | 'illisible'> {
    const { values, illisible } = await this.ligne();
    if (illisible) return 'illisible';
    if (!values.actif || !values.adresse) return null;
    const a = analyserAdresseMandataire(values.adresse);
    if ('erreur' in a) return 'illisible';
    return {
      hote: a.hote,
      port: a.port,
      identifiant: values.identifiant,
      motDePasse: values.identifiant ? await this.lireMotDePasse() : '',
      autorite: values.autoriteCertification.trim(),
    };
  }
}
