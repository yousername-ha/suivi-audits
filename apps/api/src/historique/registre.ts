/* Reprise des modules de l'outil de suivi historique dans la nouvelle interface, sans copie : les données restent dans
   l'état historique (`app_state`), l'écran natif les lit et les modifie sous verrou, avec journal d'audit et notification
   temps réel. /legacy continue d'afficher les mêmes données (même source, aucune migration). Modèle des fournisseurs
   (ADR 0032) : registre historique + écran natif. */
import type { Module } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';

export interface EtatHistorique {
  version: number;
  data: JsonObject;
}

export class RegistreHistorique {
  constructor(readonly g: Grc) {}

  /** Lit l'état historique (modules repris compris) après contrôle du droit de lecture. */
  async lire(user: SessionUser, module: Module): Promise<EtatHistorique> {
    await this.g.permission(user, module, 'lire');
    const etat = await this.g.legacy.recompose();
    return etat ?? { version: 0, data: {} };
  }

  /** Modifie l'état historique sous verrou : `appliquer` reçoit une copie de l'état et retourne le résultat à renvoyer.
      L'écriture refuse toute modification d'un module repris dans des tables (cartographie) et échoue si l'état a changé
      entre-temps. Journal d'audit et notification temps réel inclus. */
  async modifier<T>(
    user: SessionUser,
    ip: string,
    cible: { module: Module; action: string; reference: (resultat: T) => string; droits?: Module[] },
    appliquer: (data: JsonObject, c: Client) => T | Promise<T>,
  ): Promise<T> {
    await this.g.permission(user, cible.module, 'modifier');
    for (const m of cible.droits ?? []) await this.g.permission(user, m, 'modifier');
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      const etat = await this.g.legacy.recompose(c);
      if (!etat) throw new HttpError(409, 'Registre historique indisponible.');
      const data: JsonObject = { ...etat.data };
      const resultat = await appliquer(data, c);
      const r = await this.g.legacy.legacyWrite(c, data, user, etat.version);
      if (r.conflict) throw new HttpError(412, 'Les données historiques ont changé. Rechargez avant de modifier.');
      const ref = cible.reference(resultat);
      await this.g.db.audit(user, ip, cible.action, ref, { version: r.version }, c);
      await this.g.notify(c, ref, r.version, DEFAULT_SMSI, cible.module, user.username);
      return resultat;
    }, user.username);
  }
}

/** Entrées objet d'une clé tableau de l'état (les autres valeurs sont ignorées, jamais supprimées à la relecture). */
export function entrees(data: JsonObject, cle: string): JsonObject[] {
  return (Array.isArray(data[cle]) ? (data[cle] as unknown[]) : []).filter(isObject);
}
/** Remplace une entrée de la clé tableau, en conservant les valeurs non objet à leur place. */
export function remplacerEntree(data: JsonObject, cle: string, id: string, suivante: JsonObject | null): JsonObject[] {
  const liste = Array.isArray(data[cle]) ? (data[cle] as unknown[]) : [];
  const out = liste.flatMap((x) => (isObject(x) && x.id === id ? (suivante ? [suivante] : []) : [x])) as JsonObject[];
  data[cle] = out;
  return out;
}
