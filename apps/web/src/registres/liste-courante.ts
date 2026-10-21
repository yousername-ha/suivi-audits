/* Liste courante des occurrences affichée par l'écran des tâches (ordre et filtres de la personne) : la validation d'une
   occurrence s'en sert pour enchaîner sur la suivante de CETTE liste, toutes séries confondues. Valeur lue au moment de
   l'enchaînement : elle n'a pas besoin de provoquer un nouveau rendu. */
let ids: readonly string[] = [];

export const definirListeCourante = (liste: readonly string[]) => {
  ids = liste;
};
export const listeCourante = (): readonly string[] => ids;
