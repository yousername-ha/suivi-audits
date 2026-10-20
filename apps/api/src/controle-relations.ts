/* Contrôle des relations : les clés étrangères de la base sont garanties par PostgreSQL ; ce contrôle vérifie les
   références LOGIQUES, que la base ne peut pas garantir (références portées par du JSON ou par l'état de l'outil de suivi) :
   liens du registre commun, références des fiches, objets de l'état historique, méthodes, critères et référentiels.
   Lecture seule. Une anomalie est signalée avec son contexte, jamais corrigée automatiquement. */
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { Services } from './services.js';

export interface ControleRelations {
  ok: boolean;
  controles: { nom: string; verifies: number; anomalies: string[] }[];
}
const MAX = 50;
const lignes = (v: unknown): JsonObject[] => (Array.isArray(v) ? v.filter(isObject) : []);
const ids = (v: unknown) => new Set(lignes(v).map((r) => String(r.id)));

export async function controleRelations(svc: Services): Promise<ControleRelations> {
  const controles: ControleRelations['controles'] = [];
  const nouveau = (nom: string) => {
    const c = { nom, verifies: 0, anomalies: [] as string[] };
    controles.push(c);
    return {
      verifie: () => void c.verifies++,
      anomalie: (m: string) => c.anomalies.length < MAX && c.anomalies.push(m),
    };
  };
  const state = (await svc.legacy.recompose())?.data ?? {};

  // 1) Références internes de l'état de l'outil de suivi.
  const etat = nouveau('État de l’outil de suivi : références entre objets');
  const processus = ids(state.processes),
    objectifs = ids(state.objectives);
  for (const [cle, nom] of [
    ['processes', 'processus'],
    ['objectives', 'objectif'],
    ['indicators', 'indicateur'],
    ['suppliers', 'fournisseur'],
  ] as const) {
    const vus = new Set<string>();
    for (const r of lignes(state[cle])) {
      etat.verifie();
      const id = String(r.id ?? '');
      if (!id) etat.anomalie(`${nom} sans identifiant`);
      else if (vus.has(id)) etat.anomalie(`${nom} : identifiant en double ${id}`);
      vus.add(id);
    }
  }
  for (const o of lignes(state.objectives))
    for (const p of Array.isArray(o.processes) ? o.processes : []) {
      etat.verifie();
      if (!processus.has(String(p))) etat.anomalie(`objectif ${String(o.id)} : processus inconnu ${String(p)}`);
    }
  for (const i of lignes(state.indicators)) {
    etat.verifie();
    if (!objectifs.has(String(i.obj))) etat.anomalie(`indicateur ${String(i.id)} : objectif inconnu ${String(i.obj)}`);
    for (const p of Array.isArray(i.processes) ? i.processes : []) {
      etat.verifie();
      if (!processus.has(String(p))) etat.anomalie(`indicateur ${String(i.id)} : processus inconnu ${String(p)}`);
    }
  }
  for (const s of lignes(state.swots)) {
    etat.verifie();
    if (s.process && !processus.has(String(s.process)))
      etat.anomalie(`SWOT ${String(s.id)} : processus inconnu ${String(s.process)}`);
  }

  // 2) Références du registre commun (liens et fiches) vers leurs cibles.
  const refs = nouveau('Registre commun : liens et références des fiches');
  const objets = new Set((await svc.db.q<{ id: string }>('SELECT id FROM grc_objects')).rows.map((r) => r.id));
  const exigences = new Map<string, Set<string>>();
  for (const v of (
    await svc.db.q<{ framework_id: string; version: number; definition: { requirements?: { id: string }[] } }>(
      'SELECT framework_id,version,definition FROM lib_framework_versions',
    )
  ).rows)
    exigences.set(`${v.framework_id}:${v.version}`, new Set((v.definition.requirements ?? []).map((r) => r.id)));
  const documents = new Set(
    (
      await svc.db.q<{ document_id: string; version: number }>('SELECT document_id,version FROM document_versions')
    ).rows.map((r) => `${r.document_id}:${r.version}`),
  );
  const resolue = (ref: string): boolean => {
    const [type, a, b, ...reste] = ref.split(':');
    if (type === 'object') return objets.has(String(a));
    if (type === 'legacy') {
      const cle = String(a);
      const id = [b, ...reste].join(':');
      if (cle === 'scope') return isObject(state.scope);
      if (cle === 'dda') return lignes(state.items).some((i) => i.id === id);
      return lignes(state[cle]).some((r) => String(r.id) === id) || /^@\d+$/.test(id);
    }
    if (type === 'requirement') return exigences.get(`${a}:${b}`)?.has(reste.join(':')) ?? false;
    if (type === 'document') return documents.has(`${a}:${b}`);
    return true; // forme inconnue : non contrôlée ici
  };
  for (const l of (
    await svc.db.q<{ source_ref: string; target_ref: string; type: string }>(
      'SELECT source_ref,target_ref,type FROM grc_links',
    )
  ).rows)
    for (const r of [l.source_ref, l.target_ref]) {
      refs.verifie();
      if (!resolue(r)) refs.anomalie(`lien ${l.type} : référence introuvable ${r}`);
    }
  for (const o of (
    await svc.db.q<{ id: string; kind: string; refs: unknown }>(
      `SELECT id,kind,data->'refs' AS refs FROM grc_objects WHERE jsonb_typeof(data->'refs')='array'`,
    )
  ).rows)
    for (const r of o.refs as unknown[]) {
      refs.verifie();
      if (typeof r === 'string' && !resolue(r)) refs.anomalie(`${o.kind} ${o.id} : référence introuvable ${r}`);
    }

  // 3) Risques, méthodes, référentiels et fournisseurs.
  const risques = nouveau('Risques, référentiels et fournisseurs');
  for (const e of (
    await svc.db.q<{ risk_id: string; method_version_id: string }>(
      `SELECT e.risk_id,e.method_version_id FROM grc_risk_evaluations e`,
    )
  ).rows) {
    risques.verifie();
    if (!objets.has(e.risk_id)) risques.anomalie(`appréciation : risque introuvable ${e.risk_id}`);
    const m = await svc.db.one('SELECT 1 FROM grc_method_versions WHERE id=$1', [e.method_version_id]);
    if (!m) risques.anomalie(`appréciation du risque ${e.risk_id} : version de méthode introuvable`);
  }
  for (const a of (
    await svc.db.q<{ smsi_id: string; framework_id: string; version: number }>(
      'SELECT smsi_id,framework_id,version FROM grc_scope_frameworks',
    )
  ).rows) {
    risques.verifie();
    if (!exigences.has(`${a.framework_id}:${a.version}`))
      risques.anomalie(`périmètre ${a.smsi_id} : version rattachée introuvable (${a.framework_id} v${a.version})`);
  }
  for (const k of (
    await svc.db.q<{ id: string; requirement_refs: string[] }>('SELECT id,requirement_refs FROM sup_criteria')
  ).rows)
    for (const r of k.requirement_refs) {
      risques.verifie();
      if (!resolue(r)) risques.anomalie(`critère fournisseur ${k.id} : exigence introuvable ${r}`);
    }
  const fournisseurs = ids(state.suppliers);
  for (const l of (
    await svc.db.q<{ smsi_id: string; supplier_id: string }>('SELECT smsi_id,supplier_id FROM sup_scope_links')
  ).rows) {
    risques.verifie();
    if (!fournisseurs.has(l.supplier_id))
      risques.anomalie(`rattachement au périmètre ${l.smsi_id} : fournisseur absent du registre ${l.supplier_id}`);
  }
  for (const e of (await svc.db.q<{ id: string; supplier_id: string }>('SELECT id,supplier_id FROM sup_evaluations'))
    .rows) {
    risques.verifie();
    // Une évaluation survit au retrait d'un fournisseur (son nom est figé) : signalé, pas bloquant.
    if (!fournisseurs.has(e.supplier_id))
      risques.anomalie(`évaluation ${e.id} : fournisseur ${e.supplier_id} absent du registre (évaluation conservée)`);
  }
  return { ok: controles.every((c) => c.anomalies.length === 0), controles };
}
