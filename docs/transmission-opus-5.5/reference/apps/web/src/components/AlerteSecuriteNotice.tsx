/* Alertes de sécurité adressées aux administrateurs (verrouillage de compte, ADR 0074) : bandeau tant que l'alerte n'est pas
   marquée comme lue. Le courriel part en parallèle ; ce bandeau existe aussi quand le courriel n'est pas configuré. */
import { Anchor, Button } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, get } from '../api';
import { useCan } from '../session';

export interface AlerteSecurite {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}
export const CLE_ALERTES_SECURITE = ['alertes-securite'] as const;

export function AlerteSecuriteNotice() {
  const qc = useQueryClient();
  const peutAdministrer = useCan()('administration', 'administrer');
  const q = useQuery({
    queryKey: CLE_ALERTES_SECURITE,
    queryFn: () => get<AlerteSecurite[]>('/api/account/alertes-securite'),
    enabled: peutAdministrer,
    refetchInterval: 60_000,
  });
  if (!peutAdministrer || !q.data?.length) return null;
  return (
    <>
      {q.data.map((a) => (
        <div className="update-notice" role="alert" data-alerte-securite key={a.id}>
          <span>
            <b>{a.title}</b> — {a.message}
          </span>
          <Anchor size="xs" component={Link} to="/admin/audit">
            Journal d’audit
          </Anchor>
          <Button
            size="compact-xs"
            variant="default"
            onClick={async () => {
              try {
                await api('PUT', `/api/account/alertes-securite/${a.id}/read`);
              } finally {
                await qc.invalidateQueries({ queryKey: CLE_ALERTES_SECURITE });
              }
            }}
          >
            Marquer comme lue
          </Button>
        </div>
      ))}
    </>
  );
}
