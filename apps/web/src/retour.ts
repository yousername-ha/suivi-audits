/* Contexte de retour (R06) : une page ouverte depuis une autre (écart → audit d'origine, par exemple) garde en paramètre
   d'adresse le chemin de la page d'origine, filtres compris, pour proposer « Retour ». Le paramètre vient de l'adresse, donc
   d'un tiers possible : seuls des chemins internes sont acceptés (jamais une adresse absolue ni un autre protocole). */

/** Chemin interne sûr (« /… » sans double barre, antislash, ni caractère de contrôle), ou nul. */
export function cheminRetourSur(valeur: string | null | undefined): string | null {
  if (!valeur || valeur.length > 500) return null;
  if (!valeur.startsWith('/') || valeur.startsWith('//') || valeur.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(valeur)) return null;
  return valeur;
}

/** Adresse d'une fiche d'une rubrique du Pilotage, avec le retour vers la page courante. */
export function lienContexte(section: string, objetId: string, pageCourante: string): string {
  return `/pilotage/${section}?ouvrir=${encodeURIComponent(objetId)}&retour=${encodeURIComponent(pageCourante)}`;
}

/** Identifiant d'une référence `object:<uuid>` (nul pour une fiche historique ou une référence d'un autre type). */
export function idObjetDeRef(ref: unknown): string | null {
  const m = typeof ref === 'string' ? /^object:([0-9a-f-]{36})$/.exec(ref) : null;
  return m ? m[1]! : null;
}
