/* Module Vulnérabilités (ADR 0100, point 8 ; décisions V20 et V21 ; lot V4a) : rapprochement entre les produits surveillés
   et les CVE de la veille, par la version déclarée.
   - Recalcul déterministe (règle classerRapprochement et transitions transitionRapprochement du paquet partagé), produit par
     produit, sous le verrou de la fiche du produit : après chaque collecte NVD réussie (tous les produits) et à chaque
     création ou modification d'un produit (dans la même transaction). Seules les entrées « vulnérables » des
     configurations NVD sont rapprochées ; par identifiant CPE (éditeur et produit exacts) si la fiche en porte un, sinon par
     noms normalisés de l'éditeur et du produit.
   - Décision d'une personne sur une proposition (`vulnerabilites:modifier`, If-Match) : confirmer ou rejeter, avec une note.
   - Suggestions d'identifiant : couples éditeur et produit déjà rangés par la veille qui ressemblent au nom saisi (lecture
     de la base seulement, aucun appel réseau).
   Journal `vulnerabilites.rapprochement.*` : identifiants internes, CVE et nombres ; aucun nom ni adresse de machine.
   Lot V4b : un rapprochement qui cesse d'être rattaché (ou le redevient) est signalé au suivi des failles déclarées.
   Lot V4c :
   - V26 : une CVE connue seulement par une publication du CERT Santé (NVD n'en donne pas encore les produits touchés) est
     rapprochée par le nom : le produit cité par le titre de la publication, normalisé, est comparé au nom du produit
     surveillé et à « éditeur nom », normalisés. Toujours une proposition (motif « avis_seulement ») ; quand NVD publie les
     produits touchés, la règle par version s'applique, sans écraser une décision tant que les données n'ont pas changé ;
   - V24 : une confirmation ou un rejet peut être annulé (`vulnerabilites:modifier`, If-Match, note facultative) ; le
     rapprochement est recalculé par la règle, l'annulation est gardée (auteur, date, note) et journalisée ; le suivi
     réagit comme à tout changement de rattachement ;
   - la fiche montre ce que chaque source dit de la CVE (sources.ts) ; la priorité prend toutes les sources (V26, V27). */
