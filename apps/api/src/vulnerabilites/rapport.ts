/* Module Vulnérabilités (ADR 0100, lot S2 ; décision du RSSI du 18/11/2026) : rapport de pilotage pour la direction et
   l'audit, sur un mois ou une période libre, pour toute la plateforme ou un périmètre lu.
   - Format : la plateforme ne produit aucun PDF côté serveur et le lot n'ajoute aucune dépendance. La route rend le rapport
     (JSON), mis en page par l'interface en page imprimable A4 que le navigateur enregistre en PDF, ou ses tableaux en CSV
     (mêmes règles que les autres exports : « ; », BOM, formules neutralisées). Les tableaux sont composés par le paquet
     partagé (tableauxRapport, csvRapport), les mêmes à l'écran et dans le fichier.
   - Contenu : niveau d'alerte et son évolution (instantanés de la période), failles présentes en P1 (listées par CVE et
     produit) et en P2, situation du moment, délais de correction (mesure du lot S1), dépassements, exceptions en cours,
     bientôt échues et échues sur la période (justification, mesure compensatoire, échéance, qui l'a accordée), tendances
     semaine après semaine, alertes critiques de la période (ouvertes, prises en compte, closes, délais de prise en compte),
     état des sources de veille et des connecteurs.
   - Confidentialité (le document sort de la plateforme) : aucun nom de machine, de domaine, d'adresse IP ni de compte de
     machine ; CVE, produits, nombres et nom du périmètre lu seulement. Les textes (titres, produits, justification et mesure
     compensatoire d'une exception) passent par le masque des machines de l'assistant, en mode strict (« [machine] »). Les
     connecteurs sont désignés par leur type et un numéro, sans nom d'instance ni adresse. Le détail des machines n'est pas
     proposé (point ouvert).
   - Droits (option prudente, à confirmer) : toute personne qui lit le module, pour ce qu'elle lit : nombres de failles,
     niveau et alertes communs à tous (lot ALH5) ; un périmètre illisible répond 404 ; les exceptions sont celles des failles
     dont la personne lit une machine (comme l'onglet « Délais et exceptions »).
   - Journal : `vulnerabilites.rapport.produit` (période, portée, format, sans détail), sans contenu.
   Requêtes, nombre fixe, aucune par faille : bornes de la période 1, périmètre 0 ou 1, mesure de la situation 20 au plus
   (propositions 1, calcul global 17 au plus, périmètres des machines 1 et des actifs 1), instantanés 2, mesure des
   corrections 1, exceptions 1, alertes 1, masque 4, état de la veille 2, état des connecteurs 2 et 3 par instance, journal 1. */
import {
  type AlerteRapportDto,
  agregerParSemaine,
  csvRapport,
  type DepassementRapportDto,
  type ExceptionDto,
  type FailleRapportDto,
  MESURES_VIDES,
  mesurerPrisesEnCompte,
  type MotifClotureAlerte,
  PERIMETRE_INSTANTANE_AUCUN,
  periodeRapport,
  pointsParJour,
  PRESENCES,
  RAPPORT_LISTE_MAX,
  type RapportVulnerabilitesDto,
  type RechercheRapport,
  STATUTS_EXCEPTION,
  type StatutException,
  syntheseNiveau,
  tendanceSituation,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Masquer } from '../assistant/masque.js';
