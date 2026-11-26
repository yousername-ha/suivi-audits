/* Focus après une action refusée (focus-erreur.ts) : premier champ invalide, sinon message d'erreur, et seulement quand
   le focus est resté sur le déclencheur. Petit DOM simulé (sélecteurs simples), sans navigateur. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTENTE_MS, focaliserPremiereErreur, premiereErreur, surveillerRefus } from '../src/focus-erreur';

class Noeud {
  parent: Noeud | null = null;
  enfants: Noeud[] = [];
  attributs: Record<string, string> = {};
  classes: string[] = [];
  visibleEnPage = true;
  disabled = false;
  tabIndex = 0;
  focus = vi.fn(() => {
    doc.activeElement = this;
  });
  constructor(readonly tag: string) {}
  get isConnected(): boolean {
    return this === doc.body || !!this.parent?.isConnected;
  }
  getAttribute(n: string) {
    return this.attributs[n] ?? null;
  }
  hasAttribute(n: string) {
    return n in this.attributs;
  }
  getClientRects() {
    return this.visibleEnPage ? [{}] : [];
  }
  contains(n: Noeud | null): boolean {
    for (let x = n; x; x = x.parent) if (x === this) return true;
    return false;
  }
  descendants(): Noeud[] {
    return this.enfants.flatMap((e) => [e, ...e.descendants()]);
  }
  querySelectorAll(selecteur: string) {
    return this.descendants().filter((e) => e.matches(selecteur));
  }
  closest(selecteur: string): Noeud | null {
    return this.matches(selecteur) ? this : (this.parent?.closest(selecteur) ?? null);
  }
  /** Sélecteurs simples : étiquette, classes, attributs, :not(), descendant à deux termes, listes. */
  matches(selecteur: string): boolean {
    return decouper(selecteur).some((partie) => {
      const termes = partie.split(/\s+(?![^(]*\))/);
      if (termes.length === 2) return composeOk(this, termes[1]!) && !!this.parent?.closest(termes[0]!);
      return composeOk(this, partie);
    });
  }
  ajouter(...e: Noeud[]) {
    for (const x of e) {
      x.parent = this;
      this.enfants.push(x);
      observer(this);
    }
    return this;
  }
  retirer() {
    const p = this.parent;
    if (!p) return;
    p.enfants = p.enfants.filter((e) => e !== this);
    this.parent = null;
    observer(p);
  }
}
class Formulaire extends Noeud {}

const decouper = (s: string) => {
  const parties: string[] = [];
  let profondeur = 0,
    courant = '';
  for (const c of s) {
    if (c === '(' || c === '[') profondeur++;
    if (c === ')' || c === ']') profondeur--;
    if (c === ',' && !profondeur) {
      parties.push(courant.trim());
      courant = '';
    } else courant += c;
  }
  return [...parties, courant.trim()];
};
function composeOk(e: Noeud, compose: string): boolean {
  const negation = compose.match(/:not\((.*)\)$/);
  if (negation) return composeOk(e, compose.slice(0, negation.index)) && !e.matches(negation[1]!);
  const tag = compose.match(/^[a-z]+/)?.[0];
  if (tag && e.tag !== tag) return false;
  for (const [, c] of compose.matchAll(/\.([\w-]+)/g)) if (!e.classes.includes(c!)) return false;
  for (const [, n, v] of compose.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))
    if (v === undefined ? !e.hasAttribute(n!) : e.getAttribute(n!) !== v) return false;
  return true;
}

const el = (tag: string, o: { classes?: string[]; attributs?: Record<string, string> } = {}) => {
  const e = tag === 'form' ? new Formulaire(tag) : new Noeud(tag);
  e.classes = o.classes ?? [];
  e.attributs = o.attributs ?? {};
  return e;
};
const champ = (invalide = false) => el('input', { attributs: { 'aria-invalid': String(invalide) } });
const alerte = () => el('div', { attributs: { role: 'alert', 'data-alerte-erreur': '' } });

