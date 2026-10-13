/* Référentiels de l'outil de suivi → bibliothèque de l'organisation (ADR 0033). Fonctions pures : elles lisent l'état de
   l'outil historique (clauses ISO 27001, Annexe A, exigences HDS, référentiels en `frameworks`) et fabriquent des définitions
   de bibliothèque. Rien n'est inventé : seuls les champs présents dans l'état sont repris, les autres restent vides ou
   explicitement « non renseigné ». Aucune définition n'est normative ni vérifiée (statut `unverified`). */
import type { LibraryFrameworkDefinition } from '@suivi/shared';

type Json = Record<string, unknown>;
export interface TrackerCandidate {
  definition: LibraryFrameworkDefinition;
  /** Points d'attention affichés avant toute importation. */
  notes: string[];
}

const NON_RENSEIGNE = 'Non renseigné dans l’outil de suivi';
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);
/** Identifiant de domaine : minuscules, chiffres et tirets bas. */
const cle = (prefix: string, s: string) =>
  `${prefix}_${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`.slice(0, 64);
const tronque = (s: string) => s.endsWith('…') || s.endsWith('...');

const SOURCE_ISO = {
  organisation: 'ISO/IEC',
  document: 'ISO/IEC 27001:2022 — intitulés des clauses et de l’Annexe A saisis dans l’outil de suivi',
  url: 'https://www.iso.org/fr/standard/27001',
  version: '2022',
  date: '',
  license:
    'Norme payante protégée par le droit d’auteur : seuls les intitulés saisis dans l’outil de suivi sont repris, jamais le texte normatif.',
  verifiedAt: '',
  normative: false,
  status: 'unverified' as const,
};
const SOURCE_HDS = {
  organisation: 'ANS (Agence du Numérique en Santé)',
  document:
    'Référentiel de certification des hébergeurs de données de santé (HDS) — exigences saisies dans l’outil de suivi',
  url: 'https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante/les-referentiels-de-la-procedure-de-certification',
  version: NON_RENSEIGNE,
  date: '',
  license: NON_RENSEIGNE,
  verifiedAt: '',
  normative: false,
  status: 'unverified' as const,
};

function iso(data: Json): TrackerCandidate | null {
  const items = arr(data.items).filter((i) => i.ref === 'ISO' || i.ref === 'A');
  if (!items.length) return null;
  const groupes = arr(data.groups).filter((g) => g.ref === 'ISO' || g.ref === 'A');
  const domaine = (g: Json) => cle(g.ref === 'A' ? 'annexe_a' : 'clause', str(g.num) || str(g.id));
  const domains = groupes.map((g) => ({
    id: domaine(g),
    label: `${g.ref === 'A' ? 'Annexe A' : 'Clause'} ${str(g.num)} — ${str(g.title)}`.slice(0, 200),
  }));
  const parGroupe = new Map(groupes.map((g) => [str(g.id), domaine(g)]));
  const notes: string[] = [];
  const requirements = items.flatMap((i) => {
    const d = parGroupe.get(str(i.group));
    if (!d) {
      notes.push(`« ${str(i.id)} » ignorée : groupe « ${str(i.group)} » absent de l’outil de suivi.`);
      return [];
    }
    return [
      {
        id: `${i.ref === 'A' ? 'A.' : ''}${str(i.num)}`,
        domain: d,
        title: str(i.title).slice(0, 200) || str(i.num),
        description: '',
        applicability: '',
        measureRefs: [],
      },
    ];
  });
  notes.push('Seuls les intitulés sont repris : le texte des exigences n’est pas dans l’outil de suivi.');
  return {
    notes,
    definition: { name: 'ISO/IEC 27001:2022', identifier: 'iso-27001-2022', source: SOURCE_ISO, domains, requirements },
  };
}

