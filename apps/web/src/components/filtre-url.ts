/* Filtres de liste conservés dans l'adresse (R06) : le chemin de retour d'une page d'origine contient ses filtres, qu'on
   retrouve en revenant. Le filtre n'est écrit dans l'adresse que s'il diffère de sa valeur par défaut, et le remplacement
   (pas d'empilement dans l'historique) garde le bouton « page précédente » utile. */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export function useFiltreUrl(cle: string, defaut: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const valeur = params.get(cle) ?? defaut;
  const changer = useCallback(
    (v: string) =>
      setParams(
        (p) => {
          const suivant = new URLSearchParams(p);
          if (v === defaut || v === '') suivant.delete(cle);
          else suivant.set(cle, v);
          return suivant;
        },
        { replace: true },
      ),
    [cle, defaut, setParams],
  );
  return [valeur, changer];
}
