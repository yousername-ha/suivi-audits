/* Ordre du menu choisi par la personne : une famille ou une destination se glisse à la souris à sa nouvelle place, ou se
   déplace au clavier (Alt + flèche haut ou bas sur l'élément). L'ordre est enregistré dans les préférences (tous les
   appareils) ; il ne change que l'affichage. Au doigt, le menu reste défilable : pas de glisser tactile. */
import type { OrdreMenu } from '@suivi/shared';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { deplacerDansMenu, ordonnerMenu, type FamilleId } from '../navigation';
import { usePreferences } from '../session';

/** Élément déplaçable : une famille (sans `famille`) ou une destination de `famille`. */
export interface ElementMenu {
  famille?: FamilleId;
  id: string;
}

/** Distance (px) à partir de laquelle un appui devient un glisser : en deçà, c'est un clic. */
const SEUIL = 6;
const cle = (e: ElementMenu) => (e.famille ? `d:${e.famille}:${e.id}` : `f:${e.id}`);
const lire = (c: string | undefined): ElementMenu | null => {
  const [type, a, b] = (c ?? '').split(':');
  if (type === 'f' && a) return { id: a };
  if (type === 'd' && a && b) return { famille: a as FamilleId, id: b };
  return null;
};
/** Identifiants de même niveau, dans l'ordre affiché. */
const voisins = (ordre: OrdreMenu | undefined, e: ElementMenu) => {
  const menu = ordonnerMenu(ordre);
  return e.famille
    ? (menu.find((f) => f.id === e.famille)?.destinations.map((d) => d.id) ?? [])
    : menu.map((f) => f.id);
};

export function useTriMenu() {
  const { prefs, save } = usePreferences();
  const [brouillon, setBrouillon] = useState<OrdreMenu | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState('');
  const ordre = brouillon ?? prefs.menu;
  const ordreRef = useRef(ordre);
  ordreRef.current = ordre;
  const brouillonRef = useRef<OrdreMenu | null>(null);
  const clicIgnore = useRef(false);
  const fin = useRef<(() => void) | null>(null);
  const aRefocaliser = useRef<{ nav: Element; cle: string } | null>(null);

  // Après un déplacement au clavier, le focus reste sur l'élément déplacé (React a pu déplacer son nœud).
  useEffect(() => {
    const r = aRefocaliser.current;
    if (!r) return;
    aRefocaliser.current = null;
    r.nav.querySelector<HTMLElement>(`[data-tri="${CSS.escape(r.cle)}"]`)?.focus();
  });
  useEffect(() => () => fin.current?.(), []);

  const enregistrer = (menu: OrdreMenu) =>
    save({ menu }).catch(() => setAnnonce('L’ordre du menu n’a pas pu être enregistré.'));

  const surPointeurBas = (element: ElementMenu) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    fin.current?.();
    clicIgnore.current = false;
    const depart = { x: e.clientX, y: e.clientY };
    let actif = false;
    const deplace = (ev: PointerEvent) => {
      if (!actif) {
        if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < SEUIL) return;
        actif = true;
        clicIgnore.current = true;
        setGlisse(cle(element));
      }
      ev.preventDefault();
      const sous = lire(
        document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-tri]')?.dataset.tri,
      );
      if (!sous || sous.id === element.id || sous.famille !== element.famille) return;
      // Vers un élément plus bas : se placer après lui ; plus haut : avant lui (pas d'oscillation au survol).
      const ids = voisins(ordreRef.current, element);
      const suivant = deplacerDansMenu(
        ordreRef.current,
        element,
        sous.id,
        ids.indexOf(sous.id) > ids.indexOf(element.id),
      );
      brouillonRef.current = suivant;
      ordreRef.current = suivant;
      setBrouillon(suivant);
    };
    const arreter = (garder: boolean) => {
      window.removeEventListener('pointermove', deplace);
      window.removeEventListener('pointerup', relache);
      window.removeEventListener('pointercancel', annule);
      window.removeEventListener('keydown', echap);
      fin.current = null;
      const menu = brouillonRef.current;
      brouillonRef.current = null;
      setGlisse(null);
      if (garder && menu) {
        void enregistrer(menu);
        const ids = voisins(menu, element);
        setAnnonce(`Position ${ids.indexOf(element.id) + 1} sur ${ids.length}.`);
      }
      setBrouillon(null);
    };
    const relache = () => arreter(actif);
    const annule = () => arreter(false);
    const echap = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape' && actif) {
        ev.preventDefault();
        arreter(false);
      }
    };
    window.addEventListener('pointermove', deplace);
    window.addEventListener('pointerup', relache);
    window.addEventListener('pointercancel', annule);
    window.addEventListener('keydown', echap);
    fin.current = annule;
  };

  const surTouche = (element: ElementMenu, visibles: string[], libelle: string) => (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopPropagation();
    const i = visibles.indexOf(element.id);
    const j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (i < 0 || j < 0 || j >= visibles.length) {
      setAnnonce(`« ${libelle} » est déjà ${j < 0 ? 'en premier' : 'en dernier'}.`);
      return;
    }
    void enregistrer(deplacerDansMenu(ordre, element, visibles[j]!, j > i));
    setAnnonce(`« ${libelle} » : position ${j + 1} sur ${visibles.length}.`);
    const nav = e.currentTarget.closest('nav');
    if (nav) aRefocaliser.current = { nav, cle: cle(element) };
  };

  /** Propriétés d'un lien déplaçable du menu ; `visibles` : identifiants de même niveau affichés, dans l'ordre. */
  const deplacable = (element: ElementMenu, visibles: string[], libelle: string) => ({
    'data-tri': cle(element),
    'data-glisse': glisse === cle(element) || undefined,
    draggable: false,
    'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown',
    onPointerDown: surPointeurBas(element),
    onKeyDown: surTouche(element, visibles, libelle),
  });

  /** Après un glisser, le clic qui suit le relâchement n'ouvre pas le lien. */
  const surClicCapture = (e: MouseEvent) => {
    if (!clicIgnore.current) return;
    clicIgnore.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return { ordre, glisse: glisse !== null, annonce, deplacable, surClicCapture };
}
