/* Import Tenacy : lecture de l'onglet « Gaps » de l'export Tenacy (écarts de la plateforme Tenacy). Fonctions pures : le
   navigateur lit le classeur et envoie les lignes, le serveur les relit avec ces mêmes règles pour simuler puis appliquer.
   Format conservé de l'outil historique : colonnes Id, Name FR, Description FR, Recommandation FR, Perimeter, Measure,
   Status, Resolution status, Deadline, Manager, Group, Criticality, Requirements, Actions, Source. Données de test fictives. */

import { z } from 'zod';

export const TENACY_FEUILLE = 'Gaps';
/** Bornes de ce qui est accepté en un fichier. */
export const TENACY_LIMITES = { lignes: 5000, colonnes: 30, texte: 20000, identifiant: 120, actions: 2000 } as const;

/** Corps des requêtes de simulation et d'application : lignes brutes de l'onglet « Gaps » lues par le navigateur. */
export const TenacyBody = z
  .object({
    perimetre: z.uuid(),
    lignes: z
      .array(
        z.array(z.union([z.string().max(TENACY_LIMITES.texte), z.number(), z.null()])).max(TENACY_LIMITES.colonnes),
      )
      .min(1)
      .max(TENACY_LIMITES.lignes + 1),
  })
  .strict();
export const TenacyApplication = TenacyBody.extend({ empreinte: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
export type TenacyBody = z.infer<typeof TenacyBody>;

export type Cellule = string | number | null | undefined;
export type StatutTenacy = 'open' | 'progress' | 'closed';
export type ClassificationTenacy = '' | 'majeure' | 'mineure' | 'point_sensible';
export type NatureEcart = 'nonconformity' | 'observation' | 'opportunity';

export interface LigneTenacy {
  /** Numéro de ligne dans l'onglet (1 = en-tête). */
  ligne: number;
  id: string;
  nom: string;
  description: string;
  /** Recommandation : première partie (intitulé de l'action) et tâches (une par puce, sinon l'intitulé). */
  action: string;
  taches: string[];
  perimetre: string;
  statutBrut: string;
  statut: StatutTenacy;
  statutInconnu: boolean;
  echeance: string;
  pilote: string;
  groupe: string;
  classification: ClassificationTenacy;
  nature: NatureEcart;
  criticite: string;
  actionsTenacy: string;
  /** Codes de mesures (Measure et Requirements) au format de l'outil : ISO-4.1, A-5.15, HDS-04. */
  mesures: string[];
  /** « AFNOR » quand l'identifiant suit le motif des écarts de certification (AA-DHA-…), sinon vide. */
  source: '' | 'AFNOR';
  annee: number | null;
}

export interface LectureTenacy {
  lignes: LigneTenacy[];
  erreurs: { ligne: number; message: string }[];
  /** Statuts Tenacy non reconnus, traités par défaut. */
  statutsInconnus: string[];
  /** Vrai si l'onglet ne contient aucun écart. */
  vide: boolean;
}

const STATUTS: Record<string, StatutTenacy> = {
  TO_BE_CONFIRMED: 'open',
  OPEN: 'open',
  TODO: 'open',
  IN_PROGRESS: 'progress',
  CLOSE: 'closed',
  CLOSED: 'closed',
  DONE: 'closed',
};
const GROUPES: Record<string, { classification: ClassificationTenacy; nature: NatureEcart }> = {
  NCMAJ: { classification: 'majeure', nature: 'nonconformity' },
  NCMIN: { classification: 'mineure', nature: 'nonconformity' },
  PS: { classification: 'point_sensible', nature: 'nonconformity' },
  PP: { classification: '', nature: 'opportunity' },
};

export const cellule = (v: Cellule) =>
  v == null
    ? ''
    : String(v)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u00a0]/g, ' ')
        .trim();
