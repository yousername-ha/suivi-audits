/* Applications à intégrer au périmètre (analyse d'écart « GAP ») : liste de contrôle, états, avancement et questionnaire
   guidé, repris à l'identique de l'outil de suivi historique (`GAP_TPL`, `gapLines`, `gapLineState`, `gapStats`, `GW_Q`,
   `gwBuild`, `parseCode`). Les libellés du questionnaire sont conservés tels quels : les réponses déjà enregistrées par
   l'outil historique restent lisibles. Rien n'est estimé : une question sans réponse laisse les points « À évaluer ». */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

export const SECTIONS_GAP = [
  ['per', 'Périmètre, risques et DdA'],
  ['acc', 'Actifs et accès'],
  ['exp', 'Exploitation'],
  ['sup', 'Fournisseur'],
  ['rgpd', 'Données personnelles (RGPD)'],
  ['spec', 'Cas particuliers'],
  ['hds', 'Exigences HDS (si DSCP)'],
] as const;
export const ETATS_GAP = ['À évaluer', 'Conforme', 'Partiel', 'Non conforme', 'Non applicable'] as const;
export type EtatGap = (typeof ETATS_GAP)[number];
export const STATUTS_GAP = ['À étudier', 'En cours', 'Intégrée', 'Écartée'] as const;
export const QUALIFICATIONS_GAP = ['À qualifier', 'Oui', 'Non'] as const;
export const NIVEAU_ETAT_GAP: Record<EtatGap, 'ok' | 'mid' | 'bad' | 'na'> = {
  Conforme: 'ok',
  Partiel: 'mid',
  'Non conforme': 'bad',
  'Non applicable': 'na',
  'À évaluer': 'na',
};

export interface PointGap {
  id: string;
  sec: string;
  refs: string[];
  t: string;
  cond?: 'dscp' | 'cloud';
}
/** Socle de la liste de contrôle ; les points conditionnels ne s'affichent que si l'application traite des DSCP ou
    est un service en nuage. */
