/* Déclaration réglementaire des incidents (ADR 0105, décisions du RSSI du 18/11/2026) : régimes suivis (santé et NIS 2),
   étapes, statuts, délais, propositions à la qualification, rubriques de la fiche de préparation avec leur source,
   pré-remplissage depuis la fiche de l'incident et jalons des rappels. Tout ce fichier est pur : le serveur, l'interface et
   les tests partagent les mêmes règles.

   - Départ des délais : la qualification horodatée (premier passage à « Incident de sécurité », corrigeable par le RSSI).
   - Santé (CERT Santé / ARS, article L. 1111-8-2 du code de la santé publique) : « sans délai », aucune échéance chiffrée,
     rappels toutes les 4 heures tant que le signalement n'est ni envoyé ni écarté.
   - NIS 2 (ANSSI, article 23 de la directive) : alerte précoce sous 24 heures, notification sous 72 heures, rapport final
     un mois calendaire après l'envoi de la notification ; rappels à mi-délai, 2 heures avant l'échéance et au dépassement.
   - Les rubriques sont à confirmer par le RSSI contre les formulaires réels des portails avant la première utilisation. */
import { z } from 'zod';
import type { SystemRole } from './permissions.js';
import { prioriteIncident, type Incident, type Reponses } from './suivi-incidents.js';

export const REGIMES_DECLARATION = ['sante', 'nis2'] as const;
export type RegimeDeclaration = (typeof REGIMES_DECLARATION)[number];
export const REGIME_DECLARATION_LIBELLES: Record<RegimeDeclaration, string> = {
  sante: 'Santé (CERT Santé, ARS)',
  nis2: 'NIS 2 (ANSSI)',
};

export const ETAPES_DECLARATION = [
  'signalement',
  'alerte_precoce',
  'notification',
  'rapport_final',
  'complement',
] as const;
export type EtapeDeclaration = (typeof ETAPES_DECLARATION)[number];
export const ETAPE_DECLARATION_LIBELLES: Record<EtapeDeclaration, string> = {
  signalement: 'Signalement',
  alerte_precoce: 'Alerte précoce',
  notification: 'Notification',
  rapport_final: 'Rapport final',
  complement: 'Complément',
};
/** Étapes propres à chaque régime (le complément, lié à une déclaration envoyée, vaut pour les deux). */
export const ETAPES_PAR_REGIME: Record<RegimeDeclaration, readonly Exclude<EtapeDeclaration, 'complement'>[]> = {
  sante: ['signalement'],
  nis2: ['alerte_precoce', 'notification', 'rapport_final'],
};

export const STATUTS_DECLARATION = ['proposee', 'a_declarer', 'non_requise', 'envoyee'] as const;
export type StatutDeclaration = (typeof STATUTS_DECLARATION)[number];
export const STATUT_DECLARATION_LIBELLES: Record<StatutDeclaration, string> = {
  proposee: 'Proposée',
  a_declarer: 'À déclarer',
  non_requise: 'Non requise',
  envoyee: 'Envoyée',
};
/** Une déclaration envoyée ou écartée est figée : ni modifiable ni supprimable (déclencheur en base, migration 087). */
export const STATUTS_FIGES: readonly StatutDeclaration[] = ['non_requise', 'envoyee'];
export const declarationFigee = (s: StatutDeclaration) => STATUTS_FIGES.includes(s);
export const declarationOuverte = (s: StatutDeclaration) => s === 'proposee' || s === 'a_declarer';

export const ORIGINES_DECLARATION = ['proposition', 'manuelle', 'complement'] as const;
export type OrigineDeclaration = (typeof ORIGINES_DECLARATION)[number];

/** Confirmer « à déclarer », écarter « non requise », marquer « envoyée », ouvrir une déclaration ou un complément et corriger
    la date de qualification sont réservés au rôle prédéfini « RSSI » (direct ou par un groupe), sans délégation : ni
    incidents:modifier, ni le rôle Administrateur ne s'y substituent (décision 6, comme la prise en compte des alertes du
    module Vulnérabilités). */
