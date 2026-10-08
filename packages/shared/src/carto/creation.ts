/* Construire une carte de zéro (CARTO-15, CARTO-18, ADR 0016) : un objet créé ou renommé depuis la carte est un objet
   de la plateforme, enregistré dans son module. Tant que ces modules sont dans l'outil historique, l'écriture se fait
   dans l'état legacy, avec les mêmes champs et les mêmes identifiants que l'outil historique (addproc, piadd,
   newSup, gapadd). Fonctions pures : l'API les applique sous verrou ; les tests les vérifient sans base. */
import { z } from 'zod';
import type { Module } from '../permissions.js';
import { type MapView, refPrefix } from './model.js';
import { type MapIssue, issueRef, mbHash, splitLines } from './objects.js';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
/** Liste telle quelle (éléments inattendus conservés à l'identique). */
const raw = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const low = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase();

/* ---------------------------------------------------------------- Types créables */
export const CREATABLE_TYPES = [
  'stakeholder',
  'supplier',
  'application',
  'issue',
  'site',
  'infrastructure',
  'process',
  'subprocess',
] as const;
export type CreatableType = (typeof CREATABLE_TYPES)[number];
export interface CreatableDef {
  l: string;
  /** Module d'origine : sa permission « modifier » est exigée en plus de cartographie:modifier. */
  module: Module;
  views: readonly MapView[];
  /** Icône de la palette (icônes de la carte). */
  ic: string;
  /** Teinte de la palette (jetons « carte »). */
  tint: string;
}
export const CREATABLE: Record<CreatableType, CreatableDef> = {
  stakeholder: { l: 'Partie intéressée', module: 'pilotage', views: ['context'], ic: 'users', tint: 'violet' },
  supplier: { l: 'Fournisseur', module: 'fournisseurs', views: ['context'], ic: 'box', tint: 'violet' },
  application: { l: 'Application', module: 'conformite', views: ['context'], ic: 'app', tint: 'bleu' },
  issue: { l: 'Enjeu', module: 'cartographie', views: ['context'], ic: 'alert', tint: 'orange' },
  site: { l: 'Site', module: 'pilotage', views: ['context'], ic: 'pin', tint: 'bleu' },
  infrastructure: { l: 'Système d’information', module: 'pilotage', views: ['context'], ic: 'server', tint: 'bleu' },
  process: { l: 'Processus', module: 'pilotage', views: ['context', 'process'], ic: 'gear', tint: 'bleu' },
  subprocess: { l: 'Sous-processus', module: 'pilotage', views: ['context', 'process'], ic: 'layers', tint: 'bleu' },
};
/** Catégories de parties intéressées de l'outil historique (PI_CAT). */
export const PI_CATEGORIES = [
  'Autorité ou régulateur',
  'Organisme de certification',
  'Membre ou adhérent',
  'Établissement client',
  'Patient ou usager',
  'Personnel',
  'Instance de gouvernance',
  'Fournisseur ou prestataire',
  'Partenaire',
  'Autre',
] as const;
/** Familles de processus de la plateforme (valeur du champ « famille »). */
export const PROCESS_FAMILIES = ['Management', 'Réalisation', 'Support'] as const;
export const PROCESS_FAMILY_LABELS: Record<(typeof PROCESS_FAMILIES)[number], string> = {
  Management: 'Pilotage',
  Réalisation: 'Réalisation',
  Support: 'Support',
};

/* ---------------------------------------------------------------- Corps des requêtes */
const texte = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\p{Cc}]*$/u, 'Caractère interdit.');
const nom = texte(200).min(1, 'Nom obligatoire.');
const code = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/, 'Code invalide : lettres, chiffres, point, tiret (30 au plus).');
const vide = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s.optional());

export const CreateObjectBody = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stakeholder'),
    name: nom,
    nature: z.enum(['Externe', 'Interne']).default('Externe'),
    category: vide(z.enum(PI_CATEGORIES)),
    needs: vide(texte(2000)),
  }),
  z.object({
    type: z.literal('supplier'),
    name: nom,
    saas: z.boolean().default(false),
    hds: z.boolean().default(false),
    critical: z.boolean().default(false),
  }),
  z.object({ type: z.literal('application'), name: nom, supplier: vide(texte(200)) }),
  z.object({ type: z.literal('issue'), name: nom, kind: z.enum(['ext', 'int']), desc: vide(texte(500)) }),
  z.object({ type: z.literal('site'), name: nom }),
  z.object({ type: z.literal('infrastructure'), name: nom }),
  z.object({
    type: z.literal('process'),
    name: nom,
    code: vide(code),
    family: z.enum(PROCESS_FAMILIES),
    owner: vide(texte(120)),
  }),
  z.object({
    type: z.literal('subprocess'),
    name: nom,
    parent: code,
    code: vide(code),
    owner: vide(texte(120)),
  }),
]);
export type CreateObjectBody = z.output<typeof CreateObjectBody>;
export type CreateObjectInput = z.input<typeof CreateObjectBody>;
export const CreateObjectOut = z.object({ ref: z.string(), name: z.string() });
export type CreateObjectOut = z.infer<typeof CreateObjectOut>;
export const RenameBody = z.object({ ref: z.string().max(220), name: nom });

