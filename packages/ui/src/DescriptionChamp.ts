/* Même identifiant accessible et texte conservé ; aide repliable dans les fiches seulement.
   createElement garde le thème lisible par Node pour la génération des variables CSS statiques, sans transpileur. */
import { createElement, Fragment, forwardRef, useId, useState, type HTMLAttributes } from 'react';

export const DescriptionChamp = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function DescriptionChamp({ id, className, children, ...props }, ref) {
    const genere = useId();
    const identifiant = id ?? `aide-${genere}`;
    const [ouverte, setOuverte] = useState(false);
    const libelle = id?.endsWith('-description') ? id.replace(/-description$/, '-label') : undefined;
    return createElement(
      Fragment,
      null,
      createElement(
        'button',
        {
          type: 'button',
          className: 'champ-aide-bouton',
          'aria-label': 'Aide sur ce champ',
          'aria-describedby': libelle,
          'aria-controls': identifiant,
          'aria-expanded': ouverte,
          title: ouverte ? 'Replier l’aide' : 'Afficher l’aide',
          'data-mantine-stop-propagation': ouverte ? 'true' : undefined,
          onClick: () => setOuverte((etat) => !etat),
          onKeyDown: (evenement) => {
            if (evenement.key === 'Escape' && ouverte) {
              evenement.preventDefault();
              evenement.stopPropagation();
              setOuverte(false);
            }
          },
        },
        createElement(
          'svg',
          { 'aria-hidden': true, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' },
          createElement('circle', { cx: '12', cy: '12', r: '9' }),
          createElement('path', { d: 'M12 10.5v6M12 7v1' }),
        ),
      ),
      createElement(
        'p',
        {
          ...props,
          ref,
          id: identifiant,
          className: [className, 'champ-aide-texte'].filter(Boolean).join(' '),
          'data-aide-ouverte': ouverte || undefined,
        },
        children,
      ),
    );
  },
);
