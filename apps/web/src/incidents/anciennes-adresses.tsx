/* Anciennes adresses du menu Résilience (ADR 0091) : « Qualifier un signalement » et « RETEX et chronologie » sont
   désormais des onglets de la fiche de l'incident, dans le registre. Les signets et liens existants y mènent. */
import { Navigate, useLocation } from 'react-router';

export const ADRESSE_REGISTRE_INCIDENTS = '/pilotage/incidents-registre';

/** `/pilotage/incidents-retex?incident=X&vue=Y` devient `…incidents-registre?incident=X&onglet=retex&vue=Y`. */
export function adresseRegistreDepuisRetex(search: string): string {
  const ancien = new URLSearchParams(search);
  const incident = ancien.get('incident');
  if (!incident) return ADRESSE_REGISTRE_INCIDENTS;
  const nouveau = new URLSearchParams({ incident, onglet: 'retex' });
  const vue = ancien.get('vue');
  if (vue) nouveau.set('vue', vue);
  return `${ADRESSE_REGISTRE_INCIDENTS}?${nouveau.toString()}`;
}

export function RedirectionRetex() {
  const { search } = useLocation();
  return <Navigate to={adresseRegistreDepuisRetex(search)} replace />;
}
export function RedirectionQualifier() {
  return <Navigate to={ADRESSE_REGISTRE_INCIDENTS} replace />;
}