export const POINTS_GAP: readonly PointGap[] = [
  {
    id: 'G01',
    sec: 'per',
    refs: ['ISO-4.3'],
    t: "Inclure l'application dans le domaine d'application du SMSI (document de périmètre mis à jour)",
  },
  {
    id: 'G02',
    sec: 'per',
    refs: ['HDS-04'],
    cond: 'dscp',
    t: "Couvrir tous les traitements de DSCP de l'application, y compris sauvegardes et transferts de supports",
  },
  { id: 'G03', sec: 'per', refs: ['ISO-6.1.2'], t: "Réaliser l'appréciation des risques de l'application" },
  {
    id: 'G04',
    sec: 'per',
    refs: ['HDS-05'],
    cond: 'dscp',
    t: "Intégrer à l'appréciation des risques les événements imposés par l'exigence HDS 05",
  },
  {
    id: 'G05',
    sec: 'per',
    refs: ['ISO-6.1.3'],
    t: "Définir le traitement des risques et mettre à jour la déclaration d'applicabilité",
  },
  { id: 'G06', sec: 'per', refs: ['ISO-6.3', 'ISO-8.1'], t: "Planifier l'intégration comme une modification du SMSI" },
  {
    id: 'G07',
    sec: 'acc',
    refs: ['A-5.9'],
    t: "Inscrire l'application et ses actifs à l'inventaire, avec un propriétaire",
  },
  { id: 'G08', sec: 'acc', refs: ['A-5.12'], t: "Classifier les informations traitées par l'application" },
  {
    id: 'G09',
    sec: 'acc',
    refs: ['A-5.15', 'A-5.18'],
    t: "Définir les règles d'accès et organiser la revue périodique des droits",
  },
  { id: 'G10', sec: 'acc', refs: ['A-8.5'], t: 'Mettre en place une authentification sécurisée (MFA, SSO)' },
  { id: 'G11', sec: 'acc', refs: ['A-8.2'], t: 'Limiter et tracer les comptes à privilèges' },
  { id: 'G12', sec: 'exp', refs: ['A-8.8'], t: "Intégrer l'application à la gestion des vulnérabilités techniques" },
  { id: 'G13', sec: 'exp', refs: ['A-8.13'], t: 'Sauvegarder les données et tester la restauration' },
  { id: 'G14', sec: 'exp', refs: ['A-8.15', 'A-8.16'], t: 'Journaliser et superviser les événements de sécurité' },
  { id: 'G15', sec: 'exp', refs: ['A-8.32'], t: 'Soumettre les évolutions à la gestion des changements' },
  { id: 'G16', sec: 'exp', refs: ['A-5.30'], t: "Prendre en compte l'application dans la continuité d'activité TIC" },
  {
    id: 'G17',
    sec: 'sup',
    refs: ['A-5.19', 'A-5.20'],
    t: 'Encadrer le fournisseur et intégrer les exigences de sécurité au contrat',
  },
  {
    id: 'G18',
    sec: 'sup',
    refs: ['A-5.23'],
    cond: 'cloud',
    t: "Appliquer le processus d'acquisition, de gestion et de sortie des services en nuage",
  },
  { id: 'G19', sec: 'sup', refs: ['A-5.22'], t: 'Prévoir la surveillance et la revue régulière du service' },
  {
    id: 'G20',
    sec: 'hds',
    refs: ['HDS-06', 'HDS-14'],
    cond: 'dscp',
    t: 'En cas de sous-traitance : maîtriser ses changements et encadrer la perte de sa certification',
  },
  {
    id: 'G21',
    sec: 'hds',
    refs: ['HDS-12'],
    cond: 'dscp',
    t: 'Obtenir le certificat HDS du sous-traitant le cas échéant',
  },
  {
    id: 'G22',
    sec: 'hds',
    refs: ['HDS-13'],
    cond: 'dscp',
    t: 'Formaliser la répartition des responsabilités de sécurité',
  },
  {
    id: 'G23',
    sec: 'hds',
    refs: ['HDS-16'],
    cond: 'dscp',
    t: "Inclure l'audit des traces d'accès aux DSCP dans l'audit interne",
  },
  {
    id: 'G24',
    sec: 'hds',
    refs: [
      'HDS-17',
      'HDS-18',
      'HDS-19',
      'HDS-20',
      'HDS-21',
      'HDS-22',
      'HDS-23',
      'HDS-24',
      'HDS-25',
      'HDS-26',
      'HDS-27',
    ],
    cond: 'dscp',
    t: 'Vérifier les clauses contractuelles HDS avec les clients (EXI 17 à 27)',
  },
  {
    id: 'G25',
    sec: 'hds',
    refs: ['HDS-28'],
    cond: 'dscp',
    t: "Vérifier le stockage des DSCP exclusivement dans l'EEE",
  },
  {
    id: 'G26',
    sec: 'hds',
    refs: ['HDS-29', 'HDS-30', 'HDS-31'],
    cond: 'dscp',
    t: 'Documenter les accès depuis un pays tiers et les risques liés aux législations extra-européennes',
  },
];

export interface LigneGap {
  st?: string;
  comment?: string;
  owner?: string;
  due?: string;
  /** Identifiant de l'action créée dans le registre des écarts. */
  fd?: string;
}
export interface AppGap {
  id: string;
  name: string;
  supplier: string;
  dscp: string;
  cloud: string;
  status: string;
  owner: string;
  target: string;
  desc: string;
  lines: Record<string, LigneGap>;
  custom: { id: string; sec: string; refs: string[]; t: string }[];
  /** Plan d'action créé par le questionnaire guidé. */
  planFd: string;
  /** Réponses au questionnaire guidé et date. */
  profile: Record<string, string | string[]> | null;
  profileAt: string;
}

export function lireAppGap(brut: unknown): AppGap | null {
  const o = obj(brut);
  if (!str(o.id)) return null;
  const lines: Record<string, LigneGap> = {};
  for (const [k, v] of Object.entries(obj(o.lines))) {
    const l = obj(v);
    lines[k] = {
      st: str(l.st) || undefined,
      comment: str(l.comment) || undefined,
      owner: str(l.owner) || undefined,
      due: str(l.due) || undefined,
      fd: str(l.fd) || undefined,
    };
  }
  const profil = obj(o.profile);
  const { at, ...reponses } = profil;
  return {
    id: str(o.id),
    name: str(o.name),
    supplier: str(o.supplier),
    dscp: str(o.dscp) || 'À qualifier',
    cloud: str(o.cloud) || 'À qualifier',
    status: str(o.status) || 'À étudier',
    owner: str(o.owner),
    target: str(o.target),
    desc: str(o.desc),
    lines,
    custom: (Array.isArray(o.custom) ? o.custom : [])
      .map(obj)
      .filter((l) => str(l.id))
      .map((l) => ({
        id: str(l.id),
        sec: str(l.sec) || 'per',
        refs: (Array.isArray(l.refs) ? l.refs : []).filter((r): r is string => typeof r === 'string'),
        t: str(l.t),
      })),
    planFd: str(o.planFd),
    profile: Object.keys(reponses).length ? (reponses as Record<string, string | string[]>) : null,
    profileAt: str(at),
  };
}

