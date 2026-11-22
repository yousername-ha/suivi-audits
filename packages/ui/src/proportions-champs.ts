/* Proportions des saisies : classes statiques, sans mesure du DOM ni style injecté. Les données, contraintes et
   callbacks restent dans le composant métier. Les intitulés servent de repli pour les formulaires existants. */
import type { ReactNode } from 'react';

interface ChampDimensionnable {
  label?: ReactNode;
  'aria-label'?: string;
  type?: string;
  maxLength?: number;
}

/** Les listes longues restent lisibles dans leur panneau. Leur largeur ne change pas à chaque sélection. */
export function proportionChamp(props: ChampDimensionnable): string {
  const label = typeof props.label === 'string' ? props.label : (props['aria-label'] ?? '');
  const nom = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  if (/cpe|url|courriel|e-?mail|adresse|empreinte|secret|mot de passe|json|pem/.test(nom)) return 'champ-format-large';
  if (props.type && ['date', 'datetime-local', 'time', 'month', 'week'].includes(props.type))
    return 'champ-format-date';
  if (/^(code|identifiant)(\s|$)/.test(nom) || /^version$/.test(nom)) return 'champ-format-code';
  if (/responsable|pilote|intervenant|approbateur|destinataire|utilisateur|compte/.test(nom))
    return 'champ-format-personne';
  if (props.type === 'number' || /^(poids|ordre|duree|nombre|seuil|score|pourcentage)(\s|$)/.test(nom))
    return 'champ-format-nombre';
  if (
    /^(etat|statut|priorite|criticite|frequence|resultat|sens|niveau|applicable|mise en (?:œ|oe)uvre)(\s|$)/.test(nom)
  )
    return 'champ-format-court';
  if (/^(type|categorie|famille|modele|methode|version de|strategie|role|source|format|langue)(\s|$)/.test(nom))
    return 'champ-format-moyen';
  if (/^(nom|intitule|titre|libelle|fournisseur|mesure|exigence|registre)(\s|$)/.test(nom)) return 'champ-format-large';
  if (props.maxLength && props.maxLength <= 32) return 'champ-format-code';
  return 'champ-format-libre';
}
