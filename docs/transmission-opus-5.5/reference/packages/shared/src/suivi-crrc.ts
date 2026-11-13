/* Gestion CRRC (reprise de la page de l'outil de suivi) : établissements et contrats, offres régionales, offre de
   sauvegarde (ressources, sauvegardes, restaurations, alertes), statistiques et rapports mensuels. Calculs repris à
   l'identique de l'outil historique (`resProt`, `resStatus`, `estStatus`, `crStats`, vues tableau de bord et rapports).
   Dates : AAAA-MM-JJ pour les jours, AAAA-MM-JJThh:mm pour les horodatages. */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const nb = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const objet = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);

/** Technologies de l'offre de sauvegarde : clé, libellé, description du périmètre. */
export const TECHNOLOGIES_CRRC = [
  { cle: 'm365', libelle: 'Microsoft 365', teinte: 0, description: 'Messagerie, OneDrive, SharePoint, Teams' },
  { cle: 'gws', libelle: 'Google Workspace', teinte: 1, description: 'Gmail, Drive, Agenda' },
  { cle: 'windows', libelle: 'Serveurs Windows', teinte: 2, description: 'Fichiers et dossiers (agent Kopia)' },
  { cle: 's3', libelle: 'NAS compatibles S3', teinte: 3, description: 'Données des volumes, sauvegarde directe S3' },
] as const;
export const STATUTS_CONTRAT_CRRC = [
  'À compléter',
  'À signer',
  'Déploiement',
  'Actif',
  'À renouveler',
  'Suspendu',
  'Clos',
] as const;
export const STATUTS_OFFRE_CRRC = ['Disponible', 'En préparation', 'Suspendue', 'Arrêtée'] as const;
export const TYPES_SAUVEGARDE_CRRC = ['Incrémentale', 'Complète'] as const;
export const STATUTS_SAUVEGARDE_CRRC = ['Réussie', 'Alerte', 'Échec'] as const;
export const FREQUENCES_CRRC = ['Quotidienne', 'Hebdomadaire', 'Mensuelle'] as const;
export const STATUTS_RESTAURATION_CRRC = ['Demandée', 'En cours', 'Réussie', 'Échec'] as const;
export const SEVERITES_CRRC = ['Haute', 'Moyenne', 'Info'] as const;
export const STATUTS_ALERTE_CRRC = ['Ouverte', 'En cours', 'Résolue'] as const;
export const MOTIFS_RESTAURATION_CRRC = [
  'Demande utilisateur',
  'Test de restauration',
  'Incident',
  'Contrôle de recette',
] as const;
export const DESTINATIONS_RESTAURATION_CRRC = ['Emplacement d’origine', 'Emplacement alternatif'] as const;
export const CONFLITS_RESTAURATION_CRRC = ['Ne pas écraser', 'Renommer', 'Écraser'] as const;
/** Code du département : deux premiers caractères du FINESS (« ? » si le FINESS est vide). */
export const departementFiness = (finess: string) => finess.trim().slice(0, 2).toUpperCase() || '?';
export const libelleDepartement = (code: string) => (code === '?' ? 'Département inconnu' : `Département ${code}`);
export const libelleTechnologie = (k: string) => TECHNOLOGIES_CRRC.find((t) => t.cle === k)?.libelle ?? k;

