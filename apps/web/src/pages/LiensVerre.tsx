/* Liens en style « Verre » (dessin DocLiens validé par le RSSI le 28/11/2026) : tuiles de synthèse, liste en lignes de
   verre (icône du genre, titre, adresse abrégée en police fixe, deux premiers rattachements puis « +N », catégorie, date de
   modification) et lien choisi à droite (adresse complète à copier, description, rattachements, étiquettes, ouverture,
   modification). Composants de présentation sans requête : la page (Documents.tsx) tient les données, les filtres et les
   droits. Un élément sans donnée n'est pas dessiné (pas de description ni de catégorie inventée).
   Ouverture : la même que le rendu classique (lien vers l'adresse enregistrée, nouvel onglet), quel que soit le genre ;
   rien n'est promis de plus que ce que fait le navigateur. */
import { CopyButton, Text, VisuallyHidden } from '@mantine/core';
import type { LinkOut } from '@suivi/shared';
import type { ReactNode } from 'react';
import { Surligne } from '../components/BarreOutils';
import { jourDocument, refsLigne } from './documents-verre';
import { adresseCourte, detailGenres, GENRE_LIBELLE, genreLien, type TuilesLiens } from './liens-verre';

/** Icône du genre d'un lien : globe bleu (site web), dossier ambre (partage), page violette (fichier), lien neutre. */
export function IconeLien({ url }: { url: string }) {
  const genre = genreLien(url);
  return (
    <span className="lienv-icone" data-genre={genre} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
        {genre === 'web' && (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z" />
          </>
        )}
        {genre === 'partage' && <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />}
        {genre === 'fichier' && (
          <>
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v4h4" />
          </>
        )}
        {genre === 'autre' && (
          <path
            d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1"
            strokeLinecap="round"
          />
        )}
      </svg>
    </span>
  );
}

