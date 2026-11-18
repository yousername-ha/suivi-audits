/* Flux réseau vers l'extérieur (ADR 0097) : l'API enregistre l'état voulu, décidé par l'administrateur après confirmation
   explicite, et l'état appliqué que l'exécutant d'exploitation rapporte par la CLI. Elle ne reçoit jamais Docker et ne lance
   aucune commande. L'état est relu en base à chaque usage (aucun cache) : un changement vaut sans redémarrer l'API, et la
   CLI de l'exécutant lit la même source. Absence d'enregistrement : flux fermé. */
import {
  FLUX_MODULES,
  FLUX_REPRISE_ACTEUR,
  estFluxRepris,
  FLUX_REPRISE_MOTIFS,
  fluxExterne,
  sensDuFlux,
  type FluxAppliques,
  type FluxEtatApplique,
  type FluxExterneEtat,
  type FluxModule,
  type FluxModuleRepris,
  type FluxRepriseMotif,
  type FluxSouhaites,
  type SettingsValues,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Config } from './config.js';
import type { Actor, Client, Db, Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';

/** Message commun quand un module est bloqué par son flux fermé : il renvoie au geste qui l'ouvre (précision du RSSI du
    15/11/2026 : activer le module ouvre son flux, sans étape séparée). */
export const messageFluxFerme = (m: FluxModule) => {
  const f = fluxExterne(m);
  return `Le flux « ${f.libelle} » vers l’extérieur est fermé : il s’ouvre en activant le module (${f.reglage.libelle} : ${f.activation.geste}), après validation par un administrateur.`;
};

/** Flux voulu ouvert, mais pas encore appliqué par l'exécutant (conteneur de sortie en cours de démarrage) ou en erreur. */
export const messageFluxNonApplique = (m: FluxModule, applique: FluxEtatApplique | null) => {
  const f = fluxExterne(m);
  return applique === 'erreur'
    ? `Le flux « ${f.libelle} » est ouvert, mais l’exécutant d’exploitation du serveur n’a pas pu l’appliquer : l’erreur est indiquée dans Administration, Configuration système, Flux vers l’extérieur.`
    : `Le flux « ${f.libelle} » est ouvert ; l’exécutant d’exploitation du serveur l’applique à son prochain passage (en général moins d’une minute, davantage au premier démarrage).`;
};

interface Ligne {
  module: string;
  ouvert: boolean;
  decide_par: string | null;
  decide_le: Date | null;
  applique: 'ouvert' | 'ferme' | 'erreur' | null;
  applique_le: Date | null;
  erreur: string | null;
}

const versEtat = (module: FluxModule, l: Ligne | undefined): FluxExterneEtat => ({
  module,
  ouvert: l?.ouvert ?? false,
  decidePar: l?.decide_par ?? null,
  decideLe: l?.decide_le?.toISOString() ?? null,
  applique: l?.applique ?? null,
  appliqueLe: l?.applique_le?.toISOString() ?? null,
  erreur: l?.erreur ?? null,
});

export class FluxExternes {
  constructor(private readonly db: Db) {}

  /** État voulu d'un module, relu en base (dans la transaction de l'appelant si elle est donnée). */
  async ouvert(m: FluxModule, k: Kdb = this.db.k): Promise<boolean> {
    const l = await k.selectFrom('flux_externes').select('ouvert').where('module', '=', m).executeTakeFirst();
    return l?.ouvert === true;
  }

  /** État voulu et appliqué d'un module, relu en base. */
  async lire(m: FluxModule, k: Kdb = this.db.k): Promise<FluxExterneEtat> {
    const l = await k.selectFrom('flux_externes').selectAll().where('module', '=', m).executeTakeFirst();
    return versEtat(m, l as Ligne | undefined);
  }

  /** Pourquoi un module à conteneur de sortie ne peut pas encore servir : flux fermé, ou ouvert mais pas encore appliqué
      (ou en erreur) par l'exécutant ; null s'il est ouvert ET appliqué ouvert (lot 2 de l'ADR 0097). */
  async empechement(m: FluxModule): Promise<string | null> {
    const e = await this.lire(m);
    if (!e.ouvert) return messageFluxFerme(m);
    if (e.applique !== 'ouvert') return messageFluxNonApplique(m, e.applique);
    return null;
  }

  /** Démon antivirus à utiliser : celui de la configuration si le flux « antivirus » est ouvert, sinon aucun. */
  async antivirus(av: Config['clamav']): Promise<Config['clamav'] | null> {
    return (await this.ouvert('antivirus')) ? av : null;
  }

  /** Refuse (409) une action qui ferait sortir un flux fermé. */
  async exiger(m: FluxModule, k?: Kdb): Promise<void> {
    if (!(await this.ouvert(m, k))) throw new HttpError(409, messageFluxFerme(m), { reason: 'flux_ferme', module: m });
  }

  /** Tous les modules du registre, dans son ordre, avec leur état voulu et appliqué. */
  async etat(k: Kdb = this.db.k): Promise<FluxExterneEtat[]> {
    const lignes = new Map(
      (await k.selectFrom('flux_externes').selectAll().execute()).map((l) => [l.module, l as Ligne]),
    );
    return FLUX_MODULES.map((m) => versEtat(m, lignes.get(m)));
  }

  /** Ouvre ou ferme un module dans sa propre transaction (route commune, tests). */
  async changer(m: FluxModule, ouvert: boolean, actor: Actor, ip: string, origine = 'flux'): Promise<FluxExterneEtat> {
    return this.db.tx((c, k) => this.decider(c, k, m, ouvert, actor, ip, origine), actor.username);
  }

  /** Activation d'un module dont le flux est fermé (geste « module ») : l'activation exige le droit
      administration:administrer et la validation explicite, puis ouvre le flux dans la transaction de l'appelant, en même
      temps que l'activation elle-même. Flux déjà ouvert : rien à valider. */
  async activer(
    c: Client,
    k: Kdb,
    m: FluxModule,
    o: { confirme: boolean | undefined; administrateur: boolean; actor: Actor; ip: string; origine: string },
  ): Promise<void> {
    if (await this.ouvert(m, k)) return;
    const f = fluxExterne(m);
    if (!o.administrateur)
      throw new HttpError(
        403,
        `Activer ce module ouvre le flux « ${f.libelle} » vers l’extérieur : seul un administrateur peut le valider.`,
        { reason: 'flux_droit', module: m },
      );
    if (o.confirme !== true)
      throw new HttpError(
        409,
        `Activer ce module ouvre le flux « ${f.libelle} » vers l’extérieur : validez d’abord ses destinations et les données qui sortent.`,
        { reason: 'flux_validation', module: m },
      );
    await this.decider(c, k, m, true, o.actor, o.ip, o.origine);
  }

  /** Désactivation du module : son flux est refermé dans la même transaction (sens sûr, sans validation). */
  async desactiver(c: Client, k: Kdb, m: FluxModule, actor: Actor, ip: string, origine: string): Promise<void> {
    if (await this.ouvert(m, k)) await this.decider(c, k, m, false, actor, ip, origine);
  }

  /** Décision dans la transaction de l'appelant. Demander l'état déjà voulu ne change rien et n'écrit rien au journal. */
  async decider(
    c: Client,
    k: Kdb,
    m: FluxModule,
    ouvert: boolean,
    actor: Actor,
    ip: string,
    origine: string,
  ): Promise<FluxExterneEtat> {
    // Verrou de ligne (ou d'insertion) : deux décisions simultanées sur le même module se succèdent.
    await k
      .insertInto('flux_externes')
      .values({ module: m })
      .onConflict((oc) => oc.column('module').doNothing())
      .execute();
    const cur = (await k
      .selectFrom('flux_externes')
      .selectAll()
      .where('module', '=', m)
      .forUpdate()
      .executeTakeFirstOrThrow()) as Ligne;
    if (cur.ouvert === ouvert && cur.decide_par !== null) return versEtat(m, cur);
    const l = (await k
      .updateTable('flux_externes')
      .set({ ouvert, decide_par: actor.username, decide_le: sql<Date>`now()` })
      .where('module', '=', m)
      .returningAll()
      .executeTakeFirstOrThrow()) as Ligne;
    const f = fluxExterne(m);
    await this.db.audit(
      actor,
      ip,
      ouvert ? 'flux.externe.ouvert' : 'flux.externe.ferme',
      m,
      {
        module: m,
        libelle: f.libelle,
        origine,
        sens: sensDuFlux(f),
        destinations: f.destinations.map((d) => ({ sens: d.sens, hote: d.hote, ports: d.ports })),
        porteur: f.porteur.libelle,
      },
      c,
    );
    return versEtat(m, l);
  }

  /** Reprise de l'existant (précision du RSSI du 16/11/2026 : « une mise à jour de l'interface ne peut pas enlever le flux
      ouvert ») : chaque module réellement en service et encore jamais décidé (aucune ligne, ou une ligne sans décision, que
      l'état appliqué seul a créée) est enregistré ouvert par l'acteur système FLUX_REPRISE_ACTEUR, avec son motif, au journal
      `flux.externe.repris`. Un module déjà décidé, ouvert ou fermé, n'est jamais touché. Rend les modules repris. */
  async reprendre(
    enService: Partial<{ [M in FluxModuleRepris]: FluxRepriseMotif<M> }>,
    origine: string,
  ): Promise<FluxModule[]> {
    const repris: FluxModule[] = [];
    const acteur = { username: FLUX_REPRISE_ACTEUR };
    await this.db.tx(async (c, k) => {
      // Les flux nés avec le registre (FLUX_SANS_REPRISE) n'ont rien à reprendre : ils ne sont jamais parcourus ici.
      for (const m of FLUX_MODULES.filter(estFluxRepris)) {
        const motif = enService[m];
        if (!motif) continue;
        const motifs: Record<string, string> = FLUX_REPRISE_MOTIFS[m];
        if (!(motif in motifs)) throw new Error(`Motif de reprise inconnu pour ${m}.`);
        await k
          .insertInto('flux_externes')
          .values({ module: m })
          .onConflict((oc) => oc.column('module').doNothing())
          .execute();
        const cur = await k
          .selectFrom('flux_externes')
          .select('decide_par')
          .where('module', '=', m)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (cur.decide_par !== null) continue;
        await k
          .updateTable('flux_externes')
          .set({ ouvert: true, decide_par: FLUX_REPRISE_ACTEUR, decide_le: sql<Date>`now()` })
          .where('module', '=', m)
          .execute();
        const f = fluxExterne(m);
        await this.db.audit(
          acteur,
          null,
          'flux.externe.repris',
          m,
          {
            module: m,
            libelle: f.libelle,
            origine,
            motif,
            raison: motifs[motif],
            sens: sensDuFlux(f),
            destinations: f.destinations.map((d) => ({ sens: d.sens, hote: d.hote, ports: d.ports })),
            porteur: f.porteur.libelle,
          },
          c,
        );
        repris.push(m);
      }
    }, FLUX_REPRISE_ACTEUR);
    return repris;
  }

  /** Reprise du courriel, constatée par l'API elle-même au démarrage : envoi actif dans les réglages et serveur SMTP renseigné. */
  async reprendreCourriel(courriel: Pick<SettingsValues['courriel'], 'actif' | 'hote'>): Promise<FluxModule[]> {
    if (courriel.actif !== true || !courriel.hote.trim()) return [];
    return this.reprendre({ courriel: 'envoi-actif' }, 'demarrage');
  }

  /** CLI de l'exécutant : modules voulus ouverts. */
  async souhaites(): Promise<FluxSouhaites> {
    return { ouverts: (await this.etat()).filter((e) => e.ouvert).map((e) => e.module) };
  }

  /** CLI de l'exécutant : état appliqué de chaque module rapporté (entrée déjà validée par FluxAppliques). Seul un
      changement d'état appliqué est inscrit au journal (l'exécutant rapporte à chaque passage). */
  async appliquer(rapport: FluxAppliques): Promise<FluxExterneEtat[]> {
    await this.db.tx(async (c, k) => {
      for (const m of FLUX_MODULES) {
        const r = rapport[m];
        if (!r) continue;
        const erreur = r.etat === 'erreur' ? (r.erreur ?? null) : null;
        const avant = await k
          .selectFrom('flux_externes')
          .select(['applique', 'erreur'])
          .where('module', '=', m)
          .forUpdate()
          .executeTakeFirst();
        await k
          .insertInto('flux_externes')
          .values({ module: m, applique: r.etat, applique_le: sql<Date>`now()`, erreur })
          .onConflict((oc) =>
            oc.column('module').doUpdateSet({ applique: r.etat, applique_le: sql<Date>`now()`, erreur }),
          )
          .execute();
        if (avant?.applique !== r.etat || (avant?.erreur ?? null) !== erreur)
          await this.db.audit(
            { username: 'exploitation serveur' },
            null,
            'flux.externe.applique',
            m,
            { module: m, etat: r.etat, ...(erreur ? { erreur } : {}) },
            c,
          );
      }
    });
    return this.etat();
  }
}