function hds(data: Json): TrackerCandidate | null {
  const items = arr(data.items).filter((i) => i.ref === 'HDS' && i.depth === 1);
  if (!items.length) return null;
  const chapitres = (data.hdsChap && typeof data.hdsChap === 'object' ? data.hdsChap : {}) as Record<string, unknown>;
  const domains = new Map<string, string>();
  const cleChapitre = (c: string) => {
    const n = /^(\d+)\./.exec(c)?.[1];
    return n ? `hds_${n}` : cle('hds', c);
  };
  const requirements = items.map((i) => {
    const chapitre = str(chapitres[str(i.id)]);
    const d = chapitre ? cleChapitre(chapitre) : 'hds_sans_chapitre';
    if (!domains.has(d)) domains.set(d, chapitre || 'Chapitre non renseigné');
    return {
      id: str(i.num) || str(i.id),
      domain: d,
      title: str(i.title).slice(0, 200) || str(i.id),
      description: '',
      applicability: '',
      measureRefs: [],
    };
  });
  const groupe = arr(data.groups).find((g) => g.ref === 'HDS');
  const intitule = str(groupe?.title);
  const version = /\bv\d+(\.\d+)*\b/i.exec(intitule)?.[0] ?? NON_RENSEIGNE;
  const notes: string[] = [];
  const tronques = items.filter((i) => tronque(str(i.title))).length;
  if (tronques)
    notes.push(
      `${tronques} intitulé(s) sont tronqués (« … ») dans l’outil de suivi : ils sont repris tels quels, le texte complet reste à ressaisir.`,
    );
  notes.push(
    'Seuls les intitulés sont repris ; la date et la licence du référentiel ne sont pas dans l’outil de suivi.',
  );
  return {
    notes,
    definition: {
      name: intitule || 'Référentiel HDS',
      identifier: 'hds',
      source: { ...SOURCE_HDS, version },
      domains: [...domains].map(([id, label]) => ({ id, label })),
      requirements,
    },
  };
}

/** Référentiel de la liste `frameworks` de l'outil de suivi (forme du ReCyF : exigences par objectif de sécurité). */
function liste(f: Json): TrackerCandidate | null {
  const reqs = arr(f.requirements);
  const id = str(f.id);
  if (!id || !reqs.length || !reqs.every((r) => str(r.id) && str(r.text))) return null;
  const objectifs = (f.objectives && typeof f.objectives === 'object' ? f.objectives : {}) as Record<string, Json>;
  const domains = new Map<string, string>();
  const requirements = reqs.map((r) => {
    const os = String(r.os ?? '');
    const d = os ? `os_${os}`.replace(/[^a-z0-9_]/g, '_') : 'sans_objectif';
    if (!domains.has(d))
      domains.set(d, (str(objectifs[os]?.title) || str(r.objective) || 'Objectif non renseigné').slice(0, 200));
    return {
      id: str(r.id),
      domain: d,
      title: `${str(r.id)} — ${str(r.theme) || str(r.objective)}`.slice(0, 200),
      description: str(r.text),
      applicability: str(r.scope) ? `Portée indiquée par le référentiel : ${str(r.scope)}` : '',
      measureRefs: [],
    };
  });
  const source = str(f.source);
  const [organisation = '', ...reste] = source.split(' — ');
  return {
    notes: [
      'Repris : exigences, objectifs (intitulés) et portée. Non repris : correspondances, auto-évaluations et commentaires, qui sont des données de périmètre.',
    ],
    definition: {
      name: str(f.name) || id,
      identifier: id
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .slice(0, 100),
      source: {
        organisation: organisation.slice(0, 120) || NON_RENSEIGNE,
        document: (reste.join(' — ') || source || NON_RENSEIGNE).slice(0, 300),
        url: 'https://cyber.gouv.fr/',
        version: str(f.version) || NON_RENSEIGNE,
        date: '',
        license: NON_RENSEIGNE,
        verifiedAt: '',
        normative: false,
        status: 'unverified',
      },
      domains: [...domains].map(([k, label]) => ({ id: k, label })),
      requirements,
    },
  };
}

/** Candidats importables depuis l'état de l'outil de suivi ; vide si l'état ne contient aucun référentiel. */
export function trackerCandidates(data: Json): TrackerCandidate[] {
  return [iso(data), hds(data), ...arr(data.frameworks).map(liste)].filter((c): c is TrackerCandidate => !!c);
}
