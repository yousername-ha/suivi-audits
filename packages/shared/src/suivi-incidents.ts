/* Registre des incidents (reprise de la page « Incidents » de l'outil de suivi) : questionnaire de qualification
   (incident de sécurité, incident, événement, demande), obligations à vérifier, priorité ITIL impact × urgence et
   états, repris à l'identique de l'outil historique (`incQualify`, `incObligations`, `incPrio`, `incOpen`, `incNew`). */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export const QUALIFICATIONS_INCIDENT = [
  'Incident de sécurité',
  'Incident',
  'Événement de sécurité',
  'Événement',
  'Demande',
] as const;
export const STATUTS_INCIDENT = ['Nouveau', 'Qualifié', 'En cours', 'Résolu', 'Clos'] as const;
export const CATEGORIES_INCIDENT = [
  'Hameçonnage',
  'Logiciel malveillant ou rançongiciel',
  'Compte compromis ou accès non autorisé',
  'Fuite ou perte de données',
  'Indisponibilité de service',
  'Vulnérabilité exploitée',
  'Perte ou vol de matériel',
  'Erreur humaine',
  'Incident fournisseur',
  'Autre',
] as const;
export const NIVEAUX_INCIDENT = ['Élevé', 'Moyen', 'Faible'] as const;
export type RepInc = 'oui' | 'non' | 'nsp';

export const QUESTIONS_INCIDENT = [
  [
    'demande',
    'La personne demande-t-elle un service, une information, un accès ou un matériel, sans signaler de dysfonctionnement ?',
  ],
  [
    'service',
    'Un service est-il interrompu ou dégradé pour les utilisateurs, ou risque-t-il de l’être à court terme ?',
  ],
  [
    'cia',
    'La confidentialité, l’intégrité ou la disponibilité d’informations est-elle compromise ou probablement compromise (accès non autorisé, fuite, perte, modification, chiffrement malveillant, compte compromis) ?',
  ],
  [
    'politique',
    'Une règle de sécurité a-t-elle été enfreinte ou tentée (hameçonnage reçu, connexion suspecte, analyse de ports, alerte EDR ou SIEM), sans conséquence avérée à ce stade ?',
  ],
  ['dcp', 'Des données à caractère personnel sont-elles concernées ?'],
  ['sante', 'Des données de santé ou des activités hébergées au titre de la certification HDS sont-elles concernées ?'],
] as const;
export type Reponses = Partial<Record<(typeof QUESTIONS_INCIDENT)[number][0], RepInc>>;

/** Qualification d'un signalement d'après les réponses (« Je ne sais pas » vaut « non »). */
export function qualifierIncident(a: Reponses): { kind: (typeof QUALIFICATIONS_INCIDENT)[number]; why: string } {
  const y = (k: keyof Reponses) => a[k] === 'oui';
  if (y('cia'))
    return {
      kind: 'Incident de sécurité',
      why: 'Atteinte avérée ou probable à la confidentialité, à l’intégrité ou à la disponibilité d’informations (ISO 27001 Annexe A 5.24 à 5.28).',
    };
  if (y('service'))
    return y('politique')
      ? { kind: 'Incident de sécurité', why: 'Dégradation de service liée à une atteinte à la politique de sécurité.' }
      : {
          kind: 'Incident',
          why: 'Interruption ou dégradation non planifiée d’un service (définition ITIL d’un incident).',
        };
  if (y('politique'))
    return {
      kind: 'Événement de sécurité',
      why: 'Occurrence liée à la sécurité sans atteinte avérée : à journaliser, analyser et surveiller ; escalade en incident si un impact apparaît (Annexe A 5.25).',
    };
  if (y('demande'))
    return {
      kind: 'Demande',
      why: 'Demande de service sans dysfonctionnement (définition ITIL d’une demande de service) : à traiter dans le catalogue de services.',
    };
  return {
    kind: 'Événement',
    why: 'Changement d’état sans impact ni demande identifiés : à enregistrer pour information.',
  };
}
/** Obligations à vérifier pour un incident de sécurité (qualification, RGPD, santé et HDS, NIS 2). */
export function obligationsIncident(a: Reponses, kind: string, categorieEntite: string): [string, string][] {
  if (kind !== 'Incident de sécurité') return [];
  const l: [string, string][] = [
    [
      'Qualification et réponse',
      'Mettre en œuvre la procédure de gestion des incidents, conserver les preuves (Annexe A 5.26 à 5.28).',
    ],
  ];
  if (a.dcp === 'oui')
    l.push([
      'RGPD',
      'Violation de données personnelles : documenter dans le registre des violations ; notifier la CNIL dans les 72 heures sauf si la violation n’est pas susceptible d’engendrer un risque (article 33) ; informer les personnes en cas de risque élevé (article 34). Associer le DPO.',
    ]);
  if (a.sante === 'oui')
    l.push([
      'Santé et HDS',
      'Vérifier les obligations de signalement des incidents graves de sécurité des systèmes d’information de santé (article L. 1111-8-2 du code de la santé publique, portail de signalement) et informer les clients des prestations hébergées selon les engagements contractuels HDS.',
    ]);
  l.push([
    'NIS 2',
    `Si l’organisation est entité essentielle ou importante et que l’incident est important : alerte précoce sous 24 heures, notification sous 72 heures, rapport final sous un mois (article 23 de la directive). Catégorie de l’organisation : ${categorieEntite || 'à confirmer'}.`,
  ]);
  return l;
}
/** Priorité ITIL : matrice impact × urgence (P1 Critique à P5 Planifiée), vide si l'un des deux manque. */
export function prioriteIncident(impact: string, urgence: string): string {
  const a = (NIVEAUX_INCIDENT as readonly string[]).indexOf(impact),
    b = (NIVEAUX_INCIDENT as readonly string[]).indexOf(urgence);
  return a < 0 || b < 0 ? '' : ['P1 Critique', 'P2 Haute', 'P3 Moyenne', 'P4 Basse', 'P5 Planifiée'][a + b]!;
}
export const incidentOuvert = (i: Pick<Incident, 'status'>) => !['Résolu', 'Clos'].includes(i.status);

