/* Barre d'outils discrète des registres (refonte Neon, lot 8, ADR 0093 ; proposition « Vues en icônes et filtres à la
   demande » de la référence, retenue par le RSSI le 14/11/2026). Les champs de recherche et de filtre existants restent
   en place, avec leurs libellés : la barre ajoute une loupe dans le champ de recherche, le raccourci « / » qui y place le
   curseur, et les pastilles des critères actifs, supprimables une à une ou ensemble. Aucun filtre réel n'est retiré. */
import { Button } from '@mantine/core';
import { useEffect, type RefObject } from 'react';

/** Loupe du champ de recherche (décorative : le champ garde son libellé). */
export function IconeLoupe() {
  return (
    <svg
      className="barre-loupe"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

/** Le raccourci « / » ne s'applique qu'en dehors d'une saisie, sans touche de modification ni fenêtre ouverte. */
export function doitOuvrirRecherche(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'defaultPrevented'>,
  cible: { tagName?: string; isContentEditable?: boolean } | null,
  fenetreOuverte: boolean,
): boolean {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || fenetreOuverte) return false;
  const balise = cible?.tagName?.toUpperCase();
  return !(balise === 'INPUT' || balise === 'TEXTAREA' || balise === 'SELECT' || cible?.isContentEditable);
}

/** « / » place le curseur dans le champ de recherche du registre affiché. */
export function useRaccourciRecherche(champ: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const element = champ.current;
      if (!element || !element.getClientRects().length) return;
      const fenetreOuverte = !!document.querySelector('[role="dialog"]');
      if (!doitOuvrirRecherche(e, e.target as HTMLElement | null, fenetreOuverte)) return;
      e.preventDefault();
      element.focus();
      element.select();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [champ]);
}

export interface CritereActif {
  cle: string;
  libelle: string;
  valeur: string;
  retirer: () => void;
}

/** Pastilles des critères actifs, sous la barre : chacune se retire seule ; « Effacer les critères » les retire toutes. */
export function PastillesCriteres({
  criteres,
  onToutEffacer,
}: {
  criteres: CritereActif[];
  onToutEffacer: () => void;
}) {
  if (!criteres.length) return null;
  return (
    <div className="barre-criteres" role="group" aria-label="Critères actifs">
      {criteres.map((c) => (
        <span key={c.cle} className="barre-critere">
          <span className="barre-critere__texte">
            {c.libelle} : <strong>{c.valeur}</strong>
          </span>
          <button
            type="button"
            className="barre-critere__retirer"
            aria-label={`Retirer le critère « ${c.libelle} : ${c.valeur} »`}
            onClick={c.retirer}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4.5 4.5 7 7m0-7-7 7" />
            </svg>
          </button>
        </span>
      ))}
      {criteres.length > 1 && (
        <Button size="compact-xs" variant="subtle" onClick={onToutEffacer}>
          Effacer les critères
        </Button>
      )}
    </div>
  );
}
