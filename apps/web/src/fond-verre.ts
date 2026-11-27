/* Essai du fond « bleu nuit » de la refonte Verre (demande du RSSI du 27/11/2026, branche refonte-verre) : un bouton de
   l'en-tête bascule entre le fond actuel et le fond bleu sur toute la plateforme, pour comparer. Le choix est une
   commodité d'affichage propre au navigateur (stockage local), pas un réglage de l'instance ; il ne vaut qu'avec le style
   « Verre » en mode sombre (packages/ui/src/verre.css, attribut data-fond de <html>). */
import { useCallback, useEffect, useState } from 'react';

export type FondVerre = 'actuel' | 'bleu';

const CLE = 'suivi.verre.fond';

export function lireFond(stockage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): FondVerre {
  try {
    return stockage?.getItem(CLE) === 'bleu' ? 'bleu' : 'actuel';
  } catch {
    return 'actuel';
  }
}

export function ecrireFond(fond: FondVerre, stockage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE, fond);
  } catch {
    /* Navigation privée ou stockage bloqué : le choix vaut pour la page ouverte seulement. */
  }
}

export function appliquerFond(html: HTMLElement, fond: FondVerre) {
  if (fond === 'bleu') html.dataset.fond = 'bleu';
  else delete html.dataset.fond;
}

export const fondSuivant = (fond: FondVerre): FondVerre => (fond === 'bleu' ? 'actuel' : 'bleu');

/** Fond choisi et bascule ; l'attribut de <html> suit le choix. */
export function useFondVerre(): [FondVerre, () => void] {
  const [fond, setFond] = useState<FondVerre>(() => lireFond());
  useEffect(() => appliquerFond(document.documentElement, fond), [fond]);
  const basculer = useCallback(
    () =>
      setFond((actuel) => {
        const suivant = fondSuivant(actuel);
        ecrireFond(suivant);
        return suivant;
      }),
    [],
  );
  return [fond, basculer];
}