export interface Incident {
  id: string;
  detectedAt: string;
  reporter: string;
  title: string;
  desc: string;
  kind: string;
  cat: string;
  impact: string;
  urgency: string;
  status: string;
  owner: string;
  actions: string;
  cause: string;
  resolvedAt: string;
  retex: string;
  answers: Reponses;
  notified: Record<string, string>;
  findingId: string;
}
export function lireIncident(brut: unknown): Incident | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  const rep = (v: unknown): Reponses => {
    const r: Reponses = {};
    if (v && typeof v === 'object' && !Array.isArray(v))
      for (const [k] of QUESTIONS_INCIDENT) {
        const x = (v as Obj)[k];
        if (x === 'oui' || x === 'non' || x === 'nsp') r[k] = x;
      }
    return r;
  };
  const traite: Record<string, string> = {};
  if (o.notified && typeof o.notified === 'object' && !Array.isArray(o.notified))
    for (const [k, v] of Object.entries(o.notified as Obj)) if (v) traite[k] = str(v);
  return {
    id: str(o.id),
    detectedAt: str(o.detectedAt),
    reporter: str(o.reporter),
    title: str(o.title),
    desc: str(o.desc),
    kind: str(o.kind) || 'Incident',
    cat: str(o.cat) || 'Autre',
    impact: str(o.impact),
    urgency: str(o.urgency),
    status: str(o.status) || 'Nouveau',
    owner: str(o.owner),
    actions: str(o.actions),
    cause: str(o.cause),
    resolvedAt: str(o.resolvedAt),
    retex: str(o.retex),
    answers: rep(o.answers),
    notified: traite,
    findingId: str(o.findingId),
  };
}
/** Identifiant d'un incident : INC-AAAA-nnn, premier numéro libre de l'année. */
export function identifiantIncident(existants: readonly string[], annee: number): string {
  let k = 1;
  while (existants.includes(`INC-${annee}-${String(k).padStart(3, '0')}`)) k++;
  return `INC-${annee}-${String(k).padStart(3, '0')}`;
}
/** Identifiant de l'action issue d'un incident : INC-AC-nn, premier numéro libre. */
export function identifiantActionIncident(existants: readonly string[]): string {
  let k = 1;
  while (existants.includes(`INC-AC-${String(k).padStart(2, '0')}`)) k++;
  return `INC-AC-${String(k).padStart(2, '0')}`;
}
export interface SyntheseIncidents {
  ouverts: number;
  securiteOuverts: number;
  clos: number;
  total: number;
}
export function syntheseIncidents(l: readonly Incident[]): SyntheseIncidents {
  return {
    ouverts: l.filter(incidentOuvert).length,
    securiteOuverts: l.filter((i) => i.kind === 'Incident de sécurité' && incidentOuvert(i)).length,
    clos: l.filter((i) => !incidentOuvert(i)).length,
    total: l.length,
  };
}
export type FiltreIncidents = 'open' | 'sec' | 'all' | (typeof QUALIFICATIONS_INCIDENT)[number];
/** Registre filtré, du plus récemment détecté au plus ancien. */
export function filtrerIncidents(l: readonly Incident[], f: FiltreIncidents): Incident[] {
  return l
    .filter((i) =>
      f === 'all'
        ? true
        : f === 'open'
          ? incidentOuvert(i)
          : f === 'sec'
            ? i.kind === 'Incident de sécurité'
            : i.kind === f,
    )
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

const t = (n: number) => z.string().trim().max(n);
const heure = z.union([
  z.literal(''),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure invalides (AAAA-MM-JJThh:mm).'),
]);
const reponse = z.enum(['oui', 'non', 'nsp']);
const reponses = z.object(Object.fromEntries(QUESTIONS_INCIDENT.map(([k]) => [k, reponse.optional()]))).strict();
export const IncidentCreation = z
  .object({ title: t(300), reporter: t(200), answers: reponses })
  .partial()
  .strict();
export const IncidentModification = z
  .object({
    title: t(300),
    detectedAt: heure,
    reporter: t(200),
    owner: t(200),
    kind: z.enum(QUALIFICATIONS_INCIDENT),
    cat: z.enum(CATEGORIES_INCIDENT),
    status: z.enum(STATUTS_INCIDENT),
    impact: z.union([z.literal(''), z.enum(NIVEAUX_INCIDENT)]),
    urgency: z.union([z.literal(''), z.enum(NIVEAUX_INCIDENT)]),
    desc: t(10000),
    actions: t(10000),
    cause: t(5000),
    resolvedAt: heure,
    retex: t(10000),
  })
  .partial()
  .strict();
export type IncidentModification = z.infer<typeof IncidentModification>;
export const ObligationTraitee = z.object({ traitee: z.boolean() }).strict();