const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texte Tenacy (Markdown léger) en texte brut : puces à deux niveaux jointes, gras et échappements retirés. */
export function texteTenacy(brut: Cellule): string {
  const sortie: string[] = [];
  for (const l of String(brut ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')) {
    const m = /^\s{2,}[*•-]\s+(.*)$/.exec(l);
    if (m && sortie.length) {
      const p = sortie[sortie.length - 1]!.trimEnd();
      sortie[sortie.length - 1] = p + (/:$/.test(p) ? ' ' : ' ; ') + m[1]!.trim();
    } else sortie.push(l);
  }
  return sortie
    .join('\n')
    .replace(/[\u00a0]/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\\([^\w\s])/g, '$1')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Recommandation : intitulé (lignes sans puce) et tâches (une par puce ; sans puce, l'intitulé fait la seule tâche). */
export function actionTenacy(texte: string) {
  const lignes = texte
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const puce = (l: string) => /^[-–•]/.test(l);
  const puces = lignes.filter(puce).map((l) => l.replace(/^[-–•]\s*/, ''));
  const brute = lignes
    .filter((l) => !puce(l))
    .join(' ')
    .trimEnd();
  const tete = (brute.endsWith(':') ? brute.slice(0, -1) : brute).trimEnd();
  return { action: tete, taches: puces.length ? puces : tete ? [tete] : [] };
}

/** Code de mesure Tenacy ou de l'outil vers l'identifiant de mesure (ISO-4.1, A-5.15, HDS-04) ; nul si illisible. */
export function codeMesureTenacy(brut: string): string | null {
  // Espaces ramenés à un seul : les motifs ci-dessous n'ont ainsi aucune ambiguïté (pas de retour arrière coûteux).
  const x = brut.slice(0, 100).trim().replace(/\s+/g, ' ');
  let m: RegExpExecArray | null;
  if ((m = /^ISO-[\d-]+ (\d+(?:\.\d+)*)$/i.exec(x))) return 'ISO-' + m[1];
  if ((m = /^HDS[-\d.]* EXI ?(\d+)$/i.exec(x))) return 'HDS-' + String(+m[1]!).padStart(2, '0');
  if ((m = /^DDA-[A-Z]+ (\d+\.\d+)$/i.exec(x))) return 'A-' + m[1];
  if ((m = /^(?:A\.|Annexe A ?)(\d+\.\d+)/i.exec(x))) return 'A-' + m[1];
  if ((m = /^(?:HDS|EXI) ?(\d+)/i.exec(x))) return 'HDS-' + String(+m[1]!).padStart(2, '0');
  if ((m = /^(?:clause ?)?(\d+(?:\.\d+)*)$/i.exec(x))) return 'ISO-' + m[1];
  return null;
}
export function codesMesuresTenacy(brut: Cellule): string[] {
  return cellule(brut)
    .split(/[,;\n]/)
    .map((x) => codeMesureTenacy(x))
    .filter((x): x is string => !!x);
}

/** Date AAAA-MM-JJ depuis un numéro de série Excel, une date ISO ou JJ/MM/AAAA(AA) ; vide si illisible. */
export function dateTenacy(v: Cellule): string {
  if (v == null || v === '') return '';
  const s = cellule(v);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return valide(m[1]!, m[2]!, m[3]!);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) return valide(m[3]!.length === 2 ? '20' + m[3] : m[3]!, m[2]!.padStart(2, '0'), m[1]!.padStart(2, '0'));
  return '';
}
function valide(a: string, m: string, j: string) {
  const d = new Date(`${a}-${m}-${j}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === `${a}-${m}-${j}` ? `${a}-${m}-${j}` : '';
}

function colonne(entete: readonly Cellule[], ...cles: string[]) {
  const h = entete.map((x) => cellule(x).toLowerCase());
  for (const k of cles) {
    const i = h.findIndex((c) => c === k);
    if (i >= 0) return i;
  }
  for (const k of cles) {
    const i = h.findIndex((c) => c.startsWith(k));
    if (i >= 0) return i;
  }
  return -1;
}

/** Lit les lignes de l'onglet « Gaps » (première ligne = en-têtes). Une ligne sans identifiant est ignorée. */
export function lireGaps(rows: readonly (readonly Cellule[])[]): LectureTenacy {
  const sortie: LectureTenacy = { lignes: [], erreurs: [], statutsInconnus: [], vide: false };
  const entete = rows[0] ?? [];
  const c = {
    id: colonne(entete, 'id'),
    nom: colonne(entete, 'name fr'),
    desc: colonne(entete, 'description fr'),
    rec: colonne(entete, 'recommandation fr'),
    per: colonne(entete, 'perimeter'),
    mes: colonne(entete, 'measure'),
    st: colonne(entete, 'status'),
    rs: colonne(entete, 'resolution status'),
    dl: colonne(entete, 'deadline'),
    mg: colonne(entete, 'manager'),
    g: colonne(entete, 'group'),
    cr: colonne(entete, 'criticality'),
    rq: colonne(entete, 'requirements'),
    ac: colonne(entete, 'actions'),
  };
  const corps = rows.slice(1);
  if (!corps.some((r) => r.some((x) => x != null && String(x).trim() !== ''))) {
    sortie.vide = true;
    return sortie;
  }
  if (c.id < 0) {
    sortie.erreurs.push({ ligne: 1, message: 'Colonne « Id » absente de l’onglet « Gaps ».' });
    return sortie;
  }
  const vus = new Set<string>();
  const inconnus = new Set<string>();
  corps.forEach((r, i) => {
    const ligne = i + 2;
    const id = cellule(r[c.id]);
    if (!id) return;
    if (id.length > TENACY_LIMITES.identifiant) {
      sortie.erreurs.push({ ligne, message: 'Identifiant trop long.' });
      return;
    }
    if (vus.has(id)) {
      sortie.erreurs.push({ ligne, message: `Identifiant en double : ${id}.` });
      return;
    }
    vus.add(id);
    const brut = c.st >= 0 ? cellule(r[c.st]).toUpperCase() : '';
    const resolution = c.rs >= 0 ? cellule(r[c.rs]).toUpperCase() : '';
    let statut = STATUTS[brut];
    let inconnu = false;
    if (!statut) {
      statut = /CLOS|RESOLV|DONE/.test(brut) ? 'closed' : /PROGRESS|COURS/.test(brut) ? 'progress' : 'open';
      if (brut) {
        inconnu = true;
        inconnus.add(brut);
      }
    }
    if (resolution === 'RESOLVED') statut = 'closed';
    const groupe = c.g >= 0 ? cellule(r[c.g]) : '';
    const g = GROUPES[groupe.toUpperCase().replace(/\s/g, '')] ?? {
      classification: '' as ClassificationTenacy,
      nature: 'observation' as NatureEcart,
    };
    const texte = (i: number) => texteTenacy(i >= 0 ? r[i] : '').slice(0, TENACY_LIMITES.texte);
    const description = texte(c.desc)
      .replace(/^Description de l'écart\s*:\s*/i, '')
      .trim();
    const a = actionTenacy(texte(c.rec));
    const m = /^(\d\d)-DHA-/.exec(id);
    const echeance = c.dl >= 0 ? dateTenacy(r[c.dl]) : '';
    const mesures = [
      ...new Set([...codesMesuresTenacy(c.rq >= 0 ? r[c.rq] : ''), ...codesMesuresTenacy(c.mes >= 0 ? r[c.mes] : '')]),
    ];
    const premiere = (description.split(/(?<=[.!?])\s|\n/)[0] ?? '').trim();
    const nom = (c.nom >= 0 ? cellule(r[c.nom]) : '') || premiere || id;
    sortie.lignes.push({
      ligne,
      id,
      nom: nom.length > 200 ? nom.slice(0, 197) + '…' : nom,
      description,
      action: a.action,
      taches: a.taches.slice(0, 50),
      perimetre: c.per >= 0 ? cellule(r[c.per]).slice(0, 200) : '',
      statutBrut: brut,
      statut,
      statutInconnu: inconnu,
      echeance,
      pilote: c.mg >= 0 ? cellule(r[c.mg]).slice(0, 200) : '',
      groupe,
      classification: g.classification,
      nature: g.nature,
      criticite: c.cr >= 0 ? cellule(r[c.cr]).slice(0, 100) : '',
      actionsTenacy: c.ac >= 0 ? cellule(r[c.ac]).slice(0, 500) : '',
      mesures,
      source: m ? 'AFNOR' : '',
      annee: m ? 2000 + Number(m[1]) : null,
    });
  });
  sortie.statutsInconnus = [...inconnus];
  return sortie;
}

/** Texte normalisé pour comparer des intitulés d'actions (sans accents ni casse). */
export const cleTexte = (s: string) => normaliser(s).replace(/\s+/g, ' ').trim();
