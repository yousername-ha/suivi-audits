/* Habillage des écrans RETEX, aligné sur la chronologie animée : espace sombre « écran », en-tête à surtitre lumineux,
   sections numérotées en panneaux, onglets et indicateurs façon téléscripteur, pastilles d'état. Les composants Mantine
   placés dans l'espace (champs, listes, tableaux, fenêtres) reprennent ses couleurs par des variables CSS et des règles
   de portée `.retex-espace` (app.css) ; aucun style en ligne (CSP). */
import type { ReactNode } from 'react';

export type TonRetex = 'attention' | 'succes' | 'info' | 'neutre' | 'erreur';

/** Espace sombre englobant une page RETEX (les fenêtres et listes déroulantes doivent y être rendues sans portail). */
export function EspaceRetex({ children }: { children: ReactNode }) {
  return <div className="retex-espace">{children}</div>;
}

/** En-tête de page : surtitre lumineux, titre, sous-titre, actions et lien de retour. */
export function EnteteRetex({
  surtitre,
  titre,
  sousTitre,
  etat,
  actions,
  retour,
}: {
  surtitre: string;
  titre: ReactNode;
  sousTitre?: ReactNode;
  etat?: ReactNode;
  actions?: ReactNode;
  retour?: { libelle: string; action: () => void };
}) {
  return (
    <header className="retex-entete">
      <div className="retex-entete__texte">
        {retour && (
          <button type="button" className="retex-retour" onClick={retour.action}>
            <span aria-hidden="true">←</span> {retour.libelle}
          </button>
        )}
        <span className="retex-surtitre">
          <span className="retex-bandeau__voyant" aria-hidden="true" />
          {surtitre}
        </span>
        <h2 className="retex-entete__titre">
          {titre}
          {etat && <span className="retex-entete__etat">{etat}</span>}
        </h2>
        <span className="retex-entete__souligne" aria-hidden="true" />
        {sousTitre && <p className="retex-entete__sous-titre">{sousTitre}</p>}
      </div>
      {actions && <div className="retex-entete__actions">{actions}</div>}
    </header>
  );
}

/** Section en panneau : numéro, titre, aide et actions. */
export function SectionRetex({
  numero,
  titre,
  aide,
  actions,
  ton,
  children,
}: {
  numero?: string;
  titre: ReactNode;
  aide?: ReactNode;
  actions?: ReactNode;
  /** Liseré coloré (proposition en attente, par exemple). */
  ton?: TonRetex;
  children?: ReactNode;
}) {
  return (
    <section className="retex-panneau" data-ton={ton}>
      <header className="retex-section__tete">
        {numero && (
          <span className="retex-section__numero" aria-hidden="true">
            {numero}
          </span>
        )}
        <div className="retex-section__titres">
          <h3 className="retex-section__titre">{titre}</h3>
          {aide && <p className="retex-section__aide">{aide}</p>}
        </div>
        {actions && <div className="retex-section__actions">{actions}</div>}
      </header>
      {children !== undefined && <div className="retex-section__corps">{children}</div>}
    </section>
  );
}

/** Pastille d'état lumineuse. */
export function EtatRetex({ ton, children }: { ton: TonRetex; children: ReactNode }) {
  return (
    <span className="retex-etat" data-ton={ton}>
      <span className="retex-etat__point" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Indicateurs façon téléscripteur (mêmes classes que le bandeau de la chronologie). */
export function IndicateursRetex({ items }: { items: [string, ReactNode, string?][] }) {
  return (
    <dl className="retex-bandeau__chiffres retex-indicateurs">
      {items.map(([libelle, valeur, teinte]) => (
        <div key={libelle} className={teinte ? `retex-c-${teinte}` : undefined} data-teinte={teinte ? 'oui' : 'non'}>
          <dt>{libelle}</dt>
          <dd>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface OngletRetex<T extends string> {
  valeur: T;
  libelle: string;
  compte?: number;
  /** Compte mis en évidence (éléments en attente, par exemple). */
  alerte?: boolean;
  desactive?: boolean;
}
/** Onglets en barre de commande (mêmes codes que les boutons de la chronologie). */
export function OngletsRetex<T extends string>({
  libelle,
  valeur,
  onglets,
  onChange,
}: {
  libelle: string;
  valeur: T;
  onglets: OngletRetex<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <nav className="retex-onglets" aria-label={libelle}>
      {onglets.map((o) => (
        <button
          key={o.valeur}
          type="button"
          className="retex-onglet"
          aria-current={o.valeur === valeur ? 'page' : undefined}
          disabled={o.desactive}
          onClick={() => onChange(o.valeur)}
        >
          {o.libelle}
          {o.compte !== undefined && (
            <span className="retex-onglet__compte" data-alerte={o.alerte && o.compte > 0 ? 'oui' : 'non'}>
              {o.compte}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