export const ROLE_DECLARATION_INCIDENT: SystemRole = 'rssi';
export const DECLARATION_RESERVEE = 'Seul le RSSI peut faire ce geste sur une déclaration réglementaire.';
/** Qualification qui fait partir les délais. */
export const QUALIFICATION_DECLARABLE = 'Incident de sécurité';

/* ------------------------------------------------------------------ Délais */
export const DELAI_ALERTE_PRECOCE_HEURES = 24;
export const DELAI_NOTIFICATION_HEURES = 72;
export const RELANCE_SANTE_HEURES = 4;
export const PREAVIS_ECHEANCE_HEURES = 2;
const HEURE = 3_600_000;

const instant = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};
const iso = (t: number) => new Date(t).toISOString();

/** Un mois calendaire plus tard (calendrier UTC) ; le jour est ramené au dernier jour du mois s'il n'existe pas (31 janvier →
    28 ou 29 février). */
export function plusUnMois(depart: string): string {
  const d = new Date(depart);
  const annee = d.getUTCFullYear() + (d.getUTCMonth() === 11 ? 1 : 0);
  const mois = (d.getUTCMonth() + 1) % 12;
  const dernier = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  return iso(
    Date.UTC(
      annee,
      mois,
      Math.min(d.getUTCDate(), dernier),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  );
}

export interface ReperesDelai {
  /** Date et heure de qualification de l'incident (ISO), null si elle n'est pas connue. */
  qualifieeLe: string | null;
  /** Envoi de la notification NIS 2 de l'incident (ISO), null tant qu'elle n'est pas envoyée. */
  notificationEnvoyeeLe: string | null;
}
/** Départ du délai et échéance d'une déclaration (ISO), calculés par le serveur ; null quand il n'y en a pas. */
export function delaiDeclaration(
  regime: RegimeDeclaration,
  etape: EtapeDeclaration,
  r: ReperesDelai,
): { depart: string | null; echeance: string | null } {
  const q = instant(r.qualifieeLe);
  if (etape === 'complement') return { depart: null, echeance: null };
  if (etape === 'rapport_final') {
    const n = instant(r.notificationEnvoyeeLe);
    return n === null ? { depart: null, echeance: null } : { depart: iso(n), echeance: plusUnMois(iso(n)) };
  }
  if (q === null) return { depart: null, echeance: null };
  if (regime === 'sante') return { depart: iso(q), echeance: null };
  const heures = etape === 'alerte_precoce' ? DELAI_ALERTE_PRECOCE_HEURES : DELAI_NOTIFICATION_HEURES;
  return { depart: iso(q), echeance: iso(q + heures * HEURE) };
}

/* ------------------------------------------------------------------ Propositions à la qualification */
/** Déclarations proposées au premier passage à « Incident de sécurité » (décision 8) : santé si la qualification guidée
    indique des données de santé ou une activité HDS touchées (« oui » ou « je ne sais pas ») ; NIS 2 (trois étapes) si
    l'établissement est entité essentielle ou importante. */
export function declarationsProposees(
  answers: Reponses,
  categorieEntite: string,
): { regime: RegimeDeclaration; etape: EtapeDeclaration }[] {
  const l: { regime: RegimeDeclaration; etape: EtapeDeclaration }[] = [];
  if (answers.sante === 'oui' || answers.sante === 'nsp') l.push({ regime: 'sante', etape: 'signalement' });
  if (categorieEntite === 'essentielle' || categorieEntite === 'importante')
    for (const etape of ETAPES_PAR_REGIME.nis2) l.push({ regime: 'nis2', etape });
  return l;
}

/* ------------------------------------------------------------------ Rubriques */
export interface RubriqueDeclaration {
  cle: string;
  libelle: string;
  /** Texte qui fonde la rubrique. */
  source: string;
  aide: string;
}
const SOURCE_IDENTITE =
  'Identification du déclarant demandée par le formulaire du portail (à confirmer) ; rubrique « Identité de l’établissement » de la Configuration';
const SOURCE_SANTE =
  'Article L. 1111-8-2 du code de la santé publique ; liste retenue par l’ADR 0105, à confirmer contre le formulaire du portail de signalement';
const NIS2 = 'Directive (UE) 2022/2555 (NIS 2), article 23, paragraphe 4';
const r = (cle: string, libelle: string, source: string, aide: string): RubriqueDeclaration => ({
  cle,
  libelle,
  source,
  aide,
});
const IDENTITE = r(
  'identite',
  'Identité de l’établissement',
  SOURCE_IDENTITE,
  'Raison sociale, identifiants, autorité de rattachement et contact de signalement.',
);
const RUBRIQUES: Record<RegimeDeclaration, Record<EtapeDeclaration, readonly RubriqueDeclaration[]>> = {
  sante: {
    signalement: [
      IDENTITE,
      r('description', 'Description de l’incident', SOURCE_SANTE, 'Ce qui s’est passé, systèmes touchés.'),
      r('date_detection', 'Date de détection', SOURCE_SANTE, 'Date et heure de détection de l’incident.'),
      r(
        'consequences_patients',
        'Conséquences sur la prise en charge des patients',
        SOURCE_SANTE,
        'Effets constatés ou possibles sur les soins et la continuité de la prise en charge.',
      ),
      r('mesures', 'Mesures prises', SOURCE_SANTE, 'Mesures de confinement, de correction et de communication.'),
    ],
    alerte_precoce: [],
    notification: [],
    rapport_final: [],
    complement: [
      IDENTITE,
      r('declaration_completee', 'Signalement complété', SOURCE_SANTE, 'Signalement initial et sa référence.'),
      r('complement', 'Informations complémentaires', SOURCE_SANTE, 'Ce qui a changé ou ce qui est désormais connu.'),
    ],
  },
  nis2: {
    signalement: [],
    alerte_precoce: [
      IDENTITE,
      r(
        'malveillance',
        'Caractère illicite ou malveillant soupçonné',
        `${NIS2}, point a)`,
        'Indiquer si l’on soupçonne que l’incident a été causé par des actes illicites ou malveillants.',
      ),
      r(
        'transfrontiere',
        'Effet transfrontière possible',
        `${NIS2}, point a)`,
        'Indiquer si l’incident pourrait avoir un impact transfrontière.',
      ),
    ],
    notification: [
      IDENTITE,
      r('evaluation_initiale', 'Évaluation initiale', `${NIS2}, point b)`, 'Première évaluation de l’incident.'),
      r('gravite', 'Gravité', `${NIS2}, point b)`, 'Gravité de l’incident.'),
      r('impact', 'Impact', `${NIS2}, point b)`, 'Impact sur les services et les utilisateurs.'),
      r(
        'indicateurs',
        'Indicateurs de compromission',
        `${NIS2}, point b)`,
        'Indicateurs de compromission, lorsqu’ils sont disponibles.',
      ),
    ],
    rapport_final: [
      IDENTITE,
      r(
        'description_detaillee',
        'Description détaillée de l’incident',
        `${NIS2}, point d) i)`,
        'Description détaillée, y compris la gravité et l’impact.',
      ),
      r(
        'cause',
        'Type de menace ou cause profonde',
        `${NIS2}, point d) ii)`,
        'Type de menace ou cause profonde qui a probablement déclenché l’incident.',
      ),
      r('mesures', 'Mesures d’atténuation', `${NIS2}, point d) iii)`, 'Mesures d’atténuation appliquées et en cours.'),
      r('transfrontiere', 'Effet transfrontière', `${NIS2}, point d) iv)`, 'Le cas échéant, l’impact transfrontière.'),
    ],
    complement: [
      IDENTITE,
      r('declaration_completee', 'Déclaration complétée', `${NIS2}, point c)`, 'Déclaration initiale et sa référence.'),
      r(
        'complement',
        'Informations complémentaires',
        `${NIS2}, point c)`,
        'Mise à jour de la situation (rapport intermédiaire demandé par l’autorité, par exemple).',
      ),
    ],
  },
};
export const rubriquesDeclaration = (regime: RegimeDeclaration, etape: EtapeDeclaration) => RUBRIQUES[regime][etape];

/* ------------------------------------------------------------------ Identité de l'établissement (Configuration) */
const txt = (max: number) => z.string().trim().max(max);
/** FINESS : neuf caractères, département sur deux caractères (2A et 2B pour la Corse) ; vide tant qu'il n'est pas saisi. */
const finess = z.union([
  z.literal(''),
  z.string().regex(/^(?:\d{2}|2A|2B)\d{7}$/, 'Numéro FINESS invalide (9 caractères).'),
]);
export const IdentiteEtablissement = z.object({
  raisonSociale: txt(200),
  finessJuridique: finess,
  finessGeographique: finess,
  arsRattachement: txt(120),
  contactNom: txt(120),
  contactFonction: txt(120),
  contactTelephone: txt(40),
  contactCourriel: z.union([z.literal(''), z.email('Adresse e-mail invalide.').max(200)]),
  /** Secteur d'activité au sens des annexes I et II de la directive NIS 2 (texte libre). */
  secteurNis2: txt(200),
});
export type IdentiteEtablissement = z.infer<typeof IdentiteEtablissement>;
export const IDENTITE_ETABLISSEMENT_VIDE: IdentiteEtablissement = {
  raisonSociale: '',
  finessJuridique: '',
  finessGeographique: '',
  arsRattachement: '',
  contactNom: '',
  contactFonction: '',
  contactTelephone: '',
  contactCourriel: '',
  secteurNis2: '',
};

/* ------------------------------------------------------------------ Pré-remplissage */
const CATEGORIES_ENTITE: Record<string, string> = {
  essentielle: 'entité essentielle',
  importante: 'entité importante',
  hors_champ: 'hors du champ',
};
/** « AAAA-MM-JJThh:mm » (horodatage de la fiche, sans fuseau) → « JJ/MM/AAAA hh:mm ». */
const dateFiche = (t: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(0, 10).split('-').reverse().join('/')} ${t.slice(11, 16)}`.trim() : t;
const lignes = (l: readonly (string | false | null | undefined)[]) => l.filter(Boolean).join('\n');

export interface ContextePreremplissage {
  incident: Pick<
    Incident,
    'id' | 'title' | 'desc' | 'detectedAt' | 'actions' | 'cause' | 'impact' | 'urgency' | 'timeline'
  >;
  identite: IdentiteEtablissement;
  categorieEntite: string;
  /** Déclaration complétée (complément) : étape, date d'envoi (ISO) et référence. */
  liee?: { etape: EtapeDeclaration; envoyeeLe: string | null; reference: string } | null;
}
/** Valeurs proposées pour chaque rubrique, tirées de la fiche de l'incident, de sa chronologie et de l'identité de
    l'établissement. Rien n'est inventé : une rubrique sans source reste vide. */
export function preremplissage(
  regime: RegimeDeclaration,
  etape: EtapeDeclaration,
  ctx: ContextePreremplissage,
): Record<string, string> {
  const { incident: i, identite: e } = ctx;
  const contact = [e.contactNom, e.contactFonction].filter(Boolean).join(', ');
  const identite = lignes([
    e.raisonSociale && `Raison sociale : ${e.raisonSociale}`,
    e.finessJuridique && `FINESS juridique : ${e.finessJuridique}`,
    e.finessGeographique && `FINESS géographique : ${e.finessGeographique}`,
    regime === 'sante' && e.arsRattachement && `ARS de rattachement : ${e.arsRattachement}`,
    regime === 'nis2' && e.secteurNis2 && `Secteur d’activité (NIS 2) : ${e.secteurNis2}`,
    regime === 'nis2' &&
      CATEGORIES_ENTITE[ctx.categorieEntite] &&
      `Catégorie (NIS 2) : ${CATEGORIES_ENTITE[ctx.categorieEntite]}`,
    contact && `Contact de signalement : ${contact}`,
    e.contactTelephone && `Téléphone : ${e.contactTelephone}`,
    e.contactCourriel && `Courriel : ${e.contactCourriel}`,
  ]);
  const description = lignes([i.title, i.desc]);
  const chronologie = i.timeline.length
    ? lignes([
        'Chronologie :',
        ...i.timeline.map((ev) =>
          lignes([`${dateFiche(ev.ts)} — ${ev.titre}${ev.description ? ` : ${ev.description}` : ''}`]),
        ),
      ])
    : '';
  const priorite = prioriteIncident(i.impact, i.urgency);
  const gravite = lignes([
    priorite && `Priorité : ${priorite}`,
    i.impact && `Impact : ${i.impact}`,
    i.urgency && `Urgence : ${i.urgency}`,
  ]);
  const liee = ctx.liee
    ? lignes([
        `${ETAPE_DECLARATION_LIBELLES[ctx.liee.etape]} de l’incident ${i.id}`,
        ctx.liee.envoyeeLe && `Envoyée le ${dateHeureParis(ctx.liee.envoyeeLe)}`,
        ctx.liee.reference && `Référence : ${ctx.liee.reference}`,
      ])
    : '';
  const valeurs: Record<string, string> = {
    identite,
    description,
    date_detection: dateFiche(i.detectedAt),
    consequences_patients: '',
    mesures: i.actions,
    malveillance: '',
    transfrontiere: '',
    evaluation_initiale: description,
    gravite,
    impact: '',
    indicateurs: '',
    description_detaillee: [description, gravite, chronologie].filter(Boolean).join('\n\n'),
    cause: i.cause,
    declaration_completee: liee,
    complement: '',
  };
  return Object.fromEntries(rubriquesDeclaration(regime, etape).map((x) => [x.cle, valeurs[x.cle] ?? '']));
}

export interface RubriqueRemplie extends RubriqueDeclaration {
  valeur: string;
  /** Vrai quand la valeur a été saisie (sinon elle suit la fiche de l'incident). */
  modifiee: boolean;
}
/** Rubriques d'une déclaration non figée : la saisie l'emporte, sinon la valeur pré-remplie. */
export function rubriquesRemplies(
  regime: RegimeDeclaration,
  etape: EtapeDeclaration,
  saisies: Readonly<Record<string, string>>,
  prerempli: Readonly<Record<string, string>>,
): RubriqueRemplie[] {
  return rubriquesDeclaration(regime, etape).map((x) => {
    const modifiee = Object.prototype.hasOwnProperty.call(saisies, x.cle);
    return { ...x, valeur: modifiee ? saisies[x.cle]! : (prerempli[x.cle] ?? ''), modifiee };
  });
}

/* ------------------------------------------------------------------ Affichage des délais */
/** « 18/11/2026 à 10:15 » à l'heure de Paris. */
export function dateHeureParis(v: string): string {
  const t = instant(v);
  if (t === null) return v;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} à ${p.hour}:${p.minute}`;
}
/** Durée lisible : « 2 j 4 h » au-delà de 48 heures, sinon « 5 h 07 » ou « 12 min ». */
export function dureeLisible(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(min / 60);
  if (h >= 48) return `${Math.floor(h / 24)} j ${h % 24} h`;
  if (h === 0) return `${min} min`;
  return `${h} h ${String(min % 60).padStart(2, '0')}`;
}
export type EtatEcheance = 'sans_delai' | 'sans_echeance' | 'a_venir' | 'proche' | 'depassee';
export interface CompteARebours {
  etat: EtatEcheance;
  libelle: string;
}
/** Compte à rebours d'une déclaration encore ouverte ; null pour une déclaration figée (envoyée ou écartée). */
export function compteARebours(
  d: { regime: RegimeDeclaration; etape: EtapeDeclaration; statut: StatutDeclaration; echeance: string | null },
  maintenant: Date,
): CompteARebours | null {
  if (!declarationOuverte(d.statut)) return null;
  if (d.regime === 'sante' && d.etape === 'signalement')
    return { etat: 'sans_delai', libelle: 'Sans délai : à signaler dès que possible' };
  const e = instant(d.echeance);
  if (e === null)
    return {
      etat: 'sans_echeance',
      libelle:
        d.etape === 'rapport_final'
          ? 'Échéance fixée à l’envoi de la notification'
          : d.etape === 'complement'
            ? 'Sans échéance'
            : 'Date de qualification à renseigner',
    };
  const reste = e - maintenant.getTime();
  if (reste <= 0) return { etat: 'depassee', libelle: `Échéance dépassée de ${dureeLisible(-reste)}` };
  return {
    etat: reste <= PREAVIS_ECHEANCE_HEURES * HEURE ? 'proche' : 'a_venir',
    libelle: `Reste ${dureeLisible(reste)} (échéance le ${dateHeureParis(iso(e))})`,
  };
}

