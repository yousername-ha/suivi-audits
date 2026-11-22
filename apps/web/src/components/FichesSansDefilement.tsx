/* Les fiches longues se lisent en parties. La fragmentation CSS conserve les éléments dans leur formulaire et ne
   démonte aucun champ : saisies, contraintes, références et callbacks restent ceux du composant métier.
   - Hauteur : la fenêtre prend la plus petite hauteur qui garde le même nombre de parties ; les parties sont ainsi
     remplies de façon équilibrée et la fenêtre ne s'étire pas sur toute la hauteur de l'écran.
   - Intitulés : une section déclarée par le formulaire (attribut data-fiche-section, sur le titre qui l'ouvre) commence
     une partie et la nomme ; sinon le titre placé en tête de partie, sinon « … (suite) » (voir fiches-parties.ts).
   - Repli : si le découpage n'est pas sûr (document intégré, bloc plus haut qu'une partie, attribut
     data-fiche-defilement posé par l'écran), la fenêtre garde son défilement vertical habituel. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nommerParties, titreCourt, trouverPied, type RepereDePartie } from './fiches-parties';

interface Pagination {
  page: number;
  titres: string[];
}

/** Contenus que la fragmentation ne sait pas découper : la fiche qui en contient un garde son défilement. */
const INDIVISIBLES = 'iframe, object, embed, canvas, video, [data-fiche-defilement]';
/** Un texte en gras ne vaut titre de section que hors des tableaux, commandes, libellés et messages. */
const HORS_TITRE = 'td, th, li, button, a, label, summary, [role="alert"], .mantine-Alert-root, .mantine-Badge-root';
const TITRE_MAX = 80;
/** Hauteur minimale de la fenêtre découpée, en multiples de la taille de base du texte. */
const HAUTEUR_MIN = 18;
const PRECISION = 6;
/** Encadrés gardés entiers quand ils occupent au plus cette part de la hauteur d'une partie. */
const ENCADRES = '.mantine-Card-root, .mantine-Paper-root, .mantine-Alert-root, fieldset, details[open]';
const PART_ENTIERE = 0.5;
/** Éléments dont la place est contrôlée après découpage : un seul tronqué, à cheval sur deux parties ou recouvert par
    un autre, et la fiche garde son défilement habituel. */
const CONTROLES =
  '.mantine-InputWrapper-root, .mantine-Button-root, .mantine-Checkbox-root, .mantine-Radio-root, .mantine-Switch-root, summary, tr, [data-fiche-titre]';
const TOLERANCE = 3;
const ERREURS = '[role="alert"], .mantine-InputWrapper-error';