export interface Etablissement {
  id: string;
  name: string;
  finess: string;
  status: string;
  adminContact: string;
  adminEmail: string;
  techContact: string;
  techEmail: string;
  prestataire: string;
  alerts: string;
  signed: string;
  serviceDate: string;
  renewal: string;
  capacityGb: number;
  retentionDays: number;
  offers: string[];
  scopes: Record<string, boolean>;
  notes: string;
}
export interface Ressource {
  id: string;
  est: string;
  name: string;
  tech: string;
  freq: string;
  retention: number | null;
  notes: string;
}
export interface Sauvegarde {
  id: string;
  res: string;
  date: string;
  type: string;
  status: string;
  volumeGb: number;
  durationMin: number;
}
export interface Restauration {
  id: string;
  date: string;
  est: string;
  res: string;
  scope: string;
  type: string;
  status: string;
  owner: string;
  duration: string;
  dest: string;
  path: string;
  conflict: string;
  point: string;
}
export interface AlerteCrrc {
  id: string;
  date: string;
  severity: string;
  est: string;
  res: string;
  message: string;
  status: string;
  incident: string;
}
export interface Offre {
  id: string;
  name: string;
  status: string;
  partner: string;
  desc: string;
  perimeters: { cle: string; libelle: string; description: string; etiquettes: string[] }[];
}
export interface EtatCrrc {
  offers: Offre[];
  establishments: Etablissement[];
  resources: Ressource[];
  runs: Sauvegarde[];
  restores: Restauration[];
  alerts: AlerteCrrc[];
}

/** Périmètres de l'offre de sauvegarde, ajoutée à la lecture comme dans l'outil historique si elle manque. */
export const OFFRE_SAUVEGARDE: Offre = {
  id: 'backup',
  name: 'Sauvegarde immuable « dernière chance »',
  status: 'Disponible',
  partner: '',
  desc: 'Copie de sauvegarde externalisée et immuable, protégée contre la suppression ou la modification pendant la durée de rétention, pour les établissements accompagnés par le CRRC.',
  perimeters: [
    {
      cle: 's3',
      libelle: 'NAS compatibles S3',
      description:
        'Sauvegarde directe vers une destination S3 (pas de destination SMB ou NFS pour le service régional).',
      etiquettes: ['Immuable', 'Multi-tenant'],
    },
    {
      cle: 'windows',
      libelle: 'Serveurs Windows',
      description: 'Agent Kopia, compte de service dédié et droits minimaux ; cible stockage objet S3.',
      etiquettes: ['Restauration', 'Alerting'],
    },
    {
      cle: 'm365',
      libelle: 'Microsoft 365',
      description: 'Périmètre SaaS souscriptible ; solution technique finale à confirmer contractuellement.',
      etiquettes: ['À confirmer'],
    },
    {
      cle: 'gws',
      libelle: 'Google Workspace',
      description:
        'Gmail, Drive et Agenda selon le périmètre retenu ; solution technique finale à confirmer contractuellement.',
      etiquettes: ['À confirmer'],
    },
    {
      cle: 'store',
      libelle: 'Stockage objet',
      description:
        'Scality RING, S3 Object Lock en mode Compliance, versioning, chiffrement AES-256 au repos, isolation multi-tenant.',
      etiquettes: ['Immuable', 'Conformité'],
    },
  ],
};

const liste = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(objet).filter((x): x is Obj => !!x && !!str(x.id)) : []);
const horodatage = (v: unknown) => str(v).replace(' ', 'T');

