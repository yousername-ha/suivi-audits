import { afterEach, describe, expect, it, vi } from 'vitest';
import { retenirFocusFiche, rendreFocusFiche } from '../src/focus-fiche';

afterEach(() => vi.unstubAllGlobals());
describe('retour du focus entre consultation et modification', () => {
  it('conserve le déclencheur pendant l’entrée à opacité zéro du dialogue suivant', () => {
    const focus = vi.fn(),
      trigger = { id: 'source', isConnected: true, focus } as unknown as HTMLElement;
    const dialogs = vi.fn(() => [{ getClientRects: () => [1] }]);
    vi.stubGlobal('window', { location: { href: '/parties' } });
    vi.stubGlobal('document', { querySelectorAll: dialogs });
    vi.stubGlobal('getComputedStyle', () => ({ opacity: '0' }));
    retenirFocusFiche(trigger);
    rendreFocusFiche();
    expect(focus).not.toHaveBeenCalled();
    dialogs.mockReturnValue([]);
    rendreFocusFiche();
    expect(focus).toHaveBeenCalledOnce();
  });
  it('retrouve le nouveau bouton de même identifiant après rafraîchissement du registre', () => {
    const old = { id: 'source', isConnected: false } as HTMLElement;
    const focus = vi.fn(),
      current = { isConnected: true, focus };
    vi.stubGlobal('window', { location: { href: '/processus' } });
    vi.stubGlobal('document', { querySelectorAll: () => [], getElementById: () => current });
    retenirFocusFiche(old);
    rendreFocusFiche();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('ne rend pas le focus sur une autre page', () => {
    const focus = vi.fn(),
      trigger = { id: 'source', isConnected: true, focus } as unknown as HTMLElement;
    const location = { href: '/parties' };
    vi.stubGlobal('window', { location });
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    retenirFocusFiche(trigger);
    location.href = '/processus';
    rendreFocusFiche();
    expect(focus).not.toHaveBeenCalled();
  });
});
