/* Bandeau non fermable pour les administrateurs tant que le poivre des mots de passe n'est pas défini (ADR 0072). */
import { Anchor } from '@mantine/core';
import { Link } from 'react-router';
import { useCan } from '../session';
import { useEtatPoivre } from './Poivre';

export function PoivreNotice() {
  const peutAdministrer = useCan()('administration', 'administrer');
  const q = useEtatPoivre(peutAdministrer);
  if (!peutAdministrer || !q.data || q.data.defini) return null;
  return (
    <div className="update-notice" role="alert" data-poivre-requis>
      <span>
        Le poivre des mots de passe n’est pas défini : <b>définissez-le</b> et enregistrez-le au coffre-fort.
      </span>
      <Anchor size="xs" component={Link} to="/systeme/securite">
        Définir le poivre des mots de passe
      </Anchor>
    </div>
  );
}
