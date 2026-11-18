/* Module Vulnérabilités et assistant RSSI (ADR 0100, décision V31) : liste de mots à ne pas masquer, rangée dans la table
   `settings` comme le seuil de priorité (clé `vulnerabilites:masque`, { values, version, updatedBy }), sans migration.
   Lecture et écriture avec `vulnerabilites:administrer` (écriture avec If-Match) ; journal
   `vulnerabilites.masque.reglage_modifie` avec les mots ajoutés et retirés (ce ne sont pas des secrets). Le masque des
   machines reste la règle : un réglage illisible vaut liste vide (masque strict), jamais l'inverse.
   Pour chaque mot, la plateforme dit ce qu'il laisse sortir : le nombre de machines de l'inventaire dont il est le nom court
   ou le nom entier (mêmes formes que le masque), et le nom de celles que la personne peut lire (droit de lecture du module et
   droits du périmètre de la machine) ; les autres sont seulement comptées. */
import {
  cleMotNonMasque,
  EFFET_MOT_NOMS_MAX,
  type EffetMotNonMasque,
  REGLAGE_MASQUE_DEFAUT,
  ReglageMasque,
  type ReglageMasqueOut,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { formesDuNom } from '../assistant/masque.js';
import type { Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { lisible } from './sql.js';

const CLE = 'vulnerabilites:masque';

interface Ligne {
  values: unknown;
  version: number;
  updatedBy?: string;
}

/** Réglage rangé ; illisible (forme inattendue, mot refusé, doublon) : liste vide. */
const lu = (l: Ligne | undefined): ReglageMasque => {
  const p = ReglageMasque.safeParse(l?.values ?? REGLAGE_MASQUE_DEFAUT);
  return p.success ? p.data : { mots: [] };
};

export class MotsNonMasquesVulnerabilites {
  constructor(private readonly db: Db) {}

  private async ligne(): Promise<Ligne | undefined> {
    const r = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    return r?.value as Ligne | undefined;
  }

  /** Réglage et effet de chaque mot, pour la personne (vulnerabilites:administrer, contrôlé par la route). */
  async lire(user: SessionUser): Promise<ReglageMasqueOut> {
    const l = await this.ligne();
    const values = lu(l);
    return { values, version: l?.version ?? 0, effets: await this.effets(user, values.mots) };
  }

  /** Mots remis au masque. Toute erreur de lecture vaut liste vide : le masque reste strict. */
  async mots(): Promise<string[]> {
    try {
      return lu(await this.ligne()).mots;
    } catch {
      return [];
    }
  }

  /** Effet d'un mot (déjà validé par le schéma de la route). */
  async effet(user: SessionUser, mot: string): Promise<EffetMotNonMasque> {
    return (await this.effets(user, [mot]))[0]!;
  }

  /** Machines de l'inventaire que chaque mot désigne par l'une des formes de leur nom (comme le masque). */
  private async effets(user: SessionUser, mots: readonly string[]): Promise<EffetMotNonMasque[]> {
    if (!mots.length) return [];
    const lit = user.rights.can('vulnerabilites', 'lire');
    const { rows } = await sql<{ nom: string; lisible: boolean }>`
      SELECT m.nom, ${lisible(user)} AS lisible FROM vulnerabilites_machines m WHERE m.nom IS NOT NULL`.execute(
      this.db.k,
    );
    const parCle = new Map<string, { noms: string[]; nonLisibles: number }>(
      mots.map((m) => [cleMotNonMasque(m), { noms: [], nonLisibles: 0 }]),
    );
    for (const r of rows)
      for (const f of formesDuNom(r.nom)) {
        const e = parCle.get(f);
        if (!e) continue;
        if (lit && r.lisible) e.noms.push(r.nom);
        else e.nonLisibles++;
      }
    return mots.map((mot) => {
      const e = parCle.get(cleMotNonMasque(mot))!;
      const noms = [...e.noms].sort((a, b) => a.localeCompare(b, 'fr'));
      return {
        mot,
        machines: noms.length + e.nonLisibles,
        noms: noms.slice(0, EFFET_MOT_NOMS_MAX),
        nonLisibles: e.nonLisibles,
      };
    });
  }

  /** Enregistrement (If-Match : `attendue`) ; 412 si la version a changé, 422 si la liste est refusée. */
  async ecrire(saisie: unknown, attendue: number, user: SessionUser, ip: string): Promise<ReglageMasqueOut> {
    const p = ReglageMasque.safeParse(saisie);
    if (!p.success)
      throw new HttpError(
        422,
        p.error.issues.map((i) => `${i.path.join('.') || 'réglage'} : ${i.message}`).join(' ; '),
      );
    const r = await this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE, value: JSON.stringify({ values: REGLAGE_MASQUE_DEFAUT, version: 0 }) })
        .onConflict((oc) => oc.doNothing())
        .execute();
      const cur = (
        await k.selectFrom('settings').select('value').where('key', '=', CLE).forUpdate().executeTakeFirstOrThrow()
      ).value as unknown as Ligne;
      const avant = lu(cur).mots;
      const courante = cur.version ?? 0;
      if (courante !== attendue)
        throw new HttpError(412, 'La liste des mots à ne pas masquer a été modifiée par ailleurs. Rechargez-la.', {
          reason: 'conflict',
          current: { values: { mots: avant }, version: courante },
        });
      const version = courante + 1;
      await k
        .updateTable('settings')
        .set({
          value: JSON.stringify({ values: p.data, version, updatedBy: user.username }),
          updated_at: sql<Date>`now()`,
        })
        .where('key', '=', CLE)
        .execute();
      const cles = (l: readonly string[]) => new Set(l.map(cleMotNonMasque));
      const ka = cles(avant);
      const kp = cles(p.data.mots);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.masque.reglage_modifie',
        '',
        {
          ajoutes: p.data.mots.filter((m) => !ka.has(cleMotNonMasque(m))),
          retires: avant.filter((m) => !kp.has(cleMotNonMasque(m))),
          mots: p.data.mots.length,
          version,
        },
        c,
      );
      return { values: p.data, version };
    }, user.username);
    return { ...r, effets: await this.effets(user, r.values.mots) };
  }
}
