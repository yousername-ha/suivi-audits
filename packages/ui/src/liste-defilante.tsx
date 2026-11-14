import { useEffect, useRef, type ReactNode } from 'react';

/** Une longue liste de fiches garde son propre défilement et réserve la place de ses commandes sous le tableau (refonte
    Neon, lot 2). La hauteur est écrite par le DOM (CSSOM, autorisé par la CSP) dans `--liste-fiches-hauteur` ; la feuille
    `lignes-fiches.css` ne limite la hauteur que si la liste contient des lignes ouvrables. */
export function ListeDefilante({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const mesurer = () => {
      // Les dialogues restent dimensionnés par leur propre fenêtre, les listes par l'espace disponible à l'écran.
      if (element.closest('[role="dialog"]')) return;
      let reserve = 24;
      let courant: HTMLElement | null = element;
      // Compter les commandes qui suivent la liste, y compris celles placées après sa carte ou son groupe.
      while (courant?.parentElement && !courant.classList.contains('page')) {
        const parent: HTMLElement = courant.parentElement;
        const style = getComputedStyle(parent);
        let suivant = courant.nextElementSibling;
        while (suivant) {
          const s = getComputedStyle(suivant);
          if (suivant.getClientRects().length && s.position !== 'fixed' && s.position !== 'absolute') {
            reserve += suivant.getBoundingClientRect().height + (parseFloat(style.rowGap) || 0);
          }
          suivant = suivant.nextElementSibling;
        }
        reserve += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
        courant = parent;
      }
      // Liste haute dans la page : elle occupe l'espace restant du premier écran (référence). Liste placée sous d'autres
      // blocs (adaptation à la version actuelle) : elle prend la hauteur de l'écran sous l'en-tête collant, une fois
      // atteinte par le défilement, au lieu d'être réduite au minimum.
      const haut = element.getBoundingClientRect().top + window.scrollY;
      const entete = document.querySelector('.shell-header')?.getBoundingClientRect().height ?? 0;
      const depart = haut <= window.innerHeight / 2 ? haut : entete + 16;
      const hauteur = Math.max(240, Math.floor(window.innerHeight - depart - reserve));
      element.style.setProperty('--liste-fiches-hauteur', `${hauteur}px`);
    };
    mesurer();
    const observer = new ResizeObserver(mesurer);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener('resize', mesurer);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [children]);
  return (
    <div
      ref={ref}
      className={className}
      data-liste-fiches
      role="region"
      aria-label={label}
      tabIndex={label ? 0 : undefined}
    >
      {children}
    </div>
  );
}
