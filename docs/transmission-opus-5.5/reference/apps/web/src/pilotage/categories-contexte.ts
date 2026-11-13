export type FamilleContexte = 'issues' | 'interfaces';
export type TextesContexte = { premier: string; second: string; aPreciser: string };

export const CATEGORIES_CONTEXTE = {
  issues: [
    { id: 'interne', titre: 'Enjeux internes', repere: 'IN', aide: 'Dans l’organisation' },
    { id: 'externe', titre: 'Enjeux externes', repere: 'EXT', aide: 'Dans son environnement' },
  ],
  interfaces: [
    { id: 'interface', titre: 'Interfaces', repere: 'INT', aide: 'Échanges et points de contact' },
    { id: 'dependance', titre: 'Dépendances', repere: 'DEP', aide: 'Services et ressources nécessaires' },
  ],
} as const;

const normaliser = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').trim();

/** Présentation fidèle des deux champs historiques : seule une catégorie explicite autorise un classement.
 * Les préfixes « Interne : … », « [Externe] … » et les titres sur leur propre ligne sont reconnus.
 * Le contenu des catégories reste brut pour pouvoir aussi l'utiliser dans les zones de saisie. */
export function repartirContexte(texte: string, famille: FamilleContexte): TextesContexte {
  const groupes: Record<keyof TextesContexte, string[]> = { premier: [], second: [], aPreciser: [] };
  const noms: Record<string, keyof TextesContexte> = {
    'a preciser': 'aPreciser',
    'non classe': 'aPreciser',
    'non classes': 'aPreciser',
    ...(famille === 'issues'
      ? {
          interne: 'premier',
          internes: 'premier',
          'enjeu interne': 'premier',
          'enjeux internes': 'premier',
          externe: 'second',
          externes: 'second',
          'enjeu externe': 'second',
          'enjeux externes': 'second',
        }
      : { interface: 'premier', interfaces: 'premier', dependance: 'second', dependances: 'second' }),
  };
  let groupe: keyof TextesContexte = 'aPreciser';
  for (const ligne of texte.split(/\r?\n/)) {
    const recherche = ligne.trim().replace(/^[-*•]\s+/, '');
    const prefixe = recherche.match(/^\[([^\]]+)\]\s*(.*)$/) ?? recherche.match(/^([^:]+):\s?(.*)$/);
    const nom = prefixe?.[1] ?? recherche;
    const cle = normaliser(nom);
    const cible = Object.hasOwn(noms, cle) ? noms[cle] : undefined;
    if (cible) {
      if (prefixe?.[2]) {
        groupes[cible].push(prefixe[2]);
        groupe = 'aPreciser';
      } else groupe = cible;
    } else groupes[groupe].push(ligne);
  }
  return {
    premier: groupes.premier.join('\n'),
    second: groupes.second.join('\n'),
    aPreciser: groupes.aPreciser.join('\n'),
  };
}
