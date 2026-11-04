/** Retire les soulignés (`_`) du début et de la fin d'un texte, sans expression régulière : le motif `/^_+|_+$/` est
    quadratique sur une longue suite de `_` suivie d'un autre caractère (CodeQL js/polynomial-redos). */
export function sansSoulignesDeBord(s: string): string {
  let debut = 0;
  let fin = s.length;
  while (debut < fin && s.charCodeAt(debut) === 95) debut++;
  while (fin > debut && s.charCodeAt(fin - 1) === 95) fin--;
  return s.slice(debut, fin);
}
