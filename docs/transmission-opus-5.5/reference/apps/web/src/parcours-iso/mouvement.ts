/* Réglage des animations du parcours : « Animées » force les effets, « Automatiques » suit le réglage de mouvement réduit du
   système, « Arrêtées » les supprime. Les animations sont décoratives : elles ne transmettent aucun état métier. Un onglet
   masqué met les animations en pause. */
import { useEffect, useState } from 'react';

export type Mouvement = 'animees' | 'automatique' | 'arretees';
export const MOUVEMENTS: { value: Mouvement; label: string }[] = [
  { value: 'animees', label: 'Animées' },
  { value: 'automatique', label: 'Automatiques (selon le système)' },
  { value: 'arretees', label: 'Arrêtées' },
];
/** Vrai tant que l'onglet est visible. */
export function useOngletVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const maj = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', maj);
    return () => document.removeEventListener('visibilitychange', maj);
  }, []);
  return visible;
}
