/* Module Vulnérabilités (ADR 0100, point 9 ; lot V4a) : réglage de la grille de priorité (seuil du score EPSS), rangé dans
   la table `settings` comme les autres réglages à valeur unique (clé `vulnerabilites:priorite`, { values, version,
   updatedBy }), sans migration. Lecture avec `vulnerabilites:lire` (les écrans affichent la grille), écriture avec
   `vulnerabilites:administrer` et If-Match ; journal `vulnerabilites.priorite.reglage_modifie`. Le calcul lui-même est une
   fonction pure du paquet partagé (calculerPriorite). */
import { REGLAGE_PRIORITE_DEFAUT, ReglagePriorite, type ReglagePrioriteOut } from '@suivi/shared';
import { sql } from 'kysely';
import type { Actor, Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';

const CLE = 'vulnerabilites:priorite';

interface Ligne {
  values: unknown;
  version: number;
  updatedBy?: string;
}

const lu = (l: Ligne | undefined): ReglagePriorite => {
  const p = ReglagePriorite.safeParse({ ...REGLAGE_PRIORITE_DEFAUT, ...((l?.values as object) ?? {}) });
  return p.success ? p.data : { ...REGLAGE_PRIORITE_DEFAUT };
};

export class ReglagePrioriteVulnerabilites {
  constructor(private readonly db: Db) {}

  async lire(): Promise<ReglagePrioriteOut> {
    const r = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    const l = r?.value as Ligne | undefined;
    return { values: lu(l), version: l?.version ?? 0 };
  }

  /** Valeurs courantes, pour le calcul de la priorité. */
  async valeurs(): Promise<ReglagePriorite> {
    return (await this.lire()).values;
  }

  /** Enregistrement (If-Match : `attendue`) ; 412 si la version a changé, 422 si le réglage est invalide. */
  async ecrire(saisie: unknown, attendue: number, user: Actor, ip: string): Promise<ReglagePrioriteOut> {
    const p = ReglagePriorite.safeParse(saisie);
    if (!p.success)
      throw new HttpError(
        422,
        p.error.issues.map((i) => `${i.path.join('.') || 'réglage'} : ${i.message}`).join(' ; '),
      );
    return this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE, value: JSON.stringify({ values: REGLAGE_PRIORITE_DEFAUT, version: 0 }) })
        .onConflict((oc) => oc.doNothing())
        .execute();
      const cur = (
        await k.selectFrom('settings').select('value').where('key', '=', CLE).forUpdate().executeTakeFirstOrThrow()
      ).value as unknown as Ligne;
      const avant = lu(cur);
      const courante = cur.version ?? 0;
      if (courante !== attendue)
        throw new HttpError(412, 'Les seuils de priorité ont été modifiés par ailleurs. Rechargez-les.', {
          reason: 'conflict',
          current: { values: avant, version: courante },
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
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.priorite.reglage_modifie',
        '',
        { avant, apres: p.data, version },
        c,
      );
      return { values: p.data, version };
    }, user.username);
  }
}