/* ------------------------------------------------------------------ Rappels (décision 5) */
export interface JalonRappel {
  /** Clé du rappel (identifiant de la déclaration, jalon et départ du délai) : une seule notification par personne et par clé. */
  cle: string;
  libelle: string;
  instant: string;
}
/** Jalon de rappel le plus récent déjà atteint, ou null. Un seul jalon à la fois : après une interruption de l'automate, les
    rappels manqués ne sont pas tous envoyés d'un coup. Le rappel « à examiner » d'une déclaration proposée part à sa
    création (la qualification) ; la clé des autres porte le départ du délai, pour qu'une correction de la date de
    qualification réarme les rappels. */
export function jalonRappel(
  d: {
    id: string;
    regime: RegimeDeclaration;
    etape: EtapeDeclaration;
    statut: StatutDeclaration;
    origine: OrigineDeclaration;
    depart: string | null;
    echeance: string | null;
    creeLe: string;
  },
  maintenant: Date,
): JalonRappel | null {
  if (!declarationOuverte(d.statut) || d.etape === 'complement') return null;
  const now = maintenant.getTime();
  const candidats: JalonRappel[] = [];
  const depart = instant(d.depart);
  if (depart !== null) {
    const jalon = (code: string, libelle: string, t: number): JalonRappel => ({
      cle: `${d.id}:${code}:${Math.floor(depart / 1000)}`,
      libelle,
      instant: iso(t),
    });
    const e = instant(d.echeance);
    if (d.regime === 'sante') {
      const k = Math.floor((now - depart) / (RELANCE_SANTE_HEURES * HEURE));
      if (k >= 1)
        candidats.push(jalon(`relance-${k}`, 'à signaler sans délai', depart + k * RELANCE_SANTE_HEURES * HEURE));
    } else if (e !== null)
      candidats.push(
        jalon('mi-delai', 'mi-délai atteint', depart + (e - depart) / 2),
        jalon('preavis', `échéance dans ${PREAVIS_ECHEANCE_HEURES} heures`, e - PREAVIS_ECHEANCE_HEURES * HEURE),
        jalon('depassement', 'échéance dépassée', e),
      );
  }
  const du = candidats
    .filter((c) => Date.parse(c.instant) <= now)
    .sort((a, b) => Date.parse(a.instant) - Date.parse(b.instant))
    .at(-1);
  if (du) return du;
  // Sans jalon de délai atteint : le rappel « à examiner » d'une déclaration proposée (une fois).
  const cree = instant(d.creeLe);
  return d.origine === 'proposition' && cree !== null && cree <= now
    ? { cle: `${d.id}:qualification`, libelle: 'déclaration à examiner', instant: iso(cree) }
    : null;
}
/** Titre de la notification (repris dans le courriel) : l'identifiant de l'incident et le jalon, sans régime ni contenu. */
export const titreRappelDeclaration = (incidentId: string, jalon: string) =>
  `Déclaration réglementaire de l’incident ${incidentId} : ${jalon}`.slice(0, 180);
