/* Module Vulnérabilités (ADR 0100, lot ALH1) : surface externe lue dans AlgoLightHouse (ALH, éditeur AlgoSecure), en lecture
   seule. L'opération « synchroniser » du connecteur « algolighthouse » (module Intégrations, ADR 0076) est inscrite par le tic
   quotidien ou par « Synchroniser maintenant », réclamée par l'exécutant (`suivi integrations-claim`), qui lance le script
   isolé scripts/integration-http.py (par le mandataire de l'établissement s'il est actif, ADR 0101) puis rapporte les
   éléments par lots bornés (`suivi integrations-lot`) et termine (`suivi integrations-finish`). Modèle suivi : Tenable
   (tenable.ts).
   - Chaque élément est validé par son schéma (packages/shared/src/surface-externe.ts) ; un seul refus fait refuser le lot.
     Rangement sans doublon : périmètre, actif, alerte et technologie par (instance, identifiant chez l'éditeur) ; les
     actifs et les CVE d'une technologie sont remplacés quand elle est relue ; les CVE d'une alerte, quand son détail l'est.
   - Présence : comme pour Tenable, seule une synchronisation complète fait avancer le numéro de référence ; un élément plus
     ancien n'est plus listé, rien n'est supprimé.
   - Droits (décision du RSSI) : tout ce qui vient d'un périmètre ALH relié à un périmètre de la plateforme hérite de ce
     périmètre pour la lecture (pyramide des ADR 0092 et 0095, grc_smsi_visible) ; un périmètre ALH non relié n'est lisible
     qu'avec vulnerabilites:administrer. Une technologie se lit par ses actifs (un actif inconnu : administrer). Relier un
     périmètre demande administrer (route), l'écriture sur le périmètre actuel et sur le périmètre visé, If-Match.
   Journal `vulnerabilites.surface.*` : identifiants internes et nombres seulement, jamais une adresse ni un domaine.
   Accès aux données en Kysely (ADR 0062).
   Lot ALH2 (décisions du RSSI du 17/11/2026) :
   - A : défauts et résolutions de l'éditeur rangés avec l'alerte (texte simple, liste blanche), rendus dans sa fiche ;
   - B : une CVE portée par un actif exposé est une faille présente chez nous (présence « exposée ») ; sa priorité est
     calculée par la grille commune avec toutes les sources (AlgoLightHouse en est une, pour ce que la personne lit) ;
     alertes et technologies se trient par priorité ; une technologie est rapprochée des produits surveillés par la règle
     du rapprochement des CVE (indication, sans décision) ; la veille montre sur combien d'actifs lisibles une CVE est vue ;
   - C : lecture pour l'assistant (exposition d'une CVE) et liste des actifs à masquer (domaines et adresses), utilisées par
     le service de l'assistant (assistant.ts), qui ne remet au modèle que des repères (« E-001 ») et des compteurs.
   Lot ALH3 : la fin d'une synchronisation reçue recalcule les propositions de liaison des actifs aux machines internes
   (liaisons-machines.ts) ; la liste des actifs porte leurs machines internes lisibles et se filtre par leur état.
   Lot ALH4 : graphe de la carte « Lignes d'approche » (actifs, alertes ouvertes, machines reliées), lu par les mêmes règles
   de droits, borné ; la mise en page est faite par l'interface.
   Lot ALH5 (décisions du RSSI du 17/11/2026) :
   - A : la priorité d'une alerte, d'une technologie et de leurs CVE est calculée sur tous les faits connus de la plateforme,
     la même pour tout le monde ; les lignes rendues (alertes, actifs, technologies, versions détaillées, comptes d'actifs)
     restent filtrées par les droits ;
   - B : une alerte ouverte ou une technologie dont l'actif mène, par une liaison confirmée, à une machine interne
     vulnérable monte d'un cran (majorerPriorite, majoration.ts), sans nommer la machine.
   Lot ALH6 (décision du RSSI du 17/11/2026) : services exposés (port, protocole, produit) lus dans les fragments du détail
   d'une alerte, rangés sur l'actif visé (services-surface.ts) et rendus avec la carte, la liste et la fiche des actifs et
   la fiche d'une alerte, sous les droits de lecture de l'actif ; aucun effet sur la priorité.
   Lot SI1 : la liste « Actifs » est commune à AlgoLightHouse et à Silène (surface-silene.ts) : un actif est identifié par
   son adresse IP ou son nom de domaine ; vu par les deux sources, il n'apparaît qu'une fois, avec ce que chacune en dit. */
