/* Bac à sable des tests de parité : exécute le module bêta de l'outil historique
   (docs/cartographie/reference-beta-legacy/carto.js) et les fonctions d'indicateurs de l'extrait historique figé
   dans un contexte isolé, avec un état S fourni par le test. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const CARTO = readFileSync(path.join(RACINE, 'docs/cartographie/reference-beta-legacy/carto.js'), 'utf8');
const INDEX = readFileSync(path.join(RACINE, 'packages/shared/test/reference/index-historique-extrait.txt'), 'utf8');

/** Extrait une fonction de l'outil historique par son en-tête, jusqu'à la déclaration suivante. */
function extraire(debut: string, fin: string): string {
  const i = INDEX.indexOf(debut);
  const j = INDEX.indexOf(fin, i + debut.length);
  if (i < 0 || j < 0) throw new Error(`fonction introuvable dans l'extrait historique : ${debut}`);
  return INDEX.slice(i, j);
}
const AIDES = [
  extraire('function indCalc(ind){', '\nfunction isRate('),
  extraire('function indState(ind){', '\nconst IST='),
  extraire('function swotLatest(proc){', '\n'),
  extraire('const parseD=', '\n'),
  extraire('const dFr=', '\n'),
].join('\n');

const EXPORTS = [
  'MB',
  'mbObjects',
  'mbRelations',
  'mbLayoutContext',
  'mbLayoutProcess',
  'mbProcessGenEdges',
  'mbAnch',
  'mbPath',
  'mbBBox',
  'mbSyncInfo',
  'mbPlace',
  'mbScene',
  'mbHash',
  'mbDefSize',
  'mbIssueKindAuto',
  'mbGenerate',
  'mbMapOnly',
  'mbIsCont',
  'mbPresetMatch',
  'mbWork',
  'mbAct',
];

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Beta = Record<string, any> & { S: any; ui: any };

/** Nouvelle instance de la bêta sur l'état `S` (organisation « Organisation fictive »). */
export function beta(S: unknown, org = 'Organisation fictive'): Beta {
  const ctx: Record<string, any> = {
    S,
    ui: {},
    RO: false,
    brand: () => ({ org }),
    esc: (s: unknown) => String(s ?? ''),
    clone: (x: unknown) => JSON.parse(JSON.stringify(x)),
    toast: () => {},
    askModal: async () => true,
    render: () => {},
    saveUI: () => {},
    touch: () => {},
    nowTs: () => '2026-10-08T00:00:00.000Z',
    todayFr: () => '08/10/2026',
    $: () => null,
    ICONS: { carto: '' },
    window: { __mbBound: 1, addEventListener: () => {} },
    document: { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(`${AIDES}\n${CARTO}\n;globalThis.__mb={${EXPORTS.join(',')}};`, ctx, {
    filename: 'carto.js',
  });
  const b = ctx.__mb as Beta;
  return Object.assign(b, {
    get S() {
      return ctx.S;
    },
    get ui() {
      return ctx.ui;
    },
  }) as Beta;
}

/** Objet de la bêta normalisé pour la comparaison (sans `data`, ensemble → tableau, indicateurs 1 → vrai). */
export function normaliserObjet(o: any): any {
  const { data: _data, ...r } = o;
  if (r.procs instanceof Set || (r.procs && typeof r.procs.values === 'function' && !Array.isArray(r.procs)))
    r.procs = [...r.procs];
  return JSON.parse(JSON.stringify(r));
}
export function normaliserRelation(e: any): any {
  const { der: _der, sec, ...r } = e;
  return { ...r, der: true, ...(sec ? { sec: true } : {}) };
}