/** Message (dans l'application seulement) : régime, étape et échéance. */
export function messageRappelDeclaration(
  regime: RegimeDeclaration,
  etape: EtapeDeclaration,
  echeance: string | null,
): string {
  const quoi = `${REGIME_DECLARATION_LIBELLES[regime]}, ${ETAPE_DECLARATION_LIBELLES[etape].toLowerCase()}`;
  return `${quoi} : ${
    regime === 'sante'
      ? 'sans délai, à signaler dès que possible'
      : echeance
        ? `échéance le ${dateHeureParis(echeance)}`
        : 'à préparer'
  }. Ouvrez la fiche de l’incident, bloc « Déclarations ».`;
}
/** Fiche de l'incident (lien d'une notification). */
export const lienDeclarationIncident = (smsi: string, incidentId: string) =>
  `/pilotage/incidents-registre?perimetre=${encodeURIComponent(smsi)}&incident=${encodeURIComponent(incidentId)}`;

/* ------------------------------------------------------------------ Échanges avec l'API */
export const OuvertureDeclaration = z
  .object({
    regime: z.enum(REGIMES_DECLARATION),
    etape: z.enum(['signalement', 'alerte_precoce', 'notification', 'rapport_final']),
  })
  .strict()
  .refine((b) => (ETAPES_PAR_REGIME[b.regime] as readonly string[]).includes(b.etape), {
    message: 'Étape sans objet pour ce régime.',
    path: ['etape'],
  });
