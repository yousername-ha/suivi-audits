/* Alertes et avis de la veille (ADR 0100, lots V2, V4c et L1) : liste aérée et fiche d'une alerte ou d'un avis du CERT-FR et
   du CERT Santé. Chaque élément : pastille de la source et nature (une alerte du CERT-FR se détache d'un avis : liseré,
   pastille pleine, mot « Alerte »), identifiant, titre en titre de niveau 3, date, résumé limité à trois lignes, marques
   tirées de ce que la veille range déjà, CVE citées en boutons qui ouvrent la fiche illustrée de la CVE (lot PC4), lien
   vers l'original (nouvel onglet, sans référent). La fiche reprend tout, le texte de la source découpé en paragraphes et
   listes quand il en porte : toujours du texte simple, rendu échappé par React, jamais de HTML interprété.
   Sous la CSP stricte (ADR 0006) : classes de packages/ui/src/neon-veille.css, aucun style en ligne. */
import { Text } from '@mantine/core';
import type { AvisVeilleDto } from '@suivi/shared';
import { StatusChip } from '@suivi/ui';
import { Fragment, useId } from 'react';
import { fmtDate } from '../components/common';
import { PictoSource } from './PictoSource';
import { mentionsFiche } from './sources';
import {
  adresseAvis,
  alerteUrgente,
  blocsTexte,
  identifiantAvis,
  libelleNatureAvis,
  libelleSourceAvis,
  marquesAvis,
} from './veille';

/** CVE citées par défaut dans une ligne de la liste ; la fiche les montre toutes. */
export const CVES_EN_LISTE = 6;

