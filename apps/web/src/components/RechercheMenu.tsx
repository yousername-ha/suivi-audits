/* Champ « Rechercher une page du menu », sous le logo (demande du RSSI du 18/11/2026). Ctrl K (ou Cmd K) y place le
   curseur ; les flèches parcourent les pages trouvées, Entrée ouvre la page, Échap efface la saisie. */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { trouverPages, type PageMenu } from './recherche-menu';

function IconeLoupe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function RechercheMenu({ pages, onAller }: { pages: readonly PageMenu[]; onAller: (to: string) => void }) {
  const [saisie, setSaisie] = useState('');
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const id = useId();
  const resultats = useMemo(() => trouverPages(pages, saisie), [pages, saisie]);
  const ouvert = saisie.trim() !== '';

  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        champ.current?.focus();
        champ.current?.select();
      }
    };
    window.addEventListener('keydown', raccourci);
    return () => window.removeEventListener('keydown', raccourci);
  }, []);

  const aller = (p: PageMenu) => {
    setSaisie('');
    setActif(0);
    champ.current?.blur();
    onAller(p.to);
  };

  return (
    <div className="nav-recherche">
      <div className="nav-recherche__cadre">
        <label className="nav-recherche__champ">
          <IconeLoupe />
          <input
            ref={champ}
            type="text"
            role="combobox"
            aria-label="Rechercher une page du menu"
            aria-autocomplete="list"
            aria-expanded={ouvert && resultats.length > 0}
            aria-controls={`${id}-pages`}
            aria-activedescendant={ouvert && resultats[actif] ? `${id}-${actif}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Rechercher…"
            value={saisie}
            onChange={(e) => {
              setSaisie(e.currentTarget.value);
              setActif(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && resultats.length) {
                e.preventDefault();
                setActif((i) => (i + 1) % resultats.length);
              } else if (e.key === 'ArrowUp' && resultats.length) {
                e.preventDefault();
                setActif((i) => (i - 1 + resultats.length) % resultats.length);
              } else if (e.key === 'Enter' && resultats[actif]) {
                e.preventDefault();
                aller(resultats[actif]);
              } else if (e.key === 'Escape') {
                setSaisie('');
                setActif(0);
              }
            }}
          />
          <kbd className="nav-recherche__touche" aria-hidden="true">
            Ctrl K
          </kbd>
        </label>
      </div>
      {ouvert &&
        (resultats.length ? (
          <ul id={`${id}-pages`} role="listbox" aria-label="Pages trouvées" className="nav-recherche__resultats">
            {resultats.map((p, i) => (
              <li
                key={p.to}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === actif}
                // Le clic ne retire pas le curseur du champ avant d'ouvrir la page.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => aller(p)}
                onMouseEnter={() => setActif(i)}
              >
                <span>{p.label}</span>
                <small>{p.groupe}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nav-recherche__vide" role="status">
            Aucune page ne correspond.
          </p>
        ))}
    </div>
  );
}