function lireOffre(o: Obj): Offre {
  const base = str(o.id) === 'backup' ? OFFRE_SAUVEGARDE : null;
  const perimetres = Array.isArray(o.perimeters)
    ? (o.perimeters as unknown[]).flatMap((p) =>
        Array.isArray(p)
          ? [
              {
                cle: str(p[0]),
                libelle: str(p[1]),
                description: str(p[2]),
                etiquettes: Array.isArray(p[3]) ? (p[3] as unknown[]).map(str) : [],
              },
            ]
          : [],
      )
    : (base?.perimeters ?? []);
  return {
    id: str(o.id),
    name: str(o.name),
    status: str(o.status) || 'Disponible',
    partner: str(o.partner),
    desc: str(o.desc),
    perimeters: perimetres,
  };
}
/** Lecture tolérante de l'état `crrc` (valeurs manquantes ignorées, offre de sauvegarde ajoutée si absente). */
export function lireEtatCrrc(brut: unknown): EtatCrrc {
  const c = objet(brut) ?? {};
  const offers = liste(c.offers).map(lireOffre);
  if (!offers.some((o) => o.id === 'backup')) offers.unshift(OFFRE_SAUVEGARDE);
  return {
    offers,
    establishments: liste(c.establishments).map((e) => ({
      id: str(e.id),
      name: str(e.name),
      finess: str(e.finess),
      status: str(e.status) || 'À compléter',
      adminContact: str(e.adminContact),
      adminEmail: str(e.adminEmail),
      techContact: str(e.techContact),
      techEmail: str(e.techEmail),
      prestataire: str(e.prestataire),
      alerts: str(e.alerts),
      signed: str(e.signed),
      serviceDate: str(e.serviceDate),
      renewal: str(e.renewal),
      capacityGb: nb(e.capacityGb),
      retentionDays: nb(e.retentionDays),
      offers: Array.isArray(e.offers) ? (e.offers as unknown[]).map(str) : ['backup'],
      scopes: Object.fromEntries(Object.entries(objet(e.scopes) ?? {}).map(([k, v]) => [k, !!v])),
      notes: str(e.notes),
    })),
    resources: liste(c.resources).map((r) => ({
      id: str(r.id),
      est: str(r.est),
      name: str(r.name),
      tech: str(r.tech),
      freq: str(r.freq),
      retention: r.retention === undefined || r.retention === '' || r.retention === null ? null : nb(r.retention),
      notes: str(r.notes),
    })),
    runs: liste(c.runs).map((r) => ({
      id: str(r.id),
      res: str(r.res),
      date: horodatage(r.date),
      type: str(r.type),
      status: str(r.status),
      volumeGb: nb(r.volumeGb),
      durationMin: nb(r.durationMin),
    })),
    restores: liste(c.restores).map((r) => ({
      id: str(r.id),
      date: horodatage(r.date),
      est: str(r.est),
      res: str(r.res),
      scope: str(r.scope),
      type: str(r.type),
      status: str(r.status),
      owner: str(r.owner),
      duration: str(r.duration),
      dest: str(r.dest),
      path: str(r.path),
      conflict: str(r.conflict),
      point: str(r.point),
    })),
    alerts: liste(c.alerts).map((a) => ({
      id: str(a.id),
      date: horodatage(a.date),
      severity: str(a.severity),
      est: str(a.est),
      res: str(a.res),
      message: str(a.message),
      status: str(a.status),
      incident: str(a.incident),
    })),
  };
}