function FichePaginee({ cadre }: { cadre: HTMLElement }) {
  const [hote, setHote] = useState<HTMLElement | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 0, titres: [] });
  const aller = useRef<(page: number, clavier?: boolean) => void>(() => {});
  useLayoutEffect(() => {
    const corps = cadre.querySelector<HTMLElement>(':scope > .mantine-Modal-body, :scope > .mantine-Drawer-body');
    if (!corps) return;
    const menu = document.createElement('div');
    menu.className = 'fiche-mini-menu-hote';
    menu.hidden = true;
    corps.before(menu);
    setHote(menu);
    // Rail d'accrochage : un repère invisible par partie. Le navigateur arrête ainsi lui-même tout défilement
    // horizontal sur une partie entière (mise en vue d'un champ au clavier, par un lecteur d'écran ou par un test),
    // avant le clic : rien ne bouge sous le pointeur.
    const rail = document.createElement('div');
    rail.className = 'fiche-rail';
    rail.setAttribute('aria-hidden', 'true');
    corps.append(rail);
    let courant = 0;
    let total = 0;
    let demande = 0;
    let fini = false;
    let pas = 1;
    let derniereErreur = '';
    let nouveauChamp: HTMLElement | null = null;
    // Hauteur retenue au dernier calcul : conservée tant qu'elle donne le même découpage, pour que la fenêtre ne
    // change pas de taille à chaque frappe.
    let retenue = { hauteur: 0, parties: 0, disponible: 0 };
    const modifiees = new Set<HTMLElement>();
    const publier = (titres: string[], page: number) => {
      setPagination((ancienne) =>
        ancienne.page === page && ancienne.titres.join('\n') === titres.join('\n') ? ancienne : { page, titres },
      );
    };
    let titres: string[] = [];
    const visible = (e: Element) => e.getClientRects().length > 0;
    const pageDe = (e: Element) => {
      const r = e.getBoundingClientRect();
      const b = corps.getBoundingClientRect();
      return Math.max(0, Math.min(total - 1, Math.floor((r.left - b.left + corps.scrollLeft) / pas)));
    };
    const afficher = (page: number, clavier = false) => {
      if (!total) return;
      courant = Math.max(0, Math.min(total - 1, page));
      corps.scrollLeft = courant * pas;
      corps.scrollTop = 0;
      cadre.style.setProperty('--fiche-defile', `${corps.scrollLeft}px`);
      publier(titres, courant);
      if (clavier) requestAnimationFrame(() => menu.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus());
    };
    aller.current = afficher;
    const retablir = () => {
      cadre.removeAttribute('data-fiche-paginee');
      cadre.removeAttribute('data-fiche-pied');
      cadre.style.removeProperty('--fiche-hauteur');
      cadre.style.removeProperty('--fiche-pied');
      cadre.style.removeProperty('--fiche-pas');
      cadre.style.removeProperty('--fiche-defile');
      rail.replaceChildren();
      menu.hidden = true;
      for (const e of modifiees) {
        e.removeAttribute('data-fiche-actions-fixes');
        e.removeAttribute('data-fiche-titre');
        e.removeAttribute('data-fiche-entier');
      }
      modifiees.clear();
    };
    const defilementClassique = () => {
      retablir();
      total = 0;
      courant = 0;
      titres = [];
      retenue = { hauteur: 0, parties: 0, disponible: 0 };
      publier([], 0);
    };
    const mesurer = () => {
      demande = 0;
      if (fini || !visible(cadre) || !corps.clientWidth) return;
      const focus = document.activeElement;
      retablir();
      corps.scrollLeft = 0;
      if (corps.scrollHeight <= corps.clientHeight + 2 || corps.querySelector(INDIVISIBLES)) {
        defilementClassique();
        return;
      }
      // Un encadré reste entier s'il est petit devant une partie ; plus grand, il doit pouvoir se poursuivre sur la
      // partie suivante, sinon son contenu serait tronqué.
      const limite = corps.clientHeight * PART_ENTIERE;
      for (const e of corps.querySelectorAll<HTMLElement>(ENCADRES)) {
        if (e.offsetHeight <= limite) {
          e.setAttribute('data-fiche-entier', '');
          modifiees.add(e);
        }
      }
      const pied = trouverPied(corps, visible);
      if (pied) {
        pied.setAttribute('data-fiche-actions-fixes', '');
        modifiees.add(pied);
        cadre.setAttribute('data-fiche-pied', '');
      }
      for (const e of corps.querySelectorAll<HTMLElement>('h2, h3, h4, legend, .mantine-Text-root')) {
        if (
          parseInt(getComputedStyle(e).fontWeight) >= 600 &&
          !e.closest(HORS_TITRE) &&
          !e.closest('[data-fiche-actions-fixes]') &&
          (e.textContent?.trim().length ?? 0) <= TITRE_MAX
        ) {
          e.setAttribute('data-fiche-titre', '');
          modifiees.add(e);
        }
      }
      cadre.setAttribute('data-fiche-paginee', '');
      if (pied) cadre.style.setProperty('--fiche-pied', `${pied.offsetHeight}px`);
      menu.hidden = false;
      const style = getComputedStyle(corps);
      pas =
        corps.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) +
        parseFloat(style.columnGap);
      const compter = () => Math.max(1, Math.round((corps.scrollWidth - corps.clientWidth) / pas) + 1);
      // Un bloc plus haut qu'une partie déborde vers le bas au lieu de passer à la suivante : il serait tronqué.
      const tronque = () => corps.scrollHeight > corps.clientHeight + 2;
      let parties = compter();
      if (parties < 2) {
        // Le pied une fois fixé, tout tient : une seule partie, donc pas de menu.
        menu.hidden = true;
        parties = compter();
      }
      if (tronque()) {
        defilementClassique();
        return;
      }
      // Contrôle du découpage : certains blocs ne se découpent pas (grille à requête de conteneur, bloc à défilement
      // interne) et le navigateur les laisse alors déborder ou se chevaucher. Chaque champ doit tenir en entier dans
      // une seule partie, sans en recouvrir un autre.
      const sain = () => {
        if (tronque()) return false;
        const cadreCorps = corps.getBoundingClientRect();
        const haut = cadreCorps.top + parseFloat(style.paddingTop) - TOLERANCE;
        const bas = cadreCorps.bottom - parseFloat(getComputedStyle(corps).paddingBottom) + TOLERANCE;
        const largeur = pas - parseFloat(style.columnGap);
        const places: { e: HTMLElement; g: number; d: number; h: number; b: number }[] = [];
        for (const e of corps.querySelectorAll<HTMLElement>(CONTROLES)) {
          if (e.closest('[data-fiche-actions-fixes]')) continue;
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.top < haut || r.bottom > bas) return false;
          const g = r.left - cadreCorps.left - parseFloat(style.paddingLeft) + corps.scrollLeft;
          const dansPartie = ((g % pas) + pas) % pas;
          if (dansPartie + r.width > largeur + TOLERANCE && dansPartie < pas - TOLERANCE) return false;
          places.push({ e, g, d: g + r.width, h: r.top, b: r.bottom });
        }
        places.sort((x, y) => x.g - y.g);
        for (let i = 0; i < places.length; i++) {
          const x = places[i]!;
          for (let j = i + 1; j < places.length && places[j]!.g < x.d - TOLERANCE; j++) {
            const y = places[j]!;
            if (y.h < x.b - TOLERANCE && x.h < y.b - TOLERANCE && !x.e.contains(y.e) && !y.e.contains(x.e))
              return false;
          }
        }
        return true;
      };
      // Hauteur : la plus petite qui garde ce nombre de parties (fenêtres centrées seulement ; un panneau latéral ou
      // une fenêtre plein écran occupe toute la hauteur).
      if (cadre.matches('.mantine-Modal-content:not([data-full-screen])')) {
        const disponible = cadre.offsetHeight;
        const convient = (hauteur: number) => {
          cadre.style.setProperty('--fiche-hauteur', `${Math.round(hauteur)}px`);
          return compter() === parties && !tronque();
        };
        const gardee =
          retenue.parties === parties &&
          retenue.disponible === disponible &&
          retenue.hauteur <= disponible &&
          convient(retenue.hauteur);
        if (!gardee) {
          const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          let bas = Math.min(disponible, HAUTEUR_MIN * base);
          let haut = disponible;
          if (convient(bas)) haut = bas;
          else
            while (haut - bas > PRECISION) {
              const milieu = (bas + haut) / 2;
              if (convient(milieu)) haut = milieu;
              else bas = milieu;
            }
          cadre.style.setProperty('--fiche-hauteur', `${Math.round(haut)}px`);
          if (!sain()) {
            // La hauteur resserrée gêne le découpage : retour à toute la hauteur disponible.
            cadre.style.removeProperty('--fiche-hauteur');
            haut = disponible;
            parties = compter();
          }
          retenue = { hauteur: Math.round(haut), parties, disponible };
        }
      }
      if (!sain()) {
        defilementClassique();
        return;
      }
      total = parties;
      cadre.style.setProperty('--fiche-pas', `${pas}px`);
      rail.replaceChildren(...Array.from({ length: total }, () => document.createElement('i')));
      if (total < 2) {
        courant = 0;
        titres = [];
        corps.scrollLeft = 0;
        publier([], 0);
        return;
      }
      const haute = corps.getBoundingClientRect().top + parseFloat(style.paddingTop);
      const seuil = corps.clientHeight * 0.15;
      const reperes: RepereDePartie[] = [];
      for (const e of corps.querySelectorAll<HTMLElement>('[data-fiche-section], [data-fiche-titre]')) {
        if (!visible(e)) continue;
        const declare = e.getAttribute('data-fiche-section');
        reperes.push({
          page: pageDe(e),
          titre: titreCourt(declare || (e.textContent ?? '')),
          explicite: !!declare,
          enTete: e.getBoundingClientRect().top - haute <= seuil,
        });
      }
      titres = nommerParties(total, reperes);
      if (
        focus instanceof HTMLElement &&
        focus !== corps &&
        corps.contains(focus) &&
        !focus.closest('[data-fiche-actions-fixes]')
      ) {
        courant = pageDe(focus);
      }
      if (nouveauChamp?.isConnected) courant = pageDe(nouveauChamp);
      nouveauChamp = null;
      const alerte = [...corps.querySelectorAll<HTMLElement>(ERREURS)].find(
        (e) => visible(e) && !e.closest('[data-fiche-actions-fixes]'),
      );
      const erreur = alerte?.textContent?.trim() ?? '';
      if (alerte && erreur && erreur !== derniereErreur) courant = pageDe(alerte);
      derniereErreur = erreur;
      afficher(courant);
    };
    const planifier = () => {
      if (!demande && !fini) demande = requestAnimationFrame(mesurer);
    };
    const suivreFocus = (e: FocusEvent | Event) => {
      if (total > 1 && e.target instanceof HTMLElement && !e.target.closest('[data-fiche-actions-fixes]')) {
        afficher(pageDe(e.target));
      }
    };
    const suivreDefilement = () => {
      if (total > 1) {
        const page = Math.max(0, Math.min(total - 1, Math.round(corps.scrollLeft / pas)));
        if (page !== courant) {
          courant = page;
          publier(titres, courant);
        }
        // Le pied fixe suit la partie affichée (il est placé dans le contenu qui défile).
        cadre.style.setProperty('--fiche-defile', `${corps.scrollLeft}px`);
      }
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((m) => m.target === rail || (m.type === 'childList' && [...m.addedNodes].includes(rail))))
        return;
      const actif = document.activeElement;
      if (actif instanceof HTMLButtonElement && /^Ajouter\b/.test(actif.textContent?.trim() ?? '')) {
        for (const mutation of mutations) {
          for (const n of mutation.addedNodes) {
            if (n instanceof HTMLElement) {
              nouveauChamp ??= n.matches('input, select, textarea')
                ? n
                : n.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea');
            }
          }
        }
      }
      planifier();
    });
    observer.observe(corps, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'hidden', 'open', 'data-active'],
    });
    const dimensions = new ResizeObserver(planifier);
    dimensions.observe(cadre);
    dimensions.observe(corps);
    if (corps.firstElementChild) dimensions.observe(corps.firstElementChild);
    const preferences = new MutationObserver(planifier);
    preferences.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-densite', 'data-taille', 'data-style', 'data-mur'],
    });
    const clavierCorps = (e: KeyboardEvent) => {
      if (e.target === corps && total > 1 && ['PageDown', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        afficher(courant + (e.key === 'PageDown' ? 1 : -1));
      }
    };
    corps.addEventListener('focusin', suivreFocus);
    corps.addEventListener('invalid', suivreFocus, true);
    corps.addEventListener('scroll', suivreDefilement);
    corps.addEventListener('toggle', planifier, true);
    corps.addEventListener('keydown', clavierCorps);
    mesurer();
    return () => {
      fini = true;
      cancelAnimationFrame(demande);
      observer.disconnect();
      dimensions.disconnect();
      preferences.disconnect();
      corps.removeEventListener('focusin', suivreFocus);
      corps.removeEventListener('invalid', suivreFocus, true);
      corps.removeEventListener('scroll', suivreDefilement);
      corps.removeEventListener('toggle', planifier, true);
      corps.removeEventListener('keydown', clavierCorps);
      retablir();
      rail.remove();
      menu.remove();
    };
  }, [cadre]);
  if (!hote || pagination.titres.length < 2) return null;
  return createPortal(
    <nav className="fiche-mini-menu" aria-label="Parties de la fiche">
      {pagination.titres.map((titre, i) => (
        <button
          key={i}
          type="button"
          aria-current={pagination.page === i ? 'page' : undefined}
          title={`${titre} — partie ${i + 1} sur ${pagination.titres.length}`}
          onClick={() => aller.current(i)}
          onKeyDown={(e) => {
            const page =
              e.key === 'ArrowRight'
                ? i + 1
                : e.key === 'ArrowLeft'
                  ? i - 1
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? pagination.titres.length - 1
                      : null;
            if (page !== null) {
              e.preventDefault();
              aller.current(page, true);
            }
          }}
        >
          <span aria-hidden="true">{i + 1}</span>
          {titre}
        </button>
      ))}
    </nav>,
    hote,
  );
}