/** Nature d'une publication : mot visible et pictogramme ; l'alerte du CERT-FR est pleine, les autres au trait. */
function NatureAvis({ a }: { a: Pick<AvisVeilleDto, 'source' | 'nature'> }) {
  const urgente = alerteUrgente(a);
  return (
    <span className={`va-nature va-nature--${a.nature}${urgente ? ' va-nature--urgente' : ''}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {a.nature === 'alerte' ? (
          <>
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v5M12 18h.01" />
          </>
        ) : (
          <>
            <path d="M6 3h9l4 4v14H6z" />
            <path d="M9 11h7M9 15h7" />
          </>
        )}
      </svg>
      {libelleNatureAvis(a)}
    </span>
  );
}

/** CVE citées : un bouton par CVE, qui ouvre sa fiche illustrée ; sans `onOuvrir`, texte simple. */
export function PucesCve({
  cves,
  max,
  onOuvrir,
  libelle = 'CVE citées',
}: {
  cves: readonly string[];
  max?: number;
  onOuvrir?: (cve: string) => void;
  libelle?: string;
}) {
  if (!cves.length) return null;
  const montrees = max === undefined ? cves : cves.slice(0, max);
  const reste = cves.length - montrees.length;
  return (
    <ul className="va-cves" aria-label={`${libelle} (${cves.length})`}>
      {montrees.map((c) => (
        <li key={c}>
          {onOuvrir ? (
            <button type="button" className="va-cve" onClick={() => onOuvrir(c)}>
              {c}
            </button>
          ) : (
            <span className="va-cve va-cve--texte">{c}</span>
          )}
        </li>
      ))}
      {reste > 0 && (
        <li className="va-cves__reste">
          et {reste} autre{reste > 1 ? 's' : ''}
        </li>
      )}
    </ul>
  );
}

/** Lien vers l'original : nouvel onglet, sans référent ; l'identifiant est dans le nom accessible. */
function LienOriginal({ a }: { a: AvisVeilleDto }) {
  const lien = adresseAvis(a);
  if (!lien) return null;
  return (
    <a className="va-lien" href={lien} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
      Lire l’original sur le site du {libelleSourceAvis(a.source)}
      <span className="sr-only"> : {identifiantAvis(a)} (nouvel onglet)</span>
    </a>
  );
}

function Marques({ a }: { a: AvisVeilleDto }) {
  const marques = marquesAvis(a);
  if (!marques.length) return null;
  return (
    <ul className="va-marques" aria-label="Marques">
      {marques.map((m) => (
        <li key={m.libelle}>
          <StatusChip etat={m.etat}>{m.libelle}</StatusChip>
        </li>
      ))}
    </ul>
  );
}

/** Mentions de la fiche du CERT Santé, telles quelles, en liste de définitions. */
function MentionsCertSante({ a }: { a: AvisVeilleDto }) {
  if (!a.fiche) return null;
  return (
    <dl className="va-mentions" aria-label="Mentions de la fiche du CERT Santé">
      {mentionsFiche(a.fiche).map((m) => (
        <div key={m.libelle}>
          <dt>{m.libelle} :</dt>
          <dd>{m.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

function Publication({ a }: { a: AvisVeilleDto }) {
  return a.publieLe ? (
    <span className="va-date">
      {a.nature === 'alerte' ? 'Publiée' : 'Publié'} le <span className="horodatage">{fmtDate(a.publieLe)}</span>
    </span>
  ) : (
    <span className="va-date">Date de publication non communiquée</span>
  );
}

/** En-tête commun à la liste et à la fiche : source, nature, identifiant, date. */
function TeteAvis({ a }: { a: AvisVeilleDto }) {
  return (
    <div className="va-tete">
      <PictoSource source={a.source} avecNom />
      <NatureAvis a={a} />
      <span className="va-id">{identifiantAvis(a)}</span>
      <Publication a={a} />
    </div>
  );
}

/** Alertes et avis (sans état React) : liste aérée, rendu testable hors navigateur. */
export function ListeAvis({
  avis,
  onOuvrir,
  onOuvrirCve,
}: {
  avis: AvisVeilleDto[];
  onOuvrir?: (a: AvisVeilleDto) => void;
  onOuvrirCve?: (cve: string) => void;
}) {
  const id = useId();
  if (!avis.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune alerte ni aucun avis à afficher.
      </Text>
    );
  return (
    <ul className="va-liste" aria-label="Alertes et avis">
      {avis.map((a, i) => (
        <li key={a.id} className={`va-item va-item--${a.nature}${alerteUrgente(a) ? ' va-item--urgente' : ''}`}>
          <TeteAvis a={a} />
          <h3 className="va-titre" id={`${id}-${i}`}>
            {a.titre}
          </h3>
          {a.resume && <p className="va-resume">{a.resume}</p>}
          {a.produit && <p className="va-produit">Produit cité : {a.produit}</p>}
          <Marques a={a} />
          <MentionsCertSante a={a} />
          <PucesCve cves={a.cves} max={CVES_EN_LISTE} onOuvrir={onOuvrirCve} />
          <div className="va-actions">
            {onOuvrir && (
              <button type="button" className="va-ouvrir" onClick={() => onOuvrir(a)}>
                Ouvrir la fiche
                <span className="sr-only"> : {identifiantAvis(a)}</span>
              </button>
            )}
            <LienOriginal a={a} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Texte d'une source, découpé en paragraphes et listes (texte simple). */
export function TexteSource({ texte, lang }: { texte: string; lang?: string }) {
  return (
    <div className="va-texte" lang={lang}>
      {blocsTexte(texte).map((b, i) => (
        <Fragment key={i}>
          {b.type === 'paragraphe' ? (
            <p>{b.texte}</p>
          ) : (
            <ul>
              {b.elements.map((e, j) => (
                <li key={j}>{e}</li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** Fiche d'une alerte ou d'un avis (sans état React) : tout ce que la veille range, sans appel nouveau. */
export function FicheAvis({ a, onOuvrirCve }: { a: AvisVeilleDto; onOuvrirCve?: (cve: string) => void }) {
  return (
    <article className={`va-fiche${alerteUrgente(a) ? ' va-fiche--urgente' : ''}`}>
      <TeteAvis a={a} />
      <h3 className="va-titre va-titre--fiche">{a.titre}</h3>
      <Marques a={a} />
      {a.resume ? (
        <section className="va-section" aria-label="Résumé de la source">
          <p className="va-etiquette">Résumé de la source</p>
          <TexteSource texte={a.resume} />
        </section>
      ) : (
        <Text size="sm" c="dimmed">
          La source ne publie aucun résumé : lire l’original.
        </Text>
      )}
      {a.produit && <p className="va-produit">Produit cité : {a.produit}</p>}
      {a.fiche && (
        <section className="va-section" aria-label="Fiche du CERT Santé">
          <p className="va-etiquette">Fiche du CERT Santé</p>
          <MentionsCertSante a={a} />
        </section>
      )}
      <section className="va-section" aria-label="CVE citées">
        <p className="va-etiquette">CVE citées</p>
        {a.cves.length ? (
          <PucesCve cves={a.cves} onOuvrir={onOuvrirCve} />
        ) : (
          <Text size="sm" c="dimmed">
            Aucune CVE citée.
          </Text>
        )}
      </section>
      <div className="va-actions">
        <LienOriginal a={a} />
      </div>
      <Text size="xs" c="dimmed">
        Texte de la source repris tel quel, découpé en paragraphes et listes là où il en porte ; aucun balisage n’est
        interprété. Vu par la veille le <span className="horodatage">{fmtDate(a.vuLe)}</span>.
      </Text>
    </article>
  );
}