import {
  type ActifSileneDto,
  type ActifSurfaceDto,
  type AlerteAlhDto,
  type AlerteCarteDto,
  BilanSynchronisationAlh,
  CARTE_SURFACE_BORNES,
  type CarteSurfaceDto,
  calculerPriorite,
  type CveAlerteAlhDto,
  majorerPriorite,
  DefautsAlh,
  type DefautAlh,
  faitsDepuisSources,
  type FicheAlerteAlhDto,
  memeVersionDetectee,
  type Presence,
  type Priorite,
  prioriteLaPlusHaute,
  type ProduitRapprocheAlhDto,
  rangPriorite,
  rapprochementTechnologie,
  type SourcesFailleDto,
  type SurfaceCveDto,
  type TechnologieRapprocheeDto,
  type CriticiteAlh,
  type CveTechnologieAlhDto,
  type ElementAlerteAlh,
  type ElementDomaineAlh,
  type ElementHoteAlh,
  type ElementPerimetreAlh,
  ElementSurfaceExterne,
  type ElementTechnologieActifAlh,
  type ElementTechnologieAlh,
  type ElementTechnologieCveAlh,
  echeanceAtteinte,
  frequenceConnecteur,
  type EtatSurfaceExterneDto,
  prochaineAffichee,
  referenceApresDemande,
  LiaisonPerimetreAlh,
  LotSynchronisation,
  ALH_BORNES,
  type PageSurface,
  type PerimetreAlhDto,
  type RechercheActifsAlh,
  type RechercheAlertesAlh,
  type RechercheTechnologiesAlh,
  SERVICES_PAR_ACTIF_MAX,
  STATUTS_ALERTE_ALH_OUVERTS,
  type StatutActifAlh,
  type StatutAlerteAlh,
  SURFACE_PAR_PAGE,
  type TechnologieAlhDto,
  type TypeActifAlh,
  type TypeAlerteAlh,
  type TypeCibleAlh,
  type VersionTechnologieAlhDto,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { FluxExternes } from '../flux-externes.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { type Integrations, type OperationEnLots, verrouFileIntegrations } from '../integrations/index.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { filtreLiaison, liaisonsCarte, resumesLiaisons } from './liaisons-machines.js';
import { actifsMenantAUneMachineVulnerable } from './majoration.js';
import { rangerServicesAlertes, sansAlertes, servicesDeLAlerte, servicesDesActifs } from './services-surface.js';
import { lireFaitsCve, sourcesDe } from './sources.js';
import { cvesAlh, lisibleAlh } from './sql.js';
import { cleActif, type SurfaceSilene } from './surface-silene.js';

const TYPE = 'algolighthouse';
const PLANIFICATION = { username: 'planification' };
const EXECUTANT = { username: 'exécutant serveur' };
const iso = (d: Date | null) => d?.toISOString() ?? null;
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
/** Motif ILIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const OUVERTS = [...STATUTS_ALERTE_ALH_OUVERTS];

/** Dernier élément de chaque clé (un même identifiant ne peut pas être mis à jour deux fois par la même requête). */
function dernierParCle<T>(elements: T[], cle: (e: T) => string): T[] {
  return [...new Map(elements.map((e) => [cle(e), e])).values()];
}

/** Élément du périmètre ALH (alias fermé `lp` ou `lp2`) lisible : périmètre relié visible, ou non relié avec administrer. */
const lisible = lisibleAlh;
/** Élément (alias fermé) vu par la dernière synchronisation complète de son instance (alias `e`), ou plus récemment. */
const present = (alias: 'a' | 'x' | 't' | 'lp' | 'a2'): RawBuilder<boolean> =>
  sql<boolean>`(${sql.ref(`${alias}.vu_numero`)} >= coalesce(e.numero_complet, 0))`;

export class SurfaceExterneAlh implements OperationEnLots {
  /** Lot ALH3 : propositions de liaison entre actifs exposés et machines internes, recalculées dans la transaction de la fin
      d'une synchronisation reçue. */
  apresSynchronisation?: (k: Kdb, c: Client) => Promise<void>;
  /** Lot SI1 : surface externe importée de Silène, réunie avec AlgoLightHouse dans la liste « Actifs » (branchée par
      services.ts). */
  silene?: SurfaceSilene;

  constructor(
    private readonly db: Db,
    private readonly flux: FluxExternes,
    private readonly integrations: Integrations,
    private readonly g: Grc,
    private readonly reglage: ReglagePrioriteVulnerabilites,
  ) {}

  /* ---------------------------------------------------------------- Réception (CLI de l'exécutant) */
  async reclamee(k: Kdb, executionId: string, integrationId: string): Promise<void> {
    await k
      .insertInto('vulnerabilites_alh_etat')
      .values({ integration_id: integrationId })
      .onConflict((oc) => oc.column('integration_id').doNothing())
      .execute();
    const { numero } = await k
      .updateTable('vulnerabilites_alh_etat')
      .set((eb) => ({ numero: eb('numero', '+', 1) }))
      .where('integration_id', '=', integrationId)
      .returning('numero')
      .executeTakeFirstOrThrow();
    await k
      .insertInto('vulnerabilites_alh_synchronisations')
      .values({ execution_id: executionId, integration_id: integrationId, numero })
      .execute();
  }

  async lot(k: Kdb, executionId: string, brut: unknown[]): Promise<{ elements: number; lots: number }> {
    const { elements } = LotSynchronisation.parse({ elements: brut });
    const s = await k
      .selectFrom('vulnerabilites_alh_synchronisations')
      .select(['integration_id', 'numero', 'lots'])
      .where('execution_id', '=', executionId)
      .forUpdate()
      .executeTakeFirst();
    if (!s) throw new HttpError(409, 'Synchronisation absente.');
    if (s.lots >= ALH_BORNES.lots) throw new HttpError(409, 'Nombre de lots dépassé pour cette synchronisation.');
    const valides: ElementSurfaceExterne[] = [];
    elements.forEach((e, i) => {
      const v = ElementSurfaceExterne.safeParse(e);
      if (!v.success)
        throw new HttpError(
          422,
          `Élément ${i + 1} du lot refusé (${v.error.issues[0]?.message ?? 'forme inattendue'}).`,
        );
      valides.push(v.data);
    });
    const de = <T extends ElementSurfaceExterne['type']>(t: T) =>
      valides.filter((e): e is Extract<ElementSurfaceExterne, { type: T }> => e.type === t);
    // Ordre : périmètres et actifs, alertes, technologies, puis les liens et CVE qui se réfèrent aux technologies.
    await this.rangerPerimetres(k, s.integration_id, s.numero, de('perimetre'));
    await this.rangerHotes(k, s.integration_id, s.numero, de('hote'));
    await this.rangerDomaines(k, s.integration_id, s.numero, de('domaine'));
    await this.rangerAlertes(k, s.integration_id, s.numero, de('alerte'));
    await this.rangerTechnologies(k, s.integration_id, s.numero, de('technologie'));
    await this.rangerLiens(k, s.integration_id, de('technologie_actif'));
    await this.rangerCves(k, s.integration_id, de('technologie_cve'));
    const r = await k
      .updateTable('vulnerabilites_alh_synchronisations')
      .set((eb) => ({ lots: eb('lots', '+', 1), elements: eb('elements', '+', valides.length) }))
      .where('execution_id', '=', executionId)
      .returning(['lots', 'elements'])
      .executeTakeFirstOrThrow();
    return { elements: r.elements, lots: r.lots };
  }

  async terminee(
    k: Kdb,
    c: Client,
    executionId: string,
    resultat: Record<string, unknown> | null,
  ): Promise<string | null> {
    const s = await k
      .selectFrom('vulnerabilites_alh_synchronisations')
      .select(['integration_id', 'numero', 'elements', 'lots'])
      .where('execution_id', '=', executionId)
      .forUpdate()
      .executeTakeFirst();
    if (!s) return resultat ? 'Synchronisation absente : résultat refusé.' : null;
    const bilan = resultat ? BilanSynchronisationAlh.parse(resultat) : null;
    let refus: string | null = null;
    if (bilan && bilan.elements !== s.elements)
      refus = `Bilan incohérent : ${bilan.elements} élément(s) annoncé(s), ${s.elements} reçu(s).`;
    const complete = !!bilan && !refus && !bilan.tronque;
    if (bilan && !refus) {
      await k
        .updateTable('vulnerabilites_alh_synchronisations')
        .set({ complete })
        .where('execution_id', '=', executionId)
        .execute();
      if (complete)
        await k
          .updateTable('vulnerabilites_alh_etat')
          .set((eb) => ({
            numero_complet: sql<number>`greatest(${eb.ref('numero_complet')}, ${s.numero}::int)`,
            complete_le: sql<Date>`now()`,
          }))
          .where('integration_id', '=', s.integration_id)
          .execute();
    }
    await this.db.audit(
      EXECUTANT,
      null,
      'vulnerabilites.surface.synchronisation.terminee',
      executionId,
      {
        integration: s.integration_id,
        numero: s.numero,
        lots: s.lots,
        elements: s.elements,
        etat: bilan && !refus ? 'recu' : 'echec',
        complete,
        ...(bilan && !refus
          ? {
              perimetres: bilan.perimetres,
              hotes: bilan.hotes,
              domaines: bilan.domaines,
              alertes: bilan.alertes,
              details: bilan.details,
              technologies: bilan.technologies,
              tronque: bilan.tronque,
            }
          : {}),
      },
      c,
    );
    if (bilan && !refus) await this.apresSynchronisation?.(k, c);
    return refus;
  }

  /* ---------------------------------------------------------------- Rangement (sans doublon) */
  private async rangerPerimetres(k: Kdb, integration: string, numero: number, el: ElementPerimetreAlh[]) {
    if (!el.length) return;
    await k
      .insertInto('vulnerabilites_alh_perimetres')
      .values(
        dernierParCle(el, (p) => p.id).map((p) => ({
          integration_id: integration,
          alh_id: p.id,
          nom: p.nom,
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'alh_id']).doUpdateSet((eb) => ({
          // La liaison (perimetre_id, version) n'est jamais touchée par une synchronisation.
          nom: eb.ref('excluded.nom'),
          vu_numero: sql`greatest(vulnerabilites_alh_perimetres.vu_numero, excluded.vu_numero)`,
        })),
      )
      .execute();
  }

  private async rangerActifs(
    k: Kdb,
    lignes: {
      integration_id: string;
      type: TypeActifAlh;
      alh_id: string;
      perimetre_alh: string | null;
      statut: StatutActifAlh | null;
      valeur: string;
      adresse: string | null;
      fai: string | null;
      asn: string | null;
      pays: string | null;
      mutualise: boolean | null;
      cdn: boolean | null;
      joignable: boolean | null;
      joignable_le: string | null;
      niveau: number | null;
      import_manuel: boolean | null;
      parent_alh: string | null;
      cree_alh_le: string | null;
      maj_alh_le: string | null;
      vu_numero: number;
    }[],
  ) {
    if (!lignes.length) return;
    await k
      .insertInto('vulnerabilites_alh_actifs')
      .values(lignes)
      .onConflict((oc) =>
        oc.columns(['integration_id', 'type', 'alh_id']).doUpdateSet((eb) => ({
          perimetre_alh: eb.ref('excluded.perimetre_alh'),
          statut: eb.ref('excluded.statut'),
          valeur: eb.ref('excluded.valeur'),
          adresse: eb.ref('excluded.adresse'),
          fai: eb.ref('excluded.fai'),
          asn: eb.ref('excluded.asn'),
          pays: eb.ref('excluded.pays'),
          mutualise: eb.ref('excluded.mutualise'),
          cdn: eb.ref('excluded.cdn'),
          joignable: eb.ref('excluded.joignable'),
          joignable_le: eb.ref('excluded.joignable_le'),
          niveau: eb.ref('excluded.niveau'),
          import_manuel: eb.ref('excluded.import_manuel'),
          parent_alh: eb.ref('excluded.parent_alh'),
          cree_alh_le: eb.ref('excluded.cree_alh_le'),
          maj_alh_le: eb.ref('excluded.maj_alh_le'),
          vu_numero: sql`greatest(vulnerabilites_alh_actifs.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
        })),
      )
      .execute();
  }

  private rangerHotes(k: Kdb, integration: string, numero: number, el: ElementHoteAlh[]) {
    return this.rangerActifs(
      k,
      dernierParCle(el, (h) => h.id).map((h) => ({
        integration_id: integration,
        type: 'hote' as const,
        alh_id: h.id,
        perimetre_alh: h.perimetre,
        statut: h.statut,
        valeur: h.adresse,
        adresse: null,
        fai: h.fai,
        asn: h.asn,
        pays: h.pays,
        mutualise: h.mutualise,
        cdn: h.cdn,
        joignable: h.joignable,
        joignable_le: h.joignableLe,
        niveau: null,
        import_manuel: h.importManuel,
        parent_alh: null,
        cree_alh_le: h.creeLe,
        maj_alh_le: h.majLe,
        vu_numero: numero,
      })),
    );
  }

  private rangerDomaines(k: Kdb, integration: string, numero: number, el: ElementDomaineAlh[]) {
    return this.rangerActifs(
      k,
      dernierParCle(el, (d) => d.id).map((d) => ({
        integration_id: integration,
        type: 'domaine' as const,
        alh_id: d.id,
        perimetre_alh: d.perimetre,
        statut: d.statut,
        valeur: d.domaine,
        adresse: d.adresse,
        fai: null,
        asn: null,
        pays: null,
        mutualise: null,
        cdn: null,
        joignable: null,
        joignable_le: null,
        niveau: d.niveau,
        import_manuel: d.importManuel,
        parent_alh: d.parent,
        cree_alh_le: d.creeLe,
        maj_alh_le: d.majLe,
        vu_numero: numero,
      })),
    );
  }

  /** Alertes : un détail lu remplace type, criticité, cible et CVE ; sans détail, les valeurs déjà rangées sont gardées (le
      type et la criticité connus par le script le sont toutefois). */
  private async rangerAlertes(k: Kdb, integration: string, numero: number, el: ElementAlerteAlh[]) {
    if (!el.length) return;
    const uniques = dernierParCle(el, (a) => a.id);
    const ligne = (a: ElementAlerteAlh) => ({
      integration_id: integration,
      alh_id: a.id,
      perimetre_alh: a.perimetre,
      type: a.typeAlerte,
      criticite: a.criticite,
      statut: a.statut,
      titre: a.titre,
      verifiee: a.verifiee,
      detail: a.detail,
      cible_type: a.cibleType,
      cible_valeur: a.cibleValeur,
      cible_hote: a.cibleHote,
      cible_domaine: a.cibleDomaine,
      // Défauts (lot ALH2) : du détail seulement ; relus avec leur schéma.
      defauts: JSON.stringify(a.defauts),
      cree_alh_le: a.creeLe,
      maj_alh_le: a.majLe,
      terminee_le: a.termineeLe,
      vu_numero: numero,
    });
    const detaillees = uniques.filter((a) => a.detail);
    const simples = uniques.filter((a) => !a.detail);
    if (simples.length)
      await k
        .insertInto('vulnerabilites_alh_alertes')
        .values(simples.map(ligne))
        .onConflict((oc) =>
          oc.columns(['integration_id', 'alh_id']).doUpdateSet((eb) => ({
            perimetre_alh: eb.ref('excluded.perimetre_alh'),
            statut: eb.ref('excluded.statut'),
            titre: eb.ref('excluded.titre'),
            verifiee: eb.ref('excluded.verifiee'),
            cree_alh_le: eb.ref('excluded.cree_alh_le'),
            maj_alh_le: eb.ref('excluded.maj_alh_le'),
            terminee_le: sql`coalesce(excluded.terminee_le, vulnerabilites_alh_alertes.terminee_le)`,
            vu_numero: sql`greatest(vulnerabilites_alh_alertes.vu_numero, excluded.vu_numero)`,
            vu_le: sql`now()`,
            // Sans détail : type et criticité connus par le script remplacent, sinon la valeur rangée est gardée.
            type: sql`coalesce(excluded.type, vulnerabilites_alh_alertes.type)`,
            criticite: sql`coalesce(excluded.criticite, vulnerabilites_alh_alertes.criticite)`,
          })),
        )
        .execute();
    if (!detaillees.length) return;
    const ids = await k
      .insertInto('vulnerabilites_alh_alertes')
      .values(detaillees.map(ligne))
      .onConflict((oc) =>
        oc.columns(['integration_id', 'alh_id']).doUpdateSet((eb) => ({
          perimetre_alh: eb.ref('excluded.perimetre_alh'),
          statut: eb.ref('excluded.statut'),
          titre: eb.ref('excluded.titre'),
          verifiee: eb.ref('excluded.verifiee'),
          cree_alh_le: eb.ref('excluded.cree_alh_le'),
          maj_alh_le: eb.ref('excluded.maj_alh_le'),
          terminee_le: sql`coalesce(excluded.terminee_le, vulnerabilites_alh_alertes.terminee_le)`,
          vu_numero: sql`greatest(vulnerabilites_alh_alertes.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
          type: eb.ref('excluded.type'),
          criticite: eb.ref('excluded.criticite'),
          detail: sql`true`,
          cible_type: eb.ref('excluded.cible_type'),
          cible_valeur: eb.ref('excluded.cible_valeur'),
          cible_hote: eb.ref('excluded.cible_hote'),
          cible_domaine: eb.ref('excluded.cible_domaine'),
          defauts: eb.ref('excluded.defauts'),
        })),
      )
      .returning(['id', 'alh_id'])
      .execute();
    const parAlh = new Map(ids.map((r) => [r.alh_id, r.id]));
    await k
      .deleteFrom('vulnerabilites_alh_alerte_cves')
      .where(
        'alerte_id',
        'in',
        ids.map((r) => r.id),
      )
      .execute();
    const liens = detaillees.flatMap((a) => a.cves.map((cve) => ({ alerte_id: parAlh.get(a.id)!, cve })));
    for (let i = 0; i < liens.length; i += 5000)
      await k
        .insertInto('vulnerabilites_alh_alerte_cves')
        .values(liens.slice(i, i + 5000))
        .execute();
    // Lot ALH6 : services lus dans les fragments du détail, rangés sur l'actif visé (liens de l'alerte remplacés).
    await rangerServicesAlertes(
      k,
      integration,
      detaillees.map((a) => ({
        alerteId: parAlh.get(a.id)!,
        cibleHote: a.cibleHote,
        cibleDomaine: a.cibleDomaine,
        services: a.services,
      })),
    );
  }

  /** Une technologie relue remplace ses actifs et ses CVE, qui la suivent dans les lots. */
  private async rangerTechnologies(k: Kdb, integration: string, numero: number, el: ElementTechnologieAlh[]) {
    if (!el.length) return;
    const ids = await k
      .insertInto('vulnerabilites_alh_technologies')
      .values(
        dernierParCle(el, (t) => t.cle).map((t) => ({
          integration_id: integration,
          cle: t.cle,
          nom: t.nom,
          editeur: t.editeur,
          produit: t.produit,
          technologie: t.technologie,
          derniere: t.derniere,
          tronquee: t.tronquee,
          vu_numero: numero,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['integration_id', 'cle']).doUpdateSet((eb) => ({
          nom: eb.ref('excluded.nom'),
          editeur: eb.ref('excluded.editeur'),
          produit: eb.ref('excluded.produit'),
          technologie: eb.ref('excluded.technologie'),
          derniere: eb.ref('excluded.derniere'),
          tronquee: eb.ref('excluded.tronquee'),
          vu_numero: sql`greatest(vulnerabilites_alh_technologies.vu_numero, excluded.vu_numero)`,
          vu_le: sql`now()`,
        })),
      )
      .returning('id')
      .execute();
    const liste = ids.map((r) => r.id);
    await k.deleteFrom('vulnerabilites_alh_technologie_actifs').where('technologie_id', 'in', liste).execute();
    await k.deleteFrom('vulnerabilites_alh_technologie_cves').where('technologie_id', 'in', liste).execute();
  }

  /** Lien technologie-actif : la technologie doit être rangée (lot courant ou précédent), sinon tout le lot est refusé. */
  private async rangerLiens(k: Kdb, integration: string, el: ElementTechnologieActifAlh[]) {
    if (!el.length) return;
    // Un même actif peut figurer comme actuel et comme inactif sous la même version : actuel l'emporte.
    const fusion = new Map<string, ElementTechnologieActifAlh>();
    for (const x of el) {
      const cle = [x.technologie, x.version, x.typeActif, x.actif].join('\u0000');
      const avant = fusion.get(cle);
      fusion.set(cle, avant ? { ...x, actuel: avant.actuel || x.actuel } : x);
    }
    const d = [...fusion.values()];
    const r = await sql<{ technologie_id: string }>`
      INSERT INTO vulnerabilites_alh_technologie_actifs AS ta (technologie_id, version, actif_alh, actif_type, libelle, actuel)
      SELECT t.id, x.version, x.actif, x.type_actif, x.libelle, x.actuel
      FROM unnest(${d.map((x) => x.technologie)}::text[], ${d.map((x) => x.version)}::text[],
                  ${d.map((x) => x.actif)}::uuid[], ${d.map((x) => x.typeActif)}::text[],
                  ${d.map((x) => x.libelle)}::text[], ${d.map((x) => x.actuel)}::boolean[])
             AS x(cle, version, actif, type_actif, libelle, actuel)
      JOIN vulnerabilites_alh_technologies t ON t.integration_id = ${integration}::uuid AND t.cle = x.cle
      ON CONFLICT (technologie_id, version, actif_type, actif_alh) DO UPDATE SET
        libelle = excluded.libelle,
        actuel = ta.actuel OR excluded.actuel
      RETURNING ta.technologie_id`.execute(k);
    if (r.rows.length !== d.length)
      throw new HttpError(422, 'Lot refusé : actif d’une technologie inconnue de cette synchronisation.');
  }

  private async rangerCves(k: Kdb, integration: string, el: ElementTechnologieCveAlh[]) {
    if (!el.length) return;
    const d = dernierParCle(el, (x) => [x.technologie, x.version, x.cve].join('\u0000'));
    const r = await sql<{ technologie_id: string }>`
      INSERT INTO vulnerabilites_alh_technologie_cves AS tc (technologie_id, version, cve, titre, cvss, epss, severite,
        preuve, exploitee, publiee_le)
      SELECT t.id, x.version, x.cve, x.titre, x.cvss, x.epss, x.severite, x.preuve, x.exploitee, x.publiee
      FROM unnest(${d.map((x) => x.technologie)}::text[], ${d.map((x) => x.version)}::text[],
                  ${d.map((x) => x.cve)}::text[], ${d.map((x) => x.titre)}::text[],
                  ${d.map((x) => x.cvss)}::numeric[], ${d.map((x) => x.epss)}::numeric[],
                  ${d.map((x) => x.severite)}::text[], ${d.map((x) => x.preuve)}::boolean[],
                  ${d.map((x) => x.exploitee)}::boolean[], ${d.map((x) => x.publieeLe)}::timestamptz[])
             AS x(cle, version, cve, titre, cvss, epss, severite, preuve, exploitee, publiee)
      JOIN vulnerabilites_alh_technologies t ON t.integration_id = ${integration}::uuid AND t.cle = x.cle
      ON CONFLICT (technologie_id, version, cve) DO UPDATE SET
        titre = excluded.titre, cvss = excluded.cvss, epss = excluded.epss, severite = excluded.severite,
        preuve = excluded.preuve, exploitee = excluded.exploitee, publiee_le = excluded.publiee_le
      RETURNING tc.technologie_id`.execute(k);
    if (r.rows.length !== d.length)
      throw new HttpError(422, 'Lot refusé : CVE d’une technologie inconnue de cette synchronisation.');
  }

  /* ---------------------------------------------------------------- Planification (tic de l'API) */
  /** Lot F1 : inscrit au plus une synchronisation par période réglée (vingt-quatre heures par défaut ; 12 h, 24 h ou 7 jours)
      et par instance AlgoLightHouse active dont la clé est enregistrée. Les
      modules Intégrations et Vulnérabilités sont contrôlés par l'appelant ; flux « algolighthouse » fermé : rien. */
  async planifier(maintenant = new Date()): Promise<string[]> {
    if (!(await this.flux.ouvert('algolighthouse'))) return [];
    const instances = (await this.integrations.lister()).filter(
      (i) => i.type === TYPE && i.actif && Object.values(i.secrets).every(Boolean),
    );
    const ids: string[] = [];
    for (const i of instances)
      await this.db.tx(async (c, k) => {
        await verrouFileIntegrations(k);
        await this.integrations.menageFile(k, c);
        await k
          .insertInto('vulnerabilites_alh_etat')
          .values({ integration_id: i.id })
          .onConflict((oc) => oc.column('integration_id').doNothing())
          .execute();
        const e = await k
          .selectFrom('vulnerabilites_alh_etat')
          .select('planifiee_le')
          .where('integration_id', '=', i.id)
          .forUpdate()
          .executeTakeFirstOrThrow();
        // Lot F1 : au plus une par période réglée sur l'instance (vingt-quatre heures par défaut), comptée depuis la
        // dernière demande automatique.
        if (!echeanceAtteinte(e.planifiee_le, frequenceConnecteur(i.frequenceHeures), maintenant)) return;
        // Référence consommée d'abord : une synchronisation inscrite puis perdue, expirée ou en échec n'est pas redemandée
        // avant la période suivante.
        await k
          .updateTable('vulnerabilites_alh_etat')
          .set({
            planifiee_le: referenceApresDemande(e.planifiee_le, frequenceConnecteur(i.frequenceHeures), maintenant),
          })
          .where('integration_id', '=', i.id)
          .execute();
        const occupee = await k
          .selectFrom('integration_executions')
          .select('id')
          .where('integration_id', '=', i.id)
          .where('etat', 'in', ['en_file', 'en_cours'])
          .executeTakeFirst();
        if (!occupee)
          ids.push((await this.integrations.inscrire(k, c, i, 'synchroniser', 'planifie', PLANIFICATION, null)).id);
      });
    return ids;
  }

  /* ---------------------------------------------------------------- État (vulnerabilites:lire) */
  async etat(user: SessionUser): Promise<EtatSurfaceExterneDto[]> {
    const instances = (await this.integrations.lister()).filter((i) => i.type === TYPE);
    const administrer = user.rights.can('vulnerabilites', 'administrer');
    const fluxOuvert = await this.flux.ouvert('algolighthouse');
    const maintenant = new Date();
    const out: EtatSurfaceExterneDto[] = [];
    for (const i of instances) {
      const e = await this.db.k
        .selectFrom('vulnerabilites_alh_etat')
        .selectAll()
        .where('integration_id', '=', i.id)
        .executeTakeFirst();
      const d = await this.db.k
        .selectFrom('integration_executions')
        .selectAll()
        .where('integration_id', '=', i.id)
        .where('operation', '=', 'synchroniser')
        .orderBy('demande_le', 'desc')
        .orderBy('id')
        .limit(1)
        .executeTakeFirst();
      const bilan = d?.resultat ? BilanSynchronisationAlh.safeParse(d.resultat) : null;
      // Le nombre de périmètres non reliés ne se lit qu'avec administrer : leur contenu n'est visible que de ce droit.
      const nonRelies = administrer
        ? Number(
            (
              await sql<{ n: number }>`SELECT count(*)::int AS n FROM vulnerabilites_alh_perimetres lp
                WHERE lp.integration_id = ${i.id}::uuid AND lp.perimetre_id IS NULL
                  AND lp.vu_numero >= ${e?.numero_complet ?? 0}::int`.execute(this.db.k)
            ).rows[0]!.n,
          )
        : null;
      out.push({
        integrationId: i.id,
        nom: i.nom,
        actif: i.actif,
        derniere: d
          ? {
              id: d.id,
              etat: d.etat as NonNullable<EtatSurfaceExterneDto['derniere']>['etat'],
              origine: d.origine as 'manuel' | 'planifie',
              demandeLe: d.demande_le.toISOString(),
              termineLe: d.termine_le?.toISOString() ?? null,
              bilan: bilan?.success ? bilan.data : null,
              erreur: d.erreur,
            }
          : null,
        derniereCompleteLe: e?.complete_le?.toISOString() ?? null,
        perimetresNonRelies: nonRelies,
        frequenceHeures: frequenceConnecteur(i.frequenceHeures),
        // Lot F1 : prochaine synchronisation automatique, seulement pour une instance que le planificateur traite.
        prochaineSynchronisation:
          fluxOuvert && i.actif && Object.values(i.secrets).every(Boolean)
            ? prochaineAffichee(
                e?.planifiee_le ?? null,
                frequenceConnecteur(i.frequenceHeures),
                maintenant,
              ).toISOString()
            : null,
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- Priorité (lot ALH2) */
  /** Sources et priorité des CVE demandées, sur tous les faits connus (lot ALH5, décision A : la même pour tout le monde) ;
      `menants` : actifs qui mènent, par une liaison confirmée, à une machine interne vulnérable (décision B). `priorite`
      majore d'un cran une CVE exposée (présence « exposée ») portée par un tel actif. */
  private async evaluateur(cves: readonly string[]) {
    const faits = await lireFaitsCve(this.db.k, cves);
    const reglage = await this.reglage.valeurs();
    const menants = await actifsMenantAUneMachineVulnerable(this.db.k, reglage);
    const cache = new Map<string, SourcesFailleDto>();
    const sources = (cve: string): SourcesFailleDto => {
      let x = cache.get(cve);
      if (!x) {
        const f = faits.get(cve);
        x = sourcesDe(f ? [f] : []);
        cache.set(cve, x);
      }
      return x;
    };
    return {
      sources,
      menants,
      priorite: (cve: string, presence: Presence, mene = false): Priorite =>
        majorerPriorite(
          calculerPriorite({ ...faitsDepuisSources(sources(cve)), presence }, reglage),
          mene && presence === 'exposee',
        ),
    };
  }

  /** Une alerte (ses actifs visés, identifiants internes) mène à une machine interne vulnérable. */
  private static mene(actifs: readonly string[] | null, menants: ReadonlySet<string>): boolean {
    return (actifs ?? []).some((id) => menants.has(id));
  }

  /* ---------------------------------------------------------------- Lecture par périmètre (vulnerabilites:lire) */
  /** Alertes lisibles et présentes, dans l'ordre par défaut (criticité de l'éditeur, puis la plus récente) ; `page` absent :
      toutes (tri par priorité, fiche). */
  private async lignesAlertes(
    user: SessionUser,
    conditions: RawBuilder<boolean>[],
    page: { limite: number; decalage: number } | null,
  ) {
    const { rows } = await sql<{
      id: string;
      type: TypeAlerteAlh | null;
      criticite: CriticiteAlh | null;
      statut: StatutAlerteAlh;
      titre: string;
      verifiee: boolean | null;
      detail: boolean;
      cible_type: TypeCibleAlh | null;
      cible_valeur: string | null;
      cree_alh_le: Date | null;
      maj_alh_le: Date | null;
      terminee_le: Date | null;
      integration_id: string;
      integration_nom: string;
      perimetre_alh_nom: string | null;
      perimetre_nom: string | null;
      cves: string[];
      actifs_cibles: string[] | null;
      nombre_defauts: number;
      total: number;
    }>`
      SELECT a.id, a.type, a.criticite, a.statut, a.titre, a.verifiee, a.detail, a.cible_type, a.cible_valeur,
        a.cree_alh_le, a.maj_alh_le, a.terminee_le, a.integration_id, i.nom AS integration_nom,
        lp.nom AS perimetre_alh_nom, sm.name AS perimetre_nom,
        coalesce((SELECT array_agg(ac.cve ORDER BY ac.cve) FROM vulnerabilites_alh_alerte_cves ac
                  WHERE ac.alerte_id = a.id), '{}') AS cves,
        ${SurfaceExterneAlh.actifsCibles} AS actifs_cibles,
        jsonb_array_length(a.defauts)::int AS nombre_defauts,
        count(*) OVER ()::int AS total
      FROM vulnerabilites_alh_alertes a
      JOIN integrations i ON i.id = a.integration_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = a.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = a.integration_id AND lp.alh_id = a.perimetre_alh
      LEFT JOIN grc_smsis sm ON sm.id = lp.perimetre_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY CASE a.criticite WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'important' THEN 2 WHEN 'minor' THEN 3
               ELSE 4 END, coalesce(a.maj_alh_le, a.cree_alh_le) DESC NULLS LAST, a.id
      ${page ? sql`LIMIT ${page.limite} OFFSET ${page.decalage}` : sql``}`.execute(this.db.k);
    return rows;
  }

  /** Actifs rangés que vise l'alerte `a` (identifiants internes, pour la majoration seulement : jamais rendus). */
  private static readonly actifsCibles = sql<string[] | null>`(SELECT array_agg(xc.id) FROM vulnerabilites_alh_actifs xc
    WHERE xc.integration_id = a.integration_id
      AND ((xc.type = 'hote' AND xc.alh_id = a.cible_hote) OR (xc.type = 'domaine' AND xc.alh_id = a.cible_domaine)))`;

  /** Alerte rendue, avec sa priorité : la plus haute de ses CVE, présence « exposée » tant qu'elle est ouverte chez
      l'éditeur (sinon « absente ») ; null sans CVE. Majorée si elle est ouverte et que son actif mène à une machine interne
      vulnérable (lot ALH5). */
  private static versAlerte(
    a: Awaited<ReturnType<SurfaceExterneAlh['lignesAlertes']>>[number],
    priorite: (cve: string, presence: Presence, mene?: boolean) => Priorite,
    menants: ReadonlySet<string>,
  ): AlerteAlhDto {
    const presence: Presence = OUVERTS.includes(a.statut) ? 'exposee' : 'absente';
    const mene = SurfaceExterneAlh.mene(a.actifs_cibles, menants);
    return {
      id: a.id,
      type: a.type,
      criticite: a.criticite,
      statut: a.statut,
      titre: a.titre,
      verifiee: a.verifiee,
      detail: a.detail,
      cible: a.cible_type || a.cible_valeur ? { type: a.cible_type, valeur: a.cible_valeur } : null,
      cves: a.cves,
      creeLe: iso(a.cree_alh_le),
      majLe: iso(a.maj_alh_le),
      termineeLe: iso(a.terminee_le),
      perimetreAlh: a.perimetre_alh_nom,
      perimetreNom: a.perimetre_nom,
      integration: { id: a.integration_id, nom: a.integration_nom },
      priorite: prioriteLaPlusHaute(a.cves.map((c) => priorite(c, presence, mene))),
      nombreDefauts: a.nombre_defauts,
    };
  }

  async alertes(user: SessionUser, q: RechercheAlertesAlh): Promise<PageSurface<AlerteAlhDto>> {
    const conditions: RawBuilder<boolean>[] = [lisible(user), present('a')];
    if (!q.statut) conditions.push(sql<boolean>`a.statut = ANY(${OUVERTS}::text[])`);
    else if (q.statut !== 'toutes') conditions.push(sql<boolean>`a.statut = ${q.statut}`);
    if (q.type) conditions.push(sql<boolean>`a.type = ${q.type}`);
    if (q.criticite) conditions.push(sql<boolean>`a.criticite = ${q.criticite}`);
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      conditions.push(
        sql<boolean>`(a.titre ILIKE ${`%${motif}%`} OR a.cible_valeur ILIKE ${`%${motif}%`}
          OR EXISTS (SELECT 1 FROM vulnerabilites_alh_alerte_cves ac WHERE ac.alerte_id = a.id
                     AND ac.cve LIKE ${`${motif.toUpperCase()}%`}))`,
      );
    }
    const decalage = (q.page - 1) * SURFACE_PAR_PAGE;
    // Tri par priorité : toutes les alertes lisibles sont évaluées (5 000 au plus par instance), puis la page est découpée.
    const rows = await this.lignesAlertes(
      user,
      conditions,
      q.tri === 'priorite' ? null : { limite: SURFACE_PAR_PAGE, decalage },
    );
    const { priorite, menants } = await this.evaluateur(rows.flatMap((a) => a.cves));
    let elements = rows.map((a) => SurfaceExterneAlh.versAlerte(a, priorite, menants));
    if (q.tri === 'priorite')
      elements = elements
        .map((a, i) => ({ a, i }))
        .sort(
          (x, y) =>
            (x.a.priorite ? rangPriorite(x.a.priorite) : 5) - (y.a.priorite ? rangPriorite(y.a.priorite) : 5) ||
            x.i - y.i,
        )
        .map((x) => x.a)
        .slice(decalage, decalage + SURFACE_PAR_PAGE);
    return { total: rows[0]?.total ?? 0, page: q.page, parPage: SURFACE_PAR_PAGE, elements };
  }

  /** Fiche d'une alerte lisible et présente (lot ALH2) : ses CVE avec leur priorité et ce que chaque source en dit, ses
      défauts et résolutions tels que l'éditeur les décrit (texte simple). Illisible, absente ou inconnue : 404. */
  async alerte(user: SessionUser, id: string): Promise<FicheAlerteAlhDto> {
    const [a] = await this.lignesAlertes(user, [lisible(user), present('a'), sql<boolean>`a.id = ${id}::uuid`], null);
    if (!a) throw new HttpError(404, 'Alerte introuvable ou non accessible.');
    const { sources, priorite, menants } = await this.evaluateur(a.cves);
    const dto = SurfaceExterneAlh.versAlerte(a, priorite, menants);
    const presence: Presence = OUVERTS.includes(a.statut) ? 'exposee' : 'absente';
    const mene = SurfaceExterneAlh.mene(a.actifs_cibles, menants);
    const brut = await this.db.k
      .selectFrom('vulnerabilites_alh_alertes')
      .select('defauts')
      .where('id', '=', id)
      .executeTakeFirst();
    const defauts = DefautsAlh.safeParse(brut?.defauts ?? []);
    return {
      ...dto,
      cvesDetail: a.cves
        .map((cve): CveAlerteAlhDto => ({ cve, priorite: priorite(cve, presence, mene), sources: sources(cve) }))
        .sort((x, y) => rangPriorite(x.priorite) - rangPriorite(y.priorite) || (x.cve < y.cve ? -1 : 1)),
      defauts: defauts.success ? (defauts.data as DefautAlh[]) : [],
      services: await servicesDeLAlerte(this.db.k, user, id),
    };
  }

  /** Liste « Actifs » (lot SI1 : commune à AlgoLightHouse et à Silène). Un actif est identifié par son adresse IP (hôte) ou
      son nom de domaine. Chaque actif lisible d'AlgoLightHouse garde sa ligne et ses champs, comme avant, et reçoit ce que
      Silène dit de la même valeur ; un actif vu par Silène seul (aucun actif d'AlgoLightHouse de même type et de même
      valeur parmi ceux que la personne lit et que les filtres retiennent) s'y ajoute une fois. Ordre : alertes ouvertes,
      type, valeur. Le filtre « Machine interne » ne retient que des actifs d'AlgoLightHouse (seuls à se relier). */
  async actifs(user: SessionUser, q: RechercheActifsAlh): Promise<PageSurface<ActifSurfaceDto>> {
    const conditions: RawBuilder<boolean>[] = [lisible(user), present('x')];
    if (q.type) conditions.push(sql<boolean>`x.type = ${q.type}`);
    if (q.liaison) conditions.push(filtreLiaison(user, q.liaison));
    const texte = q.q?.trim();
    if (texte) {
      const motif = `%${litteral(texte.toLowerCase())}%`;
      conditions.push(sql<boolean>`(x.valeur LIKE ${motif} OR x.adresse LIKE ${motif})`);
    }
    const alertesOuvertes = sql<number>`(SELECT count(*)::int FROM vulnerabilites_alh_alertes a2
           LEFT JOIN vulnerabilites_alh_perimetres lp2 ON lp2.integration_id = a2.integration_id
             AND lp2.alh_id = a2.perimetre_alh
           WHERE a2.integration_id = x.integration_id AND a2.statut = ANY(${OUVERTS}::text[]) AND ${present('a2')}
             AND ${lisible(user, 'lp2')}
             AND ((x.type = 'hote' AND a2.cible_hote = x.alh_id) OR (x.type = 'domaine' AND a2.cible_domaine = x.alh_id)))`;
    const silene = this.silene && !q.liaison ? this.silene.clesActifs(user, { type: q.type, q: texte }) : null;
    const { rows: cles } = await sql<{ id: string; type: TypeActifAlh; valeur: string; alh: boolean; total: number }>`
      WITH alh AS (
        SELECT x.id, x.type, x.valeur, ${alertesOuvertes} AS alertes_ouvertes
        FROM vulnerabilites_alh_actifs x
        LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
        LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
        WHERE ${sql.join(conditions, sql` AND `)}
      ),
      tous AS (
        SELECT id, type, valeur, alertes_ouvertes, true AS alh FROM alh
        ${
          silene
            ? sql`UNION ALL SELECT s.id, s.type, s.valeur, 0, false FROM (${silene}) s
                WHERE NOT EXISTS (SELECT 1 FROM alh WHERE alh.type = s.type AND alh.valeur = s.valeur)`
            : sql``
        }
      )
      SELECT id, type, valeur, alh, count(*) OVER ()::int AS total FROM tous
      ORDER BY alertes_ouvertes DESC, type, valeur, id
      LIMIT ${SURFACE_PAR_PAGE} OFFSET ${(q.page - 1) * SURFACE_PAR_PAGE}`.execute(this.db.k);
    const idsAlh = cles.filter((c) => c.alh).map((c) => c.id);
    const { rows } = idsAlh.length
      ? await sql<{
          id: string;
          type: TypeActifAlh;
          valeur: string;
          statut: StatutActifAlh | null;
          adresse: string | null;
          fai: string | null;
          asn: string | null;
          pays: string | null;
          cdn: boolean | null;
          mutualise: boolean | null;
          joignable: boolean | null;
          joignable_le: Date | null;
          niveau: number | null;
          cree_alh_le: Date | null;
          maj_alh_le: Date | null;
          integration_id: string;
          integration_nom: string;
          perimetre_alh_nom: string | null;
          perimetre_nom: string | null;
          alertes_ouvertes: number;
          technologies: number;
          liaisons_version: number;
        }>`
      SELECT x.id, x.type, x.valeur, x.statut, x.adresse, x.fai, x.asn, x.pays, x.cdn, x.mutualise, x.joignable,
        x.joignable_le, x.niveau, x.cree_alh_le, x.maj_alh_le, x.integration_id, i.nom AS integration_nom,
        x.liaisons_version,
        lp.nom AS perimetre_alh_nom, sm.name AS perimetre_nom,
        ${alertesOuvertes} AS alertes_ouvertes,
        (SELECT count(DISTINCT ta.technologie_id)::int FROM vulnerabilites_alh_technologie_actifs ta
           JOIN vulnerabilites_alh_technologies t2 ON t2.id = ta.technologie_id
           WHERE t2.integration_id = x.integration_id AND ta.actif_type = x.type AND ta.actif_alh = x.alh_id AND ta.actuel
             AND t2.vu_numero >= coalesce(e.numero_complet, 0)
        ) AS technologies
      FROM vulnerabilites_alh_actifs x
      JOIN integrations i ON i.id = x.integration_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      LEFT JOIN grc_smsis sm ON sm.id = lp.perimetre_id
      WHERE x.id = ANY(${idsAlh}::uuid[])`.execute(this.db.k)
      : { rows: [] };
    const parId = new Map(rows.map((x) => [x.id, x]));
    // Lot ALH3 : machines internes reliées ou proposées, limitées à celles que la personne peut lire.
    const liaisons = await resumesLiaisons(this.db.k, user, idsAlh);
    // Lot ALH6 : services connus de chaque actif (portés par une alerte ouverte et présente).
    const services = await servicesDesActifs(this.db.k, user, idsAlh);
    // Lot SI1 : ce que Silène dit de chaque actif de la page (même adresse IP ou même nom de domaine).
    const sil = this.silene
      ? await this.silene.actifs(
          this.db.k,
          user,
          cles.map((c) => ({ type: c.type, valeur: c.valeur })),
          SERVICES_PAR_ACTIF_MAX,
        )
      : new Map<string, ActifSileneDto & { constatIds: string[] }>();
    const sansIds = (a: (ActifSileneDto & { constatIds?: string[] }) | undefined): ActifSileneDto | null => {
      if (!a) return null;
      const { constatIds: _ignore, ...dto } = a;
      void _ignore;
      return dto;
    };
    return {
      total: cles[0]?.total ?? 0,
      page: q.page,
      parPage: SURFACE_PAR_PAGE,
      elements: cles.map((c): ActifSurfaceDto => {
        const s = sansIds(sil.get(cleActif(c.type, c.valeur)));
        const x = parId.get(c.id);
        if (!c.alh || !x)
          return {
            id: c.id,
            type: c.type,
            valeur: c.valeur,
            statut: null,
            adresse: c.type === 'domaine' ? (s?.adresses[0] ?? null) : null,
            fai: null,
            asn: null,
            pays: null,
            cdn: null,
            mutualise: null,
            joignable: null,
            joignableLe: null,
            niveau: null,
            alertesOuvertes: 0,
            technologies: 0,
            creeLe: null,
            majLe: null,
            perimetreAlh: null,
            perimetreNom: s?.perimetreNom ?? null,
            integration: s?.instances[0] ?? { id: c.id, nom: 'Silène' },
            machinesInternes: { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false },
            versionLiaisons: 0,
            services: [],
            nombreServices: 0,
            sources: ['silene'],
            alhId: null,
            silene: s,
          };
        return {
          id: x.id,
          type: x.type,
          valeur: x.valeur,
          statut: x.statut,
          adresse: x.adresse,
          fai: x.fai,
          asn: x.asn,
          pays: x.pays,
          cdn: x.cdn,
          mutualise: x.mutualise,
          joignable: x.joignable,
          joignableLe: iso(x.joignable_le),
          niveau: x.niveau,
          alertesOuvertes: x.alertes_ouvertes,
          technologies: x.technologies,
          creeLe: iso(x.cree_alh_le),
          majLe: iso(x.maj_alh_le),
          perimetreAlh: x.perimetre_alh_nom,
          perimetreNom: x.perimetre_nom,
          integration: { id: x.integration_id, nom: x.integration_nom },
          machinesInternes: liaisons.get(x.id)!,
          versionLiaisons: x.liaisons_version,
          services: sansAlertes(services.get(x.id)!.slice(0, SERVICES_PAR_ACTIF_MAX)),
          nombreServices: services.get(x.id)!.length,
          sources: s ? ['alh', 'silene'] : ['alh'],
          alhId: x.id,
          silene: s,
        };
      }),
    };
  }

  /** Liens technologie-actif lisibles (actif rangé dont le périmètre est lisible ; actif inconnu : administrer), versions
      encore détectées sur un actif lisible, et leurs CVE. Seules ces versions comptent : une CVE d'une version qui ne
      tourne que sur des actifs illisibles n'est ni listée ni comptée. */
  private cteTechnologies(user: SessionUser) {
    return sql`
      WITH liens AS (
        SELECT ta.technologie_id, ta.version, ta.actuel, ta.actif_type, ta.libelle
        FROM vulnerabilites_alh_technologie_actifs ta
        JOIN vulnerabilites_alh_technologies tt ON tt.id = ta.technologie_id
        LEFT JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = tt.integration_id AND xa.type = ta.actif_type
          AND xa.alh_id = ta.actif_alh
        LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = tt.integration_id AND lp.alh_id = xa.perimetre_alh
        WHERE ${lisible(user)}
      ),
      versions AS (SELECT DISTINCT technologie_id, version FROM liens WHERE actuel),
      cv AS (SELECT c.* FROM vulnerabilites_alh_technologie_cves c
             JOIN versions v ON v.technologie_id = c.technologie_id AND v.version = c.version)`;
  }

  async technologies(user: SessionUser, q: RechercheTechnologiesAlh): Promise<PageSurface<TechnologieAlhDto>> {
    const conditions: RawBuilder<boolean>[] = [
      present('t'),
      sql<boolean>`EXISTS (SELECT 1 FROM liens l WHERE l.technologie_id = t.id)`,
    ];
    if (q.exploitee)
      conditions.push(sql<boolean>`EXISTS (SELECT 1 FROM cv WHERE cv.technologie_id = t.id AND cv.exploitee)`);
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      conditions.push(
        sql<boolean>`(t.nom ILIKE ${`%${motif}%`} OR t.editeur ILIKE ${`%${motif}%`} OR t.produit ILIKE ${`%${motif}%`}
          OR EXISTS (SELECT 1 FROM cv WHERE cv.technologie_id = t.id AND cv.cve LIKE ${`${motif.toUpperCase()}%`}))`,
      );
    }
    const decalage = (q.page - 1) * SURFACE_PAR_PAGE;
    const parPriorite = q.tri === 'priorite';
    const { rows: toutes } = await sql<{
      id: string;
      nom: string;
      editeur: string | null;
      produit: string | null;
      technologie: string | null;
      derniere: Date | null;
      tronquee: boolean;
      integration_id: string;
      integration_nom: string;
      nombre_cves: number;
      exploitees: number;
      preuves: number;
      cvss_max: string | null;
      inactifs: number;
      total: number;
    }>`${this.cteTechnologies(user)}
      SELECT t.id, t.nom, t.editeur, t.produit, t.technologie, t.derniere, t.tronquee, t.integration_id,
        i.nom AS integration_nom,
        (SELECT count(DISTINCT cv.cve)::int FROM cv WHERE cv.technologie_id = t.id) AS nombre_cves,
        (SELECT count(DISTINCT cv.cve)::int FROM cv WHERE cv.technologie_id = t.id AND cv.exploitee) AS exploitees,
        (SELECT count(DISTINCT cv.cve)::int FROM cv WHERE cv.technologie_id = t.id AND cv.preuve) AS preuves,
        (SELECT max(cv.cvss) FROM cv WHERE cv.technologie_id = t.id) AS cvss_max,
        (SELECT count(*)::int FROM liens l WHERE l.technologie_id = t.id AND NOT l.actuel) AS inactifs,
        count(*) OVER ()::int AS total
      FROM vulnerabilites_alh_technologies t
      JOIN integrations i ON i.id = t.integration_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = t.integration_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY exploitees DESC, cvss_max DESC NULLS LAST, lower(t.nom), t.id
      ${parPriorite ? sql`` : sql`LIMIT ${SURFACE_PAR_PAGE} OFFSET ${decalage}`}`.execute(this.db.k);
    // CVE des versions lisibles : de la page, ou de toutes les technologies pour le tri par priorité (2 000 au plus).
    const cvesDe = async (ids: string[]) =>
      ids.length
        ? (
            await sql<{
              technologie_id: string;
              version: string;
              cve: string;
              titre: string | null;
              cvss: string | null;
              epss: string | null;
              severite: string | null;
              preuve: boolean | null;
              exploitee: boolean | null;
              publiee_le: Date | null;
            }>`${this.cteTechnologies(user)}
            SELECT technologie_id, version, cve, titre, cvss, epss, severite, preuve, exploitee, publiee_le FROM cv
            WHERE technologie_id = ANY(${ids}::uuid[])
            ORDER BY technologie_id, version, exploitee DESC NULLS LAST, cvss DESC NULLS LAST, cve`.execute(this.db.k)
          ).rows
        : [];
    const tousIds = toutes.map((r) => r.id);
    const cves = await cvesDe(tousIds);
    // Lot ALH5 (décision A) : la priorité d'une technologie porte sur toutes ses versions encore détectées, y compris sur des
    // actifs que la personne ne lit pas ; seules les versions lisibles sont détaillées. Une CVE d'une version encore
    // détectée est présente chez nous : présence « exposée ».
    const globales = tousIds.length
      ? (
          await sql<{ technologie_id: string; version: string; cve: string }>`
            SELECT DISTINCT c.technologie_id, c.version, c.cve FROM (${cvesAlh}) c
            WHERE c.technologie_id = ANY(${tousIds}::uuid[])`.execute(this.db.k)
        ).rows
      : [];
    const { priorite, menants } = await this.evaluateur(globales.map((c) => c.cve));
    // Décision B : versions encore détectées sur un actif qui mène à une machine interne vulnérable.
    const versionsMenant = new Set(
      tousIds.length && menants.size
        ? (
            await sql<{ technologie_id: string; version: string }>`
              SELECT DISTINCT ta.technologie_id, ta.version FROM vulnerabilites_alh_technologie_actifs ta
              JOIN vulnerabilites_alh_technologies tt ON tt.id = ta.technologie_id
              JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = tt.integration_id AND xa.type = ta.actif_type
                AND xa.alh_id = ta.actif_alh
              WHERE ta.actuel AND ta.technologie_id = ANY(${tousIds}::uuid[])
                AND xa.id = ANY(${[...menants]}::uuid[])`.execute(this.db.k)
          ).rows.map((v) => `${v.technologie_id}|${v.version}`)
        : [],
    );
    const prioriteVersion = new Map<string, Priorite>();
    const prioriteDe = (technologie: string, version: string, cve: string): Priorite => {
      const cle = `${technologie}|${version}|${cve}`;
      let p = prioriteVersion.get(cle);
      if (!p) prioriteVersion.set(cle, (p = priorite(cve, 'exposee', versionsMenant.has(`${technologie}|${version}`))));
      return p;
    };
    const prioriteTechno = new Map<string, Priorite[]>();
    for (const c of globales)
      prioriteTechno.set(c.technologie_id, [
        ...(prioriteTechno.get(c.technologie_id) ?? []),
        prioriteDe(c.technologie_id, c.version, c.cve),
      ]);
    const laPlusHaute = (id: string) => prioriteLaPlusHaute(prioriteTechno.get(id) ?? []);
    const rows = parPriorite
      ? toutes
          .map((t, i) => ({ t, i, p: laPlusHaute(t.id) }))
          .sort((x, y) => (x.p ? rangPriorite(x.p) : 5) - (y.p ? rangPriorite(y.p) : 5) || x.i - y.i)
          .map((x) => x.t)
          .slice(decalage, decalage + SURFACE_PAR_PAGE)
      : toutes;
    const ids = rows.map((r) => r.id);
    const versions = new Map<string, Map<string, VersionTechnologieAlhDto>>();
    if (ids.length) {
      const liens = await sql<{ technologie_id: string; version: string; actif_type: TypeActifAlh; libelle: string }>`
        ${this.cteTechnologies(user)}
        SELECT DISTINCT technologie_id, version, actif_type, libelle FROM liens
        WHERE actuel AND technologie_id = ANY(${ids}::uuid[]) ORDER BY technologie_id, version, actif_type, libelle`.execute(
        this.db.k,
      );
      const version = (t: string, v: string) => {
        let m = versions.get(t);
        if (!m) versions.set(t, (m = new Map()));
        let x = m.get(v);
        if (!x) m.set(v, (x = { version: v, actifs: [], cves: [] }));
        return x;
      };
      for (const l of liens.rows)
        version(l.technologie_id, l.version).actifs.push({ type: l.actif_type, libelle: l.libelle });
      const page = new Set(ids);
      for (const c of cves)
        if (page.has(c.technologie_id))
          version(c.technologie_id, c.version).cves.push({
            cve: c.cve,
            titre: c.titre,
            cvss: nombre(c.cvss),
            epss: nombre(c.epss),
            severite: c.severite,
            preuve: c.preuve,
            exploitee: c.exploitee,
            publieeLe: iso(c.publiee_le),
            priorite: prioriteDe(c.technologie_id, c.version, c.cve),
          } satisfies CveTechnologieAlhDto);
    }
    const produits = ids.length ? await this.produitsSurveilles() : [];
    return {
      total: toutes[0]?.total ?? 0,
      page: q.page,
      parPage: SURFACE_PAR_PAGE,
      elements: rows.map((t) => {
        const vs = [...(versions.get(t.id)?.values() ?? [])];
        return {
          id: t.id,
          nom: t.nom,
          editeur: t.editeur,
          produit: t.produit,
          technologie: t.technologie,
          derniere: iso(t.derniere),
          tronquee: t.tronquee,
          versions: vs,
          actifsInactifs: t.inactifs,
          nombreCves: t.nombre_cves,
          exploitees: t.exploitees,
          preuves: t.preuves,
          cvssMax: nombre(t.cvss_max),
          integration: { id: t.integration_id, nom: t.integration_nom },
          priorite: laPlusHaute(t.id),
          produits: produits.flatMap((p): ProduitRapprocheAlhDto[] => {
            const par = rapprochementTechnologie(t, p);
            return par
              ? [
                  {
                    id: p.id,
                    editeur: p.editeur,
                    nom: p.nom,
                    versionProduit: p.versionProduit,
                    par,
                    memeVersion: memeVersionDetectee(
                      vs.map((v) => v.version),
                      p.versionProduit,
                    ),
                  },
                ]
              : [];
          }),
        };
      }),
    };
  }

  /* ---------------------------------------------------------------- Carte « Lignes d'approche » (lot ALH4) */
  /** Graphe de la surface externe pour la carte, déjà filtré par les droits de la personne : actifs lisibles et présents
      (ceux qui portent une alerte ouverte lisible d'abord), leur domaine parent s'il est lui aussi rendu, leurs machines
      internes reliées lisibles (lot ALH3), et les alertes ouvertes lisibles et présentes avec leur priorité (la plus haute
      de leurs CVE, présence « exposée », majorée si l'actif visé mène à une machine interne vulnérable : lot ALH5). Borné
      (CARTE_SURFACE_BORNES) ; rien n'est écrit. */
  async carte(user: SessionUser): Promise<CarteSurfaceDto> {
    const { rows: actifs } = await sql<{
      id: string;
      type: TypeActifAlh;
      valeur: string;
      adresse: string | null;
      niveau: number | null;
      parent_alh: string | null;
      alh_id: string;
      integration_id: string;
      liaisons_version: number;
      perimetre_alh_nom: string | null;
      perimetre_nom: string | null;
      total: number;
    }>`
      SELECT x.id, x.type, x.valeur, x.adresse, x.niveau, x.parent_alh, x.alh_id, x.integration_id, x.liaisons_version,
        lp.nom AS perimetre_alh_nom, sm.name AS perimetre_nom, count(*) OVER ()::int AS total
      FROM vulnerabilites_alh_actifs x
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      LEFT JOIN grc_smsis sm ON sm.id = lp.perimetre_id
      WHERE ${lisible(user)} AND ${present('x')}
      ORDER BY EXISTS (SELECT 1 FROM vulnerabilites_alh_alertes a2
           LEFT JOIN vulnerabilites_alh_perimetres lp2 ON lp2.integration_id = a2.integration_id
             AND lp2.alh_id = a2.perimetre_alh
           WHERE a2.integration_id = x.integration_id AND a2.statut = ANY(${OUVERTS}::text[]) AND ${present('a2')}
             AND ${lisible(user, 'lp2')}
             AND ((x.type = 'hote' AND a2.cible_hote = x.alh_id) OR (x.type = 'domaine' AND a2.cible_domaine = x.alh_id))
        ) DESC, x.type, x.valeur, x.id
      LIMIT ${CARTE_SURFACE_BORNES.actifs}`.execute(this.db.k);
    const { rows: alertes } = await sql<{
      id: string;
      type: TypeAlerteAlh | null;
      criticite: CriticiteAlh | null;
      titre: string;
      cible_type: TypeCibleAlh | null;
      cible_valeur: string | null;
      cible_hote: string | null;
      cible_domaine: string | null;
      integration_id: string;
      cves: string[];
      actifs_cibles: string[] | null;
      total: number;
    }>`
      SELECT a.id, a.type, a.criticite, a.titre, a.cible_type, a.cible_valeur, a.cible_hote, a.cible_domaine,
        a.integration_id,
        coalesce((SELECT array_agg(ac.cve ORDER BY ac.cve) FROM vulnerabilites_alh_alerte_cves ac
                  WHERE ac.alerte_id = a.id), '{}') AS cves,
        ${SurfaceExterneAlh.actifsCibles} AS actifs_cibles,
        count(*) OVER ()::int AS total
      FROM vulnerabilites_alh_alertes a
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = a.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = a.integration_id AND lp.alh_id = a.perimetre_alh
      WHERE ${lisible(user)} AND ${present('a')} AND a.statut = ANY(${OUVERTS}::text[])
      ORDER BY CASE a.criticite WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'important' THEN 2 WHEN 'minor' THEN 3
               ELSE 4 END, coalesce(a.maj_alh_le, a.cree_alh_le) DESC NULLS LAST, a.id
      LIMIT ${CARTE_SURFACE_BORNES.alertes}`.execute(this.db.k);
    // Identité d'un actif chez l'éditeur (instance, nature, identifiant) -> actif rendu par la carte.
    const cle = (integration: string, type: TypeActifAlh, alh: string) => `${integration}|${type}|${alh}`;
    const rendus = new Map(actifs.map((x) => [cle(x.integration_id, x.type, x.alh_id), x.id]));
    const liaisons = await liaisonsCarte(
      this.db.k,
      user,
      actifs.map((x) => x.id),
    );
    const services = await servicesDesActifs(
      this.db.k,
      user,
      actifs.map((x) => x.id),
    );
    const { priorite, menants } = await this.evaluateur(alertes.flatMap((a) => a.cves));
    return {
      actifs: actifs.map((x) => {
        const l = liaisons.get(x.id)!;
        const sv = services.get(x.id)!;
        return {
          id: x.id,
          type: x.type,
          valeur: x.valeur,
          adresse: x.adresse,
          niveau: x.niveau,
          parentId:
            x.type === 'domaine' && x.parent_alh
              ? (rendus.get(cle(x.integration_id, 'domaine', x.parent_alh)) ?? null)
              : null,
          perimetreNom: x.perimetre_nom,
          perimetreAlh: x.perimetre_alh_nom,
          machines: l.machines,
          propositions: l.propositions,
          autresMachines: l.autresMachines,
          versionLiaisons: x.liaisons_version,
          services: sansAlertes(sv.slice(0, SERVICES_PAR_ACTIF_MAX)),
          nombreServices: sv.length,
        };
      }),
      alertes: alertes.map((a): AlerteCarteDto => ({
        id: a.id,
        type: a.type,
        criticite: a.criticite,
        titre: a.titre,
        cves: a.cves.slice(0, CARTE_SURFACE_BORNES.cvesParAlerte),
        priorite:
          prioriteLaPlusHaute(
            a.cves.map((c) => priorite(c, 'exposee', SurfaceExterneAlh.mene(a.actifs_cibles, menants))),
          )?.niveau ?? null,
        cible: a.cible_type || a.cible_valeur ? { type: a.cible_type, valeur: a.cible_valeur } : null,
        actifId:
          (a.cible_hote ? rendus.get(cle(a.integration_id, 'hote', a.cible_hote)) : undefined) ??
          (a.cible_domaine ? rendus.get(cle(a.integration_id, 'domaine', a.cible_domaine)) : undefined) ??
          null,
      })),
      tronquee: (actifs[0]?.total ?? 0) > actifs.length || (alertes[0]?.total ?? 0) > alertes.length,
      totaux: { actifs: actifs[0]?.total ?? 0, alertes: alertes[0]?.total ?? 0 },
    };
  }

  /* ---------------------------------------------------------------- Produits surveillés (lot ALH2) */
  /** Produits surveillés du registre (organisation, lisible avec vulnerabilites:lire), pour le rapprochement. */
  private async produitsSurveilles() {
    return (
      await this.db.k
        .selectFrom('vulnerabilites_produits')
        .select(['id', 'editeur', 'nom', 'version_produit', 'cpe'])
        .orderBy(sql`lower(editeur)`)
        .orderBy(sql`lower(nom)`)
        .orderBy(sql`lower(version_produit)`)
        .orderBy('id')
        .execute()
    ).map((p) => ({ id: p.id, editeur: p.editeur, nom: p.nom, versionProduit: p.version_produit, cpe: p.cpe }));
  }

  /** Technologies vues sur des actifs lisibles et rapprochées d'un produit surveillé (fiche du produit) : versions encore
      détectées et nombre d'actifs lisibles qui les portent. Indication seulement, sans décision ni effet sur la priorité. */
  async technologiesDuProduit(
    user: SessionUser,
    p: { editeur: string; nom: string; cpe: string | null; versionProduit: string },
  ): Promise<TechnologieRapprocheeDto[]> {
    const { rows } = await sql<{
      id: string;
      nom: string;
      editeur: string | null;
      produit: string | null;
      versions: string[];
      actifs: number;
    }>`${this.cteTechnologies(user)}
      SELECT t.id, t.nom, t.editeur, t.produit,
        coalesce((SELECT array_agg(DISTINCT l.version ORDER BY l.version) FROM liens l
                  WHERE l.technologie_id = t.id AND l.actuel), '{}') AS versions,
        (SELECT count(DISTINCT (l.actif_type, l.libelle))::int FROM liens l WHERE l.technologie_id = t.id AND l.actuel)
          AS actifs
      FROM vulnerabilites_alh_technologies t
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = t.integration_id
      WHERE ${present('t')} AND t.editeur IS NOT NULL AND t.produit IS NOT NULL
        AND EXISTS (SELECT 1 FROM liens l WHERE l.technologie_id = t.id AND l.actuel)
      ORDER BY lower(t.nom), t.id`.execute(this.db.k);
    return rows.flatMap((t): TechnologieRapprocheeDto[] => {
      const par = rapprochementTechnologie(t, p);
      return par
        ? [
            {
              id: t.id,
              nom: t.nom,
              editeur: t.editeur,
              produit: t.produit,
              versions: t.versions,
              actifs: t.actifs,
              par,
              memeVersion: memeVersionDetectee(t.versions, p.versionProduit),
            },
          ]
        : [];
    });
  }

  /* ---------------------------------------------------------------- Exposition d'une CVE (lot ALH2) */
  /** Ce qui porte les CVE demandées, pour la personne : actif lisible où tourne une version encore détectée d'une
      technologie touchée (ligne « technologie »), ou alerte ouverte et présente qui cite la CVE (ligne « alerte », avec
      l'actif qu'elle vise s'il est rangé). `actif_id` : actif rangé (null : inconnu de la cartographie) ; `cle` : identité
      de l'actif chez l'éditeur (instance, nature, identifiant), pour compter sans doublon. `user` null : tous les porteurs,
      sans droits (lot ALH5, décision A : la présence « exposée sur Internet » est un fait de la priorité, le même pour tout
      le monde) ; ces lignes ne servent alors qu'à un oui ou non et ne sont jamais rendues. */
  private async porteurs(user: SessionUser | null, cves: readonly string[], k: Kdb = this.db.k) {
    const lu = user ? lisible(user) : sql<boolean>`true`;
    const liste = [...new Set(cves)];
    if (!liste.length) return [];
    const { rows } = await sql<{
      cve: string;
      nature: 'technologie' | 'alerte';
      cle: string | null;
      actif_id: string | null;
      alerte_id: string | null;
      technologie_id: string | null;
    }>`
      SELECT tc.cve, 'technologie' AS nature, concat_ws('|', tt.integration_id, ta.actif_type, ta.actif_alh) AS cle,
        xa.id AS actif_id, NULL::uuid AS alerte_id, tt.id AS technologie_id
      FROM vulnerabilites_alh_technologie_cves tc
      JOIN vulnerabilites_alh_technologies tt ON tt.id = tc.technologie_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = tt.integration_id
      JOIN vulnerabilites_alh_technologie_actifs ta ON ta.technologie_id = tc.technologie_id AND ta.version = tc.version
        AND ta.actuel
      LEFT JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = tt.integration_id AND xa.type = ta.actif_type
        AND xa.alh_id = ta.actif_alh
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = tt.integration_id AND lp.alh_id = xa.perimetre_alh
      WHERE tc.cve = ANY(${liste}::text[]) AND tt.vu_numero >= coalesce(e.numero_complet, 0) AND ${lu}
      UNION ALL
      SELECT ac.cve, 'alerte', CASE WHEN a.cible_hote IS NOT NULL THEN concat_ws('|', a.integration_id, 'hote', a.cible_hote)
                                    WHEN a.cible_domaine IS NOT NULL THEN concat_ws('|', a.integration_id, 'domaine', a.cible_domaine)
                                    END,
        xa.id, a.id, NULL::uuid
      FROM vulnerabilites_alh_alerte_cves ac
      JOIN vulnerabilites_alh_alertes a ON a.id = ac.alerte_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = a.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = a.integration_id AND lp.alh_id = a.perimetre_alh
      LEFT JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = a.integration_id
        AND ((xa.type = 'hote' AND xa.alh_id = a.cible_hote) OR (xa.type = 'domaine' AND xa.alh_id = a.cible_domaine))
      WHERE ac.cve = ANY(${liste}::text[]) AND ${present('a')} AND a.statut = ANY(${OUVERTS}::text[])
        AND ${lu}`.execute(k);
    return rows;
  }

  /** Pour les alertes du module (lot V6) : toutes les CVE exposées sur Internet (version encore détectée d'une technologie
      présente, ou alerte ouverte et présente qui la cite), sur tous les faits connus et sans droits (décision A du lot
      ALH5), avec les actifs qui les portent : `cles` (instance, nature, identifiant chez l'éditeur, pour compter sans
      doublon) et `actifs` (identifiants internes rangés, pour la majoration seulement). Rien n'est rendu tel quel. `k` :
      la transaction de l'appelant (une synchronisation en cours y est visible). */
  async expositionsGlobales(k: Kdb = this.db.k): Promise<Map<string, { cles: Set<string>; actifs: Set<string> }>> {
    const { rows } = await sql<{ cve: string }>`
      SELECT DISTINCT x.cve FROM (${cvesAlh}) x
      UNION
      SELECT ac.cve FROM vulnerabilites_alh_alerte_cves ac
      JOIN vulnerabilites_alh_alertes a ON a.id = ac.alerte_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = a.integration_id
      WHERE ${present('a')} AND a.statut = ANY(${OUVERTS}::text[])`.execute(k);
    const out = new Map<string, { cles: Set<string>; actifs: Set<string> }>();
    if (!rows.length) return out;
    for (const r of await this.porteurs(
      null,
      rows.map((x) => x.cve),
      k,
    )) {
      let x = out.get(r.cve);
      if (!x) out.set(r.cve, (x = { cles: new Set(), actifs: new Set() }));
      if (r.cle) x.cles.add(r.cle);
      if (r.actif_id) x.actifs.add(r.actif_id);
    }
    return out;
  }

  /** Pour la veille : sur combien d'actifs lisibles chaque CVE est vue, et par combien d'alertes ouvertes lisibles ;
      `horsLecture` (lot ALH5) : elle l'est aussi sur un actif ou par une alerte que la personne ne lit pas (sans nom ni
      nombre). Une CVE que la surface externe ne porte pas du tout est absente de la table rendue. */
  async surfaceDesCves(user: SessionUser, cves: readonly string[]): Promise<Map<string, SurfaceCveDto>> {
    const compter = (lignes: Awaited<ReturnType<SurfaceExterneAlh['porteurs']>>) => {
      const par = new Map<string, { actifs: Set<string>; alertes: Set<string> }>();
      for (const r of lignes) {
        let x = par.get(r.cve);
        if (!x) par.set(r.cve, (x = { actifs: new Set(), alertes: new Set() }));
        if (r.cle) x.actifs.add(r.cle);
        if (r.alerte_id) x.alertes.add(r.alerte_id);
      }
      return par;
    };
    const lus = compter(await this.porteurs(user, cves));
    const tous = compter(await this.porteurs(null, cves));
    return new Map(
      [...tous].map(([cve, t]) => {
        const l = lus.get(cve) ?? { actifs: new Set<string>(), alertes: new Set<string>() };
        const horsLecture =
          [...t.actifs].some((x) => !l.actifs.has(x)) || [...t.alertes].some((x) => !l.alertes.has(x));
        return [cve, { actifs: l.actifs.size, alertes: l.alertes.size, horsLecture }];
      }),
    );
  }

  /** Pour la fiche d'une faille (lot PC4) : sur combien d'actifs lisibles les CVE sont vues (actifs distincts), si elles le
      sont aussi ailleurs (`horsLecture`, drapeau sans nombre, lot ALH5), et les recommandations de l'éditeur (défauts et
      résolutions) des alertes ouvertes, présentes et lisibles qui les citent, les plus graves d'abord (`limite` au plus).
      Deux lectures de porteurs et une des alertes, quel que soit le nombre de CVE. */
  async expositionFiche(
    user: SessionUser,
    cves: readonly string[],
    limite: number,
  ): Promise<{
    /** Exposée sur Internet, quels que soient les droits (oui ou non, sans nom ni nombre ; lot ALH5). */
    exposee: boolean;
    actifs: number;
    horsLecture: boolean;
    alertes: { id: string; titre: string; defauts: DefautAlh[] }[];
    alertesTronquees: boolean;
  }> {
    if (!cves.length) return { exposee: false, actifs: 0, horsLecture: false, alertes: [], alertesTronquees: false };
    const lus = await this.porteurs(user, cves);
    const tous = await this.porteurs(null, cves);
    const cle = (r: (typeof lus)[number]) => `${r.nature}|${r.cle}|${r.alerte_id}|${r.technologie_id}`;
    const vus = new Set(lus.map(cle));
    const actifs = new Set(lus.flatMap((r) => (r.cle ? [r.cle] : [])));
    const ids = [...new Set(lus.flatMap((r) => (r.alerte_id ? [r.alerte_id] : [])))];
    const lignes = ids.length
      ? (
          await sql<{ id: string; titre: string; defauts: unknown }>`
            SELECT a.id, a.titre, a.defauts FROM vulnerabilites_alh_alertes a
            WHERE a.id = ANY(${ids}::uuid[]) AND jsonb_array_length(a.defauts) > 0
            ORDER BY CASE a.criticite WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'important' THEN 2
                     WHEN 'minor' THEN 3 ELSE 4 END, coalesce(a.maj_alh_le, a.cree_alh_le) DESC NULLS LAST, a.id
            LIMIT ${limite + 1}`.execute(this.db.k)
        ).rows
      : [];
    return {
      exposee: tous.length > 0,
      actifs: actifs.size,
      horsLecture: tous.some((r) => !vus.has(cle(r))),
      alertes: lignes.slice(0, limite).flatMap((a) => {
        const d = DefautsAlh.safeParse(a.defauts);
        return d.success && d.data.length ? [{ id: a.id, titre: a.titre, defauts: d.data as DefautAlh[] }] : [];
      }),
      alertesTronquees: lignes.length > limite,
    };
  }

  /** Pour l'assistant (décision C) : exposition d'une CVE lisible par la personne. Rend les actifs rangés qui la portent
      (identifiants internes seulement : l'appelant les remplace par des repères), le nombre d'actifs sans fiche, les
      technologies touchées (nom, éditeur, produit, versions, ce qu'en dit l'éditeur) et les alertes ouvertes qui la citent
      (criticité, type, statut, titre, défauts). Ni domaine, ni adresse, ni nom de périmètre, ni FAI, ni AS. `exposee`
      (lot ALH5, décision A) : la CVE est exposée sur Internet, quels que soient les droits de la personne (oui ou non,
      sans nom ni nombre) ; `horsLecture` : elle l'est aussi ailleurs que sur ce que la personne lit. */
  async exposition(user: SessionUser, cve: string) {
    const lignes = await this.porteurs(user, [cve]);
    const toutes = await this.porteurs(null, [cve]);
    const lues = new Set(lignes.map((r) => `${r.nature}|${r.cle}|${r.alerte_id}|${r.technologie_id}`));
    const actifs = new Map<string, string | null>();
    for (const r of lignes) if (r.cle && !actifs.has(r.cle)) actifs.set(r.cle, r.actif_id);
    const techIds = [...new Set(lignes.flatMap((r) => (r.technologie_id ? [r.technologie_id] : [])))];
    const alerteIds = [...new Set(lignes.flatMap((r) => (r.alerte_id ? [r.alerte_id] : [])))];
    const technologies = techIds.length
      ? (
          await sql<{
            nom: string;
            editeur: string | null;
            produit: string | null;
            versions: string[];
            exploitee: boolean;
            preuve: boolean;
            cvss: string | null;
            epss: string | null;
          }>`SELECT t.nom, t.editeur, t.produit, array_agg(DISTINCT tc.version ORDER BY tc.version) AS versions,
                    bool_or(coalesce(tc.exploitee, false)) AS exploitee, bool_or(coalesce(tc.preuve, false)) AS preuve,
                    max(tc.cvss) AS cvss, max(tc.epss) AS epss
             FROM vulnerabilites_alh_technologies t
             JOIN vulnerabilites_alh_technologie_cves tc ON tc.technologie_id = t.id AND tc.cve = ${cve}
             WHERE t.id = ANY(${techIds}::uuid[])
               AND EXISTS (SELECT 1 FROM vulnerabilites_alh_technologie_actifs ta WHERE ta.technologie_id = t.id
                           AND ta.version = tc.version AND ta.actuel)
             GROUP BY t.id ORDER BY lower(t.nom), t.id`.execute(this.db.k)
        ).rows
      : [];
    const alertes = alerteIds.length
      ? (
          await sql<{
            id: string;
            criticite: CriticiteAlh | null;
            type: TypeAlerteAlh | null;
            statut: StatutAlerteAlh;
            titre: string;
            defauts: unknown;
          }>`SELECT a.id, a.criticite, a.type, a.statut, a.titre, a.defauts FROM vulnerabilites_alh_alertes a
             WHERE a.id = ANY(${alerteIds}::uuid[])
             ORDER BY CASE a.criticite WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'important' THEN 2
                      WHEN 'minor' THEN 3 ELSE 4 END, coalesce(a.maj_alh_le, a.cree_alh_le) DESC NULLS LAST, a.id`.execute(
            this.db.k,
          )
        ).rows.map((a) => {
          const d = DefautsAlh.safeParse(a.defauts);
          return { ...a, defauts: d.success ? (d.data as DefautAlh[]) : [] };
        })
      : [];
    return {
      exposee: toutes.length > 0,
      horsLecture: toutes.some((r) => !lues.has(`${r.nature}|${r.cle}|${r.alerte_id}|${r.technologie_id}`)),
      actifs: [...actifs.values()],
      technologies: technologies.map((t) => ({
        ...t,
        cvss: nombre(t.cvss),
        epss: nombre(t.epss),
      })),
      alertes,
    };
  }

  /** Pour le masque de l'assistant (décision C) : toutes les valeurs qui désignent un actif de la surface externe
      (domaine, adresse, adresse vers laquelle un domaine résout, libellé d'un actif d'une technologie, cible d'une alerte
      de nature domaine ou hôte), quelle que soit la synchronisation qui les a vues, avec l'actif rangé qu'elles désignent
      (null : aucun) et sa lisibilité pour la personne. */
  async actifsAMasquer(user: SessionUser): Promise<{ id: string | null; valeurs: string[]; lisible: boolean }[]> {
    const { rows } = await sql<{ id: string; valeur: string; adresse: string | null; lisible: boolean }>`
      SELECT x.id, x.valeur, x.adresse, ${lisible(user)} AS lisible
      FROM vulnerabilites_alh_actifs x
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh`.execute(
      this.db.k,
    );
    const { rows: autres } = await sql<{ id: string | null; valeur: string }>`
      SELECT xa.id, ta.libelle AS valeur
      FROM vulnerabilites_alh_technologie_actifs ta
      JOIN vulnerabilites_alh_technologies t ON t.id = ta.technologie_id
      LEFT JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = t.integration_id AND xa.type = ta.actif_type
        AND xa.alh_id = ta.actif_alh
      UNION
      SELECT xa.id, a.cible_valeur
      FROM vulnerabilites_alh_alertes a
      LEFT JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = a.integration_id
        AND ((xa.type = 'hote' AND xa.alh_id = a.cible_hote) OR (xa.type = 'domaine' AND xa.alh_id = a.cible_domaine))
      WHERE a.cible_valeur IS NOT NULL AND a.cible_type IN ('domain', 'host')`.execute(this.db.k);
    const parId = new Map(
      rows.map((r) => [r.id, { id: r.id, valeurs: [r.valeur, ...(r.adresse ? [r.adresse] : [])], lisible: r.lisible }]),
    );
    const orphelines: { id: null; valeurs: string[]; lisible: false }[] = [];
    for (const a of autres) {
      const x = a.id ? parId.get(a.id) : undefined;
      if (x) {
        if (!x.valeurs.includes(a.valeur)) x.valeurs.push(a.valeur);
      } else orphelines.push({ id: null, valeurs: [a.valeur], lisible: false });
    }
    return [...parId.values(), ...orphelines];
  }

  /** Pour le masque de l'assistant (décision C) : fournisseurs d'accès et numéros d'AS des hôtes (« 64500 » et « AS64500 »),
      qui ne doivent pas partir non plus. */
  async reseauxAMasquer(): Promise<string[]> {
    const { rows } = await sql<{ fai: string | null; asn: string | null }>`
      SELECT DISTINCT fai, asn FROM vulnerabilites_alh_actifs WHERE fai IS NOT NULL OR asn IS NOT NULL`.execute(
      this.db.k,
    );
    return [...new Set(rows.flatMap((r) => [...(r.fai ? [r.fai] : []), ...(r.asn ? [r.asn, `AS${r.asn}`] : [])]))];
  }

  /* ---------------------------------------------------------------- Périmètres ALH (vulnerabilites:administrer) */
  async perimetres(id?: string, k: Kdb = this.db.k): Promise<PerimetreAlhDto[]> {
    const { rows } = await sql<{
      id: string;
      nom: string;
      perimetre_id: string | null;
      perimetre_nom: string | null;
      present: boolean;
      alertes: number;
      actifs: number;
      version: number;
      maj_par: string | null;
      maj_le: Date;
      integration_id: string;
      integration_nom: string;
    }>`
      SELECT lp.id, lp.nom, lp.perimetre_id, sm.name AS perimetre_nom, ${present('lp')} AS present,
        (SELECT count(*)::int FROM vulnerabilites_alh_alertes a WHERE a.integration_id = lp.integration_id
           AND a.perimetre_alh = lp.alh_id AND ${present('a')}) AS alertes,
        (SELECT count(*)::int FROM vulnerabilites_alh_actifs x WHERE x.integration_id = lp.integration_id
           AND x.perimetre_alh = lp.alh_id AND ${present('x')}) AS actifs,
        lp.version, lp.maj_par, lp.maj_le, lp.integration_id, i.nom AS integration_nom
      FROM vulnerabilites_alh_perimetres lp
      JOIN integrations i ON i.id = lp.integration_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = lp.integration_id
      LEFT JOIN grc_smsis sm ON sm.id = lp.perimetre_id
      WHERE ${id ? sql<boolean>`lp.id = ${id}::uuid` : sql<boolean>`true`}
      ORDER BY ${present('lp')} DESC, lower(lp.nom), lp.id`.execute(k);
    return rows.map((p) => ({
      id: p.id,
      nom: p.nom,
      perimetreId: p.perimetre_id,
      perimetreNom: p.perimetre_nom,
      present: p.present,
      alertes: p.alertes,
      actifs: p.actifs,
      version: p.version,
      majPar: p.maj_par,
      majLe: p.maj_le.toISOString(),
      integration: { id: p.integration_id, nom: p.integration_nom },
    }));
  }

  /** Relier (ou délier) un périmètre ALH : If-Match ; écriture exigée sur le périmètre actuel et sur le périmètre visé. */
  async lier(
    id: string,
    corps: LiaisonPerimetreAlh,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<PerimetreAlhDto> {
    const p = LiaisonPerimetreAlh.parse(corps);
    await this.db.tx(async (c, k) => {
      const lp = await k
        .selectFrom('vulnerabilites_alh_perimetres')
        .select(['id', 'integration_id', 'perimetre_id', 'version', 'maj_par'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!lp) throw new HttpError(404, 'Périmètre AlgoLightHouse introuvable.');
      if (lp.version !== attendue)
        throw conflict({ ...(await this.perimetres(id, k))[0]!, updated_by: lp.maj_par ?? '' });
      if (lp.perimetre_id === p.perimetreId) return;
      if (lp.perimetre_id) await this.g.access(lp.perimetre_id, user, true, c);
      if (p.perimetreId)
        await this.g.access(p.perimetreId, user, true, c).catch((e: unknown) => {
          if (e instanceof HttpError && e.status === 404)
            throw new HttpError(422, 'Périmètre introuvable ou non accessible.');
          throw e;
        });
      const apres = await k
        .updateTable('vulnerabilites_alh_perimetres')
        .set((eb) => ({
          perimetre_id: p.perimetreId,
          version: eb('version', '+', 1),
          maj_le: sql<Date>`now()`,
          maj_par: user.username,
        }))
        .where('id', '=', id)
        .returning('version')
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        p.perimetreId ? 'vulnerabilites.surface.perimetre.relie' : 'vulnerabilites.surface.perimetre.delie',
        id,
        {
          integration: lp.integration_id,
          avant: { perimetreId: lp.perimetre_id },
          apres: { perimetreId: p.perimetreId },
          version: apres.version,
        },
        c,
      );
    }, user.username);
    return (await this.perimetres(id))[0]!;
  }
}
