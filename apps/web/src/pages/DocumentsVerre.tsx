/* Documents en style « Verre » (dessin DocDocuments validé par le RSSI le 28/11/2026) : tuiles de synthèse, liste en
   lignes de verre (badge du type de fichier, titre, catégorie · version · taille, deux premiers rattachements puis
   « +N », classification, date de modification), document choisi à droite (description, rattachements, étiquettes,
   frise des versions, téléchargement, nouvelle version, ouverture de la fiche) et zone de dépôt par glisser-déposer.
   Composants de présentation sans requête : la page (Documents.tsx) tient les données, les filtres et les droits. Un
   élément sans donnée n'est pas dessiné (pas de description, de catégorie ou de taille inventée). */
import { FileButton, Text } from '@mantine/core';
import { CLASSIFICATION_LABELS, type DocumentDetailOut, type DocumentOut } from '@suivi/shared';
import { type DragEvent, useState } from 'react';
import { Surligne } from '../components/BarreOutils';
import { fmtDate, fmtSize } from '../components/common';
import {
  detailTypes,
  jourDocument,
  metaDocument,
  refsLigne,
  type TuilesDocuments,
  typeFichier,
  versionsFrise,
} from './documents-verre';

/** Badge du type de fichier : libellé (PDF, DOC, XLSX…) et couleur de sa famille ; sans type connu, badge neutre vide. */
export function BadgeFichier({ nom, mime }: { nom: string | null | undefined; mime: string | null | undefined }) {
  const t = typeFichier(nom, mime);
  return (
    <span className="docv-badge" data-type={t?.famille ?? 'autre'} aria-hidden={t ? undefined : true}>
      {t?.libelle}
    </span>
  );
}

/** Puce de classification : Public vert, Interne gris, Restreint ambre, Confidentiel rouge. */
export function PuceClassification({ c }: { c: DocumentOut['classification'] }) {
  return (
    <span className="docv-classif" data-classification={c}>
      {CLASSIFICATION_LABELS[c]}
    </span>
  );
}

