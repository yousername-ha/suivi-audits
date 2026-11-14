import type { KeyboardEvent, MouseEvent } from 'react';
import { retenirFocusFiche } from '@suivi/ui';

const COMMANDES = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[data-action-fiche]',
  '[data-fiche-ouvrable]',
].join(',');

/** Étend l'ouverture existante à la ligne/carte, sans intercepter ses commandes ni la sélection de texte. */
export function ficheCliquable(ouvrir: () => void, libelle: string) {
  return {
    'data-fiche-ouvrable': true,
    'data-fiche-titre': libelle,
    'aria-description': libelle,
    tabIndex: 0,
    onClick(event: MouseEvent<HTMLElement>) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const ligne = event.currentTarget;
      const noeud = event.target as Node;
      const cible = noeud.nodeType === 1 ? (noeud as Element) : noeud.parentElement;
      if (!cible || !ligne.contains(cible) || cible.closest(COMMANDES) !== ligne) return;
      const selection = ligne.ownerDocument.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        (ligne.contains(selection.anchorNode) || ligne.contains(selection.focusNode))
      )
        return;
      ligne.focus({ preventScroll: true });
      retenirFocusFiche(ligne);
      ouvrir();
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (
        event.target !== event.currentTarget ||
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        !['Enter', ' '].includes(event.key)
      )
        return;
      event.preventDefault();
      retenirFocusFiche(event.currentTarget);
      ouvrir();
    },
  };
}