/** Objets renommables depuis la carte : identifiant stable (les enjeux, sites et systèmes sont repérés par leur
 *  libellé, les renommer changerait leur référence). */
export const RENAMABLE_PREFIXES: ReadonlySet<string> = new Set(['process', 'pi', 'sup', 'app']);
export const canRename = (ref: string) => RENAMABLE_PREFIXES.has(refPrefix(ref));

/* ---------------------------------------------------------------- Erreurs */
export class CreationError extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

/* ---------------------------------------------------------------- Identifiants (comme l'outil historique) */
/** Premier code libre « PR1 », « PR2 »… ou, pour un sous-processus, « PR3.1 », « PR3.2 »… */
export function nextProcessCode(codes: Iterable<string>, parent?: string): string {
  const pris = new Set([...codes].map((c) => c.toLowerCase()));
  const base = parent ? parent + '.' : 'PR';
  let k = 1;
  while (pris.has((base + k).toLowerCase())) k++;
  return base + k;
}
const nextPadded = (list: Rec[], prefix: string) => {
  let k = 1;
  while (list.some((x) => x.id === prefix + String(k).padStart(2, '0'))) k++;
  return prefix + String(k).padStart(2, '0');
};

/** Contrôles périodiques d'un nouveau fournisseur (defaultControls de l'outil historique). */
export function defaultSupplierControls(hds: boolean, now: string): Rec[] {
  const L = [
    {
      k: 'mfa',
      t: 'Vérifier l’activation de l’authentification multifacteur',
      ref: 'A.8.5 ; INDOBJ3.2 ; ReCyF 8.3',
    },
    { k: 'sso', t: 'Vérifier l’intégration au SSO', ref: 'INDOBJ3.3' },
    {
      k: 'acc',
      t: 'Revue des comptes et des droits d’accès',
      ref: 'A.5.18 ; ReCyF 10.A.6 et 10.C.4 (au moins annuelle)',
    },
    { k: 'svc', t: 'Revue du service et de la sécurité du fournisseur', ref: 'A.5.22 ; ReCyF 3.B.2' },
  ];
  if (hds) L.push({ k: 'hds', t: 'Vérifier la validité du certificat HDS', ref: 'HDS EXI 06 et 14' });
  return L.map((x) => ({ id: x.k, createdAt: now, t: x.t, ref: x.ref, freq: 12, last: '', result: '', comment: '' }));
}

/* ---------------------------------------------------------------- Création */
export interface CreationResult {
  /** Nouvel état legacy (copie ; l'état reçu n'est pas modifié). */
  data: Rec;
  ref: string;
  name: string;
  /** Enjeu à ranger dans les réglages de la carte (l'état legacy est alors inchangé). */
  issue?: MapIssue;
}