/** Quatre tuiles : Documents (types, catégories), Rattachés (sur le total), À revoir (plus d'un an), Confidentiels. */
export function TuilesDocumentsVerre({ t }: { t: TuilesDocuments }) {
  const tuiles = [
    { cle: 'documents', titre: 'Documents', nombre: t.total, sur: null, detail: detailTypes(t) },
    {
      cle: 'rattaches',
      titre: 'Rattachés',
      nombre: t.rattaches,
      sur: t.total,
      detail: 'ayant au moins un rattachement',
    },
    { cle: 'a-revoir', titre: 'À revoir', nombre: t.aRevoir, sur: null, detail: 'non modifiés depuis plus d’un an' },
    {
      cle: 'confidentiels',
      titre: 'Confidentiels',
      nombre: t.confidentiels,
      sur: null,
      detail: 'classification « Confidentiel »',
    },
  ];
  return (
    <ul className="docv-tuiles" aria-label="Synthèse du registre documentaire">
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

/** Liste en lignes de verre ; un appui choisit le document (montré à droite), la ligne choisie est surlignée. */
export function ListeDocumentsVerre({
  documents,
  choisi,
  recherche,
  onChoisir,
}: {
  documents: readonly DocumentOut[];
  choisi: string | undefined;
  recherche: string;
  onChoisir: (id: string) => void;
}) {
  if (!documents.length)
    return (
      <Text c="dimmed" ta="center" py="md">
        Aucun document.
      </Text>
    );
  return (
    <ul className="docv-lignes" aria-label="Documents">
      {documents.map((d) => {
        const { visibles, reste } = refsLigne(d.refs);
        return (
          <li key={d.id}>
            <button
              type="button"
              className="docv-ligne"
              aria-pressed={d.id === choisi}
              aria-label={`Afficher ${d.title}`}
              onClick={() => onChoisir(d.id)}
            >
              <BadgeFichier nom={d.filename} mime={d.mime} />
              <span className="docv-ligne__corps">
                <span className="docv-ligne__titre">
                  <Surligne texte={d.title} recherche={recherche} />
                </span>
                <span className="docv-ligne__meta">
                  <span className="docv-ligne__infos">{metaDocument(d, fmtSize)}</span>
                  {visibles.map((r) => (
                    <span key={r} className="docv-puce">
                      {r}
                    </span>
                  ))}
                  {reste > 0 && <span className="docv-ligne__reste">+{reste}</span>}
                </span>
              </span>
              <PuceClassification c={d.classification} />
              <span className="docv-ligne__date horodatage">{jourDocument(d.updated_at)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Document choisi : en-tête, description, rattachements, étiquettes, frise des versions et actions. */
export function PanneauDocumentVerre({
  d,
  peutDeposerVersion,
  onTelecharger,
  onTelechargerVersion,
  onNouvelleVersion,
  onFiche,
  onEtiquette,
  libelleFiche = 'Modifier la fiche',
}: {
  d: DocumentDetailOut;
  peutDeposerVersion: boolean;
  onTelecharger: () => void;
  onTelechargerVersion: (version: number) => void;
  onNouvelleVersion: (f: File) => void;
  onFiche: () => void;
  onEtiquette?: (tag: string) => void;
  libelleFiche?: string;
}) {
  const versions = versionsFrise(d.versions);
  return (
    <article className="docv-detail" aria-labelledby={`docv-detail-${d.id}`}>
      <header className="docv-detail__tete">
        <BadgeFichier nom={d.filename} mime={d.mime} />
        <div className="docv-detail__titres">
          <h2 id={`docv-detail-${d.id}`} className="docv-detail__titre">
            {d.title}
          </h2>
          <div className="docv-detail__puces">
            {d.category.trim() && <span className="docv-puce">{d.category}</span>}
            <PuceClassification c={d.classification} />
          </div>
        </div>
      </header>
      {d.deleted_at && (
        <p className="docv-detail__corbeille">
          Dans la corbeille depuis le <span className="horodatage">{fmtDate(d.deleted_at)}</span>.
        </p>
      )}
      {d.description.trim() && <p className="docv-detail__description">{d.description}</p>}
      {d.refs.length > 0 && (
        <section className="docv-detail__bloc" aria-labelledby={`docv-refs-${d.id}`}>
          <h3 id={`docv-refs-${d.id}`}>Rattachements · {d.refs.length}</h3>
          <div className="docv-detail__puces">
            {d.refs.map((r) => (
              <span key={r} className="docv-puce" data-ton="rattachement">
                {r}
              </span>
            ))}
          </div>
        </section>
      )}
      {d.tags.length > 0 && (
        <section className="docv-detail__bloc" aria-labelledby={`docv-tags-${d.id}`}>
          <h3 id={`docv-tags-${d.id}`}>Étiquettes</h3>
          <div className="docv-detail__puces">
            {d.tags.map((t) =>
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
      {versions.length > 0 && (
        <section className="docv-detail__bloc docv-detail__bloc--versions" aria-labelledby={`docv-versions-${d.id}`}>
          <h3 id={`docv-versions-${d.id}`}>Versions</h3>
          <ol className="docv-frise">
            {versions.map((v, i) => (
              <li key={v.version} className="docv-frise__etape" data-courante={i === 0 || undefined}>
                <span className="docv-frise__point" aria-hidden="true" />
                <div className="docv-frise__corps">
                  <button
                    type="button"
                    className="docv-frise__version"
                    aria-label={`Télécharger la version ${v.version} (${v.filename})`}
                    onClick={() => onTelechargerVersion(v.version)}
                  >
                    v{v.version} <span className="docv-frise__date horodatage">· {jourDocument(v.uploaded_at)}</span>
                  </button>
                  <span className="docv-frise__texte">
                    {v.comment.trim() || [v.filename, fmtSize(v.size)].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="docv-detail__actions">
        <button type="button" className="docv-gelule docv-gelule--primaire" onClick={onTelecharger}>
          Télécharger
        </button>
        {peutDeposerVersion && (
          <FileButton onChange={(f) => f && onNouvelleVersion(f)}>
            {(props) => (
              <button type="button" className="docv-gelule" {...props}>
                Nouvelle version
              </button>
            )}
          </FileButton>
        )}
        <button type="button" className="docv-rond" aria-label={libelleFiche} title={libelleFiche} onClick={onFiche}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" strokeWidth="2.2" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  );
}

/** Zone de dépôt en bas de la liste : glisser-déposer des fichiers, ou bouton pour les choisir. Le dépôt est celui de
    l'en-tête (même appel, même limite de taille, contrôlée par le serveur). */
export function ZoneDepotVerre({ enCours, onDeposer }: { enCours: boolean; onDeposer: (fichiers: File[]) => void }) {
  const [survol, setSurvol] = useState(false);
  const accepter = (e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setSurvol(true);
  };
  return (
    <div
      className="docv-depot"
      data-survol={survol || undefined}
      aria-busy={enCours || undefined}
      onDragEnter={accepter}
      onDragOver={accepter}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const fichiers = Array.from(e.dataTransfer.files);
        if (fichiers.length && !enCours) onDeposer(fichiers);
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span>{enCours ? 'Dépôt en cours…' : 'Glissez des fichiers ici pour les déposer'}</span>
      <FileButton onChange={(f) => f.length && onDeposer(f)} multiple disabled={enCours}>
        {(props) => (
          <button type="button" className="docv-depot__choisir" {...props}>
            ou choisissez-les
          </button>
        )}
      </FileButton>
    </div>
  );
}
