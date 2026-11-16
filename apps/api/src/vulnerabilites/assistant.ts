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
     machine qui figurerait encore dans une demande au modèle.
   Journal : `assistant.vulnerabilites.*`, identifiants et nombres seulement, jamais un nom, une adresse ni un repère. */
import {
  calculerPriorite,
  type ConstatDto,
  DecisionPropositionVulnBody,
  ETAT_SUIVI_LIBELLES,
  type EtatPropositionVuln,
  type EtatSuiviFaille,
  faitsDepuisSources,
  GRAVITE_TENABLE_LIBELLES,
  type GraviteTenable,
  libelleFaitPriorite,
  libelleFaitRang,
  type MachineDto,
  MOTIF_PROPOSITION_LIBELLES,
  type MotifProposition,
  type NatureSuivi,
  numeroRepere,
  type Priorite,
  PROPOSITION_VULN_MACHINES_MAX,
  type PropositionVulnerabiliteDto,
  RechercheConstats,
  RechercheDeclarees,
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
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { creerMasque, type MachineAMasquer, type Masquer } from '../assistant/masque.js';
import type { LectureVulnerabilites } from '../assistant/outils.js';
import type { Db, Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { FaillesDetectees } from './failles.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { lireFaitsCve, publicationsDe, sourcesDe } from './sources.js';
import { lisible, present } from './sql.js';
import type { SuiviFailles } from './suivi.js';

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

export class AssistantVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly failles: FaillesDetectees,
    private readonly suivi: SuiviFailles,
    private readonly reglage: ReglagePrioriteVulnerabilites,
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

  /** Résolution des repères d'une conversation pour la personne qui regarde : nom (ou adresse) si elle lit la machine,
      « non lisible » si le repère désigne une machine qu'elle ne lit pas (ou une machine effacée), « inconnu » sinon. */
  async resolveur(user: SessionUser, conversationId: string): Promise<(repere: string) => ResolutionRepere> {
    const lit = AssistantVulnerabilites.lit(user);
    const { rows } = await sql<{ numero: number; nom: string | null; adresse: string | null; lisible: boolean | null }>`
      SELECT r.numero, m.nom, m.adresse, CASE WHEN m.id IS NULL THEN NULL ELSE ${lisible(user)} END AS lisible
      FROM vulnerabilites_assistant_reperes r
      LEFT JOIN vulnerabilites_machines m ON m.id = r.machine_id
      WHERE r.conversation_id = ${conversationId}::uuid`.execute(this.db.k);
    const table = new Map(rows.map((r) => [r.numero, r]));
    return (repere) => {
      const n = numeroRepere(repere);
      const r = n === null ? undefined : table.get(n);
      if (!r) return 'inconnu';
      if (!lit || !r.lisible) return 'non_lisible';
      return { machine: r.nom ?? r.adresse ?? repere };
    };
  }

  /** Masque de sortie pour une demande au modèle : en conversation, repère pour une machine lisible par la personne ; en
      ronde (pas de conversation), « [machine] » pour toutes. */
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
    return creerMasque(machines, conversationId ? (ids) => this.reperes(conversationId, ids) : undefined);
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

  /** Évaluer une CVE : ce que la veille en sait, ce que Tenable et les produits surveillés en disent, priorité et suivi. */
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
        correctifPublieParTenable: coupe(c.correctif, 600),
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

    if (!faits && !constats.length)
      return {
        donnees: {
          cve,
          connue: false,
          message:
            'CVE inconnue de la plateforme : la veille ne la connaît pas et aucun constat de Tenable lisible ne la porte. Vous n’avez aucun accès au web : dites-le, sans rien supposer.',
        },
        elements: 0,
      };

    // Présence dans l'organisation et priorité de la CVE, calculées par la plateforme.
    const detectee = constats.some((c) => c.present);
    const declaree = rapprochements.some((r) => r.statut === 'rattachee' || r.statut === 'confirmee');
    const presence = detectee
      ? 'detectee'
      : declaree
        ? 'declaree'
        : rapprochements.some((r) => r.statut === 'proposee')
          ? 'a_confirmer'
          : 'absente';
    const sources = faits ? sourcesDe([faits]) : null;
    const prioriteCve = sources ? calculerPriorite({ ...faitsDepuisSources(sources), presence }, reglage) : null;
    const v = faits
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
    return {
      donnees: {
        cve,
        connue: true,
        connueDeLaVeille: !!faits,
        presence: {
          detecteeParTenable: detectee,
          declareeParUnProduitSurveille: declaree,
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
        recommandations: {
          actionExigeeParLeCatalogueKev: coupe(v?.kev_action, 500),
          echeanceKev: v?.kev_echeance ?? null,
          ficheCertSante: sources?.certSante
            ? { correctifExiste: sources.certSante.correctif, contournementExiste: sources.certSante.contournement }
            : null,
          correctifsTenable: 'voir chaque constat (correctifPublieParTenable)',
        },
        avis: avis.slice(0, BORNES_ASSISTANT_VULN.avis).map((a) => ({
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
        ...(prioriteCve ? { priorite: priorite(prioriteCve) } : {}),
        note: 'Priorité, rang et nombres sont calculés par la plateforme. Les repères désignent des machines : citez-les tels quels.',
      },
      elements: 1 + constatsRendus.length + produits.length,
    };
  }

  /** Machines à traiter d'abord : toutes celles que la personne lit, ou celles touchées par une CVE ou un constat. */
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
      portee = `machines touchées par ${a.cve} (détectées par Tenable ou reliées à un produit surveillé)`;
    } else {
      ids = new Set(rangees.map((m) => m.id));
      portee = 'toutes les machines que la personne peut lire';
    }
    // Intersection avec les machines lisibles : machinesRangees ne rend que celles-là.
    const retenues = rangees.filter((m) => ids.has(m.id));
    const premieres = retenues.slice(0, Math.min(a.nombre, BORNES_ASSISTANT_VULN.machines));
    const r = await this.reperes(
      conversationId,
      premieres.map((m) => m.id),
    );
    return {
      donnees: {
        portee,
        machinesDansLaPortee: retenues.length,
        machines: premieres.map((m) => machinePourModele(m, r.get(m.id) ?? null)),
        note: 'Ordre du rang calculé par la plateforme (exploitation avérée, puis critères locaux, puis failles critiques et élevées). Citez les repères tels quels, dans cet ordre.',
      },
      elements: premieres.length,
    };
  }

  /** Failles à traiter d'abord : constats et failles déclarées encore à traiter, par priorité. */
  private async faillesPrioritaires(user: SessionUser, nombre: number) {
    this.exigerLecture(user);
    const constats = await this.failles.constats(user, RechercheConstats.parse({}));
    const declarees = await this.failles.declarees(user, RechercheDeclarees.parse({}));
    const ordreGravite = (g: GraviteTenable | null) => (g ? ['critique', 'elevee', 'moyenne', 'faible'].indexOf(g) : 4);
    const toutes = [
      ...constats.elements.map((c) => ({
        tri: { p: c.priorite, g: c.gravite as GraviteTenable | null, n: c.machines },
        ligne: {
          nature: 'constat' as const,
          id: c.id,
          controle: { numero: c.plugin, nom: coupe(c.nom, 200) },
          cves: c.cves,
          ...(c.nombreCves > c.cves.length ? { autresCves: c.nombreCves - c.cves.length } : {}),
          sansCve: c.nonMaintenu,
          priorite: priorite(c.priorite),
          gravite: GRAVITE_TENABLE_LIBELLES[c.gravite],
          exploitationAveree: c.sources.exploitation.map((x) => SOURCE_EXPLOITATION_LIBELLES[x.source]),
          exploitable: c.sources.exploitable.map((x) => SOURCE_EXPLOITABLE_LIBELLES[x.source]),
          epss: valeursRetenues(c.sources.valeurs).epss?.score ?? null,
          machinesTouchees: c.machines,
          suivi: { etat: etatSuivi(c.suivi.etat), actionsLiees: c.suivi.nombreActions },
        },
      })),
      ...declarees.elements.map((d) => ({
        tri: { p: d.priorite, g: d.gravite, n: d.machines },
        ligne: {
          nature: 'declaree' as const,
          id: d.rapprochementId,
          cve: d.cve,
          produit: {
            editeur: coupe(d.produit.editeur, 100),
            nom: coupe(d.produit.nom, 100),
            version: coupe(d.produit.versionProduit, 60),
          },
          priorite: priorite(d.priorite),
          gravite: d.gravite ? GRAVITE_TENABLE_LIBELLES[d.gravite] : null,
          exploitationAveree: d.sources.exploitation.map((x) => SOURCE_EXPLOITATION_LIBELLES[x.source]),
          exploitable: d.sources.exploitable.map((x) => SOURCE_EXPLOITABLE_LIBELLES[x.source]),
          epss: d.epss,
          machinesReliees: d.machines,
          suivi: { etat: etatSuivi(d.suivi.etat), actionsLiees: d.suivi.nombreActions },
        },
      })),
    ].sort(
      (a, b) =>
        ORDRE_NIVEAU(a.tri.p) - ORDRE_NIVEAU(b.tri.p) ||
        ordreGravite(a.tri.g) - ordreGravite(b.tri.g) ||
        b.tri.n - a.tri.n,
    );
    const rendues = toutes.slice(0, Math.min(nombre, BORNES_ASSISTANT_VULN.failles)).map((x) => x.ligne);
    return {
      donnees: {
        failles: rendues,
        aTraiterAuTotal: constats.total + declarees.total,
        note: 'Failles encore à traiter (nouvelles, à traiter, en cours), rangées par la priorité calculée par la plateforme.',
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