/** Ajoute un objet à l'état legacy. `existingIssues` : enjeux déjà présents (dérivés ou créés sur la carte). */
export function createInLegacy(
  state: unknown,
  body: CreateObjectBody,
  opts: { now: string; uid: () => string; existingIssues?: ReadonlySet<string> },
): CreationResult {
  const data: Rec = isRec(state) ? { ...state } : {};
  const name = body.name;
  switch (body.type) {
    case 'stakeholder': {
      const id = 'PI-' + opts.uid();
      data.interested = [
        ...raw(data.interested),
        {
          id,
          createdAt: opts.now,
          name,
          type: body.nature,
          cat: body.category ?? 'Autre',
          needs: body.needs ?? '',
          req: '',
          addressed: '',
          how: '',
          owner: '',
          reviewed: '',
        },
      ];
      return { data, ref: 'pi:' + id, name };
    }
    case 'supplier': {
      const list = recs(data.suppliers);
      if (list.some((s) => low(s.name) === low(name)))
        throw new CreationError(409, 'Un fournisseur porte déjà ce nom.');
      const id = nextPadded(list, 'SUP');
      data.suppliers = [
        ...raw(data.suppliers),
        {
          id,
          createdAt: opts.now,
          name,
          rattachement: '',
          saas: body.saas,
          sso: '',
          mfa: '',
          critical: body.critical ? 'Oui' : '',
          hds: body.hds ? 'Oui' : '',
          contact: '',
          lastReview: '',
          notes: '',
          controls: defaultSupplierControls(body.hds, opts.now),
        },
      ];
      return { data, ref: 'sup:' + id, name };
    }
    case 'application': {
      const list = recs(data.appGaps);
      let supplier = '';
      if (body.supplier) {
        const sp = recs(data.suppliers).find((s) => low(s.name) === low(body.supplier));
        if (!sp) throw new CreationError(422, 'Fournisseur inconnu : choisissez-le dans la liste.');
        supplier = String(sp.name);
      }
      const id = nextPadded(list, 'APP');
      data.appGaps = [
        ...raw(data.appGaps),
        {
          id,
          createdAt: opts.now,
          name,
          supplier,
          dscp: 'À qualifier',
          cloud: 'À qualifier',
          status: 'À étudier',
          owner: '',
          target: '',
          desc: '',
          lines: {},
          custom: [],
        },
      ];
      return { data, ref: 'app:' + id, name };
    }
    case 'issue': {
      const ref = issueRef(name);
      if (opts.existingIssues?.has(ref)) throw new CreationError(409, 'Cet enjeu existe déjà.');
      return { data, ref, name, issue: { label: name, kind: body.kind, ...(body.desc ? { desc: body.desc } : {}) } };
    }
    case 'site':
    case 'infrastructure': {
      const champ = body.type === 'site' ? 'sites' : 'systems';
      const sc: Rec = isRec(data.scope) ? { ...data.scope } : {};
      const lignes = splitLines(sc[champ]);
      if (lignes.some((l) => low(l) === low(name)))
        throw new CreationError(409, body.type === 'site' ? 'Ce site existe déjà.' : 'Ce système existe déjà.');
      const cur = sc[champ];
      sc[champ] = Array.isArray(cur) ? [...cur, name] : cur ? String(cur).trimEnd() + '\n' + name : name;
      data.scope = sc;
      return { data, ref: (body.type === 'site' ? 'site:' : 'infra:') + mbHash(name.toLowerCase()), name };
    }
    case 'process':
    case 'subprocess': {
      const list = recs(data.processes);
      const codes = list.map((p) => String(p.id));
      let family: string = body.type === 'process' ? body.family : '';
      if (body.type === 'subprocess') {
        const parent = list.find((p) => String(p.id) === body.parent);
        if (!parent) throw new CreationError(422, 'Processus parent introuvable.');
        if (body.code && !body.code.startsWith(body.parent + '.'))
          throw new CreationError(
            422,
            `Le code d’un sous-processus commence par celui de son processus (${body.parent}.1).`,
          );
        family = typeof parent.family === 'string' ? parent.family : '';
      }
      const id = body.code ?? nextProcessCode(codes, body.type === 'subprocess' ? body.parent : undefined);
      if (codes.some((c) => c.toLowerCase() === id.toLowerCase()))
        throw new CreationError(409, `Le code ${id} est déjà utilisé.`);
      data.processes = [...raw(data.processes), { id, name, owner: body.owner ?? '', family, createdAt: opts.now }];
      return { data, ref: 'process:' + id, name };
    }
  }
}

/* ---------------------------------------------------------------- Renommage (CARTO-18) */
const LISTES: Record<string, string> = { pi: 'interested', sup: 'suppliers', app: 'appGaps', process: 'processes' };

/** Renomme un objet dans l'état legacy ; un fournisseur renommé reste lié à ses applications. */
export function renameInLegacy(state: unknown, ref: string, name: string): { data: Rec; old: string } {
  const prefix = refPrefix(ref);
  const key = LISTES[prefix];
  if (!key || !canRename(ref)) throw new CreationError(422, 'Cet objet ne peut pas être renommé depuis la carte.');
  const id = ref.slice(prefix.length + 1);
  const data: Rec = isRec(state) ? { ...state } : {};
  const list = recs(data[key]);
  const i = list.findIndex((x) => String(x.id) === id);
  if (i < 0) throw new CreationError(404, 'Objet introuvable dans la plateforme.');
  const old = String(list[i]!.name ?? '');
  if (prefix === 'sup' && list.some((s, j) => j !== i && low(s.name) === low(name)))
    throw new CreationError(409, 'Un fournisseur porte déjà ce nom.');
  const cible = list[i];
  data[key] = raw(data[key]).map((x) => (x === cible ? { ...cible, name } : x));
  if (prefix === 'sup' && old && Array.isArray(data.appGaps))
    data.appGaps = data.appGaps.map((a) => (isRec(a) && low(a.supplier) === low(old) ? { ...a, supplier: name } : a));
  return { data, old };
}
