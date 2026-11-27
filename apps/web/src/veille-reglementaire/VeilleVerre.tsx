/* Veille réglementaire, style « Verre » (dessin Veille validé par le RSSI le 27/11/2026) : sources en rail dans l'en-tête,
   quatre tuiles (une par statut, chacune filtre la liste), liste compacte des publications à gauche et, à droite, la
   publication choisie (résumé, qualification, lien vers la source). Sans état React : la page tient les filtres et la
   sélection. Les textes des sources restent du texte simple ; un lien n'est rendu que s'il a la forme attendue pour sa
   source (lienPublication). Le dessin montrait aussi « Ce que ça change pour nous », « Créer une exigence » et « Créer
   l'action » : les suites d'une publication ne sont pas encore servies par l'API (toujours à zéro, contrat à convenir),
   ces blocs ne sont donc pas affichés plutôt qu'inventés. */
import { Text } from '@mantine/core';
import {
  type DroitsVeilleReglementaireDto,
  LIBELLES_DOMAINES,
  type PublicationReglementaireDto,
  SOURCES_REGLEMENTAIRES,
  type SourceReglementaire,
  type StatutPublication,
  STATUTS_QUALIFIES,
  type StatutQualifie,
  type SyntheseVeilleReglementaireDto,
} from '@suivi/shared';
import { fmtDate } from '../components/common';
import { PictoReglementaire } from './VeilleReglementaire';
import {
  AUTORITES_REGLEMENTAIRES,
  libelleStatut,
  lienPublication,
  peutQualifier,
  qualifieurDuDomaine,
} from './veille-reglementaire';

const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

/** Tuiles du dessin : à qualifier (ambre), à suivre, sans objet (lavande), impactant (rose). Chacune filtre la liste ;
    un second appui retire le filtre. */
export const TUILES_VEILLE: readonly { statut: StatutPublication; cle: keyof SyntheseVeilleReglementaireDto }[] = [
  { statut: 'a-qualifier', cle: 'aQualifier' },
  { statut: 'a-suivre', cle: 'aSuivre' },
  { statut: 'sans-objet', cle: 'sansObjet' },
  { statut: 'impactant', cle: 'impactant' },
];

export function TuilesVeilleVerre({
  s,
  statut,
  onStatut,
}: {
  s: SyntheseVeilleReglementaireDto;
  statut: StatutPublication | '';
  onStatut: (statut: StatutPublication | '') => void;
}) {
  return (
    <div className="vr-verre__tuiles" role="group" aria-label="Synthèse de la veille réglementaire, filtre par statut">
      {TUILES_VEILLE.map(({ statut: st, cle }) => (
        <button
          key={st}
          type="button"
          className="vr-verre__tuile"
          data-statut={st}
          aria-pressed={statut === st}
          onClick={() => onStatut(statut === st ? '' : st)}
        >
          <strong className="vr-verre__nombre">{String(s[cle])}</strong>
          <span className="vr-verre__libelle">{libelleStatut(st)}</span>
        </button>
      ))}
    </div>
  );
}

/** Rail des sources de l'en-tête : « Toutes », puis chaque source par son nom court. */
export function RailSources({
  source,
  onSource,
}: {
  source: SourceReglementaire | '';
  onSource: (source: SourceReglementaire | '') => void;
}) {
  return (
    <div className="vr-verre__rail" role="group" aria-label="Source">
      {(['', ...SOURCES_REGLEMENTAIRES] as const).map((s) => (
        <button key={s || 'toutes'} type="button" aria-pressed={source === s} onClick={() => onSource(s)}>
          {s ? AUTORITES_REGLEMENTAIRES[s].court : 'Toutes'}
        </button>
      ))}
    </div>
  );
}

/** Rail d'état de la liste : « À qualifier » ou « Tous » ; un autre statut choisi par sa tuile y apparaît, enfoncé. */
export function RailStatut({
  statut,
  onStatut,
}: {
  statut: StatutPublication | '';
  onStatut: (statut: StatutPublication | '') => void;
}) {
  const choix: (StatutPublication | '')[] = ['a-qualifier', ''];
  if (statut && statut !== 'a-qualifier') choix.splice(1, 0, statut);
  return (
    <div className="vr-verre__rail vr-verre__rail--petit" role="group" aria-label="Statut des publications affichées">
      {choix.map((s) => (
        <button key={s || 'tous'} type="button" aria-pressed={statut === s} onClick={() => onStatut(s)}>
          {s ? libelleStatut(s) : 'Tous'}
        </button>
      ))}
    </div>
  );
}

