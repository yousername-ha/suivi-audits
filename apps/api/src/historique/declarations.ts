/* Déclaration réglementaire des incidents (ADR 0105, décisions du RSSI du 18/11/2026) : déclarations santé (CERT Santé, ARS)
   et NIS 2 (ANSSI) d'un incident du registre historique, rangées dans la table `incidents_declarations` (migration 087).
   - Propositions : au premier passage de l'incident à « Incident de sécurité » (appel de `Incidents`, dans la même
     transaction), selon la qualification guidée et la catégorie d'entité NIS 2 ; le compte à rebours démarre aussitôt.
   - Préparer (rubriques, numéro de dossier pressenti) : incidents:modifier sur le périmètre de l'incident.
   - Confirmer « à déclarer », écarter « non requise » (motif obligatoire), marquer « envoyée » (référence obligatoire, texte
     figé), ouvrir une déclaration ou un complément et corriger la date de qualification : rôle prédéfini « RSSI » seulement
     (direct ou par un groupe), 403 pour tout autre compte, administrateur compris.
   - Chaque geste se fait sous le verrou de l'état historique (comme les écritures des incidents), avec If-Match sur la
     version de la déclaration et une entrée au journal d'audit. Un incident hors des périmètres de la personne répond 404.
   - Une déclaration envoyée ou écartée est figée par un déclencheur en base ; l'incident qui en porte une n'est plus
     supprimable.
   - Rappels (type `incident_declaration`) : traités par l'automate, indépendamment du module des écarts. */
