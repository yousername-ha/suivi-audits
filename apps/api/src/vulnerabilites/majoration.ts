/* Module Vulnérabilités (ADR 0100, lot ALH5 ; décision B du RSSI du 17/11/2026) : une faille exposée qui mène à une machine
   interne vulnérable monte en priorité. Ce module dit quels actifs exposés y mènent ; la règle elle-même (un cran de plus,
   P1 plafonné) est dans la grille partagée (majorerPriorite, packages/shared/src/priorite-vulnerabilites.ts).
   - Machine interne « vulnérable » : au moins une faille présente chez elle en P1 ou en P2 (machineVulnerable) : constat de
     Tenable présent sur la machine (présence « détectée »), ou faille déclarée par un produit surveillé relié à la machine
     et non détectée par Tenable sur elle (présence « déclarée »). Une faille close (corrigée, risque accepté, non concernée)
     ne compte pas, comme pour le rang des machines.
   - Seule une liaison CONFIRMÉE (lot ALH3) compte ; jamais une proposition.
   - Décision A : tout est calculé sur tous les faits connus, sans tenir compte des droits de lecture de la personne ; le
     résultat est le même pour tout le monde et ne nomme rien (identifiants internes seulement, jamais rendus tels quels).
   - Pas de cycle : la priorité des failles d'une machine n'est jamais majorée ; seules l'alerte, la technologie et ses CVE
     sur la surface externe le sont. */
import { machineVulnerable, type ReglagePriorite } from '@suivi/shared';
import { sql } from 'kysely';
import type { Kdb } from '../db/db.js';
import { faillesDesMachines } from './failles.js';

/** Machines vulnérables parmi celles demandées (identifiants internes). */
export async function machinesVulnerables(
  k: Kdb,
  reglage: ReglagePriorite,
  machines: readonly string[],
): Promise<Set<string>> {
  const parMachine = await faillesDesMachines(k, reglage, machines);
  return new Set([...parMachine].filter(([, ps]) => machineVulnerable(ps)).map(([id]) => id));
}

/** Actifs exposés (identifiants internes) reliés, par une liaison confirmée, à au moins une machine interne vulnérable. */
export async function actifsMenantAUneMachineVulnerable(k: Kdb, reglage: ReglagePriorite): Promise<Set<string>> {
  const { rows } = await sql<{ actif_id: string; machine_id: string }>`
    SELECT actif_id, machine_id FROM vulnerabilites_alh_liaisons_machines WHERE statut = 'confirmee'`.execute(k);
  if (!rows.length) return new Set();
  const vulnerables = await machinesVulnerables(
    k,
    reglage,
    rows.map((r) => r.machine_id),
  );
  return new Set(rows.filter((r) => vulnerables.has(r.machine_id)).map((r) => r.actif_id));
}
