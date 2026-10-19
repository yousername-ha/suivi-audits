/* Rubriques voisines de la page affichée (même destination du menu) : onglets de navigation, un lien par rubrique
   lisible. Rien n'est affiché quand la destination n'a qu'une rubrique ou quand la page n'appartient pas au menu. */
import { Link, useLocation } from 'react-router';
import { localiser, rubriquesVisibles } from '../navigation';
import { LibelleAvecPastille } from '../pilotage/compteur-rapprochements';
import { useCan } from '../session';

export function OngletsRubriques() {
  const can = useCan();
  const { pathname } = useLocation();
  const lieu = localiser(pathname);
  if (!lieu) return null;
  const rubriques = rubriquesVisibles(lieu.destination, can);
  if (rubriques.length < 2) return null;
  return (
    <nav aria-label={`Rubriques : ${lieu.destination.label}`} className="onglets-rubriques">
      {rubriques.map((r) => (
        <Link key={r.id} to={r.to} aria-current={r.id === lieu.rubrique.id ? 'page' : undefined}>
          {r.id === 'rapprochements' ? <LibelleAvecPastille libelle={r.label} /> : r.label}
        </Link>
      ))}
    </nav>
  );
}
