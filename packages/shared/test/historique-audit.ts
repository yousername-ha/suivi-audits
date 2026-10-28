/* Bac à sable des tests de parité du module Audit (AUD-05) : extrait de l'outil historique (extrait figé)
   le pronostic (`analyze`, `analysisAll`), le pire pronostic d'un créneau (`worst`), la couverture du plan
   (`coverage`) et les écarts d'un créneau (`slotFindings`), avec leurs dépendances minimales (`LV`, `typeLabel`), et
   les exécute dans un contexte node:vm isolé sur un état S fourni par le test. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const INDEX = readFileSync(path.join(RACINE, 'packages/shared/test/reference/index-historique-extrait.txt'), 'utf8');

/** Extrait un fragment de l'outil historique, de son en-tête jusqu'au marqueur de fin (exclu). */
function extraire(debut: string, fin: string): string {
  const i = INDEX.indexOf(debut);
  const j = INDEX.indexOf(fin, i + debut.length);
  if (i < 0 || j < 0) throw new Error(`fragment introuvable dans l'extrait historique : ${debut}`);
  if (INDEX.indexOf(debut, i + 1) >= 0) throw new Error(`fragment ambigu dans l'extrait historique : ${debut}`);
  return INDEX.slice(i, j);
}

/** Code historique extrait, tel quel. */
export const CODE_HISTORIQUE = {
  lv: extraire('const LV={', '\n'),
  typeLabel: extraire('const typeLabel=', '\n'),
  analyze: extraire('function analyze(it){', '\nfunction analysisAll('),
  analysisAll: extraire('function analysisAll(){', '\n'),
  slotFindings: extraire('const slotFindings=', '\n'),
  worst: extraire('function worst(s,AN){', '\n'),
  coverage: extraire('function coverage(AN){', '\n'),
};

/** Remplacement appliqué au code historique avant exécution (tests de mutation). */
export interface Mutation {
  avant: string;
  apres: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Historique {
  analyze(it: any): any;
  analysisAll(): Record<string, any>;
  worst(s: any, AN: Record<string, any>): string | null;
  coverage(AN: Record<string, any>): { placed: Set<string>; targets: any[]; miss: any[] };
  slotFindings(s: any): any[];
  LV: Record<string, { l: string; o: number }>;
}

/** Nouvelle instance du code historique sur l'état `S` (copié : le code historique ne le modifie pas). */
export function historique(S: unknown, mutations: Mutation[] = []): Historique {
  let code = Object.values(CODE_HISTORIQUE).join('\n');
  for (const m of mutations) {
    const n = code.split(m.avant).length - 1;
    if (n !== 1) throw new Error(`mutation « ${m.avant} » : ${n} occurrence(s) au lieu d'une`);
    code = code.replace(m.avant, m.apres);
  }
  const ctx: Record<string, any> = { S: JSON.parse(JSON.stringify(S)) };
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__audit={analyze,analysisAll,worst,coverage,slotFindings,LV};`, ctx, {
    filename: 'index-historique-extrait.txt',
  });
  return ctx.__audit as Historique;
}