/** Liste compacte : pastille de la source, titre, source et date, statut. Un appui choisit la publication. */
export function ListeTextesVerre({
  publications,
  choisie,
  onChoisir,
}: {
  publications: PublicationReglementaireDto[];
  choisie: string | null;
  onChoisir: (id: string) => void;
}) {
  if (!publications.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune publication ne correspond.
      </Text>
    );
  return (
    <ul className="vr-verre__textes" aria-label="Publications">
      {publications.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className="vr-verre__texte"
            aria-pressed={choisie === p.id}
            onClick={() => onChoisir(p.id)}
          >
            <PictoReglementaire source={p.source} />
            <span className="vr-verre__texte-corps">
              <span className="vr-verre__texte-titre veille-texte">{p.titre}</span>
              <span className="vr-verre__texte-meta">
                {AUTORITES_REGLEMENTAIRES[p.source].court} · <span className="horodatage">{jour(p.publieLe)}</span>
              </span>
            </span>
            <span className="vr-verre__puce" data-statut={p.statut}>
              {libelleStatut(p.statut)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Publication choisie : en-tête (source, titre, dates, lien), résumé, qualification. */
export function DetailPublicationVerre({
  p,
  droits,
  enCours = false,
  onQualifier,
}: {
  p: PublicationReglementaireDto;
  droits?: DroitsVeilleReglementaireDto;
  enCours?: boolean;
  onQualifier?: (p: PublicationReglementaireDto, statut: StatutQualifie) => void;
}) {
  const lien = lienPublication(p);
  const autorite = AUTORITES_REGLEMENTAIRES[p.source];
  const qualifiable = !!onQualifier && peutQualifier(droits, p);
  return (
    <article className="vr-verre__detail" aria-labelledby={`vr-detail-${p.id}`}>
      <header className="vr-verre__detail-tete">
        <PictoReglementaire source={p.source} />
        <div className="vr-verre__detail-titres">
          <h2 id={`vr-detail-${p.id}`} className="vr-verre__detail-titre veille-texte">
            {p.titre}
          </h2>
          <p className="vr-verre__detail-meta">
            {autorite.court} · {autorite.autorite} · publiée le <span className="horodatage">{jour(p.publieLe)}</span> ·{' '}
            {LIBELLES_DOMAINES[p.domaine]}
          </p>
        </div>
        {lien && (
          <a
            className="vr-verre__ouvrir"
            href={lien}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            aria-label="Lire sur le site de la source (nouvel onglet)"
            title="Lire sur le site de la source"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </a>
        )}
      </header>
      <section className="vr-verre__bloc" aria-labelledby={`vr-resume-${p.id}`}>
        <h3 id={`vr-resume-${p.id}`}>Résumé</h3>
        {p.resume ? (
          <p className="vr-verre__resume veille-texte">{p.resume}</p>
        ) : (
          <p className="vr-verre__vide">Aucun résumé repris pour cette publication.</p>
        )}
      </section>
      <section className="vr-verre__bloc" aria-labelledby={`vr-qualif-${p.id}`}>
        <h3 id={`vr-qualif-${p.id}`}>Qualification</h3>
        {qualifiable ? (
          <div className="vr-verre__rail vr-verre__rail--petit" role="group" aria-label={`Qualifier « ${p.titre} »`}>
            {STATUTS_QUALIFIES.map((statut) => (
              <button
                key={statut}
                type="button"
                aria-pressed={p.statut === statut}
                disabled={enCours}
                onClick={() => onQualifier(p, statut)}
              >
                {libelleStatut(statut)}
              </button>
            ))}
          </div>
        ) : (
          <p className="vr-verre__qualif">
            <span className="vr-verre__puce" data-statut={p.statut}>
              {libelleStatut(p.statut)}
            </span>
            {p.statut === 'a-qualifier' && <> Qualification réservée {qualifieurDuDomaine(p.domaine)}.</>}
          </p>
        )}
        <p className="vr-verre__vide">
          {p.qualifiePar && p.qualifieLe ? (
            <>
              Qualifiée par {p.qualifiePar.nom} le <span className="horodatage">{fmtDate(p.qualifieLe)}</span>
            </>
          ) : (
            'Non qualifiée'
          )}
        </p>
      </section>
      {!lien && <p className="vr-verre__vide">Lien indisponible</p>}
    </article>
  );
}