import {
  CorrectionQualification,
  DECLARATION_RESERVEE,
  ETAPE_DECLARATION_LIBELLES,
  EnvoiDeclaration,
  IDENTITE_ETABLISSEMENT_VIDE,
  MiseAlEcartDeclaration,
  OuvertureDeclaration,
  PreparationDeclaration,
  REGIME_DECLARATION_LIBELLES,
  ROLE_DECLARATION_INCIDENT,
  STATUT_DECLARATION_LIBELLES,
  declarationFigee,
  declarationOuverte,
  declarationsProposees,
  delaiDeclaration,
  effectivePermissions,
  jalonRappel,
  lireIncident,
  messageRappelDeclaration,
  preremplissage,
  rubriquesDeclaration,
  rubriquesRemplies,
  titreRappelDeclaration,
  dateHeureParis,
  Rights,
  type DeclarationIncidentDto,
  type EtapeDeclaration,
  type IdentiteEtablissement,
  type Incident,
  type OrigineDeclaration,
  type RegimeDeclaration,
  type RubriqueRemplie,
  type StatutDeclaration,
  type VueDeclarationsIncident,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { sql, type Selectable } from 'kysely';
import type { SessionUser } from '../auth.js';
import { surConnexion, type Client } from '../db/db.js';
import type { IncidentsDeclarations } from '../db/types.generated.js';
import type { ModeleDocument } from '../export/office.js';
import { DEFAULT_SMSI } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { verrouillerEtat } from '../legacy/store.js';
import { COMPTE_ACTIF, porteLeRole, type NotificationEmise } from '../notifications-metier.js';
import { loadGrants } from '../rights.js';
import type { Settings } from '../settings.js';
import { entrees, perimetreDe, remplacerEntree, type RegistreHistorique } from './registre.js';

type Ligne = Selectable<IncidentsDeclarations>;
const KIND = 'incident_declaration';
const ABSENTE = 'Déclaration absente.';
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const nomDe = (u: SessionUser) => (u.displayName || u.username).slice(0, 200);
const textes = (v: unknown): Record<string, string> =>
  isObject(v)
    ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : {};

export interface ContexteIncident {
  c: Client;
  data: JsonObject;
  brut: JsonObject;
  incident: Incident;
}

export class DeclarationsIncidents {
  constructor(
    private readonly r: RegistreHistorique,
    private readonly settings: Pick<Settings, 'get'>,
  ) {}

  private get db() {
    return this.r.g.db;
  }

  /** La personne tient le rôle « RSSI » (direct ou par un groupe), sans portée qui écarte le module incidents. Lu à chaque
      appel : un retrait du rôle vaut aussitôt. */
  async peutDeclarer(user: Pick<SessionUser, 'id'>, c?: Client): Promise<boolean> {
    return (await loadGrants(c ?? this.db.pool, user.id)).some(
      (g) => g.roleId === ROLE_DECLARATION_INCIDENT && (g.modules == null || g.modules.includes('incidents')),
    );
  }

  private identite(): IdentiteEtablissement {
    try {
      return { ...IDENTITE_ETABLISSEMENT_VIDE, ...this.settings.get('etablissement') };
    } catch {
      return { ...IDENTITE_ETABLISSEMENT_VIDE };
    }
  }

  /* ------------------------------------------------------------------ Appels du registre des incidents */
  /** Premier passage à « Incident de sécurité » : propose les déclarations probables (dans la transaction de l'incident),
      les journalise et envoie le rappel de qualification. `brut` porte déjà sa date de qualification. */
  async proposer(c: Client, data: JsonObject, brut: JsonObject, user: SessionUser, ip: string): Promise<void> {
    const incident = lireIncident(brut);
    if (!incident || !incident.qualifiedAt) return;
    const existantes = await this.lignes(c, incident.id);
    const creees: Ligne[] = [];
    for (const p of declarationsProposees(incident.answers, str(data.entityCategory))) {
      if (existantes.some((l) => l.regime === p.regime && l.etape === p.etape)) continue;
      const l = await this.inserer(c, incident, p.regime, p.etape, 'proposition', 'proposee', null, user, null);
      creees.push(l);
      await this.db.audit(
        user,
        ip,
        'incident.declaration.proposee',
        `legacy:incidents:${incident.id}`,
        this.trace(l),
        c,
      );
    }
    if (creees.length) await this.notifier(c, new Map([[incident.id, incident]]), creees, new Date());
  }

  /** Avant la suppression d'un incident : refusée s'il porte une déclaration envoyée ou écartée (la preuve ne disparaît pas
      avec la fiche) ; sinon ses déclarations ouvertes sont retirées avec lui. */
  async avantSuppression(c: Client, incidentId: string): Promise<number> {
    const l = await this.lignes(c, incidentId);
    if (l.some((x) => declarationFigee(x.statut)))
      throw new HttpError(
        409,
        'Cet incident porte une déclaration réglementaire envoyée ou écartée : il ne peut pas être supprimé.',
      );
    if (!l.length) return 0;
    // Les compléments d'abord (clé étrangère vers la déclaration complétée).
    await surConnexion(c)
      .deleteFrom('incidents_declarations')
      .where('incident_id', '=', incidentId)
      .where('etape', '=', 'complement')
      .execute();
    await surConnexion(c).deleteFrom('incidents_declarations').where('incident_id', '=', incidentId).execute();
    return l.length;
  }

  /** Correction de la date de qualification (rôle RSSI, contrôlé par l'appelant) : départ et échéance recalculés pour les
      déclarations non figées dont le délai part de la qualification. Renvoie le nombre de déclarations recalculées. */
  async recalculer(c: Client, incidentId: string, qualifieeLe: string, user: SessionUser): Promise<number> {
    let n = 0;
    for (const l of await this.lignes(c, incidentId)) {
      if (declarationFigee(l.statut) || l.etape === 'rapport_final' || l.etape === 'complement') continue;
      const d = delaiDeclaration(l.regime, l.etape, { qualifieeLe, notificationEnvoyeeLe: null });
      await surConnexion(c)
        .updateTable('incidents_declarations')
        .set((eb) => ({
          depart: d.depart,
          echeance: d.echeance,
          version: eb('version', '+', 1),
          maj_le: sql<Date>`now()`,
          maj_par: user.username,
        }))
        .where('id', '=', l.id)
        .execute();
      n++;
    }
    return n;
  }

  /* ------------------------------------------------------------------ Lecture */
  async vue(user: SessionUser, incidentId: string): Promise<VueDeclarationsIncident> {
    const { data } = await this.r.lire(user, 'incidents');
    const brut = trouverIncident(data, incidentId);
    await this.r.exigerPerimetre(user, brut, false, 'Incident absent.');
    const incident = lireIncident(brut)!;
    let peutPreparer = user.rights.can('incidents', 'modifier');
    if (peutPreparer)
      try {
        await this.r.g.access(perimetreDe(brut), user, true);
      } catch {
        peutPreparer = false;
      }
    const lignes = await this.lignes(this.db.pool, incidentId);
    return {
      incidentId,
      qualifieeLe: incident.qualifiedAt || null,
      peutDeclarer: await this.peutDeclarer(user),
      peutPreparer,
      peutExporter: user.rights.can('incidents', 'exporter'),
      declarations: lignes.map((l) => this.dto(l, incident, data, lignes)),
    };
  }

  /* ------------------------------------------------------------------ Gestes */
  /** Ouverture manuelle d'une déclaration non proposée (rôle RSSI) : à déclarer, délais comptés depuis la qualification. */
  ouvrir(incidentId: string, input: unknown, user: SessionUser, ip: string): Promise<DeclarationIncidentDto> {
    const body = OuvertureDeclaration.parse(input);
    return this.geste(user, incidentId, true, async ({ c, data, incident }) => {
      if ((await this.lignes(c, incidentId)).some((l) => l.regime === body.regime && l.etape === body.etape))
        throw new HttpError(409, 'Cette déclaration existe déjà pour cet incident : ajoutez un complément si besoin.');
      if (!incident.qualifiedAt && body.etape !== 'rapport_final')
        throw new HttpError(
          409,
          'La date de qualification de l’incident n’est pas connue : renseignez-la d’abord (elle fait partir les délais).',
        );
      const l = await this.inserer(c, incident, body.regime, body.etape, 'manuelle', 'a_declarer', null, user, user);
      await this.db.audit(user, ip, 'incident.declaration.ouverte', ref(incidentId), this.trace(l), c);
      return this.dto(l, incident, data, await this.lignes(c, incidentId));
    });
  }

  /** Complément d'une déclaration envoyée : nouvelle déclaration liée (rôle RSSI). */
  completer(incidentId: string, did: string, user: SessionUser, ip: string): Promise<DeclarationIncidentDto> {
    return this.geste(user, incidentId, true, async ({ c, data, incident }) => {
      const liee = await this.ligne(c, incidentId, did);
      if (liee.statut !== 'envoyee')
        throw new HttpError(409, 'Un complément ne se rattache qu’à une déclaration envoyée.');
      const l = await this.inserer(
        c,
        incident,
        liee.regime,
        'complement',
        'complement',
        'a_declarer',
        liee.id,
        user,
        user,
      );
      await this.db.audit(user, ip, 'incident.declaration.complement', ref(incidentId), this.trace(l), c);
      return this.dto(l, incident, data, await this.lignes(c, incidentId));
    });
  }

  /** Préparation du brouillon : rubriques (null : revenir à la valeur pré-remplie) et numéro de dossier pressenti. */
  preparer(
    incidentId: string,
    did: string,
    attendue: number,
    input: unknown,
    user: SessionUser,
    ip: string,
  ): Promise<DeclarationIncidentDto> {
    const body = PreparationDeclaration.parse(input);
    return this.geste(user, incidentId, false, async ({ c, data, incident }) => {
      const l = await this.verrouiller(c, incidentId, did, attendue);
      if (declarationFigee(l.statut))
        throw new HttpError(409, `Cette déclaration est ${libelleStatut(l.statut).toLowerCase()} : elle est figée.`);
      const connues = new Set(rubriquesDeclaration(l.regime, l.etape).map((x) => x.cle));
      const inconnues = Object.keys(body.rubriques ?? {}).filter((k) => !connues.has(k));
      if (inconnues.length)
        throw new HttpError(422, `Rubrique inconnue pour cette déclaration : ${inconnues.join(', ')}.`);
      const rubriques = textes(l.rubriques);
      for (const [k, v] of Object.entries(body.rubriques ?? {}))
        if (v === null) delete rubriques[k];
        else rubriques[k] = v;
      const suivante = await this.maj(c, l.id, user, {
        rubriques: JSON.stringify(rubriques),
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
      });
      await this.db.audit(
        user,
        ip,
        'incident.declaration.preparee',
        ref(incidentId),
        {
          ...this.trace(suivante),
          rubriques: Object.keys(body.rubriques ?? {}),
          ...(body.reference !== undefined ? { reference: body.reference } : {}),
        },
        c,
      );
      return this.dto(suivante, incident, data, await this.lignes(c, incidentId));
    });
  }

  confirmer(incidentId: string, did: string, attendue: number, user: SessionUser, ip: string) {
    return this.geste(user, incidentId, true, async ({ c, data, incident }) => {
      const l = await this.verrouiller(c, incidentId, did, attendue);
      if (l.statut !== 'proposee')
        throw new HttpError(409, `Seule une déclaration proposée se confirme (statut : ${libelleStatut(l.statut)}).`);
      const suivante = await this.maj(c, l.id, user, {
        statut: 'a_declarer',
        decide_par: nomDe(user),
        decide_le: sql<Date>`now()`,
      });
      await this.db.audit(user, ip, 'incident.declaration.confirmee', ref(incidentId), this.trace(suivante), c);
      return this.dto(suivante, incident, data, await this.lignes(c, incidentId));
    });
  }

  ecarter(incidentId: string, did: string, attendue: number, input: unknown, user: SessionUser, ip: string) {
    const body = MiseAlEcartDeclaration.parse(input);
    return this.geste(user, incidentId, true, async ({ c, data, incident }) => {
      const l = await this.verrouiller(c, incidentId, did, attendue);
      if (!declarationOuverte(l.statut))
        throw new HttpError(
          409,
          `Cette déclaration est déjà ${libelleStatut(l.statut).toLowerCase()} : elle est figée.`,
        );
      const suivante = await this.maj(c, l.id, user, {
        statut: 'non_requise',
        motif: body.motif,
        decide_par: nomDe(user),
        decide_le: sql<Date>`now()`,
      });
      await this.db.audit(
        user,
        ip,
        'incident.declaration.ecartee',
        ref(incidentId),
        { ...this.trace(suivante), motif: body.motif },
        c,
      );
      return this.dto(suivante, incident, data, await this.lignes(c, incidentId));
    });
  }

  /** « Marquer comme envoyée » : fige le texte transmis (rubriques au moment de l'envoi), la date, la personne et la référence ;
      l'envoi de la notification NIS 2 fixe l'échéance du rapport final. */
  envoyer(incidentId: string, did: string, attendue: number, input: unknown, user: SessionUser, ip: string) {
    const body = EnvoiDeclaration.parse(input);
    return this.geste(user, incidentId, true, async ({ c, data, incident }) => {
      const l = await this.verrouiller(c, incidentId, did, attendue);
      if (!declarationOuverte(l.statut))
        throw new HttpError(
          409,
          `Cette déclaration est déjà ${libelleStatut(l.statut).toLowerCase()} : elle est figée.`,
        );
      const toutes = await this.lignes(c, incidentId);
      const contenu = this.rubriques(l, incident, data, toutes).map(({ cle, libelle, source, valeur }) => ({
        cle,
        libelle,
        source,
        texte: valeur,
      }));
      const suivante = await this.maj(c, l.id, user, {
        statut: 'envoyee',
        reference: body.reference,
        contenu: JSON.stringify(contenu),
        envoyee_par: nomDe(user),
        envoyee_le: sql<Date>`now()`,
        ...(l.decide_le ? {} : { decide_par: nomDe(user), decide_le: sql<Date>`now()` }),
      });
      await this.db.audit(
        user,
        ip,
        'incident.declaration.envoyee',
        ref(incidentId),
        { ...this.trace(suivante), reference: body.reference, statutAvant: l.statut },
        c,
      );
      if (l.regime === 'nis2' && l.etape === 'notification' && suivante.envoyee_le)
        for (const rf of toutes.filter((x) => x.etape === 'rapport_final' && !declarationFigee(x.statut))) {
          const d = delaiDeclaration('nis2', 'rapport_final', {
            qualifieeLe: null,
            notificationEnvoyeeLe: suivante.envoyee_le.toISOString(),
          });
          await this.maj(c, rf.id, user, { depart: d.depart, echeance: d.echeance });
        }
      return this.dto(suivante, incident, data, await this.lignes(c, incidentId));
    });
  }

  /** Correction de la date de qualification (rôle RSSI) : ancienne et nouvelle valeur au journal, échéances non envoyées
      recalculées. Passe par l'écriture du registre (verrou, version de l'état, notification temps réel). */
  corrigerQualification(incidentId: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const { qualifieeLe } = CorrectionQualification.parse(input);
    let avant = '';
    let recalculees = 0;
    const apres = new Date(qualifieeLe).toISOString();
    if (Date.parse(apres) > Date.now() + 5 * 60_000)
      throw new HttpError(422, 'La date de qualification ne peut pas être dans le futur.');
    return this.r.modifier(
      user,
      ip,
      {
        module: 'incidents',
        action: 'incident.qualification.corrigee',
        reference: () => ref(incidentId),
        detail: () => ({ avant: avant || null, apres, recalculees }),
      },
      async (data, c) => {
        const brut = trouverIncident(data, incidentId);
        await this.r.exigerPerimetre(user, brut, true, 'Incident absent.');
        if (!(await this.peutDeclarer(user, c))) throw new HttpError(403, DECLARATION_RESERVEE);
        avant = str(brut.qualifiedAt);
        if (!avant && str(brut.kind) !== 'Incident de sécurité')
          throw new HttpError(409, 'Cet incident n’est pas qualifié « Incident de sécurité ».');
        const suivant = { ...brut, qualifiedAt: apres };
        remplacerEntree(data, 'incidents', incidentId, suivant);
        recalculees = await this.recalculer(c, incidentId, apres, user);
        return lireIncident(suivant)!;
      },
    );
  }

  /** Fiche de préparation (ou texte transmis, pour une déclaration envoyée) au format Word. */
  async exporter(incidentId: string, did: string, user: SessionUser, ip: string) {
    await this.r.g.permission(user, 'incidents', 'exporter');
    const { data } = await this.r.lire(user, 'incidents');
    const brut = trouverIncident(data, incidentId);
    await this.r.exigerPerimetre(user, brut, false, 'Incident absent.');
    const incident = lireIncident(brut)!;
    const toutes = await this.lignes(this.db.pool, incidentId);
    const l = toutes.find((x) => x.id === did);
    if (!l) throw new HttpError(404, ABSENTE);
    const d = this.dto(l, incident, data, toutes);
    await this.db.audit(user, ip, 'incident.declaration.export', ref(incidentId), this.trace(l));
    return { modele: modeleDeclaration(d, incident), nom: `declaration-${incidentId}-${l.regime}-${l.etape}` };
  }

  /* ------------------------------------------------------------------ Rappels (automate) */
  /** Rappels dus des déclarations ouvertes : un jalon à la fois par déclaration, une notification par personne et par jalon
      (index unique), diffusés selon les réglages de chacun (application, courriel). Appelé par l'automate de rappels quand
      le module incidents est actif, sans lien avec le module des écarts. Renvoie le nombre de notifications créées. */
  async rappels(maintenant = new Date()): Promise<number> {
    return this.db.tx(async (c) => {
      // Un seul passage à la fois sur l'installation (verrou consultatif transactionnel).
      const verrou = await c.query<{ ok: boolean }>(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 727287)) AS ok',
        ['incidents_declarations'],
      );
      if (!verrou.rows[0]?.ok) return 0;
      const ouvertes = await surConnexion(c)
        .selectFrom('incidents_declarations')
        .selectAll()
        .where('statut', 'in', ['proposee', 'a_declarer'])
        .execute();
      if (!ouvertes.length) return 0;
      const data = (await this.r.g.legacy.recompose(c))?.data ?? {};
      const incidents = new Map(
        entrees(data, 'incidents')
          .map(lireIncident)
          .filter((x): x is Incident => !!x)
          .map((i) => [i.id, i]),
      );
      return this.notifier(c, incidents, ouvertes, maintenant);
    }, 'Automate SMSI');
  }

  /** Notifications du jalon dû de chaque déclaration (doublons ignorés par l'index unique), puis diffusion. */
  private async notifier(
    c: Client,
    incidents: ReadonlyMap<string, Incident>,
    lignes: readonly Ligne[],
    maintenant: Date,
  ): Promise<number> {
    const emises: NotificationEmise[] = [];
    const destinatairesParIncident = new Map<string, string[]>();
    for (const l of lignes) {
      const incident = incidents.get(l.incident_id);
      if (!incident) continue;
      const jalon = jalonRappel(
        {
          id: l.id,
          regime: l.regime,
          etape: l.etape,
          statut: l.statut,
          origine: l.origine,
          depart: iso(l.depart),
          echeance: iso(l.echeance),
          creeLe: l.cree_le.toISOString(),
        },
        maintenant,
      );
      if (!jalon) continue;
      const smsi = incident.smsi || DEFAULT_SMSI;
      const cle = `${incident.id}|${smsi}`;
      if (!destinatairesParIncident.has(cle))
        destinatairesParIncident.set(cle, await this.destinataires(c, incident, smsi));
      for (const uid of destinatairesParIncident.get(cle)!) {
        const r = await surConnexion(c)
          .insertInto('grc_notifications')
          .values({
            smsi_id: null,
            object_id: null,
            user_id: uid,
            kind: KIND,
            due_key: jalon.cle,
            title: titreRappelDeclaration(incident.id, jalon.libelle),
            message: messageRappelDeclaration(l.regime, l.etape, iso(l.echeance)),
          })
          .onConflict((oc) => oc.doNothing())
          .returning(sql<string>`id::text`.as('id'))
          .executeTakeFirst();
        if (r) emises.push({ id: r.id, userId: uid, kind: KIND });
      }
    }
    if (emises.length) await this.r.g.notificationsMetier?.diffuser(c, emises);
    return emises.length;
  }

  /** Destinataires : comptes actifs au rôle « RSSI » qui voient le périmètre de l'incident, et le responsable de l'incident
      s'il correspond à un seul compte actif (identifiant ou nom affiché) qui lit les incidents et voit le périmètre. */
  private async destinataires(c: Client, incident: Incident, smsi: string): Promise<string[]> {
    const k = surConnexion(c);
    const rssi = await k
      .selectFrom('users as u')
      .select(sql<string>`u.id::text`.as('id'))
      .where(COMPTE_ACTIF)
      .where(porteLeRole(sql`${ROLE_DECLARATION_INCIDENT}`))
      .where(sql<boolean>`grc_smsi_visible(${smsi}::uuid, u.id)`)
      .execute();
    const ids = new Set<string>();
    for (const u of rssi) if (await this.peutDeclarer({ id: u.id }, c)) ids.add(u.id);
    const responsable = incident.owner.trim().toLowerCase();
    if (responsable) {
      const comptes = await k
        .selectFrom('users as u')
        .select(sql<string>`u.id::text`.as('id'))
        .where(COMPTE_ACTIF)
        .where((eb) =>
          eb.or([
            eb(sql`lower(u.username)`, '=', responsable),
            eb(sql`lower(btrim(u.display_name))`, '=', responsable),
          ]),
        )
        .where(sql<boolean>`grc_smsi_visible(${smsi}::uuid, u.id)`)
        .execute();
      if (comptes.length === 1) {
        const id = comptes[0]!.id;
        if (new Rights(effectivePermissions(await loadGrants(c, id)).keys()).can('incidents', 'lire')) ids.add(id);
      }
    }
    return [...ids];
  }

  /* ------------------------------------------------------------------ Outils */
  private async geste<T>(
    user: SessionUser,
    incidentId: string,
    rssi: boolean,
    fn: (x: ContexteIncident) => Promise<T>,
  ): Promise<T> {
    await this.r.g.permission(user, 'incidents', 'modifier');
    return this.db.tx(async (c) => {
      await verrouillerEtat(c);
      const etat = await this.r.g.legacy.recompose(c);
      const data: JsonObject = etat?.data ?? {};
      const brut = trouverIncident(data, incidentId);
      // Périmètre d'abord : un incident d'un périmètre fermé répond 404, même au RSSI.
      await this.r.exigerPerimetre(user, brut, true, 'Incident absent.');
      if (rssi && !(await this.peutDeclarer(user, c))) throw new HttpError(403, DECLARATION_RESERVEE);
      const resultat = await fn({ c, data, brut, incident: lireIncident(brut)! });
      await this.r.g.notify(c, ref(incidentId), etat?.version ?? 0, DEFAULT_SMSI, 'incidents', user.username);
      return resultat;
    }, user.username);
  }

  private lignes(c: Pick<Client, 'query'>, incidentId: string): Promise<Ligne[]> {
    return surConnexion(c)
      .selectFrom('incidents_declarations')
      .selectAll()
      .where('incident_id', '=', incidentId)
      .orderBy('cree_le')
      .orderBy('id')
      .execute();
  }
  private async ligne(c: Client, incidentId: string, did: string): Promise<Ligne> {
    if (!/^[0-9a-f-]{36}$/i.test(did)) throw new HttpError(404, ABSENTE);
    const l = await surConnexion(c)
      .selectFrom('incidents_declarations')
      .selectAll()
      .where('id', '=', did)
      .where('incident_id', '=', incidentId)
      .executeTakeFirst();
    if (!l) throw new HttpError(404, ABSENTE);
    return l;
  }
  /** Déclaration verrouillée pour un geste, à la version attendue (412 sinon). */
  private async verrouiller(c: Client, incidentId: string, did: string, attendue: number): Promise<Ligne> {
    await this.ligne(c, incidentId, did);
    const l = await surConnexion(c)
      .selectFrom('incidents_declarations')
      .selectAll()
      .where('id', '=', did)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (l.version !== attendue) throw conflict({ version: l.version, updated_by: l.maj_par });
    return l;
  }
  private maj(c: Client, id: string, user: SessionUser, valeurs: Record<string, unknown>): Promise<Ligne> {
    return surConnexion(c)
      .updateTable('incidents_declarations')
      .set((eb) => ({
        ...(valeurs as object),
        version: eb('version', '+', 1),
        maj_le: sql<Date>`now()`,
        maj_par: user.username,
      }))
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
  private async inserer(
    c: Client,
    incident: Incident,
    regime: RegimeDeclaration,
    etape: EtapeDeclaration,
    origine: OrigineDeclaration,
    statut: StatutDeclaration,
    lieeA: string | null,
    user: SessionUser,
    decideur: SessionUser | null,
  ): Promise<Ligne> {
    const notification = (await this.lignes(c, incident.id)).find(
      (l) => l.regime === 'nis2' && l.etape === 'notification' && l.statut === 'envoyee',
    );
    const d = delaiDeclaration(regime, etape, {
      qualifieeLe: incident.qualifiedAt || null,
      notificationEnvoyeeLe: iso(notification?.envoyee_le ?? null),
    });
    return surConnexion(c)
      .insertInto('incidents_declarations')
      .values({
        incident_id: incident.id,
        smsi_id: incident.smsi || DEFAULT_SMSI,
        regime,
        etape,
        liee_a: lieeA,
        origine,
        statut,
        depart: d.depart,
        echeance: d.echeance,
        cree_par: user.username,
        maj_par: user.username,
        ...(decideur ? { decide_par: nomDe(decideur), decide_le: sql<Date>`now()` } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private rubriques(l: Ligne, incident: Incident, data: JsonObject, toutes: readonly Ligne[]): RubriqueRemplie[] {
    if (l.statut === 'envoyee' && Array.isArray(l.contenu))
      return (l.contenu as unknown[]).filter(isObject).map((x) => ({
        cle: str(x.cle),
        libelle: str(x.libelle),
        source: str(x.source),
        aide: '',
        valeur: str(x.texte),
        modifiee: true,
      }));
    const liee = l.liee_a ? toutes.find((x) => x.id === l.liee_a) : null;
    const prerempli = preremplissage(l.regime, l.etape, {
      incident,
      identite: this.identite(),
      categorieEntite: str(data.entityCategory),
      liee: liee ? { etape: liee.etape, envoyeeLe: iso(liee.envoyee_le), reference: liee.reference } : null,
    });
    return rubriquesRemplies(l.regime, l.etape, textes(l.rubriques), prerempli);
  }

  private dto(l: Ligne, incident: Incident, data: JsonObject, toutes: readonly Ligne[]): DeclarationIncidentDto {
    return {
      id: l.id,
      incidentId: l.incident_id,
      regime: l.regime,
      etape: l.etape,
      statut: l.statut,
      origine: l.origine,
      lieeA: l.liee_a,
      depart: iso(l.depart),
      echeance: iso(l.echeance),
      rubriques: this.rubriques(l, incident, data, toutes),
      reference: l.reference,
      motif: l.motif,
      decision: l.decide_par && l.decide_le ? { par: l.decide_par, le: l.decide_le.toISOString() } : null,
      envoi:
        l.statut === 'envoyee' && l.envoyee_par && l.envoyee_le
          ? { par: l.envoyee_par, le: l.envoyee_le.toISOString(), reference: l.reference }
          : null,
      creeLe: l.cree_le.toISOString(),
      creePar: l.cree_par,
      version: l.version,
    };
  }

  /** Éléments du journal d'audit d'une déclaration : jamais le texte des rubriques. */
  private trace(l: Ligne): JsonObject {
    return {
      declaration: l.id,
      regime: l.regime,
      etape: l.etape,
      statut: l.statut,
      version: l.version,
      echeance: iso(l.echeance),
    };
  }
}

const ref = (incidentId: string) => `legacy:incidents:${incidentId}`;
const libelleStatut = (s: StatutDeclaration) => STATUT_DECLARATION_LIBELLES[s];

function trouverIncident(data: JsonObject, id: string): JsonObject {
  const t = entrees(data, 'incidents').filter((x) => x.id === id);
  if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
  if (!t[0]) throw new HttpError(404, 'Incident absent.');
  return t[0];
}

/** Document Word d'une déclaration : en-tête (régime, étape, statut, échéance ou envoi), puis une section par rubrique avec
    sa source. Une rubrique vide est signalée « À renseigner ». */
export function modeleDeclaration(d: DeclarationIncidentDto, incident: Pick<Incident, 'id' | 'title'>): ModeleDocument {
  const entete = [
    `Incident : ${incident.id}${incident.title ? ` — ${incident.title}` : ''}`,
    `Statut : ${STATUT_DECLARATION_LIBELLES[d.statut]}`,
    d.echeance ? `Échéance : ${dateHeureParis(d.echeance)}` : d.regime === 'sante' ? 'Délai : sans délai' : '',
    d.envoi ? `Envoyée le ${dateHeureParis(d.envoi.le)} par ${d.envoi.par}, référence ${d.envoi.reference}` : '',
    d.motif ? `Écartée (non requise) : ${d.motif}` : '',
    !d.envoi && d.reference ? `Numéro de dossier pressenti : ${d.reference}` : '',
    d.envoi ? 'Texte transmis, figé à l’envoi.' : 'Fiche de préparation : à confirmer contre le formulaire du portail.',
  ].filter(Boolean);
  return {
    titre: `Déclaration ${REGIME_DECLARATION_LIBELLES[d.regime]} : ${ETAPE_DECLARATION_LIBELLES[d.etape].toLowerCase()}`,
    sousTitre: `Incident ${incident.id}`,
    sections: [
      { titre: 'Déclaration', paragraphes: entete },
      ...d.rubriques.map((x) => ({
        titre: x.libelle,
        paragraphes: [
          ...(x.valeur.trim()
            ? x.valeur
                .split(/\r?\n/)
                .map((p) => p.trim())
                .filter(Boolean)
            : ['À renseigner']),
          `Source : ${x.source}`,
        ],
      })),
    ],
  };
}
