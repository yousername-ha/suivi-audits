/* Lignes ouvrables (refonte Neon, lot 2, ADR 0093) : la ligne entière ouvre la fiche au clic, à Entrée ou à Espace, sans
   jamais intercepter une commande imbriquée, une touche de modification ou une sélection de texte. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ficheCliquable } from '../src/fiche-cliquable';

type Faux = {
  nodeType: number;
  parentElement: Faux | null;
  commande?: boolean;
};

/** Ligne factice : `closest(COMMANDES)` renvoie la première commande rencontrée en remontant, sinon la ligne. */
function ligneFactice(selectionHors = true) {
  const focus = vi.fn();
  const ligne: Record<string, unknown> & Faux = {
    nodeType: 1,
    parentElement: null,
    focus,
    contains: (n: unknown) => {
      let c = n as Faux | null;
      while (c) {
        if (c === ligne) return true;
        c = c.parentElement;
      }
      return false;
    },
    ownerDocument: {
      getSelection: () => (selectionHors ? { isCollapsed: true } : { isCollapsed: false, anchorNode: cellule }),
    },
  };
  const element = (parent: Faux, commande = false): Faux & { closest: () => unknown } => {
    const e: Faux & { closest: () => unknown } = {
      nodeType: 1,
      parentElement: parent,
      commande,
      closest: () => {
        let c: Faux | null = e;
        while (c && c !== ligne) {
          if (c.commande) return c;
          c = c.parentElement;
        }
        return ligne;
      },
    };
    return e;
  };
  const cellule = element(ligne);
  const bouton = element(cellule, true);
  const texteDuBouton = element(bouton);
  return { ligne, cellule, bouton, texteDuBouton, focus };
}

const clic = (ligne: unknown, cible: unknown, extra: Record<string, unknown> = {}) => ({
  defaultPrevented: false,
  button: 0,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  currentTarget: ligne,
  target: cible,
  ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe('ligne de fiche ouvrable', () => {
  it('expose une ligne focalisable décrite, sans changer son nom accessible', () => {
    const props = ficheCliquable(() => {}, 'Afficher Fiche A');
    expect(props.tabIndex).toBe(0);
    expect(props['data-fiche-ouvrable']).toBe(true);
    expect(props['aria-description']).toBe('Afficher Fiche A');
    expect(props).not.toHaveProperty('aria-label');
    expect(props).not.toHaveProperty('role');
  });

  it('ouvre la fiche au clic sur une cellule et retient la ligne pour le retour du focus', () => {
    vi.stubGlobal('window', { location: { href: '/registre' } });
    const ouvrir = vi.fn();
    const { ligne, cellule, focus } = ligneFactice();
    ficheCliquable(ouvrir, 'Afficher A').onClick(clic(ligne, cellule) as never);
    expect(ouvrir).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('laisse les commandes imbriquées agir seules (bouton et son contenu)', () => {
    const ouvrir = vi.fn();
    const { ligne, bouton, texteDuBouton } = ligneFactice();
    const props = ficheCliquable(ouvrir, 'Afficher A');
    props.onClick(clic(ligne, bouton) as never);
    props.onClick(clic(ligne, texteDuBouton) as never);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it('ignore les clics modifiés, secondaires ou déjà traités', () => {
    const ouvrir = vi.fn();
    const { ligne, cellule } = ligneFactice();
    const props = ficheCliquable(ouvrir, 'Afficher A');
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])
      props.onClick(clic(ligne, cellule, extra) as never);
    props.onClick(clic(ligne, cellule, { defaultPrevented: true }) as never);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it('n’ouvre pas la fiche pendant une sélection de texte dans la ligne', () => {
    const ouvrir = vi.fn();
    const { ligne, cellule } = ligneFactice(false);
    ficheCliquable(ouvrir, 'Afficher A').onClick(clic(ligne, cellule) as never);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it('ouvre à Entrée ou Espace sur la ligne elle-même, pas depuis un champ imbriqué ni en répétition', () => {
    vi.stubGlobal('window', { location: { href: '/registre' } });
    const ouvrir = vi.fn();
    const { ligne, bouton } = ligneFactice();
    const props = ficheCliquable(ouvrir, 'Afficher A');
    const touche = (key: string, extra: Record<string, unknown> = {}) => ({
      key,
      target: ligne,
      currentTarget: ligne,
      defaultPrevented: false,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      ...extra,
    });
    props.onKeyDown(touche('Enter') as never);
    props.onKeyDown(touche(' ') as never);
    expect(ouvrir).toHaveBeenCalledTimes(2);
    props.onKeyDown(touche('Enter', { target: bouton }) as never);
    props.onKeyDown(touche('Enter', { repeat: true }) as never);
    props.onKeyDown(touche('a') as never);
    props.onKeyDown(touche('Enter', { ctrlKey: true }) as never);
    expect(ouvrir).toHaveBeenCalledTimes(2);
  });
});
