/* Module Vulnérabilités, service de lecture pour l'assistant RSSI (ADR 0100, décisions V5, V14, V25, V28, V29 ; point 11 ;
   ADR 0086). L'assistant ne lit aucune table du module en direct : il appelle ce service, avec la personne qui l'interroge,
   et ne reçoit que ce que ce service rend, déjà borné et anonymisé.
   - Rien d'identifiant sur une machine ne part chez le fournisseur du modèle : ni nom, ni adresse, ni identifiant de la
     source, ni rôle, ni périmètre de la machine, ni système. Chaque machine est un repère (« M-001 ») de la conversation,
     stable d'un tour à l'autre, attribué seulement à une machine que la personne peut lire (droit `vulnerabilites:lire` et
     droits du périmètre) ; une machine non lisible n'a pas de repère et ne compte pas. La table de correspondance reste sur
     le serveur, supprimée avec la conversation.
   - Peuvent partir : identifiants CVE, faits publiés par les sources (dates, gravités, scores, exploitation), titres d'avis
     bornés, nom et version des produits surveillés, numéro et nom des contrôles de Tenable, correctifs publiés, priorité et
     rang calculés par la plateforme, compteurs.
   - Le texte du modèle est gardé avec ses repères (messages, propositions) ; les noms ne sont remis qu'à l'affichage, pour la
     personne qui regarde et selon ses droits, et à la confirmation d'une proposition (V29), sur le serveur, sans retour vers
     le modèle.
   - Masque de sortie (masque.ts) : construit ici à partir de l'inventaire, il remplace tout nom, adresse ou identifiant de
     machine qui figurerait encore dans une demande au modèle ; un mot de la liste à ne pas masquer (V31) qui apparaît seul
     est laissé tel quel.
   Journal : `assistant.vulnerabilites.*`, identifiants et nombres seulement, jamais un nom, une adresse ni un repère.
   Lot ALH2 (décision C du RSSI du 17/11/2026) : surface externe (AlgoLightHouse). Un actif exposé (domaine ou adresse) n'est
   remis au modèle que sous un repère « E-001 », attribué comme ceux des machines (table propre, gardée sur le serveur) ;
   partent aussi des compteurs, le nom, l'éditeur et les versions des technologies touchées, ce que l'éditeur dit des CVE,
   la criticité, le type, le statut et le titre des alertes, et les recommandations de l'éditeur (bornées). Ne partent
   jamais : domaine, adresse, nom de périmètre, FAI, AS. Le masque couvre en plus tous les domaines et adresses de la surface
   externe (et les sous-domaines d'un domaine connu), les fournisseurs d'accès et les numéros d'AS des hôtes, AVANT tout
   envoi : un titre, une recommandation ou une question qui les citerait part avec un repère, « [actif externe] » ou
   « [réseau externe] ».
   Lot ASSISTANT-V1 (décisions du RSSI du 20/11/2026) : failles_prioritaires rend les cibles du tableau « Cibles par
   priorité » de la vue d'ensemble (même calcul, même ordre, mêmes droits de lecture), produits à confirmer signalés ;
   machines_prioritaires rend aussi les actifs exposés (repères « E-… ») ; la rubrique « Quoi faire » d'evaluer_cve porte le
   contenu de chaque source, source nommée, sans renvoi interne. Rien de plus ne part : repères et compteurs, jamais un nom,
   une adresse, un domaine, un rôle ni un périmètre. */