export interface PointAffiche extends PointGap {
  custom: boolean;
}
/** Points de la liste de contrôle d'une application : socle filtré par les conditions, puis points ajoutés. */
export function pointsGap(a: Pick<AppGap, 'dscp' | 'cloud' | 'custom'>): PointAffiche[] {
  const socle = POINTS_GAP.filter((l) => !l.cond || (l.cond === 'dscp' ? a.dscp !== 'Non' : a.cloud !== 'Non')).map(
    (l) => ({ ...l, custom: false }),
  );
  return [...socle, ...a.custom.map((l) => ({ ...l, sec: l.sec || 'per', custom: true }))];
}
/** État d'un point : celui saisi ; à défaut « Non applicable » si toutes ses exigences sont exclues de la DdA. */
export function etatPointGap(
  a: Pick<AppGap, 'lines'>,
  l: Pick<PointGap, 'id' | 'refs'>,
  exclues: ReadonlySet<string>,
): EtatGap {
  const v = a.lines[l.id]?.st;
  if (v) return v as EtatGap;
  if (l.refs.length && l.refs.every((r) => exclues.has(r))) return 'Non applicable';
  return 'À évaluer';
}
export interface StatsGap {
  n: number;
  applicables: number;
  c: Record<EtatGap, number>;
  pct: number;
  ouverts: number;
}
export function statsGap(
  a: Pick<AppGap, 'lines' | 'dscp' | 'cloud' | 'custom'>,
  exclues: ReadonlySet<string>,
): StatsGap {
  const etats = pointsGap(a).map((l) => etatPointGap(a, l, exclues));
  const c = Object.fromEntries(ETATS_GAP.map((s) => [s, etats.filter((x) => x === s).length])) as Record<
    EtatGap,
    number
  >;
  const applicables = etats.length - c['Non applicable'];
  return {
    n: etats.length,
    applicables,
    c,
    pct: applicables ? Math.round((c.Conforme * 100) / applicables) : 0,
    ouverts: c.Partiel + c['Non conforme'],
  };
}

/** Identifiant d'une exigence à partir d'une saisie libre (« A.8.24 », « EXI 15 », « 6.1.2 ») ou `null`. */
export function identifiantExigence(saisie: string): string | null {
  const t = saisie.trim().replace(/\s+/g, ' ');
  let m = t.match(/^(?:A\.|Annexe\s*A\s*)(\d+\.\d+)/i);
  if (m) return 'A-' + m[1];
  m = t.match(/^(?:HDS|EXI)\s*0*(\d+)/i);
  if (m) return 'HDS-' + String(+m[1]!).padStart(2, '0');
  m = t.match(/^(?:clause\s*)?(\d+(?:\.\d+)*)$/i);
  if (m) return 'ISO-' + m[1];
  return null;
}
/** Identifiant d'une nouvelle application : APP01, premier numéro libre. */
export function identifiantApp(existants: readonly string[]): string {
  const pris = new Set(existants);
  let k = 1;
  while (pris.has('APP' + String(k).padStart(2, '0'))) k++;
  return 'APP' + String(k).padStart(2, '0');
}
/** Numéro libre d'une action GAP-nn dans le registre des écarts. */
export function identifiantEcartGap(existants: readonly string[]): string {
  const pris = new Set(existants);
  let n = 1;
  while (pris.has('GAP-' + String(n).padStart(2, '0'))) n++;
  return 'GAP-' + String(n).padStart(2, '0');
}

