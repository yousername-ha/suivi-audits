/* Contrôle des relations : les clés étrangères de la base sont garanties par PostgreSQL ; ce contrôle vérifie les
   références LOGIQUES, que la base ne peut pas garantir (références portées par du JSON ou par l'état de l'outil de suivi) :
   liens du registre commun, références des fiches, objets de l'état historique, méthodes, critères et référentiels.
   Lecture seule. Une anomalie est signalée avec son contexte, jamais corrigée automatiquement. */
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
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
  const k = svc.db.k;

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
  const objets = new Set((await k.selectFrom('grc_objects').select('id').execute()).map((r) => r.id));
  const exigences = new Map<string, Set<string>>();
  for (const v of await k
    .selectFrom('lib_framework_versions')
    .select(['framework_id', 'version', 'definition'])
    .execute())
    exigences.set(
      `${v.framework_id}:${v.version}`,
      new Set(((v.definition as { requirements?: { id: string }[] }).requirements ?? []).map((r) => r.id)),
    );
  const documents = new Set(
    (await k.selectFrom('document_versions').select(['document_id', 'version']).execute()).map(
      (r) => `${r.document_id}:${r.version}`,
    ),
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
  for (const l of await k.selectFrom('grc_links').select(['source_ref', 'target_ref', 'type']).execute())
    for (const r of [l.source_ref, l.target_ref]) {
      refs.verifie();
      if (!resolue(r)) refs.anomalie(`lien ${l.type} : référence introuvable ${r}`);
    }
  // Chemins jsonb fixes : références portées par les fiches.
  for (const o of await k
    .selectFrom('grc_objects')
    .select(['id', 'kind', sql<unknown[]>`data->'refs'`.as('refs')])
    .where(sql<string>`jsonb_typeof(data->'refs')`, '=', 'array')
    .execute())
    for (const r of o.refs) {
      refs.verifie();
      if (typeof r === 'string' && !resolue(r)) refs.anomalie(`${o.kind} ${o.id} : référence introuvable ${r}`);
    }

  // 3) Risques, méthodes, référentiels et fournisseurs.
  const risques = nouveau('Risques, référentiels et fournisseurs');
  for (const e of await k.selectFrom('grc_risk_evaluations').select(['risk_id', 'method_version_id']).execute()) {
    risques.verifie();
    if (!objets.has(e.risk_id)) risques.anomalie(`appréciation : risque introuvable ${e.risk_id}`);
    const m = await k
      .selectFrom('grc_method_versions')
      .select('id')
      .where('id', '=', e.method_version_id)
      .executeTakeFirst();
    if (!m) risques.anomalie(`appréciation du risque ${e.risk_id} : version de méthode introuvable`);
  }
  for (const a of await k.selectFrom('grc_scope_frameworks').select(['smsi_id', 'framework_id', 'version']).execute()) {
    risques.verifie();
    if (!exigences.has(`${a.framework_id}:${a.version}`))
      risques.anomalie(`périmètre ${a.smsi_id} : version rattachée introuvable (${a.framework_id} v${a.version})`);
  }
  for (const crit of await k.selectFrom('sup_criteria').select(['id', 'requirement_refs']).execute())
    for (const r of crit.requirement_refs) {
      risques.verifie();
      if (!resolue(r)) risques.anomalie(`critère fournisseur ${crit.id} : exigence introuvable ${r}`);
    }
  const fournisseurs = ids(state.suppliers);
  for (const l of await k.selectFrom('sup_scope_links').select(['smsi_id', 'supplier_id']).execute()) {
    risques.verifie();
    if (!fournisseurs.has(l.supplier_id))
      risques.anomalie(`rattachement au périmètre ${l.smsi_id} : fournisseur absent du registre ${l.supplier_id}`);
  }
  for (const e of await k.selectFrom('sup_evaluations').select(['id', 'supplier_id']).execute()) {
    risques.verifie();
    // Une évaluation survit au retrait d'un fournisseur (son nom est figé) : signalé, pas bloquant.
    if (!fournisseurs.has(e.supplier_id))
      risques.anomalie(`évaluation ${e.id} : fournisseur ${e.supplier_id} absent du registre (évaluation conservée)`);
  }
  return { ok: controles.every((c) => c.anomalies.length === 0), controles };
}
