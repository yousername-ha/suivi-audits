/* Objectifs, indicateurs et processus du Pilotage : création, modification, suppression et mesures, directement dans
   l'état de l'outil de suivi (aucune copie), sous verrou et avec le journal d'audit. Mêmes identifiants et mêmes règles que
   l'outil historique (PR1, OBJ1, IND1 ; suppression d'un objectif = suppression de ses indicateurs). Aucune valeur n'est
   inventée : les champs ISO 9001 (4.4.1, 6.2.2, 9.1.1) restent vides tant qu'ils ne sont pas saisis. */
import {
  GRC_MODULES,
  IndicateurBody,
  ObjectifBody,
  ProcessusBody,
  ValeurIndicateurBody,
  analyserValeurIndicateur,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';

type Cle = 'processes' | 'objectives' | 'indicators';
const PREFIXE: Record<Cle, string> = { processes: 'PR', objectives: 'OBJ', indicators: 'IND' };
const NOM_PAR_DEFAUT: Record<Cle, string> = {
  processes: 'Nouveau processus',
  objectives: 'Nouvel objectif',
  indicators: 'Nouvel indicateur',
};
const LIBELLE: Record<Cle, string> = { processes: 'Processus', objectives: 'Objectif', indicators: 'Indicateur' };
const liste = (state: JsonObject, cle: Cle): JsonObject[] =>
  (Array.isArray(state[cle]) ? (state[cle] as unknown[]) : []).filter(isObject);

export class PilotageObjectifs {
  constructor(private readonly g: Grc) {}

  private async ouvrir(smsi: string, user: SessionUser, c: Client) {
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    await this.g.access(smsi, user, true, c);
    await this.g.permission(user, GRC_MODULES.indicator, 'modifier');
    await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
    const state = await this.g.legacy.recompose(c);
    if (!state) throw new HttpError(409, 'Registre historique indisponible.');
    return state;
  }
  private async enregistrer(
    c: Client,
    state: { data: JsonObject; version: number },
    user: SessionUser,
    ip: string,
    action: string,
    ref: string,
  ) {
    const r = await this.g.legacy.legacyWrite(c, state.data, user, state.version);
    if (r.conflict) throw new HttpError(412, 'Le registre a changé. Rechargez avant de modifier.');
    await this.g.db.audit(user, ip, action, ref, { version: r.version }, c);
    await this.g.notify(c, ref, r.version, DEFAULT_SMSI, GRC_MODULES.indicator, user.username);
    return r.version;
  }
  /** Les champs écrits ici l'emportent sur une copie ancienne de la fiche native (`pilotage`) : on la tient à jour. */
  private ecrire(raw: JsonObject, patch: Record<string, unknown>, actor: string): JsonObject {
    const suivant: JsonObject = { ...raw, updatedAt: new Date().toISOString(), updatedBy: actor };
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) suivant[k] = v as never;
    if (isObject(raw.pilotage)) {
      const pilotage = { ...raw.pilotage } as JsonObject;
      for (const k of Object.keys(patch)) delete pilotage[k];
      suivant.pilotage = pilotage;
    }
    return suivant;
  }
  /** Références valides : objectif existant pour un indicateur, processus existants pour un objectif ou un indicateur. */
  private verifier(state: JsonObject, cle: Cle, body: Record<string, unknown>) {
    if (
      cle === 'indicators' &&
      typeof body.obj === 'string' &&
      !liste(state, 'objectives').some((o) => o.id === body.obj)
    )
      throw new HttpError(422, 'Objectif inconnu.');
    if (cle !== 'processes' && Array.isArray(body.processes)) {
      const connus = new Set(liste(state, 'processes').map((p) => p.id));
      if ((body.processes as string[]).some((p) => !connus.has(p))) throw new HttpError(422, 'Processus inconnu.');
    }
  }
  private corps(cle: Cle, input: unknown) {
    return (cle === 'processes' ? ProcessusBody : cle === 'objectives' ? ObjectifBody : IndicateurBody).parse(input);
  }

  async creer(smsi: string, cle: Cle, input: unknown, user: SessionUser, ip: string) {
    const body = this.corps(cle, input) as Record<string, unknown>;
    return this.g.db.tx(async (c) => {
      const state = await this.ouvrir(smsi, user, c);
      const lignes = liste(state.data, cle);
      if (cle === 'indicators') {
        const objectifs = liste(state.data, 'objectives');
        if (!objectifs.length) throw new HttpError(422, 'Créez d’abord un objectif.');
        body.obj = typeof body.obj === 'string' ? body.obj : String(objectifs[0]!.id);
      }
      this.verifier(state.data, cle, body);
      let k = 1;
      while (lignes.some((r) => r.id === PREFIXE[cle] + k)) k++;
      const id = PREFIXE[cle] + k;
      const base: JsonObject = { id, createdAt: new Date().toISOString(), name: NOM_PAR_DEFAUT[cle] };
      if (cle === 'processes') Object.assign(base, { owner: '' });
      if (cle === 'objectives') Object.assign(base, { due: '', owner: '', processes: [], enjeux: [] });
      if (cle === 'indicators') Object.assign(base, { obj: body.obj, target: '', dir: '', values: [] });
      const ligne = this.ecrire(base, body, user.username);
      state.data[cle] = [...lignes, ligne];
      await this.enregistrer(c, state, user, ip, `pilotage.${cle}.created`, `legacy:${cle}:${id}`);
      return { id, ref: `legacy:${cle}:${id}` };
    }, user.username);
  }

  async modifier(smsi: string, cle: Cle, id: string, input: unknown, user: SessionUser, ip: string) {
    const body = this.corps(cle, input) as Record<string, unknown>;
    if (!Object.keys(body).length) throw new HttpError(422, 'Aucune modification.');
    return this.g.db.tx(async (c) => {
      const state = await this.ouvrir(smsi, user, c);
      const lignes = liste(state.data, cle);
      const avant = lignes.find((r) => r.id === id);
      if (!avant) throw new HttpError(404, `${LIBELLE[cle]} introuvable.`);
      this.verifier(state.data, cle, body);
      const patch = { ...body };
      state.data[cle] = lignes.map((r) => (r === avant ? this.ecrire(r, patch, user.username) : r));
      await this.enregistrer(c, state, user, ip, `pilotage.${cle}.updated`, `legacy:${cle}:${id}`);
      return { id, ref: `legacy:${cle}:${id}` };
    }, user.username);
  }

  /** Suppression : un objectif emporte ses indicateurs ; un processus est retiré des objectifs et des indicateurs. */
  async supprimer(smsi: string, cle: Cle, id: string, user: SessionUser, ip: string) {
    return this.g.db.tx(async (c) => {
      const state = await this.ouvrir(smsi, user, c);
      const lignes = liste(state.data, cle);
      const cible = lignes.find((r) => r.id === id);
      if (!cible) throw new HttpError(404, `${LIBELLE[cle]} introuvable.`);
      let indicateursSupprimes = 0;
      state.data[cle] = lignes.filter((r) => r !== cible);
      if (cle === 'objectives') {
        const indicateurs = liste(state.data, 'indicators');
        indicateursSupprimes = indicateurs.filter((i) => i.obj === id).length;
        state.data.indicators = indicateurs.filter((i) => i.obj !== id);
      }
      if (cle === 'processes') {
        state.data.objectives = liste(state.data, 'objectives').map((o) =>
          Array.isArray(o.processes) && o.processes.includes(id)
            ? { ...o, processes: o.processes.filter((p) => p !== id) }
            : o,
        );
        state.data.indicators = liste(state.data, 'indicators').map((i) =>
          Array.isArray(i.processes) && i.processes.includes(id)
            ? { ...i, processes: i.processes.filter((p) => p !== id) }
            : i,
        );
      }
      await this.enregistrer(c, state, user, ip, `pilotage.${cle}.deleted`, `legacy:${cle}:${id}`);
      return { id, indicateursSupprimes };
    }, user.username);
  }

  async ajouterValeur(smsi: string, id: string, input: unknown, user: SessionUser, ip: string) {
    const body = ValeurIndicateurBody.parse(input);
    return this.g.db.tx(async (c) => {
      const state = await this.ouvrir(smsi, user, c);
      const lignes = liste(state.data, 'indicators');
      const ind = lignes.find((r) => r.id === id);
      if (!ind) throw new HttpError(404, 'Indicateur introuvable.');
      if (ind.calc && ind.auto !== false)
        throw new HttpError(
          422,
          'Cet indicateur est calculé automatiquement : sa valeur ne se saisit pas manuellement.',
        );
      const v = analyserValeurIndicateur(ind, body.value);
      if (v === null) throw new HttpError(422, 'Saisissez une valeur.');
      const valeurs = Array.isArray(ind.values) ? ind.values : [];
      const entree: JsonObject = { date: body.date, v, note: body.note, createdAt: new Date().toISOString() };
      if (body.hist) entree.hist = body.hist;
      state.data.indicators = lignes.map((r) =>
        r === ind ? this.ecrire(r, { values: [...valeurs, entree] }, user.username) : r,
      );
      await this.enregistrer(c, state, user, ip, 'pilotage.indicators.value-added', `legacy:indicators:${id}`);
      return { id, valeur: v };
    }, user.username);
  }

  async supprimerValeur(smsi: string, id: string, rang: number, user: SessionUser, ip: string) {
    return this.g.db.tx(async (c) => {
      const state = await this.ouvrir(smsi, user, c);
      const lignes = liste(state.data, 'indicators');
      const ind = lignes.find((r) => r.id === id);
      if (!ind) throw new HttpError(404, 'Indicateur introuvable.');
      const valeurs = Array.isArray(ind.values) ? ind.values : [];
      if (rang < 0 || rang >= valeurs.length) throw new HttpError(404, 'Valeur introuvable.');
      state.data.indicators = lignes.map((r) =>
        r === ind ? this.ecrire(r, { values: valeurs.filter((_, k) => k !== rang) }, user.username) : r,
      );
      await this.enregistrer(c, state, user, ip, 'pilotage.indicators.value-deleted', `legacy:indicators:${id}`);
      return { id };
    }, user.username);
  }
}