import type { SessionUser } from '../auth.js';
import type { Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { AlertesVulnerabilites } from './alertes.js';
import { type DelaisVulnerabilites, objetsEnDepassement } from './delais.js';
import type { SynchronisationTenable } from './tenable.js';
import type { SurfaceExterneAlh } from './surface-externe.js';
import { aujourdhui } from './suivi.js';
import type { Portee, TendancesVulnerabilites } from './tendances.js';
import type { VeilleVulnerabilites } from './veille.js';

const FUSEAU = 'Europe/Paris';
const ETATS_EXECUTION: Record<string, string> = {
  en_file: 'En file',
  en_cours: 'En cours',
  recu: 'Reçue',
  echec: 'En échec',
  expire: 'Expirée',
};

export class RapportVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly etablissement: string,
    private readonly tendances: Pick<TendancesVulnerabilites, 'mesurer' | 'portee' | 'instantanes' | 'depuis'>,
    private readonly alertes: Pick<AlertesVulnerabilites, 'titreEtProduit'>,
    private readonly delais: Pick<DelaisVulnerabilites, 'mesurer' | 'exceptions'>,
    private readonly veille: Pick<VeilleVulnerabilites, 'etat'>,
    private readonly tenable: Pick<SynchronisationTenable, 'etat'>,
    private readonly surface: Pick<SurfaceExterneAlh, 'etat'>,
    /** Masque des machines en mode strict (aucune conversation) : tout nom, adresse ou identifiant devient « [machine] ». */
    private readonly masque: (user: SessionUser) => Promise<Masquer>,
  ) {}

  /** Produit le rapport et trace sa production au journal (sans contenu). */
  async produire(
    user: SessionUser,
    ip: string,
    q: RechercheRapport,
  ): Promise<{ rapport: RapportVulnerabilitesDto; csv: string | null }> {
    const maintenant = new Date();
    const periode = periodeRapport(q, aujourdhui(maintenant));
    if (!periode) throw new HttpError(422, 'La période commence après aujourd’hui.');
    const portee = await this.tendances.portee(user, q.perimetre);
    const rapport = await this.composer(user, portee, periode.du, periode.au, maintenant);
    await this.db.audit(user, ip, 'vulnerabilites.rapport.produit', '', {
      du: periode.du,
      au: periode.au,
      perimetre: portee.aucun ? 'aucun' : (portee.id ?? 'tout'),
      format: q.format,
      detail: false,
    });
    return { rapport, csv: q.format === 'csv' ? csvRapport(rapport) : null };
  }

  private async composer(
    user: SessionUser,
    portee: Portee,
    du: string,
    au: string,
    maintenant: Date,
  ): Promise<RapportVulnerabilitesDto> {
    const k = this.db.k;
    const { rows: bornes } = await sql<{ debut: Date; fin: Date }>`
      SELECT (${du}::date::timestamp AT TIME ZONE ${FUSEAU}) AS debut,
             ((${au}::date + 1)::timestamp AT TIME ZONE ${FUSEAU}) AS fin`.execute(k);
    const { debut, fin } = bornes[0]!;
    const masquer = await this.masque(user);
    const texte = async (t: string | null) => (t ? await masquer(t) : t);
    const s = await this.tendances.mesurer(k, maintenant, null);
    const cle = portee.aucun ? PERIMETRE_INSTANTANE_AUCUN : portee.id;
    const dansPortee = (perimetres: Set<string>) => cle === null || perimetres.has(cle);
    const restriction = cle === null ? null : { perimetre: portee.aucun ? null : portee.id };

    // Situation du moment : toute la plateforme (sans total de machines ni d'actifs) ou la portée.
    const situation =
      cle === null
        ? { ...s.instantane.global, machines: null, actifs: null }
        : (s.instantane.perimetres.get(cle) ?? { ...MESURES_VIDES });

    // Failles critiques (P1) présentes de la portée, et nombre de P2.
    const depasses = objetsEnDepassement(s.objets, s.reglage.delais, maintenant);
    const enDepassement = new Set(depasses.map((o) => `${o.nature}:${o.id}`));
    const objetParCle = new Map(s.objets.map((o) => [`${o.nature}:${o.id}`, o]));
    const presentes = s.presentes.filter((p) => dansPortee(p.perimetres));
    const p1 = presentes.filter((p) => p.priorite.niveau === 'P1');
    const critiques: FailleRapportDto[] = [];
    for (const p of p1.slice(0, RAPPORT_LISTE_MAX)) {
      const { titre, produit } = this.alertes.titreEtProduit(p.x, s.titres);
      const cles = [
        ...p.x.constatIds.map((id) => `constat:${id}`),
        ...p.x.rapprochementIds.map((id) => `declaree:${id}`),
      ];
      const premieres = cles.flatMap((c) => (objetParCle.has(c) ? [objetParCle.get(c)!.premiere] : [])).sort();
      critiques.push({
        cle: p.x.cle,
        cve: p.x.cve,
        titre: (await texte(titre))!,
        produit: await texte(produit),
        presences: PRESENCES.filter((x) => p.x.presences.has(x)),
        depuis: premieres[0] ?? null,
        enDepassement: cles.some((c) => enDepassement.has(c)),
      });
    }

    // Dépassements du moment, les plus anciens d'abord.
    const depassesPortee = depasses
      .filter((d) => {
        const o = objetParCle.get(`${d.nature}:${d.id}`);
        return !!o && (cle === null || s.perimetresObjet(o).has(cle));
      })
      .sort((a, b) => (a.echeance < b.echeance ? -1 : a.echeance > b.echeance ? 1 : 0));
    const depassements: DepassementRapportDto[] = [];
    for (const d of depassesPortee.slice(0, RAPPORT_LISTE_MAX)) {
      const o = objetParCle.get(`${d.nature}:${d.id}`)!;
      depassements.push({
        nature: d.nature,
        titre: (await texte(o.nom))!,
        cves: o.cves,
        priorite: d.priorite,
        echeance: d.echeance,
        retardHeures: Math.round(((maintenant.getTime() - Date.parse(d.echeance)) / 3_600_000) * 10) / 10,
      });
    }

    // Délais de correction (mesure du lot S1) et exceptions de la période.
    const mesure = await this.delais.mesurer(k, debut, fin, restriction);
    const lues = await this.delais.exceptions(user, aujourdhui(maintenant), {
      echues: { du: debut, au: fin },
      ...(restriction ? { restriction } : {}),
    });
    const compteurs = Object.fromEntries(STATUTS_EXCEPTION.map((x) => [x, 0])) as Record<StatutException, number>;
    const exceptions: ExceptionDto[] = [];
    for (const e of lues) {
      compteurs[e.statut]++;
      if (exceptions.length < RAPPORT_LISTE_MAX)
        exceptions.push({
          ...e,
          titre: (await texte(e.titre))!,
          justification: await texte(e.justification),
          mesure: await texte(e.mesure),
        });
    }

    // Niveau et tendances : instantanés de la période (niveau de la plateforme ; nombres de la portée).
    const instantanes = await this.tendances.instantanes(k, portee, du, au);
    const semaines = agregerParSemaine(pointsParJour(instantanes, du, au));

    return {
      etablissement: this.etablissement,
      produitLe: maintenant.toISOString(),
      du,
      au,
      perimetre: portee,
      avecDetail: false,
      niveau: { ...syntheseNiveau(instantanes), actuel: s.niveau },
      situation,
      critiques: {
        total: p1.length,
        p2: presentes.filter((p) => p.priorite.niveau === 'P2').length,
        elements: critiques,
      },
      delais: { reglage: s.reglage.delais, ...mesure },
      depassements: { total: depassesPortee.length, elements: depassements },
      exceptions: { compteurs, elements: exceptions },
      tendances: { depuis: await this.tendances.depuis(k), semaines, tendance: tendanceSituation(semaines) },
      alertes: await this.alertesCritiques(debut, fin, texte),
      sources: await this.sources(user),
      bornes: { liste: RAPPORT_LISTE_MAX },
    };
  }

  /** Alertes qui ont été critiques pendant la période (communes à tous) : ouvertes, prises en compte, closes et encore en
      cours à la fin ; délai de prise en compte. Une requête. */
  private async alertesCritiques(debut: Date, fin: Date, texte: (t: string | null) => Promise<string | null>) {
    const { rows } = await sql<{
      cve: string | null;
      titre: string;
      produit: string | null;
      critique_le: Date;
      prise_le: Date | null;
      close_le: Date | null;
      motif_cloture: MotifClotureAlerte | null;
    }>`SELECT a.cve, a.titre, a.produit, a.critique_le, a.prise_le, a.close_le, a.motif_cloture
       FROM vulnerabilites_alertes a
       WHERE a.critique_le IS NOT NULL AND a.critique_le < ${fin} AND (a.close_le IS NULL OR a.close_le >= ${debut})
       ORDER BY a.critique_le, a.id`.execute(this.db.k);
    const dans = (d: Date | null) => !!d && d >= debut && d < fin;
    const elements: AlerteRapportDto[] = [];
    for (const a of rows.slice(0, RAPPORT_LISTE_MAX))
      elements.push({
        cve: a.cve,
        titre: (await texte(a.titre))!,
        produit: await texte(a.produit),
        critiqueLe: a.critique_le.toISOString(),
        priseLe: a.prise_le?.toISOString() ?? null,
        closeLe: a.close_le?.toISOString() ?? null,
        motif: a.motif_cloture,
      });
    const prises = rows.filter((a) => dans(a.prise_le));
    return {
      ouvertes: rows.filter((a) => dans(a.critique_le)).length,
      prisesEnCompte: prises.length,
      closes: rows.filter((a) => dans(a.close_le)).length,
      enCours: rows.filter((a) => !a.close_le || a.close_le >= fin).length,
      delai: mesurerPrisesEnCompte(
        prises.map((a) => ({ critiqueLe: a.critique_le.toISOString(), priseLe: a.prise_le!.toISOString() })),
      ),
      total: rows.length,
      elements,
    };
  }

  /** État des sources de veille (sans texte d'erreur) et des connecteurs (type et numéro, ni nom d'instance ni adresse). */
  private async sources(user: SessionUser): Promise<RapportVulnerabilitesDto['sources']> {
    const veille = await this.veille.etat();
    const connecteurs = [
      ...(await this.tenable.etat()).map((c, i) => ({ c, libelle: `Tenable Security Center n° ${i + 1}` })),
      ...(await this.surface.etat(user)).map((c, i) => ({ c, libelle: `AlgoLightHouse n° ${i + 1}` })),
    ];
    return {
      fluxOuvert: veille.flux.ouvert,
      veille: veille.sources.map((x) => ({
        libelle: x.libelle,
        derniereReussite: x.derniereReussite,
        enRetard: x.enRetard,
        enEchec: x.erreur !== null,
      })),
      connecteurs: connecteurs.map(({ c, libelle }) => ({
        libelle,
        actif: c.actif,
        derniereCompleteLe: c.derniereCompleteLe,
        derniereEtat: c.derniere ? (ETATS_EXECUTION[c.derniere.etat] ?? c.derniere.etat) : null,
      })),
    };
  }
}
