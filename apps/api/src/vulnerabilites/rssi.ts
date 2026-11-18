/* Module Vulnérabilités (ADR 0100, lots V6b et S1) : rôle « RSSI » de la plateforme (ROLE_PRISE_EN_COMPTE_ALERTE, identifiant
   `rssi`), tenu directement ou par un groupe, sans portée par modules qui écarterait le module. Lu à chaque appel : un
   retrait du rôle vaut aussitôt. Seul ce rôle prend une alerte en compte (décision B du 18/11/2026) et accorde, prolonge ou
   lève une exception (lot S1, option la plus prudente, à confirmer par le RSSI). Aucun droit ne s'y substitue : ni
   vulnerabilites:modifier, ni vulnerabilites:administrer, ni le rôle Administrateur. */
import { ROLE_PRISE_EN_COMPTE_ALERTE } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client, Db } from '../db/db.js';
import { loadGrants } from '../rights.js';

export async function tientLeRoleRssi(db: Db, user: SessionUser, c?: Client): Promise<boolean> {
  return (await loadGrants(c ?? db.pool, user.id)).some(
    (g) => g.roleId === ROLE_PRISE_EN_COMPTE_ALERTE && (g.modules == null || g.modules.includes('vulnerabilites')),
  );
}
