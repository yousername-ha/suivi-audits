/* Module Vulnérabilités (ADR 0100, lot R1) : barre de recherche globale, en tête de toutes les pages du module (Layout).
   Une saisie (2 à 200 caractères), un délai de frappe, un appel à une seule route ; l'appel précédent est annulé. Résultats
   groupés : CVE (y compris celles de la veille non détectées sur le parc), machines internes, actifs exposés, applications.
   Chaque résultat ouvre la page existante ; « tout voir », la liste existante filtrée. Clavier : flèches haut et bas,
   Entrée (Début et Fin restent au champ) ; Échap ferme la liste (une seconde fois, efface la saisie). Résultats annoncés par une zone de statut. Aucun
   appel sortant : une CVE inconnue de la veille locale est signalée, et sa fiche s'ouvre (bouton, ou Entrée) ; c'est là, sur
   le clic de la personne, que cve.org et NVD peuvent être consultés (lot CVE-INC). */
import { useDebouncedValue } from '@mantine/hooks';
import { RECHERCHE_GLOBALE_BORNES, type RechercheGlobaleDto } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { type FocusEvent, type KeyboardEvent, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, errorMessage } from '../api';
import { useCan } from '../session';
import {
  annonceRecherche,
  DELAI_FRAPPE,
  lienFicheCve,
  type GroupeOptions,
  type OptionRecherche,
  optionsRecherche,
  rechercheValide,
  SOURCE_GROUPE,
  urlRecherche,
} from './recherche';
import { PictoSource, PictosSources } from './PictoSource';

export const NOM_CHAMP_RECHERCHE = 'Rechercher une CVE, une machine, une adresse IP ou une application';

function IconeLoupe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Nouvelle option active après une touche (flèches ; Début et Fin pour une liste) ; null : la touche ne déplace pas. */
export function deplacerOption(actif: number, touche: string, n: number): number | null {
  if (!n) return null;
  switch (touche) {
    case 'ArrowDown':
      return actif < 0 ? 0 : (actif + 1) % n;
    case 'ArrowUp':
      return actif < 0 ? n - 1 : (actif - 1 + n) % n;
    case 'Home':
      return 0;
    case 'End':
      return n - 1;
    default:
      return null;
  }
}

/** Le focus quitte la barre de recherche (la liste se ferme) : pas quand il passe du champ au bouton « Ouvrir sa fiche » d'une
    CVE inconnue, ou de ce bouton au champ (tabulation), sans quoi le bouton disparaîtrait avant d'être atteint. */
export function focusQuitteRecherche(conteneur: Pick<Node, 'contains'> | null, suivant: Node | null): boolean {
  return !(conteneur && suivant && conteneur.contains(suivant));
}
const quitte = (e: FocusEvent<HTMLElement>) =>
  focusQuitteRecherche(e.currentTarget.closest('.rv'), e.relatedTarget instanceof Node ? e.relatedTarget : null);

