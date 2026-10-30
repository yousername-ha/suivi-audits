/* Filtres de liste conservés dans l'adresse (R06) : le chemin de retour d'une page d'origine contient ses filtres, qu'on
   retrouve en revenant. Le filtre n'est écrit dans l'adresse que s'il diffère de sa valeur par défaut, et le remplacement
   (pas d'empilement dans l'historique) garde le bouton « page précédente » utile. */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** Paramètres de `recherche` avec le filtre `cle` à `v` (retiré s'il vaut sa valeur par défaut ou s'il est vide). */
export function avecFiltre(recherche: string, cle: string, v: string, defaut: string): URLSearchParams {
  const suivant = new URLSearchParams(recherche);
  if (v === defaut || v === '') suivant.delete(cle);
  else suivant.set(cle, v);
  return suivant;
}

export function useFiltreUrl(cle: string, defaut: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const valeur = params.get(cle) ?? defaut;
  const changer = useCallback(
    // Part de l'adresse réelle, pas des paramètres du dernier rendu : le rappel de setSearchParams reçoit ceux du rendu, et
    // deux filtres changés coup sur coup avant le rendu suivant (le mois, puis une bascule) faisaient perdre le premier.
    (v: string) => setParams(() => avecFiltre(window.location.search, cle, v, defaut), { replace: true }),
    [cle, defaut, setParams],
  );
  return [valeur, changer];
}
