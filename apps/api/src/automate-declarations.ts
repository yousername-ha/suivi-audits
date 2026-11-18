/* Rappels des déclarations réglementaires des incidents (ADR 0105, décision 5), appelés par l'automate de rappels du serveur
   (passage toutes les 60 secondes). Indépendants du module des écarts, dont l'absence arrête le reste de l'automate : ils
   ne dépendent que de l'activation du module incidents. Renvoie le nombre de notifications créées. */
import type { Services } from './services.js';

export async function rappelsDeclarationsIncidents(
  svc: Pick<Services, 'modules' | 'historique'>,
  maintenant = new Date(),
): Promise<number> {
  return svc.modules.run(true, async () => {
    if ((await svc.modules.state()).disabled.includes('incidents')) return 0;
    return svc.historique.declarations.rappels(maintenant);
  });
}