/** Présentation (sans état) : champ combobox, panneau des résultats groupés, zone de statut. */
export function RechercheVulnerabilitesVue({
  id,
  saisie,
  ouvert,
  actif,
  reponse,
  enCours,
  erreur,
  onSaisie,
  onTouche,
  onChoisir,
  onSurvol,
  onFocus,
  onBlur,
}: {
  id: string;
  saisie: string;
  ouvert: boolean;
  actif: number;
  reponse: RechercheGlobaleDto | undefined;
  enCours: boolean;
  erreur: string | null;
  onSaisie: (v: string) => void;
  onTouche: (e: KeyboardEvent<HTMLInputElement>) => void;
  onChoisir: (o: OptionRecherche) => void;
  onSurvol: (i: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const valide = rechercheValide(saisie);
  const groupes: GroupeOptions[] = reponse ? optionsRecherche(reponse) : [];
  const options = groupes.flatMap((g) => g.options);
  const idOption = (i: number) => `${id}-o${i}`;
  const montrer = ouvert && valide;
  const listeVisible = montrer && options.length > 0;
  let rang = 0;
  return (
    <div className="rv" role="search" aria-label="Recherche dans le module Vulnérabilités">
      <label className="rv__champ">
        <IconeLoupe />
        <span className="rv__etiquette" aria-hidden="true">
          Recherche
        </span>
        <input
          type="text"
          role="combobox"
          aria-label={NOM_CHAMP_RECHERCHE}
          aria-autocomplete="list"
          aria-expanded={listeVisible}
          aria-controls={`${id}-liste`}
          aria-describedby={`${id}-aide`}
          aria-activedescendant={listeVisible && actif >= 0 && actif < options.length ? idOption(actif) : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={RECHERCHE_GLOBALE_BORNES.max + 20}
          placeholder="CVE, machine, IP, application…"
          value={saisie}
          onChange={(e) => onSaisie(e.currentTarget.value)}
          onKeyDown={onTouche}
          onFocus={onFocus}
          onBlur={(e) => {
            if (quitte(e)) onBlur();
          }}
        />
      </label>
      <span id={`${id}-aide`} className="sr-only">
        Au moins deux caractères. Flèches pour parcourir les résultats, Entrée pour ouvrir, Échap pour fermer.
      </span>
      <div role="status" className="sr-only">
        {montrer ? (erreur ? `Recherche impossible : ${erreur}` : annonceRecherche(reponse, enCours)) : ''}
      </div>
      {/* Panneau toujours présent (la liste reste la cible de aria-controls), masqué quand il n'a rien à montrer. */}
      <div className="rv__panneau" hidden={!montrer}>
        {montrer && erreur && <p className="rv__message">Recherche impossible : {erreur}</p>}
        {montrer && !erreur && reponse?.cveInconnue && (
          <p className="rv__inconnue">
            <strong>{reponse.cveInconnue.cve}</strong> : CVE inconnue de la veille locale. Aucune source collectée ne la
            cite et elle n’est détectée sur aucune machine ni aucun actif exposé. La plateforme ne consulte aucun
            service extérieur depuis cette recherche.{' '}
            {/* Lot CVE-INC : sa fiche propose la consultation de cve.org et NVD, sur clic (Entrée l'ouvre aussi). */}
            <button
              type="button"
              className="rv__ouvrir"
              onMouseDown={(e) => e.preventDefault()}
              // Atteint à la tabulation depuis le champ : la liste reste ouverte tant que le focus reste dans la recherche.
              onBlur={(e) => {
                if (quitte(e)) onBlur();
              }}
              onClick={() =>
                onChoisir({
                  cle: `inconnue-${reponse.cveInconnue!.cve}`,
                  titre: reponse.cveInconnue!.cve,
                  detail: 'CVE inconnue de la veille locale',
                  to: lienFicheCve(reponse.cveInconnue!.cve),
                })
              }
            >
              Ouvrir sa fiche (consultation de cve.org et NVD sur votre clic)
            </button>
          </p>
        )}
        {montrer && !erreur && reponse && !groupes.length && !reponse.cveInconnue && (
          <p className="rv__message">Aucun résultat dans le module pour « {reponse.q} ».</p>
        )}
        {montrer && !erreur && !reponse && enCours && <p className="rv__message">Recherche en cours…</p>}
        <div id={`${id}-liste`} role="listbox" aria-label="Résultats de la recherche" hidden={!listeVisible}>
          {groupes.map((g) => (
            <div key={g.groupe} className="rv__groupe" role="group" aria-labelledby={`${id}-g-${g.groupe}`}>
              <div id={`${id}-g-${g.groupe}`} className="rv__titre-groupe" role="presentation">
                <span className="rv__titre-libelle">
                  {SOURCE_GROUPE[g.groupe] && (
                    <PictoSource source={SOURCE_GROUPE[g.groupe]!} decoratif infobulle={false} />
                  )}
                  {g.libelle}
                </span>
                <span className="rv__total">{g.total}</span>
              </div>
              {g.options.map((o) => {
                const i = rang++;
                const classes = [
                  'rv__option',
                  g.groupe === 'cves' && !o.toutVoir ? 'rv__option--cve' : '',
                  o.toutVoir ? 'rv__option--tout' : '',
                  o.etat ? `rv__option--${o.etat}` : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={o.cle}
                    id={idOption(i)}
                    role="option"
                    aria-selected={i === actif}
                    className={classes}
                    // Le clic ne retire pas le curseur du champ avant d'ouvrir la page.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onChoisir(o)}
                    onMouseEnter={() => onSurvol(i)}
                  >
                    <span className="rv__option-titre">
                      {o.titre}
                      {o.sources?.length ? <PictosSources sources={o.sources} decoratif infobulle={false} /> : null}
                    </span>
                    <span className="rv__option-detail">{o.detail}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Barre de recherche du module : visible avec le droit de lire le module. */
export function RechercheVulnerabilites() {
  const lire = useCan()('vulnerabilites', 'lire');
  const navigate = useNavigate();
  const id = useId().replace(/:/g, '');
  const [saisie, setSaisie] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [terme] = useDebouncedValue(saisie.trim(), DELAI_FRAPPE);
  const valide = rechercheValide(terme);
  const q = useQuery({
    queryKey: ['vulnerabilites', 'recherche', terme],
    // Le signal annule l'appel précédent quand la saisie change (la requête précédente perd son observateur).
    queryFn: ({ signal }) => api<RechercheGlobaleDto>('GET', urlRecherche(terme), { signal }),
    enabled: lire && valide,
    staleTime: 30_000,
    retry: false,
  });
  // Réponse affichée seulement si elle correspond à la saisie courante (pas de résultats d'une saisie précédente).
  const reponse = valide && saisie.trim() === terme ? q.data : undefined;
  const options = useMemo(() => (reponse ? optionsRecherche(reponse).flatMap((g) => g.options) : []), [reponse]);
  if (!lire) return null;

  const choisir = (o: OptionRecherche) => {
    setOuvert(false);
    setActif(-1);
    navigate(o.to);
  };
  const touche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ouvert) setOuvert(false);
      else setSaisie('');
      setActif(-1);
      return;
    }
    if (e.key === 'Enter') {
      const o = options[actif];
      if (ouvert && o) {
        e.preventDefault();
        choisir(o);
      } else if (ouvert && actif < 0 && !options.length && reponse?.cveInconnue) {
        // Lot CVE-INC : une CVE inconnue de la veille, seul résultat : Entrée ouvre sa fiche.
        e.preventDefault();
        setOuvert(false);
        navigate(lienFicheCve(reponse.cveInconnue.cve));
      }
      return;
    }
    // Début et Fin restent au champ (déplacement du curseur dans la saisie).
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const suivant = deplacerOption(actif, e.key, options.length);
    if (suivant !== null) {
      e.preventDefault();
      setOuvert(true);
      setActif(suivant);
    }
  };
  return (
    <RechercheVulnerabilitesVue
      id={id}
      saisie={saisie}
      ouvert={ouvert}
      actif={actif}
      reponse={reponse}
      enCours={rechercheValide(saisie) && (saisie.trim() !== terme || q.isFetching)}
      erreur={q.error ? errorMessage(q.error) : null}
      onSaisie={(v) => {
        setSaisie(v);
        setOuvert(true);
        setActif(-1);
      }}
      onTouche={touche}
      onChoisir={choisir}
      onSurvol={setActif}
      onFocus={() => setOuvert(true)}
      onBlur={() => setOuvert(false)}
    />
  );
}