/** Une seule surveillance pour les fenêtres et tiroirs de la plateforme, y compris ceux rendus en portail et les
    fenêtres ouvertes depuis une autre fenêtre (chacune a son propre découpage). Les fenêtres RETEX gardent leur mise en
    page propre. */
export function FichesSansDefilement() {
  const [cadres, setCadres] = useState<HTMLElement[]>([]);
  const cles = useRef(new WeakMap<HTMLElement, number>());
  const prochaine = useRef(0);
  useEffect(() => {
    let demande = 0;
    const lire = () => {
      demande = 0;
      const suivants = [
        ...document.querySelectorAll<HTMLElement>(
          '.mantine-Modal-content:not(.retex-modal), .mantine-Drawer-content:not(.nav-tiroir)',
        ),
      ];
      for (const e of suivants) if (!cles.current.has(e)) cles.current.set(e, prochaine.current++);
      setCadres((anciens) =>
        anciens.length === suivants.length && anciens.every((e, i) => e === suivants[i]) ? anciens : suivants,
      );
    };
    const observer = new MutationObserver(() => {
      if (!demande) demande = requestAnimationFrame(lire);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    lire();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(demande);
    };
  }, []);
  return cadres.map((cadre) => <FichePaginee key={cles.current.get(cadre)} cadre={cadre} />);
}