export type OuvertureDeclaration = z.output<typeof OuvertureDeclaration>;
/** Préparation : rubriques saisies (null : revenir à la valeur pré-remplie) et numéro de dossier pressenti. */
export const PreparationDeclaration = z
  .object({
    rubriques: z.record(z.string().regex(/^[a-z_]{1,40}$/), z.string().max(20000).nullable()).optional(),
    reference: z.string().trim().max(200).optional(),
  })
  .strict();
export type PreparationDeclaration = z.output<typeof PreparationDeclaration>;
export const MiseAlEcartDeclaration = z
  .object({ motif: z.string().trim().min(1, 'Motif obligatoire.').max(2000) })
  .strict();
export const EnvoiDeclaration = z
  .object({
    reference: z.string().trim().min(1, 'Numéro de dossier ou d’accusé de réception obligatoire.').max(200),
  })
  .strict();
export const CorrectionQualification = z.object({ qualifieeLe: z.iso.datetime({ offset: true }) }).strict();

export interface DeclarationIncidentDto {
  id: string;
  incidentId: string;
  regime: RegimeDeclaration;
  etape: EtapeDeclaration;
  statut: StatutDeclaration;
  origine: OrigineDeclaration;
  /** Déclaration complétée (complément), sinon null. */
  lieeA: string | null;
  depart: string | null;
  echeance: string | null;
  /** Rubriques : contenu figé pour une déclaration envoyée, sinon saisie ou pré-remplissage. */
  rubriques: RubriqueRemplie[];
  /** Numéro de dossier pressenti, puis numéro de dossier ou d'accusé de réception à l'envoi. */
  reference: string;
  motif: string | null;
  decision: { par: string; le: string } | null;
  envoi: { par: string; le: string; reference: string } | null;
  creeLe: string;
  creePar: string;
  version: number;
}
export interface VueDeclarationsIncident {
  incidentId: string;
  qualifieeLe: string | null;
  /** La personne tient le rôle « RSSI » (confirmer, écarter, envoyer, ouvrir, corriger la date). */
  peutDeclarer: boolean;
  /** incidents:modifier sur le périmètre de l'incident (préparer). */
  peutPreparer: boolean;
  peutExporter: boolean;
  declarations: DeclarationIncidentDto[];
}
