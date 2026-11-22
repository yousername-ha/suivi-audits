/* Les fiches longues se lisent en pages. La fragmentation CSS conserve les éléments dans leur formulaire et ne
   démonte aucun champ : saisies, contraintes, références et callbacks restent ceux du composant métier. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Pagination {
  page: number;
  titres: string[];
}

function titreCourt(texte: string): string {
  const t = texte.replace(/\s+/g, ' ').trim();
  if (/identification|analyse|ebios/i.test(t)) return 'Analyse';
  if (/contr[oô]le/i.test(t)) return 'Contrôles';
  if (/certificat/i.test(t)) return 'Certificats';
  if (/lien|preuve/i.test(t)) return 'Liens et preuves';
  return t.length > 30 ? `${t.slice(0, 29)}…` : t;
}

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
    let courant = 0;
    let total = 0;
    let demande = 0;
    let fini = false;
    let pas = 1;
    let derniereErreur = '';
    let nouveauChamp: HTMLElement | null = null;
    const modifiees = new Set<HTMLElement>();
    const publier = (titres: string[], page: number) => {
      setPagination((ancienne) =>
        ancienne.page === page && ancienne.titres.join('\n') === titres.join('\n') ? ancienne : { page, titres },
      );
    };
    let titres: string[] = [];
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
      publier(titres, courant);
      if (clavier) requestAnimationFrame(() => menu.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus());
    };
    aller.current = afficher;
    const mesurer = () => {
      demande = 0;
      if (fini || !cadre.getClientRects().length || !corps.clientWidth) return;
      const focus = document.activeElement;
      cadre.removeAttribute('data-fiche-paginee');
      cadre.removeAttribute('data-fiche-pied');
      menu.hidden = true;
      for (const e of modifiees) e.removeAttribute('data-fiche-actions-fixes');
      corps.scrollLeft = 0;
      const tropLongue = corps.scrollHeight > corps.clientHeight + 2;
      if (!tropLongue) {
        total = 0;
        courant = 0;
        titres = [];
        publier([], 0);
        return;
      }
      const pied =
        corps.querySelector<HTMLElement>('.fenetre-actions') ??
        corps.querySelector<HTMLElement>(
          ':scope > .mantine-Stack-root > .mantine-Group-root:last-child:has(> .mantine-Button-root)',
        );
      if (pied) {
        cadre.setAttribute('data-fiche-pied', pied.offsetHeight > 60 ? 'grand' : 'normal');
        pied.setAttribute('data-fiche-actions-fixes', '');
        modifiees.add(pied);
      }
      for (const e of corps.querySelectorAll<HTMLElement>('h2, h3, h4, .mantine-Text-root')) {
        if (parseInt(getComputedStyle(e).fontWeight) >= 600) {
          e.setAttribute('data-fiche-titre', '');
          modifiees.add(e);
        }
      }
      cadre.setAttribute('data-fiche-paginee', '');
      menu.hidden = false;
      const style = getComputedStyle(corps);
      pas =
        corps.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) +
        parseFloat(style.columnGap);
      total = Math.max(2, Math.round((corps.scrollWidth - corps.clientWidth) / pas) + 1);
      titres = Array.from({ length: total }, (_, i) => (i === 0 ? 'Informations' : `Suite ${i + 1}`));
      const nommees = new Set<number>();
      for (const e of corps.querySelectorAll<HTMLElement>('[data-fiche-titre]')) {
        if (!e.getClientRects().length) continue;
        const p = pageDe(e);
        if (p > 0 && !nommees.has(p)) {
          titres[p] = titreCourt(e.textContent ?? '') || titres[p]!;
          nommees.add(p);
        }
      }
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
      const alerte = corps.querySelector<HTMLElement>('[role="alert"]');
      const erreur = alerte?.textContent?.trim() ?? '';
      if (alerte && erreur && erreur !== derniereErreur) courant = pageDe(alerte);
      derniereErreur = erreur;
      afficher(courant);
    };
    const planifier = () => {
      if (!demande && !fini) demande = requestAnimationFrame(mesurer);
    };
    const suivreFocus = (e: FocusEvent | Event) => {
      if (total && e.target instanceof HTMLElement && !e.target.closest('[data-fiche-actions-fixes]')) {
        afficher(pageDe(e.target));
      }
    };
    const suivreDefilement = () => {
      if (total) {
        const page = Math.max(0, Math.min(total - 1, Math.round(corps.scrollLeft / pas)));
        if (page !== courant) {
          courant = page;
          publier(titres, courant);
        }
      }
    };
    const observer = new MutationObserver((mutations) => {
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
      if (e.target === corps && total && ['PageDown', 'PageUp'].includes(e.key)) {
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
      cadre.removeAttribute('data-fiche-paginee');
      cadre.removeAttribute('data-fiche-pied');
      for (const e of modifiees) {
        e.removeAttribute('data-fiche-actions-fixes');
        e.removeAttribute('data-fiche-titre');
      }
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

/** Une seule surveillance pour les fenêtres et tiroirs de la plateforme, y compris ceux rendus en portail. */
export function FichesSansDefilement() {
  const [cadres, setCadres] = useState<HTMLElement[]>([]);
  useEffect(() => {
    let demande = 0;
    const lire = () => {
      demande = 0;
      const suivants = [
        ...document.querySelectorAll<HTMLElement>('.mantine-Modal-content, .mantine-Drawer-content:not(.nav-tiroir)'),
      ];
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
  return cadres.map((cadre, i) => <FichePaginee key={i} cadre={cadre} />);
}
