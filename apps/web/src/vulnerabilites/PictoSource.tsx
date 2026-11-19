/* Pictogramme de source (ADR 0100, lot L1) : pastille dessinée pour la charte (monogramme, forme, teinte), jamais un logo
   officiel. Nom accessible complet (« Source : CERT-FR (ANSSI) ») et info-bulle ; `decoratif` quand le texte voisin nomme
   déjà la source (le lecteur d'écran ne l'entend pas deux fois). Sous la CSP stricte (ADR 0006) : classes de
   packages/ui/src/neon-veille.css, aucun style en ligne ; tracé et monogramme par attributs SVG. */
import { Tooltip } from '@mantine/core';
import { nomPicto, PICTOS_SOURCES, type SourcePicto, TRACES_FORMES } from './pictos-sources';

export function PictoSource({
  source,
  avecNom = false,
  decoratif = false,
  infobulle = true,
}: {
  source: SourcePicto;
  /** Nom court visible à côté de la pastille. */
  avecNom?: boolean;
  decoratif?: boolean;
  /** Info-bulle du nom complet au survol (sans objet dans une liste de choix, où le texte de l'option nomme la source). */
  infobulle?: boolean;
}) {
  const d = PICTOS_SOURCES[source];
  const pastille = (
    <span
      className={`ps ps--${d.teinte} ps--${d.forme}`}
      data-source={source}
      {...(decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': nomPicto(source) })}
    >
      <svg className="ps__pastille" viewBox="0 0 44 24" aria-hidden="true" focusable="false">
        <path className="ps__forme" d={TRACES_FORMES[d.forme]} />
        <text className="ps__sigle" x={22} y={16.2} textAnchor="middle" fontSize={d.sigle.length > 3 ? 10.5 : 12}>
          {d.sigle}
        </text>
      </svg>
      {avecNom && (
        <span className="ps__nom" aria-hidden="true">
          {d.court}
        </span>
      )}
    </span>
  );
  return infobulle ? (
    <Tooltip label={d.nom} withinPortal openDelay={200}>
      {pastille}
    </Tooltip>
  ) : (
    pastille
  );
}

/** Pastilles de plusieurs sources, en liste nommée (ou décoratives). */
export function PictosSources({
  sources,
  libelle,
  decoratif = false,
  infobulle = true,
}: {
  sources: readonly SourcePicto[];
  libelle?: string;
  decoratif?: boolean;
  infobulle?: boolean;
}) {
  if (!sources.length) return null;
  if (decoratif)
    return (
      <span className="ps-liste" aria-hidden="true">
        {sources.map((s) => (
          <PictoSource key={s} source={s} decoratif infobulle={infobulle} />
        ))}
      </span>
    );
  return (
    <ul className="ps-liste" aria-label={libelle}>
      {sources.map((s) => (
        <li key={s}>
          <PictoSource source={s} infobulle={infobulle} />
        </li>
      ))}
    </ul>
  );
}