/* ------------------------------------------------------------------------------------ questionnaire guidé */
export interface QuestionGap {
  k: string;
  l: string;
  o: readonly string[];
  multi?: boolean;
}
export const QUESTIONS_GAP: readonly QuestionGap[] = [
  {
    k: 'type',
    l: 'Type de service',
    o: [
      'SaaS (hébergé par l’éditeur)',
      'Hébergé par le GCS, administré par le GCS',
      'Hébergé par le GCS, administré par le fournisseur',
      'Développement interne ou spécifique',
    ],
  },
  {
    k: 'dscp',
    l: 'Des données de santé à caractère personnel (DSCP) sont-elles traitées ?',
    o: ['Oui', 'Non', 'À qualifier'],
  },
  { k: 'dcp', l: 'D’autres données personnelles sont-elles traitées (agents, usagers, contacts) ?', o: ['Oui', 'Non'] },
  {
    k: 'loc',
    l: 'Où les données sont-elles hébergées ?',
    o: ['France', 'Union européenne (hors France)', 'Hors Union européenne', 'Inconnu'],
  },
  {
    k: 'certs',
    l: 'Certifications du fournisseur',
    multi: true,
    o: ['ISO 27001', 'HDS', 'SecNumCloud', 'Aucune', 'Inconnu'],
  },
  { k: 'expo', l: 'Exposition du service', o: ['Accessible depuis internet', 'Réseau interne uniquement', 'Les deux'] },
  {
    k: 'users',
    l: 'Utilisateurs',
    multi: true,
    o: ['Agents du GCS', 'Établissements adhérents', 'Patients ou usagers', 'Prestataires'],
  },
  {
    k: 'sso',
    l: 'Authentification unique (SSO) avec l’annuaire du GCS',
    o: ['Disponible et activée', 'Disponible, non activée', 'Non disponible', 'Inconnu'],
  },
  {
    k: 'mfa',
    l: 'Authentification multifacteur (MFA)',
    o: ['Disponible et activée', 'Disponible, non activée', 'Non disponible', 'Inconnu'],
  },
  { k: 'tma', l: 'Le fournisseur intervient-il à distance (télémaintenance, administration) ?', o: ['Oui', 'Non'] },
  {
    k: 'flux',
    l: 'Le service échange-t-il des données avec d’autres SI (interfaces, API, fichiers) ?',
    o: ['Oui', 'Non'],
  },
  {
    k: 'crit',
    l: 'Criticité pour l’activité',
    o: ['Critique : arrêt de moins de 4 h tolérable', 'Importante : une journée', 'Standard : plus d’une journée'],
  },
  { k: 'backup', l: 'Qui assure les sauvegardes ?', o: ['Le fournisseur', 'Le GCS', 'Inconnu'] },
  { k: 'logs', l: 'Les journaux peuvent-ils être envoyés vers le SIEM du GCS ?', o: ['Oui', 'Non', 'Inconnu'] },
  { k: 'ia', l: 'Le service embarque-t-il de l’intelligence artificielle ?', o: ['Oui', 'Non', 'Inconnu'] },
  {
    k: 'spec',
    l: 'Cas particuliers',
    multi: true,
    o: ['Dispositif médical connecté', 'Application ou terminaux mobiles', 'Équipements wi-fi', 'Aucun'],
  },
];
export type ReponsesGap = Record<string, string | string[] | undefined>;
export interface PointAjoute {
  id: string;
  sec: string;
  refs: string[];
  t: string;
}
export interface ResultatQuestionnaire {
  dscp: string;
  cloud: string;
  saas: boolean;
  fournisseur: boolean;
  dev: boolean;
  /** Points ajoutés selon les réponses (en plus du socle). */
  custom: PointAjoute[];
  /** États pré-évalués par point (identifiant du socle ou du point ajouté). */
  st: Record<string, string>;
  /** Constats pré-remplis. */
  cm: Record<string, string>;
}
/** Points ajoutés et pré-évaluations déduits des réponses (`gwBuild`). */
export function questionnaireGap(A: ReponsesGap): ResultatQuestionnaire {
  const a = (k: string) => A[k];
  const has = (k: string, v: string) => (Array.isArray(a(k)) ? (a(k) as string[]).includes(v) : a(k) === v);
  const saas = has('type', 'SaaS (hébergé par l’éditeur)'),
    fournisseur = saas || has('type', 'Hébergé par le GCS, administré par le fournisseur') || has('tma', 'Oui'),
    dev = has('type', 'Développement interne ou spécifique');
  const dscp = A.dscp === 'Oui' ? 'Oui' : A.dscp === 'Non' ? 'Non' : 'À qualifier',
    personnel = A.dscp === 'Oui' || A.dcp === 'Oui';
  const st: Record<string, string> = {},
    cm: Record<string, string> = {},
    custom: PointAjoute[] = [];
  let n = 0;
  const C = (sec: string, refs: string[], t: string, s?: string | null, c?: string) => {
    const id = 'Q' + ++n;
    custom.push({ id, sec, refs, t });
    if (s || c) {
      if (s) st[id] = s;
      if (c) cm[id] = c;
    }
  };
  const auth = (v: unknown, lab: string): [string | null, string] =>
    v === 'Disponible et activée'
      ? ['Conforme', lab + ' activée.']
      : v === 'Disponible, non activée'
        ? ['Partiel', lab + ' disponible mais non activée : à activer.']
        : v === 'Non disponible'
          ? ['Non conforme', lab + ' non proposée par le service.']
          : [null, lab + ' : à vérifier.'];
  const [s1, c1] = auth(A.mfa, 'MFA'),
    [s2, c2] = auth(A.sso, 'SSO');
  const g10 = [s1, s2].includes('Non conforme')
    ? 'Non conforme'
    : [s1, s2].includes('Partiel')
      ? 'Partiel'
      : s1 === 'Conforme' && s2 === 'Conforme'
        ? 'Conforme'
        : null;
  if (g10) st.G10 = g10;
  cm.G10 = `${c1} ${c2}`;
  if (A.logs === 'Non') {
    st.G14 = 'Non conforme';
    cm.G14 = 'Journaux non exportables vers le SIEM.';
  } else if (A.logs === 'Oui') cm.G14 = 'Export des journaux vers le SIEM possible : à raccorder.';
  if (A.backup === 'Inconnu') cm.G13 = 'Responsabilité des sauvegardes à clarifier.';
  else if (A.backup)
    cm.G13 = `Sauvegardes assurées par ${A.backup === 'Le GCS' ? 'le GCS' : 'le fournisseur'} : obtenir la preuve des tests de restauration.`;
  if (dscp === 'Oui') {
    if (A.loc === 'Hors Union européenne') {
      st.G25 = 'Non conforme';
      cm.G25 = 'Hébergement déclaré hors de l’Union européenne.';
    } else if (A.loc) cm.G25 = `Hébergement déclaré : ${A.loc}. À prouver (contrat, certificat).`;
    if (fournisseur) {
      if (has('certs', 'HDS')) cm.G21 = 'Certificat HDS déclaré : vérifier les activités couvertes et la validité.';
      else {
        st.G21 = 'Non conforme';
        cm.G21 = 'Aucun certificat HDS déclaré pour le fournisseur.';
      }
    } else {
      st.G21 = 'Non applicable';
      cm.G21 = 'Service hébergé et administré par le GCS : couvert par la certification HDS du GCS.';
    }
  }
  if (personnel) {
    C('rgpd', ['A-5.34'], 'Inscrire le traitement au registre des activités de traitement (RGPD, article 30)');
    if (A.dscp === 'Oui')
      C('rgpd', ['A-5.34'], 'Réaliser ou mettre à jour l’analyse d’impact (AIPD) : données de santé');
    if (fournisseur)
      C('rgpd', ['A-5.20', 'A-5.34'], 'Signer un contrat de sous-traitance conforme à l’article 28 du RGPD');
    if (A.loc === 'Hors Union européenne' || A.loc === 'Inconnu')
      C(
        'rgpd',
        ['A-5.34'],
        'Encadrer ou exclure les transferts de données hors de l’Union européenne',
        A.loc === 'Hors Union européenne' ? 'Non conforme' : null,
        `Hébergement déclaré : ${A.loc}.`,
      );
  }
  const certs = Array.isArray(A.certs) ? A.certs : [];
  if (fournisseur && (has('certs', 'Aucune') || has('certs', 'Inconnu') || !certs.length))
    C(
      'sup',
      ['A-5.19', 'A-5.22'],
      'Obtenir les certificats et preuves de sécurité du fournisseur (ISO 27001, HDS, rapports d’audit)',
      'Non conforme',
      'Aucune certification déclarée ou connue.',
    );
  if (fournisseur)
    C('sup', ['A-5.19', 'A-5.20'], 'Évaluer le fournisseur sur le clausier de conformité numérique (Club RSSI Santé)');
  if (has('expo', 'Accessible depuis internet') || has('expo', 'Les deux')) {
    C('exp', ['A-8.8', 'A-8.29'], 'Réaliser un test d’intrusion ou un audit de sécurité avant la mise en production');
    C(
      'exp',
      ['A-8.20', 'A-8.21', 'A-8.9'],
      'Protéger l’exposition internet : filtrage, durcissement, protection applicative',
    );
  }
  if (has('users', 'Établissements adhérents') || has('users', 'Patients ou usagers') || has('users', 'Prestataires'))
    C('acc', ['A-5.16', 'A-5.18'], 'Gérer le cycle de vie des comptes externes (création, revue, suppression)');
  if (A.tma === 'Oui')
    C(
      'acc',
      ['A-8.2', 'A-8.15'],
      'Encadrer la télémaintenance : bastion, accès nominatifs et tracés, ouverture à la demande',
    );
  if (A.flux === 'Oui')
    C('exp', ['A-5.14', 'A-8.21', 'A-8.24'], 'Documenter les flux (matrice de flux) et sécuriser les échanges');
  if (str(A.crit).startsWith('Critique'))
    C(
      'exp',
      ['A-5.30', 'A-8.14'],
      'Définir les objectifs de reprise (RTO, RPO), intégrer au PCA et au PRA et planifier un exercice',
    );
  else if (str(A.crit).startsWith('Importante'))
    C('exp', ['A-5.30'], 'Définir les objectifs de reprise (RTO, RPO) et les intégrer au PCA');
  if (dev)
    C(
      'exp',
      ['A-8.25', 'A-8.28', 'A-8.29', 'A-8.31'],
      'Appliquer le développement sécurisé : revue de code, tests de sécurité, environnements séparés',
    );
  if (A.ia === 'Oui')
    C('spec', ['A-5.9'], 'Inscrire l’usage au registre IA et l’évaluer (GAP IA, règlement européen sur l’IA)');
  if (has('spec', 'Dispositif médical connecté'))
    C(
      'spec',
      ['A-8.20', 'A-8.22'],
      'Dispositif médical connecté : segmentation réseau, correctifs validés par le fabricant',
    );
  if (has('spec', 'Application ou terminaux mobiles'))
    C(
      'spec',
      ['A-8.1', 'A-6.7'],
      'Gérer les terminaux mobiles : gestion de flotte, chiffrement, effacement à distance',
    );
  if (has('spec', 'Équipements wi-fi'))
    C('spec', ['A-8.20', 'A-8.24'], 'Sécuriser le wi-fi : WPA2 Entreprise ou supérieur, authentification 802.1X');
  C('per', ['ISO-9.2'], 'Inclure l’application au programme d’audit interne');
  C('acc', ['A-6.3'], 'Former et sensibiliser les utilisateurs et les administrateurs');
  return { dscp, cloud: saas ? 'Oui' : 'Non', saas, fournisseur, dev, custom, st, cm };
}