let doc: {
  body: Noeud;
  activeElement: Noeud | null;
  ecouteurs: Map<string, (e: unknown) => void>;
  addEventListener: (t: string, f: (e: unknown) => void) => void;
  removeEventListener: (t: string) => void;
};
let observateurs: { cible: Noeud; rappel: () => void; actif: boolean }[];
/** Une modification sous un nœud observé appelle l'observateur (comme MutationObserver, subtree). */
function observer(n: Noeud) {
  for (const o of observateurs) if (o.actif && o.cible.contains(n)) o.rappel();
}

beforeEach(() => {
  observateurs = [];
  doc = {
    body: new Noeud('body'),
    activeElement: null,
    ecouteurs: new Map(),
    addEventListener: (t, f) => doc.ecouteurs.set(t, f),
    removeEventListener: (t) => doc.ecouteurs.delete(t),
  };
  doc.activeElement = doc.body;
  vi.stubGlobal('Element', Noeud);
  vi.stubGlobal('HTMLFormElement', Formulaire);
  vi.stubGlobal(
    'MutationObserver',
    class {
      o?: { cible: Noeud; rappel: () => void; actif: boolean };
      constructor(readonly rappel: () => void) {}
      observe(cible: Noeud) {
        this.o = { cible, rappel: this.rappel, actif: true };
        observateurs.push(this.o);
      }
      disconnect() {
        if (this.o) this.o.actif = false;
      }
    },
  );
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => {
    f();
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Fenêtre de fiche avec deux champs et un bouton « Enregistrer ». */
function fenetre() {
  const cadre = el('section', { classes: ['mantine-Modal-content'] });
  const nom = champ();
  const libelle = champ();
  const enregistrer = el('button');
  cadre.ajouter(nom, libelle, enregistrer);
  doc.body.ajouter(cadre);
  return { cadre, nom, libelle, enregistrer };
}
const installer = () => surveillerRefus(doc as unknown as Document);
const cliquer = (e: Noeud) => {
  e.focus();
  doc.ecouteurs.get('click')!({ target: e });
};

describe('première erreur d’une racine', () => {
  it('le premier champ invalide visible et actif passe avant le message d’erreur', () => {
    const racine = el('div');
    const cache = champ(true);
    cache.visibleEnPage = false;
    const inactif = champ(true);
    inactif.disabled = true;
    const bon = champ(true);
    racine.ajouter(alerte(), cache, inactif, bon);
    expect(premiereErreur(racine as unknown as ParentNode)).toBe(bon);
  });

  it('à défaut, le message d’erreur reçoit le focus par programme (tabindex -1)', () => {
    const racine = el('div');
    const a = alerte();
    racine.ajouter(champ(), a);
    expect(focaliserPremiereErreur(racine as unknown as ParentNode)).toBe(a);
    expect(a.tabIndex).toBe(-1);
    expect(a.focus).toHaveBeenCalledOnce();
  });

  it('champs seulement : le message d’erreur n’est pas une cible', () => {
    const racine = el('div');
    racine.ajouter(alerte(), champ());
    expect(premiereErreur(racine as unknown as ParentNode, true)).toBeNull();
  });
});

describe('surveillance des actions refusées', () => {
  it('enregistrement refusé : le focus quitte le bouton pour le message d’erreur de la fenêtre', () => {
    const { cadre, enregistrer } = fenetre();
    installer();
    cliquer(enregistrer);
    const a = alerte();
    cadre.ajouter(a);
    expect(doc.activeElement).toBe(a);
  });

  it('un champ devenu invalide passe avant le message d’erreur', () => {
    const { cadre, libelle, enregistrer } = fenetre();
    installer();
    cliquer(enregistrer);
    libelle.attributs['aria-invalid'] = 'true';
    cadre.ajouter(alerte());
    expect(doc.activeElement).toBe(libelle);
  });

  it('bouton désactivé pendant l’envoi (focus perdu) : le focus rejoint aussi l’erreur', () => {
    const { cadre, enregistrer } = fenetre();
    installer();
    cliquer(enregistrer);
    doc.activeElement = doc.body;
    const a = alerte();
    cadre.ajouter(a);
    expect(doc.activeElement).toBe(a);
  });

  it('une saisie commencée entre-temps n’est jamais interrompue', () => {
    const { cadre, nom, enregistrer } = fenetre();
    installer();
    cliquer(enregistrer);
    nom.focus();
    const a = alerte();
    cadre.ajouter(a);
    expect(doc.activeElement).toBe(nom);
    expect(a.focus).not.toHaveBeenCalled();
  });

  it('une erreur déjà affichée avant l’action ne déplace pas le focus', () => {
    const { cadre, enregistrer } = fenetre();
    const ancienne = alerte();
    cadre.ajouter(ancienne);
    installer();
    cliquer(enregistrer);
    cadre.ajouter(el('p'));
    expect(doc.activeElement).toBe(enregistrer);
  });

  it('Entrée dans un champ : seul un champ invalide reçoit le focus, pas le message d’erreur', () => {
    const { cadre, nom, libelle, enregistrer } = fenetre();
    installer();
    nom.focus();
    // Envoi implicite : le navigateur simule un clic sur le bouton d'envoi, le focus reste dans le champ.
    doc.ecouteurs.get('click')!({ target: enregistrer });
    cadre.ajouter(alerte());
    expect(doc.activeElement).toBe(nom);
    doc.ecouteurs.get('click')!({ target: enregistrer });
    libelle.attributs['aria-invalid'] = 'true';
    cadre.ajouter(el('p'));
    expect(doc.activeElement).toBe(libelle);
  });

  it('formulaire de page sans bouton d’envoi : l’envoi ouvre l’attente', () => {
    const formulaire = el('form');
    const saisie = champ();
    formulaire.ajouter(saisie);
    doc.body.ajouter(formulaire);
    installer();
    saisie.focus();
    doc.ecouteurs.get('submit')!({ target: formulaire, submitter: null });
    saisie.attributs['aria-invalid'] = 'true';
    formulaire.ajouter(el('p'));
    expect(saisie.focus).toHaveBeenCalledTimes(2);
  });

  it('onglets, menus et commandes hors fenêtre ou formulaire n’ouvrent pas d’attente', () => {
    const { cadre } = fenetre();
    const onglet = el('button', { attributs: { role: 'tab' } });
    const menu = el('button', { attributs: { 'aria-expanded': 'false' } });
    const partie = el('button');
    const navigation = el('nav', { classes: ['fiche-mini-menu'] });
    navigation.ajouter(partie);
    cadre.ajouter(onglet, menu, navigation);
    const dehors = el('button');
    doc.body.ajouter(dehors);
    installer();
    for (const b of [onglet, menu, partie, dehors]) cliquer(b);
    expect(observateurs).toHaveLength(0);
  });

  it('au-delà de l’attente, une erreur tardive ne déplace plus le focus', () => {
    vi.useFakeTimers();
    const { cadre, enregistrer } = fenetre();
    installer();
    cliquer(enregistrer);
    vi.advanceTimersByTime(ATTENTE_MS + 1);
    cadre.ajouter(alerte());
    expect(doc.activeElement).toBe(enregistrer);
    expect(observateurs.every((o) => !o.actif)).toBe(true);
  });

  it('fenêtre fermée après un enregistrement réussi : plus rien n’est suivi', () => {
    const { cadre, enregistrer } = fenetre();
    installer();
    cliquer(enregistrer);
    cadre.retirer();
    cadre.ajouter(alerte());
    expect(doc.activeElement).toBe(enregistrer);
    expect(observateurs.every((o) => !o.actif)).toBe(true);
  });

  it('le retrait de la surveillance enlève les écouteurs', () => {
    const retirer = installer();
    expect([...doc.ecouteurs.keys()].sort()).toEqual(['click', 'submit']);
    retirer();
    expect(doc.ecouteurs.size).toBe(0);
  });
});
