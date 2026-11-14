/* Marque de l'en-tête et de la tête du menu (refonte Neon, ADR 0093) : le logo de l'organisation déposé dans Plateforme >
   Général (route publique GET /api/settings/logo), sinon la pastille « S » de l'application. Sans logo de l'organisation,
   la route sert le logo par défaut (en-tête `X-Logo: defaut`, jamais 404) : la pastille, même dessin, est alors gardée.
   Décorative : le lien qui la contient porte le nom de l'application. */
import { useQuery } from '@tanstack/react-query';

export const CLE_LOGO_ORGANISATION = ['logo-organisation'] as const;
const ADRESSE_LOGO = '/api/settings/logo';

/** Horodatage du logo présent (pour recharger l'image après un changement), ou null s'il n'y en a pas. */
async function logoPresent(): Promise<number | null> {
  try {
    const r = await fetch(ADRESSE_LOGO, { method: 'HEAD', credentials: 'same-origin' });
    return r.ok && r.headers.get('X-Logo') !== 'defaut' ? Date.now() : null;
  } catch {
    return null;
  }
}

export function MarqueOrganisation() {
  const logo = useQuery({ queryKey: CLE_LOGO_ORGANISATION, queryFn: logoPresent, staleTime: 5 * 60_000 });
  if (logo.data)
    return (
      <span className="brand-mark brand-mark--logo" aria-hidden="true">
        <img src={`${ADRESSE_LOGO}?v=${logo.data}`} alt="" />
      </span>
    );
  return (
    <span className="brand-mark" aria-hidden="true">
      S
    </span>
  );
}
