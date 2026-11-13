/** Retrait des écrans uniquement : les données, exports complets et permissions historiques restent conservés. */
export const moduleDansInterface = (module: string) => !['crrc', 'investissements'].includes(module);

export const sectionRetiree = (section: string) => section === 'investissements' || section.startsWith('crrc-');

/** Regroupement validé le 12/11 : accès retirés du menu, données et services conservés. */
export const SECTIONS_REGROUPEES_BIBLIOTHEQUE = [
  'referentiels',
  'correspondances',
  'rapprochements',
  'couverture',
  'analyser-service',
  'gap-applications',
  'correspondances-bibliotheque',
] as const;
export const sectionRegroupeeBibliotheque = (section: string) =>
  new Set<string>(SECTIONS_REGROUPEES_BIBLIOTHEQUE).has(section);
/** Préserve le périmètre et le retour, sans ouvrir une ancienne fiche GRC dans le nouveau catalogue. */
export function lienBibliotheque(search: URLSearchParams) {
  const next = new URLSearchParams(search);
  next.delete('ouvrir');
  return '/pilotage/bibliotheque' + (next.size ? '?' + next.toString() : '');
}
