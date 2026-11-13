/* Rapprochements à valider : compteur partagé par la pastille du menu et le bandeau de la synthèse du Pilotage
   (ADR 0031, lot M3). Le périmètre lu est celui que le Pilotage affiche (même clé de session que la page Pilotage). */
import { Badge, Group } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { useCan } from '../session';

const PERIMETRE_COMMUN = '00000000-0000-4000-8000-000000000001';
function perimetreAffiche(): string {
  try {
    return sessionStorage.getItem('pilotage-scope') || PERIMETRE_COMMUN;
  } catch {
    return PERIMETRE_COMMUN;
  }
}
/** Nombre de rapprochements en attente dans le périmètre (0 sans le droit de lecture de la conformité). */
export function useRapprochementsEnAttente(smsi?: string): number {
  const can = useCan(),
    id = smsi ?? perimetreAffiche();
  const q = useQuery({
    queryKey: ['grc', id, 'rapprochements', 'summary'],
    queryFn: () => get<{ pending: number }>(`/api/grc/${id}/rapprochements/summary`),
    enabled: can('conformite', 'lire'),
    refetchInterval: 60_000,
    retry: false,
  });
  return q.data?.pending ?? 0;
}
/** Pastille du menu : le nombre de rapprochements en attente, absente quand il n'y en a aucun. */
function PastilleRapprochements() {
  const n = useRapprochementsEnAttente();
  if (!n) return null;
  return (
    <Badge size="sm" variant="white" color="suivi" aria-label={`${n} rapprochement(s) à valider`}>
      {n}
    </Badge>
  );
}
/** Libellé de menu suivi de la pastille ; sans proposition en attente, le libellé seul (aucun changement de la mise en page). */
export function LibelleAvecPastille({ libelle }: { libelle: string }) {
  const n = useRapprochementsEnAttente();
  if (!n) return <>{libelle}</>;
  return (
    <Group component="span" gap="xs" wrap="nowrap">
      {libelle}
      <PastilleRapprochements />
    </Group>
  );
}