/* ------------------------------------------------------------------------------------------------ formats */
export function formaterVolume(gb: number): string {
  const v = Number(gb) || 0;
  return v >= 1024
    ? `${(Math.round(v / 102.4) / 10).toLocaleString('fr-FR')} To`
    : `${(Math.round(v * 10) / 10).toLocaleString('fr-FR')} Go`;
}
export function formaterDuree(min: number): string {
  const m = Number(min) || 0;
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}
export function formaterHorodatage(s: string): string {
  if (!s) return '–';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? s
    : `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/* --------------------------------------------------------------------------------------------- exploitation */
export type NiveauCrrc = 'ok' | 'mid' | 'bad' | 'na' | 'info';
const parDateDesc = <T extends { date: string }>(l: readonly T[]) =>
  [...l].sort((a, b) => b.date.localeCompare(a.date));

export const sauvegardesDe = (e: EtatCrrc, res: string) => parDateDesc(e.runs.filter((r) => r.res === res));
export const derniereSauvegarde = (e: EtatCrrc, res: string) => sauvegardesDe(e, res)[0];
/** Volume protégé d'une ressource : dernière sauvegarde complète et incrémentales suivantes (échecs exclus). */
export function volumeProtege(runs: readonly Sauvegarde[], jusquau?: string): number {
  const l = runs
    .filter((r) => r.status !== 'Échec' && (!jusquau || r.date.slice(0, 10) <= jusquau))
    .sort((a, b) => a.date.localeCompare(b.date));
  let i = -1;
  l.forEach((r, k) => {
    if (r.type === 'Complète') i = k;
  });
  return (i < 0 ? l : l.slice(i)).reduce((a, r) => a + r.volumeGb, 0);
}
export const volumeProtegeRessource = (e: EtatCrrc, res: string) => volumeProtege(e.runs.filter((r) => r.res === res));
export function statutRessource(e: EtatCrrc, res: Ressource): [string, NiveauCrrc] {
  const l = derniereSauvegarde(e, res.id);
  if (!l) return ['Non configuré', 'na'];
  const ouverte = e.alerts.some((a) => a.res === res.id && a.status !== 'Résolue');
  return l.status === 'Réussie' && !ouverte
    ? ['Réussie', 'ok']
    : l.status === 'Échec'
      ? ['Échec', 'bad']
      : ['Alerte', 'mid'];
}
export function statutEtablissement(e: EtatCrrc, est: Etablissement): [string, NiveauCrrc] {
  const r = e.resources.filter((x) => x.est === est.id);
  if (!r.length) return ['Non configuré', 'na'];
  const alerte = e.alerts.some((a) => a.est === est.id && a.status !== 'Résolue');
  return alerte || r.some((x) => statutRessource(e, x)[1] !== 'ok') ? ['Alerte', 'mid'] : ['Opérationnel', 'ok'];
}
/** Niveau d'affichage d'un libellé (contrat, sauvegarde, restauration, alerte) dans l'outil historique. */
export function niveauCrrc(s: string): NiveauCrrc {
  const m: Record<string, NiveauCrrc> = {
    Actif: 'ok',
    Déploiement: 'info',
    'À signer': 'mid',
    'À compléter': 'mid',
    'À renouveler': 'bad',
    Suspendu: 'bad',
    Clos: 'na',
    Réussie: 'ok',
    Alerte: 'mid',
    Échec: 'bad',
    'Non configuré': 'na',
    Opérationnel: 'ok',
    Ouverte: 'bad',
    'En cours': 'info',
    Résolue: 'ok',
    Demandée: 'mid',
    Haute: 'bad',
    Moyenne: 'mid',
    Info: 'info',
    Basse: 'na',
  };
  return m[s] ?? 'na';
}

export type PeriodeCrrc = '24h' | '7j' | '30j' | '12m';
const JOUR = 864e5;
const DUREE: Record<PeriodeCrrc, number> = { '24h': JOUR, '7j': 7 * JOUR, '30j': 30 * JOUR, '12m': 365 * JOUR };
/** Date de référence : la plus récente entre maintenant et la dernière sauvegarde enregistrée. */
export function referenceCrrc(e: EtatCrrc, maintenant: number): number {
  const ds = e.runs.map((r) => Date.parse(r.date)).filter((x) => !Number.isNaN(x));
  return ds.length ? Math.max(maintenant, ...ds) : maintenant;
}
export interface StatsCrrc {
  etablissements: number;
  actifs: number;
  volume: number;
  taux: number | null;
  variation: number | null;
  alertes: AlerteCrrc[];
  sauvegardes: number;
}
export function statistiquesCrrc(e: EtatCrrc, periode: PeriodeCrrc, maintenant: number): StatsCrrc {
  const ref = referenceCrrc(e, maintenant),
    P = DUREE[periode];
  const dans = (r: Sauvegarde, a: number, b: number) => {
    const d = Date.parse(r.date);
    return d > ref - b && d <= ref - a;
  };
  const cur = e.runs.filter((r) => dans(r, 0, P)),
    prev = e.runs.filter((r) => dans(r, P, 2 * P));
  const taux = (l: Sauvegarde[]) => (l.length ? l.filter((r) => r.status === 'Réussie').length / l.length : null);
  const t = taux(cur),
    tp = taux(prev);
  return {
    etablissements: e.establishments.length,
    actifs: e.establishments.filter((x) => x.status === 'Actif').length,
    volume: e.resources.reduce((a, r) => a + volumeProtegeRessource(e, r.id), 0),
    taux: t,
    variation: t != null && tp != null ? t - tp : null,
    alertes: e.alerts.filter((a) => a.status !== 'Résolue'),
    sauvegardes: cur.length,
  };
}
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** Évolution du volume protégé par technologie : un point par jour (7 j, 30 j) ou par mois (12 m). */
export function evolutionVolume(
  e: EtatCrrc,
  periode: PeriodeCrrc,
  maintenant: number,
): { libelle: string; valeurs: Record<string, number> }[] {
  const ref = referenceCrrc(e, maintenant);
  const points: [Date, string][] =
    periode === '12m'
      ? Array.from({ length: 12 }, (_, i) => {
          const d = new Date(ref);
          d.setDate(1);
          d.setMonth(d.getMonth() - (11 - i) + 1);
          d.setDate(0);
          return [d, MOIS_COURTS[d.getMonth()]!];
        })
      : Array.from({ length: periode === '30j' ? 30 : 7 }, (_, i) => {
          const d = new Date(ref - ((periode === '30j' ? 29 : 6) - i) * JOUR);
          return [d, periode === '30j' ? String(d.getDate()) : `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`];
        });
  return points.map(([d, libelle]) => {
    const jour = d.toISOString().slice(0, 10),
      valeurs: Record<string, number> = {};
    for (const r of e.resources) {
      const v = volumeProtege(
        e.runs.filter((x) => x.res === r.id),
        jour,
      );
      if (v) valeurs[r.tech] = (valeurs[r.tech] ?? 0) + v;
    }
    return { libelle, valeurs };
  });
}
/** Graduation de l'axe : sommet arrondi (1, 2, 2,5, 5, 10 × puissance de dix), en Go ou en To. */
export function sommetVolume(max: number): { sommet: number; unite: number } {
  const m = Math.max(1, max);
  const unite = m >= 1000 ? 1000 : 1;
  const brut = ((m / unite) * 1.08) / 3,
    mag = Math.pow(10, Math.floor(Math.log10(brut)));
  const joli = [1, 2, 2.5, 5, 10].find((x) => x * mag >= brut)! * mag;
  return { sommet: joli * 3 * unite, unite };
}
export const formaterAxeVolume = (v: number, unite: number) =>
  `${(Math.round((v / unite) * 10) / 10).toLocaleString('fr-FR')} ${unite > 1 ? 'To' : 'Go'}`;

export interface LigneRapportCrrc {
  etablissement: Etablissement;
  sauvegardes: number;
  taux: number | null;
  volume: number;
  alertes: number;
  restaurations: number;
}
/** Rapport mensuel (AAAA-MM) par établissement. */
export function rapportMensuelCrrc(e: EtatCrrc, mois: string): LigneRapportCrrc[] {
  return e.establishments.map((est) => {
    const R = e.resources.filter((r) => r.est === est.id).map((r) => r.id);
    const runs = e.runs.filter((x) => R.includes(x.res) && x.date.startsWith(mois));
    const ok = runs.filter((x) => x.status === 'Réussie').length;
    return {
      etablissement: est,
      sauvegardes: runs.length,
      taux: runs.length ? Math.round((ok * 1000) / runs.length) / 10 : null,
      volume: R.reduce((a, id) => a + volumeProtegeRessource(e, id), 0),
      alertes: e.alerts.filter((a) => a.est === est.id && a.date.startsWith(mois)).length,
      restaurations: e.restores.filter((x) => x.est === est.id && x.date.startsWith(mois)).length,
    };
  });
}

/* ------------------------------------------------------------------------------------------ activité par département */
export interface EtablissementDepartementCrrc {
  id: string;
  nom: string;
  niveau: NiveauCrrc;
  detail: string;
}
export interface ActiviteDepartementCrrc {
  departement: string;
  etablissements: EtablissementDepartementCrrc[];
}
/** Établissements regroupés par département (deux premiers chiffres du FINESS), départements triés par code. */
export function activiteParDepartement(e: EtatCrrc): ActiviteDepartementCrrc[] {
  const parDept = new Map<string, Etablissement[]>();
  for (const est of e.establishments) {
    const d = departementFiness(est.finess);
    parDept.set(d, [...(parDept.get(d) ?? []), est]);
  }
  return [...parDept.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([departement, liste]) => ({
      departement,
      etablissements: liste.map((est) => {
        const [libelle, niveau] = statutEtablissement(e, est);
        const res = e.resources.filter((r) => r.est === est.id);
        const volume = res.reduce((s, r) => s + volumeProtegeRessource(e, r.id), 0);
        const derniere = res
          .map((r) => derniereSauvegarde(e, r.id)?.date)
          .filter((x): x is string => !!x)
          .sort()
          .pop();
        return {
          id: est.id,
          nom: est.name,
          niveau,
          detail: `${formaterVolume(volume)} sauvegardés · dernière sauvegarde : ${formaterHorodatage(derniere ?? '')} · ${libelle}`,
        };
      }),
    }));
}

/* ------------------------------------------------------------------------------------------------ écriture */
/** Identifiants créés par l'outil historique : préfixe + horodatage en base 36. */
export const identifiantCrrc = (prefixe: 'RES' | 'RUN' | 'RST' | 'ALR' | 'OFF', maintenant: number) =>
  `${prefixe}-${maintenant.toString(36).toUpperCase()}`;
export const identifiantEtablissement = (existants: number, maintenant: number) =>
  `CRRC-${String(existants + 1).padStart(3, '0')}-${maintenant.toString(36).slice(-3).toUpperCase()}`;

const t = (n: number) => z.string().trim().max(n);
const jour = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).')]);
const heure = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure invalides (AAAA-MM-JJThh:mm).');
const cles = TECHNOLOGIES_CRRC.map((x) => x.cle) as [string, ...string[]];

export const EtablissementModification = z
  .object({
    name: t(200).min(1),
    finess: t(20),
    status: z.enum(STATUTS_CONTRAT_CRRC),
    signed: jour,
    serviceDate: jour,
    renewal: jour,
    adminContact: t(200),
    adminEmail: t(200),
    techContact: t(200),
    techEmail: t(200),
    prestataire: t(200),
    alerts: t(500),
    capacityGb: z.number().min(0).max(1e9),
    retentionDays: z.number().int().min(0).max(36500),
    scopes: z.partialRecord(z.enum(cles), z.boolean()),
    notes: t(5000),
  })
  .partial()
  .strict();
export type EtablissementModification = z.infer<typeof EtablissementModification>;

export const RessourceCreation = z.object({ est: t(100).optional(), tech: z.enum(cles).optional() }).strict();
export const RessourceModification = z
  .object({
    name: t(200).min(1),
    tech: z.enum(cles),
    est: t(100),
    freq: z.enum(FREQUENCES_CRRC),
    retention: z.number().int().min(0).max(36500),
    notes: t(5000),
  })
  .partial()
  .strict();
export const SauvegardeCreation = z
  .object({
    date: heure,
    type: z.enum(TYPES_SAUVEGARDE_CRRC),
    status: z.enum(STATUTS_SAUVEGARDE_CRRC),
    volumeGb: z.number().min(0).max(1e9),
    durationMin: z.number().int().min(0).max(100000),
  })
  .strict();
export const RestaurationCreation = z
  .object({
    res: t(100).min(1),
    point: t(40).min(1),
    scope: t(500),
    type: z.enum(MOTIFS_RESTAURATION_CRRC),
    owner: t(200),
    dest: z.enum(DESTINATIONS_RESTAURATION_CRRC),
    path: t(500),
    conflict: z.enum(CONFLITS_RESTAURATION_CRRC),
  })
  .strict();
export const RestaurationModification = z
  .object({ status: z.enum(STATUTS_RESTAURATION_CRRC), owner: t(200), duration: t(40) })
  .partial()
  .strict();
export const AlerteCreation = z
  .object({ severity: z.enum(SEVERITES_CRRC), res: t(100).min(1), message: t(2000) })
  .strict();
export const AlerteModification = z.object({ status: z.enum(STATUTS_ALERTE_CRRC) }).strict();
export const OffreModification = z
  .object({
    name: t(200).min(1),
    status: z.enum(STATUTS_OFFRE_CRRC),
    partner: t(200),
    desc: t(5000),
  })
  .partial()
  .strict();
