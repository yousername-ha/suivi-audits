/* Exports Excel en style « Verre » (dessin DocExports validé par le RSSI le 28/11/2026) : bandeau Classique / Pro, grille
   de cartes (icône colorée selon la rubrique, titre, description, nombre de feuilles, boutons Classique et Pro), l'export
   complet mis en avant en dernier. Composant de présentation : Exports.tsx garde les appels et les droits. Le nombre de
   feuilles de l'export complet est la somme des feuilles des rubriques (l'API compose l'export complet de tous leurs
   jeux de données). */

export interface GroupeExport {
  id: string;
  titre: string;
  description: string;
  feuilles: number;
}

/** Feuilles de l'export complet : toutes celles des rubriques. */
export const totalFeuilles = (groupes: readonly Pick<GroupeExport, 'feuilles'>[]) =>
  groupes.reduce((n, g) => n + g.feuilles, 0);

export const libelleFeuilles = (n: number) => `${n} feuille${n > 1 ? 's' : ''}`;

function IconeClasseur() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2.5" strokeWidth="2" />
      <path d="M4 10h16M4 15h16M10 4v16" strokeWidth="2" />
    </svg>
  );
}

/** Bandeau explicatif : ce que contient chaque mode d'export. */
export function BandeauModesExport() {
  return (
    <div className="expv-bandeau">
      <p className="expv-mode">
        <span className="expv-puce">Classique</span>
        Données brutes, filtres activés : pour retravailler dans un tableur.
      </p>
      <p className="expv-mode">
        <span className="expv-puce" data-mode="pro">
          Pro
        </span>
        Mise en forme avec sommaire et pagination : pour transmettre ou imprimer.
      </p>
    </div>
  );
}

function CarteExport({
  id,
  titre,
  description,
  feuilles,
  complet = false,
  onExport,
}: {
  id: string;
  titre: string;
  description: string;
  feuilles: number | null;
  complet?: boolean;
  onExport: (groupe: string, mode: 'std' | 'pro') => void;
}) {
  const nom = complet ? 'export complet' : titre;
  return (
    <li className="expv-carte" data-groupe={id} data-complet={complet || undefined}>
      <div className="expv-carte__tete">
        <span className="expv-icone">
          <IconeClasseur />
        </span>
        <h2 className="expv-carte__titre">{titre}</h2>
      </div>
      <p className="expv-carte__description">{description}</p>
      <div className="expv-carte__pied">
        <span className="expv-carte__feuilles">{feuilles !== null && libelleFeuilles(feuilles)}</span>
        <button
          type="button"
          className="expv-bouton"
          aria-label={`Excel classique : ${nom}`}
          onClick={() => onExport(id, 'std')}
        >
          Classique
        </button>
        <button
          type="button"
          className="expv-bouton"
          data-pro={complet || undefined}
          aria-label={`Excel pro : ${nom}`}
          onClick={() => onExport(id, 'pro')}
        >
          Pro
        </button>
      </div>
    </li>
  );
}

/** Grille des cartes : une par rubrique rendue par l'API, puis l'export complet (violet). */
export function GrilleExportsVerre({
  groupes,
  onExport,
}: {
  groupes: readonly GroupeExport[] | undefined;
  onExport: (groupe: string, mode: 'std' | 'pro') => void;
}) {
  return (
    <ul className="expv-grille" aria-label="Exports disponibles">
      {(groupes ?? []).map((g) => (
        <CarteExport key={g.id} {...g} onExport={onExport} />
      ))}
      <CarteExport
        id="all"
        titre="Export complet"
        description="Toutes les rubriques, une feuille par jeu de données."
        feuilles={groupes ? totalFeuilles(groupes) : null}
        complet
        onExport={onExport}
      />
    </ul>
  );
}
