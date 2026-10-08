/* Objets métier et relations dérivées (CARTO-02), lus dans l'état legacy recomposé et déjà filtré selon les droits.
   Portage de mbObjects / mbRelations (carto.js) : mêmes références, mêmes règles, même ordre. */
import {
  type CartoObject,
  type DerivedRelation,
  type FrameObject,
  type IndicatorBrief,
  type IssueSource,
  type MapObject,
  type Referentiel,
  type RelationType,
  type ScopeState,
  FAMILIES,
} from './model.js';

/* ---------------------------------------------------------------- Lecture prudente de l'état legacy */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const strs = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Équivalent de `x || ''` (JavaScript) pour un champ texte. */
const str = (v: unknown): string => (v == null || v === false || v === 0 || v === '' ? '' : String(v));

/* ---------------------------------------------------------------- Fonctions de la bêta */
/** Hachage djb2 d'un libellé (référence des enjeux, sites et systèmes), identique à mbHash. */
export function mbHash(s: unknown): string {
  let h = 5381;
  for (const c of String(s)) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
/** « Oui », « x »… : vrai ; vide, « non », « no », « false », « 0 », « - » : faux. */
export const isYes = (v: unknown): boolean => !!v && !/^(non|no|false|0|-)$/i.test(String(v).trim());
/** Nature déduite d'un enjeu d'après son libellé (règle de la bêta, corrigeable : CARTO-12). */
export function issueKindAuto(label: string): 'ext' | 'int' {
  return /menace|cyber|réglement|reglement|législ|legisl|loi|climat|confiance|écosyst|ecosyst|exigences des|attentes|marché|concurren|géopolit|tutelle|ars\b|ans\b|cnil/i.test(
    label,
  )
    ? 'ext'
    : 'int';
}
/** Lignes d'un champ multiligne (puces retirées). */
export function splitLines(v: unknown): string[] {
  return (Array.isArray(v) ? v : String(v || '').split(/\n|;/))
    .map((x) =>
      String(x)
        .replace(/^[-•*\s]+/, '')
        .trim(),
    )
    .filter(Boolean);
}
/** Icône d'un processus d'après son nom. */
export function processIcon(name: unknown): string {
  const n = String(name || '').toLowerCase();
  return /infra/.test(n)
    ? 'server'
    : /support/.test(n)
      ? 'headset'
      : /projet|concevoir|développ/.test(n)
        ? 'doc'
        : /usage|déploy/.test(n)
          ? 'users'
          : /formation/.test(n)
            ? 'cap'
            : /communi/.test(n)
              ? 'chat'
              : /ressources humaines|\brh\b/.test(n)
                ? 'users'
                : /achat|conformit/.test(n)
                  ? 'cart'
                  : /amélioration/.test(n)
                    ? 'cycle'
                    : /pilot|diriger|direction/.test(n)
                      ? 'compass'
                      : 'gear';
}
/** Date AAAA-MM-JJ au format français (dFr de l'outil historique). */
export function dateFr(d: unknown): string {
  if (!d) return '';
  const [y, m, j] = String(d).split('-').map(Number);
  const x = new Date(y!, (m ?? 1) - 1, j);
  return isNaN(x.getTime()) ? '' : x.toLocaleDateString('fr-FR');
}

/* ---------------------------------------------------------------- Indicateurs (indCalc / indState de l'outil historique) */
function indicatorCalc(ind: Rec, s: Rec): { v: unknown } | null {
  const suppliers = arr(s.suppliers),
    findings = arr(s.findings);
  const saas = suppliers.filter((x) => x.saas);
  const lastY = (src: string) => Math.max(0, ...findings.filter((f) => f.source === src).map((f) => +str(f.year) || 0));
  switch (ind.calc) {
    case 'saasMfa':
      return { v: saas.length ? saas.filter((x) => x.mfa === 'Oui').length / saas.length : null };
    case 'saasSso':
      return { v: saas.length ? saas.filter((x) => x.sso === 'Oui').length / saas.length : null };
    case 'afnorNcMaj': {
      const y = lastY('AFNOR');
      return { v: findings.filter((f) => f.source === 'AFNOR' && f.type === 'NC maj' && +str(f.year) === y).length };
    }
    case 'interneNcMaj': {
      const y = lastY('Interne');
      return { v: findings.filter((f) => f.source === 'Interne' && f.type === 'NC maj' && +str(f.year) === y).length };
    }
    case 'interneNcMajOpen':
      return {
        v: findings.filter((f) => f.source === 'Interne' && f.type === 'NC maj' && f.status !== 'Clos').length,
      };
  }
  return null;
}
/** État d'un indicateur : atteint (ok), non atteint (ko), non mesuré (na), cible à définir (undef). */
export function indicatorState(ind: Rec, s: Rec): IndicatorBrief['st'] {
  const auto = ind.calc && ind.auto !== false ? indicatorCalc(ind, s) : null;
  const all = arr(ind.values)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const vals = all.filter((x) => !x.hist);
  const last = vals[vals.length - 1];
  const v = auto ? auto.v : last ? last.v : null;
  if (!ind.dir || ind.target === '' || ind.target == null) return 'undef';
  if (v != null && v !== '') {
    if (ind.dir === '=') return String(v).toLowerCase() === String(ind.target).toLowerCase() ? 'ok' : 'ko';
    if (ind.dir === '≤') return Number(v) <= Number(ind.target) ? 'ok' : 'ko';
    if (ind.dir === '≥') return Number(v) >= Number(ind.target) ? 'ok' : 'ko';
  }
  return 'na';
}
/** SWOT le plus récent d'un processus. */
export function swotLatest(s: Rec, proc: unknown): Rec | undefined {
  return arr(s.swots)
    .filter((x) => x.process === proc)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
}

/* ---------------------------------------------------------------- Objets */
export interface BuildOptions {
  /** Nom de l'organisation (Paramètres > Général). */
  org: string;
  /** Nature des enjeux corrigée à la main (carte de contexte, CARTO-12). */
  issueKind?: Record<string, 'ext' | 'int'>;
  /** Ajoute les champs de la fiche détaillée (API) ; les tests de parité s'en passent. */
  details?: boolean;
}

const ISO: Referentiel[] = ['ISO 27001'];
const BOTH: Referentiel[] = ['ISO 27001', 'HDS'];

/** Objets de la plateforme, dans l'ordre de la bêta (SMSI, périmètre, processus, parties intéressées, enjeux,
 *  fournisseurs, applications, sites, systèmes). `state` est l'état legacy déjà filtré selon les droits. */
export function buildObjects(state: unknown, opts: BuildOptions): Map<string, CartoObject> {
  const S: Rec = isRec(state) ? state : {};
  const M = new Map<string, CartoObject>();
  const add = (o: CartoObject) => {
    M.set(o.ref, o);
    return o;
  };
  const sc: Rec = isRec(S.scope) ? S.scope : {};
  const inSc = new Set(strs(sc.processes));
  const scDef = inSc.size > 0;
  const kinds = opts.issueKind ?? {};
  const processes = arr(S.processes),
    objectives = arr(S.objectives),
    indicators = arr(S.indicators);
  const det = !!opts.details;

  const isms = add({
    ref: 'isms',
    type: 'isms',
    name: 'SMSI – ' + opts.org,
    sub: 'Sécurité de l’information et continuité de service',
    std: [...BOTH],
  });
  const scope = add({
    ref: 'scope',
    type: 'scope',
    name: 'Périmètre SMSI',
    sub: sc.statement ? String(sc.statement) : 'Certification ISO 27001 / HDS',
    std: [...BOTH],
    scDef,
  });
  if (det) {
    scope.details = {
      statement: str(sc.statement),
      processes: strs(sc.processes).map(String),
      ...(Array.isArray(sc.hds) ? { hdsCount: sc.hds.length } : {}),
      ...(Array.isArray(sc.excl) && sc.excl.length ? { exclCount: sc.excl.length } : {}),
      validatedOn: str(sc.validatedOn),
      validatedBy: str(sc.validatedBy),
    };
    const counts: { label: string; value: number }[] = [];
    const count = (label: string, key: string, filter?: (x: Rec) => boolean) => {
      if (Array.isArray(S[key]))
        counts.push({ label, value: filter ? arr(S[key]).filter(filter).length : arr(S[key]).length });
    };
    count('Processus', 'processes');
    count('Parties intéressées', 'interested');
    count('Fournisseurs', 'suppliers');
    count('Écarts ouverts', 'findings', (f) => f.status !== 'Clos');
    count('Objectifs', 'objectives');
    isms.details = { counts };
  }

  const parentOf = (p: Rec) => str(p.parent) || (String(p.id).includes('.') ? String(p.id).split('.')[0]! : '');
  const objOf = (id: unknown) => objectives.filter((o) => strs(o.processes).includes(id));
  for (const p of processes) {
    const parent = parentOf(p);
    const scp: ScopeState = scDef ? (inSc.has(p.id) || (parent && inSc.has(parent)) ? 'in' : 'out') : 'unk';
    const ob = objOf(p.id);
    const ind = indicators.filter((i) => ob.some((o) => o.id === i.obj));
    const ko = ind.filter((i) => indicatorState(i, S) === 'ko').length;
    const o = add({
      ref: 'process:' + String(p.id),
      type: parent ? 'subprocess' : 'process',
      code: String(p.id),
      name: str(p.name) || String(p.id),
      owner: str(p.owner),
      family: str(p.family),
      parent: parent ? 'process:' + parent : '',
      scope: scp,
      std: scp === 'out' ? [...ISO] : [...BOTH],
      ic: processIcon(p.name),
      nObj: ob.length,
      nInd: ind.length,
      nKo: ko,
    });
    if (det) {
      const sw = swotLatest(S, p.id);
      o.details = {
        objectives: ob.map((x) => ({ id: String(x.id), name: str(x.name) })),
        indicators: ind.map((i) => ({ id: String(i.id), name: str(i.name), st: indicatorState(i, S) })),
        swot: sw
          ? {
              id: str(sw.id),
              date: str(sw.date),
              S: strs(sw.S).length,
              W: strs(sw.W).length,
              O: strs(sw.O).length,
              T: strs(sw.T).length,
            }
          : null,
        children: processes
          .filter((x) => parentOf(x) === p.id)
          .map((x) => ({ code: String(x.id), name: str(x.name) || String(x.id) })),
      };
    }
  }

  for (const p of arr(S.interested)) {
    const o = add({
      ref: 'pi:' + String(p.id),
      type: 'stakeholder',
      name: str(p.name) || 'Partie intéressée',
      sub: str(p.cat) || str(p.type),
      ext: p.type !== 'Interne',
      owner: str(p.owner),
      std: [...ISO],
    });
    if (det)
      o.details = {
        nature: str(p.type) || 'Externe',
        category: str(p.cat),
        needs: str(p.needs),
        requirements: p.req ? splitLines(p.req) : [],
        addressed: str(p.addressed),
        reviewed: str(p.reviewed),
      };
  }

  const procsOf = new Map<string, Set<string>>();
  const addIssue = (rawLabel: unknown, desc: string, kind: 'ext' | 'int', src: IssueSource, procs: unknown[]) => {
    const label = String(rawLabel || '').trim();
    if (!label) return;
    const ref = 'issue:' + mbHash(label.toLowerCase());
    let o = M.get(ref);
    if (!o) {
      const k = kinds[ref] || kind;
      o = add({
        ref,
        type: k === 'ext' ? 'external_issue' : 'internal_issue',
        name: label,
        sub: desc || '',
        src: [],
        procs: [],
        std: [...ISO],
        auto: kind,
      });
      procsOf.set(ref, new Set());
    }
    o.src!.push(src);
    const set = procsOf.get(ref)!;
    for (const p of procs) {
      const k = String(p);
      if (!set.has(k)) {
        set.add(k);
        o.procs!.push(k);
      }
    }
    if (desc && !o.sub) o.sub = desc;
  };
  for (const ob of objectives)
    for (const e of strs(ob.enjeux)) {
      const s = String(e),
        i = s.indexOf(':');
      const label = i > 0 && i < 70 ? s.slice(0, i).trim() : s,
        desc = i > 0 && i < 70 ? s.slice(i + 1).trim() : '';
      addIssue(
        label,
        desc,
        issueKindAuto(label),
        { k: 'obj', id: String(ob.id), l: String(ob.id) + ' — ' + String(ob.name) },
        strs(ob.processes),
      );
    }
  const QUADRANTS: ['S' | 'W' | 'O' | 'T', 'ext' | 'int', string][] = [
    ['S', 'int', 'Force'],
    ['W', 'int', 'Faiblesse'],
    ['O', 'ext', 'Opportunité'],
    ['T', 'ext', 'Menace'],
  ];
  for (const p of processes) {
    const s = swotLatest(S, p.id);
    if (!s) continue;
    for (const [q, kind, l] of QUADRANTS)
      for (const t of strs(s[q]))
        addIssue(
          t,
          l + ' — SWOT ' + String(p.id),
          kind,
          {
            k: 'swot',
            id: String(s.id),
            proc: String(p.id),
            q,
            l: 'SWOT ' + String(p.id) + ' (' + l.toLowerCase() + ', ' + dateFr(s.date) + ')',
          },
          [p.id],
        );
  }

  const suppliers = arr(S.suppliers),
    appGaps = arr(S.appGaps);
  const supByName = new Map(suppliers.map((s) => [str(s.name).toLowerCase(), s]));
  for (const s of suppliers) {
    const hds = isYes(s.hds),
      crit = isYes(s.critical);
    const o = add({
      ref: 'sup:' + String(s.id),
      type: 'supplier',
      name: str(s.name) || String(s.id),
      sub:
        [s.saas ? 'SaaS' : '', hds ? 'Hébergeur HDS' : '', crit ? 'Critique' : ''].filter(Boolean).join(' · ') ||
        str(s.rattachement) ||
        'Fournisseur',
      crit,
      hds,
      saas: !!s.saas,
      std: hds ? [...BOTH] : [...ISO],
      ic: s.saas ? 'cloud' : 'box',
    });
    if (det)
      o.details = {
        sso: str(s.sso),
        mfa: str(s.mfa),
        certs: strs(s.certs).map((x) =>
          typeof x === 'string' ? x : isRec(x) ? str(x.name) || str(x.t) || 'Certificat' : 'Certificat',
        ),
        apps: appGaps
          .filter((a) => str(a.supplier).toLowerCase() === str(s.name).toLowerCase())
          .map((a) => ({ id: String(a.id), name: str(a.name) || String(a.id) })),
      };
  }
  for (const a of appGaps) {
    const sp = supByName.get(str(a.supplier).toLowerCase());
    const scp: ScopeState = a.status === 'Intégrée' ? 'in' : a.status === 'Écartée' ? 'out' : 'unk';
    const o = add({
      ref: 'app:' + String(a.id),
      type: 'application',
      name: str(a.name) || String(a.id),
      sub: [a.supplier, a.status].filter(Boolean).join(' · '),
      scope: scp,
      supRef: sp ? 'sup:' + String(sp.id) : '',
      owner: str(a.owner),
      std: /oui|dscp/i.test(str(a.dscp)) ? [...BOTH] : [...ISO],
      scopeLabel: scp === 'unk' ? str(a.status) || 'À étudier' : '',
    });
    if (det)
      o.details = {
        status: str(a.status) || 'À étudier',
        supplier: str(a.supplier),
        healthData: str(a.dscp),
        hosting: str(a.cloud),
      };
  }
  for (const l of splitLines(sc.sites))
    add({
      ref: 'site:' + mbHash(l.toLowerCase()),
      type: 'site',
      name: l,
      sub: 'Site du périmètre',
      scope: 'in',
      std: [...BOTH],
    });
  for (const l of splitLines(sc.systems))
    add({
      ref: 'infra:' + mbHash(l.toLowerCase()),
      type: 'infrastructure',
      name: l,
      sub: 'Système du périmètre',
      scope: 'in',
      std: [...BOTH],
    });
  return M;
}

/* ---------------------------------------------------------------- Relations dérivées */
export const relationKey = (s: string, t: string, type: RelationType) => 'd:' + s + '>' + t + ':' + type;

/** Relations métier dérivées des données (lecture seule sur la carte), dans l'ordre de la bêta. */
export function deriveRelations(M: ReadonlyMap<string, CartoObject>): DerivedRelation[] {
  const R: DerivedRelation[] = [];
  const r = (s: string | undefined, t: string, type: RelationType, sec?: boolean) => {
    if (s && M.has(s) && M.has(t) && s !== t)
      R.push({ s, t, type, der: true, key: relationKey(s, t, type), ...(sec ? { sec: true } : {}) });
  };
  for (const o of M.values()) {
    if (o.type === 'process' && o.scope !== 'out') r(o.ref, 'isms', 'part_of');
    if (o.type === 'subprocess') r(o.parent, o.ref, 'contains');
    if ((o.type === 'application' || o.type === 'infrastructure' || o.type === 'site') && o.scope === 'in')
      r(o.ref, 'isms', 'part_of');
    if (o.type === 'stakeholder') r(o.ref, 'scope', 'interacts_with');
    if (o.type === 'supplier') r(o.ref, 'scope', 'supports');
    if (o.type === 'application' && o.supRef) r(o.ref, o.supRef, 'depends_on');
    if (o.type === 'external_issue' || o.type === 'internal_issue') {
      r(o.ref, 'scope', 'impacts');
      for (const p of o.procs ?? []) r(o.ref, 'process:' + p, 'impacts', true);
    }
  }
  return R;
}

/* ---------------------------------------------------------------- Cadres propres à la carte */
const LANE_FAMILY: Record<string, keyof typeof FAMILIES> = { pil: 'pil', rea: 'rea', sup: 'sup', oth: 'oth' };
/** Cadre propre à la carte (`lane:*`, `band:*`, `zone:out`), ou null. */
export function mapOnlyObject(ref: string): FrameObject | null {
  const [k, v] = String(ref).split(':');
  if (k === 'lane') {
    const f = FAMILIES[LANE_FAMILY[v ?? ''] ?? 'oth'];
    // Bêta : MB_LANE_FAM[v] (undefined pour une valeur inconnue) → famille « Autres ».
    return {
      ref,
      type: 'lane',
      name: f.l,
      sub: f.sub,
      fam: LANE_FAMILY[v ?? ''] ? f.family : undefined,
      mapOnly: true,
    };
  }
  if (k === 'band')
    return {
      ref,
      type: 'band',
      name: v === 'ext' ? 'Enjeux externes' : 'Enjeux internes',
      kind: v === 'ext' ? 'ext' : 'int',
      mapOnly: true,
    };
  if (k === 'zone')
    return {
      ref,
      type: 'zone',
      name: 'Hors périmètre',
      sub: 'Objets de la plateforme non inclus dans le périmètre',
      mapOnly: true,
    };
  return null;
}
/** Objet affiché pour une référence : objet de la plateforme, sinon cadre de la carte, sinon indisponible. */
export type ObjectLookup = (ref: string) => MapObject | undefined;
export const lookupIn =
  (M: ReadonlyMap<string, CartoObject>): ObjectLookup =>
  (ref) =>
    M.get(ref) ?? mapOnlyObject(ref) ?? undefined;