/* ------------------------------------------------------------------------------------------- requêtes */
const ligne = (max: number) => z.string().trim().max(max);
const dateVide = z.union([z.literal(''), z.iso.date()]);
export const AppGapModification = z
  .object({
    name: ligne(200).min(1),
    supplier: ligne(80),
    dscp: z.enum(QUALIFICATIONS_GAP),
    cloud: z.enum(QUALIFICATIONS_GAP),
    status: z.enum(STATUTS_GAP),
    owner: ligne(200),
    target: dateVide,
    desc: ligne(5000),
  })
  .partial()
  .strict();
export const LigneGapModification = z
  .object({ st: z.enum(ETATS_GAP), comment: ligne(2000), owner: ligne(200), due: dateVide })
  .partial()
  .strict();
export const PointGapCreation = z
  .object({ t: ligne(500).min(1), refs: z.string().trim().max(500).default('') })
  .strict();
export const GuideGapCreation = z
  .object({
    name: ligne(200).min(1),
    supplier: ligne(80).default(''),
    supplierNew: ligne(200).default(''),
    owner: ligne(200).default(''),
    target: dateVide.default(''),
    desc: ligne(5000).default(''),
    answers: z.record(z.string(), z.union([z.string().max(200), z.array(z.string().max(200)).max(10)])).default({}),
    mkPlan: z.boolean().default(true),
    mkIa: z.boolean().default(true),
  })
  .strict();
export type GuideGapCreation = z.infer<typeof GuideGapCreation>;
