/* Porte de lecture autorisée (ADR 0083). Toute donnée d'un module qui sort de ce module (réponse HTTP, export, agrégat,
   copie dans un autre module) doit être lue à travers une portée de lecture, calculée pour le lecteur : droit de module,
   périmètre, registre restreint et rôle attribué.

   Cette classe NE REMPLACE PAS les primitives du module GRC : elle les compose (isAdmin, visible, listSmsis,
   registres.inaccessiblesPartout, resolve, redactLegacy) et en met les résultats en cache pour la durée de la portée. Une
   portée est créée par requête et pour un seul lecteur ; elle ne doit pas être conservée entre deux requêtes (les droits
   et les périmètres peuvent changer). Les administrateurs gardent leur comportement : ils contournent les masques.

   Choix de prudence : en cas de doute, la porte masque plutôt que de révéler. Un élément d'un registre dont le périmètre de
   référence n'est pas lisible est donc masqué par `filtrerObjets`, même si le lecteur y tient un rôle attribué ; la lecture
   unitaire (`Grc.object`) reste la référence pour ce cas. */
import { GRC_MODULES, type GrcKind, type Module } from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import { sql, type SelectQueryBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import type { DB } from '../db/types.generated.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from '../grc/core.js';
import { redactLegacy } from '../legacy/redaction.js';

export interface EtatHistoriqueRedige {
  version: number;
  data: JsonObject;
}

const TOUS_LES_TYPES = Object.keys(GRC_MODULES) as GrcKind[];

export class PorteeLecture {
  private admin?: Promise<boolean>;
  private masques?: Promise<ReadonlySet<string>>;
  private perimetres?: Promise<ReadonlySet<string>>;
  private readonly modulesActifs = new Map<Module, Promise<boolean>>();
  private readonly lisibles = new Map<string, Promise<boolean>>();
  private readonly masquesParPerimetre = new Map<string, Promise<string[]>>();

  private constructor(
    readonly g: Grc,
    readonly user: SessionUser,
  ) {}

  /** Portée de lecture d'un lecteur, à créer une fois par requête. */
  static pour(g: Grc, user: SessionUser): PorteeLecture {
    return new PorteeLecture(g, user);
  }

  /** Vrai pour un administrateur : il contourne les masques de périmètres et de registres. */
  estAdmin(): Promise<boolean> {
    this.admin ??= this.g.isAdmin(this.user);
    return this.admin;
  }

  /** Droit de lecture sur le module, et module activé. Aucune exception : la porte répond par un booléen. */
  peutLireModule(module: Module): Promise<boolean> {
    let r = this.modulesActifs.get(module);
    if (!r) {
      r = (async () => {
        if (!this.user.rights.can(module, 'lire')) return false;
        try {
          await this.g.modules.assert(module);
          return true;
        } catch (e) {
          if (e instanceof HttpError) return false;
          throw e;
        }
      })();
      this.modulesActifs.set(module, r);
    }
    return r;
  }

  /** Périmètres que le lecteur peut ouvrir (instance, membre ou administrateur). */
  perimetresLisibles(): Promise<ReadonlySet<string>> {
    this.perimetres ??= this.g.listSmsis(this.user).then((l) => new Set(l.map((s) => s.id)));
    return this.perimetres;
  }

  /** Le périmètre est-il lisible (et, si un module est donné, ce module aussi) ? */
  async perimetreLisible(smsi: string, module?: Module): Promise<boolean> {
    if (module && !(await this.peutLireModule(module))) return false;
    return (await this.perimetresLisibles()).has(smsi);
  }

  /** Registres restreints que le lecteur ne peut pas lire, tous périmètres confondus (vide pour un administrateur). */
  registresMasques(): Promise<ReadonlySet<string>> {
    this.masques ??= this.g.registres.inaccessiblesPartout(this.user).then((l) => new Set(l));
    return this.masques;
  }

  /** Types d'objets GRC dont le module est lisible par le lecteur. */
  async typesLisibles(): Promise<GrcKind[]> {
    const out: GrcKind[] = [];
    for (const kind of TOUS_LES_TYPES) if (await this.peutLireModule(GRC_MODULES[kind])) out.push(kind);
    return out;
  }

  /** Prédicat synchrone de lecture d'un objet déjà chargé (module du type lisible, registre non masqué), pour filtrer des
      objets relus par identifiant sans refaire les calculs à chaque objet. Le périmètre n'est pas contrôlé ici : l'appelant
      a déjà borné sa requête à un périmètre dont il a vérifié l'accès. */
  async predicatObjet(): Promise<(o: { kind: GrcKind; registre_id: string | null }) => boolean> {
    const types = new Set(await this.typesLisibles());
    const masques = await this.registresMasques();
    return (o) => types.has(o.kind) && !(o.registre_id && masques.has(o.registre_id));
  }

  /** Ajoute à une requête Kysely sur `grc_objects` les conditions de lecture du lecteur : module du type, périmètre
      lisible, registre non masqué. La requête reste à la charge de l'appelant pour tout le reste (archivage, recherche,
      pagination). Valeurs liées uniquement, aucune expression SQL brute. */
  async filtrerObjets<O>(
    qb: SelectQueryBuilder<DB, 'grc_objects', O>,
  ): Promise<SelectQueryBuilder<DB, 'grc_objects', O>> {
    const types = await this.typesLisibles();
    const perimetres = [...(await this.perimetresLisibles())];
    if (!types.length || !perimetres.length) return qb.where(sql<boolean>`false`);
    let q = qb.where('kind', 'in', types).where('smsi_id', 'in', perimetres);
    const masques = [...(await this.registresMasques())];
    if (masques.length)
      q = q.where((eb) => eb.or([eb('registre_id', 'is', null), eb('registre_id', 'not in', masques)]));
    return q;
  }

  /** Registres restreints rattachés à ce périmètre que le lecteur ne peut pas lire : leurs éléments sont exclus des listes,
      des compteurs et des exports de ce périmètre (vide pour un administrateur). Dans une transaction (`c`), le calcul suit la
      transaction et n'est pas mis en cache. */
  masquesDuPerimetre(smsi: string, c?: Client): Promise<string[]> {
    if (c) return this.g.registres.inaccessibles(this.user, smsi, c);
    let r = this.masquesParPerimetre.get(smsi);
    if (!r) {
      r = this.g.registres.inaccessibles(this.user, smsi);
      this.masquesParPerimetre.set(smsi, r);
    }
    return r;
  }

  /** La référence se résout-elle avec les droits du lecteur dans ce périmètre ? Faux si elle est illisible, absente ou
      hors périmètre. Une erreur qui n'est pas un refus d'accès (HttpError) est propagée. */
  refLisible(smsi: string, ref: string): Promise<boolean> {
    const cle = smsi + '\u0000' + ref;
    let r = this.lisibles.get(cle);
    if (!r) {
      r = this.resoudreSiLisible(smsi, ref).then((x) => x !== null);
      this.lisibles.set(cle, r);
    }
    return r;
  }

  /** Référence résolue avec les droits du lecteur (nom, version, module…), `null` si elle est illisible, absente ou supprimée. */
  async resoudreSiLisible(smsi: string, ref: string): Promise<Awaited<ReturnType<Grc['resolve']>> | null> {
    try {
      return await this.g.resolve(smsi, ref, this.user);
    } catch (e) {
      if (e instanceof HttpError) return null;
      throw e;
    }
  }

  /** Nom de l'élément référencé s'il est lisible par le lecteur, `null` sinon (illisible, absent ou supprimé). */
  async nomSiLisible(smsi: string, ref: string): Promise<string | null> {
    return (await this.resoudreSiLisible(smsi, ref))?.name ?? null;
  }

  /** État historique déjà rédigé pour le lecteur : les clés d'un module qu'il ne peut pas lire sont vidées. `null` si le
      registre historique n'existe pas encore. */
  async etatHistoriqueSiPresent(): Promise<EtatHistoriqueRedige | null> {
    const etat = await this.g.legacy.recompose();
    return etat ? { version: etat.version, data: redactLegacy(etat.data, this.user.rights) } : null;
  }

  /** Comme `etatHistoriqueSiPresent`, avec un état vide (version 0) quand le registre n'existe pas encore. */
  async etatHistorique(): Promise<EtatHistoriqueRedige> {
    return (await this.etatHistoriqueSiPresent()) ?? { version: 0, data: {} };
  }
}
