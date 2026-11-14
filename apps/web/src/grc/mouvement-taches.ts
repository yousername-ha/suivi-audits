/* Animation des tâches « à faire » (refonte Neon, lot 6) : pause choisie par la personne, mémorisée dans ce navigateur
   seulement (confort d'affichage, aucune donnée métier), et pause automatique quand l'onglet est masqué. La préférence
   système « réduire les animations », l'impression et les couleurs forcées sont appliquées par neon-taches.css. */
import { useCallback, useState } from 'react';
import { useOngletVisible } from '../parcours-iso/mouvement';

const CLE = 'taches-mouvement';

function lirePause(): boolean {
  try {
    return localStorage.getItem(CLE) === 'pause';
  } catch {
    return false;
  }
}
function ecrirePause(pause: boolean) {
  try {
    localStorage.setItem(CLE, pause ? 'pause' : 'anime');
  } catch {
    // Stockage indisponible (navigation privée, données bloquées) : le choix vaut pour la page ouverte.
  }
}

/** `pause` : choix de la personne ; `arrete` : pause choisie ou onglet masqué (valeur de data-mouvement). */
export function useMouvementTaches() {
  const [pause, setPause] = useState(lirePause);
  const visible = useOngletVisible();
  const basculer = useCallback(() => {
    setPause((p) => {
      ecrirePause(!p);
      return !p;
    });
  }, []);
  return { pause, arrete: pause || !visible, basculer };
}