import { createHash } from 'node:crypto';
import {
  type AnnulationRapprochement,
  calculerPriorite,
  classerRapprochement,
  faitsDepuisSources,
  valeursRetenues,
  cpeDepuisIdentite,
  type DecisionRapprochement,
  type EtatRapprochement,
  identiteCpe,
  normaliserNom,
  type PartieCpe,
  type PlageAfficheeDto,
  type Presence,
  type RapprochementDto,
  RAPPROCHEMENTS_PAR_STATUT_MAX,
  type StatutRapprochement,
  SUGGESTIONS_CPE_MAX,
  type SuggestionCpeDto,
  type SuggestionsCpeQuery,
  transitionRapprochement,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { lireFaitsCve, sourcesDe } from './sources.js';
import { alerteCertFr, scoreNvd } from './sql.js';

const AUTOMATE = { username: 'rapprochement automatique' };
const empreinte = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

interface LigneTouche {
  cve: string;
  partie: PartieCpe;
  editeur: string;
  produit: string;
  version: string | null;
  debut_inclus: string | null;
  debut_exclus: string | null;
  fin_inclus: string | null;
  fin_exclus: string | null;
  produits_tronques: boolean;
}

const plageDe = (t: LigneTouche): PlageAfficheeDto => ({
  editeur: t.editeur,
  produit: t.produit,
  version: t.version,
  debutInclus: t.debut_inclus,
  debutExclus: t.debut_exclus,
  finInclus: t.fin_inclus,
  finExclus: t.fin_exclus,
});

/** Présence retenue pour la priorité d'un rapprochement (fiche du produit). */
const presenceDe = (s: StatutRapprochement): Presence =>
  s === 'rattachee' || s === 'confirmee' ? 'declaree' : s === 'proposee' ? 'a_confirmer' : 'absente';

/** Ordre d'affichage : à décider, puis rattachées, confirmées, écartées, rejetées. */
const ORDRE_FICHE: StatutRapprochement[] = ['proposee', 'rattachee', 'confirmee', 'ecartee', 'rejetee'];

const RATTACHEE = (s: StatutRapprochement) => s === 'rattachee' || s === 'confirmee';

export class Rapprochements {
  /** Suivi des failles déclarées (lot V4b) : une CVE qui n'est plus rattachée est proposée « corrigée » ; de nouveau
      rattachée, la proposition est retirée ou la faille corrigée réapparaît. Dans la transaction du recalcul. */
  apresBascules?: (
    k: Kdb,
    c: Client,
    produitId: string,
    bascules: { id: string; rattachee: boolean }[],
  ) => Promise<void>;

  constructor(
    private readonly db: Db,
    private readonly reglage: ReglagePrioriteVulnerabilites,
  ) {}

  /* ---------------------------------------------------------------- Recalcul */
  /** Tous les produits, chacun dans sa transaction (après une collecte NVD). */
  async recalculerTout(): Promise<{ produits: number; changements: number }> {
    const ids = await this.db.k.selectFrom('vulnerabilites_produits').select('id').orderBy('id').execute();
    let changements = 0;
    for (const { id } of ids)
      changements += await this.db.tx(async (c, k) => this.recalculerProduit(k, c, id), AUTOMATE.username);
    return { produits: ids.length, changements };
  }

  /** Recalcule les rapprochements d'un produit (fiche verrouillée). Rend le nombre de rapprochements créés ou modifiés ;
      s'il y en a, une entrée `vulnerabilites.rapprochement.recalcule` les compte par statut obtenu. */
  async recalculerProduit(k: Kdb, c: Client, produitId: string): Promise<number> {
    const p = await k
      .selectFrom('vulnerabilites_produits')
      .select(['id', 'editeur', 'nom', 'version_produit', 'cpe'])
      .where('id', '=', produitId)
      .forUpdate()
      .executeTakeFirst();
    if (!p) return 0;
    const identite = identiteCpe(p.cpe);
    const editeurNorm = normaliserNom(p.editeur);
    const nomNorm = normaliserNom(p.nom);
    const empreinteProduit = empreinte({
      version: p.version_produit,
      cle: identite ? ['cpe', identite.editeur, identite.produit] : ['nom', editeurNorm, nomNorm],
    });
    let touches: LigneTouche[] = [];
    if (identite || (editeurNorm && nomNorm)) {
      let q = k
        .selectFrom('vulnerabilites_veille_cve_produits as t')
        .innerJoin('vulnerabilites_veille_cve as v', 'v.cve', 't.cve')
        .select([
          't.cve',
          't.partie',
          't.editeur',
          't.produit',
          't.version',
          't.debut_inclus',
          't.debut_exclus',
          't.fin_inclus',
          't.fin_exclus',
          'v.produits_tronques',
        ])
        .where('t.vulnerable', '=', true);
      q = identite
        ? q.where(sql`lower(t.editeur)`, '=', identite.editeur).where(sql`lower(t.produit)`, '=', identite.produit)
        : q.where('t.editeur_norm', '=', editeurNorm).where('t.produit_norm', '=', nomNorm);
      touches = (await q.orderBy('t.cve').orderBy('t.rang').execute()) as LigneTouche[];
    }
    const candidats = new Map<string, LigneTouche[]>();
    for (const t of touches) candidats.set(t.cve, [...(candidats.get(t.cve) ?? []), t]);
    // CVE connues seulement par une publication du CERT Santé (aucun produit touché vulnérable publié par NVD), dont le
    // produit cité porte le nom du produit surveillé, ou « éditeur nom » (V26).
    const noms = [...new Set([nomNorm, normaliserNom(`${p.editeur} ${p.nom}`)].filter((x) => x))];
    const parAvis = new Set(
      noms.length
        ? (
            await sql<{ cve: string }>`SELECT DISTINCT c.cve FROM vulnerabilites_veille_avis a
              CROSS JOIN LATERAL unnest(a.cves) AS c(cve)
              JOIN vulnerabilites_veille_cve v ON v.cve = c.cve
              WHERE a.source = 'cert-sante' AND a.produit_norm = ANY(${noms}::text[])
                AND NOT EXISTS (SELECT 1 FROM vulnerabilites_veille_cve_produits t WHERE t.cve = c.cve AND t.vulnerable)
              ORDER BY c.cve`.execute(k)
          ).rows.map((x) => x.cve)
        : [],
    );
    for (const cve of parAvis) if (candidats.has(cve)) parAvis.delete(cve);
    const existants = new Map(
      (await k.selectFrom('vulnerabilites_rapprochements').selectAll().where('produit_id', '=', p.id).execute()).map(
        (r) => [r.cve, r],
      ),
    );
    const bilan: Partial<Record<StatutRapprochement, number>> = {};
    let changements = 0;
    const nouveaux: Record<string, unknown>[] = [];
    const bascules: { id: string; rattachee: boolean }[] = [];
    for (const cve of [...new Set([...candidats.keys(), ...parAvis, ...existants.keys()])].sort()) {
      const plages = candidats.get(cve);
      const avis = parAvis.has(cve);
      const courant = existants.get(cve);
      const calcul = plages
        ? classerRapprochement({
            versionDeclaree: p.version_produit,
            parIdentifiant: !!identite,
            plages: plages.map(plageDe),
            tronque: plages[0]!.produits_tronques,
          })
        : avis
          ? classerRapprochement({
              versionDeclaree: p.version_produit,
              parIdentifiant: false,
              plages: [],
              tronque: false,
              parAvis: true,
            })
          : null;
      const empreinteCve = plages
        ? empreinte({ plages: plages.map(plageDe), tronque: plages[0]!.produits_tronques })
        : avis
          ? empreinte({ avis: 'cert-sante' })
          : (courant?.empreinte_cve ?? '');
      const etat: EtatRapprochement | null = courant
        ? {
            statut: courant.statut,
            empreinteProduit: courant.empreinte_produit,
            empreinteCve: courant.empreinte_cve,
            versionDecidee: courant.version_decidee,
          }
        : null;
      const t = transitionRapprochement(etat, calcul, {
        empreinteProduit,
        empreinteCve,
        versionProduit: p.version_produit,
      });
      if (!t) continue;
      const proposee = calcul?.calcul === 'proposee' ? calcul : null;
      const valeurs = {
        statut: t.statut,
        motif: t.garderDecision ? (courant?.motif ?? null) : proposee ? proposee.motif : (courant?.motif ?? null),
        version_dans_plage: t.garderDecision
          ? (courant?.version_dans_plage ?? null)
          : proposee
            ? proposee.versionDansPlage
            : null,
        par_identifiant: plages ? !!identite : avis ? false : (courant?.par_identifiant ?? !!identite),
        empreinte_produit: empreinteProduit,
        empreinte_cve: empreinteCve,
        version_decidee: t.garderDecision ? (courant?.version_decidee ?? null) : null,
        decide_par: t.garderDecision ? (courant?.decide_par ?? null) : null,
        decide_le: t.garderDecision ? (courant?.decide_le ?? null) : null,
        note: t.garderDecision ? (courant?.note ?? '') : '',
      };
      if (!courant) {
        nouveaux.push({ produit_id: p.id, cve, ...valeurs });
      } else {
        const change = (Object.keys(valeurs) as (keyof typeof valeurs)[]).some(
          (cle) => JSON.stringify(valeurs[cle]) !== JSON.stringify(courant[cle]),
        );
        if (!change) continue;
        await k
          .updateTable('vulnerabilites_rapprochements')
          .set((eb) => ({ ...valeurs, version: eb('version', '+', 1), calcule_le: sql<Date>`now()` }))
          .where('id', '=', courant.id)
          .execute();
        if (RATTACHEE(courant.statut) !== RATTACHEE(t.statut))
          bascules.push({ id: courant.id, rattachee: RATTACHEE(t.statut) });
      }
      changements++;
      bilan[t.statut] = (bilan[t.statut] ?? 0) + 1;
    }
    for (let i = 0; i < nouveaux.length; i += 1000)
      await k
        .insertInto('vulnerabilites_rapprochements')
        .values(nouveaux.slice(i, i + 1000) as never)
        .execute();
    if (bascules.length) await this.apresBascules?.(k, c, p.id, bascules);
    if (changements)
      await this.db.audit(
        AUTOMATE,
        null,
        'vulnerabilites.rapprochement.recalcule',
        p.id,
        { changements, statuts: bilan, parIdentifiant: !!identite },
        c,
      );
    return changements;
  }

  /* ---------------------------------------------------------------- Lecture (fiche d'un produit) */
  /** Rapprochements d'un produit (sauf retirés), comptés par statut, chaque statut borné, avec leur priorité. */
  async duProduit(produitId: string): Promise<{
    compteurs: Record<Exclude<StatutRapprochement, 'retiree'>, number>;
    rapprochements: RapprochementDto[];
  }> {
    const reglage = await this.reglage.valeurs();
    const comptes = await this.db.k
      .selectFrom('vulnerabilites_rapprochements')
      .select(['statut', sql<number>`count(*)::int`.as('n')])
      .where('produit_id', '=', produitId)
      .groupBy('statut')
      .execute();
    const compteurs = { rattachee: 0, ecartee: 0, proposee: 0, confirmee: 0, rejetee: 0 };
    for (const x of comptes) if (x.statut !== 'retiree') compteurs[x.statut] = x.n;
    const { rows } = await sql<{
      id: string;
      cve: string;
      statut: StatutRapprochement;
      motif: RapprochementDto['motif'];
      version_dans_plage: RapprochementDto['versionDansPlage'];
      par_identifiant: boolean;
      version_decidee: string | null;
      decide_par: string | null;
      decide_le: Date | null;
      note: string;
      version: number;
      calcule_le: Date;
      description: string | null;
      cvss31_gravite: string | null;
      cvss40_gravite: string | null;
      score: string | null;
      epss_score: string | null;
      kev: boolean;
      alerte: boolean;
      produits_tronques: boolean;
      annulation_decision: 'confirmee' | 'rejetee' | null;
      annule_par: string | null;
      annule_le: Date | null;
      annulation_note: string;
    }>`
      SELECT * FROM (
        SELECT r.id, r.cve, r.statut, r.motif, r.version_dans_plage, r.par_identifiant, r.version_decidee, r.decide_par,
               r.decide_le, r.note, r.version, r.calcule_le, v.description, v.cvss31_gravite, v.cvss40_gravite,
               ${scoreNvd} AS score, v.epss_score, v.kev_ajout IS NOT NULL AS kev, ${alerteCertFr('v.cve')} AS alerte,
               v.produits_tronques, r.annulation_decision, r.annule_par, r.annule_le, r.annulation_note,
               row_number() OVER (PARTITION BY r.statut ORDER BY r.cve DESC) AS n
        FROM vulnerabilites_rapprochements r JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
        WHERE r.produit_id = ${produitId}::uuid AND r.statut <> 'retiree') x
      WHERE x.n <= ${RAPPROCHEMENTS_PAR_STATUT_MAX}`.execute(this.db.k);
    const plages = new Map<string, PlageAfficheeDto[]>();
    if (rows.length) {
      const p = await this.db.k
        .selectFrom('vulnerabilites_produits')
        .select(['editeur', 'nom', 'cpe'])
        .where('id', '=', produitId)
        .executeTakeFirstOrThrow();
      const identite = identiteCpe(p.cpe);
      let q = this.db.k
        .selectFrom('vulnerabilites_veille_cve_produits as t')
        .select([
          't.cve',
          't.editeur',
          't.produit',
          't.version',
          't.debut_inclus',
          't.debut_exclus',
          't.fin_inclus',
          't.fin_exclus',
        ])
        .where('t.vulnerable', '=', true)
        .where(
          't.cve',
          'in',
          rows.map((r) => r.cve),
        );
      q = identite
        ? q.where(sql`lower(t.editeur)`, '=', identite.editeur).where(sql`lower(t.produit)`, '=', identite.produit)
        : q.where('t.editeur_norm', '=', normaliserNom(p.editeur)).where('t.produit_norm', '=', normaliserNom(p.nom));
      for (const t of await q.orderBy('t.cve').orderBy('t.rang').execute())
        plages.set(t.cve, [...(plages.get(t.cve) ?? []), plageDe({ ...t, partie: 'a', produits_tronques: false })]);
    }
    const faits = await lireFaitsCve(
      this.db.k,
      rows.map((r) => r.cve),
    );
    const dtos = rows.map((r): RapprochementDto => {
      const f = faits.get(r.cve);
      const sources = sourcesDe(f ? [f] : []);
      const retenues = valeursRetenues(sources.valeurs);
      return {
        id: r.id,
        cve: r.cve,
        statut: r.statut,
        motif: r.motif,
        versionDansPlage: r.version_dans_plage,
        parIdentifiant: r.par_identifiant,
        plages: plages.get(r.cve) ?? [],
        tronque: r.produits_tronques,
        description: r.description,
        gravite: retenues.gravite?.gravite ?? null,
        cvssScore: retenues.cvss?.score ?? null,
        epss: retenues.epss?.score ?? null,
        kev: r.kev,
        alerteCertFr: r.alerte,
        sources,
        annulation:
          r.annulation_decision && r.annule_par && r.annule_le
            ? {
                decision: r.annulation_decision,
                par: r.annule_par,
                le: r.annule_le.toISOString(),
                note: r.annulation_note,
              }
            : null,
        decidePar: r.decide_par,
        decideLe: r.decide_le?.toISOString() ?? null,
        note: r.note,
        versionDecidee: r.version_decidee,
        calculeLe: r.calcule_le.toISOString(),
        version: r.version,
        priorite: calculerPriorite({ ...faitsDepuisSources(sources), presence: presenceDe(r.statut) }, reglage),
      };
    });
    const ordre = (s: StatutRapprochement) => ORDRE_FICHE.indexOf(s);
    dtos.sort(
      (a, b) =>
        ordre(a.statut) - ordre(b.statut) ||
        a.priorite.niveau.localeCompare(b.priorite.niveau) ||
        (a.cve < b.cve ? 1 : a.cve > b.cve ? -1 : 0),
    );
    return { compteurs, rapprochements: dtos };
  }

  /* ---------------------------------------------------------------- Décision (vulnerabilites:modifier) */
  async decider(
    id: string,
    body: DecisionRapprochement,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<{ id: string; statut: StatutRapprochement; version: number }> {
    return this.db.tx(async (c, k) => {
      const r = await k
        .selectFrom('vulnerabilites_rapprochements as r')
        .innerJoin('vulnerabilites_produits as p', 'p.id', 'r.produit_id')
        .select(['r.id', 'r.statut', 'r.version', 'r.cve', 'r.produit_id', 'r.motif', 'p.version_produit'])
        .where('r.id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!r) throw new HttpError(404, 'Rapprochement introuvable.');
      if (r.version !== attendue) throw conflict({ id: r.id, statut: r.statut, version: r.version });
      if (r.statut !== 'proposee')
        throw new HttpError(409, 'Ce rapprochement n’est plus à décider : rechargez la fiche du produit.');
      const statut: StatutRapprochement = body.decision === 'confirmer' ? 'confirmee' : 'rejetee';
      const fin = await k
        .updateTable('vulnerabilites_rapprochements')
        .set((eb) => ({
          statut,
          decide_par: user.username,
          decide_le: sql<Date>`now()`,
          version_decidee: r.version_produit,
          note: body.note,
          version: eb('version', '+', 1),
        }))
        .where('id', '=', id)
        .returning(['version'])
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        statut === 'confirmee' ? 'vulnerabilites.rapprochement.confirme' : 'vulnerabilites.rapprochement.rejete',
        id,
        { produit: r.produit_id, cve: r.cve, motif: r.motif, versionProduit: r.version_produit, note: body.note },
        c,
      );
      // Une confirmation rattache la CVE : le suivi réagit comme à tout changement de rattachement (proposition
      // « corrigée » retirée, faille corrigée réapparue).
      if (statut === 'confirmee') await this.apresBascules?.(k, c, r.produit_id, [{ id, rattachee: true }]);
      return { id, statut, version: fin.version };
    }, user.username);
  }

  /* ---------------------------------------------------------------- Annulation d'une décision (V24) */
  /** Annule une confirmation ou un rejet (`vulnerabilites:modifier`, If-Match : version du rapprochement), note
      facultative. La décision est effacée, puis le produit est recalculé : le rapprochement redevient à décider, ou prend
      le statut que la règle lui donne (rattaché d'office, écarté, retiré). Le passage intermédiaire garde le rattachement
      de la décision annulée (« rattachée » pour une confirmation, « à décider » pour un rejet) : le recalcul voit ainsi le
      vrai changement et le signale au suivi (lot V4b), comme tout changement de rattachement. L'annulation est gardée sur
      le rapprochement (dernière annulation) et journalisée, avec la décision annulée et son auteur. Verrous dans l'ordre du
      recalcul : produit, puis rapprochement. */
  async annuler(
    id: string,
    body: AnnulationRapprochement,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<{ id: string; statut: StatutRapprochement; version: number }> {
    return this.db.tx(async (c, k) => {
      const lu = await k
        .selectFrom('vulnerabilites_rapprochements')
        .select('produit_id')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!lu) throw new HttpError(404, 'Rapprochement introuvable.');
      await k.selectFrom('vulnerabilites_produits').select('id').where('id', '=', lu.produit_id).forUpdate().execute();
      const r = await k
        .selectFrom('vulnerabilites_rapprochements')
        .select(['id', 'statut', 'version', 'cve', 'produit_id', 'motif', 'decide_par', 'decide_le', 'version_decidee'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!r) throw new HttpError(404, 'Rapprochement introuvable.');
      if (r.version !== attendue) throw conflict({ id: r.id, statut: r.statut, version: r.version });
      if (r.statut !== 'confirmee' && r.statut !== 'rejetee')
        throw new HttpError(409, 'Ce rapprochement n’a pas de décision à annuler : rechargez la fiche du produit.');
      await k
        .updateTable('vulnerabilites_rapprochements')
        .set((eb) => ({
          statut: r.statut === 'confirmee' ? 'rattachee' : 'proposee',
          motif: r.statut === 'confirmee' ? r.motif : (r.motif ?? 'nom_seulement'),
          decide_par: null,
          decide_le: null,
          version_decidee: null,
          note: '',
          annulation_decision: r.statut,
          annule_par: user.username,
          annule_le: sql<Date>`now()`,
          annulation_note: body.note,
          version: eb('version', '+', 1),
        }))
        .where('id', '=', id)
        .execute();
      await this.recalculerProduit(k, c, r.produit_id);
      const fin = await k
        .selectFrom('vulnerabilites_rapprochements')
        .select(['statut', 'version'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.rapprochement.annule',
        id,
        {
          produit: r.produit_id,
          cve: r.cve,
          decisionAnnulee: {
            statut: r.statut,
            par: r.decide_par,
            le: r.decide_le?.toISOString() ?? null,
            versionProduit: r.version_decidee,
          },
          statut: fin.statut,
          note: body.note,
        },
        c,
      );
      return { id, statut: fin.statut, version: fin.version };
    }, user.username);
  }

  /* ---------------------------------------------------------------- Suggestions d'identifiant */
  /** Couples éditeur et produit rangés par la veille dont le produit contient le nom saisi normalisé, ou y est contenu
      (trois caractères au moins) ; d'abord le produit identique, puis l'éditeur identique ou contenu, puis le nombre de CVE. */
  async suggestions(q: SuggestionsCpeQuery): Promise<SuggestionCpeDto[]> {
    const nom = normaliserNom(q.nom);
    const editeur = normaliserNom(q.editeur ?? '');
    if (nom.length < 2) return [];
    const { rows } = await sql<{ partie: PartieCpe; editeur: string; produit: string; cves: number }>`
      SELECT t.partie, lower(t.editeur) AS editeur, lower(t.produit) AS produit, count(DISTINCT t.cve)::int AS cves,
             bool_or(t.produit_norm = ${nom}) AS exact,
             bool_or(${editeur} <> '' AND (t.editeur_norm = ${editeur} OR position(${editeur} IN t.editeur_norm) > 0
                     OR (char_length(t.editeur_norm) >= 3 AND position(t.editeur_norm IN ${editeur}) > 0))) AS meme_editeur
      FROM vulnerabilites_veille_cve_produits t
      WHERE t.vulnerable AND (position(${nom} IN t.produit_norm) > 0
             OR (char_length(t.produit_norm) >= 3 AND position(t.produit_norm IN ${nom}) > 0))
      GROUP BY t.partie, lower(t.editeur), lower(t.produit)
      ORDER BY exact DESC, meme_editeur DESC, cves DESC, editeur, produit, t.partie
      LIMIT ${SUGGESTIONS_CPE_MAX}`.execute(this.db.k);
    return rows.map((r) => ({
      partie: r.partie,
      editeur: r.editeur,
      produit: r.produit,
      cpe: cpeDepuisIdentite(r),
      cves: r.cves,
    }));
  }
}
