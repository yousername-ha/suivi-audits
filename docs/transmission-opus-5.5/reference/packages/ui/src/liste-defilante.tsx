import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Une longue liste garde son propre défilement et réserve la place de ses commandes sous le tableau. */
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
  const [hauteur, setHauteur] = useState<number>();
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
      setHauteur(Math.max(160, Math.floor(window.innerHeight - element.getBoundingClientRect().top - reserve)));
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
      style={hauteur ? ({ '--liste-fiches-hauteur': `${hauteur}px` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