/** Quatre tuiles : Liens (genres présents), Rattachés (sur le total), Partages réseau, Sites web. */
export function TuilesLiensVerre({ t }: { t: TuilesLiens }) {
  const tuiles = [
    { cle: 'liens', titre: 'Liens', nombre: t.total, sur: null, detail: detailGenres(t) },
    {
      cle: 'rattaches',
      titre: 'Rattachés',
      nombre: t.rattaches,
      sur: t.total,
      detail: 'ayant au moins un rattachement',
    },
    { cle: 'partages', titre: 'Partages réseau', nombre: t.partages, sur: null, detail: 'adresses \\\\serveur\\…' },
    { cle: 'web', titre: 'Sites web', nombre: t.web, sur: null, detail: 'ouverts dans un nouvel onglet' },
  ];
  return (
    <ul className="docv-tuiles" aria-label="Synthèse des liens">
      {tuiles.map((x) => (
        <li key={x.cle} className="docv-tuile" data-tuile={x.cle}>
          <span className="docv-tuile__titre">{x.titre}</span>
          <span className="docv-tuile__valeur">
            <strong className="docv-tuile__nombre">{x.nombre}</strong>
            {x.sur !== null && <span className="docv-tuile__sur">/ {x.sur}</span>}
          </span>
          <span className="docv-tuile__detail">{x.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Liste en lignes de verre ; un appui choisit le lien (montré à droite), la ligne choisie est surlignée. */
export function ListeLiensVerre({
  liens,
  choisi,
  recherche,
  onChoisir,
}: {
  liens: readonly LinkOut[];
  choisi: string | undefined;
  recherche: string;
  onChoisir: (id: string) => void;
}) {
  if (!liens.length)
    return (
      <Text c="dimmed" ta="center" py="md">
        Aucun lien.
      </Text>
    );
  return (
    <ul className="docv-lignes" aria-label="Liens">
      {liens.map((l) => {
        const { visibles, reste } = refsLigne(l.refs);
        return (
          <li key={l.id}>
            <button
              type="button"
              className="docv-ligne"
              aria-pressed={l.id === choisi}
              aria-label={`Afficher ${l.title}`}
              onClick={() => onChoisir(l.id)}
            >
              <IconeLien url={l.url} />
              <span className="docv-ligne__corps lienv-corps">
                <span className="docv-ligne__titre">
                  <Surligne texte={l.title} recherche={recherche} />
                </span>
                <span className="lienv-adresse" title={l.url}>
                  <Surligne texte={adresseCourte(l.url)} recherche={recherche} />
                </span>
              </span>
              {(visibles.length > 0 || reste > 0) && (
                <span className="lienv-refs">
                  {visibles.map((r) => (
                    <span key={r} className="docv-puce">
                      {r}
                    </span>
                  ))}
                  {reste > 0 && <span className="docv-ligne__reste">+{reste}</span>}
                </span>
              )}
              {l.category.trim() && <span className="docv-puce lienv-categorie">{l.category}</span>}
              <span className="docv-ligne__date horodatage">{jourDocument(l.updated_at)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Lien choisi : en-tête, adresse complète à copier, description, rattachements, étiquettes et actions. Sans
    `onModifier` (droit de modification absent), pas de bouton Modifier ; `suppression` : commande fournie par la page. */
export function PanneauLienVerre({
  l,
  onModifier,
  onEtiquette,
  suppression,
}: {
  l: LinkOut;
  onModifier?: () => void;
  onEtiquette?: (tag: string) => void;
  suppression?: ReactNode;
}) {
  const genre = genreLien(l.url);
  return (
    <article className="docv-detail lienv-detail" aria-labelledby={`lienv-detail-${l.id}`}>
      <header className="docv-detail__tete">
        <IconeLien url={l.url} />
        <div className="docv-detail__titres">
          <h2 id={`lienv-detail-${l.id}`} className="docv-detail__titre">
            {l.title}
          </h2>
          <div className="docv-detail__puces">
            <span className="docv-puce">{GENRE_LIBELLE[genre].un}</span>
            {l.category.trim() && <span className="docv-puce">{l.category}</span>}
          </div>
        </div>
      </header>
      <section className="docv-detail__bloc" aria-labelledby={`lienv-adresse-${l.id}`}>
        <h3 id={`lienv-adresse-${l.id}`}>Adresse</h3>
        <div className="lienv-creux">
          <span className="lienv-creux__adresse">{l.url}</span>
          <CopyButton value={l.url}>
            {({ copied, copy }) => (
              <>
                <button
                  type="button"
                  className="docv-rond lienv-copier"
                  aria-label={copied ? 'Adresse copiée' : 'Copier l’adresse'}
                  title={copied ? 'Adresse copiée' : 'Copier l’adresse'}
                  data-copie={copied || undefined}
                  onClick={copy}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
                    {copied ? (
                      <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <>
                        <rect x="8" y="8" width="12" height="12" rx="2" strokeWidth="2.2" />
                        <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" strokeWidth="2.2" />
                      </>
                    )}
                  </svg>
                </button>
                <VisuallyHidden aria-live="polite">{copied ? 'Adresse copiée' : ''}</VisuallyHidden>
              </>
            )}
          </CopyButton>
        </div>
      </section>
      {l.description.trim() && <p className="docv-detail__description">{l.description}</p>}
      {l.refs.length > 0 && (
        <section className="docv-detail__bloc" aria-labelledby={`lienv-refs-${l.id}`}>
          <h3 id={`lienv-refs-${l.id}`}>Rattachements · {l.refs.length}</h3>
          <div className="docv-detail__puces">
            {l.refs.map((r) => (
              <span key={r} className="docv-puce" data-ton="rattachement">
                {r}
              </span>
            ))}
          </div>
        </section>
      )}
      {l.tags.length > 0 && (
        <section className="docv-detail__bloc" aria-labelledby={`lienv-tags-${l.id}`}>
          <h3 id={`lienv-tags-${l.id}`}>Étiquettes</h3>
          <div className="docv-detail__puces">
            {l.tags.map((t) =>
              onEtiquette ? (
                <button
                  key={t}
                  type="button"
                  className="docv-puce docv-puce--bouton"
                  aria-label={`Filtrer sur l’étiquette ${t}`}
                  onClick={() => onEtiquette(t)}
                >
                  {t}
                </button>
              ) : (
                <span key={t} className="docv-puce">
                  {t}
                </span>
              ),
            )}
          </div>
        </section>
      )}
      <div className="docv-detail__actions">
        <a className="docv-gelule docv-gelule--primaire" href={l.url} target="_blank" rel="noopener noreferrer">
          Ouvrir le lien
        </a>
        {suppression}
        {onModifier && (
          <button
            type="button"
            className="docv-rond"
            aria-label="Modifier le lien"
            title="Modifier le lien"
            onClick={onModifier}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16z" strokeWidth="2.2" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}