import {
  calculerPriorite,
  type CibleVueDto,
  type ConstatDto,
  DecisionPropositionVulnBody,
  ETAT_SUIVI_LIBELLES,
  type EtatPropositionVuln,
  type EtatSuiviFaille,
  faitsDepuisSources,
  GRAVITE_TENABLE_LIBELLES,
  libelleFaitPriorite,
  libelleFaitRang,
  type MachineDto,
  MOTIF_PROPOSITION_LIBELLES,
  type MotifProposition,
  type NatureSuivi,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  numeroRepere,
  numeroRepereExterne,
  type Presence,
  PRESENCE_LIBELLES,
  type Priorite,
  PROPOSITION_VULN_MACHINES_MAX,
  type PropositionVulnerabiliteDto,
  repereExterne,
  repereMachine,
  REPERES_MAX,
  reperesCites,
  type ResolutionRepere,
  SOURCE_EXPLOITABLE_LIBELLES,
  SOURCE_EXPLOITATION_LIBELLES,
  SOURCE_VALEUR_LIBELLES,
  STATUT_RAPPROCHEMENT_LIBELLES,
  type StatutRapprochement,
  type SourcesFailleDto,
  decouperReperes,
  texteDesSegments,
  valeursRetenues,
  CRITICITE_ALH_LIBELLES,
  STATUT_ALERTE_ALH_LIBELLES,
  TYPE_ALERTE_ALH_LIBELLES,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { creerMasque, type MachineAMasquer, type Masquer } from '../assistant/masque.js';
import type { LectureVulnerabilites } from '../assistant/outils.js';
import type { Db, Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { FaillesDetectees } from './failles.js';
import type { MotsNonMasquesVulnerabilites } from './mots-non-masques.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { lireFaitsCve, publicationsDe, sourcesDe } from './sources.js';
import { lisible, lisibleAlh, present } from './sql.js';
import type { SuiviFailles } from './suivi.js';
import type { SurfaceExterneAlh } from './surface-externe.js';
import type { VueEnsembleVulnerabilites } from './vue-ensemble.js';

/** Remplacement d'un actif exposé qui n'a pas de repère (ronde, actif non lisible, valeur sans fiche). */
export const ACTIF_EXTERNE_MASQUE = '[actif externe]';
/** Remplacement d'un fournisseur d'accès ou d'un numéro d'AS d'un hôte exposé. */
export const RESEAU_EXTERNE_MASQUE = '[réseau externe]';
/** Mention de la rubrique « Quoi faire » d'evaluer_cve quand aucune source lue ne publie de correctif (lot ASSISTANT-V1). */
export const QUOI_FAIRE_SANS_CORRECTIF = 'aucun correctif publié par les sources lues';

/** Bornes de ce qui est remis au modèle. */
export const BORNES_ASSISTANT_VULN = {
  /** Machines rendues au plus par machines_prioritaires. */
  machines: 30,
  /** Failles rendues au plus par failles_prioritaires (une page des listes du module). */
  failles: 25,
  /** Repères par constat ou par produit dans evaluer_cve. */
  reperesParFaille: 20,
  /** Avis, constats et produits au plus dans evaluer_cve. */
  avis: 10,
  constats: 10,
  produits: 10,
  /** Surface externe (lot ALH2) : repères d'actifs, technologies, alertes, défauts par alerte, résolutions par défaut. */
  reperesExternes: 20,
  technologies: 10,
  alertes: 5,
  defauts: 3,
  resolutions: 3,
  /** Propositions par conversation (toutes), en attente par conversation, en attente par personne. */
  propositionsConversation: 10,
  propositionsEnAttenteConversation: 5,
  propositionsEnAttentePersonne: 30,
} as const;

const coupe = (s: string | null | undefined, max: number) =>
  s ? (s.length > max ? `${s.slice(0, max - 1)}…` : s) : null;
const jour = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
const etatSuivi = (e: EtatSuiviFaille) => ETAT_SUIVI_LIBELLES[e];
const priorite = (p: Priorite) => ({ niveau: p.niveau, faits: p.faits.map(libelleFaitPriorite) });
const ORDRE_NIVEAU = (p: Priorite) => Number(p.niveau.slice(1));

/** Faits par source, avec leurs dates (V26, V27) : ce qui peut partir chez le fournisseur du modèle. */
function faitsDesSources(s: SourcesFailleDto) {
  const r = valeursRetenues(s.valeurs);
  return {
    exploitationAveree: s.exploitation.map((x) => ({ source: SOURCE_EXPLOITATION_LIBELLES[x.source], le: jour(x.le) })),
    exploitable: s.exploitable.map((x) => ({ source: SOURCE_EXPLOITABLE_LIBELLES[x.source], le: jour(x.le) })),
    gravites: s.valeurs.gravites.map((x) => ({
      source: SOURCE_VALEUR_LIBELLES[x.source],
      gravite: GRAVITE_TENABLE_LIBELLES[x.gravite],
    })),
    scoresCvss: s.valeurs.cvss.map((x) => ({ source: SOURCE_VALEUR_LIBELLES[x.source], score: x.score })),
    scoresEpss: s.valeurs.epss.map((x) => ({ source: SOURCE_VALEUR_LIBELLES[x.source], score: x.score })),
    retenues: {
      gravite: r.gravite
        ? { valeur: GRAVITE_TENABLE_LIBELLES[r.gravite.gravite], source: SOURCE_VALEUR_LIBELLES[r.gravite.source] }
        : null,
      cvss: r.cvss ? { valeur: r.cvss.score, source: SOURCE_VALEUR_LIBELLES[r.cvss.source] } : null,
      epss: r.epss ? { valeur: r.epss.score, source: SOURCE_VALEUR_LIBELLES[r.epss.source] } : null,
    },
    ficheCertSante: s.certSante
      ? { correctifExiste: s.certSante.correctif, contournementExiste: s.certSante.contournement }
      : null,
  };
}

/** Machine telle que remise au modèle : repère, rang et compteurs, sans rôle ni rien d'identifiant. */
function machinePourModele(m: MachineDto, repere: string | null) {
  return {
    repere,
    rang: m.rang.position,
    rangSur: m.rang.total,
    // Faits du rang, sans le rôle (il entre dans le calcul local et ne sort pas du serveur, V14).
    faits: m.rang.faits.filter((f) => f.fait !== 'role').map(libelleFaitRang),
    compteurs: {
      critiques: m.compteurs.critique,
      elevees: m.compteurs.elevee,
      moyennes: m.compteurs.moyenne,
      faibles: m.compteurs.faible,
      exploitationAveree: m.compteurs.exploitationAveree,
      exploitables: m.compteurs.exploitables,
      declarees: m.compteurs.declarees,
    },
  };
}

/** Faille du tableau « Cibles par priorité » telle que remise au modèle (lot ASSISTANT-V1) : CVE, titre et produit publiés
    par les sources (ou nom du contrôle de Tenable, ou produit surveillé), priorité, présences, faits, état de suivi et nombres
    que la personne lit ; la fiche qu'elle peut ouvrir (nature et identifiant), s'il y en a une. Ni nom de machine, ni
    domaine, ni adresse, ni périmètre. */
function faillePourModele(c: CibleVueDto, i: number) {
  return {
    rang: i + 1,
    cve: c.cve,
    titre: coupe(c.titre, 200),
    produit: coupe(c.produit, 100),
    priorite: priorite(c.priorite),
    presences: c.presences.map((p) => PRESENCE_LIBELLES[p]),
    ...(c.presences.includes('a_confirmer') ? { produitAConfirmer: true } : {}),
    ...(c.aConfirmer ? { seulementAConfirmer: true } : {}),
    exploitee: c.exploitee,
    exploitable: c.exploitable,
    gravite: c.gravite ? GRAVITE_TENABLE_LIBELLES[c.gravite] : null,
    epss: c.epss,
    etatSuivi: c.etat ? etatSuivi(c.etat) : null,
    machinesLisibles: c.machines.lisibles,
    ...(c.machines.horsLecture ? { machinesAussiHorsDeVosDroits: true } : {}),
    actifsExposesLisibles: c.actifs.lisibles,
    ...(c.actifs.horsLecture ? { actifsAussiHorsDeVosDroits: true } : {}),
    ...(c.fiche ? { nature: c.fiche.nature, id: c.fiche.id } : {}),
  };
}

export class AssistantVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly failles: FaillesDetectees,
    private readonly suivi: SuiviFailles,
    private readonly reglage: ReglagePrioriteVulnerabilites,
    private readonly nonMasques: MotsNonMasquesVulnerabilites,
    /** Lot ASSISTANT-V1 : cibles du tableau « Cibles par priorité » de la vue d'ensemble (failles_prioritaires) et CVE
        exposées sur Internet dans leur ordre (machines_prioritaires). */
    private readonly vue: Pick<VueEnsembleVulnerabilites, 'cibles'>,
    /** Surface externe (lot ALH2) : exposition d'une CVE et actifs à masquer. */
    private readonly surface: SurfaceExterneAlh | null = null,
  ) {}

  /** La personne lit le module (droit, module actif : les droits de la session tiennent compte de l'activation). */
  private static lit(user: SessionUser): boolean {
    return user.rights.can('vulnerabilites', 'lire');
  }

  /* ---------------------------------------------------------------- Repères */
  /** Repères des machines (lisibles par la personne : à vérifier par l'appelant), attribués au besoin dans la conversation.
      Stables : une machine garde son repère ; jamais réattribués. Au-delà de REPERES_MAX, pas de repère. */
  async reperes(conversationId: string, machineIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(machineIds)];
    if (!ids.length) return new Map();
    return this.db.tx(async (_c, k) => {
      // Verrou de la conversation : deux attributions simultanées ne prennent pas le même numéro.
      const conv = await k
        .selectFrom('assistant_conversations')
        .select('id')
        .where('id', '=', conversationId)
        .forUpdate()
        .executeTakeFirst();
      if (!conv) throw new HttpError(404, 'Conversation introuvable.');
      const connus = await k
        .selectFrom('vulnerabilites_assistant_reperes')
        .select(['numero', 'machine_id'])
        .where('conversation_id', '=', conversationId)
        .where('machine_id', 'in', ids)
        .execute();
      const out = new Map(connus.map((r) => [r.machine_id!, repereMachine(r.numero)]));
      const { max } = await k
        .selectFrom('vulnerabilites_assistant_reperes')
        .select(sql<number>`coalesce(max(numero), 0)::int`.as('max'))
        .where('conversation_id', '=', conversationId)
        .executeTakeFirstOrThrow();
      let suivant = max + 1;
      for (const id of ids) {
        if (out.has(id) || suivant > REPERES_MAX) continue;
        await k
          .insertInto('vulnerabilites_assistant_reperes')
          .values({ conversation_id: conversationId, numero: suivant, machine_id: id })
          .execute();
        out.set(id, repereMachine(suivant++));
      }
      return out;
    }, 'assistant');
  }

  /** Repères des actifs exposés (lisibles par la personne : à vérifier par l'appelant), même règle que reperes() : stables,
      jamais réattribués, 999 au plus par conversation (lot ALH2). */
  async reperesExternes(conversationId: string, actifIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(actifIds)];
    if (!ids.length) return new Map();
    return this.db.tx(async (_c, k) => {
      const conv = await k
        .selectFrom('assistant_conversations')
        .select('id')
        .where('id', '=', conversationId)
        .forUpdate()
        .executeTakeFirst();
      if (!conv) throw new HttpError(404, 'Conversation introuvable.');
      const connus = await k
        .selectFrom('vulnerabilites_assistant_reperes_externes')
        .select(['numero', 'actif_id'])
        .where('conversation_id', '=', conversationId)
        .where('actif_id', 'in', ids)
        .execute();
      const out = new Map(connus.map((r) => [r.actif_id!, repereExterne(r.numero)]));
      const { max } = await k
        .selectFrom('vulnerabilites_assistant_reperes_externes')
        .select(sql<number>`coalesce(max(numero), 0)::int`.as('max'))
        .where('conversation_id', '=', conversationId)
        .executeTakeFirstOrThrow();
      let suivant = max + 1;
      for (const id of ids) {
        if (out.has(id) || suivant > REPERES_MAX) continue;
        await k
          .insertInto('vulnerabilites_assistant_reperes_externes')
          .values({ conversation_id: conversationId, numero: suivant, actif_id: id })
          .execute();
        out.set(id, repereExterne(suivant++));
      }
      return out;
    }, 'assistant');
  }

  /** Résolution des repères d'une conversation pour la personne qui regarde : nom (ou adresse) si elle lit la machine,
      domaine ou adresse si elle lit l'actif exposé (lot ALH2), « non lisible » si le repère désigne une machine ou un actif
      qu'elle ne lit pas (ou effacé), « inconnu » sinon. */
  async resolveur(user: SessionUser, conversationId: string): Promise<(repere: string) => ResolutionRepere> {
    const lit = AssistantVulnerabilites.lit(user);
    const { rows } = await sql<{ numero: number; nom: string | null; adresse: string | null; lisible: boolean | null }>`
      SELECT r.numero, m.nom, m.adresse, CASE WHEN m.id IS NULL THEN NULL ELSE ${lisible(user)} END AS lisible
      FROM vulnerabilites_assistant_reperes r
      LEFT JOIN vulnerabilites_machines m ON m.id = r.machine_id
      WHERE r.conversation_id = ${conversationId}::uuid`.execute(this.db.k);
    const table = new Map(rows.map((r) => [r.numero, r]));
    const { rows: externes } = await sql<{ numero: number; valeur: string | null; lisible: boolean | null }>`
      SELECT r.numero, x.valeur, CASE WHEN x.id IS NULL THEN NULL ELSE ${lisibleAlh(user)} END AS lisible
      FROM vulnerabilites_assistant_reperes_externes r
      LEFT JOIN vulnerabilites_alh_actifs x ON x.id = r.actif_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      WHERE r.conversation_id = ${conversationId}::uuid`.execute(this.db.k);
    const tableExterne = new Map(externes.map((r) => [r.numero, r]));
    return (repere) => {
      if (repere.startsWith('E-')) {
        const n = numeroRepereExterne(repere);
        const x = n === null ? undefined : tableExterne.get(n);
        if (!x) return 'inconnu';
        if (!lit || !x.lisible || !x.valeur) return 'non_lisible';
        return { machine: x.valeur };
      }
      const n = numeroRepere(repere);
      const r = n === null ? undefined : table.get(n);
      if (!r) return 'inconnu';
      if (!lit || !r.lisible) return 'non_lisible';
      return { machine: r.nom ?? r.adresse ?? repere };
    };
  }

  /** Masque de sortie pour une demande au modèle : en conversation, repère pour une machine lisible par la personne ; en
      ronde (pas de conversation), « [machine] » pour toutes. La liste de mots à ne pas masquer (V31) vaut pour les deux ;
      illisible, elle est vide (masque strict). */
  async masque(user: SessionUser, conversationId: string | null): Promise<Masquer> {
    const lit = AssistantVulnerabilites.lit(user) && conversationId !== null;
    const { rows } = await sql<{
      id: string;
      nom: string | null;
      adresse: string | null;
      uuid_source: string | null;
      identifiant_source: string;
      lisible: boolean;
    }>`SELECT m.id, m.nom, m.adresse, m.uuid_source::text AS uuid_source, m.identifiant_source,
              ${lisible(user)} AS lisible
       FROM vulnerabilites_machines m`.execute(this.db.k);
    const machines: MachineAMasquer[] = rows.map((m) => ({
      id: m.id,
      nom: m.nom,
      adresse: m.adresse,
      identifiants: [m.identifiant_source, ...(m.uuid_source ? [m.uuid_source] : [])],
      lisible: lit && m.lisible,
    }));
    // Surface externe (lot ALH2) : domaines et adresses d'AlgoLightHouse, qui ne sont pas dans l'inventaire des machines.
    // Toujours protégés (jamais démasqués par la liste V31) ; un sous-domaine d'un domaine connu l'est aussi.
    const PREFIXE = 'alh:';
    const externes: MachineAMasquer[] = this.surface
      ? (await this.surface.actifsAMasquer(user)).map((x, i) => {
          const valeurs = [...new Set(x.valeurs.flatMap((v) => (v.startsWith('*.') ? [v, v.slice(2)] : [v])))];
          return {
            id: x.id ? `${PREFIXE}${x.id}` : `${PREFIXE}sans-fiche-${i}`,
            nom: null,
            adresse: null,
            identifiants: valeurs,
            domaines: valeurs.filter((v) => v.includes('.') && !/^[0-9.]+$/.test(v) && !v.includes(':')),
            lisible: lit && x.id !== null && x.lisible,
            masque: ACTIF_EXTERNE_MASQUE,
          };
        })
      : [];
    // Fournisseurs d'accès et numéros d'AS des hôtes : jamais de repère.
    const reseaux: MachineAMasquer[] = this.surface
      ? (await this.surface.reseauxAMasquer()).map((v, i) => ({
          id: `reseau:${i}`,
          nom: null,
          adresse: null,
          identifiants: [v],
          lisible: false,
          masque: RESEAU_EXTERNE_MASQUE,
        }))
      : [];
    return creerMasque(
      [...machines, ...externes, ...reseaux],
      conversationId
        ? async (ids) => {
            const out = await this.reperes(
              conversationId,
              ids.filter((id) => !id.startsWith(PREFIXE)),
            );
            const ext = await this.reperesExternes(
              conversationId,
              ids.filter((id) => id.startsWith(PREFIXE)).map((id) => id.slice(PREFIXE.length)),
            );
            for (const [id, r] of ext) out.set(`${PREFIXE}${id}`, r);
            return out;
          }
        : undefined,
      await this.nonMasques.mots(),
    );
  }

  /* ---------------------------------------------------------------- Capacité offerte aux outils */
  /** Lecture pour une conversation, avec les droits de la personne. */
  pour(user: SessionUser, conversationId: string, ip: string): LectureVulnerabilites {
    return {
      evaluerCve: (cve) => this.evaluerCve(user, conversationId, cve),
      machinesPrioritaires: (a) => this.machinesPrioritaires(user, conversationId, a),
      faillesPrioritaires: (a) => this.faillesPrioritaires(user, a.nombre),
      proposerAction: (a) => this.proposer(user, conversationId, ip, a),
    };
  }

  private exigerLecture(user: SessionUser) {
    if (!AssistantVulnerabilites.lit(user))
      throw new HttpError(403, 'La lecture des vulnérabilités n’est pas ouverte à cette personne.');
  }

  /** Repères des machines rangées (déjà lisibles : elles viennent de machinesRangees), dans l'ordre du rang. */
  private async reperesRanges(
    conversationId: string,
    rangees: readonly MachineDto[],
    ids: ReadonlySet<string>,
    max: number,
  ): Promise<{ reperes: (string | null)[]; total: number }> {
    const retenues = rangees.filter((m) => ids.has(m.id));
    const premieres = retenues.slice(0, max);
    const r = await this.reperes(
      conversationId,
      premieres.map((m) => m.id),
    );
    return { reperes: premieres.map((m) => r.get(m.id) ?? null), total: retenues.length };
  }

  /** Exposition d'une CVE sur la surface externe (lot ALH2), telle que remise au modèle : repères « E-… » des actifs lisibles
      qui la portent, compteurs, technologies, alertes ouvertes et recommandations de l'éditeur, bornés. Aucun domaine,
      adresse, nom de périmètre, FAI ni AS ; titres et recommandations repassent par le masque avant l'envoi. Lot ALH5
      (décision A) : « exposée sur Internet » est un fait de la priorité, le même pour tout le monde ; une exposition sur des
      actifs que la personne ne lit pas n'est dite que par un oui (`aussiHorsDeVosDroits`), sans repère, nom ni nombre. */
  private async surfaceExterne(user: SessionUser, conversationId: string, cve: string) {
    if (!this.surface) return null;
    const x = await this.surface.exposition(user, cve);
    if (!x.exposee && !x.technologies.length) return null;
    const ranges = x.actifs.filter((id): id is string => id !== null);
    const premiers = ranges.slice(0, BORNES_ASSISTANT_VULN.reperesExternes);
    const r = await this.reperesExternes(conversationId, premiers);
    const reperes = premiers.map((id) => r.get(id) ?? null);
    const B = BORNES_ASSISTANT_VULN;
    return {
      exposeeSurInternet: x.exposee,
      ...(x.horsLecture ? { aussiHorsDeVosDroits: true } : {}),
      actifsExposes: x.actifs.length,
      reperes,
      ...(x.actifs.length > reperes.length ? { actifsSansRepere: x.actifs.length - reperes.length } : {}),
      technologies: x.technologies.slice(0, B.technologies).map((t) => ({
        nom: coupe(t.nom, 100),
        editeur: coupe(t.editeur, 100),
        produit: coupe(t.produit, 100),
        versions: t.versions.slice(0, 10).map((v) => coupe(v, 60) || 'inconnue'),
        selonAlgoLightHouse: { exploitee: t.exploitee, preuveDeConcept: t.preuve, cvss: t.cvss, epss: t.epss },
      })),
      ...(x.technologies.length > B.technologies
        ? { technologiesNonRendues: x.technologies.length - B.technologies }
        : {}),
      alertesOuvertes: x.alertes.length,
      alertes: x.alertes.slice(0, B.alertes).map((a) => ({
        criticite: a.criticite ? CRITICITE_ALH_LIBELLES[a.criticite] : null,
        type: a.type ? TYPE_ALERTE_ALH_LIBELLES[a.type] : null,
        statut: STATUT_ALERTE_ALH_LIBELLES[a.statut],
        titre: coupe(a.titre, 200),
      })),
      ...(x.alertes.length > B.alertes ? { alertesNonRendues: x.alertes.length - B.alertes } : {}),
      // Recommandations de l'éditeur des alertes rendues : remises dans « Quoi faire » (quoiFaire.algoLightHouse), pas ici.
      recommandations: x.alertes.slice(0, B.alertes).flatMap((a) =>
        a.defauts.length
          ? [
              {
                alerte: coupe(a.titre, 200),
                defauts: a.defauts.slice(0, B.defauts).map((d) => ({
                  defaut: coupe(d.nom, 200),
                  description: coupe(d.description, 600),
                  resolutions: d.resolutions.slice(0, B.resolutions).map((z) => ({
                    resolution: coupe(z.nom, 200),
                    description: coupe(z.description, 600),
                    facilite: z.facilite,
                    gain: z.gain,
                  })),
                })),
              },
            ]
          : [],
      ),
    };
  }

  /** Rubrique « Quoi faire » d'evaluer_cve (lot ASSISTANT-V1) : le contenu publié par chaque source lue, avec sa source
      nommée, jamais un renvoi vers une autre partie du résultat. Une rubrique sans contenu est omise ; sans aucun correctif
      (correctif de Tenable, action exigée par le catalogue KEV, mention « Un correctif existe : oui » du CERT Santé,
      résolution proposée par l'éditeur de la surface externe), la mention QUOI_FAIRE_SANS_CORRECTIF est rendue. */
  private static quoiFaire(e: {
    kev: { action: string | null; echeance: string | null } | null;
    certSante: SourcesFailleDto['certSante'];
    constats: readonly ConstatDto[];
    recommandationsAlh: readonly {
      alerte: string | null;
      defauts: { resolutions: unknown[] }[];
    }[];
  }) {
    const B = BORNES_ASSISTANT_VULN;
    const out: Record<string, unknown> = {};
    const kevAction = coupe(e.kev?.action, 500);
    if (kevAction)
      out.catalogueKev = {
        source: 'Catalogue KEV de la CISA',
        actionExigee: kevAction,
        ...(e.kev?.echeance ? { echeance: e.kev.echeance } : {}),
      };
    const cs = e.certSante;
    if (cs && (cs.correctif || cs.contournement))
      out.certSante = {
        source: 'CERT Santé',
        ...(cs.correctif ? { unCorrectifExiste: cs.correctif } : {}),
        ...(cs.contournement ? { unContournementExiste: cs.contournement } : {}),
      };
    // Correctifs de Tenable : un par texte publié, avec les contrôles qui le portent (constats lisibles, par priorité).
    const parTexte = new Map<string, { controles: string[]; correctif: string; publieLe: string | null }>();
    for (const c of e.constats) {
      const texte = coupe(c.correctif?.trim(), 600);
      if (!texte) continue;
      let x = parTexte.get(texte);
      if (!x) {
        if (parTexte.size >= B.constats) continue;
        parTexte.set(texte, (x = { controles: [], correctif: texte, publieLe: jour(c.correctifLe) }));
      }
      if (x.controles.length < B.constats && !x.controles.includes(c.plugin)) x.controles.push(c.plugin);
      const le = jour(c.correctifLe);
      if (le && (!x.publieLe || le < x.publieLe)) x.publieLe = le;
    }
    if (parTexte.size)
      out.tenable = {
        source: 'Tenable (correctif publié pour chaque contrôle)',
        correctifs: [...parTexte.values()].map((x) => ({
          controles: x.controles,
          correctif: x.correctif,
          ...(x.publieLe ? { publieLe: x.publieLe } : {}),
        })),
      };
    if (e.recommandationsAlh.length)
      out.algoLightHouse = {
        source: 'AlgoLightHouse (recommandations de l’éditeur de la surface externe)',
        recommandations: e.recommandationsAlh,
      };
    const correctif =
      !!kevAction ||
      cs?.correctif === 'oui' ||
      parTexte.size > 0 ||
      e.recommandationsAlh.some((a) => a.defauts.some((d) => d.resolutions.length > 0));
    if (!correctif) out.correctif = QUOI_FAIRE_SANS_CORRECTIF;
    return out;
  }

  /** Évaluer une CVE : ce que la veille en sait, ce que Tenable, les produits surveillés et la surface externe en disent,
      priorité et suivi. */
  private async evaluerCve(user: SessionUser, conversationId: string, cve: string) {
    this.exigerLecture(user);
    const k = this.db.k;
    const faits = (await lireFaitsCve(k, [cve])).get(cve) ?? null;
    const reglage = await this.reglage.valeurs();
    const rangees = await this.failles.machinesRangees(user);

    // Constats de Tenable qui portent la CVE, lus avec les droits de la personne (un constat sans machine lisible n'existe
    // pas pour elle).
    const ids = (
      await sql<{ id: string }>`SELECT DISTINCT cc.constat_id AS id FROM vulnerabilites_constat_cves cc
        WHERE cc.cve = ${cve} ORDER BY 1 LIMIT 200`.execute(k)
    ).rows.map((r) => r.id);
    const constats: ConstatDto[] = [];
    for (const id of ids) {
      try {
        constats.push(await this.failles.constat(user, id));
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) throw e;
      }
    }
    constats.sort((a, b) => ORDRE_NIVEAU(a.priorite) - ORDRE_NIVEAU(b.priorite) || b.machines - a.machines);
    const constatsRendus = [];
    for (const c of constats.slice(0, BORNES_ASSISTANT_VULN.constats)) {
      const touchees = new Set(Object.values(c.parRole).flatMap((l) => l.map((d) => d.machineId)));
      const r = await this.reperesRanges(conversationId, rangees, touchees, BORNES_ASSISTANT_VULN.reperesParFaille);
      constatsRendus.push({
        nature: 'constat' as const,
        id: c.id,
        controle: { numero: c.plugin, nom: coupe(c.nom, 200) },
        presentSelonTenable: c.present,
        graviteTenable: GRAVITE_TENABLE_LIBELLES[c.gravite],
        exploitableSelonTenable: c.exploitable,
        // Texte du correctif : dans « Quoi faire » (quoiFaire.tenable), avec le numéro du contrôle ; seule la date reste ici.
        correctifPublieLe: jour(c.correctifLe),
        machinesTouchees: c.machines,
        reperes: r.reperes,
        ...(r.total > r.reperes.length ? { reperesNonRendus: r.total - r.reperes.length } : {}),
        priorite: priorite(c.priorite),
        suivi: { etat: etatSuivi(c.suivi.etat), actionsLiees: c.suivi.nombreActions },
      });
    }

    // Produits surveillés : rattachés (présence déclarée), à décider, écartés ou rejetés.
    const { rows: rapprochements } = await sql<{
      id: string;
      statut: StatutRapprochement;
      motif: MotifProposition | null;
      editeur: string;
      nom: string;
      version_produit: string;
    }>`SELECT r.id, r.statut, r.motif, p.editeur, p.nom, p.version_produit
       FROM vulnerabilites_rapprochements r JOIN vulnerabilites_produits p ON p.id = r.produit_id
       WHERE r.cve = ${cve}
       ORDER BY CASE r.statut WHEN 'rattachee' THEN 0 WHEN 'confirmee' THEN 0 WHEN 'proposee' THEN 1 ELSE 2 END,
                lower(p.nom), r.id
       LIMIT ${BORNES_ASSISTANT_VULN.produits + 1}`.execute(k);
    const produits = [];
    for (const r of rapprochements.slice(0, BORNES_ASSISTANT_VULN.produits)) {
      const rattache = r.statut === 'rattachee' || r.statut === 'confirmee';
      const entree: Record<string, unknown> = {
        nature: 'declaree',
        id: r.id,
        produit: { editeur: coupe(r.editeur, 100), nom: coupe(r.nom, 100), version: coupe(r.version_produit, 60) },
        statut: STATUT_RAPPROCHEMENT_LIBELLES[r.statut],
        ...(r.motif ? { motif: MOTIF_PROPOSITION_LIBELLES[r.motif] } : {}),
      };
      if (rattache) {
        const { rows: reliees } = await sql<{ id: string }>`
          SELECT m.id FROM vulnerabilites_produits_machines pm JOIN vulnerabilites_machines m ON m.id = pm.machine_id
          WHERE pm.produit_id = (SELECT produit_id FROM vulnerabilites_rapprochements WHERE id = ${r.id}::uuid)
            AND ${lisible(user)}`.execute(k);
        const rp = await this.reperesRanges(
          conversationId,
          rangees,
          new Set(reliees.map((x) => x.id)),
          BORNES_ASSISTANT_VULN.reperesParFaille,
        );
        entree.machinesRelieesLisibles = rp.total;
        entree.reperes = rp.reperes;
        if (rp.total > rp.reperes.length) entree.reperesNonRendus = rp.total - rp.reperes.length;
        // Suivi : seulement si la personne lit la faille déclarée (au moins une machine reliée lisible).
        if (rp.total) {
          const s = await k
            .selectFrom('vulnerabilites_suivis as s')
            .select([
              sql<EtatSuiviFaille>`s.etat`.as('etat'),
              sql<number>`(SELECT count(*)::int FROM vulnerabilites_suivi_actions sa WHERE sa.suivi_id = s.id)`.as(
                'actions',
              ),
            ])
            .where('s.rapprochement_id', '=', r.id)
            .executeTakeFirst();
          entree.suivi = { etat: etatSuivi(s?.etat ?? 'nouvelle'), actionsLiees: s?.actions ?? 0 };
        }
      }
      produits.push(entree);
    }

    // Présence dans l'organisation et priorité de la CVE, calculées par la plateforme sur tous les faits connus (lot ALH5,
    // décision A : la même pour tout le monde) ; les constats et machines rendus restent ceux que la personne lit.
    const detectee =
      constats.some((c) => c.present) ||
      (
        await sql<{ oui: boolean }>`SELECT EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
          JOIN vulnerabilites_detections d ON d.constat_id = cc.constat_id
          JOIN vulnerabilites_machines m ON m.id = d.machine_id
          LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
          WHERE cc.cve = ${cve} AND ${present}) AS oui`.execute(k)
      ).rows[0]!.oui;
    const surface = await this.surfaceExterne(user, conversationId, cve);
    let exposition: Omit<NonNullable<typeof surface>, 'recommandations'> | null = null;
    let recommandationsAlh: NonNullable<typeof surface>['recommandations'] = [];
    if (surface) {
      const { recommandations, ...reste } = surface;
      exposition = reste;
      recommandationsAlh = recommandations;
    }
    if (!faits && !constats.length && !exposition && !detectee)
      return {
        donnees: {
          cve,
          connue: false,
          message:
            'CVE inconnue de la plateforme : la veille ne la connaît pas, aucun constat de Tenable lisible ne la porte et la surface externe lisible ne la montre pas. Vous n’avez aucun accès au web : dites-le, sans rien supposer.',
        },
        elements: 0,
      };

    const declaree = rapprochements.some((r) => r.statut === 'rattachee' || r.statut === 'confirmee');
    const exposee = !!exposition?.exposeeSurInternet;
    const presence: Presence = detectee
      ? 'detectee'
      : declaree
        ? 'declaree'
        : exposee
          ? 'exposee'
          : rapprochements.some((r) => r.statut === 'proposee')
            ? 'a_confirmer'
            : 'absente';
    const sources = faits || exposition || detectee ? sourcesDe(faits ? [faits] : []) : null;
    const prioriteCve = sources ? calculerPriorite({ ...faitsDepuisSources(sources), presence }, reglage) : null;
    const v = faits?.veille
      ? await k
          .selectFrom('vulnerabilites_veille_cve')
          .select(['description', 'kev_action', sql<string | null>`kev_echeance::text`.as('kev_echeance')])
          .where('cve', '=', cve)
          .executeTakeFirst()
      : undefined;
    const { rows: avis } = await sql<{
      source: 'cert-fr' | 'cert-sante';
      identifiant: string;
      nature: 'alerte' | 'avis';
      le: Date;
      titre: string;
    }>`SELECT source, identifiant, nature, coalesce(publie_le, vu_le) AS le, titre FROM vulnerabilites_veille_avis
       WHERE cves @> ARRAY[${cve}]::text[] ORDER BY le DESC, identifiant LIMIT ${BORNES_ASSISTANT_VULN.avis + 1}`.execute(
      k,
    );
    const quoiFaire = AssistantVulnerabilites.quoiFaire({
      kev: v ? { action: v.kev_action, echeance: v.kev_echeance } : null,
      certSante: sources?.certSante ?? null,
      constats,
      recommandationsAlh,
    });
    const avisRendus = avis.slice(0, BORNES_ASSISTANT_VULN.avis);
    // Rubriques de « Quoi faire » qui portent un contenu (la mention « aucun correctif… » n'en est pas une).
    const rubriques = Object.keys(quoiFaire).filter((x) => x !== 'correctif').length;
    return {
      donnees: {
        cve,
        connue: true,
        connueDeLaVeille: !!faits?.veille,
        presence: {
          detecteeParTenable: detectee,
          declareeParUnProduitSurveille: declaree,
          exposeeSurInternet: exposee,
          constatsLisibles: constats.length,
          ...(constats.length > constatsRendus.length
            ? { constatsNonRendus: constats.length - constatsRendus.length }
            : {}),
        },
        ...(faits
          ? {
              publications: publicationsDe(faits).map((p) => ({ source: p.source, le: jour(p.le) })),
              faits: faitsDesSources(sources!),
              descriptionNvd: coupe(v?.description, 400),
            }
          : {}),
        // Lot ASSISTANT-V1 : contenu publié par chaque source, source nommée ; rubrique vide omise ; sans correctif, la mention.
        quoiFaire,
        avis: avisRendus.map((a) => ({
          source: a.source === 'cert-fr' ? 'CERT-FR' : 'CERT Santé',
          identifiant: a.identifiant,
          nature: a.nature,
          le: a.le.toISOString().slice(0, 10),
          titre: coupe(a.titre, 160),
        })),
        ...(avis.length > BORNES_ASSISTANT_VULN.avis ? { avisNonRendus: true } : {}),
        constats: constatsRendus,
        produitsSurveilles: produits,
        ...(rapprochements.length > produits.length ? { produitsNonRendus: true } : {}),
        ...(exposition ? { surfaceExterne: exposition } : {}),
        ...(prioriteCve ? { priorite: priorite(prioriteCve) } : {}),
        note: 'Priorité, rang et nombres sont calculés par la plateforme. Les repères M-… désignent des machines, les repères E-… des actifs exposés sur Internet (domaines, adresses) : citez-les tels quels. « Quoi faire » : reprenez quoiFaire, chaque rubrique avec sa source ; sans correctif publié, dites-le.',
      },
      // Ce qui est rendu : la CVE, ses avis, ses constats, ses produits surveillés, les rubriques de « Quoi faire » qui
      // portent un contenu et la section de la surface externe.
      elements: 1 + avisRendus.length + constatsRendus.length + produits.length + rubriques + (exposition ? 1 : 0),
    };
  }

  /** Machines à traiter d'abord : toutes celles que la personne lit, ou celles touchées par une CVE ou un constat. Lot
      ASSISTANT-V1 : aussi les actifs exposés sur Internet (surface externe), sous des repères « E-… » ; sans constat
      demandé, ceux qui portent une faille suivie exposée, rangés par la faille la plus prioritaire qu'ils portent (ordre
      du tableau « Cibles par priorité »), puis par nombre de failles exposées ; avec une CVE, ceux qui la portent (mêmes
      porteurs et mêmes repères que la surface externe d'evaluer_cve, rangés par identifiant). Avec un constat de Tenable :
      machines seulement. */
  private async machinesPrioritaires(
    user: SessionUser,
    conversationId: string,
    a: { nombre: number; cve?: string; constat?: string },
  ) {
    this.exigerLecture(user);
    const rangees = await this.failles.machinesRangees(user);
    let ids: Set<string>;
    let portee: string;
    if (a.constat) {
      if (!(await this.suivi.estLisible(user, 'constat', a.constat)))
        throw new HttpError(404, 'Constat introuvable ou non accessible.');
      const { rows } = await sql<{ id: string }>`
        WITH x AS (
          SELECT d.machine_id, ${present} AS present FROM vulnerabilites_detections d
          JOIN vulnerabilites_machines m ON m.id = d.machine_id
          LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
          WHERE d.constat_id = ${a.constat}::uuid)
        SELECT DISTINCT machine_id AS id FROM x WHERE present OR NOT EXISTS (SELECT 1 FROM x y WHERE y.present)`.execute(
        this.db.k,
      );
      ids = new Set(rows.map((r) => r.id));
      portee = 'machines touchées par le constat';
    } else if (a.cve) {
      const { rows } = await sql<{ id: string }>`
        SELECT d.machine_id AS id FROM vulnerabilites_detections d
        JOIN vulnerabilites_constat_cves cc ON cc.constat_id = d.constat_id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE cc.cve = ${a.cve} AND ${present}
        UNION
        SELECT pm.machine_id FROM vulnerabilites_rapprochements r
        JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
        WHERE r.cve = ${a.cve} AND r.statut IN ('rattachee', 'confirmee')`.execute(this.db.k);
      ids = new Set(rows.map((r) => r.id));
      portee = `machines touchées par ${a.cve} (détectées par Tenable ou reliées à un produit surveillé) et actifs exposés sur Internet qui la portent`;
    } else {
      ids = new Set(rangees.map((m) => m.id));
      portee =
        'toutes les machines que la personne peut lire, et les actifs exposés sur Internet qu’elle peut lire qui portent une faille suivie';
    }
    const max = Math.min(a.nombre, BORNES_ASSISTANT_VULN.machines);
    // Intersection avec les machines lisibles : machinesRangees ne rend que celles-là.
    const retenues = rangees.filter((m) => ids.has(m.id));
    const premieres = retenues.slice(0, max);
    const r = await this.reperes(
      conversationId,
      premieres.map((m) => m.id),
    );
    const actifs = a.constat ? null : await this.actifsPrioritaires(user, conversationId, a.cve ?? null, max);
    return {
      donnees: {
        portee,
        machinesDansLaPortee: retenues.length,
        machines: premieres.map((m) => machinePourModele(m, r.get(m.id) ?? null)),
        ...(actifs
          ? {
              actifsExposesDansLaPortee: actifs.total,
              ...(actifs.sansFiche ? { actifsExposesSansRepere: actifs.sansFiche } : {}),
              actifsExposes: actifs.rendus,
            }
          : {}),
        note:
          'Ordre du rang calculé par la plateforme (exploitation avérée, puis critères locaux, puis failles critiques et élevées). Citez les repères tels quels, dans cet ordre.' +
          (actifs
            ? ' Les repères E-… désignent des actifs exposés sur Internet (domaines, adresses), rangés par la plateforme : citez-les tels quels, après les machines, dans leur ordre.'
            : ''),
      },
      // Ce qui est rendu : les machines et les actifs exposés, chacun sous son repère.
      elements: premieres.length + (actifs?.rendus.length ?? 0),
    };
  }

  /** Actifs exposés sur Internet de machines_prioritaires (lot ASSISTANT-V1) : repères « E-… », rang et compteurs, rien
      d'autre. `cve` : ceux qui la portent ; sinon ceux qui portent une faille suivie exposée (calcul global de la vue
      d'ensemble, le même pour tout le monde), lus avec les droits de la personne. Null sans surface externe. */
  private async actifsPrioritaires(user: SessionUser, conversationId: string, cve: string | null, max: number) {
    if (!this.surface) return null;
    const exposees: { cve: string; niveau: NiveauPriorite | null }[] = cve
      ? [{ cve, niveau: null }]
      : (await this.vue.cibles(user)).exposees;
    const rang = new Map(exposees.map((x, i) => [x.cve, i]));
    const niveaux = new Map(exposees.map((x) => [x.cve, x.niveau]));
    const { actifs, sansFiche } = await this.surface.actifsDesCves(
      user,
      exposees.map((x) => x.cve),
    );
    const premier = (c: Set<string>) => Math.min(...[...c].map((x) => rang.get(x) ?? Infinity));
    const ranges = [...actifs]
      .map(([id, c]) => ({ id, cves: c, premier: premier(c) }))
      .sort((x, y) => x.premier - y.premier || y.cves.size - x.cves.size || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    const premiers = ranges.slice(0, max);
    const r = await this.reperesExternes(
      conversationId,
      premiers.map((x) => x.id),
    );
    return {
      total: ranges.length + sansFiche,
      sansFiche,
      rendus: premiers.map((x, i) => {
        const parPriorite: Partial<Record<NiveauPriorite, number>> = {};
        for (const c of x.cves) {
          const n = niveaux.get(c);
          if (n) parPriorite[n] = (parPriorite[n] ?? 0) + 1;
        }
        return {
          repere: r.get(x.id) ?? null,
          rang: i + 1,
          rangSur: ranges.length,
          faillesExposees: x.cves.size,
          ...(cve
            ? {}
            : {
                faillesParPriorite: Object.fromEntries(
                  NIVEAUX_PRIORITE.flatMap((n) => (parPriorite[n] ? [[n, parPriorite[n]]] : [])),
                ),
              }),
        };
      }),
    };
  }

  /** Failles à traiter d'abord (lot ASSISTANT-V1) : les cibles du tableau « Cibles par priorité » de la vue d'ensemble,
      telles que l'écran les rend à la personne (même calcul global, même ordre, mêmes nombres lisibles), les premières.
      Produits à confirmer signalés. Ni nom de machine, ni domaine, ni adresse, ni périmètre : titres, produits, CVE, faits
      et compteurs seulement. */
  private async faillesPrioritaires(user: SessionUser, nombre: number) {
    this.exigerLecture(user);
    const { cibles, total } = await this.vue.cibles(user);
    const rendues = cibles.slice(0, Math.min(nombre, BORNES_ASSISTANT_VULN.failles)).map(faillePourModele);
    return {
      donnees: {
        failles: rendues,
        faillesSuiviesAuTotal: total,
        note: 'Mêmes failles, dans le même ordre, que le tableau « Cibles par priorité » de la vue d’ensemble du module : priorité calculée par la plateforme, puis exploitation avérée, présence, « exploitable », gravité et EPSS. produitAConfirmer : un produit surveillé est seulement proposé pour cette CVE, la présence reste à confirmer par la personne ; seulementAConfirmer : c’est sa seule présence. Les nombres de machines et d’actifs sont ceux que la personne lit. nature et id : la faille que la personne peut ouvrir (à reprendre dans proposer_action_vulnerabilite) ; absents, elle ne lit aucune machine touchée.',
      },
      elements: rendues.length,
    };
  }

  /* ---------------------------------------------------------------- Propositions d'action */
  /** Dépôt d'une proposition d'action sur une faille : rien n'est écrit dans un registre. */
  private async proposer(
    user: SessionUser,
    conversationId: string,
    ip: string,
    a: {
      nature: NatureSuivi;
      faille: string;
      titre: string;
      description: string;
      echeance?: string;
      machines: string[];
    },
  ): Promise<{ enregistre: boolean; detail: string }> {
    this.exigerLecture(user);
    if (!(await this.suivi.estLisible(user, a.nature, a.faille)))
      return {
        enregistre: false,
        detail: 'Faille introuvable ou non accessible : utilisez l’identifiant rendu par un outil.',
      };
    const machines = [...new Set(a.machines)].slice(0, PROPOSITION_VULN_MACHINES_MAX);
    const cites = [...new Set([...machines, ...reperesCites(a.titre), ...reperesCites(a.description)])];
    const connus = new Set(
      (
        await this.db.k
          .selectFrom('vulnerabilites_assistant_reperes')
          .select('numero')
          .where('conversation_id', '=', conversationId)
          .where('machine_id', 'is not', null)
          .execute()
      ).map((r) => repereMachine(r.numero)),
    );
    const inconnus = cites.filter((r) => !connus.has(r));
    if (inconnus.length)
      return {
        enregistre: false,
        detail: `Repère(s) inconnu(s) de cette conversation : ${inconnus.slice(0, 10).join(', ')}. N’utilisez que les repères rendus par les outils.`,
      };
    const numeros = machines.map((r) => numeroRepere(r)!).sort((x, y) => x - y);
    const colonne = a.nature === 'constat' ? 'constat_id' : 'rapprochement_id';
    const r = await this.db.tx(async (c, k) => {
      await k
        .selectFrom('assistant_conversations')
        .select('id')
        .where('id', '=', conversationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const deja = await k
        .selectFrom('vulnerabilites_assistant_propositions')
        .select([
          'id',
          'etat',
          colonne,
          'titre',
          'description',
          'reperes',
          sql<string | null>`echeance::text`.as('ech'),
        ])
        .where('conversation_id', '=', conversationId)
        .execute();
      if (deja.length >= BORNES_ASSISTANT_VULN.propositionsConversation)
        return { enregistre: false, detail: 'Nombre maximal de propositions de cette conversation atteint.' };
      const memeFaille = deja.filter((x) => (x as Record<string, unknown>)[colonne] === a.faille);
      const rejeteeIdentique = memeFaille.some(
        (x) =>
          x.etat === 'rejetee' &&
          x.titre === a.titre &&
          x.description === a.description &&
          (x.ech ?? null) === (a.echeance ?? null) &&
          JSON.stringify([...x.reperes].sort((p, q) => p - q)) === JSON.stringify(numeros),
      );
      if (rejeteeIdentique)
        return {
          enregistre: false,
          detail: 'Cette proposition a déjà été rejetée par la personne : ne la redéposez pas à l’identique.',
        };
      const remplacees = memeFaille.filter((x) => x.etat === 'en_attente').map((x) => x.id);
      const enAttenteConv = deja.filter((x) => x.etat === 'en_attente').length - remplacees.length;
      if (enAttenteConv >= BORNES_ASSISTANT_VULN.propositionsEnAttenteConversation)
        return { enregistre: false, detail: 'Trop de propositions de cette conversation attendent une décision.' };
      const { n } = await k
        .selectFrom('vulnerabilites_assistant_propositions as p')
        .innerJoin('assistant_conversations as cv', 'cv.id', 'p.conversation_id')
        .select(sql<number>`count(*)::int`.as('n'))
        .where('cv.user_id', '=', user.id)
        .where('p.etat', '=', 'en_attente')
        .executeTakeFirstOrThrow();
      if (n - remplacees.length >= BORNES_ASSISTANT_VULN.propositionsEnAttentePersonne)
        return { enregistre: false, detail: 'Trop de propositions attendent déjà une décision de cette personne.' };
      if (remplacees.length)
        await k
          .updateTable('vulnerabilites_assistant_propositions')
          .set({ etat: 'retiree', decided_by: 'assistant', decided_at: sql<Date>`now()` })
          .where('id', 'in', remplacees)
          .execute();
      const p = await k
        .insertInto('vulnerabilites_assistant_propositions')
        .values({
          conversation_id: conversationId,
          nature: a.nature,
          [colonne]: a.faille,
          titre: a.titre,
          description: a.description,
          echeance: a.echeance ?? null,
          reperes: numeros,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      // Journal sans contenu : identifiants et nombres, aucun repère ni nom.
      await this.db.audit(
        user,
        ip,
        'assistant.vulnerabilites.proposition_deposee',
        p.id,
        {
          conversation: conversationId,
          nature: a.nature,
          faille: a.faille,
          machines: numeros.length,
          remplacees: remplacees.length,
        },
        c,
      );
      return {
        enregistre: true,
        detail:
          'Proposition déposée : rien n’est créé tant que la personne ne l’a pas confirmée' +
          (remplacees.length ? ' ; elle remplace la proposition précédente sur cette faille.' : '.'),
      };
    }, user.username);
    return r;
  }

  /** Propositions des conversations de la personne, repères remplacés pour elle (100 au plus, en attente d'abord). */
  async propositions(user: SessionUser): Promise<PropositionVulnerabiliteDto[]> {
    if (!AssistantVulnerabilites.lit(user)) return [];
    const lignes = await this.db.k
      .selectFrom('vulnerabilites_assistant_propositions as p')
      .innerJoin('assistant_conversations as cv', 'cv.id', 'p.conversation_id')
      .leftJoin('vulnerabilites_constats as c', 'c.id', 'p.constat_id')
      .leftJoin('vulnerabilites_rapprochements as r', 'r.id', 'p.rapprochement_id')
      .select([
        'p.id',
        'p.conversation_id',
        'p.nature',
        'p.constat_id',
        'p.rapprochement_id',
        'p.titre',
        'p.description',
        sql<string | null>`p.echeance::text`.as('echeance'),
        'p.reperes',
        'p.etat',
        'p.decided_by',
        'p.decided_at',
        'p.decision_note',
        'p.action_id',
        'p.created_at',
        'c.plugin_id',
        'c.nom as controle',
        'r.cve',
      ])
      .where('cv.user_id', '=', user.id)
      .orderBy(sql`CASE p.etat WHEN 'en_attente' THEN 0 ELSE 1 END`)
      .orderBy('p.created_at', 'desc')
      .limit(100)
      .execute();
    const resolveurs = new Map<string, (r: string) => ResolutionRepere>();
    const out: PropositionVulnerabiliteDto[] = [];
    for (const p of lignes) {
      let resoudre = resolveurs.get(p.conversation_id);
      if (!resoudre) {
        resoudre = await this.resolveur(user, p.conversation_id);
        resolveurs.set(p.conversation_id, resoudre);
      }
      const titre = decouperReperes(p.titre, resoudre);
      const description = decouperReperes(p.description, resoudre);
      const nature = p.nature as NatureSuivi;
      out.push({
        id: p.id,
        conversationId: p.conversation_id,
        faille: {
          nature,
          id: (nature === 'constat' ? p.constat_id : p.rapprochement_id)!,
          libelle:
            nature === 'constat'
              ? `Contrôle n° ${p.plugin_id} : ${p.controle ?? ''}`
              : `Faille déclarée ${p.cve ?? ''}`,
        },
        titre: texteDesSegments(titre),
        titreSegments: titre,
        description: texteDesSegments(description),
        descriptionSegments: description,
        echeance: p.echeance,
        machines: p.reperes.map((n) => {
          const repere = repereMachine(n);
          const r = resoudre(repere);
          return { repere, nom: typeof r === 'string' ? null : r.machine };
        }),
        etat: p.etat as EtatPropositionVuln,
        decidedBy: p.decided_by,
        decidedAt: p.decided_at?.toISOString() ?? null,
        decisionNote: p.decision_note,
        actionId: p.action_id,
        createdAt: p.created_at.toISOString(),
      });
    }
    return out;
  }

  /** Décision de la personne de la conversation. Confirmer : droit de modifier les vulnérabilités, règle du lot V4b (toutes
      les machines touchées lisibles), droit du registre des actions et écriture sur le périmètre choisi ; les repères sont
      remplacés par les noms sur le serveur (V29 ; nom, jamais d'adresse), l'action est créée par le service du registre
      sous l'identité de la personne et liée à la faille, avec les actifs touchés (V30). Rien ne repart vers le modèle. */
  async decider(id: string, corps: unknown, user: SessionUser, ip: string): Promise<PropositionVulnerabiliteDto> {
    const b = DecisionPropositionVulnBody.parse(corps);
    const p = await this.db.k
      .selectFrom('vulnerabilites_assistant_propositions as p')
      .innerJoin('assistant_conversations as cv', 'cv.id', 'p.conversation_id')
      .select([
        'p.id',
        'p.conversation_id',
        'p.nature',
        'p.constat_id',
        'p.rapprochement_id',
        'p.titre',
        'p.description',
        sql<string | null>`p.echeance::text`.as('echeance'),
        'p.reperes',
        'p.etat',
      ])
      .where('p.id', '=', id)
      .where('cv.user_id', '=', user.id)
      .executeTakeFirst();
    if (!p || !AssistantVulnerabilites.lit(user)) throw new HttpError(404, 'Proposition introuvable.');
    if (p.etat !== 'en_attente') throw new HttpError(409, 'Cette proposition a déjà été décidée.');
    const nature = p.nature as NatureSuivi;
    const faille = (nature === 'constat' ? p.constat_id : p.rapprochement_id)!;
    let action: string | null = null;
    await this.db.tx(async (c, k) => {
      if (b.decision === 'confirmer') {
        if (!user.rights.can('vulnerabilites', 'modifier'))
          throw new HttpError(403, 'Confirmer demande le droit de modifier les vulnérabilités.');
        const noms = await this.nomsPourAction(k, user, p.conversation_id);
        const remplacer = (t: string) =>
          t.replace(/(?<![A-Za-z0-9_-])M-\d{3}(?![A-Za-z0-9_-])/g, (r) => noms.get(r) ?? r);
        const titre = remplacer(b.titre ?? p.titre).slice(0, 200);
        const concernees = p.reperes.map((n) => noms.get(repereMachine(n))).filter((x): x is string => !!x);
        const description =
          remplacer(b.description ?? p.description) +
          (concernees.length ? `\n\nMachines concernées par cette action : ${concernees.join(', ')}.` : '');
        action = await this.suivi.creerActionProposee(
          c,
          k,
          nature,
          faille,
          {
            perimetreId: b.perimetreId!,
            titre,
            description,
            echeance: b.echeance === undefined ? p.echeance : b.echeance,
          },
          user,
          ip,
          id,
        );
      }
      const maj = await k
        .updateTable('vulnerabilites_assistant_propositions')
        .set({
          etat: b.decision === 'confirmer' ? 'confirmee' : 'rejetee',
          decided_by: user.username,
          decided_at: sql<Date>`now()`,
          decision_note: b.note,
          action_id: action,
        })
        .where('id', '=', id)
        .where('etat', '=', 'en_attente')
        .executeTakeFirst();
      if (!Number(maj.numUpdatedRows)) throw new HttpError(409, 'Cette proposition a déjà été décidée.');
      await this.db.audit(
        user,
        ip,
        'assistant.vulnerabilites.proposition_decidee',
        id,
        {
          decision: b.decision,
          nature,
          faille,
          ...(action ? { action, perimetre: b.perimetreId } : {}),
        },
        c,
      );
    }, user.username);
    const dto = (await this.propositions(user)).find((x) => x.id === id);
    if (!dto) throw new HttpError(404, 'Proposition introuvable.');
    return dto;
  }

  /** Repère -> nom de la machine, pour une action (V29) : seulement les machines que la personne lit et qui ont un nom ;
      une machine sans nom devient « machine sans nom », jamais son adresse. */
  private async nomsPourAction(k: Kdb, user: SessionUser, conversationId: string): Promise<Map<string, string>> {
    const { rows } = await sql<{ numero: number; nom: string | null }>`
      SELECT r.numero, m.nom FROM vulnerabilites_assistant_reperes r
      JOIN vulnerabilites_machines m ON m.id = r.machine_id
      WHERE r.conversation_id = ${conversationId}::uuid AND ${lisible(user)}`.execute(k);
    return new Map(rows.map((r) => [repereMachine(r.numero), r.nom ?? 'machine sans nom']));
  }
}
