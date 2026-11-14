/* Bandeau rouge tant qu'une cellule de crise réelle est ouverte (A.5.26, A.5.29, BUG-069) : visible sur toutes les pages
   pour les comptes qui peuvent lire les incidents, jusqu'à la clôture de la cellule. */
import { Alert, Anchor } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { get } from '../api';
import { useCan } from '../session';

interface CelluleBandeau {
  id: string;
  title: string;
  mode: string;
  status: string;
  smsi?: string;
}
interface VueBandeau {
  etat: { cells: CelluleBandeau[] };
}

export function BandeauCrise() {
  const can = useCan();
  const autorise = can('incidents', 'lire');
  const q = useQuery({
    queryKey: ['crise', 'bandeau'],
    queryFn: () => get<VueBandeau>('/api/crise'),
    enabled: autorise,
    refetchInterval: 60_000,
  });
  const reelles = (q.data?.etat.cells ?? []).filter((c) => c.mode === 'Réel' && c.status === 'Active');
  if (!autorise || !reelles.length) return null;
  const premiere = reelles[0]!;
  return (
    <Alert color="red" variant="filled" title="Crise réelle en cours" role="alert">
      {reelles.length > 1 ? `${reelles.length} cellules de crise réelles sont ouvertes. ` : `« ${premiere.title} ». `}
      <Anchor
        component={Link}
        to={`/pilotage/crise-cellule${premiere.smsi ? `?perimetre=${premiere.smsi}` : ''}`}
        c="inherit"
        underline="always"
      >
        Ouvrir la cellule de crise
      </Anchor>
    </Alert>
  );
}
